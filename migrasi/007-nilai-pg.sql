-- ===================================================================
-- MIGRASI 007 — B. Indonesia & Matematika jenjang PG berbentuk poin
-- ===================================================================
-- Dijalankan di Supabase → SQL Editor. Aman diulang.
--
-- Di SD, B. Indonesia dan Matematika dinilai 0-100 (rata_b_indo,
-- rata_mtk) dengan satu target per kelas (kelas.target_akademik).
--
-- Di Playgroup keduanya berbentuk POIN TAHAPAN dengan target per siswa
-- per bulan -- persis seperti Tahfidz/Tahsin:
--
--   B. Indonesia  1 = tulisan namanya, 2 = huruf depan namanya, ...
--   Matematika    1 = konsep bilangan 1, 2 = konsep bilangan 1-2, ...
--
-- Menyimpannya di rata_b_indo/rata_mtk akan membuat anak yang mencapai
-- poin 3 dari target 3 terbaca "3 (target 90)" di seluruh dasbor. Karena
-- itu keduanya mendapat kolom sendiri, dengan pola nama yang sama dengan
-- Tahfidz/Tahsin (capaian_<jenis>, target_<jenis>) supaya grafik dan
-- rekap poin yang sudah ada bisa dipakai ulang apa adanya.
--
-- Diisi oleh sync-pg.js (Master Rekap PG), dibaca aplikasi lewat
-- lib/poin.js. Untuk sekolah SD seluruhnya tetap NULL -- tidak ada data
-- lama yang tersentuh.
--
-- Kebijakan RLS tidak perlu diubah: kebijakan nilai_bulanan berlaku per
-- BARIS, jadi kolom baru otomatis ikut terlindungi aturan yang sama.
-- ===================================================================

ALTER TABLE nilai_bulanan
    ADD COLUMN IF NOT EXISTS target_peng_bindo  INTEGER,
    ADD COLUMN IF NOT EXISTS capaian_peng_bindo INTEGER,
    ADD COLUMN IF NOT EXISTS target_peng_mtk    INTEGER,
    ADD COLUMN IF NOT EXISTS capaian_peng_mtk   INTEGER;

COMMENT ON COLUMN nilai_bulanan.capaian_peng_bindo IS
    'PG saja: poin tahapan B. Indonesia yang dicapai bulan ini (lib/poin.js). NULL untuk SD.';
COMMENT ON COLUMN nilai_bulanan.target_peng_bindo IS
    'PG saja: target poin B. Indonesia siswa ini untuk bulan ini. NULL untuk SD.';
COMMENT ON COLUMN nilai_bulanan.capaian_peng_mtk IS
    'PG saja: poin tahapan Matematika yang dicapai bulan ini (lib/poin.js). NULL untuk SD.';
COMMENT ON COLUMN nilai_bulanan.target_peng_mtk IS
    'PG saja: target poin Matematika siswa ini untuk bulan ini. NULL untuk SD.';

-- PostgREST menyimpan daftar kolom di tembolok. Tanpa ini, /api/sync
-- bisa menolak kolom baru ("Could not find the column ... in the schema
-- cache") sampai temboloknya kedaluwarsa sendiri.
NOTIFY pgrst, 'reload schema';
