import { timingSafeEqual } from 'crypto';
import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { nomorWa } from '@/lib/nomor-wa';
import { susunBalasan } from '@/lib/wa-balasan';
import { SEKOLAH_BAWAAN } from '@/lib/sekolah';

export const dynamic = 'force-dynamic';

/**
 * Layanan WhatsApp orang tua.
 *
 * Orang tua mengirim pesan apa pun ke nomor WhatsApp sekolah; endpoint
 * ini dipanggil Fonnte sebagai webhook, mengenali NOMOR PENGIRIM sebagai
 * orang tua siswa tertentu, lalu membalas dengan tautan rapor anaknya.
 *
 * KENAPA NOMOR, BUKAN ISI PESAN
 * -----------------------------
 * Percobaan sebelumnya meminta orang tua mengetik "Nama-Kelas", lalu
 * mencocokkannya ke daftar. Cara itu punya dua cacat yang tidak bisa
 * ditambal dengan kalimat yang lebih baik:
 *
 *   1. Ia bukan pengamanan sama sekali. Nama dan kelas seorang siswa
 *      diketahui seluruh wali murid sekelas; siapa pun bisa meminta
 *      tautan rapor anak orang lain dari nomor mana pun.
 *   2. Ia gagal untuk hampir semua orang. "Faisal-3", "faisal 3",
 *      "Muhammad Faisal-3", dan "Faisal kelas 3" adalah empat hal
 *      berbeda bagi mesin, dan satu-satunya yang diterima adalah yang
 *      persis sama dengan isi sel di spreadsheet.
 *
 * Nomor pengirim tidak punya dua masalah itu. Ia diverifikasi WhatsApp
 * sendiri, tidak bisa salah ketik, dan sudah tercatat di Master Rekap
 * sejak awal. Isi pesannya karena itu tidak dibaca sama sekali — "assalamu
 * alaikum", "p", dan stiker sama-sama dijawab dengan benar.
 *
 * KENAPA MEMBALAS TAUTAN KE PENGIRIM ITU AMAN
 * -------------------------------------------
 * Balasan SELALU dikirim ke nomor pengirim yang sudah dicocokkan, tidak
 * pernah ke nomor mana pun yang ikut dalam badan permintaan. Jadi
 * sekalipun webhook ini dipanggil orang lain dengan data palsu, tautan
 * yang terkirim mendarat di WhatsApp orang tua yang sebenarnya — bukan
 * di tangan pemalsunya. Kunci rahasia di bawah tetap diperlukan, tetapi
 * untuk mencegah penyalahgunaan kuota dan pesan sampah, bukan sebagai
 * satu-satunya penjaga kerahasiaan tautan.
 */

/** Batas pesan yang dijawab per nomor per jam. */
const BATAS_PER_JAM = 8;

/**
 * Alamat API Fonnte.
 *
 * Bisa dialihkan lewat env var supaya seluruh alur endpoint ini dapat
 * diuji tanpa benar-benar mengirim WhatsApp ke nomor siapa pun
 * (scripts/uji-layanan-wa-server.mjs). Di produksi env itu tidak diisi
 * dan nilainya tetap alamat Fonnte yang sebenarnya.
 */
const API_FONNTE = process.env.FONNTE_API_URL || 'https://api.fonnte.com/send';

/**
 * Membandingkan kunci tanpa membocorkan berapa banyak karakter yang
 * sudah cocok lewat lama waktu perbandingan.
 */
function kunciCocok(dikirim, seharusnya) {
  const a = Buffer.from(String(dikirim || ''));
  const b = Buffer.from(String(seharusnya || ''));
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Membaca badan permintaan Fonnte.
 *
 * Fonnte mengirim webhook sebagai form (application/x-www-form-urlencoded
 * atau multipart), tetapi field "JSON" pada pengaturannya mengubahnya
 * menjadi JSON. Keduanya diterima supaya layanan tidak diam-diam mati
 * ketika pengaturan di Fonnte diubah orang lain.
 */
async function bacaBadan(request) {
  const jenis = request.headers.get('content-type') || '';

  if (jenis.includes('application/json')) {
    try {
      const isi = await request.json();
      if (!isi || typeof isi !== 'object') return {};

      // Sebagian versi Fonnte membungkus isinya di dalam `data`.
      const dalam = isi.data && typeof isi.data === 'object' ? isi.data : {};
      return { ...isi, ...dalam };
    } catch {
      return {};
    }
  }

  try {
    const form = await request.formData();
    return Object.fromEntries(form.entries());
  } catch {
    return {};
  }
}

/** Alamat resmi aplikasi — tautan tidak boleh dibangun dari alamat cadangan. */
function asalResmi(request) {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    request.nextUrl.origin
  ).replace(/\/+$/, '');
}

