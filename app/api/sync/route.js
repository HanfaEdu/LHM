import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { nomorWaDaftar } from '@/lib/nomor-wa';
import {
  TABEL_TERIKAT,
  bacaKodeDirektur,
  bacaKunciSekolah,
  kodePemilikKunci,
  pesanPelanggaran,
  periksaBaris,
  samaAman,
} from '@/lib/sinkron-terikat';

export const dynamic = 'force-dynamic';

/**
 * Jembatan tulis untuk Apps Script -> Supabase.
 *
 * Google Apps Script (UrlFetchApp) tidak bisa memanggil Supabase langsung
 * memakai kunci sb_secret_...: Supabase menolaknya dengan "Forbidden use
 * of secret API key in browser" karena permintaan GAS ikut terdeteksi
 * sebagai browser oleh heuristik keamanan mereka -- walau GAS jelas
 * berjalan di server Google, bukan browser pengguna. Menambahkan header
 * User-Agent kustom tidak menembus deteksi ini.
 *
 * Endpoint ini jadi perantara: GAS memanggil endpoint ini (dengan kunci
 * rahasia milik kita sendiri, bukan kunci Supabase), lalu endpoint inilah
 * -- yang berjalan di server Vercel, bukan browser -- yang benar-benar
 * bicara ke Supabase memakai service_role/secret key.
 *
 * Nama tabel dibatasi lewat daftar putih supaya kunci rahasia yang bocor
 * tidak bisa dipakai menulis ke tabel sembarang.
 *
 * KUNCI PER SEKOLAH
 * -----------------
 * Daftar putih tabel saja belum cukup: endpoint ini memakai service_role
 * (menembus RLS), jadi pemegang satu kunci bersama bisa menulis baris
 * sekolah MANA PUN, termasuk users_access -- yaitu mengangkat emailnya
 * sendiri menjadi kepala sekolah/direktur di sekolah lain. Maka ada dua
 * mode, dipilih dari kunci yang dikirim:
 *
 *   TERIKAT  kunci cocok dengan salah satu nilai env SYNC_SECRETS
 *            ({"SDYFK":"<kunci>", ...}). Kode sekolahnya diketahui dari
 *            kunci itu, dan setiap baris diperiksa (lib/sinkron-terikat.js)
 *            sebelum ditulis. Satu baris melanggar -> seluruh permintaan
 *            ditolak 403, tanpa menulis apa pun.
 *   LAMA     kunci sama dengan SYNC_SHARED_SECRET. Perilaku persis seperti
 *            sebelumnya. Hanya masa peralihan: begitu variabel itu dihapus
 *            dari Vercel, mode ini mati dengan sendirinya.
 */

const TABEL_DIIZINKAN = [
  'sekolah',
  'kelas',
  'siswa',
  'penempatan',
  'nilai_bulanan',
  'users_access',
];

/**
 * Melengkapi baris siswa dengan nomor WA yang sudah dibakukan.
 *
 * Apps Script mengirim kolom "No WA" apa adanya -- "0812-3456-7890",
 * "+62 812 ...", atau 81234567890 (nol di depannya hilang karena Sheets
 * membaca selnya sebagai angka). Bentuk baku 62xxxxxxxxxx-lah yang
 * dicocokkan dengan nomor pengirim WhatsApp di /api/wa.
 *
 * Pembakuannya dilakukan DI SINI, bukan di Apps Script maupun sebagai
 * kolom generated di Postgres, supaya aturannya hanya punya satu
 * salinan (lib/nomor-wa.js). Dua salinan yang menyimpang akan muncul
 * sebagai orang tua yang tidak dikenali sistem -- tanpa satu pun pesan
 * galat yang menunjukkan sebabnya.
 *
 * Baris tanpa field no_wa dibiarkan utuh: upsert yang tidak menyebut
 * kolomnya tidak boleh diam-diam mengosongkan nomor yang sudah ada.
 */
function lengkapiNomorWa(tabel, data) {
  if (tabel !== 'siswa') return data;

  return data.map((baris) =>
    baris && Object.prototype.hasOwnProperty.call(baris, 'no_wa')
      ? { ...baris, wa_normal: nomorWaDaftar(baris.no_wa) }
      : baris
  );
}

/**
 * Data pembanding untuk mode terikat: id sekolah pemilik kunci, seluruh
 * id kelasnya, dan email (dari baris yang akan ditulis) yang sudah milik
 * sekolah lain. Satu kegagalan baca = ditolak; tidak pernah diteruskan.
 *
 * Seluruh kelas satu sekolah jauh di bawah batas 1.000 baris per query.
 */
