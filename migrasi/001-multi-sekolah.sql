-- ===================================================================
-- MIGRASI 001 — MENYIAPKAN SISTEM UNTUK LEBIH DARI SATU SEKOLAH
-- ===================================================================
-- Dijalankan di Supabase → SQL Editor, SEKALI SAJA.
-- Latar belakang dan alasannya: docs/MULTI_SEKOLAH.md
--
-- SEBELUM MENJALANKAN
--   1. Cadangkan database (Supabase → Database → Backups).
--   2. Siapkan pembaruan sync.js di Apps Script — migrasi ini dan
--      pembaruan itu harus dilakukan berurutan dalam satu waktu.
--      Kalau sinkronisasi berjalan dengan sync.js lama SESUDAH migrasi
--      ini, siswa akan masuk lagi tanpa awalan sekolah dan terduplikasi.
--
-- YANG TIDAK BERUBAH
--   Tautan orang tua, token, PIN, dan aplikasi yang sudah terpasang di
--   HP. Migrasi ini menyentuh kolom nis, tidak menyentuh token.
--
-- Seluruhnya berjalan dalam satu transaksi: kalau ada satu langkah yang
-- gagal, tidak ada satu pun perubahan yang tersimpan.
-- ===================================================================

BEGIN;

-- -------------------------------------------------------------------
-- 1. Identitas sekolah menjadi data, bukan aturan di dalam kode
-- -------------------------------------------------------------------
-- Nama sekolah di jaringan BIAS tidak mengikuti satu pola: Pati raya
-- memakai "Yaumi Fatimah", Gombong memakai "Ath-Thorik", area lain
-- memakai "BIAS" saja. Karena itu namanya harus bisa diisi, bukan
-- ditebak.
--
-- `area` adalah lapisan Tim Manajemen: satu TM membawahi beberapa
-- sekolah, dan direkturnya wajar ingin melihat semuanya sekaligus.
-- Kolomnya disiapkan sekarang walau dasbornya belum dibuat, supaya
-- penambahannya kelak tidak menuntut migrasi lagi.
CREATE TABLE IF NOT EXISTS sekolah (
    id          BIGSERIAL    PRIMARY KEY,
    -- Singkat, huruf besar, TIDAK PERNAH BERUBAH: dipakai sebagai
    -- awalan NIS. Mengubahnya berarti mengubah kunci seluruh siswa.
    --
    -- Pola: <jenjang><singkatan sekolah> -- SDYFK, TKYFK, SDBK, SMPBY.
    -- Jenjang ikut masuk ke dalam kode karena TK dan SD di satu kota
    -- adalah DUA sekolah yang berbeda, dengan siswa dan wali kelas
    -- sendiri-sendiri. Tanpa jenjang di dalamnya, kode "YFK" akan
    -- terlanjur dipakai SD, dan TK Kudus yang menyusul tidak punya kode
    -- yang wajar lagi.
    --
    -- Hanya huruf dan angka: kode ini disambung ke nomor induk dengan
    -- tanda hubung (SDYFK-281), jadi tanda hubung di dalam kodenya
    -- sendiri hanya akan mengaburkan batas keduanya.
    kode        VARCHAR(16)  NOT NULL
                CHECK (kode ~ '^[A-Z0-9]{2,16}$'),
    nama        VARCHAR(150) NOT NULL,
    -- Alamat aplikasi input nilai (LHM) milik sekolah ini. Tiap sekolah
    -- punya aplikasinya sendiri, jadi tombol "Input/Edit LHM" di dasbor
    -- wali kelas membaca kolom ini -- bukan alamat yang dipatok di
    -- dalam kode. Boleh NULL: tombolnya tidak ditampilkan sama sekali,
    -- yang lebih baik daripada mengarahkan wali kelas ke aplikasi
    -- sekolah lain. Diisi dan diperbarui oleh Apps Script (LINK_LHM).
    link_lhm    VARCHAR(300),
    area        VARCHAR(80),
    jenjang     VARCHAR(10)  NOT NULL DEFAULT 'SD'
                CHECK (jenjang IN ('PG', 'TK', 'SD', 'SMP', 'SMA')),
    aktif       BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ  DEFAULT NOW(),

    CONSTRAINT uq_sekolah_kode UNIQUE (kode)
);

COMMENT ON COLUMN sekolah.kode IS
    'Awalan NIS global, pola <jenjang><singkatan>. Tidak boleh diubah setelah ada siswa.';
COMMENT ON COLUMN sekolah.nama IS
    'Nama yang tampil di kepala dasbor. Boleh diperbaiki kapan saja.';

-- Untuk basis data yang tabel sekolahnya sudah terbentuk sebelum kolom
-- ini ada (migrasi ini dijalankan ulang setelah diperbarui).
ALTER TABLE sekolah ADD COLUMN IF NOT EXISTS link_lhm VARCHAR(300);

INSERT INTO sekolah (kode, nama, area, jenjang, link_lhm)
VALUES ('SDYFK', 'SD Yaumi Fatimah Kudus', 'Pati Raya', 'SD',
        'https://laporan-akademik.vercel.app/')
