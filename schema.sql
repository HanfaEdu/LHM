-- ===================================================================
-- SKEMA DATABASE: SISTEM RAPOR DIGITAL (SiPaDi)
-- SD Yaumi Fatimah Kudus
-- ===================================================================
-- Dijalankan sekali di Supabase SQL Editor.
-- Aman dijalankan ulang (idempoten).
-- ===================================================================

-- ===================================================================
-- BAGIAN 1: TABEL REFERENSI (MAPPING AL-QUR'AN)
-- ===================================================================
-- Capaian Tahfidz & Tahsin disimpan sebagai ANGKA (poin/bab), bukan teks.
-- Alasannya: nama materi Tahsin BERULANG (Fathah di bab 1 & 2, Tanwin di
-- 4-6, Mad Asli di 7-9, dst). Angka -> nama selalu pasti; nama -> angka
-- ambigu. Jadi angka adalah sumber kebenaran, nama hanya untuk tampilan.

CREATE TABLE IF NOT EXISTS mapping_quran (
    jenis   VARCHAR(10)  NOT NULL CHECK (jenis IN ('tahfidz', 'tahsin')),
    poin    INTEGER      NOT NULL CHECK (poin > 0),
    nama    VARCHAR(100) NOT NULL,
    PRIMARY KEY (jenis, poin)
);

COMMENT ON TABLE mapping_quran IS
    'Peta poin -> nama surah (tahfidz) atau nama bab materi (tahsin).';

-- ===================================================================
-- BAGIAN 2: IDENTITAS SISWA
-- ===================================================================
-- NIS adalah kunci bisnis seluruh sistem. Disimpan sebagai TEXT, bukan
-- angka, supaya "302" dan 302.0 tidak menjadi dua siswa yang berbeda.

CREATE TABLE IF NOT EXISTS siswa (
    nis             VARCHAR(50)  PRIMARY KEY,
    nama_lengkap    VARCHAR(150) NOT NULL,
    nama_panggilan  VARCHAR(50)  NOT NULL,
    created_at      TIMESTAMPTZ  DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  DEFAULT NOW()
);

-- ===================================================================
-- BAGIAN 3: KELAS PER TAHUN AJARAN
-- ===================================================================
-- Satu baris = satu rombongan belajar pada satu tahun ajaran.
-- Wali kelas dan target akademik melekat di sini, tidak diulang-ulang
-- di setiap baris nilai bulanan.

CREATE TABLE IF NOT EXISTS kelas (
    id              BIGSERIAL    PRIMARY KEY,
    tahun_ajaran    VARCHAR(20)  NOT NULL,   -- "2026-2027"
    nama_kelas      VARCHAR(20)  NOT NULL,   -- "1", "2A", "2B", "3", "6"
    wali_kelas      VARCHAR(150),
    target_akademik NUMERIC(5,2) NOT NULL DEFAULT 90,
    created_at      TIMESTAMPTZ  DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  DEFAULT NOW(),

    CONSTRAINT uq_kelas_tahun UNIQUE (tahun_ajaran, nama_kelas)
);

-- ===================================================================
-- BAGIAN 4: PENEMPATAN SISWA
-- ===================================================================
-- Menjawab "siswa X ada di kelas mana pada tahun ajaran mana".
-- Inilah yang membuat riwayat lintas tahun bisa ditelusuri: siswa yang
-- sama naik dari 1 -> 2A -> 3 tanpa datanya digandakan.

CREATE TABLE IF NOT EXISTS penempatan (
    id          BIGSERIAL   PRIMARY KEY,
    nis         VARCHAR(50) NOT NULL REFERENCES siswa(nis) ON DELETE CASCADE,
    kelas_id    BIGINT      NOT NULL REFERENCES kelas(id)  ON DELETE CASCADE,
    created_at  TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT uq_penempatan UNIQUE (nis, kelas_id)
);

CREATE INDEX IF NOT EXISTS idx_penempatan_kelas ON penempatan(kelas_id);
CREATE INDEX IF NOT EXISTS idx_penempatan_nis   ON penempatan(nis);

-- ===================================================================
-- BAGIAN 5: NILAI BULANAN
-- ===================================================================
-- Hanya angka. Identitas siswa & kelas diambil lewat relasi.
--
-- Catatan penting soal NULL:
--   NULL  = belum dinilai / siswa sakit ("s" di spreadsheet)
--   0     = benar-benar bernilai nol
-- Keduanya TIDAK BOLEH tertukar. Grafik menggambar NULL sebagai putus
-- (garis terhenti), bukan sebagai terjun ke angka nol.
--
-- urutan_bulan mengikuti tahun ajaran, bukan kalender:
--   Juli=1, Agustus=2, ... Desember=6, Januari=7, ... Juni=12
-- Kolom ini yang dipakai ORDER BY, supaya grafik tidak mengurutkan
-- bulan secara alfabetis (April, Agustus, Desember, ...).

CREATE TABLE IF NOT EXISTS nilai_bulanan (
    id              BIGSERIAL    PRIMARY KEY,
    nis             VARCHAR(50)  NOT NULL REFERENCES siswa(nis) ON DELETE CASCADE,
    kelas_id        BIGINT       NOT NULL REFERENCES kelas(id)  ON DELETE CASCADE,
    bulan           VARCHAR(20)  NOT NULL,
    urutan_bulan    SMALLINT     NOT NULL CHECK (urutan_bulan BETWEEN 1 AND 12),

    rata_b_indo     NUMERIC(5,2),
    rata_mtk        NUMERIC(5,2),
    rata_ipa        NUMERIC(5,2),

    target_tahfidz  INTEGER,
    capaian_tahfidz INTEGER,
    target_tahsin   INTEGER,
    capaian_tahsin  INTEGER,

    disinkron_pada  TIMESTAMPTZ  DEFAULT NOW(),

    CONSTRAINT uq_nilai_siswa_bulan UNIQUE (nis, kelas_id, bulan)
);

CREATE INDEX IF NOT EXISTS idx_nilai_nis      ON nilai_bulanan(nis);
CREATE INDEX IF NOT EXISTS idx_nilai_kelas    ON nilai_bulanan(kelas_id, urutan_bulan);

-- ===================================================================
-- BAGIAN 6: HAK AKSES GURU & KEPALA SEKOLAH
-- ===================================================================
-- Diisi dari sheet 'users_access' di Master Rekap, login via Google OAuth.

CREATE TABLE IF NOT EXISTS users_access (
    email       VARCHAR(150) PRIMARY KEY,
    nama        VARCHAR(150) NOT NULL,
    role        VARCHAR(30)  NOT NULL CHECK (role IN ('kepala_sekolah', 'wali_kelas')),
    nama_kelas  VARCHAR(20),          -- wajib untuk wali_kelas, NULL untuk kepala sekolah
    created_at  TIMESTAMPTZ  DEFAULT NOW()
);

-- ===================================================================
-- BAGIAN 7: AKSES ORANG TUA (TOKEN + PIN)
-- ===================================================================
-- Orang tua TIDAK login Google. Alasannya praktis: kolom "No WA" di
-- spreadsheet menunjukkan WhatsApp yang jadi kanal komunikasi sekolah,
-- bukan email. Memaksa 200 orang tua punya Gmail aktif akan menjadikan
-- operator sekolah sebagai helpdesk password.
--
-- Mekanismenya: setiap siswa punya satu token acak panjang. Link dikirim
-- sekali via WA. PIN (6 digit terakhir nomor WA) menjadi lapis kedua.
-- PIN disimpan sebagai hash, tidak pernah sebagai teks polos.
--
-- Verifikasi token+PIN dilakukan di server (Route Handler Next.js)
-- memakai service_role key, sehingga tabel ini tidak pernah tersentuh
-- browser. Itu sebabnya tidak ada policy RLS "boleh baca" untuk anon.

CREATE TABLE IF NOT EXISTS akses_ortu (
    id          BIGSERIAL    PRIMARY KEY,
    nis         VARCHAR(50)  NOT NULL REFERENCES siswa(nis) ON DELETE CASCADE,
    token       VARCHAR(64)  NOT NULL,
    pin_hash    TEXT,                          -- NULL = tanpa PIN (token saja)
    nama_wali   VARCHAR(150),
    no_wa       VARCHAR(25),
    aktif       BOOLEAN      NOT NULL DEFAULT TRUE,
    dibuat_pada TIMESTAMPTZ  DEFAULT NOW(),
    terakhir_dibuka TIMESTAMPTZ,

    CONSTRAINT uq_akses_token UNIQUE (token)
);

CREATE INDEX IF NOT EXISTS idx_akses_nis ON akses_ortu(nis);

-- ===================================================================
-- BAGIAN 8: ROW LEVEL SECURITY
-- ===================================================================

ALTER TABLE siswa          ENABLE ROW LEVEL SECURITY;
ALTER TABLE kelas          ENABLE ROW LEVEL SECURITY;
ALTER TABLE penempatan     ENABLE ROW LEVEL SECURITY;
ALTER TABLE nilai_bulanan  ENABLE ROW LEVEL SECURITY;
ALTER TABLE users_access   ENABLE ROW LEVEL SECURITY;
ALTER TABLE akses_ortu     ENABLE ROW LEVEL SECURITY;
ALTER TABLE mapping_quran  ENABLE ROW LEVEL SECURITY;

-- Mapping Al-Qur'an boleh dibaca siapa saja (bukan data pribadi).
DROP POLICY IF EXISTS baca_mapping ON mapping_quran;
CREATE POLICY baca_mapping ON mapping_quran FOR SELECT USING (TRUE);

-- Guru & kepala sekolah dapat membaca profilnya sendiri.
DROP POLICY IF EXISTS baca_profil_sendiri ON users_access;
CREATE POLICY baca_profil_sendiri ON users_access
    FOR SELECT USING (auth.jwt() ->> 'email' = email);

-- Helper: apakah pengguna yang login adalah kepala sekolah?
CREATE OR REPLACE FUNCTION is_kepala_sekolah()
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER AS $$
    SELECT EXISTS (
        SELECT 1 FROM users_access
        WHERE email = auth.jwt() ->> 'email'
          AND role  = 'kepala_sekolah'
    );
$$;

-- Helper: daftar kelas_id yang boleh diakses pengguna yang login.
CREATE OR REPLACE FUNCTION kelas_yang_diampu()
RETURNS SETOF BIGINT LANGUAGE SQL STABLE SECURITY DEFINER AS $$
    SELECT k.id
    FROM kelas k
    JOIN users_access u
      ON u.email = auth.jwt() ->> 'email'
     AND u.role  = 'wali_kelas'
     AND u.nama_kelas = k.nama_kelas;
$$;

-- Kelas: kepala sekolah lihat semua, wali kelas lihat kelasnya.
DROP POLICY IF EXISTS baca_kelas ON kelas;
CREATE POLICY baca_kelas ON kelas
    FOR SELECT USING (
        is_kepala_sekolah() OR id IN (SELECT kelas_yang_diampu())
    );

-- Penempatan mengikuti hak akses kelas.
DROP POLICY IF EXISTS baca_penempatan ON penempatan;
CREATE POLICY baca_penempatan ON penempatan
    FOR SELECT USING (
        is_kepala_sekolah() OR kelas_id IN (SELECT kelas_yang_diampu())
    );

-- Nilai bulanan mengikuti hak akses kelas.
DROP POLICY IF EXISTS baca_nilai ON nilai_bulanan;
CREATE POLICY baca_nilai ON nilai_bulanan
    FOR SELECT USING (
        is_kepala_sekolah() OR kelas_id IN (SELECT kelas_yang_diampu())
    );

-- Identitas siswa mengikuti hak akses kelas tempat siswa berada.
DROP POLICY IF EXISTS baca_siswa ON siswa;
CREATE POLICY baca_siswa ON siswa
    FOR SELECT USING (
        is_kepala_sekolah()
        OR EXISTS (
            SELECT 1 FROM penempatan p
            WHERE p.nis = siswa.nis
              AND p.kelas_id IN (SELECT kelas_yang_diampu())
        )
    );

-- akses_ortu: tidak ada policy SELECT sama sekali.
-- Tabel ini HANYA boleh disentuh service_role dari sisi server.
-- Tanpa policy, RLS menolak seluruh akses anon/authenticated.

-- ===================================================================
-- BAGIAN 9: DATA REFERENSI AWAL
-- ===================================================================

INSERT INTO mapping_quran (jenis, poin, nama) VALUES
    ('tahfidz',  1, 'Al Faatihah'),   ('tahfidz',  2, 'An Nass'),
    ('tahfidz',  3, 'Al Falaq'),      ('tahfidz',  4, 'Al Ikhlas'),
    ('tahfidz',  5, 'Al Lahab'),      ('tahfidz',  6, 'An Nashr'),
    ('tahfidz',  7, 'Al Kaafiruun'),  ('tahfidz',  8, 'Al Kautsar'),
    ('tahfidz',  9, 'Al Maa''uun'),   ('tahfidz', 10, 'Al Quraisy'),
    ('tahfidz', 11, 'Al Fiil'),       ('tahfidz', 12, 'Al Humazah'),
    ('tahfidz', 13, 'Al ''Ashr'),     ('tahfidz', 14, 'At Takatsur'),
    ('tahfidz', 15, 'Al Qaari''ah'),  ('tahfidz', 16, 'Al ''Aadiyaat'),
    ('tahfidz', 17, 'Az Zalzalah'),   ('tahfidz', 18, 'Al Bayyinah'),
    ('tahfidz', 19, 'Al Qodr'),       ('tahfidz', 20, 'Al ''Alaq'),
    ('tahfidz', 21, 'At Tiin'),       ('tahfidz', 22, 'Al Insyirah'),
    ('tahfidz', 23, 'Adh Dhuha'),     ('tahfidz', 24, 'Al Lail'),
    ('tahfidz', 25, 'Asy Syam'),      ('tahfidz', 26, 'Al Balad'),
    ('tahfidz', 27, 'Al Fajr'),       ('tahfidz', 28, 'Al Ghaasyiyah'),
    ('tahfidz', 29, 'Al A''laa'),     ('tahfidz', 30, 'At Thoriq'),
    ('tahfidz', 31, 'Al Buruj'),      ('tahfidz', 32, 'Al- Insyiqoq'),
    ('tahfidz', 33, 'Al Muthaffifin'),('tahfidz', 34, 'Al Infitar'),
    ('tahfidz', 35, 'At - Takwir'),   ('tahfidz', 36, 'Abasa'),
    ('tahfidz', 37, 'An Naziat'),     ('tahfidz', 38, 'An Naba'''),
    ('tahfidz', 39, 'Al Mursalat'),   ('tahfidz', 40, 'Al Insan'),
    ('tahfidz', 41, 'Al Qiyamah'),    ('tahfidz', 42, 'Al Muddassir'),
    ('tahfidz', 43, 'Al Muzzammil'),  ('tahfidz', 44, 'Al Jinn'),
    ('tahfidz', 45, 'Nuh'),           ('tahfidz', 46, 'Al Maarij'),
    ('tahfidz', 47, 'Al Haqqah'),     ('tahfidz', 48, 'Al Qalam'),
    ('tahfidz', 49, 'Al Mulk')
ON CONFLICT (jenis, poin) DO UPDATE SET nama = EXCLUDED.nama;

INSERT INTO mapping_quran (jenis, poin, nama) VALUES
    ('tahsin',  1, 'Fathah'),     ('tahsin',  2, 'Fathah'),
    ('tahsin',  3, 'Dhummah'),    ('tahsin',  4, 'Tanwin'),
    ('tahsin',  5, 'Tanwin'),     ('tahsin',  6, 'Tanwin'),
    ('tahsin',  7, 'Mad Asli'),   ('tahsin',  8, 'Mad Asli'),
    ('tahsin',  9, 'Mad Asli'),   ('tahsin', 10, 'Gunnah'),
    ('tahsin', 11, 'Gunnah'),     ('tahsin', 12, 'Gunnah'),
    ('tahsin', 13, 'Mad Wajib'),  ('tahsin', 14, 'Mad Wajib'),
    ('tahsin', 15, 'Mad Wajib'),  ('tahsin', 16, 'Mad Wajib'),
    ('tahsin', 17, 'Qolqolah'),   ('tahsin', 18, 'Qolqolah'),
    ('tahsin', 19, 'Qolqolah'),   ('tahsin', 20, 'Qolqolah'),
    ('tahsin', 21, 'Qoidah'),     ('tahsin', 22, 'Ikhfa'''),
    ('tahsin', 23, 'Idghom'),     ('tahsin', 24, 'Idhar'),
    ('tahsin', 25, 'Juz Amma'),   ('tahsin', 26, 'Juz 29'),
    ('tahsin', 27, 'Juz 1'),      ('tahsin', 28, 'Tadarus')
ON CONFLICT (jenis, poin) DO UPDATE SET nama = EXCLUDED.nama;
