-- ===================================================================
-- PINDAHKAN TABEL SALINAN KE SKEMA "arsip"  (Fase 4.3)
-- ===================================================================
-- Dijalankan PEMILIK di Supabase → SQL Editor, KAPAN SAJA pemilik
-- memutuskan. Tidak ada yang menjalankannya otomatis, dan aplikasi tidak
-- bergantung padanya.
--
-- MASALAHNYA
-- ----------
-- perawatan/bersihkan-data.sql (Langkah 0 dan 1) meninggalkan tabel
-- salinan di skema `public`, tempat API Supabase mengeksposnya:
--
--   potret_20260918_0539_<tabel>          salinan siswa, kelas, penempatan,
--                                         nilai_bulanan, users_access, akses_ortu
--   cadangan_akses_ortu_20260918_0539     salinan tautan orang tua BESERTA nama siswa
--
-- Isinya data siswa dan TOKEN rapor orang tua. Saat ini tertutup RLS,
-- tetapi tabel semacam itu tidak semestinya berada di skema yang terbuka
-- ke API: sekali ada yang lupa menyalakan RLS pada salinan berikutnya,
-- isinya terbaca siapa saja.
--
-- YANG DIKERJAKAN
-- ---------------
-- Tabel-tabel itu DIPINDAH ke skema `arsip`, yang tidak diekspos API dan
-- izinnya dicabut dari anon/authenticated. DATANYA TIDAK DIHAPUS dan
-- tidak diubah -- hanya tidak lagi terjangkau lewat API. Aplikasi tidak
-- membaca tabel-tabel ini, jadi tidak ada perilaku yang berubah.
--
-- Tabel dipilih dari POLA NAMANYA, bukan daftar nama tetap, supaya
-- skrip ini benar walau jumlah tabelnya berbeda dari perkiraan (skrip
-- bersihkan-data.sql membuat 6 potret + 1 cadangan). Tabel berawalan
-- `ekskul_` (milik aplikasi lain) dan tabel aplikasi sendiri TIDAK
-- pernah cocok dengan pola ini.
--
-- URUTAN
-- ------
--   1. Jalankan PEMERIKSAAN SEBELUM; periksa daftarnya cocok dengan
--      perkiraan Anda.
--   2. Jalankan blok PINDAHKAN.
--   3. Jalankan PEMERIKSAAN SESUDAH.
--
-- MEMBATALKAN (bila perlu):
--   ALTER TABLE arsip.<nama_tabel> SET SCHEMA public;
--   -- lalu nyalakan lagi RLS bila Anda membutuhkannya terbuka di public:
--   -- ALTER TABLE public.<nama_tabel> ENABLE ROW LEVEL SECURITY;
--
-- MEMBUANG ARSIP (hanya bila pemilik sudah yakin; tidak dikerjakan di sini):
--   DROP TABLE arsip.<nama_tabel>;


-- -------------------------------------------------------------------
-- PEMERIKSAAN SEBELUM — jalankan sendiri, hanya membaca
-- -------------------------------------------------------------------
-- Daftar tabel yang AKAN dipindah beserta jumlah barisnya (perkiraan).
--
--   SELECT c.relname AS tabel, c.reltuples::bigint AS perkiraan_baris
--   FROM   pg_class c
--   JOIN   pg_namespace n ON n.oid = c.relnamespace
--   WHERE  n.nspname = 'public'
--     AND  c.relkind = 'r'
--     AND  (c.relname LIKE 'potret\_20260918\_0539\_%'
--           OR c.relname = 'cadangan_akses_ortu_20260918_0539')
--   ORDER  BY c.relname;


-- -------------------------------------------------------------------
-- PINDAHKAN
-- -------------------------------------------------------------------
BEGIN;

CREATE SCHEMA IF NOT EXISTS arsip;

DO $$
DECLARE
    nama  TEXT;
    total INT := 0;
BEGIN
    FOR nama IN
        SELECT c.relname
        FROM   pg_class c
        JOIN   pg_namespace n ON n.oid = c.relnamespace
        WHERE  n.nspname = 'public'
          AND  c.relkind = 'r'
          AND  (c.relname LIKE 'potret\_20260918\_0539\_%'
                OR c.relname = 'cadangan_akses_ortu_20260918_0539')
        ORDER  BY c.relname
    LOOP
        EXECUTE format('ALTER TABLE public.%I SET SCHEMA arsip', nama);
        total := total + 1;
    END LOOP;

    RAISE NOTICE 'Tabel dipindah ke skema arsip: %', total;
END $$;

-- Skema arsip tertutup bagi peramban. Izin tabelnya ikut dicabut, karena
-- tabel yang dipindah membawa izin lamanya (yang diberikan otomatis oleh
-- Supabase saat tabel dibuat di public).
REVOKE ALL ON SCHEMA arsip FROM anon, authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA arsip FROM anon, authenticated;

COMMIT;


-- -------------------------------------------------------------------
-- PEMERIKSAAN SESUDAH — jalankan sendiri
-- -------------------------------------------------------------------
-- 1. Yang masih tertinggal di public (harus 0):
--
--   SELECT COUNT(*) FROM pg_tables
--   WHERE  schemaname = 'public'
--     AND  (tablename LIKE 'potret\_20260918\_0539\_%'
--           OR tablename = 'cadangan_akses_ortu_20260918_0539');
--
-- 2. Yang kini ada di arsip (sama dengan daftar PEMERIKSAAN SEBELUM):
--
--   SELECT tablename FROM pg_tables WHERE schemaname = 'arsip' ORDER BY 1;
--
-- 3. Izin peramban pada arsip (harus 0):
--
--   SELECT COUNT(*) FROM information_schema.role_table_grants
--   WHERE  table_schema = 'arsip' AND grantee IN ('anon', 'authenticated');
