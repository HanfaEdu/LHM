# Ringkasan Sistem LHM — bekal untuk percakapan baru

Dokumen ini dibuat untuk dilampirkan di awal percakapan baru, supaya
tidak perlu menjelaskan ulang sistemnya dari nol. Isinya keadaan per
**31 Agustus 2026**.

**Fokus percakapan berikutnya: integrasi jenjang PG untuk empat sekolah
— Jepara, Kudus, Pati, Juwana.** Spreadsheet dan Master Rekap
masing-masing sudah dibuat, kode daerah-jenjang sudah ditetapkan.

---

## 1. Apa sistem ini

Rapor digital bulanan untuk jaringan sekolah BIAS. Guru mengisi nilai di
Google Spreadsheet; sistem menyalinnya ke database dan menampilkannya
sebagai dasbor untuk wali kelas, kepala sekolah, dan biro akademik,
serta rapor untuk orang tua lewat tautan pribadi.

- Repositori: `HanfaEdu/LHM` — cabang kerja `claude/rapor-digital-system-1ye6i9`, selalu didorong juga ke `main`
- Aplikasi: Next.js (App Router, JavaScript, bukan TypeScript) di Vercel
- Database: Supabase (Postgres) — proyek **Database LHM**, `inuhrnogwcqbuhdiezwn`
- Pengisian nilai: Google Spreadsheet + Google Apps Script (`sync.js`)
- Bahasa kode, komentar, dan antarmuka: **Indonesia**

Pemilik sistem **bukan programmer**. Penjelasan perlu memakai bahasa
biasa, dan setiap perubahan sebaiknya dijaga skrip uji — bukan
diandalkan pada pembacaan kode oleh pemiliknya.

---

## 2. Arsitektur: dua pintu

**Pintu 1 — peramban langsung ke Supabase.** Dipakai dasbor wali kelas
dan kepala sekolah, memakai anon key. Penyaringan hak akses dikerjakan
**RLS di Postgres**, bukan oleh kode di halaman. Wali kelas yang
meminta data kelas lain menerima nol baris dari database.

**Pintu 2 — peramban ke Route Handler di Vercel, baru ke Supabase.**
Tiga jalur: `/api/rapor` (rapor orang tua), `/api/tautan` (kelola
tautan), `/api/sync` (penerima kiriman Apps Script). Ketiganya memakai
`service_role`.

> **`service_role` MELEWATI seluruh RLS.** Setiap endpoint yang
> memakainya wajib menyaring sendiri. Ini pernah menjadi lubang nyata:
> `/api/tautan` sempat tidak memeriksa sekolah sama sekali.

Apps Script tidak bisa memanggil Supabase langsung (Supabase menolak
secret key dari yang terdeteksi sebagai browser, dan UrlFetchApp ikut
terdeteksi begitu), karena itu ia lewat `/api/sync`.

---

## 3. Struktur data

### Tabel

| Tabel | Isi | Sumber |
|---|---|---|
| `sekolah` | identitas sekolah | Apps Script |
| `kelas` | kelas per tahun ajaran | Apps Script |
| `siswa` | identitas siswa | Apps Script |
| `penempatan` | siswa X di kelas mana, tahun ajaran mana | Apps Script |
| `nilai_bulanan` | nilai per siswa per bulan | Apps Script |
| `users_access` | hak akses guru/kepsek/biro | Apps Script |
| `akses_ortu` | token tautan rapor orang tua | aplikasi, **bukan** spreadsheet |
| `mapping_quran` | poin → nama surah / bab Tahsin | `seed.sql`, **bukan** sinkronisasi |

### `nilai_bulanan` — inti datanya

```
nis, kelas_id, bulan, urutan_bulan (1–12)
rata_b_indo, rata_mtk, rata_ipa      NUMERIC(5,2), boleh NULL
target_tahfidz, capaian_tahfidz      INTEGER (poin)
target_tahsin,  capaian_tahsin       INTEGER (poin)
UNIQUE (nis, kelas_id, bulan)
```

- **Tahun ajaran mulai Juli**: `Juli, Agustus, September, Oktober,
  November, Desember, Januari, Februari, Maret, April, Mei, Juni`
- `NULL` = belum dinilai atau siswa sakit — **bukan** nol
- Tahfidz/Tahsin disimpan sebagai **angka**, bukan teks. Nama bab Tahsin
  berulang (Fathah muncul di bab 1 dan 2), jadi angka → nama selalu
  pasti sedangkan nama → angka ambigu. `mapping_quran` yang
  menerjemahkannya untuk tampilan.

