/**
 * Nama sekolah cadangan.
 *
 * Dipakai HANYA ketika nama sekolah tidak bisa dibaca dari database:
 * sebelum migrasi multi-sekolah dijalankan (tabel `sekolah` belum ada),
 * atau ketika query-nya gagal. Selama baru ada satu sekolah, nilai ini
 * memang yang benar.
 *
 * Dikumpulkan di satu berkas, bukan diulang di tiap tempat pemakaian,
 * karena nilainya punya tanggal kedaluwarsa: BEGITU SEKOLAH KEDUA
 * BERGABUNG, nama ini menjadi salah bagi semua sekolah selain Kudus --
 * dan yang paling merugikan adalah pratinjau WhatsApp serta kaki
 * lembar cetak, yang keduanya dibaca orang tua.
 *
 * Saat itu tiba, ganti satu baris ini menjadi nama netral seperti
 * 'Sekolah BIAS'. Langkah ini tercatat di docs/MULTI_SEKOLAH.md,
 * Tahap 1.
 */
export const SEKOLAH_BAWAAN = 'SD Yaumi Fatimah Kudus';
