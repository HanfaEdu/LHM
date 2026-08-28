# Menyiapkan sistem untuk lebih dari satu sekolah

Dokumen ini menjelaskan bagaimana sistem rapor ini disiapkan agar bisa
melayani beberapa sekolah dalam jaringan BIAS, dan apa yang harus
dilakukan pada saat sekolah berikutnya benar-benar bergabung.

Ditulis karena pekerjaannya membentang berminggu-minggu dan melibatkan
orang lain (Tim Manajemen, kepala sekolah cabang). Keputusan yang tidak
dicatat akan terlupa, lalu diambil ulang secara berbeda.

---

## 1. Bentuk jaringannya

BIAS bukan satu sekolah dan bukan pula sekumpulan sekolah yang berdiri
sendiri-sendiri. Ada lapisan **area / Tim Manajemen** di antaranya:

```
Yayasan Bina Anak Sholeh (pusat: Yogyakarta)
├── Area Pati raya  — merek "BIAS Yaumi Fatimah"
│   ├── SD Yaumi Fatimah Kudus      ← sistem ini bermula di sini
│   ├── SD Yaumi Fatimah Pati
│   ├── SD Yaumi Fatimah Juwana
│   └── (Jepara — belum ada SD)
├── Area Klaten–Solo
├── Area Temanggung–Magelang–Muntilan
├── Area Yogyakarta–Kaliurang–Palagan
├── Area Cilacap–Sampang
├── Area Gombong — merek "BIAS Ath-Thorik"
└── ... dan seterusnya
```

Dua hal yang perlu diingat dari bentuk ini:

**Areanya nyata, bukan sekadar pengelompokan di atas kertas.** Satu Tim
Manajemen membawahi beberapa sekolah, dan direkturnya wajar ingin
melihat ketiganya sekaligus. Justru direktur Pati raya inilah yang
pertama tertarik pada sistem ini.

**Nama sekolah tidak bisa ditebak dari polanya.** Pati raya memakai
"Yaumi Fatimah", Gombong memakai "Ath-Thorik", area lain memakai "BIAS"
saja. Karena itu nama sekolah harus menjadi **data**, bukan aturan yang
ditulis di dalam kode.

---

## 2. Keputusan: satu sistem, bukan satu sistem per sekolah

Yang dipilih: **satu basis kode, satu Supabase, satu Vercel**, dengan
setiap baris data membawa identitas sekolahnya.

Alasan yang menentukan, bukan alasan selera:

| | Menggandakan proyek per sekolah | Satu sistem multi-sekolah |
|---|---|---|
| Perbaikan | dikerjakan N kali | sekali, langsung ke semua |
| Batas Supabase gratis | 2 proyek aktif per organisasi — mentok di sekolah ke-3 | satu proyek |
| Dasbor tingkat area | tidak mungkin | wajar |
| Risiko | data mustahil bocor antar sekolah | bocor kalau RLS salah |

Baris "perbaikan" itu yang paling menentukan. Sistem ini dirawat satu
orang yang bukan programmer. Dalam beberapa hari pertama saja sudah ada
belasan perbaikan; dikalikan tiga sekolah, itu menjadi puluhan
penerapan manual yang tidak mungkin dijaga konsisten.

Risiko kebocoran antar-sekolah nyata dan harus ditangani serius — itu
isi bagian 4.

---

## 3. Yang rusak kalau sekolah kedua masuk tanpa persiapan

Empat hal, dan **dua di antaranya merusak data tanpa memunculkan pesan
galat apa pun**:

### (a) Nomor induk siswa bertabrakan — PALING BERBAHAYA

`siswa` memakai `nis` sebagai kunci utama. NIS di Master Rekap Kudus
berisi angka lokal tiga digit (281, 282, 301, 316, 334, ...), bukan NISN
nasional. Pati dan Juwana hampir pasti memakai deret angka yang sama.

Akibatnya siswa 301 Kudus dan siswa 301 Pati menjadi **satu baris yang
sama**: namanya saling menimpa, penempatan kelasnya bercampur, dan
nilainya tertukar. Tidak ada pesan galat — sinkronisasi berjalan mulus
dan datanya salah.

### (b) Nama kelas bertabrakan

`kelas` punya `UNIQUE (tahun_ajaran, nama_kelas)`. Kelas "2A" Kudus dan
"2A" Pati dianggap kelas yang sama. Sinkronisasi keduanya saling
menimpa.

### (c) Kepala sekolah melihat seluruh jaringan

`is_kepala_sekolah()` mengembalikan benar untuk kepala sekolah **mana
pun**. Kepala sekolah Pati akan melihat seluruh data Kudus.

### (d) Wali kelas melihat kelas sekolah lain

