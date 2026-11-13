-- ===================================================================
-- MIGRASI 009 — PENGERASAN KEAMANAN (Fase 4.2)
-- ===================================================================
-- Dijalankan di Supabase → SQL Editor, SEKALI SAJA. Aman diulang.
-- Satu BEGIN … COMMIT: gagal di tengah jalan = tidak ada yang berubah.
--
-- Isinya empat hal, semuanya MENGETATKAN dan tidak mengubah perilaku
-- aplikasi yang berjalan hari ini:
--
--   a. Fungsi penjaga RLS diberi search_path tetap, supaya tidak bisa
--      dibelokkan lewat skema lain.
--   b. Fungsi warisan rancangan lama dibuang / dicabut izinnya.
--   c. Peramban hanya boleh MEMBACA. Seluruh penulisan memang sudah
--      lewat server (service_role), yang tidak terpengaruh pencabutan
--      ini. Pencabutan ini menutup jalan bila kunci publik (anon) dipakai
--      langsung ke API untuk menulis -- walau RLS sudah menolaknya.
--   d. Siswa dan kelas dalam satu baris penempatan/nilai HARUS satu
--      sekolah. Saat dikerjakan, 0 baris melanggar.
--
-- JANGAN mencabut EXECUTE fungsi penjaga (is_kepala_sekolah,
-- kelas_yang_diampu, sekolah_yang_boleh, satu_sekolah_saja) dari anon:
-- kebijakan RLS memanggilnya untuk SETIAP peran, dan mencabutnya
-- mengubah "nol baris" menjadi galat.
--
-- Prasyarat: migrasi 001–008 sudah dijalankan (fungsi dan tabel di bawah
-- berasal dari sana).
-- ===================================================================

BEGIN;

-- a. search_path tetap untuk fungsi penjaga RLS
ALTER FUNCTION is_kepala_sekolah()  SET search_path = public, pg_temp;
ALTER FUNCTION kelas_yang_diampu()  SET search_path = public, pg_temp;
ALTER FUNCTION sekolah_yang_boleh() SET search_path = public, pg_temp;
ALTER FUNCTION satu_sekolah_saja()  SET search_path = public, pg_temp;

-- b. fungsi warisan rancangan lama (merujuk tabel yang sudah tidak ada)
DROP FUNCTION IF EXISTS link_parent_by_nis_wa(text, text);

-- rls_auto_enable() dibuat oleh Supabase di basis data produksi, bukan
-- oleh berkas di repositori ini. Dijaga supaya migrasi tidak gagal di
-- basis data yang tidak memilikinya (mis. salinan percobaan).
DO $$
BEGIN
  IF to_regprocedure('public.rls_auto_enable()') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM anon, authenticated, PUBLIC;
  END IF;
END $$;

-- c. peramban hanya boleh MEMBACA; semua penulisan lewat server
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON sekolah, kelas, siswa, penempatan, nilai_bulanan, users_access,
     akses_ortu, akses_dibuka, wa_pesan, mapping_quran
  FROM anon, authenticated;

-- akses_ortu menyimpan TOKEN -- kredensial. Tidak punya policy SELECT
-- sama sekali (lihat schema.sql); izin tabelnya pun dicabut seluruhnya.
REVOKE ALL ON akses_ortu FROM anon, authenticated;

-- d. siswa dan kelas dalam satu baris HARUS satu sekolah
CREATE OR REPLACE FUNCTION tolak_lintas_sekolah()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF (SELECT sekolah_id FROM siswa WHERE nis = NEW.nis)
     IS DISTINCT FROM (SELECT sekolah_id FROM kelas WHERE id = NEW.kelas_id) THEN
    RAISE EXCEPTION 'Siswa % dan kelas % berada di sekolah yang berbeda',
      NEW.nis, NEW.kelas_id USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS jaga_sekolah_penempatan ON penempatan;
CREATE TRIGGER jaga_sekolah_penempatan
  BEFORE INSERT OR UPDATE OF nis, kelas_id ON penempatan
  FOR EACH ROW EXECUTE FUNCTION tolak_lintas_sekolah();

DROP TRIGGER IF EXISTS jaga_sekolah_nilai ON nilai_bulanan;
CREATE TRIGGER jaga_sekolah_nilai
  BEFORE INSERT OR UPDATE OF nis, kelas_id ON nilai_bulanan
  FOR EACH ROW EXECUTE FUNCTION tolak_lintas_sekolah();

COMMIT;

-- ===================================================================
-- PEMERIKSAAN SESUDAH MIGRASI
-- ===================================================================
-- Jalankan terpisah, satu per satu. SEMUA hasilnya harus 0.
-- Kalau ada yang bukan 0, JANGAN lanjut memakai kunci sinkron baru
-- sebelum penyebabnya dipahami.
--
-- 1. Baris penempatan yang siswa dan kelasnya beda sekolah (harus 0):
--
--   SELECT COUNT(*) FROM penempatan p
--     JOIN siswa s ON s.nis = p.nis
--     JOIN kelas k ON k.id  = p.kelas_id
--    WHERE s.sekolah_id IS DISTINCT FROM k.sekolah_id;
--
-- 2. Baris nilai_bulanan yang siswa dan kelasnya beda sekolah (harus 0):
--
--   SELECT COUNT(*) FROM nilai_bulanan n
--     JOIN siswa s ON s.nis = n.nis
--     JOIN kelas k ON k.id  = n.kelas_id
--    WHERE s.sekolah_id IS DISTINCT FROM k.sekolah_id;
--
-- 3. Fungsi penjaga yang search_path-nya belum tetap (harus 0):
--
--   SELECT COUNT(*) FROM pg_proc
--    WHERE pronamespace = 'public'::regnamespace
--      AND proname IN ('is_kepala_sekolah','kelas_yang_diampu',
--                      'sekolah_yang_boleh','satu_sekolah_saja',
--                      'tolak_lintas_sekolah')
--      AND (proconfig IS NULL
--           OR NOT EXISTS (SELECT 1 FROM unnest(proconfig) c
--                           WHERE c LIKE 'search_path=%'));
--
-- 4. Izin tulis peramban yang masih tersisa pada tabel aplikasi (harus 0):
--
--   SELECT COUNT(*) FROM information_schema.role_table_grants
--    WHERE table_schema = 'public'
--      AND grantee IN ('anon','authenticated')
--      AND table_name IN ('sekolah','kelas','siswa','penempatan',
--                         'nilai_bulanan','users_access','akses_ortu',
--                         'akses_dibuka','wa_pesan','mapping_quran')
--      AND privilege_type IN ('INSERT','UPDATE','DELETE','TRUNCATE',
--                             'REFERENCES','TRIGGER');
--
-- 5. Izin apa pun yang masih ada pada akses_ortu (harus 0):
--
--   SELECT COUNT(*) FROM information_schema.role_table_grants
--    WHERE table_schema = 'public' AND table_name = 'akses_ortu'
--      AND grantee IN ('anon','authenticated');
--
-- 6. Fungsi warisan yang masih ada (harus 0):
--
--   SELECT COUNT(*) FROM pg_proc
--    WHERE pronamespace = 'public'::regnamespace
--      AND proname = 'link_parent_by_nis_wa';
--
-- Sesudahnya, buka dasbor sebagai kepala sekolah dan wali kelas: datanya
-- harus tampil seperti biasa (peramban tidak pernah menulis, dan hak
-- membaca tidak diubah). Lalu jalankan SiPaGi → Sinkronkan Sekarang
-- sekali: sinkronisasi memakai service_role dan harus tetap berhasil.
