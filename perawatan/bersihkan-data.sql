-- ===================================================================
-- BERSIHKAN DATA — mengosongkan isi, mempertahankan struktur
-- ===================================================================
--
-- Dipakai ketika penomoran NIS berubah menyeluruh. Sinkronisasi hanya
-- menambah dan memperbarui, tidak pernah menghapus, sehingga NIS lama
-- akan tertinggal sebagai siswa hantu berdampingan dengan yang baru.
-- Skrip ini mengosongkan isinya supaya sinkronisasi berikutnya
-- membangun ulang seluruh data dari Master Rekap yang sudah bernomor
-- baru.
--
-- Tabel, kolom, indeks, kunci asing, fungsi, dan seluruh kebijakan RLS
-- TIDAK disentuh sama sekali. Yang dikosongkan hanya barisnya.
--
--
-- YANG BISA DIBANGUN ULANG OLEH SINKRONISASI
-- ------------------------------------------
--   siswa, kelas, penempatan, nilai_bulanan, users_access
--
-- Semuanya berasal dari Master Rekap. Menghapusnya tidak menghilangkan
-- apa pun: jalankan SiPaDi → Sinkronkan Sekarang dan semuanya kembali.
--
--
-- YANG TIDAK BISA DIBANGUN ULANG  ← BACA BAGIAN INI
-- -------------------------------------------------
--   akses_ortu — TAUTAN RAPOR ORANG TUA
--
-- Token orang tua TIDAK ADA di Master Rekap. Ia dibuat acak oleh
-- aplikasi, sekali, lalu dikirim ke orang tua lewat WhatsApp. Tidak ada
-- tempat lain yang menyimpannya.
--
-- Menghapusnya berarti SETIAP tautan yang sudah beredar mati. Orang tua
-- yang membukanya akan melihat halaman "tautan tidak berlaku", dan
-- satu-satunya jalan pulih adalah menerbitkan tautan baru lalu
-- MENGIRIMKANNYA ULANG SATU PER SATU ke seluruh orang tua.
--
-- Karena itu LANGKAH 1 di bawah menyalinnya lebih dulu ke tabel
-- cadangan. Cadangan itu tidak otomatis memulihkan apa pun, tetapi ia
-- mengubah kehilangan yang permanen menjadi kehilangan yang masih bisa
-- ditelusuri: di dalamnya ada nama siswa dan kelasnya, sehingga token
-- lama masih bisa dicocokkan ke NIS baru berdasarkan nama.
--
-- JANGAN LEWATI LANGKAH 1. Biayanya satu perintah; tanpa itu, tidak ada
-- jalan kembali sama sekali.
--
--
-- YANG SENGAJA TIDAK DIHAPUS
-- --------------------------
--   mapping_quran — tabel rujukan (poin → nama surah/bab Tahsin). Diisi
--                   dari seed.sql, BUKAN dari sinkronisasi. Kalau ikut
--                   terhapus, nama surah dan bab Tahsin hilang dari
--                   seluruh rapor dan tidak akan kembali dengan
--                   sinkronisasi.
--
--   sekolah       — satu baris identitas sekolah, ditulis ulang sendiri
--                   oleh sinkronisasi. Dibiarkan supaya id-nya tidak
--                   berubah. Kalau memang ingin ikut dibersihkan, lihat
--                   catatan di LANGKAH 3.
--
--
-- SEBELUM MENJALANKAN
-- -------------------
--   1. Pastikan Master Rekap SUDAH memakai NIS yang baru dan sudah
--      benar. Setelah dibersihkan, isinya adalah apa pun yang ada di
--      spreadsheet — tidak ada versi lama untuk dibandingkan lagi.
--   2. Pastikan Cek Kesehatan Data sudah bersih, terutama dari NIS
--      kembar. Membersihkan lalu menyinkronkan data yang masih salah
--      hanya memindahkan kesalahannya, bukan memperbaikinya.
--   3. Siapkan waktu untuk langsung menyinkronkan setelah ini. Di
--      antara keduanya, dasbor kosong dan tidak ada yang bisa masuk
--      (users_access ikut dikosongkan).
--
-- Jalankan berurutan di Supabase → SQL Editor.
-- ===================================================================


