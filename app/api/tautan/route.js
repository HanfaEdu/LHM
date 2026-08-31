import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { dalamCakupan } from '@/lib/cakupan';

export const dynamic = 'force-dynamic';

/**
 * Pengelolaan tautan rapor orang tua, khusus kepala sekolah.
 *
 * Tabel akses_ortu sengaja tidak punya policy SELECT sama sekali (lihat
 * schema.sql): token adalah kredensial, dan tidak boleh bisa dibaca dari
 * browser dengan anon key oleh siapa pun. Karena itu seluruh operasinya
 * lewat endpoint ini, yang memakai service_role dan memeriksa sendiri
 * siapa pemanggilnya.
 *
 * Pembatasan ke kepala sekolah saja bukan kehati-hatian berlebihan:
 * siapa pun yang bisa menerbitkan atau membaca tautan, bisa membuka rapor
 * siswa mana pun di sekolah — termasuk kelas yang bukan asuhannya. Wali
 * kelas menerima daftar tautan kelasnya dari kepala sekolah lewat berkas
 * Excel, bukan dengan membuka endpoint ini.
 */

/**
 * Memastikan pemanggil benar-benar kepala sekolah yang sedang login.
 *
 * Token sesi Supabase diverifikasi ke Supabase (bukan sekadar diurai di
 * sini), lalu emailnya dicocokkan ke users_access. Peran tidak pernah
 * diambil dari badan permintaan — kalau begitu, siapa pun tinggal
 * mengaku kepala sekolah.
 */
async function pastikanBerwenang(request) {
  const kepala = request.headers.get('authorization') || '';
  const token = kepala.startsWith('Bearer ') ? kepala.slice(7) : '';
  if (!token) return { galat: 'Sesi tidak ditemukan. Silakan masuk kembali.', status: 401 };

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const kunciPublik =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !kunciPublik) {
    return { galat: 'Konfigurasi server belum lengkap.', status: 500 };
  }

  const klien = createClient(url, kunciPublik, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const {
    data: { user },
    error,
  } = await klien.auth.getUser(token);

  if (error || !user?.email) {
    return { galat: 'Sesi tidak berlaku. Silakan masuk kembali.', status: 401 };
  }

  const db = supabaseServer();
  const { data: profil } = await db
    .from('users_access')
    .select('email, nama, role, sekolah_id, cakupan_jenjang')
    .eq('email', user.email.toLowerCase().trim())
    .maybeSingle();

  if (profil?.role !== 'kepala_sekolah' && profil?.role !== 'direktur_area') {
    return {
      galat: 'Hanya kepala sekolah dan biro akademik yang dapat mengelola tautan orang tua.',
      status: 403,
    };
  }

  /* ----------------------------------------------------------------
     Sekolah mana saja yang boleh disentuh pemanggil ini
     ----------------------------------------------------------------
     WAJIB dihitung di sini, dan bukan diserahkan ke RLS: endpoint ini
     memakai service_role, yang MELEWATI seluruh kebijakan RLS. Tanpa
     penyaringan ini, kepala sekolah satu sekolah dapat mendaftar,
     menerbitkan, mengganti, dan mencabut tautan orang tua sekolah lain
     hanya dengan mengirim NIS-nya -- dan token itu kredensial yang
     membuka rapor anak orang.

     Gagal TERTUTUP: kalau sekolahnya tidak bisa ditentukan, permintaan
     ditolak, bukan diteruskan tanpa batas. */
  if (!profil.sekolah_id) {
    return {
      galat:
        'Akun ini belum terhubung ke sekolah mana pun. Jalankan SiPaDi → ' +
        'Sinkronkan Sekarang di Master Rekap, lalu coba lagi.',
      status: 403,
    };
  }

  let sekolahBoleh = [profil.sekolah_id];

  if (profil.role === 'direktur_area') {
    const { data: sendiri } = await db
      .from('sekolah')
      .select('area')
      .eq('id', profil.sekolah_id)
      .maybeSingle();

    // Area kosong tidak bisa dikelompokkan; biro itu tetap dibatasi ke
    // sekolah tempat emailnya terdaftar, bukan dibebaskan ke semuanya.
    if (sendiri?.area) {
      const { data: seArea, error: galatArea } = await db
        .from('sekolah')
        .select('id, jenjang')
        .eq('area', sendiri.area);
      if (galatArea) {
        return { galat: 'Gagal menentukan cakupan sekolah.', status: 500 };
      }
      sekolahBoleh = (seArea || [])
        .filter((s) => dalamCakupan(s.jenjang, profil.cakupan_jenjang))
        .map((s) => s.id);
    }
  }

  return { db, profil, sekolahBoleh };
}