`kelas_yang_diampu()` mencocokkan `nama_kelas` saja. Wali kelas 2A Kudus
ikut melihat 2A Pati.

---

## 4. Rancangannya

### Identitas sekolah menjadi data

Tabel baru `sekolah`, dengan `area` sebagai lapisan Tim Manajemen:

```
sekolah(id, kode, nama, area, jenjang, aktif)
   'SDYFK', 'SD Yaumi Fatimah Kudus',  'Pati Raya',   'SD'
   'SDYFP', 'SD Yaumi Fatimah Pati',   'Pati Raya',   'SD'
   'SDYFJ', 'SD Yaumi Fatimah Juwana', 'Pati Raya',   'SD'
   'TKYFJ', 'TK Yaumi Fatimah Juwana', 'Pati Raya',   'TK'
   'SDBK',  'SD BIAS Klaten',          'Klaten-Solo', 'SD'
```

**Kode memuat jenjang di depannya.** TK dan SD di satu kota adalah dua
sekolah yang berbeda, dengan siswa, wali kelas, dan kepala sekolah
sendiri-sendiri. Tanpa jenjang di dalam kodenya, kode "YFJ" akan
terlanjur dipakai SD Juwana, dan TK Juwana yang menyusul tidak punya
kode yang wajar lagi.

**Kodenya tidak pernah diterjemahkan oleh sistem.** Tidak ada daftar di
dalam kode program yang memetakan `SDBK` menjadi "SD BIAS Klaten" — yang
tampil di kepala dasbor adalah kolom `nama`, apa adanya. Karena itu
sekolah dengan penamaan seperti apa pun (Yaumi Fatimah, Ath-Thorik,
BIAS, atau nama yang belum terpikirkan) cukup ditambahkan sebagai satu
baris data. **Tidak akan pernah ada perombakan kode untuk menambah
sekolah baru.**

`kode` tidak boleh berubah setelah ada siswa, karena dialah awalan NIS.
`nama` boleh diperbaiki kapan saja tanpa merusak apa pun.

### NIS diberi ruang nama

Kunci `siswa.nis` menjadi **global**: `<kode>-<nis lokal>` — `SDYFK-281`.
Nomor asli yang diketik guru tetap disimpan di kolom baru `nis_lokal`
dan itulah yang ditampilkan.

Cara ini dipilih daripada mengganti kunci utama menjadi gabungan
`(sekolah_id, nis)`, karena mengganti kunci utama memaksa ketiga tabel
anak (`penempatan`, `nilai_bulanan`, `akses_ortu`) ikut berganti bentuk
kunci asing, dan setiap query di aplikasi yang menyebut `nis` harus ikut
diubah. Memberi awalan hanya mengubah isinya, bukan bentuknya —
seluruh kode aplikasi tetap berjalan apa adanya.

### RLS dipersempit ke sekolah masing-masing

`users_access` mendapat `sekolah_id`. Kedua fungsi bantu RLS ikut
dipersempit sehingga kepala sekolah hanya melihat sekolahnya sendiri,
dan wali kelas hanya melihat kelas di sekolahnya sendiri.

Peran ketiga disiapkan untuk nanti: `direktur_area`, yang melihat
seluruh sekolah dalam satu area. Perannya sudah diterima database sejak
sekarang, tetapi dasbornya belum dibuat — supaya penambahannya kelak
tidak menuntut migrasi lagi.

---

## 5. Urutan pengerjaan

### Tahap 0 — asuransi (sekarang, mumpung masih satu sekolah)

Inilah yang paling murah dikerjakan hari ini dan paling mahal ditunda.
Sekarang ada 1 sekolah dan 113 siswa; migrasinya beberapa detik dan
tidak ada yang berubah di layar siapa pun.

Kalau ditunda sampai tiga sekolah berjalan sebagai sistem terpisah,
menyatukannya berarti alamat webnya berubah — dan karena identitas
aplikasi PWA berasal dari alamat itu, **setiap aplikasi yang sudah
terpasang di HP orang tua akan mati** dan harus dipasang ulang satu per
satu.

Langkahnya, **berurutan dan dalam satu waktu** (jangan terpisah
berhari-hari):

1. Cadangkan database dari Supabase (Database → Backups).
2. Jalankan `migrasi/001-multi-sekolah.sql` di Supabase → SQL Editor.
3. Perbarui `sync.js` di Apps Script, isi `KODE_SEKOLAH` (`SDYFK`) dan
   `NAMA_SEKOLAH` di bagian konfigurasi.
4. Jalankan **SiPaDi → Sinkronkan Sekarang** satu kali, lalu buka satu
   tautan rapor untuk memastikan semuanya masih terbaca.

Yang TIDAK berubah: tautan orang tua, token, PIN, dan aplikasi yang
sudah terpasang. Migrasi hanya menyentuh kolom `nis`, bukan `token`.

