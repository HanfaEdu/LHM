-- ===================================================================
-- MIGRASI 003 — LAYANAN WHATSAPP UNTUK ORANG TUA
-- ===================================================================
-- Dijalankan di Supabase → SQL Editor, SEKALI SAJA.
-- Cara pasang lengkapnya: docs/LAYANAN_WA.md
--
-- APA YANG DITAMBAHKAN
--   Orang tua cukup mengirim pesan apa pun ke nomor WhatsApp sekolah,
--   lalu sistem mengenali nomor pengirimnya sebagai orang tua siswa
--   tertentu dan membalas dengan tautan rapor anaknya sendiri.
--
--   Selama ini tautan itu hanya dikirim SEKALI, dan orang tua yang
--   chat-nya sudah tenggelam harus menghubungi wali kelas satu per satu.
--
-- YANG TIDAK BERUBAH
--   Token, PIN, dan tautan yang sudah tersebar. Migrasi ini tidak
--   menyentuh tabel akses_ortu sama sekali; ia hanya menambah cara
--   MENEMUKAN tautan yang sudah ada.
--
-- Seluruhnya berjalan dalam satu transaksi.
-- ===================================================================

BEGIN;

-- -------------------------------------------------------------------
-- 1. Nomor WhatsApp orang tua menempel pada siswa
-- -------------------------------------------------------------------
-- Kolom "No WA" sudah ada di Master Rekap sejak awal dan sudah dibaca
-- sync.js, tetapi tidak pernah ikut dikirim ke database. Inilah yang
-- membuat layanan ini belum mungkin: pertanyaan "nomor ini orang tua
-- siapa" tidak punya tempat untuk dijawab.
--
-- Ditaruh di `siswa`, bukan di `akses_ortu`, karena nomor orang tua
-- adalah fakta tentang siswa yang berlaku sejak hari pertama --
-- sedangkan baris akses_ortu baru lahir ketika kepala sekolah menekan
-- "Terbitkan". Kalau nomornya ikut menumpang di sana, siswa yang
-- tautannya belum diterbitkan tidak akan bisa dikenali sama sekali,
-- dan justru merekalah yang paling perlu dibalas dengan penjelasan.
ALTER TABLE siswa ADD COLUMN IF NOT EXISTS no_wa VARCHAR(120);

COMMENT ON COLUMN siswa.no_wa IS
    'Isi sel "No WA" di Master Rekap, apa adanya. Untuk ditampilkan, bukan untuk dicocokkan.';