-- -------------------------------------------------------------------
-- LANGKAH 0 — Potret seluruh data  (jalan pulang)
-- -------------------------------------------------------------------
-- Menyalin isi keenam tabel apa adanya sebelum apa pun dihapus,
-- sehingga keadaan hari ini bisa dikembalikan utuh kalau ternyata
-- Master Rekap masih ada yang keliru. Lihat "MEMBATALKAN" di bagian
-- paling bawah untuk cara memulihkannya.
--
-- Ini bukan pengganti Langkah 1: potret ini menyalin akses_ortu apa
-- adanya, sedangkan Langkah 1 menyalinnya BESERTA nama siswa dan kelas
-- -- satu-satunya jembatan ke NIS baru kalau penomorannya berubah.
-- Keduanya murah, ambil dua-duanya.
--
-- Tabelnya bertanggal, jadi menjalankan skrip ini berkali-kali tidak
-- pernah menimpa potret sebelumnya. Membersihkannya nanti: lihat
-- catatan di bagian paling bawah.
DO $$
DECLARE
    cap   TEXT := to_char(now(), 'YYYYMMDD_HH24MI');
    tabel TEXT;
BEGIN
    FOREACH tabel IN ARRAY ARRAY[
        'siswa', 'kelas', 'penempatan', 'nilai_bulanan', 'users_access', 'akses_ortu'
    ] LOOP
        EXECUTE format('CREATE TABLE %I AS TABLE %I',
                       'potret_' || cap || '_' || tabel, tabel);
    END LOOP;
    RAISE NOTICE 'Potret dibuat dengan awalan: potret_%_', cap;
END $$;


-- -------------------------------------------------------------------
-- LANGKAH 1 — Cadangkan tautan orang tua  (JANGAN DILEWATI)
-- -------------------------------------------------------------------
-- Nama siswa dan kelasnya ikut disalin, bukan hanya NIS-nya: sesudah
-- penomoran berubah, NIS lama tidak menunjuk siapa pun lagi, dan nama
-- adalah satu-satunya cara mencocokkan token lama ke siswa yang sama.
--
-- Memakai nama tabel bertanggal supaya menjalankan skrip ini dua kali
-- tidak menimpa cadangan yang pertama.
DO $$
DECLARE
    nama_cadangan TEXT := 'cadangan_akses_ortu_' || to_char(now(), 'YYYYMMDD_HH24MI');
BEGIN
    EXECUTE format(
        'CREATE TABLE %I AS
         SELECT a.id, a.nis, a.token, a.pin_hash, a.nama_wali, a.no_wa,
                a.aktif, a.dibuat_pada, a.terakhir_dibuka,
                s.nis_lokal, s.nama_lengkap, s.nama_panggilan,
                k.nama_kelas, k.tahun_ajaran
         FROM   akses_ortu a
         LEFT   JOIN siswa s      ON s.nis = a.nis
         LEFT   JOIN penempatan p ON p.nis = a.nis
         LEFT   JOIN kelas k      ON k.id  = p.kelas_id',
        nama_cadangan);

    RAISE NOTICE 'Cadangan dibuat: % (% baris)',
        nama_cadangan,
        (SELECT count(*) FROM akses_ortu);
END $$;