### NIS adalah identitas seluruh sistem

- `siswa.nis` = `<KODE_SEKOLAH>-<nomor lokal>`, misal `SDYFK-301`
- Diberi awalan kode sekolah karena tiap sekolah memakai deret nomor
  yang mirip; tanpa awalan, siswa 301 Kudus dan 301 Pati jadi satu baris
- `nis_lokal` menyimpan nomor aslinya; `UNIQUE (sekolah_id, nis_lokal)`
- **KODE_SEKOLAH tidak boleh diubah setelah ada siswa tersinkron** —
  mengubahnya sama dengan mengganti kunci seluruh siswa

**Jebakan besar:** sinkronisasi hanya menambah dan memperbarui,
**tidak pernah menghapus**. NIS yang berubah menghasilkan siswa hantu
berdampingan dengan yang baru. Untuk penomoran yang berubah menyeluruh,
pakai `perawatan/bersihkan-data.sql` (punya potret dan prosedur
membatalkan) lalu sinkron ulang.

### Kolom di Master Rekap (Sheet1)

Dibaca **berdasarkan nama judul**, bukan posisi:

```
Tahun Ajaran | Kelas | Wali Kelas | Nama Lengkap | Nama Siswa |
NISN/NIS | No WA | Bulan | Target 3 Mapel |
Rata B. Indo | Rata MTK | Rata IPA |
Target Tahfidz | Capaian Tahfidz | Target Tahsin | Capaian Tahsin
```

Kolom **No WA dibaca tetapi tidak pernah dikirim** — nomor WA orang tua
saat ini tidak tersimpan di database. Akibatnya lapis PIN (6 digit
terakhir nomor WA) tidak aktif; tautan itu sendiri satu-satunya
pengaman. Ini keputusan sadar, bukan kelalaian.

Susunan sheet: blok per bulan, **25 baris per kelas per bulan**.
Melebihi 25 merusak susunan blok berikutnya.

---

## 4. Tingkat login

### Guru dan pimpinan — Google OAuth, didaftarkan lewat sheet `users_access`

| Peran | Melihat | Kolom Kelas | Kolom Cakupan Jenjang |
|---|---|---|---|
| `wali_kelas` | satu kelas di sekolahnya | wajib | diabaikan |
| `kepala_sekolah` | seluruh kelas di sekolahnya | dikosongkan | diabaikan |
| `direktur_area` | seluruh sekolah di **areanya** | dikosongkan | menentukan jenjang |

Kolom sheet `users_access`: `Email | Nama | Peran | Kelas | Cakupan Jenjang`
(kolom terakhir dicari lewat nama judulnya; sheet lama tanpa kolom itu
tetap berjalan).

> **`users_access.email` adalah PRIMARY KEY.** Email yang sama ditulis
> di dua Master Rekap akan saling menimpa lewat upsert — sekolah yang
> sinkron paling akhir yang menang, dan karena tiap sekolah punya pemicu
> tengah malam sendiri, pemenangnya bisa berganti tiap malam **tanpa
> satu pun pesan galat**. Email biro ditulis **sekali saja**, di salah
> satu sekolah di areanya.

### Cakupan jenjang biro

| Isi kolom | Artinya |
|---|---|
| *(kosong)* | seluruh jenjang di areanya — direktur area |
| `SD` | hanya SD di areanya |
| `PG,TK` | hanya PG dan TK di areanya |

Boleh huruf kecil dan berspasi. Jenjang sah: `PG TK SD SMP SMA`.
Salah ketik **menolak seluruh baris**, tidak dikirim setengah benar.

Aturannya ada di **dua tempat yang wajib berubah bersama**:
`sekolah_yang_boleh()` di `migrasi/002-cakupan-jenjang.sql` (menjaga
dasbor lewat RLS) dan `dalamCakupan()` di `lib/cakupan.js` (menjaga
`/api/tautan` yang melewati RLS). Kesamaannya dijaga
`scripts/uji-cakupan-jenjang.mjs`.

### Orang tua — tanpa akun

Tautan pribadi berisi token acak 12 karakter (abjad 62 simbol, ±71 bit).
Diverifikasi `/api/rapor` di server. Token **tidak ada di spreadsheet**
dan tidak bisa dibangun ulang. Diterbitkan lewat halaman Tautan Orang
Tua oleh kepala sekolah atau biro.

