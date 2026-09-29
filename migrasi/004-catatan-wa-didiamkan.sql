-- ===================================================================
-- MIGRASI 004 — NILAI BARU UNTUK wa_pesan.hasil
-- ===================================================================
-- Dijalankan di Supabase → SQL Editor. Aman diulang.
--
-- TIDAK mengubah struktur apa pun: kolom hasil sudah VARCHAR(30) tanpa
-- CHECK, jadi nilai barunya sebenarnya sudah bisa masuk tanpa migrasi
-- ini. Yang diperbarui hanya keterangan kolomnya.
--
-- Itu bukan kemewahan. Daftar nilai di komentar kolom adalah satu-satunya
-- tempat orang membaca arti isi tabel ini ketika menelusuri "kenapa
-- orang tua ini tidak dibalas" lewat SQL Editor, berbulan-bulan sesudah
-- kodenya ditulis. Daftar yang tertinggal dari kodenya akan membuat
-- nilai yang tidak dikenali terlihat seperti data rusak.
--
-- tidak_dikenal_diam = nomor tak dikenal yang pesannya diterima dan
-- dicatat, tetapi TIDAK dibalas karena sudah dijawab dua kali dalam 24
-- jam terakhir. Berbeda dari 'dibatasi', yang berlaku untuk nomor mana
-- pun yang melewati 8 pesan dalam satu jam.
-- ===================================================================

COMMENT ON COLUMN wa_pesan.hasil IS
    'terkirim | tidak_dikenal | tidak_dikenal_diam | belum_terbit | dibatasi | gagal_kirim';
