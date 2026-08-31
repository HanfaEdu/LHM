-- ===================================================================
-- MIGRASI 002 — Cakupan jenjang untuk biro akademik
-- ===================================================================
--
-- MASALAH YANG DIPERBAIKI
-- -----------------------
-- Sampai migrasi 001, cakupan `direktur_area` ditentukan HANYA oleh
-- kolom `area`. Akibatnya biro yang membawahi PG dan TK ikut melihat
-- seluruh SD di wilayah yang sama, karena semuanya ber-area "Pati Raya".
--
-- Di BIAS, biro memang terikat jenjang tertentu (ada biro SD, ada biro
-- PG-TK), sementara direktur area melihat lintas jenjang. Dua-duanya
-- MELAKUKAN hal yang sama -- melihat dasbor, mengelola tautan orang tua,
-- mencetak laporan -- yang berbeda hanya sekolah mana yang ia pegang.
--
-- KENAPA KOLOM, BUKAN PERAN BARU
-- ------------------------------
-- Godaannya adalah membuat peran `direktur_sd` dan `direktur_pgtk`.
-- Itu mencampur dua hal yang berbeda: PERAN menjawab "apa yang boleh ia
-- lakukan", CAKUPAN menjawab "atas sekolah mana". Karena kedua biro
-- melakukan hal yang persis sama, yang berbeda cuma cakupannya.
--
-- Kalau dipaksakan menjadi peran, tiap kombinasi baru menuntut peran
-- baru: biro yang memegang SD dan SMP butuh `direktur_sd_smp`, direktur
-- yang melihat semuanya butuh `direktur_semua`. Masing-masing berarti
-- satu cabang aturan RLS baru dan satu pengujian baru. Satu kolom teks
-- melayani seluruh kombinasi tanpa menambah apa pun.
--
-- ATURANNYA
-- ---------
--   cakupan_jenjang KOSONG  -> seluruh jenjang dalam areanya
--                              (perilaku lama; dipakai direktur area)
--   cakupan_jenjang 'SD'    -> hanya SD dalam areanya
--   cakupan_jenjang 'PG,TK' -> hanya PG dan TK dalam areanya
--
-- Kolom ini TIDAK berpengaruh untuk kepala sekolah dan wali kelas:
-- keduanya sudah terikat satu sekolah lewat sekolah_id.
--
-- AMAN DIJALANKAN ULANG
-- ---------------------
-- Seluruh perintah memakai IF NOT EXISTS / CREATE OR REPLACE. Migrasi
-- ini tidak menyentuh satu baris data pun yang sudah ada -- kolom baru
-- lahir NULL, dan NULL berarti "seluruh jenjang", yaitu perilaku yang
-- berlaku sebelum migrasi ini. Jadi menjalankannya tidak mengubah hak
-- akses siapa pun sampai kolomnya benar-benar diisi.
-- ===================================================================


-- -------------------------------------------------------------------
-- 1. Kolom cakupan jenjang
-- -------------------------------------------------------------------
-- Daftar dipisah koma, misalnya 'PG,TK'. Disimpan sebagai teks dan
-- bukan tabel relasi tersendiri karena isinya paling banyak lima nilai,
-- ditulis satu kali per biro, dan tidak pernah dipakai untuk mencari.
-- 60 karakter cukup untuk seluruh jenjang sekaligus.
ALTER TABLE users_access
    ADD COLUMN IF NOT EXISTS cakupan_jenjang VARCHAR(60);

COMMENT ON COLUMN users_access.cakupan_jenjang IS
    'Jenjang yang boleh dilihat direktur_area, dipisah koma (PG,TK). '
    'NULL/kosong = seluruh jenjang dalam areanya. Diabaikan untuk '
    'kepala_sekolah dan wali_kelas.';


-- -------------------------------------------------------------------
-- 2. Cakupan sekolah ikut menyaring jenjang
-- -------------------------------------------------------------------
-- Fungsi inilah satu-satunya tempat yang memutuskan sekolah mana yang
-- boleh dilihat; seluruh policy RLS lain memanggilnya. Jadi perubahan
-- di sini otomatis berlaku untuk kelas, siswa, penempatan, dan nilai --
-- tidak ada policy lain yang perlu ikut disunting.
--
-- Perbandingannya di-upper() di kedua sisi supaya 'pg' yang terlanjur
-- tertulis huruf kecil di spreadsheet tetap cocok dengan 'PG'.
--
-- Sekolah yang jenjangnya kosong TIDAK cocok dengan cakupan mana pun,
-- jadi ia tidak terlihat oleh biro yang bercakupan (tetap terlihat oleh
-- direktur yang cakupannya kosong). Ini disengaja: gagal tertutup lebih
-- baik daripada sekolah tak berjenjang bocor ke semua biro. Cek
-- Kesehatan Data di Apps Script memperingatkan jenjang yang kosong
-- sebelum keadaan itu sempat terjadi.
CREATE OR REPLACE FUNCTION sekolah_yang_boleh()
RETURNS SETOF BIGINT LANGUAGE SQL STABLE SECURITY DEFINER AS $$
    SELECT s.id
    FROM   sekolah s
    JOIN   users_access u ON u.email = auth.jwt() ->> 'email'
    WHERE  -- kepala sekolah & wali kelas: sekolahnya sendiri saja
           (u.role IN ('kepala_sekolah', 'wali_kelas') AND s.id = u.sekolah_id)
           -- direktur area: sekolah se-area, disaring cakupan jenjangnya
        OR (u.role = 'direktur_area'
            AND s.area = (SELECT area FROM sekolah WHERE id = u.sekolah_id)
            AND (
                 -- cakupan kosong = seluruh jenjang (direktur area)
                 COALESCE(TRIM(u.cakupan_jenjang), '') = ''
                 -- cakupan terisi = jenjang sekolah harus termasuk.
                 -- Jenjang kosong ditolak lebih dulu supaya daftar yang
                 -- terlanjur berkoma ganda ('SD,,TK' -> berisi '') tidak
                 -- diam-diam mencocokkan sekolah tak berjenjang.
              OR (COALESCE(TRIM(s.jenjang), '') <> ''
                  AND UPPER(TRIM(s.jenjang)) = ANY (
                      STRING_TO_ARRAY(
                          UPPER(REPLACE(u.cakupan_jenjang, ' ', '')), ','
                      )
                  ))
            ));
$$;