/**
 * Sekolah pemilik nomor WhatsApp yang dituju.
 *
 * Seluruh baris dibaca lalu dicocokkan di sini (tabelnya berisi
 * segelintir baris) alih-alih memakai .eq(): kolom wa_pengirim diisi
 * manusia lewat SQL Editor, jadi '0812...' dan '62812...' sama-sama
 * wajar muncul di sana dan keduanya harus cocok.
 */
async function sekolahPengirim(db, device) {
  const nomor = nomorWa(device);
  if (!nomor) return null;

  try {
    const { data } = await db.from('sekolah').select('id, nama, kode, wa_pengirim');
    return (data || []).find((s) => nomorWa(s.wa_pengirim) === nomor) || null;
  } catch {
    // Migrasi 003 belum dijalankan. Layanan tetap berjalan untuk sekolah tunggal.
    return null;
  }
}

/**
 * Mengirim balasan lewat Fonnte. Mengembalikan true bila diterima.
 *
 * Kegagalan jaringan ditelan menjadi `false`, bukan dilempar: webhook
 * yang menjawab 500 akan dikirim ulang Fonnte, dan pengiriman ulang itu
 * hanya menambah percobaan yang sama-sama gagal sambil memakan kuota.
 * Yang perlu terjadi justru sebaliknya -- kegagalannya tercatat di
 * wa_pesan sebagai 'gagal_kirim', lalu berhenti.
 */
async function kirimWa(token, tujuan, teks) {
  let respons;
  try {
    respons = await fetch(API_FONNTE, {
      method: 'POST',
      headers: { Authorization: token },
      body: new URLSearchParams({ target: tujuan, message: teks }),
    });
  } catch {
    return false;
  }

  if (!respons.ok) return false;

  // Fonnte menjawab HTTP 200 juga untuk penolakan ("status": false),
  // mis. saat kuota habis atau perangkat terputus. Tanpa membaca isinya,
  // kegagalan itu akan tercatat sebagai "terkirim".
  try {
    const isi = await respons.json();
    return isi?.status !== false;
  } catch {
    return true;
  }
}

/** Mencatat satu pesan masuk. Kegagalannya tidak boleh menggagalkan balasan. */
async function catat(db, baris) {
  try {
    await db.from('wa_pesan').insert(baris);
  } catch {
    // Migrasi 003 belum dijalankan, atau tabelnya sedang bermasalah.
  }
}

