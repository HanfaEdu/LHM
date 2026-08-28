/**
 * Pemeriksaan pergantian tahun ajaran.
 *
 *     node scripts/uji-tahun-ajaran.mjs
 *
 * Tahun ajaran di sekolah ini melintasi pergantian tahun kalender: Juli
 * sampai Desember berada di tahun yang satu, Januari sampai Juni di
 * tahun berikutnya. Titik itulah tempat kesalahan paling mudah
 * menyelinap -- bulan Januari 2027 keliru dibaca sebagai bagian dari
 * tahun ajaran 2027-2028, atau lebih buruk lagi dianggap Januari 2026.
 *
 * Berkas ini memeriksa keduabelas bulan pada beberapa tahun berturut-
 * turut, berikut detik-detik peralihannya (31 Desember 23.59 ke 1
 * Januari 00.00, dan 30 Juni ke 1 Juli). Semuanya dijalankan tanpa
 * jaringan dan tanpa basis data -- murni perhitungan.
 *
 * Jalankan ulang setiap kali menyentuh tahunAjaranBerjalan() atau
 * bulanBawaan() di lib/statistik.js.
 */
import { bulanBawaan, tahunAjaranBerjalan } from '../lib/statistik.js';

let gagal = 0;

function periksa(keterangan, dapat, harap) {
  const ok = dapat === harap;
  if (!ok) gagal += 1;
  console.log(
    `${ok ? 'OK   ' : 'GAGAL'} ${keterangan.padEnd(46)} ${String(dapat).padEnd(11)}` +
      (ok ? '' : `  (seharusnya ${harap})`)
  );
}

const NAMA_BULAN = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

/* ----------------------------------------------------------------
   1. Tiap bulan pada tiga tahun berturut-turut
   ---------------------------------------------------------------- */
console.log('\n=== Tahun ajaran yang sedang berjalan, tiap bulan ===');
for (const tahun of [2026, 2027, 2028]) {
  for (let bulan = 0; bulan < 12; bulan += 1) {
    // Januari-Juni masih milik tahun ajaran yang dimulai tahun sebelumnya.
    const harap = bulan >= 6 ? `${tahun}-${tahun + 1}` : `${tahun - 1}-${tahun}`;
    periksa(
      `${NAMA_BULAN[bulan]} ${tahun}`,
      tahunAjaranBerjalan(new Date(tahun, bulan, 15, 10, 0, 0)),
      harap
    );
  }
}

/* ----------------------------------------------------------------
   2. Detik-detik peralihan
   ---------------------------------------------------------------- */
console.log('\n=== Detik-detik peralihan ===');
periksa('31 Des 2026 23.59.59', tahunAjaranBerjalan(new Date(2026, 11, 31, 23, 59, 59)), '2026-2027');
periksa('1 Jan 2027 00.00.00',  tahunAjaranBerjalan(new Date(2027, 0, 1, 0, 0, 0)),      '2026-2027');
periksa('30 Jun 2027 23.59.59', tahunAjaranBerjalan(new Date(2027, 5, 30, 23, 59, 59)),  '2026-2027');
periksa('1 Jul 2027 00.00.00',  tahunAjaranBerjalan(new Date(2027, 6, 1, 0, 0, 0)),      '2027-2028');
periksa('29 Feb 2028 (kabisat)', tahunAjaranBerjalan(new Date(2028, 1, 29, 12, 0, 0)),   '2027-2028');

/* ----------------------------------------------------------------
   3. Bulan yang terbuka lebih dulu di dasbor
   ---------------------------------------------------------------- */
console.log('\n=== Bulan bawaan dasbor ===');
const SETAHUN = [
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
];

// Data lengkap satu tahun ajaran; yang diuji semata-mata pilihannya.
periksa('2 Agu 2026, data Juli+Agustus',
  bulanBawaan(['Juli', 'Agustus'], '2026-2027', new Date(2026, 7, 2)), 'Juli');
periksa('3 Sep 2026, data s.d. September',
  bulanBawaan(['Juli', 'Agustus', 'September'], '2026-2027', new Date(2026, 8, 3)), 'Agustus');
periksa('15 Jul 2026, awal tahun ajaran',
  bulanBawaan(['Juli'], '2026-2027', new Date(2026, 6, 15)), 'Juli');

// Inilah yang dikhawatirkan: Januari 2027 harus mundur ke Desember 2026,
// bukan melompat ke tahun ajaran lain atau kembali ke Juli.
periksa('5 Jan 2027, data s.d. Januari',
  bulanBawaan(SETAHUN.slice(0, 7), '2026-2027', new Date(2027, 0, 5)), 'Desember');
periksa('5 Jan 2027, tahun ajaran 2026-2027 dikenali berjalan',
  tahunAjaranBerjalan(new Date(2027, 0, 5)), '2026-2027');

periksa('10 Jun 2027, bulan terakhir tahun ajaran',
  bulanBawaan(SETAHUN, '2026-2027', new Date(2027, 5, 10)), 'Mei');
periksa('2 Agu 2026, melihat tahun ajaran LAMPAU',
  bulanBawaan(SETAHUN, '2025-2026', new Date(2026, 7, 2)), 'Juni');
periksa('10 Des 2026, sinkron terakhir September',
  bulanBawaan(['Juli', 'Agustus', 'September'], '2026-2027', new Date(2026, 11, 10)), 'September');
periksa('belum ada data sama sekali',
  bulanBawaan([], '2026-2027', new Date(2026, 7, 2)), '');

console.log(
  gagal ? `\n${gagal} pemeriksaan GAGAL\n` : '\nSeluruh pemeriksaan lolos.\n'
);
process.exit(gagal ? 1 : 0);
