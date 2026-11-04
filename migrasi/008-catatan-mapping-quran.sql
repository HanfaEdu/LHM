-- =====================================================================
-- MIGRASI 008 — Perjelas cakupan tabel mapping_quran
-- =====================================================================
--
-- Hanya mengubah komentar; tidak ada data maupun struktur yang disentuh.
--
-- Tabel ini tidak punya kolom jenjang, dan isinya seluruhnya peta SD.
-- Komentar lamanya berbunyi seolah berlaku untuk seluruh sekolah,
-- sementara yang benar-benar dibaca halaman rapor adalah lib/poin.js --
-- dan di sana Playgroup punya peta Tahfidz dan Tahsin sendiri. Siapa pun
-- yang membuka tabel ini lewat SQL Editor perlu tahu itu sebelum
-- menyimpulkan PG memakai daftar yang sama.
-- =====================================================================

COMMENT ON TABLE mapping_quran IS
    'Arsip rujukan peta poin -> nama surah (tahfidz) / bab materi (tahsin) '
    'untuk jenjang SD. BUKAN sumber kebenaran: yang dibaca halaman rapor '
    'adalah lib/poin.js, yang petanya berbeda per jenjang (Playgroup punya '
    'peta Tahfidz dan Tahsin sendiri, dan dua ukuran poin tambahan). Tabel '
    'ini tidak punya kolom jenjang, jadi isinya hanya berlaku untuk SD.';
