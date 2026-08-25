import { supabaseServer } from '@/lib/supabase-server';

/**
 * Judul dan pratinjau tautan khusus halaman rapor satu siswa.
 *
 * Dibuat sebagai layout (komponen server) karena halaman rapornya sendiri
 * berjalan di browser, dan komponen browser tidak bisa menghasilkan
 * metadata. Layout ini tidak menggambar apa pun -- tugasnya hanya
 * menyiapkan judul.
 *
 * Nama siswa dimunculkan di pratinjau atas permintaan pengguna: orang tua
 * yang menerima tautan langsung tahu tautan itu memang untuk anaknya,
 * bukan tautan asing atau tautan milik keluarga lain. Untuk keluarga
 * dengan lebih dari satu anak di sekolah ini, itu sekaligus membedakan
 * tautan mana milik siapa tanpa perlu dibuka satu per satu.
 *
 * Konsekuensinya jujur perlu disebut: pratinjau WhatsApp ikut terbaca di
 * daftar chat, jadi nama anak dapat terlihat oleh siapa pun yang kebetulan
 * melihat layar HP orang tuanya. Yang muncul hanya nama panggilan, bukan
 * nama lengkap, dan tidak ada satu pun nilai atau capaian yang ikut --
 * pratinjaunya menyebut ini rapor siapa, bukan isinya.
 *
 * Halaman ini juga ditandai noindex: tautannya memang tidak bisa ditebak,
 * tetapi kalau ada orang tua yang tanpa sengaja membagikannya di grup
 * publik atau media sosial, penanda ini mencegahnya masuk ke hasil
 * pencarian.
 */
export async function generateMetadata({ params }) {
  const bawaan = {
    title: 'Akademik — SD Yaumi Fatimah Kudus',
    robots: { index: false, follow: false },
  };

  try {
    const db = supabaseServer();

    const { data: akses } = await db
      .from('akses_ortu')
      .select('nis, aktif')
      .eq('token', params.token)
      .maybeSingle();

    // Token tidak dikenal atau sudah dicabut: pratinjau tetap netral,
    // supaya pratinjau tidak bisa dipakai menguji token mana yang berlaku.
    if (!akses?.aktif) return bawaan;

    const { data: siswa } = await db
      .from('siswa')
      .select('nama_panggilan')
      .eq('nis', akses.nis)
      .maybeSingle();

    if (!siswa?.nama_panggilan) return bawaan;

    const judul = `Rapor ${siswa.nama_panggilan} — SD Yaumi Fatimah Kudus`;
    const keterangan =
      'Capaian akademik, Tahfidz, dan Tahsin. Personalized Education.';

    return {
      title: judul,
      description: keterangan,
      robots: { index: false, follow: false },
      openGraph: {
        title: judul,
        description: keterangan,
        siteName: 'SD Yaumi Fatimah Kudus',
        locale: 'id_ID',
        type: 'website',
        images: [
          { url: '/logo.png', width: 256, height: 256, alt: 'Logo SD Yaumi Fatimah Kudus' },
        ],
      },
    };
  } catch {
    // Gangguan database tidak boleh membuat halaman rapornya ikut gagal
    // dimuat -- judul bawaan sudah cukup.
    return bawaan;
  }
}

export default function TataLetakRapor({ children }) {
  return children;
}
