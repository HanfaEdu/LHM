-- ===================================================================
-- PENEMPATAN GANDA — siswa yang pindah kelas tertinggal di kelas lama
-- ===================================================================
-- Dijalankan PEMILIK di Supabase → SQL Editor. Tidak ada yang
-- menjalankannya otomatis, dan /api/sync tidak pernah menghapus apa pun.
--
-- MASALAHNYA
-- ----------
-- Sinkronisasi hanya menambah dan memperbarui. Siswa yang pindah kelas
-- di tahun ajaran yang sama (mis. dari 5A ke 5B) meninggalkan penempatan
-- dan baris nilai KOSONG di kelas lama, sehingga ia:
--   * dihitung "terdaftar" di dua kelas (angka "N dari M siswa dinilai"
--     di dasbor menjadi tidak sebanding), dan
--   * membuat rapor orang tuanya harus menebak kelas mana yang dipakai.
--
-- Pencegahan di hulu ada di sync.js / sync-pg.js: Cek Kesehatan Data
-- melaporkan NIS yang tercatat di dua kelas pada tahun ajaran yang sama.
-- Berkas ini membersihkan SISA yang sudah ada di basis data.
--
-- YANG DIHAPUS — dan hanya ini
-- ----------------------------
-- Untuk satu siswa pada satu tahun ajaran yang punya penempatan di lebih
-- dari satu kelas:
--   * kelas yang TIDAK punya satu pun nilai terisi untuk siswa itu,
--     sementara ia punya nilai terisi di kelas lain pada tahun ajaran
--     yang sama  →  penempatan dan baris nilainya di kelas itu dihapus.
--   * siswa yang kosong di KEDUA kelas  →  TIDAK disentuh.
--   * siswa yang terisi di kedua kelas  →  TIDAK disentuh.
--   * Siswa, kelas, tautan orang tua (akses_ortu), dan nilai kelas yang
--     terisi TIDAK pernah dihapus.
-- "Terisi" memakai definisi yang sama dengan aplikasi (bulanBerdata di
-- lib/statistik.js): salah satu dari rata_b_indo, rata_mtk, rata_ipa,
-- capaian_tahfidz, capaian_tahsin, capaian_peng_bindo, capaian_peng_mtk
-- tidak kosong. Target saja TIDAK dianggap terisi.
--
-- SEBELUM MENJALANKAN
-- -------------------
-- Pastikan spreadsheet Master Rekap sudah benar: siswa yang pindah hanya
-- ada di file kelas BARU-nya. Kalau ia masih tertulis di kedua file kelas,
-- sinkronisasi berikutnya membuat penempatan kosong itu lagi.
--
-- URUTAN
-- ------
--   1. Jalankan LANGKAH 1 (hanya membaca). Periksa daftarnya: kolom
--      "tindakan" menyebut baris mana yang AKAN DIHAPUS.
--   2. Jalankan LANGKAH 2 apa adanya. Ia berakhir dengan ROLLBACK, jadi
--      TIDAK ada yang berubah -- hanya menampilkan jumlah yang akan
--      dihapus dan sisa penempatan ganda sesudahnya.
--   3. Kalau angkanya cocok dengan LANGKAH 1, jalankan LANGKAH 2 lagi
--      dengan baris "ROLLBACK;" di ujungnya diganti "COMMIT;".
--
-- MEMBATALKAN SESUDAH COMMIT: tidak ada tombol batal. Barisnya kosong dan
-- dibuat ulang sendiri oleh sinkronisasi bila Master Rekap masih memuatnya
-- di kelas itu; selebihnya tidak ada isi yang hilang.


-- -------------------------------------------------------------------
-- LANGKAH 1 — LIHAT DULU (hanya membaca)
-- -------------------------------------------------------------------
-- Setiap siswa yang tercatat di lebih dari satu kelas pada tahun ajaran
-- yang sama, kedua kelasnya, dan jumlah bulan terisi di masing-masing.