ON CONFLICT (kode) DO NOTHING;


-- -------------------------------------------------------------------
-- 2. Setiap baris membawa identitas sekolahnya
-- -------------------------------------------------------------------
ALTER TABLE kelas        ADD COLUMN IF NOT EXISTS sekolah_id BIGINT REFERENCES sekolah(id);
ALTER TABLE siswa        ADD COLUMN IF NOT EXISTS sekolah_id BIGINT REFERENCES sekolah(id);
ALTER TABLE users_access ADD COLUMN IF NOT EXISTS sekolah_id BIGINT REFERENCES sekolah(id);

-- Nomor induk yang benar-benar diketik guru di Master Rekap. Kolom
-- `nis` sesudah migrasi ini berisi kunci global berawalan kode sekolah,
-- sehingga nomor aslinya perlu tempat tersendiri untuk ditampilkan.
ALTER TABLE siswa        ADD COLUMN IF NOT EXISTS nis_lokal VARCHAR(50);

UPDATE kelas        SET sekolah_id = (SELECT id FROM sekolah WHERE kode = 'SDYFK') WHERE sekolah_id IS NULL;
UPDATE siswa        SET sekolah_id = (SELECT id FROM sekolah WHERE kode = 'SDYFK') WHERE sekolah_id IS NULL;
UPDATE users_access SET sekolah_id = (SELECT id FROM sekolah WHERE kode = 'SDYFK') WHERE sekolah_id IS NULL;

ALTER TABLE kelas        ALTER COLUMN sekolah_id SET NOT NULL;
ALTER TABLE siswa        ALTER COLUMN sekolah_id SET NOT NULL;


-- -------------------------------------------------------------------
-- 3. Nama kelas tidak lagi unik se-dunia, melainkan per sekolah
-- -------------------------------------------------------------------
-- Tanpa ini, kelas "2A" Kudus dan "2A" Pati dianggap kelas yang sama
-- dan sinkronisasi keduanya saling menimpa.
ALTER TABLE kelas DROP CONSTRAINT IF EXISTS uq_kelas_tahun;
ALTER TABLE kelas ADD  CONSTRAINT uq_kelas_tahun
    UNIQUE (sekolah_id, tahun_ajaran, nama_kelas);


-- -------------------------------------------------------------------
-- 4. NIS diberi ruang nama per sekolah
-- -------------------------------------------------------------------
-- Inilah langkah yang paling penting. NIS di Master Rekap berisi angka
-- lokal tiga digit (281, 301, 316, ...), bukan NISN nasional; Pati dan
-- Juwana hampir pasti memakai deret yang sama. Tanpa ruang nama, siswa
-- 301 Kudus dan siswa 301 Pati menjadi satu baris yang sama --
-- namanya saling menimpa dan nilainya tertukar, tanpa satu pun pesan
-- galat.
--
-- ON UPDATE CASCADE dipasang lebih dulu supaya perubahan pada
-- siswa.nis mengalir sendiri ke ketiga tabel anaknya. Tanpa itu,
-- perubahan di bawah akan ditolak karena melanggar kunci asing.
ALTER TABLE penempatan    DROP CONSTRAINT IF EXISTS penempatan_nis_fkey;
ALTER TABLE penempatan    ADD  CONSTRAINT penempatan_nis_fkey
    FOREIGN KEY (nis) REFERENCES siswa(nis) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE nilai_bulanan DROP CONSTRAINT IF EXISTS nilai_bulanan_nis_fkey;
ALTER TABLE nilai_bulanan ADD  CONSTRAINT nilai_bulanan_nis_fkey
    FOREIGN KEY (nis) REFERENCES siswa(nis) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE akses_ortu    DROP CONSTRAINT IF EXISTS akses_ortu_nis_fkey;
ALTER TABLE akses_ortu    ADD  CONSTRAINT akses_ortu_nis_fkey
    FOREIGN KEY (nis) REFERENCES siswa(nis) ON DELETE CASCADE ON UPDATE CASCADE;

-- Nomor asli disimpan lebih dulu, baru kuncinya diberi awalan.
UPDATE siswa SET nis_lokal = nis WHERE nis_lokal IS NULL;

UPDATE siswa s
SET    nis = k.kode || '-' || s.nis
FROM   sekolah k
WHERE  k.id = s.sekolah_id
  AND  s.nis NOT LIKE k.kode || '-%';   -- aman dijalankan dua kali

ALTER TABLE siswa ALTER COLUMN nis_lokal SET NOT NULL;

-- Nomor lokal tetap unik DI DALAM satu sekolah: dua siswa satu sekolah
-- tidak boleh bernomor sama.
ALTER TABLE siswa DROP CONSTRAINT IF EXISTS uq_siswa_nis_lokal;
ALTER TABLE siswa ADD  CONSTRAINT uq_siswa_nis_lokal
    UNIQUE (sekolah_id, nis_lokal);