export async function POST(request) {
  const kunciServer = process.env.WA_WEBHOOK_SECRET;

  // Gagal TERTUTUP: tanpa kunci di server, endpoint ini terbuka bagi
  // siapa saja untuk menghabiskan kuota WhatsApp sekolah.
  if (!kunciServer) {
    return NextResponse.json(
      { error: 'WA_WEBHOOK_SECRET belum diatur di server.' },
      { status: 500 }
    );
  }

  const kunciDikirim =
    request.headers.get('x-wa-secret') || request.nextUrl.searchParams.get('kunci') || '';

  if (!kunciCocok(kunciDikirim, kunciServer)) {
    return NextResponse.json({ error: 'Tidak diizinkan.' }, { status: 401 });
  }

  const badan = await bacaBadan(request);

  /* Pesan grup diabaikan tanpa dibalas.

     Tautan rapor bersifat pribadi, dan membalasnya ke dalam grup wali
     murid berarti mengirimkannya ke seluruh anggota grup sekaligus. */
  if (String(badan.group || '').trim()) {
    return NextResponse.json({ ok: true, lewat: 'grup' });
  }

  const pengirim = nomorWa(badan.sender || badan.pengirim || '');
  if (!pengirim) {
    return NextResponse.json({ ok: true, lewat: 'nomor tidak terbaca' });
  }

  const db = supabaseServer();
  const sekolah = await sekolahPengirim(db, badan.device || '');

  /* --- Pembatas laju ------------------------------------------------
     Autoresponder di seberang, atau orang tua yang menekan kirim
     berkali-kali, dapat membuat dua sistem saling berbalas tanpa henti.
     Yang dihitung adalah pesan MASUK dari nomor ini, sehingga batasnya
     tetap berlaku bahkan ketika balasan gagal terkirim. */
  const sejamLalu = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  try {
    const { count } = await db
      .from('wa_pesan')
      .select('id', { count: 'exact', head: true })
      .eq('pengirim', pengirim)
      .gte('dibuat_pada', sejamLalu);

    if ((count || 0) >= BATAS_PER_JAM) {
      await catat(db, {
        pengirim,
        sekolah_id: sekolah?.id ?? null,
        hasil: 'dibatasi',
        jumlah_anak: 0,
      });
      return NextResponse.json({ ok: true, lewat: 'dibatasi' });
    }
  } catch {
    // Tabel wa_pesan belum ada. Layanan tetap berjalan, tanpa pembatas.
  }

  /* --- Siapa anak dari nomor ini ------------------------------------
     Disaring ke sekolah pemilik nomor tujuan bila diketahui: satu
     aplikasi melayani beberapa sekolah, dan pesan yang masuk ke nomor
     Kudus tidak boleh dijawab dengan data Pati. */
  let cari = db
    .from('siswa')
    .select('nis, nama_lengkap, nama_panggilan, sekolah_id')
    .contains('wa_normal', [pengirim]);

  if (sekolah) cari = cari.eq('sekolah_id', sekolah.id);

  const { data: siswa, error: galatSiswa } = await cari;

  if (galatSiswa) {
    return NextResponse.json(
      { error: 'Gagal mencari data siswa: ' + galatSiswa.message },
      { status: 500 }
    );
  }

  const daftarNis = (siswa || []).map((s) => s.nis);
  const tautanPer = new Map();
  const kelasPer = new Map();

  if (daftarNis.length) {
    const { data: akses } = await db
      .from('akses_ortu')
      .select('nis, token, aktif')
      .in('nis', daftarNis);

    for (const a of akses || []) {
      if (a.aktif && a.token) tautanPer.set(a.nis, a.token);
    }

    // Kelas terakhir yang ditempati: tahun ajaran tertinggi menang,
    // supaya anak yang sudah naik kelas tidak disebut kelas lamanya.
    const { data: penempatan } = await db
      .from('penempatan')
      .select('nis, kelas:kelas_id (nama_kelas, tahun_ajaran)')
      .in('nis', daftarNis);

    for (const p of penempatan || []) {
      if (!p.kelas) continue;
      const sebelumnya = kelasPer.get(p.nis);
      if (!sebelumnya || p.kelas.tahun_ajaran > sebelumnya.tahun_ajaran) {
        kelasPer.set(p.nis, p.kelas);
      }
    }
  }

  const asal = asalResmi(request);
  const anak = (siswa || []).map((s) => {
    const token = tautanPer.get(s.nis);
    return {
      nama: s.nama_panggilan || s.nama_lengkap,
      kelas: kelasPer.get(s.nis)?.nama_kelas || null,
      tautan: token ? `${asal}/rapor/${token}` : null,
    };
  });

  /* Nama sekolah untuk kaki pesan. Kalau nomor tujuan tidak dikenali
     tabel sekolah, namanya diambil dari sekolah anaknya sendiri. */
  let namaSekolah = sekolah?.nama || null;
  if (!namaSekolah && siswa?.length) {
    const { data: milikAnak } = await db
      .from('sekolah')
      .select('nama')
      .eq('id', siswa[0].sekolah_id)
      .maybeSingle();
    namaSekolah = milikAnak?.nama || null;
  }

  const { teks, hasil } = susunBalasan({
    namaSekolah: namaSekolah || SEKOLAH_BAWAAN,
    anak,
  });

  /* Token perangkat dipilih per sekolah lebih dulu (FONNTE_TOKEN_SDYFK),
     baru jatuh ke token tunggal. Dengan begitu sekolah kedua yang punya
     perangkat WhatsApp sendiri cukup menambah satu env var — tidak ada
     kredensial yang perlu disimpan di dalam database. */
  const tokenFonnte =
    (sekolah?.kode && process.env['FONNTE_TOKEN_' + sekolah.kode]) ||
    process.env.FONNTE_TOKEN;

  if (!tokenFonnte) {
    await catat(db, {
      pengirim,
      sekolah_id: sekolah?.id ?? null,
      hasil: 'gagal_kirim',
      jumlah_anak: anak.length,
    });
    return NextResponse.json(
      { error: 'FONNTE_TOKEN belum diatur di server.' },
      { status: 500 }
    );
  }

  const terkirim = await kirimWa(tokenFonnte, pengirim, teks);

  await catat(db, {
    pengirim,
    sekolah_id: sekolah?.id ?? null,
    hasil: terkirim ? hasil : 'gagal_kirim',
    jumlah_anak: anak.length,
  });

  return NextResponse.json({ ok: true, hasil, terkirim, anak: anak.length });
}

/**
 * Penanda hidup, untuk memastikan alamat webhook sudah benar sebelum
 * dipasang di Fonnte. Sengaja tidak menyebut apa pun tentang data.
 */
export async function GET() {
  return new Response('Layanan WhatsApp SiPaDi aktif.', {
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
}