/**
 * Menyaring daftar NIS: hanya yang siswanya berada di sekolah yang boleh
 * disentuh pemanggil. Dipakai sebelum SETIAP tindakan yang menulis.
 */
async function nisYangBoleh(db, sekolahBoleh, daftarNis) {
  const { data, error } = await db
    .from('siswa')
    .select('nis')
    .in('nis', daftarNis)
    .in('sekolah_id', sekolahBoleh);

  if (error) return null;   // null = gagal; pemanggil harus menolak
  return new Set((data || []).map((x) => x.nis));
}

/**
 * Token acak 12 karakter.
 *
 * Sebelumnya 48 karakter heksadesimal, yang membuat tautan WhatsApp
 * membungkus sampai tiga baris dan terlihat seperti tautan sampah.
 * Dipendekkan menjadi 12 karakter atas permintaan pengguna.
 *
 * Yang berubah bukan hanya panjangnya: abjadnya ikut diperlebar dari 16
 * simbol (heksadesimal) menjadi 62. Dengan itu 12 karakter membawa
 * sekitar 71 bit keacakan -- LEBIH kuat daripada 12 karakter heksadesimal
 * yang hanya 48 bit, meski panjang tampilannya sama. Untuk 113 token yang
 * sah di antara 2^71 kemungkinan, menebak satu tautan yang berlaku secara
 * acak tetap tidak realistis.
 *
 * Katup pengamannya tetap sama dan tidak bergantung pada panjang token:
 * tautan yang terlanjur tersebar dicabut atau diganti lewat halaman ini.
 */
const ABJAD = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const PANJANG_TOKEN = 12;

function tokenBaru() {
  // Ditolak-ulang (rejection sampling) alih-alih modulo: 256 tidak habis
  // dibagi 62, sehingga modulo langsung akan membuat 8 karakter pertama
  // abjad muncul lebih sering daripada sisanya.
  const batas = 256 - (256 % ABJAD.length);
  let hasil = '';
  while (hasil.length < PANJANG_TOKEN) {
    const bytes = crypto.getRandomValues(new Uint8Array(PANJANG_TOKEN));
    for (const b of bytes) {
      if (b < batas && hasil.length < PANJANG_TOKEN) {
        hasil += ABJAD[b % ABJAD.length];
      }
    }
  }
  return hasil;
}

