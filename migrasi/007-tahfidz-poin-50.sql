-- =====================================================================
-- MIGRASI 007 — Poin Tahfidz ke-50: Al Baqarah
-- =====================================================================
--
-- Daftar tahfidz semula berhenti di poin 49 (Al Mulk), mengikuti urutan
-- hafalan juz 30 dari belakang. Ternyata ada siswa yang sudah melewatinya
-- dan mulai menghafal Al Baqarah sejak awal tahun ajaran -- capaian 50
-- lalu tampil di rapor sebagai "50 · Poin 50", tanpa nama surah, karena
-- tidak ada baris yang cocok.
--
-- Aman dijalankan berulang kali.
-- =====================================================================

INSERT INTO mapping_quran (jenis, poin, nama) VALUES
    ('tahfidz', 50, 'Al Baqarah')
ON CONFLICT (jenis, poin) DO UPDATE SET nama = EXCLUDED.nama;