---

## 5. Aturan antar jenjang

Jenjang disimpan di `sekolah.jenjang` dan menentukan **mata pelajaran
mana yang tampil**.

```js
// lib/statistik.js
const MAPEL = [rata_b_indo, rata_mtk, rata_ipa];
const MAPEL_PER_JENJANG = { PG: ['rata_b_indo', 'rata_mtk'] };
```

- **PG tidak menilai IPA.** Meteran, grafik, kolom tabel, legenda,
  dan rapor orang tua semuanya menyembunyikannya.
- Jenjang lain (TK, SMP, SMA) belum didaftarkan — jatuh ke daftar penuh.
  **TK belum ditanyakan** apa saja yang dinilai; jangan diasumsikan sama
  dengan PG.
- Tahfidz dan Tahsin berlaku untuk semua jenjang.

Cara pakainya di komponen: `useMapel()` dari `app/komponen/jenjang.jsx`.

> **Jebakan yang sudah dua kali memakan korban:** komponen yang MEMASANG
> `<KonteksJenjang.Provider>` tidak bisa ikut membaca konteksnya sendiri
> — ia hanya menerima nilai bawaan. Halaman menghitung mapelnya sendiri
> lewat `mapelUntuk(sekolah?.jenjang)`; `useMapel()` hanya untuk komponen
> **di dalam** Provider.

Biro yang berpindah antar sekolah beda jenjang: daftar mapel ikut
berganti dalam sesi login yang sama. Dijaga `scripts/uji-jenjang.mjs`.

---

## 6. Banyak sekolah

**Satu sekolah = satu Master Rekap = satu proyek Apps Script.** Tidak
ada kolom "Sekolah" per baris; identitasnya ditulis sekali di
konfigurasi skrip.

Konfigurasi per sekolah di `sync.js` (bagian paling atas):

```js
const APP_URL     = '…';            // domain Vercel — TIDAK ada di GitHub
const SYNC_SECRET = '…';            // kunci rahasia — TIDAK ada di GitHub
const KODE_SEKOLAH    = 'SDYFK';    // <jenjang><singkatan>, tidak boleh diubah kelak
const NAMA_SEKOLAH    = 'SD Yaumi Fatimah Kudus';   // tampil apa adanya
const AREA_SEKOLAH    = 'Pati Raya';                // harus SAMA PERSIS antar sekolah se-area
const JENJANG_SEKOLAH = 'SD';                       // PG|TK|SD|SMP|SMA, divalidasi
const LINK_LHM        = 'https://…';                // wajib https, boleh kosong
const KELAS_DIHARAPKAN = ['1','2A','2B','3','4','5','6'];  // maks 20 karakter per nama
```

- Nama sekolah tampil **persis seperti diketik** (kecuali baris identitas
  kecil di atas judul yang selalu huruf besar karena CSS)
- Nama kelas bebas — `Kumbang`, `PG Kecil`. Sistem tidak pernah
  menganggapnya angka. Batas 20 karakter (database **menolak**, bukan
  memotong)
- `AREA_SEKOLAH` salah ketik satu huruf → sekolah itu tidak terlihat biro

Menyalin `sync.js` dari GitHub selalu perlu mengisi ulang `APP_URL` dan
`SYNC_SECRET`.

---

## 7. Keadaan sekarang

**Sudah jalan di produksi:** SD Yaumi Fatimah Kudus (`SDYFK`, area
Pati Raya), 7 kelas, 132 siswa, 3 akun biro (dua bercakupan `SD`, satu
kosong), tautan orang tua **belum dibagikan** — rencana Oktober setelah
data Juli–September lengkap.

**Migrasi yang sudah dijalankan:** `001-multi-sekolah.sql`,
`002-cakupan-jenjang.sql`.

**Pekerjaan tertunda milik pemilik:**
- NIS kelas 1 dan 2 akan diganti menyeluruh (menunggu admin) →
  jalankan `perawatan/bersihkan-data.sql` lalu sinkron ulang
- NIS `SDYFK-301` dipakai dua anak (kelas 2B dan 4) — harus dibetulkan
- 2 siswa kelas 2B belum ber-NIS
- Kelas 6 sudah 24 dari kapasitas 25 baris per blok bulan
- Kolom cakupan satu akun biro masih kosong (sengaja atau belum diisi?)
- Pemicu harian Apps Script (`sinkronkanSemua`, tengah malam, notifikasi
  kegagalan "Notify me immediately")

