-- ===================================================
-- DATA BENIH (MOCK SEED DATA) UNTUK PENGUJIAN SISTEM
-- ===================================================

-- 1. Bersihkan data lama (opsional)
TRUNCATE TABLE rekap_akademik CASCADE;
TRUNCATE TABLE users_access CASCADE;
TRUNCATE TABLE parent_links CASCADE;

-- 2. Seed Data Staf Sekolah (users_access)
INSERT INTO users_access (email, nama, role, kelas) VALUES
('kasek@school.id', 'Ust. Ahmad Dahlan, M.Pd.', 'kepala_sekolah', NULL),
('wali2@school.id', 'Ustadzah Fatimah, S.Pd.', 'wali_kelas', '2 (Dua)');

-- 3. Seed Data Relasi Orang Tua (parent_links)
-- Menghubungkan email uji ke siswa Ammar (NIS 12401) dan Aisya (NIS 12402)
INSERT INTO parent_links (parent_email, nis) VALUES
('ortu.ammar@gmail.com', '12401'),
('ortu.aisya@gmail.com', '12402');

-- 4. Seed Data Rekap Akademik & Qur'an (rekap_akademik)
-- Data historis bulanan untuk kelas 2 (Dua) TA 2025-2026

-- Data Ananda Ammar (NIS: 12401) dari Januari - Mei
INSERT INTO rekap_akademik 
(tahun_ajaran, kelas, wali_kelas, nama_lengkap, nama_siswa, nis, no_wa, bulan, rata_b_indo, rata_mtk, rata_ipa, target_tahfidz, capaian_tahfidz, target_tahsin, capaian_tahsin)
VALUES
('2025-2026', '2 (Dua)', 'Ustadzah Fatimah, S.Pd.', 'Ammar Zoni', 'Ammar', '12401', '081234567801', 'Januari', 98, 100, 98, 26, 38, 16, 25),
('2025-2026', '2 (Dua)', 'Ustadzah Fatimah, S.Pd.', 'Ammar Zoni', 'Ammar', '12401', '081234567801', 'Februari', 93, 99, 98, 27, 39, 16, 27),
('2025-2026', '2 (Dua)', 'Ustadzah Fatimah, S.Pd.', 'Ammar Zoni', 'Ammar', '12401', '081234567801', 'Maret', 95, 98, 93, 28, 39, 16, 28),
('2025-2026', '2 (Dua)', 'Ustadzah Fatimah, S.Pd.', 'Ammar Zoni', 'Ammar', '12401', '081234567801', 'April', 92, 97, 80, 29, 39, 16, 28),
('2025-2026', '2 (Dua)', 'Ustadzah Fatimah, S.Pd.', 'Ammar Zoni', 'Ammar', '12401', '081234567801', 'Mei', 100, 100, 90, 30, 40, 16, 28);

-- Data Ananda Aisya (NIS: 12402) - Februari (Nilai Bagus, Qur'an Bagus)
INSERT INTO rekap_akademik 
(tahun_ajaran, kelas, wali_kelas, nama_lengkap, nama_siswa, nis, no_wa, bulan, rata_b_indo, rata_mtk, rata_ipa, target_tahfidz, capaian_tahfidz, target_tahsin, capaian_tahsin)
VALUES
('2025-2026', '2 (Dua)', 'Ustadzah Fatimah, S.Pd.', 'Aisya Humaira', 'Aisya', '12402', '081234567802', 'Februari', 89, 99, 100, 27, 35, 16, 22),
('2025-2026', '2 (Dua)', 'Ustadzah Fatimah, S.Pd.', 'Aisya Humaira', 'Aisya', '12402', '081234567802', 'April', 90, 95, 92, 29, 39, 16, 25);

-- Data Ananda Della (NIS: 12403) - Februari (Nilai Sangat Baik)
INSERT INTO rekap_akademik 
(tahun_ajaran, kelas, wali_kelas, nama_lengkap, nama_siswa, nis, no_wa, bulan, rata_b_indo, rata_mtk, rata_ipa, target_tahfidz, capaian_tahfidz, target_tahsin, capaian_tahsin)
VALUES
('2025-2026', '2 (Dua)', 'Ustadzah Fatimah, S.Pd.', 'Della Puspita', 'Della', '12403', '081234567803', 'Februari', 99, 99, 100, 27, 34, 16, 24),
('2025-2026', '2 (Dua)', 'Ustadzah Fatimah, S.Pd.', 'Della Puspita', 'Della', '12403', '081234567803', 'April', 95, 98, 97, 29, 37, 16, 26);

-- Data Ananda Dhirgham (NIS: 12404) - Februari & April (Butuh Pendampingan / Warning!)
INSERT INTO rekap_akademik 
(tahun_ajaran, kelas, wali_kelas, nama_lengkap, nama_siswa, nis, no_wa, bulan, rata_b_indo, rata_mtk, rata_ipa, target_tahfidz, capaian_tahfidz, target_tahsin, capaian_tahsin)
VALUES
('2025-2026', '2 (Dua)', 'Ustadzah Fatimah, S.Pd.', 'Dhirgham Putra', 'Dhirgham', '12404', '081234567804', 'Februari', 79, 89, 90, 27, 25, 16, 12),
('2025-2026', '2 (Dua)', 'Ustadzah Fatimah, S.Pd.', 'Dhirgham Putra', 'Dhirgham', '12404', '081234567804', 'April', 80, 85, 78, 29, 27, 16, 10);

-- Data Ananda Faiz (NIS: 12405) - Februari & April
INSERT INTO rekap_akademik 
(tahun_ajaran, kelas, wali_kelas, nama_lengkap, nama_siswa, nis, no_wa, bulan, rata_b_indo, rata_mtk, rata_ipa, target_tahfidz, capaian_tahfidz, target_tahsin, capaian_tahsin)
VALUES
('2025-2026', '2 (Dua)', 'Ustadzah Fatimah, S.Pd.', 'Faiz Naufal', 'Faiz', '12405', '081234567805', 'Februari', 88, 98, 96, 27, 30, 16, 18),
('2025-2026', '2 (Dua)', 'Ustadzah Fatimah, S.Pd.', 'Faiz Naufal', 'Faiz', '12405', '081234567805', 'April', 89, 92, 90, 29, 32, 16, 21);

-- Data Ananda Fauzul (NIS: 12406) - Februari & April (Capaian Terbaik MTK)
INSERT INTO rekap_akademik 
(tahun_ajaran, kelas, wali_kelas, nama_lengkap, nama_siswa, nis, no_wa, bulan, rata_b_indo, rata_mtk, rata_ipa, target_tahfidz, capaian_tahfidz, target_tahsin, capaian_tahsin)
VALUES
('2025-2026', '2 (Dua)', 'Ustadzah Fatimah, S.Pd.', 'Fauzul Mubarak', 'Fauzul', '12406', '081234567806', 'Februari', 88, 100, 100, 27, 39, 16, 24),
('2025-2026', '2 (Dua)', 'Ustadzah Fatimah, S.Pd.', 'Fauzul Mubarak', 'Fauzul', '12406', '081234567806', 'April', 90, 100, 98, 29, 41, 16, 26);
