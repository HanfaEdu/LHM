import { createClient } from '@supabase/supabase-js';
import { supabaseServer } from '@/lib/supabase-server';
import { dalamCakupan } from '@/lib/cakupan';
import { BULAN_AJARAN } from '@/quran_mapping';
import { adaIsiBulan, mapelUntuk, tahunAjaranBerjalan } from '@/lib/statistik';

/**
 * Wewenang dan data untuk asisten.
 *
 * Endpoint asisten memakai service_role, yang MELEWATI seluruh RLS. Jadi
 * penyaringan siapa-boleh-melihat-apa WAJIB dikerjakan di sini, persis
 * seperti /api/tautan. Tanpa itu, wali kelas 1 bisa menanyakan nilai
 * kelas 6 hanya dengan menyebut namanya di kalimat pertanyaan -- dan
 * jawabannya akan keluar, lengkap dengan nama siswanya.
 *
 * Gagal TERTUTUP di setiap percabangan: kalau cakupan tidak bisa
 * ditentukan, permintaan ditolak, bukan diteruskan tanpa batas.
 */

/** Memastikan pemanggil benar-benar pengguna terdaftar yang sedang login. */
export async function pastikanBerwenang(request) {
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
    .select('email, nama, role, nama_kelas, sekolah_id, cakupan_jenjang')
    .eq('email', user.email.toLowerCase().trim())
    .maybeSingle();

  if (!profil) {
    return { galat: 'Akun ini belum terdaftar. Hubungi admin untuk didaftarkan.', status: 403 };
  }

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

    if (sendiri?.area) {
      const { data: seArea, error: galatArea } = await db
        .from('sekolah')
        .select('id, jenjang')
        .eq('area', sendiri.area);
      if (galatArea) return { galat: 'Gagal menentukan cakupan sekolah.', status: 500 };
      sekolahBoleh = (seArea || [])
        .filter((s) => dalamCakupan(s.jenjang, profil.cakupan_jenjang))
        .map((s) => s.id);
    }
  }

  return { db, profil, sekolahBoleh };
}

/**
 * Memuat seluruh data yang boleh dilihat pemanggil, sekali di awal.
 *
 * Diambil sekaligus, bukan per-pertanyaan: satu tahun ajaran satu sekolah
 * berukuran ribuan baris -- cukup kecil untuk dipegang di memori selama
 * satu permintaan, dan jauh lebih murah daripada memutar bolak-balik ke
 * Postgres setiap kali model memanggil satu alat.
 *
 * Wali kelas disaring di sini juga, bukan hanya di prompt. Prompt bisa
 * dibujuk; daftar kelas yang tidak pernah dimuat tidak bisa.
 */
export async function muatKonteks({ db, profil, sekolahBoleh, tahunAjaran }) {
  const { data: sekolahRaw } = await db
    .from('sekolah')
    .select('id, kode, nama, area, jenjang')
    .in('id', sekolahBoleh)
    .order('nama', { ascending: true });

  const sekolah = sekolahRaw || [];
  if (!sekolah.length) {
    return { galat: 'Tidak ada sekolah yang dapat diakses akun ini.' };
  }

  const { data: kelasRaw, error: galatKelas } = await db
    .from('kelas')
    .select('id, sekolah_id, tahun_ajaran, nama_kelas, wali_kelas, target_akademik')
    .in('sekolah_id', sekolahBoleh)
    .order('nama_kelas', { ascending: true });

  if (galatKelas) return { galat: 'Gagal memuat daftar kelas.' };

  let kelas = kelasRaw || [];

  /* Wali kelas: hanya kelasnya sendiri. Dicocokkan ke nama_kelas di
     users_access, sama seperti yang ditegakkan RLS untuk dasbornya. */
  if (profil.role === 'wali_kelas') {
    const milik = String(profil.nama_kelas || '').trim().toLowerCase();
    kelas = kelas.filter((k) => String(k.nama_kelas).trim().toLowerCase() === milik);
    if (!kelas.length) {
      return {
        galat:
          'Akun wali kelas ini belum terhubung ke kelas mana pun pada tahun ajaran ini.',
      };
    }
  }

  const tahunTersedia = [...new Set(kelas.map((k) => k.tahun_ajaran))].sort().reverse();
  const ta =
    tahunAjaran && tahunTersedia.includes(tahunAjaran)
      ? tahunAjaran
      : tahunTersedia.includes(tahunAjaranBerjalan())
        ? tahunAjaranBerjalan()
        : tahunTersedia[0];

  kelas = kelas.filter((k) => k.tahun_ajaran === ta);
  if (!kelas.length) return { galat: `Belum ada kelas untuk tahun ajaran ${ta}.` };

  const kelasIds = kelas.map((k) => k.id);

  const [{ data: nilai }, { data: penempatan }] = await Promise.all([
    db.from('nilai_bulanan').select('*').in('kelas_id', kelasIds),
    db
      .from('penempatan')
      .select('nis, kelas_id, siswa:nis (nis, nama_lengkap, nama_panggilan)')
      .in('kelas_id', kelasIds),
  ]);

  const identitas = new Map(
    (penempatan || [])
      .map((p) => p.siswa)
      .filter(Boolean)
      .map((s) => [s.nis, s])
  );

  /* kelasId -> bulan -> baris siswa. Bentuk yang sama persis dengan yang
     dipakai dasbor, supaya lib/statistik.js bisa dipanggil apa adanya dan
     angka asisten tidak pernah berbeda dari angka di layar dasbor. */
  const perKelas = {};
  kelas.forEach((k) => {
    const perBulan = {};
    BULAN_AJARAN.forEach((bulan) => {
      const baris = (nilai || [])
        .filter((n) => String(n.kelas_id) === String(k.id) && n.bulan === bulan)
        .map((n) => {
          const s = identitas.get(n.nis);
          return {
            ...n,
            nama_lengkap: s?.nama_lengkap || n.nis,
            nama_panggilan: s?.nama_panggilan || n.nis,
          };
        })
        .sort((a, b) => a.nama_panggilan.localeCompare(b.nama_panggilan, 'id'));
      if (baris.length) perBulan[bulan] = baris;
    });
    perKelas[k.id] = perBulan;
  });

  const bulanTerisi = BULAN_AJARAN.filter((b) =>
    Object.values(perKelas).some((p) => adaIsiBulan(p[b]))
  );

  return {
    sekolah,
    /* Jenjang menentukan mapel mana yang dinilai -- di Playgroup IPA tidak
       ada sama sekali, dan asisten tidak boleh melaporkannya sebagai nol. */
    mapel: mapelUntuk(sekolah.length === 1 ? sekolah[0].jenjang : null),
    kelas,
    perKelas,
    tahunAjaran: ta,
    tahunTersedia,
    bulanTerisi,
    jumlahSiswa: identitas.size,
  };
}