export async function POST(request) {
  const izin = await pastikanBerwenang(request);
  if (izin.galat) {
    return NextResponse.json({ error: izin.galat }, { status: izin.status });
  }
  const db = izin.db;
  const sekolahBoleh = izin.sekolahBoleh;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Permintaan tidak dikenali.' }, { status: 400 });
  }

  const { aksi, tahunAjaran, nisDaftar } = body;

  // --- Daftar seluruh siswa satu tahun ajaran beserta status tautannya ---
  if (aksi === 'daftar') {
    if (!tahunAjaran) {
      return NextResponse.json({ error: 'Tahun ajaran wajib diisi.' }, { status: 400 });
    }

    const { data: penempatan, error } = await db
      .from('penempatan')
      .select(
        'nis, siswa:nis (nis, nama_lengkap, nama_panggilan), ' +
        'kelas:kelas_id (id, nama_kelas, tahun_ajaran, sekolah_id)'
      );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Nama sekolah dilampirkan ke tiap baris supaya biro akademik bisa
    // membedakan "A1" milik Kudus dari "A1" milik Pati -- dan menyaringnya.
    const { data: sekolah } = await db.from('sekolah').select('id, nama');
    const namaSekolah = new Map((sekolah || []).map((x) => [x.id, x.nama]));

    const barisTahunIni = (penempatan || []).filter(
      (p) =>
        p.kelas?.tahun_ajaran === tahunAjaran &&
        p.siswa &&
        sekolahBoleh.includes(p.kelas?.sekolah_id)
    );

    const { data: akses } = await db
      .from('akses_ortu')
      .select('nis, token, aktif, terakhir_dibuka');

    const perNis = new Map((akses || []).map((a) => [a.nis, a]));

    const daftar = barisTahunIni
      .map((p) => {
        const a = perNis.get(p.nis);
        return {
          nis: p.nis,
          nama_lengkap: p.siswa.nama_lengkap,
          nama_panggilan: p.siswa.nama_panggilan,
          nama_kelas: p.kelas.nama_kelas,
          sekolah_id: p.kelas.sekolah_id ?? null,
          nama_sekolah: namaSekolah.get(p.kelas.sekolah_id) ?? '',
          token: a?.token ?? null,
          aktif: a?.aktif ?? null,
          terakhir_dibuka: a?.terakhir_dibuka ?? null,
        };
      })
      .sort(
        (x, y) =>
          x.nama_sekolah.localeCompare(y.nama_sekolah, 'id') ||
          x.nama_kelas.localeCompare(y.nama_kelas, 'id') ||
          x.nama_lengkap.localeCompare(y.nama_lengkap, 'id')
      );

    return NextResponse.json({ daftar });
  }

  // --- Menerbitkan tautan bagi siswa yang belum punya ---
  if (aksi === 'terbitkan') {
    if (!Array.isArray(nisDaftar) || !nisDaftar.length) {
      return NextResponse.json({ error: 'Tidak ada siswa yang dipilih.' }, { status: 400 });
    }

    // Disaring lebih dulu: NIS datang dari badan permintaan, jadi tidak
    // boleh dipercaya begitu saja.
    const boleh = await nisYangBoleh(db, sekolahBoleh, nisDaftar);
    if (!boleh) {
      return NextResponse.json({ error: 'Gagal memeriksa hak akses siswa.' }, { status: 500 });
    }
    const nisSah = nisDaftar.filter((n) => boleh.has(n));
    if (!nisSah.length) {
      return NextResponse.json(
        { error: 'Siswa yang dipilih bukan dari sekolah yang Anda kelola.' },
        { status: 403 }
      );
    }

    const { data: sudahAda } = await db
      .from('akses_ortu')
      .select('nis')
      .in('nis', nisSah);

    const punya = new Set((sudahAda || []).map((a) => a.nis));
    // Siswa yang sudah punya tautan sengaja dilewati, bukan ditimpa:
    // menimpa berarti mematikan tautan yang mungkin sudah tersebar di
    // WhatsApp tanpa ada yang memintanya.
    const perlu = nisSah.filter((n) => !punya.has(n));

    if (!perlu.length) {
      return NextResponse.json({ diterbitkan: 0, dilewati: nisSah.length });
    }

    const { error } = await db
      .from('akses_ortu')
      .insert(perlu.map((nis) => ({ nis, token: tokenBaru() })));

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ diterbitkan: perlu.length, dilewati: punya.size });
  }

  // --- Mengganti tautan satu siswa (tautan lama langsung mati) ---
  if (aksi === 'ganti') {
    const nis = body.nis;
    if (!nis) return NextResponse.json({ error: 'NIS wajib diisi.' }, { status: 400 });

    const boleh = await nisYangBoleh(db, sekolahBoleh, [nis]);
    if (!boleh) {
      return NextResponse.json({ error: 'Gagal memeriksa hak akses siswa.' }, { status: 500 });
    }
    if (!boleh.has(nis)) {
      return NextResponse.json(
        { error: 'Siswa ini bukan dari sekolah yang Anda kelola.' },
        { status: 403 }
      );
    }

    // pin_hash ikut dikosongkan: hash-nya mengandung token lama, jadi
    // membiarkannya akan membuat PIN lama tidak pernah cocok lagi.
    const { error } = await db
      .from('akses_ortu')
      .update({ token: tokenBaru(), pin_hash: null, aktif: true })
      .eq('nis', nis);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // --- Menonaktifkan / mengaktifkan kembali ---
  if (aksi === 'aktif') {
    const { nis, aktif } = body;
    if (!nis) return NextResponse.json({ error: 'NIS wajib diisi.' }, { status: 400 });

    const boleh = await nisYangBoleh(db, sekolahBoleh, [nis]);
    if (!boleh) {
      return NextResponse.json({ error: 'Gagal memeriksa hak akses siswa.' }, { status: 500 });
    }
    if (!boleh.has(nis)) {
      return NextResponse.json(
        { error: 'Siswa ini bukan dari sekolah yang Anda kelola.' },
        { status: 403 }
      );
    }

    const { error } = await db
      .from('akses_ortu')
      .update({ aktif: Boolean(aktif) })
      .eq('nis', nis);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Aksi tidak dikenali.' }, { status: 400 });
}