-- -------------------------------------------------------------------
-- LANGKAH 2 — Lihat dulu apa yang akan dihapus
-- -------------------------------------------------------------------
-- Jalankan ini SENDIRIAN lebih dulu dan baca hasilnya. Kalau angkanya
-- tidak masuk akal (misalnya jumlah siswa jauh dari perkiraan), berhenti
-- di sini — belum ada yang terhapus.
SELECT 'siswa'         AS tabel, count(*) AS baris FROM siswa
UNION ALL SELECT 'kelas',         count(*) FROM kelas
UNION ALL SELECT 'penempatan',    count(*) FROM penempatan
UNION ALL SELECT 'nilai_bulanan', count(*) FROM nilai_bulanan
UNION ALL SELECT 'users_access',  count(*) FROM users_access
UNION ALL SELECT 'akses_ortu ← HILANG PERMANEN', count(*) FROM akses_ortu
UNION ALL SELECT 'mapping_quran (tidak dihapus)', count(*) FROM mapping_quran
UNION ALL SELECT 'sekolah (tidak dihapus)',       count(*) FROM sekolah
ORDER BY tabel;


-- -------------------------------------------------------------------
-- LANGKAH 3 — Kosongkan
-- -------------------------------------------------------------------
-- Satu perintah untuk seluruh tabel, dan itu disengaja: TRUNCATE atas
-- beberapa tabel sekaligus berjalan sebagai satu tindakan utuh. Kalau
-- salah satunya gagal, tidak ada satu pun yang terhapus — tidak mungkin
-- berhenti di tengah dengan nilai sudah hilang tetapi siswa masih ada.
--
-- Urutannya tidak perlu dipikirkan justru karena semuanya disebut
-- bersama; kunci asing di antara mereka tidak menghalangi.
--
-- RESTART IDENTITY mengembalikan penomoran id ke 1 supaya id kelas dan
-- nilai tidak melanjutkan deret lama.
--
-- Kalau `sekolah` ingin ikut dikosongkan, tambahkan namanya ke daftar
-- di bawah. Tidak disarankan tanpa alasan: id sekolah akan berubah, dan
-- seluruh cadangan tautan yang menyebut kelas lama jadi lebih sulit
-- ditelusuri. Sinkronisasi menulis ulang baris itu sendiri.
TRUNCATE TABLE
    nilai_bulanan,
    penempatan,
    akses_ortu,
    siswa,
    kelas,
    users_access
RESTART IDENTITY;


-- -------------------------------------------------------------------
-- LANGKAH 4 — Pastikan hasilnya seperti yang diharapkan
-- -------------------------------------------------------------------
-- Enam tabel pertama harus 0. mapping_quran HARUS tetap berisi — kalau
-- ia ikut 0, seed.sql perlu dijalankan ulang sebelum sinkronisasi,
-- karena sinkronisasi tidak mengisinya.
SELECT 'siswa'         AS tabel, count(*) AS baris, 'harus 0' AS harapan FROM siswa
UNION ALL SELECT 'kelas',         count(*), 'harus 0'          FROM kelas
UNION ALL SELECT 'penempatan',    count(*), 'harus 0'          FROM penempatan
UNION ALL SELECT 'nilai_bulanan', count(*), 'harus 0'          FROM nilai_bulanan
UNION ALL SELECT 'users_access',  count(*), 'harus 0'          FROM users_access
UNION ALL SELECT 'akses_ortu',    count(*), 'harus 0'          FROM akses_ortu
UNION ALL SELECT 'mapping_quran', count(*), 'HARUS TETAP ADA'  FROM mapping_quran
UNION ALL SELECT 'sekolah',       count(*), 'HARUS TETAP ADA'  FROM sekolah
ORDER BY tabel;

-- Daftar cadangan tautan orang tua yang tersimpan.
SELECT table_name AS cadangan_tersedia
FROM   information_schema.tables
WHERE  table_schema = 'public' AND table_name LIKE 'cadangan_akses_ortu_%'
ORDER  BY table_name DESC;