**Rencana yang dibahas tapi belum dikerjakan:** balasan otomatis
WhatsApp lewat Fonnte (butuh No WA masuk database dulu); biro lintas
area (butuh tabel penugasan, bukan kolom `area`); dasbor perbandingan
antar sekolah.

---

## 8. Skrip uji

Semuanya memakai boneka — **tidak menyentuh Supabase**. Beberapa perlu
`npx next build` lebih dulu dan Playwright.

| Skrip | Menjaga |
|---|---|
| `uji-cakupan-jenjang.mjs` | cakupan biro — SQL asli di Postgres sungguhan + kembarannya di JS |
| `uji-direktur-area.mjs` | dasbor biro, pemilih sekolah, penyaringan tautan |
| `uji-jenjang.mjs` | PG tanpa IPA di seluruh halaman |
| `uji-cetak-dasbor.mjs` | grafik tercetak tidak rusak (bukti tingkat PDF) |
| `uji-cetak-rapor.mjs` | cetak rapor orang tua |
| `uji-tahun-ajaran.mjs` | pergantian tahun ajaran |
| `uji-sinkron.mjs` | kegagalan sinkronisasi bersuara; NIS kembar terdeteksi |

---

## 9. Pelajaran yang sudah mahal — jangan diulang

- `next build` **tidak** menangkap `ReferenceError` di JSX. Tiga kerusakan
  sudah lolos dengan build bersih. Uji lewat halaman jadinya.
- Recharts `ResponsiveContainer` membekukan lebar saat pengukuran layar
  **dan** menganimasikan perubahan ukuran. Cetak butuh **keduanya**:
  `key` untuk memasang ulang, dan `isAnimationActive={false}`.
- `@media print` **tidak** menambah kekhususan CSS. Seluruh aturan cetak
  harus berada di satu blok terakhir.
- Judul bagian yang diletakkan di dalam `.penyaring` hilang saat dicetak.
- `VARCHAR(20)` **menolak** nilai kelebihan, tidak memotongnya.
- Garis target konstan harus `ReferenceLine`, bukan `<Line>` — deret
  biasa berhenti di titik tengah kategori.
- WhatsApp mengukur sendiri gambar pratinjau; ukuran di metadata
  diabaikan olehnya (tetapi dipercaya Facebook/Telegram/Slack).

---

## 10. Untuk integrasi PG — yang perlu disiapkan

Empat sekolah PG: **Jepara, Kudus, Pati, Juwana**. Kode daerah-jenjang
sudah ditetapkan pemilik.

Yang perlu diperiksa di percakapan berikutnya:

1. **Kode dan area tiap sekolah** — `KODE_SEKOLAH` unik, `AREA_SEKOLAH`
   ditulis sama persis. Jepara termasuk **Pati Raya**.
2. **`JENJANG_SEKOLAH = 'PG'`** untuk keempatnya, supaya IPA tersembunyi.
3. **`KELAS_DIHARAPKAN` per sekolah** — nama kelas PG bebas dan berbeda
   antar sekolah (`Kumbang`, `Capung`, `PG Kecil`, `PG Besar`), maksimal
   20 karakter.
4. **Kolom nilai IPA di Master Rekap PG** — apakah ada tapi kosong, atau
   tidak ada sama sekali? Sinkronisasi tidak masalah dengan kolom hilang,
   tapi perlu dipastikan header yang lain tetap bernama persis.
5. **Tahfidz/Tahsin di PG** — apakah skala poinnya sama dengan SD?
   `mapping_quran` dipakai bersama seluruh jenjang.
6. **Biro PG-TK** — emailnya ditulis **sekali saja** di salah satu dari
   empat sekolah itu, dengan `Cakupan Jenjang` = `PG,TK`.
7. **`LINK_LHM` masing-masing** — tiap sekolah punya aplikasi input
   sendiri.
8. **`lib/sekolah.js`** masih memakai SD Kudus sebagai nilai bawaan
   (`SEKOLAH_BAWAAN`, `LINK_LHM_BAWAAN`). Harus diganti menjadi netral
   sebelum sekolah kedua benar-benar hidup.
9. Urutan aman: **perbarui Apps Script dulu → Cek Kesehatan Data →
   baru sinkron.** Jangan sinkron sebelum Cek Kesehatan Data bersih.