### Tahap 1 — saat Pati/Juwana benar-benar jadi

Barisnya **tidak perlu ditambahkan sendiri** ke tabel `sekolah`: skrip
sinkronisasi membuatnya otomatis dari KODE_SEKOLAH dan NAMA_SEKOLAH yang
Anda isi. Jadi seluruhnya dikerjakan dari spreadsheet, tanpa menyentuh
Supabase sama sekali.

1. Salin Master Rekap dan berkas kelas untuk sekolah itu.
2. Buka **Ekstensi → Apps Script** pada salinannya, lalu ubah **empat
   baris** di bagian konfigurasi paling atas:

   ```js
   const KODE_SEKOLAH    = 'SDYFP';                    // wajib berbeda
   const NAMA_SEKOLAH    = 'SD Yaumi Fatimah Pati';    // tampil di dasbor
   const AREA_SEKOLAH    = 'Pati Raya';
   const JENJANG_SEKOLAH = 'SD';
   ```

   `APP_URL` dan `SYNC_SECRET` **tetap sama** — satu penerapan Vercel
   melayani semua sekolah.

3. Jalankan **SiPaDi → Cek Kesehatan Data** lebih dulu. Baris paling
   atas laporannya menyebut sekolah yang akan disinkronkan. **Baca baris
   itu.** Kalau masih tertulis sekolah asal salinan, berarti langkah 2
   terlewat — dan melanjutkan berarti menimpa data sekolah itu.
4. Jalankan **SiPaDi → Sinkronkan Sekarang**. Baris sekolah, kelas,
   siswa, dan nilai terbentuk sendiri.
5. Daftarkan kepala sekolah dan wali kelasnya di sheet `users_access`
   milik Master Rekap itu. Mereka otomatis menjadi milik sekolah
   tersebut — sheet itu tidak perlu kolom sekolah.
6. **Ganti satu baris di `lib/sekolah.js`** menjadi nama netral
   (`'Sekolah BIAS'`). Nilai itu hanya dipakai sebagai cadangan saat
   nama sekolah gagal terbaca, dan sejak ada sekolah kedua ia menjadi
   salah bagi semua sekolah selain Kudus — yang paling merugikan
   pratinjau WhatsApp dan kaki lembar cetak, karena keduanya dibaca
   orang tua.

Tidak ada penerapan kode baru selain satu baris itu. Tidak ada proyek
Vercel baru, tidak ada Supabase baru, tidak ada domain baru.

Nama sekolah sudah dibaca dari data di seluruh tempat yang terlihat
orang tua maupun guru: kepala dasbor, judul tab, pratinjau tautan
WhatsApp, keterangan aplikasi PWA, dan kaki lembar cetak PDF. Diuji
dengan dua token dari dua sekolah berbeda pada satu penerapan yang
sama — keduanya menampilkan nama sekolahnya masing-masing.

### Tahap 2 — kalau diminta, bukan diduga

- Dasbor tingkat area untuk direktur Tim Manajemen.
- Merek per sekolah (logo dan nama di kepala halaman).
- Jenjang PG/TK — **ini masalah yang berbeda**, lihat bagian 6.

---

## 6. PG dan TK bukan perkara multi-sekolah

Perlu dipisahkan tegas, karena mudah tercampur.

Multi-sekolah adalah soal **siapa pemilik satu baris data**. Menambah
PG/TK adalah soal **apa yang dinilai**, dan itu jauh lebih dalam:
tabel `nilai_bulanan` sekarang punya kolom mati `rata_b_indo`,
`rata_mtk`, `rata_ipa`. Kalau PG/TK menilai hal lain — motorik,
kemandirian, sosial-emosional — kolom mati itu harus berganti menjadi
daftar mata pelajaran yang bisa diatur per jenjang. Seluruh grafik,
tabel, dan hasil cetak ikut terpengaruh.

Jangan diasumsikan datanya sama sebelum ditanyakan langsung ke guru
PG/TK. Kalau ternyata memang hanya Tahfidz, Tahsin, dan tiga mapel,
pekerjaannya cukup menambah baris di tabel `sekolah` dengan
`jenjang = 'TK'`. Kalau tidak, itu proyek tersendiri.

---

## 7. Pertanyaan yang harus dijawab yayasan, bukan oleh kode

**Siapa pemilik dan pengelola data gabungan ini?**

Kalau ada sekolah yang keberatan datanya berada di database yang sama
dengan sekolah lain, itu batasan kebijakan yang mengalahkan
pertimbangan teknis apa pun — dan jawabannya menjadi sistem terpisah
per area, berapa pun ongkos perawatannya.

Sebaiknya disepakati sebelum sekolah ketiga bergabung, bukan sesudah.
