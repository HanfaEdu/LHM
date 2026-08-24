import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';

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
async function pastikanKepalaSekolah(request) {
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
    .select('email, nama, role')
    .eq('email', user.email.toLowerCase().trim())
    .maybeSingle();

  if (profil?.role !== 'kepala_sekolah') {
    return {
      galat: 'Hanya kepala sekolah yang dapat mengelola tautan orang tua.',
      status: 403,
    };
  }

  return { db, profil };
}

/** Token 24 byte acak (48 karakter heksadesimal), sama seperti di dokumentasi. */
function tokenBaru() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function POST(request) {
  const izin = await pastikanKepalaSekolah(request);
  if (izin.galat) {
    return NextResponse.json({ error: izin.galat }, { status: izin.status });
  }
  const db = izin.db;

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
        'nis, siswa:nis (nis, nama_lengkap, nama_panggilan), kelas:kelas_id (id, nama_kelas, tahun_ajaran)'
      );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const barisTahunIni = (penempatan || []).filter(
      (p) => p.kelas?.tahun_ajaran === tahunAjaran && p.siswa
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
          token: a?.token ?? null,
          aktif: a?.aktif ?? null,
          terakhir_dibuka: a?.terakhir_dibuka ?? null,
        };
      })
      .sort(
        (x, y) =>
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

    const { data: sudahAda } = await db
      .from('akses_ortu')
      .select('nis')
      .in('nis', nisDaftar);

    const punya = new Set((sudahAda || []).map((a) => a.nis));
    // Siswa yang sudah punya tautan sengaja dilewati, bukan ditimpa:
    // menimpa berarti mematikan tautan yang mungkin sudah tersebar di
    // WhatsApp tanpa ada yang memintanya.
    const perlu = nisDaftar.filter((n) => !punya.has(n));

    if (!perlu.length) {
      return NextResponse.json({ diterbitkan: 0, dilewati: nisDaftar.length });
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

    const { error } = await db
      .from('akses_ortu')
      .update({ aktif: Boolean(aktif) })
      .eq('nis', nis);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Aksi tidak dikenali.' }, { status: 400 });
}
