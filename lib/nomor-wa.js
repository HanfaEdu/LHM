/**
 * Normalisasi nomor WhatsApp.
 *
 * KENAPA HARUS DINORMALKAN, DAN KENAPA HANYA DI SATU TEMPAT
 * ---------------------------------------------------------
 * Nomor yang sama ditulis dengan lima cara berbeda di Master Rekap:
 * 0812-3456-7890, +62 812 3456 7890, 62812 34567890, dan -- yang paling
 * sering -- 81234567890, karena Google Sheets membaca "081234567890"
 * sebagai ANGKA lalu membuang nol di depannya. Sementara itu Fonnte
 * selalu mengirim nomor pengirim dalam satu bentuk: 6281234567890.
 *
 * Pencocokan "nomor pengirim WA -> siswa siapa" hanya mungkin kalau
 * kedua sisi diubah ke bentuk yang sama lebih dulu. Karena itu aturannya
 * ditulis SEKALI di berkas ini, lalu dipakai dua kali:
 *
 *   - saat sinkronisasi menulis siswa.wa_normal (app/api/sync)
 *   - saat pesan masuk dicocokkan (app/api/wa)
 *
 * Sengaja TIDAK dibuat sebagai kolom generated di Postgres: aturannya
 * akan ada dua salinan (SQL dan JavaScript) yang wajib berubah bersama,
 * dan yang satu diam-diam berbeda dari yang lain berarti orang tua yang
 * nomornya sah tidak dikenali tanpa satu pun pesan galat.
 */

/**
 * Satu runtun angka yang MUNGKIN sebuah nomor telepon.
 *
 * Spasi, titik, tanda hubung, dan kurung ikut ditelan karena semuanya
 * dipakai DI DALAM satu nomor (0812-3456-7890). Garis miring, koma, dan
 * kata "dan" TIDAK -- itulah yang dipakai memisahkan nomor ayah dari
 * nomor ibu di satu sel yang sama, sehingga keduanya terbaca sebagai dua
 * temuan, bukan satu nomor 22 digit yang lalu ditolak.
 */
const RUNTUN_ANGKA = /\+?\d[\d\s.()-]{6,}\d/g;

/**
 * Nomor Indonesia yang sah untuk WhatsApp: selalu 62 + 8 + sisanya.
 *
 * Nomor tetap (0274..., 021...) sengaja ditolak, bukan diloloskan:
 * nomor itu tidak pernah bisa menerima WhatsApp, jadi menyimpannya hanya
 * membuat sel yang salah isi terlihat seolah sudah benar.
 */
const SELULER_ID = /^628\d{7,12}$/;

/** Nomor luar negeri hanya diterima kalau ditulis eksplisit dengan '+'. */
const INTERNASIONAL = /^\d{10,15}$/;

function bakukanSatu(potongan) {
  const internasional = potongan.trim().startsWith('+');
  const angka = potongan.replace(/\D/g, '');
  if (!angka) return '';

  if (internasional) {
    return INTERNASIONAL.test(angka) ? angka : '';
  }

  let hasil = angka;
  if (hasil.startsWith('62')) {
    // sudah berkode negara
  } else if (hasil.startsWith('0')) {
    hasil = '62' + hasil.slice(1);
  } else if (hasil.startsWith('8')) {
    // Nol di depan hilang karena selnya terbaca sebagai angka oleh Sheets.
    hasil = '62' + hasil;
  } else {
    return '';
  }

  return SELULER_ID.test(hasil) ? hasil : '';
}

/**
 * Seluruh nomor sah di dalam satu teks, dalam bentuk 62xxxxxxxxxx.
 *
 * Mengembalikan larik karena satu sel "No WA" kerap memuat nomor ayah
 * DAN ibu ("0812xxx / 0813xxx"). Keduanya nomor yang sah untuk anak yang
 * sama, dan memilih salah satunya saja berarti separuh orang tua yang
 * mengirim pesan tidak dikenali.
 */
export function nomorWaDaftar(mentah) {
  const teks = String(mentah ?? '');
  const temuan = teks.match(RUNTUN_ANGKA) || [];

  const hasil = [];
  for (const potongan of temuan) {
    const nomor = bakukanSatu(potongan);
    if (nomor && !hasil.includes(nomor)) hasil.push(nomor);
  }
  return hasil;
}

/**
 * Satu nomor sah dari sebuah teks, atau '' kalau tidak ada.
 * Dipakai untuk nomor pengirim, yang menurut definisinya tunggal.
 */
export function nomorWa(mentah) {
  return nomorWaDaftar(mentah)[0] || '';
}

/**
 * Bentuk yang enak dibaca manusia: 62812... -> 0812-3456-7890.
 * Hanya untuk ditampilkan; yang disimpan dan dicocokkan tetap bentuk 62.
 */
export function nomorWaTampil(nomor) {
  const angka = String(nomor ?? '').replace(/\D/g, '');
  if (!angka.startsWith('62')) return angka;

  const lokal = '0' + angka.slice(2);
  return lokal.replace(/^(\d{4})(\d{3,4})(\d+)$/, '$1-$2-$3');
}
