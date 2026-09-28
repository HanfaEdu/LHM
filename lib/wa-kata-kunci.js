/**
 * Kata kunci pemicu layanan WhatsApp.
 *
 * KENAPA ADA KATA KUNCI, PADAHAL ISI PESAN DULU SENGAJA TIDAK DIBACA
 * ------------------------------------------------------------------
 * Dua hal yang terdengar mirip tetapi berbeda sama sekali:
 *
 *   - MENGENALI SIAPA tetap sepenuhnya dari nomor pengirim. Percobaan
 *     lama yang meminta orang tua mengetik "Nama-Kelas" ditinggalkan
 *     karena nama dan kelas seorang siswa diketahui seluruh wali murid
 *     sekelas -- siapa pun bisa meminta tautan anak orang lain.
 *   - KAPAN MENJAWAB inilah yang ditentukan kata kunci. Ia tidak
 *     menentukan siapa, dan karena itu tidak membawa kelemahan tadi.
 *
 * Yang diselesaikan: nomor WhatsApp sekolah juga dipakai percakapan
 * biasa -- tanya SPP, izin sakit, konfirmasi kegiatan. Tanpa kata kunci,
 * orang tua yang bertanya soal seragam ikut menerima tautan rapor
 * anaknya di tengah percakapan dengan manusia. Itu jauh lebih
 * mengganggu daripada sekadar memboroskan kuota.
 */

/**
 * Kata yang memicu balasan.
 *
 * 'akademik' adalah kata yang disosialisasikan ke orang tua. Sisanya
 * jaring pengaman untuk yang salah ingat, dan sengaja tidak diumumkan.
 *
 * Sebagian di antaranya -- 'rapor', 'nilai' -- memang kata yang wajar
 * muncul dalam percakapan biasa ("Bu, rapor kapan dibagikan?"), jadi
 * pesan seperti itu akan ikut dibalas tautan. Itu ditimbang dan
 * diterima: pada pesan semacam itu tautannya memang relevan, sedangkan
 * kegagalan yang sebaliknya jauh lebih merugikan -- orang tua yang
 * mengetik 'rapor' lalu didiamkan akan menyimpulkan layanannya rusak.
 *
 * Kalau sekolah lebih memilih tidak pernah menyela percakapan sama
 * sekali, cukup persempit daftar ini.
 */
const KATA_KUNCI = [
  'akademik',
  'rapor',
  'raport',
  'capaian',
  'nilai',
  'lhm',
  'sipagi',
];

/**
 * Apakah pesan ini meminta tautan rapor?
 *
 * Dicocokkan longgar dengan sengaja, karena yang mengetik adalah orang
 * tua di HP: huruf besar-kecil diabaikan, tanda baca dan emoji
 * dibuang, dan kata kunci boleh menempel di dalam kalimat --
 * "Assalamualaikum, akademik" tetap terbaca.
 *
 * Awalan, bukan kata utuh: akhiran -nya sangat lazim dalam bahasa
 * Indonesia, dan "rapornya", "nilainya", "akademiknya" adalah
 * permintaan yang sama persis. Mensyaratkan kata utuh akan
 * mendiamkannya tanpa alasan yang bisa dijelaskan kepada orang tua.
 */
export function memintaTautan(pesan) {
  const kata = String(pesan ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);

  return kata.some((k) => KATA_KUNCI.some((kunci) => k.startsWith(kunci)));
}

/** Kata kunci utama, untuk disebut di dalam pesan dan dokumentasi. */
export const KATA_KUNCI_UTAMA = 'akademik';
