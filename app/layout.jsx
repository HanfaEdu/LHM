import './globals.css';

/**
 * app/icon.png dipakai Next.js sebagai favicon secara otomatis -- tidak
 * perlu <link rel="icon"> manual, dan Next.js yang mengurus cache-busting
 * setiap berkasnya berubah.
 */
export const metadata = {
  title: 'SiPaDi — SD Yaumi Fatimah Kudus',
  description:
    'Sistem Rapor Digital: capaian akademik, Tahfidz, dan Tahsin siswa SD Yaumi Fatimah Kudus.',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  // Zoom tidak dikunci: sebagian besar orang tua membuka rapor ini di HP,
  // dan tabel rincian dua belas bulan wajar diperbesar untuk dibaca.
  maximumScale: 5,
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