async function ambilKonteksTerikat(db, kode, tabel, data) {
  const { data: sekolah, error } = await db
    .from('sekolah')
    .select('id')
    .eq('kode', kode)
    .maybeSingle();
  if (error) throw error;

  const sekolahId = sekolah?.id ?? null;
  let idKelas = [];
  let emailMilikLain = [];

  if (sekolahId !== null && ['penempatan', 'nilai_bulanan'].includes(tabel)) {
    const { data: kelas, error: galatKelas } = await db
      .from('kelas')
      .select('id')
      .eq('sekolah_id', sekolahId);
    if (galatKelas) throw galatKelas;
    idKelas = (kelas || []).map((k) => k.id);
  }

  if (sekolahId !== null && tabel === 'users_access') {
    const email = [...new Set(
      data.map((b) => String(b?.email || '').toLowerCase().trim()).filter(Boolean)
    )];
    if (email.length) {
      const { data: ada, error: galatEmail } = await db
        .from('users_access')
        .select('email, sekolah_id')
        .in('email', email);
      if (galatEmail) throw galatEmail;
      emailMilikLain = (ada || [])
        .filter((u) => u.sekolah_id !== null && u.sekolah_id !== undefined
          && String(u.sekolah_id) !== String(sekolahId))
        .map((u) => String(u.email).toLowerCase());
    }
  }

  return { sekolahId, idKelas, emailMilikLain };
}

export async function POST(request) {
  const kunciRahasia = request.headers.get('x-sync-secret');

  /* Mode ditentukan dari kunci: kunci sekolah -> TERIKAT; kunci lama ->
     LAMA; selain itu 401. Kunci lama hanya berlaku selama variabelnya
     masih ada di Vercel. */
  const kodeTerikat = kodePemilikKunci(
    kunciRahasia,
    bacaKunciSekolah(process.env.SYNC_SECRETS)
  );
  const kunciLama = process.env.SYNC_SHARED_SECRET;
  const modeLama = kodeTerikat === null
    && Boolean(kunciRahasia) && Boolean(kunciLama) && samaAman(kunciRahasia, kunciLama);

  if (kodeTerikat === null && !modeLama) {
    return NextResponse.json({ error: 'Tidak diizinkan.' }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Payload tidak valid.' }, { status: 400 });
  }

  const { tabel, data, onConflict } = body;
  if (!tabel || !Array.isArray(data) || !onConflict) {
    return NextResponse.json(
      { error: 'Field tabel, data (array), dan onConflict wajib diisi.' },
      { status: 400 }
    );
  }
  if (!TABEL_DIIZINKAN.includes(tabel)) {
    return NextResponse.json({ error: 'Tabel "' + tabel + '" tidak diizinkan.' }, { status: 400 });
  }
  if (data.length === 0) {
    return NextResponse.json({ data: [] });
  }

  try {
    const db = supabaseServer();

    /* Mode terikat: SEMUA baris diperiksa sebelum satu pun ditulis.
       Gagal tertutup -- galat membaca data pembanding juga menolak
       (500), tidak pernah meneruskan tanpa pemeriksaan. */
    if (kodeTerikat !== null) {
      if (!TABEL_TERIKAT.includes(tabel)) {
        return NextResponse.json({ error: 'Tabel "' + tabel + '" tidak diizinkan.' }, { status: 400 });
      }
      const konteks = await ambilKonteksTerikat(db, kodeTerikat, tabel, data);
      const pelanggaran = periksaBaris(tabel, data, {
        kode: kodeTerikat,
        ...konteks,
        kodeDirektur: bacaKodeDirektur(process.env.SYNC_KODE_DIREKTUR),
      });
      if (pelanggaran.length) {
        return NextResponse.json({ error: pesanPelanggaran(tabel, pelanggaran) }, { status: 403 });
      }
    }

    const { data: hasil, error } = await db
      .from(tabel)
      .upsert(lengkapiNomorWa(tabel, data), { onConflict })
      .select();

    if (error) {
      /* Kolom no_wa/wa_normal baru ada setelah migrasi 003 dijalankan.
         Kalau sync.js yang baru berjalan lebih dulu, Postgres menolaknya
         dengan pesan "column ... does not exist" yang tidak menyebut apa
         yang harus dikerjakan -- padahal jalan keluarnya satu langkah. */
      const pesan = /no_wa|wa_normal/.test(error.message)
        ? error.message +
          ' -- jalankan migrasi/003-layanan-wa.sql di Supabase SQL Editor ' +
          'lebih dulu, lalu ulangi sinkronisasi.'
        : error.message;
      return NextResponse.json({ error: pesan }, { status: 500 });
    }
    return NextResponse.json({ data: hasil });
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Gangguan server.' }, { status: 500 });
  }
}