WITH isi AS (
  SELECT p.nis, p.kelas_id, k.sekolah_id, k.tahun_ajaran, k.nama_kelas,
         COUNT(n.id) FILTER (
           WHERE n.rata_b_indo IS NOT NULL OR n.rata_mtk IS NOT NULL
              OR n.rata_ipa IS NOT NULL OR n.capaian_tahfidz IS NOT NULL
              OR n.capaian_tahsin IS NOT NULL OR n.capaian_peng_bindo IS NOT NULL
              OR n.capaian_peng_mtk IS NOT NULL
         ) AS bulan_terisi
    FROM penempatan p
    JOIN kelas k ON k.id = p.kelas_id
    LEFT JOIN nilai_bulanan n ON n.nis = p.nis AND n.kelas_id = p.kelas_id
   GROUP BY p.nis, p.kelas_id, k.sekolah_id, k.tahun_ajaran, k.nama_kelas
), ganda AS (
  SELECT nis, sekolah_id, tahun_ajaran
    FROM isi
   GROUP BY nis, sekolah_id, tahun_ajaran
  HAVING COUNT(*) > 1
)
SELECT s.nama_lengkap,
       i.nis,
       i.tahun_ajaran,
       i.nama_kelas,
       i.bulan_terisi,
       CASE
         WHEN i.bulan_terisi = 0 AND EXISTS (
                SELECT 1 FROM isi j
                 WHERE j.nis = i.nis AND j.sekolah_id = i.sekolah_id
                   AND j.tahun_ajaran = i.tahun_ajaran
                   AND j.kelas_id <> i.kelas_id AND j.bulan_terisi > 0)
           THEN 'AKAN DIHAPUS (kosong; ada nilai di kelas lain)'
         WHEN i.bulan_terisi = 0 THEN 'tidak disentuh (kosong di kedua kelas)'
         ELSE 'dipertahankan'
       END AS tindakan
  FROM isi i
  JOIN ganda g USING (nis, sekolah_id, tahun_ajaran)
  JOIN siswa s ON s.nis = i.nis
 ORDER BY i.tahun_ajaran, s.nama_lengkap, i.nama_kelas;


-- -------------------------------------------------------------------
-- LANGKAH 2 — HAPUS (bawaan: ROLLBACK, tidak mengubah apa pun)
-- -------------------------------------------------------------------
BEGIN;

CREATE TEMP TABLE calon_hapus ON COMMIT DROP AS
WITH isi AS (
  SELECT p.nis, p.kelas_id, k.sekolah_id, k.tahun_ajaran,
         COUNT(n.id) FILTER (
           WHERE n.rata_b_indo IS NOT NULL OR n.rata_mtk IS NOT NULL
              OR n.rata_ipa IS NOT NULL OR n.capaian_tahfidz IS NOT NULL
              OR n.capaian_tahsin IS NOT NULL OR n.capaian_peng_bindo IS NOT NULL
              OR n.capaian_peng_mtk IS NOT NULL
         ) AS bulan_terisi
    FROM penempatan p
    JOIN kelas k ON k.id = p.kelas_id
    LEFT JOIN nilai_bulanan n ON n.nis = p.nis AND n.kelas_id = p.kelas_id
   GROUP BY p.nis, p.kelas_id, k.sekolah_id, k.tahun_ajaran
)
SELECT i.nis, i.kelas_id
  FROM isi i
 WHERE i.bulan_terisi = 0
   AND EXISTS (
         SELECT 1 FROM isi j
          WHERE j.nis = i.nis AND j.sekolah_id = i.sekolah_id
            AND j.tahun_ajaran = i.tahun_ajaran
            AND j.kelas_id <> i.kelas_id AND j.bulan_terisi > 0);

-- Jumlah penempatan yang akan dihapus (harus sama dengan jumlah baris
-- "AKAN DIHAPUS" di LANGKAH 1).
SELECT COUNT(*) AS penempatan_akan_dihapus FROM calon_hapus;

-- Penghapusan: baris nilai kosong dulu, lalu penempatannya.
WITH hapus_nilai AS (
  DELETE FROM nilai_bulanan n
   USING calon_hapus c
   WHERE n.nis = c.nis AND n.kelas_id = c.kelas_id
  RETURNING 1
), hapus_penempatan AS (
  DELETE FROM penempatan p
   USING calon_hapus c
   WHERE p.nis = c.nis AND p.kelas_id = c.kelas_id
  RETURNING 1
)
SELECT (SELECT COUNT(*) FROM hapus_nilai)      AS baris_nilai_dihapus,
       (SELECT COUNT(*) FROM hapus_penempatan) AS penempatan_dihapus;

-- Sisa siswa yang masih tercatat di lebih dari satu kelas pada tahun
-- ajaran yang sama (yang kosong di kedua kelas, atau terisi di kedua
-- kelas -- keduanya sengaja tidak disentuh).
SELECT COUNT(*) AS siswa_masih_ganda FROM (
  SELECT p.nis, k.sekolah_id, k.tahun_ajaran
    FROM penempatan p
    JOIN kelas k ON k.id = p.kelas_id
   GROUP BY p.nis, k.sekolah_id, k.tahun_ajaran
  HAVING COUNT(*) > 1
) x;

ROLLBACK;   -- ← ganti menjadi COMMIT; setelah angkanya diperiksa