-- Bentuk baku 62xxxxxxxxxx, yang dipakai MENCOCOKKAN nomor pengirim.
--
-- Larik, bukan satu kolom teks: satu sel kerap memuat nomor ayah DAN
-- ibu ("0812xxx / 0813xxx"), dan keduanya sah untuk anak yang sama.
-- Sebaliknya satu nomor juga wajar dimiliki beberapa siswa -- orang tua
-- dengan dua anak di sekolah yang sama -- sehingga pencarian balik
-- memang harus bisa mengembalikan lebih dari satu baris.
--
-- Diisi oleh /api/sync memakai lib/nomor-wa.js, BUKAN oleh kolom
-- generated di sini: aturan normalisasinya cukup berliku sehingga dua
-- salinan (SQL dan JavaScript) pasti akan menyimpang, dan simpangannya
-- muncul sebagai orang tua yang tidak dikenali -- tanpa pesan galat.
ALTER TABLE siswa ADD COLUMN IF NOT EXISTS wa_normal TEXT[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN siswa.wa_normal IS
    'Nomor WA orang tua dalam bentuk baku 62xxxxxxxxxx. Diisi /api/sync lewat lib/nomor-wa.js.';

-- GIN, bukan B-tree: yang ditanyakan adalah "larik ini memuat nomor
-- X?" (operator @>), dan B-tree tidak bisa menjawabnya.
CREATE INDEX IF NOT EXISTS idx_siswa_wa_normal ON siswa USING GIN (wa_normal);


-- -------------------------------------------------------------------
-- 2. Nomor WhatsApp milik sekolah
-- -------------------------------------------------------------------
-- Nomor perangkat Fonnte yang dipakai sekolah ini. Fonnte menyertakan
-- nomor tujuan sebagai field `device` di setiap webhook, sehingga satu
-- aplikasi dapat melayani beberapa sekolah sekaligus: pesan yang masuk
-- ke nomor Kudus dijawab dengan data Kudus.
--
-- Boleh NULL. Selama baru ada satu sekolah yang memakai layanan ini,
-- pencocokan device tidak diperlukan sama sekali.
ALTER TABLE sekolah ADD COLUMN IF NOT EXISTS wa_pengirim VARCHAR(25);

COMMENT ON COLUMN sekolah.wa_pengirim IS
    'Nomor perangkat Fonnte sekolah ini, bentuk baku 62xxx. Dipakai memilah webhook antar sekolah.';


-- -------------------------------------------------------------------
-- 3. Catatan pesan masuk
-- -------------------------------------------------------------------
-- Dua gunanya, dan keduanya nyata:
--
--   a. Pembatas laju. Tanpa ini, satu nomor yang membalas otomatis
--      (autoresponder, atau orang tua yang menekan kirim berkali-kali)
--      membuat sistem dan Fonnte saling berbalas tanpa henti — dan
--      kuota Fonnte dihitung per pesan terkirim.
--   b. Bukti. Ketika orang tua berkata "saya sudah chat tapi tidak
--      dibalas", inilah satu-satunya tempat yang bisa menjawab apakah
--      pesannya memang sampai, dan kalau sampai, mengapa jawabannya
--      begitu.
--
-- Isi pesan orang tua SENGAJA TIDAK disimpan. Layanan ini tidak
-- membacanya sama sekali — nomor pengirimlah yang menentukan jawaban —
-- jadi menyimpannya hanya menumpuk percakapan pribadi tanpa satu pun
-- kegunaan. Yang dicatat cukup: siapa, kapan, dan dijawab apa.
CREATE TABLE IF NOT EXISTS wa_pesan (
    id          BIGSERIAL   PRIMARY KEY,
    pengirim    VARCHAR(25) NOT NULL,          -- bentuk baku 62xxx
    sekolah_id  BIGINT      REFERENCES sekolah(id) ON DELETE SET NULL,
    hasil       VARCHAR(30) NOT NULL,          -- lihat daftar di bawah
    jumlah_anak SMALLINT    NOT NULL DEFAULT 0,
    dibuat_pada TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON COLUMN wa_pesan.hasil IS
    'terkirim | tidak_dikenal | belum_terbit | dibatasi | gagal_kirim';

-- Pembatas laju bertanya "berapa pesan dari nomor ini dalam sejam
-- terakhir", jadi indeksnya harus menurut nomor DAN waktu sekaligus.
CREATE INDEX IF NOT EXISTS idx_wa_pesan_pengirim
    ON wa_pesan (pengirim, dibuat_pada DESC);


-- -------------------------------------------------------------------
-- 4. Row Level Security
-- -------------------------------------------------------------------
-- wa_pesan tidak diberi satu pun policy, mengikuti pola akses_ortu:
-- tabel ini hanya disentuh service_role dari sisi server. Tanpa policy,
-- RLS menolak seluruh akses anon/authenticated.
ALTER TABLE wa_pesan ENABLE ROW LEVEL SECURITY;

COMMIT;

-- ===================================================================
-- SESUDAH MIGRASI
-- ===================================================================
-- 1. Perbarui sync.js di Apps Script (versi ini mengirim kolom No WA),
--    lalu jalankan SiPaDi → Sinkronkan Sekarang. Sebelum itu, kolom
--    wa_normal seluruh siswa masih kosong dan tidak ada nomor yang
--    dikenali.
-- 2. Isi nomor perangkat WhatsApp sekolah, mis.:
--
--      UPDATE sekolah SET wa_pengirim = '628123456789' WHERE kode = 'SDYFK';
--
-- 3. Isi env var di Vercel: FONNTE_TOKEN dan WA_WEBHOOK_SECRET,
--    lalu pasang webhook-nya di Fonnte. Selengkapnya: docs/LAYANAN_WA.md
--
-- Memeriksa hasil sinkronisasi:
--
--   SELECT count(*) FILTER (WHERE cardinality(wa_normal) > 0) AS punya_wa,
--          count(*)                                          AS total
--   FROM   siswa;
-- ===================================================================
