-- ===================================================================
-- MIGRASI 006 — RIWAYAT SETIAP KALI RAPOR DIBUKA ORANG TUA
-- ===================================================================
-- Dijalankan di Supabase → SQL Editor, SEKALI SAJA. Aman diulang.
--
-- akses_ortu.terakhir_dibuka (sudah ada sejak awal) hanya menyimpan SATU
-- waktu -- yang TERBARU, ditimpa tiap kali dibuka. Itu cukup untuk
-- menjawab "kapan terakhir dibuka", tapi tidak cukup untuk "berapa kali"
-- atau "polanya seperti apa" (rajin tiap minggu vs sekali lalu berhenti).
-- Tabel ini menambah RIWAYATNYA -- satu baris per kali dibuka -- tanpa
-- mengubah atau menggantikan terakhir_dibuka sama sekali.
--
-- Disimpan sebagai nis, BUKAN token: token bisa diganti (menu "Ganti"
-- di halaman Tautan Orang Tua) saat tautan lama dianggap bocor, dan
-- riwayat pembukaan seorang anak seharusnya tetap utuh melewati
-- pergantian token itu -- yang berubah cuma kuncinya, bukan siapa
-- anaknya.
-- ===================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS akses_dibuka (
    id          BIGSERIAL   PRIMARY KEY,
    nis         VARCHAR(50) NOT NULL REFERENCES siswa(nis) ON DELETE CASCADE,
    dibuka_pada TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE akses_dibuka IS
    'Satu baris per kali /api/rapor berhasil menyajikan data (PIN benar, atau tanpa PIN). Dipakai untuk "berapa kali" dan "pola kapan" -- bukan pengganti akses_ortu.terakhir_dibuka, yang tetap dipertahankan untuk riwayat sebelum tabel ini ada.';

-- Query-nya selalu "riwayat SATU anak, terbaru dulu" -- persis pola
-- idx_wa_pesan_pengirim di migrasi 003.
CREATE INDEX IF NOT EXISTS idx_akses_dibuka_nis ON akses_dibuka (nis, dibuka_pada DESC);

-- Sama seperti wa_pesan: hanya ditulis server (service_role) lewat
-- /api/rapor. Dibaca lewat RLS supaya kepala sekolah bisa melihatnya
-- langsung dari dasbor (anon key), tanpa endpoint API baru.
ALTER TABLE akses_dibuka ENABLE ROW LEVEL SECURITY;

-- Nested RLS: EXISTS ini berjalan di bawah RLS `siswa` milik pengguna
-- yang sama (siswa -> penempatan -> kelas -> sekolah_yang_boleh, lihat
-- migrasi 001), jadi kepala sekolah Kudus otomatis tidak pernah melihat
-- riwayat siswa Pati -- sama seperti policy baca_wa_pesan di migrasi 005.
DROP POLICY IF EXISTS baca_akses_dibuka ON akses_dibuka;
CREATE POLICY baca_akses_dibuka ON akses_dibuka
    FOR SELECT USING (
        is_kepala_sekolah()
        AND EXISTS (SELECT 1 FROM siswa s WHERE s.nis = akses_dibuka.nis)
    );

COMMIT;
