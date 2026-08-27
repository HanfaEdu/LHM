import './globals.css';
import PendaftarSW from './komponen/PendaftarSW';

/**
 * Identitas yang terlihat orang luar: judul tab peramban dan pratinjau
 * tautan di WhatsApp.
 *
 * "SiPaDi" sengaja tidak dipakai di sini. Nama itu berguna di dalam
 * sekolah, tetapi orang tua yang menerima tautan di WhatsApp tidak punya
 * konteks apa pun untuk memahaminya -- yang terbaca hanya singkatan asing
 * di atas sebuah tautan, dan tautan asing justru mengurangi kepercayaan.
 * Nama sekolah dan kata yang langsung dimengerti jauh lebih meyakinkan.
 * SiPaDi tetap tampil di halaman masuk, yang hanya dilihat guru dan
 * kepala sekolah.
 *
 * Judul ini juga sengaja TIDAK memuat nama siswa. Pratinjau WhatsApp
 * dibuat dari metadata halaman, jadi nama anak akan ikut terbaca di daftar
 * chat -- termasuk oleh siapa pun yang kebetulan melihat layar HP orang
 * tuanya. Nama anak hanya muncul setelah tautannya benar-benar dibuka.
 */

const alamatResmi = process.env.NEXT_PUBLIC_SITE_URL || 'https://akademik-sdyaumi.vercel.app';

export const metadata = {
  // metadataBase membuat /logo.png di bawah menjadi alamat lengkap;
  // WhatsApp mengabaikan gambar pratinjau yang alamatnya relatif.
  metadataBase: new URL(alamatResmi),
  title: 'Akademik — SD Yaumi Fatimah Kudus',
  description:
    'Capaian akademik, Tahfidz, dan Tahsin siswa SD Yaumi Fatimah Kudus.',
  /* Safari mengambil nama ikon layar utama dari meta ini, bukan dari
     short_name di manifest. Halaman rapor menimpanya dengan nama anak
     masing-masing (lihat app/rapor/[token]/layout.jsx). */
  appleWebApp: { capable: true, title: 'SiPaDi', statusBarStyle: 'default' },
  openGraph: {
    title: 'Akademik — SD Yaumi Fatimah Kudus',
    description:
      'Capaian akademik, Tahfidz, dan Tahsin siswa SD Yaumi Fatimah Kudus.',
    siteName: 'SD Yaumi Fatimah Kudus',
    locale: 'id_ID',
    type: 'website',
    images: [{ url: '/logo.png', width: 256, height: 256, alt: 'Logo SD Yaumi Fatimah Kudus' }],
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  /* Warna bilah status saat aplikasi terpasang dijalankan. Dua nilai,
     karena dasbor sendiri mengikuti mode terang/gelap perangkat -- satu
     nilai saja membuat bilah status bertabrakan dengan halaman di salah
     satu mode. */
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fcfcfb' },
    { media: '(prefers-color-scheme: dark)', color: '#121211' },
  ],
  // Zoom tidak dikunci: sebagian besar orang tua membuka rapor ini di HP,
  // dan tabel rincian dua belas bulan wajar diperbesar untuk dibaca.
  maximumScale: 5,
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body>
        {children}
        <PendaftarSW />
      </body>
    </html>
  );
}
