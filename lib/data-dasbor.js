import { supabase } from '@/lib/supabase';
import { BULAN_AJARAN } from '@/quran_mapping';
import { adaIsiBulan, potongTargetBulanKosong } from '@/lib/statistik';

/**
 * Pengambilan data untuk dasbor guru & kepala sekolah.
 *
 * Query dilakukan dari browser memakai anon key, jadi seluruh pembatasan
 * akses ditegakkan oleh RLS di Postgres — bukan oleh kode di halaman ini.
 * Wali kelas yang mencoba memuat kelas lain akan menerima nol baris dari
 * database, bukan sekadar tampilan yang disembunyikan.
 */

/** Profil pengguna yang sedang login (kepala sekolah / wali kelas). */
export async function muatProfil(email) {
  const { data, error } = await supabase
    .from('users_access')
    .select('email, nama, role, nama_kelas')
    .eq('email', email.toLowerCase().trim())
    .maybeSingle();

  if (error) throw error;
  return data;
}

/** Semua kelas yang boleh dilihat pengguna ini (RLS yang menyaring). */
export async function muatDaftarKelas() {
  const { data, error } = await supabase
    .from('kelas')
    .select('id, tahun_ajaran, nama_kelas, wali_kelas, target_akademik')
    .order('tahun_ajaran', { ascending: false })
    .order('nama_kelas', { ascending: true });

  if (error) throw error;
  return data || [];
}

/**
 * Nama sekolah tempat pengguna ini bertugas.
 *
 * Query TERPISAH, bukan disisipkan ke dalam muatDaftarKelas(). Kalau
 * disisipkan sebagai relasi (`sekolah:sekolah_id (nama)`), PostgREST
 * menjawab GALAT -- bukan null -- pada database yang belum menjalankan
 * migrasi multi-sekolah, dan galat itu akan menjatuhkan seluruh dasbor.
 * Dipisahkan begini, kegagalannya tertelan di sini dan kepala halaman
 * cukup memakai nama cadangannya.
 *
 * RLS yang menentukan barisnya: tiap pengguna hanya melihat sekolahnya
 * sendiri, kecuali direktur area yang melihat seluruh sekolah di
 * areanya.
 */
export async function muatSekolah() {
  try {
    const { data, error } = await supabase
      .from('sekolah')
      .select('id, kode, nama, area, jenjang')
      .order('nama', { ascending: true });

    if (error) return null;
    return data?.length ? data[0] : null;
  } catch {
    // Tabelnya belum ada (migrasi belum dijalankan). Bukan kegagalan
    // yang perlu diteruskan -- dasbor tetap berjalan tanpa ini.
    return null;
  }
}

/**
 * Nilai satu kelas untuk seluruh tahun ajaran, sudah digabung dengan
 * identitas siswa dan dikelompokkan per bulan.
 */
export async function muatNilaiKelas(kelasId) {
  const [{ data: nilai, error: e1 }, { data: penempatan, error: e2 }] = await Promise.all([
    supabase
      .from('nilai_bulanan')
      .select('*')
      .eq('kelas_id', kelasId),
    supabase
      .from('penempatan')
      .select('nis, siswa:nis (nis, nama_lengkap, nama_panggilan)')
      .eq('kelas_id', kelasId),
  ]);

  if (e1) throw e1;
  if (e2) throw e2;

  const identitas = new Map(
    (penempatan || [])
      .map((p) => p.siswa)
      .filter(Boolean)
      .map((s) => [s.nis, s])
  );

  const perBulan = {};
  BULAN_AJARAN.forEach((bulan) => {
    const baris = (nilai || [])
      .filter((n) => n.bulan === bulan)
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

  return { perBulan, jumlahSiswa: identitas.size };
}

/**
 * Bulan-bulan yang sudah benar-benar dinilai, urut menurut tahun ajaran.
 *
 * Diukur dari isi barisnya, bukan dari ada-tidaknya baris: sinkronisasi
 * membuat baris untuk kedua belas bulan sekaligus, sehingga menghitung
 * baris saja membuat seluruh tahun tampak sudah terisi.
 */
export function bulanTerisi(perBulan) {
  return BULAN_AJARAN.filter((b) => adaIsiBulan(perBulan[b]));
}

/**
 * Kumpulan siswa yang pernah muncul di perBulan satu kelas.
 *
 * Diambil dari gabungan seluruh bulan, bukan hanya satu bulan tertentu --
 * siswa yang bulan ini belum dinilai tetap harus muncul di daftar pilihan,
 * bukan hilang begitu saja.
 */
export function siswaDalamKelas(perBulan) {
  const map = new Map();
  Object.values(perBulan).forEach((baris) => {
    baris.forEach((b) => {
      if (!map.has(b.nis)) map.set(b.nis, b);
    });
  });
  return [...map.values()].sort((a, b) =>
    a.nama_panggilan.localeCompare(b.nama_panggilan, 'id')
  );
}

/**
 * Menyusun ulang perBulan satu kelas (per bulan -> banyak siswa) menjadi
 * satu siswa -> 12 bulan, format yang dipakai grafik tahunan per siswa
 * (sama seperti yang dilihat orang tua di /rapor/[token]).
 */
export function susunBulananSiswa(perBulan, nis) {
  return potongTargetBulanKosong(BULAN_AJARAN.map((bulan) => {
    const baris = (perBulan[bulan] || []).find((b) => b.nis === nis) || {};
    return {
      bulan,
      rata_b_indo: nilaiAtauNull(baris.rata_b_indo),
      rata_mtk: nilaiAtauNull(baris.rata_mtk),
      rata_ipa: nilaiAtauNull(baris.rata_ipa),
      target_tahfidz: nilaiAtauNull(baris.target_tahfidz),
      capaian_tahfidz: nilaiAtauNull(baris.capaian_tahfidz),
      target_tahsin: nilaiAtauNull(baris.target_tahsin),
      capaian_tahsin: nilaiAtauNull(baris.capaian_tahsin),
    };
  }));
}

function nilaiAtauNull(v) {
  return v === null || v === undefined || v === '' ? null : v;
}
