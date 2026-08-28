import { supabaseServer } from '@/lib/supabase-server';
import { SEKOLAH_BAWAAN } from '@/lib/sekolah';

/**
 * Manifest aplikasi milik SATU siswa.
 *
 * Inilah yang membuat satu keluarga dengan tiga anak mendapat TIGA
 * aplikasi terpisah di layar utama, bukan satu aplikasi yang isinya
 * berganti-ganti.
 *
 * Kuncinya ruas `id`. Sistem operasi menentukan "ini aplikasi yang mana"
 * dari id, bukan dari nama domainnya. Karena tiap tautan siswa memakai
 * token yang berbeda, id-nya ikut berbeda, dan pemasangan dari tautan
 * Naira tidak menimpa pemasangan dari tautan Aksara.
 *
 *   /rapor/aB3xK9pQ  ->  id: /rapor/aB3xK9pQ   nama: "Naira"
 *   /rapor/7fMz2Yhw  ->  id: /rapor/7fMz2Yhw   nama: "Aksara"
 *
 * `scope` sengaja dipersempit ke tautan itu sendiri, bukan seluruh situs:
 * dengan begitu aplikasi Naira tidak pernah ikut membuka tautan milik
 * anak lain, dan tautan rapor yang diketuk dari WhatsApp selalu mendarat
 * di aplikasi yang benar.
 *
 * Konsekuensi yang perlu diketahui sekolah: kalau token seorang siswa
 * diganti dari dasbor kepala sekolah, id-nya ikut berubah -- aplikasi
 * yang sudah terpasang di HP orang tuanya menjadi tidak berlaku dan
 * mereka harus memasang ulang dari tautan yang baru.
 */

// Manifest ini bergantung pada data yang bisa berubah (nama panggilan
// diperbarui, token dicabut), jadi tidak boleh mengendap di singgahan.
export const dynamic = 'force-dynamic';

/**
 * Manifest netral untuk token yang tidak dikenal atau sudah dicabut.
 *
 * Sengaja tetap manifest yang sah, bukan 404: kalau yang tidak berlaku
 * dijawab galat sementara yang berlaku dijawab nama anak, alamat ini
 * berubah menjadi alat untuk menebak token mana yang masih hidup.
 * Jawabannya harus sama-sama wajar untuk keduanya.
 */
function manifestNetral(token) {
  return {
    id: `/rapor/${token}`,
    name: 'Rapor — Sekolah BIAS',
    short_name: 'Rapor',
    lang: 'id',
    start_url: `/rapor/${token}`,
    scope: `/rapor/${token}`,
    display: 'standalone',
    background_color: '#fcfcfb',
    theme_color: '#fcfcfb',
    icons: berkasIkon(null),
  };
}

/**
 * Ikon berhuruf awal nama anak. Ada satu berkas siap pakai untuk tiap
 * huruf A-Z, dibuat lebih dulu oleh scripts/buat-ikon.py -- bukan
 * digambar saat diminta. Menggambarnya saat diminta berarti tiap
 * pemasangan bergantung pada satu fungsi server yang berhasil jalan,
 * dan ikon yang gagal dimuat membatalkan pemasangan sama sekali.
 *
 * Nama yang huruf awalnya di luar A-Z (angka, atau abjad lain) memakai
 * ikon sekolah polos.
 */
function berkasIkon(huruf) {
  return [192, 512].map((u) => ({
    src: huruf ? `/ikon/siswa-${u}-${huruf}.png` : `/ikon/sipadi-${u}.png`,
    sizes: `${u}x${u}`,
    type: 'image/png',
    purpose: 'any maskable',
  }));
}

export async function GET(_permintaan, { params }) {
  const token = params.token;
  let isi = manifestNetral(token);

  try {
    const db = supabaseServer();

    const { data: akses } = await db
      .from('akses_ortu')
      .select('nis, aktif')
      .eq('token', token)
      .maybeSingle();

    if (akses?.aktif) {
      const { data: siswa } = await db
        .from('siswa')
        .select('nama_panggilan')
        .eq('nis', akses.nis)
        .maybeSingle();

      /* Nama sekolah dari data: keterangan aplikasi milik orang tua
         Pati tidak boleh berbunyi "SD Yaumi Fatimah Kudus". Query
         terpisah dan kegagalannya ditelan, karena kolom sekolah_id
         belum ada sebelum migrasi multi-sekolah dijalankan. */
      let namaSekolah = SEKOLAH_BAWAAN;
      try {
        const { data: sek } = await db
          .from('siswa')
          .select('sekolah:sekolah_id (nama)')
          .eq('nis', akses.nis)
          .maybeSingle();
        if (sek?.sekolah?.nama) namaSekolah = sek.sekolah.nama;
      } catch {
        // Belum dimigrasi.
      }

      const nama = siswa?.nama_panggilan?.trim();
      if (nama) {
        const awal = nama[0].toUpperCase();
        isi = {
          ...isi,
          // Nama panggilan saja, tanpa kata "Rapor" di depannya: Android
          // memotong nama yang panjang di bawah ikon, dan yang terpotong
          // justru bagian belakang -- tiga ikon bertuliskan "Rapor N…",
          // "Rapor A…", "Rapor F…" jauh lebih sulit dibedakan sekilas
          // daripada "Naira", "Aksara", "Fatih".
          name: nama,
          short_name: nama,
          description: `Rapor ${nama} — ${namaSekolah}. Personalized Education.`,
          icons: berkasIkon(/^[A-Z]$/.test(awal) ? awal : null),
        };
      }
    }
  } catch {
    // Gangguan database tidak boleh membuat halaman rapornya ikut gagal
    // dimuat -- manifest netral sudah cukup untuk memasangnya.
  }

  return new Response(JSON.stringify(isi), {
    headers: {
      'Content-Type': 'application/manifest+json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}
