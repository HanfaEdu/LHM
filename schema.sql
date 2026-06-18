-- ===================================================
-- SKEMA DATABASE: SISTEM PERKEMBANGAN AKADEMIK DIGITAL
-- ===================================================

-- 1. Tabel Rekap Akademik & Qur'an
CREATE TABLE IF NOT EXISTS rekap_akademik (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tahun_ajaran VARCHAR(20) NOT NULL, -- Contoh: "2025-2026", "2026-2027"
    kelas VARCHAR(20) NOT NULL,        -- Contoh: "2 (Dua)"
    wali_kelas VARCHAR(100) NOT NULL,
    nama_lengkap VARCHAR(150) NOT NULL, -- Nama lengkap siswa
    nama_siswa VARCHAR(50) NOT NULL,   -- Nama panggilan untuk grafik
    nis VARCHAR(50) NOT NULL,          -- Nomor Induk Siswa (Primary Key Bisnis)
    no_wa VARCHAR(20) NOT NULL,        -- No WhatsApp Orang Tua
    bulan VARCHAR(20) NOT NULL,        -- Contoh: "Juli", "Agustus", dst.
    target_akademik INTEGER DEFAULT 90,
    rata_b_indo NUMERIC(5,2),
    rata_mtk NUMERIC(5,2),
    rata_ipa NUMERIC(5,2),
    target_tahfidz INTEGER,
    capaian_tahfidz INTEGER,
    target_tahsin INTEGER,
    capaian_tahsin INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Mencegah duplikasi data untuk siswa yang sama pada tahun & bulan yang sama
    CONSTRAINT unique_student_year_month UNIQUE (nis, tahun_ajaran, bulan)
);

-- Index untuk performa pencarian data siswa
CREATE INDEX IF NOT EXISTS idx_rekap_nis ON rekap_akademik(nis);
CREATE INDEX IF NOT EXISTS idx_rekap_kelas_tahun ON rekap_akademik(kelas, tahun_ajaran);

-- 2. Tabel Hak Akses Guru & Kepala Sekolah
CREATE TABLE IF NOT EXISTS users_access (
    email VARCHAR(150) PRIMARY KEY,
    nama VARCHAR(150) NOT NULL,
    role VARCHAR(50) NOT NULL,        -- 'kepala_sekolah' atau 'wali_kelas'
    kelas VARCHAR(20),                -- Kelas yang diampu (khusus wali_kelas)
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Tabel Relasi Login Orang Tua ke Siswa
CREATE TABLE IF NOT EXISTS parent_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_email VARCHAR(150) NOT NULL,
    nis VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_email_nis UNIQUE (parent_email, nis)
);

-- Index untuk performa pencarian relasi orang tua
CREATE INDEX IF NOT EXISTS idx_parent_email ON parent_links(parent_email);

-- ===================================================
-- KEAMANAN & KEBIJAKAN (Row Level Security - RLS)
-- ===================================================

-- Aktifkan RLS pada seluruh tabel
ALTER TABLE rekap_akademik ENABLE ROW LEVEL SECURITY;
ALTER TABLE users_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE parent_links ENABLE ROW LEVEL SECURITY;

-- Kebijakan untuk users_access (guru/kasek dapat membaca profil mereka sendiri)
CREATE POLICY select_self_access ON users_access
    FOR SELECT
    USING (auth.jwt() ->> 'email' = email);

-- Kebijakan untuk parent_links (orang tua dapat membaca link mereka sendiri)
CREATE POLICY select_self_parent_links ON parent_links
    FOR SELECT
    USING (auth.jwt() ->> 'email' = parent_email);

-- Kebijakan Membaca Data Akademik (rekap_akademik)
-- 1. Kepala Sekolah dapat membaca seluruh data akademik
CREATE POLICY select_kasek_all ON rekap_akademik
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM users_access 
            WHERE users_access.email = auth.jwt() ->> 'email' 
            AND users_access.role = 'kepala_sekolah'
        )
    );

-- 2. Wali Kelas dapat membaca data akademik kelas yang dia ampu
CREATE POLICY select_guru_kelas ON rekap_akademik
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM users_access 
            WHERE users_access.email = auth.jwt() ->> 'email' 
            AND users_access.role = 'wali_kelas'
            AND users_access.kelas = rekap_akademik.kelas
        )
    );

-- 3. Orang Tua dapat membaca data akademik untuk anak yang terhubung ke email mereka
CREATE POLICY select_parent_child ON rekap_akademik
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM parent_links 
            WHERE parent_links.parent_email = auth.jwt() ->> 'email'
            AND parent_links.nis = rekap_akademik.nis
        )
    );
