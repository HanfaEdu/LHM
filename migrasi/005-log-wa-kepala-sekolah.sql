-- ===================================================================
-- MIGRASI 005 — KEPALA SEKOLAH BISA MEMBACA wa_pesan LEWAT DASBOR
-- ===================================================================
-- Dijalankan di Supabase → SQL Editor, SEKALI SAJA. Aman diulang.
--
-- Sebelum ini wa_pesan tidak punya satu pun policy SELECT (lihat
-- migrasi 003): hanya /api/wa yang memakai service_role yang bisa
-- membacanya. Ini menambah SATU policy supaya kepala sekolah dan biro
-- akademik bisa melihat log-nya lewat dasbor (anon key + RLS), sama
-- seperti mereka membaca `kelas`, `siswa`, dll.
--
-- KENAPA TIDAK CUKUP "sekolah_id IN (SELECT sekolah_yang_boleh())"
-- ------------------------------------------------------------------
-- sekolah.wa_pengirim belum diisi di jaringan mana pun sampai migrasi
-- ini ditulis, sehingga /api/wa TIDAK PERNAH bisa menentukan sekolah
-- pengirim webhook -- wa_pesan.sekolah_id kosong (NULL) di seluruh
-- baris yang ada sekarang. Policy yang hanya mengandalkan sekolah_id
-- akan menyembunyikan seluruh log dari semua orang, termasuk dari
-- kepala sekolah tunggal yang berhak melihatnya.
--
-- Baris NULL itu dikenali lewat DUA jalan sebagai gantinya:
--   1. Pengirimnya cocok seorang siswa (lihat baca_siswa) -- kalau
--      cocok, keterlihatannya otomatis mengikuti RLS siswa itu sendiri
--      (siswa -> penempatan -> kelas -> sekolah_yang_boleh), sehingga
--      kepala sekolah Kudus tidak pernah melihat siswa Pati lewat log
--      ini walau device belum dikonfigurasi.
--   2. Pengirimnya TIDAK cocok siswa mana pun (nomor salah sambung,
--      promosi, dsb) -- baris begini tidak bisa diatributkan ke sekolah
--      mana pun sama sekali selama device belum dikonfigurasi. Hanya
--      ditampilkan kalau jaringan ini memang cuma satu sekolah, supaya
--      kepala sekolah tunggal tetap bisa melihat "ada nomor tak
--      dikenal yang chat" -- dan otomatis berhenti ditampilkan begitu
--      sekolah kedua terdaftar, sebelum sempat membocorkan apa pun.
-- ===================================================================

-- Dipisah dari is_kepala_sekolah(): perlu menghitung SELURUH baris
-- sekolah tanpa terpotong RLS-nya sendiri (baca_sekolah membatasi
-- pandangan tiap pengguna ke sekolahnya/areanya saja), jadi harus
-- SECURITY DEFINER seperti helper RLS lain di berkas ini.
CREATE OR REPLACE FUNCTION satu_sekolah_saja()
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER AS $$
    SELECT (SELECT COUNT(*) FROM sekolah) = 1;
$$;

DROP POLICY IF EXISTS baca_wa_pesan ON wa_pesan;
CREATE POLICY baca_wa_pesan ON wa_pesan
    FOR SELECT USING (
        is_kepala_sekolah()
        AND (
            sekolah_id IN (SELECT sekolah_yang_boleh())
            OR EXISTS (
                SELECT 1 FROM siswa s
                WHERE s.wa_normal @> ARRAY[wa_pesan.pengirim]::text[]
            )
            OR (sekolah_id IS NULL AND satu_sekolah_saja())
        )
    );