-- -------------------------------------------------------------------
-- 5. Hak akses dipersempit ke sekolah masing-masing
-- -------------------------------------------------------------------
-- Sebelum ini, is_kepala_sekolah() mengembalikan benar untuk kepala
-- sekolah MANA PUN -- kepala sekolah Pati akan melihat seluruh data
-- Kudus. Dan kelas_yang_diampu() mencocokkan nama_kelas saja, sehingga
-- wali kelas 2A Kudus ikut melihat 2A Pati.

-- Peran direktur area disiapkan sekarang supaya penambahannya kelak
-- tidak menuntut migrasi lagi. Dasbornya belum dibuat.
ALTER TABLE users_access DROP CONSTRAINT IF EXISTS users_access_role_check;
ALTER TABLE users_access ADD  CONSTRAINT users_access_role_check
    CHECK (role IN ('kepala_sekolah', 'wali_kelas', 'direktur_area'));

-- Sekolah mana saja yang boleh dilihat pengguna yang sedang login.
CREATE OR REPLACE FUNCTION sekolah_yang_boleh()
RETURNS SETOF BIGINT LANGUAGE SQL STABLE SECURITY DEFINER AS $$
    SELECT s.id
    FROM   sekolah s
    JOIN   users_access u ON u.email = auth.jwt() ->> 'email'
    WHERE  -- kepala sekolah & wali kelas: sekolahnya sendiri saja
           (u.role IN ('kepala_sekolah', 'wali_kelas') AND s.id = u.sekolah_id)
           -- direktur area: seluruh sekolah dalam areanya
        OR (u.role = 'direktur_area'
            AND s.area = (SELECT area FROM sekolah WHERE id = u.sekolah_id));
$$;

DROP POLICY IF EXISTS baca_sekolah ON sekolah;
ALTER TABLE sekolah ENABLE ROW LEVEL SECURITY;
CREATE POLICY baca_sekolah ON sekolah
    FOR SELECT USING (id IN (SELECT sekolah_yang_boleh()));

-- Kepala sekolah: hanya di sekolahnya sendiri.
CREATE OR REPLACE FUNCTION is_kepala_sekolah()
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER AS $$
    SELECT EXISTS (
        SELECT 1 FROM users_access
        WHERE email = auth.jwt() ->> 'email'
          AND role IN ('kepala_sekolah', 'direktur_area')
    );
$$;

-- Kelas yang boleh diakses: nama kelas HARUS berada di sekolah yang
-- sama dengan penggunanya.
CREATE OR REPLACE FUNCTION kelas_yang_diampu()
RETURNS SETOF BIGINT LANGUAGE SQL STABLE SECURITY DEFINER AS $$
    SELECT k.id
    FROM   kelas k
    JOIN   users_access u
      ON   u.email = auth.jwt() ->> 'email'
     AND   u.role  = 'wali_kelas'
     AND   u.nama_kelas = k.nama_kelas
     AND   u.sekolah_id = k.sekolah_id;
$$;

-- Kelas: kepala sekolah/direktur melihat kelas di sekolah yang boleh
-- dilihatnya saja -- bukan seluruh jaringan seperti sebelumnya.
DROP POLICY IF EXISTS baca_kelas ON kelas;
CREATE POLICY baca_kelas ON kelas
    FOR SELECT USING (
        (is_kepala_sekolah() AND sekolah_id IN (SELECT sekolah_yang_boleh()))
        OR id IN (SELECT kelas_yang_diampu())
    );

-- Ketiga kebijakan berikut mengikuti hak akses kelas, jadi cukup
-- mewarisi perbaikan di atas -- tetapi ditulis ulang agar tidak ada
-- yang tertinggal memakai definisi lama.
DROP POLICY IF EXISTS baca_penempatan ON penempatan;
CREATE POLICY baca_penempatan ON penempatan
    FOR SELECT USING (kelas_id IN (SELECT id FROM kelas));

DROP POLICY IF EXISTS baca_nilai ON nilai_bulanan;
CREATE POLICY baca_nilai ON nilai_bulanan
    FOR SELECT USING (kelas_id IN (SELECT id FROM kelas));

DROP POLICY IF EXISTS baca_siswa ON siswa;
CREATE POLICY baca_siswa ON siswa
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM penempatan p WHERE p.nis = siswa.nis)
    );

CREATE INDEX IF NOT EXISTS idx_kelas_sekolah ON kelas(sekolah_id);
CREATE INDEX IF NOT EXISTS idx_siswa_sekolah ON siswa(sekolah_id);

COMMIT;

-- ===================================================================
-- PEMERIKSAAN SESUDAH MIGRASI
-- ===================================================================
-- Jalankan terpisah. Semua angka harus masuk akal dan tidak ada NULL.
--
--   SELECT * FROM sekolah;
--   SELECT COUNT(*) AS siswa, COUNT(sekolah_id) AS bersekolah FROM siswa;
--   SELECT nis, nis_lokal, nama_panggilan FROM siswa ORDER BY nis LIMIT 5;
--   SELECT COUNT(*) FROM akses_ortu a JOIN siswa s ON s.nis = a.nis;
--
-- Baris terakhir harus sama dengan jumlah token yang pernah diterbitkan.
-- Kalau lebih kecil, ada token yang kehilangan siswanya -- JANGAN
-- lanjutkan, pulihkan dari cadangan.