-- ===================================================================
-- SESUDAH INI
-- ===================================================================
-- 1. Buka Master Rekap → menu SiPaDi → Sinkronkan Sekarang.
--    Dasbor kosong sampai langkah ini selesai, dan tidak ada yang bisa
--    masuk sebelum users_access terisi kembali.
--
-- 2. Periksa jumlah siswa per kelas di dasbor kepala sekolah, cocokkan
--    dengan spreadsheet. Inilah saat terbaik menangkap NIS yang masih
--    keliru — sebelum tautan baru diterbitkan.
--
-- 3. Terbitkan ulang tautan orang tua lewat halaman Tautan Orang Tua,
--    lalu kirimkan kepada orang tua. Tautan lama sudah tidak berlaku.
--
-- Kalau kelak ingin menelusuri siapa memegang token lama:
--   SELECT nama_lengkap, nama_kelas, nis_lokal, token, no_wa
--   FROM   cadangan_akses_ortu_<tanggal>
--   ORDER  BY nama_kelas, nama_lengkap;
-- ===================================================================


-- ===================================================================
-- MEMBATALKAN — mengembalikan keadaan sebelum pembersihan
-- ===================================================================
-- Dipakai kalau sesudah dibersihkan ternyata Master Rekap masih keliru
-- dan Bapak ingin kembali ke keadaan semula dulu. Memulihkan seluruh
-- isi keenam tabel dari potret Langkah 0, termasuk tautan orang tua.
--
-- Ganti <tanggal> dengan cap waktu potret yang dipakai. Daftarnya:
--
--   SELECT table_name FROM information_schema.tables
--   WHERE table_schema='public' AND table_name LIKE 'potret_%'
--   ORDER BY table_name;
--
-- Urutannya WAJIB seperti di bawah: induk lebih dulu, baru anaknya.
-- Membalik urutannya melanggar kunci asing dan pemulihan berhenti di
-- tengah. Seluruhnya dibungkus satu transaksi supaya kalau ada yang
-- gagal, tidak ada yang setengah terpulihkan.
--
-- BEGIN;
--
-- TRUNCATE TABLE nilai_bulanan, penempatan, akses_ortu, siswa, kelas,
--                users_access RESTART IDENTITY;
--
-- INSERT INTO kelas         SELECT * FROM potret_<tanggal>_kelas;
-- INSERT INTO siswa         SELECT * FROM potret_<tanggal>_siswa;
-- INSERT INTO users_access  SELECT * FROM potret_<tanggal>_users_access;
-- INSERT INTO penempatan    SELECT * FROM potret_<tanggal>_penempatan;
-- INSERT INTO nilai_bulanan SELECT * FROM potret_<tanggal>_nilai_bulanan;
-- INSERT INTO akses_ortu    SELECT * FROM potret_<tanggal>_akses_ortu;
--
-- -- Penomoran id dilanjutkan dari yang tertinggi. Tanpa ini, baris
-- -- BARU berikutnya akan memakai id 1 yang sudah terpakai, dan
-- -- penyimpanannya ditolak.
-- SELECT setval(pg_get_serial_sequence('kelas','id'),
--               coalesce((SELECT max(id) FROM kelas), 1));
-- SELECT setval(pg_get_serial_sequence('penempatan','id'),
--               coalesce((SELECT max(id) FROM penempatan), 1));
-- SELECT setval(pg_get_serial_sequence('nilai_bulanan','id'),
--               coalesce((SELECT max(id) FROM nilai_bulanan), 1));
-- SELECT setval(pg_get_serial_sequence('akses_ortu','id'),
--               coalesce((SELECT max(id) FROM akses_ortu), 1));
--
-- COMMIT;
--
--
-- MEMBERSIHKAN POTRET LAMA
-- ------------------------
-- Potret dan cadangan menumpuk kalau skrip ini dipakai berkali-kali.
-- Sesudah yakin datanya benar dan tidak akan dipulihkan lagi, hapus
-- yang sudah tidak perlu SATU PER SATU dan dengan sadar:
--
--   DROP TABLE potret_<tanggal>_siswa;
--
-- Sengaja tidak disediakan perintah yang menghapus semuanya sekaligus.
-- Potret adalah jaring pengaman terakhir; menghapusnya harus lebih
-- merepotkan daripada menyimpannya.
-- ===================================================================
