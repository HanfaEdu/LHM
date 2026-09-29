'use client';

/**
 * Penanda target satu siswa: garis pendek mendatar di ketinggian
 * targetnya sendiri, tepat di atas batang siswa itu.
 *
 * Dipakai pada grafik yang sumbu X-nya NAMA SISWA, khusus jenjang PG.
 * Siswa PG masuk di bulan yang berbeda-beda, sehingga targetnya berbeda
 * per anak (yang baru masuk 3 bulan wajar punya target lebih rendah dari
 * yang sudah 5 bulan). Menyambung target itu menjadi satu garis membuatnya
 * zig-zag dan terbaca seolah ada tren dari satu anak ke anak berikutnya,
 * padahal keduanya tidak berhubungan sama sekali. Penanda per batang
 * terbaca seperti tanda batas di termometer: batangnya sudah melewati
 * garis atau belum.
 *
 * Dipasang sebagai `dot` pada <Line stroke="none">, jadi nilainya tetap
 * ikut di tooltip tanpa ada garis penghubung yang tergambar.
 */
export default function PenandaTarget({ cx, cy, value }) {
  if (value === null || value === undefined || cx === undefined || cy === undefined) {
    return null;
  }
  const setengah = 9;
  return (
    <g>
      {/* Tepi berwarna kartu di belakangnya supaya penanda tetap terbaca
          saat jatuh tepat di atas batang yang berwarna pekat. */}
      <line
        x1={cx - setengah}
        x2={cx + setengah}
        y1={cy}
        y2={cy}
        stroke="var(--kartu)"
        strokeWidth={6}
        strokeLinecap="round"
      />
      <line
        x1={cx - setengah}
        x2={cx + setengah}
        y1={cy}
        y2={cy}
        stroke="var(--target)"
        strokeWidth={3}
        strokeLinecap="round"
      />
    </g>
  );
}

/** Keterangan legenda untuk penanda di atas (lewat prop `tambahan`). */
export const LEGENDA_PENANDA_TARGET = {
  kunci: 'target-siswa',
  label: 'Target masing-masing siswa',
  jenis: 'penanda',
  warna: 'var(--target)',
};
