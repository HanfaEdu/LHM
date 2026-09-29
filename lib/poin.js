import { TAHFIDZ_MAPPING, TAHSIN_MAPPING } from '@/quran_mapping';

/**
 * Ukuran berbentuk POIN: capaian dan target berupa nomor tahapan, bukan
 * nilai 0-100.
 *
 * Di SD hanya Tahfidz dan Tahsin yang begini. Di Playgroup, B. Indonesia
 * dan Matematika IKUT berbentuk poin -- "1 = tulisan namanya", "2 = huruf
 * depan namanya", dan seterusnya -- dengan target per siswa per bulan,
 * persis seperti Tahfidz. Karena itu keduanya disimpan dengan pola kolom
 * yang sama (`capaian_<jenis>` dan `target_<jenis>`), dan seluruh grafik,
 * rekap, dan keterangan Tahfidz/Tahsin dipakai ulang apa adanya untuk
 * keduanya -- bukan dibuatkan tampilan kedua yang lambat laun menyimpang.
 *
 * PETA-nya juga berbeda per jenjang: poin 2 Tahfidz di PG adalah
 * "Al Fatihah" (satu surah dipecah menjadi dua tahap), sedangkan di SD
 * "An Nass". Tahsin PG berupa huruf hijaiyah, Tahsin SD berupa bab
 * tajwid. Menampilkan peta SD untuk anak PG berarti menulis nama surah
 * yang salah di rapor yang dibaca orang tuanya.
 */

/* Peta PG disalin dari kolom "Keterangan" di file kelas PG (PG Kecil,
   PG Besar 1, PG Besar 2 tahun ajaran 2026-2027 -- ketiganya sama
   persis). Hanya ejaan nama surah yang diseragamkan dengan peta SD
   ("Al Kutsar" -> "Al Kautsar", "Qurays" -> "Al Quraisy"), supaya satu
   surah tidak tertulis dua cara di dua rapor. Kalau kurikulum PG
   berubah, ubah di sini DAN di file kelasnya. */
const PG_B_INDO = {
  1: 'tulisan namanya',
  2: 'huruf depan namanya',
  3: 'tulisan nama temannya',
  4: 'huruf-huruf di namanya',
  5: 'huruf-huruf di nama hari',
  6: 'tulisan benda milik anak: sepatu, sandal',
  7: 'tulisan benda milik anak: tas, tempat minum',
  8: 'tulisan benda milik anak: rukuh/sarung, sajadah',
  9: 'tulisan benda milik anak: piring, gelas',
  10: 'tulisan benda milik anak: sendok, garpu, molton',
  11: 'tulisan benda milik anak: sprei, bantal',
};

const PG_MTK = Object.fromEntries(
  Array.from({ length: 10 }, (_, i) => [
    i + 1,
    `konsep bilangan ${Array.from({ length: i + 1 }, (__, j) => j + 1).join('-')}`,
  ])
);

const PG_TAHFIDZ = {
  1: 'Al Fatihah', 2: 'Al Fatihah', 3: 'An Nas', 4: 'Al Lahab', 5: 'Al Lahab',
  6: 'Al Lahab', 7: 'An Nasr', 8: 'An Nasr', 9: 'Al Kautsar', 10: 'Al Maa’uun',
  11: 'Al Maa’uun', 12: 'Al Quraisy', 13: 'Al Quraisy', 14: 'Al Fiil',
  15: 'Al Fiil', 16: 'Al Humazah', 17: 'Al Humazah', 18: 'Al Humazah',
  19: 'Al ‘Ashr', 20: 'Al ‘Ashr', 21: 'At Takatsur', 22: 'At Takatsur',
  23: 'At Takatsur', 24: 'Al Qaari’ah',
};

const PG_TAHSIN = {
  1: 'ا', 2: 'ب', 3: 'ب', 4: 'ت', 5: 'ت', 6: 'ث', 7: 'ث', 8: 'ج', 9: 'ج',
  10: 'ح', 11: 'ح', 12: 'خ', 13: 'خ', 14: 'د', 15: 'د', 16: 'ذ', 17: 'ذ',
  18: 'ر', 19: 'ر', 20: 'ز', 21: 'ز', 22: 'س', 23: 'س', 24: 'ش',
};

const PETA = {
  PG: { peng_bindo: PG_B_INDO, peng_mtk: PG_MTK, tahfidz: PG_TAHFIDZ, tahsin: PG_TAHSIN },
  bawaan: { tahfidz: TAHFIDZ_MAPPING, tahsin: TAHSIN_MAPPING },
};

/* Warna dipatok per JENIS, sama seperti WARNA_MAPEL: B. Indonesia tetap
   biru dan Matematika tetap jingga di jenjang mana pun. */
const JENIS = {
  peng_bindo: { label: 'B. Indonesia', pendek: 'B. Indo', warna: 'var(--seri-1)', kata: 'kemampuan' },
  peng_mtk: { label: 'Matematika', pendek: 'MTK', warna: 'var(--seri-2)', kata: 'kemampuan' },
  tahfidz: { label: 'Tahfidz', pendek: 'Tahfidz', warna: 'var(--seri-1)', kata: 'hafalan' },
  tahsin: { label: 'Tahsin', pendek: 'Tahsin', warna: 'var(--seri-3)', kata: 'materi' },
};

/* Ukuran poin yang dinilai tiap jenjang, berurutan seperti tampil di
   layar. Hanya jenjang yang menyimpang yang perlu didaftarkan. */
const POIN_PER_JENJANG = {
  PG: ['peng_bindo', 'peng_mtk', 'tahfidz', 'tahsin'],
};
const POIN_BAWAAN = ['tahfidz', 'tahsin'];

function kunciJenjang(jenjang) {
  return String(jenjang || '').toUpperCase();
}

/** Keterangan satu jenis poin: label, warna, dan nama kolomnya. */
export function infoPoin(jenis) {
  return {
    jenis,
    ...JENIS[jenis],
    kCapaian: `capaian_${jenis}`,
    kTarget: `target_${jenis}`,
  };
}

/** Seluruh ukuran poin yang dinilai pada satu jenjang. */
export function poinUntuk(jenjang) {
  return (POIN_PER_JENJANG[kunciJenjang(jenjang)] || POIN_BAWAAN).map(infoPoin);
}

/** Peta poin -> nama tahapan/surah/materi untuk satu jenis & jenjang. */
export function petaPoin(jenis, jenjang) {
  const peta = PETA[kunciJenjang(jenjang)] || PETA.bawaan;
  return peta[jenis] || PETA.bawaan[jenis] || {};
}

/** Nama satu poin, atau "Poin N" kalau belum terdaftar di petanya. */
export function namaPoin(jenis, poin, jenjang) {
  if (poin === null || poin === undefined || poin === '') return '-';
  const p = Math.floor(Number(poin));
  return petaPoin(jenis, jenjang)[p] || `Poin ${p}`;
}
