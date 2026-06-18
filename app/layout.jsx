import './globals.css';

export const metadata = {
  title: 'Sistem Capaian Akademik Digital Terintegrasi',
  description: 'Visualisasi Capaian Akademik & Al-Qur\'an Siswa Terintegrasi Supabase & Google Sheets',
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body>
        {children}
      </body>
    </html>
  );
}
