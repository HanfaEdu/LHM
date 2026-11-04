/**
 * Halaman presentasi sistem Capaian Akademik (/press).
 *
 * Dirancang untuk diputar di IFP / smart TV: satu kanvas 16:9 yang
 * diskalakan memenuhi layar, maju per langkah lewat sentuhan, remote,
 * atau papan ketik. Tidak membaca data apa pun -- seluruh nama dan
 * angka di dalamnya contoh fiktif, sehingga aman ditayangkan di depan
 * forum mana pun.
 */
export const metadata = {
  title: 'Capaian Akademik — Presentasi',
  description:
    'Mengenal sistem Capaian Akademik Sekolah BIAS: input nilai, dashboard orang tua dan sekolah, serta layanan WhatsApp.',
  robots: { index: false },
};

export const viewport = {
  themeColor: '#0b1d1c',
};

export default function TataLetakPresentasi({ children }) {
  return children;
}
