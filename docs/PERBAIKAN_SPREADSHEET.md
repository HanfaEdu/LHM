# Audit Rumus & Daftar Perbaikan Spreadsheet Kelas

Hasil pemeriksaan file Kelas 1, 2A, 2B, 3, dan 6 (tahun ajaran 2026-2027).
Dokumen ini adalah daftar kerja untuk dibereskan di spreadsheet **sebelum**
sinkronisasi pertama ke Supabase dijalankan.

Perbaikan cukup dilakukan sekali di **file template**, lalu template itu
disalin ulang — hampir semua temuan di bawah muncul di semua kelas karena
berasal dari template yang sama.

---

## 1. 🔴 Rumus Capaian Tahfidz tidak ditarik ke bawah

**Muncul di:** semua file (5 dari 5)

Di sheet `Rekap Kelas`, kolom **N (Capaian Tahfidz)** hanya berisi rumus di
sel `N2`. Sel `N3` ke bawah benar-benar kosong — bukan berisi rumus yang
menghasilkan kosong, melainkan tidak ada rumusnya sama sekali.

Bandingkan dengan tetangganya yang semuanya punya rumus di setiap baris:

| Kolom | Rumus per baris? |
|---|---|
| M — Target Tahfidz | ada |
| **N — Capaian Tahfidz** | **hanya di N2** |
| O — Target Tahsin | ada |
| P — Capaian Tahsin | ada |

Akibatnya, bulan Juli hanya 1 siswa per kelas yang capaian Tahfidz-nya
terbaca, padahal sheet `Tahfidz` sudah terisi lengkap:

| File | Capaian Tahfidz di Rekap | Sheet Tahfidz |
|---|---|---|
| Kelas 1 | 1 dari 19 | 19 terisi |
| Kelas 2A | 1 dari 16 | 16 terisi |
| Kelas 2B | 1 dari 16 | 16 terisi |
| Kelas 3 | 1 dari 20 | 20 terisi |
| Kelas 6 | 1 dari 24 | 24 terisi |

**Perbaikan:** salin `N2`, lalu tempel ke `N3:N301`. Rumusnya sudah benar,
hanya belum menjangkau baris lain:

```
=IF($E2="", "", IFERROR(INDEX(Tahfidz!$C$7:$N$31,
    MATCH($E2, Tahfidz!$B$7:$B$31, 0),
    MATCH($H2, Tahfidz!$C$5:$N$5, 0)), ""))
```

> Perhatikan: di `N2` yang asli, rujukan siswa ditulis `E2` tanpa `$`.
> Itu sudah benar untuk disalin ke bawah. Samakan juga `$E2` agar seragam
> dengan kolom M/O/P.

---

## 2. 🔴 NIS Kelas 1 kosong

**Muncul di:** Kelas 1

Sheet `Data Siswa` Kelas 1: kolom `NISN/NIS` kosong untuk seluruh 19 siswa,
dan sheet mapelnya pun tidak punya baris NIS — hanya nama panggilan.

NIS adalah kunci seluruh sistem: penanda unik siswa di database, dasar
penelusuran riwayat lintas tahun, dan dasar penerbitan link akses orang tua.
Tanpa NIS, siswa Kelas 1 tidak bisa masuk ke database.

**Perbaikan:** isi kolom `NISN/NIS` di `Data Siswa`, lalu isi baris 5 di
ketiga sheet mapel dengan NIS yang sama urutannya dengan baris 6.

---

## 3. 🔴 Rumus rata-rata hanya membaca sampai baris 100

**Muncul di:** semua file

Rumus di kolom J/K/L (`Rata B. Indo`, `Rata MTK`, `Rata IPA`):

```
=IF($E2="", "", IFERROR(AVERAGE(FILTER(
    INDEX('B. Indonesia'!$F$7:$AD$100, 0, MATCH($E2, 'B. Indonesia'!$F$6:$AD$6, 0)),
    'B. Indonesia'!$B$7:$B$100 = $H2)), ""))
```

Rentangnya berhenti di **baris 100**, sedangkan sheet mapel menyediakan
ruang sampai baris 994. Artinya kapasitas nyata hanya **94 baris asesmen
untuk satu tahun ajaran penuh** — sekitar 8 asesmen per bulan.

Kelas 6 sudah memakai 23 baris untuk Matematika pada bulan Juli saja. Kalau
laju itu berlanjut, batas 94 akan terlampaui sekitar bulan Oktober, dan
asesmen setelahnya **hilang dari rata-rata tanpa pesan error apa pun** —
angkanya tetap muncul, hanya tidak lagi mencerminkan semua penilaian.

**Perbaikan:** ganti semua `$100` menjadi `$994` di rumus kolom J, K, dan L.
Ada tiga rumus (satu per mapel), masing-masing menyebut angka 100 dua kali.

---

## 4. 🟡 Blok bulan hanya menyediakan 25 baris

**Muncul di:** semua file

`Rekap Kelas` disusun sebagai 12 blok bulan, masing-masing 25 baris
(`E2:E26` untuk Juli, `E27:E51` untuk Agustus, dan seterusnya). Daftar siswa
diambil dengan `FILTER('Data Siswa'!$B$2:$E$26; ...)` — juga 25 baris.

Kelas 6 sekarang berisi **24 siswa**. Tersisa satu baris cadangan. Begitu
kelas itu menerima 2 siswa baru, hasil FILTER menjadi 26 baris dan menabrak
blok Agustus, sehingga seluruh sheet berubah menjadi `#REF!`.

**Perbaikan:** perlebar tiap blok menjadi 30 baris, atau pindahkan blok
bulan ke arah kolom alih-alih ke bawah. Kalau belum sempat, minimal jangan
menambah siswa ke kelas yang sudah mendekati 25 tanpa memperlebar blok
lebih dulu.

---

## 5. 🟡 Target Tahfidz & Tahsin ditulis sebagai teks di Kelas 2A dan 2B

| Kelas | Target Tahfidz | Target Tahsin |
|---|---|---|
| 1 | `5` | `1` |
| 2A | `"Al Insyirah"` | `"Mad Ashli"` |
| 2B | `"Al insyirah"` | `"Bab 7"` |
| 3 | `30` | `21` |
| 6 | `46` | `28` |

Tiga dari lima kelas sudah memakai angka, jadi **angka adalah standarnya**.

Yang membuat teks berbahaya khusus untuk Tahsin: **nama materinya berulang.**
"Mad Asli" ada di bab 7, 8, *dan* 9. "Tanwin" di bab 4, 5, dan 6. Jadi angka
→ nama selalu pasti, tetapi nama → angka tidak bisa dipulihkan. Notasi
Kelas 2B (`Bab 7`) justru yang paling tepat; `Mad Ashli` di Kelas 2A tidak
bisa dipastikan tanpa bertanya ke wali kelasnya.

**Perbaikan:** ubah baris `Target:` di sheet `Tahfidz` dan `Tahsin` Kelas 2A
dan 2B menjadi angka. Nama surah/materi tetap tampil otomatis di aplikasi.

Sementara belum diubah, `sync.js` menanganinya lewat `OVERRIDE_TARGET_TEKS`
(saat ini `2A|tahsin|mad ashli` → 7, mengikuti Kelas 2B yang setingkat).
**Mohon konfirmasi angka ini benar 7, bukan 8 atau 9.**

---

## 6. 🟡 Sheet `Grafik Siswa` tertulis "Ammar" di semua file

Sel `B1` sheet `Grafik Siswa` berisi `Ammar` di file Kelas 1, 2A, maupun 6 —
padahal tidak satu pun dari ketiga kelas itu punya siswa bernama Ammar.
Ammar adalah siswa Kelas 3, tempat template ini pertama kali dibuat.

Sheet inilah yang dicetak menjadi rapor per siswa. Artinya rapor bulanan
berisiko keluar dengan **nama yang tidak sesuai isinya** kalau wali kelas
lupa menggantinya manual.

**Perbaikan:** ganti `B1` menjadi dropdown (Data > Validasi data > rentang
`Data Siswa!C2:C26`) supaya tidak bisa diisi nama di luar daftar kelas.

> Masalah ini hilang sendirinya setelah pindah ke web app — pemilihan siswa
> di sana selalu berasal dari database.

---

## 7. 🟡 Target 3 Mapel dipatok 90 di dalam rumus

Kolom I diisi rumus array `=IF(ISBLANK($E$2:$E$301), "", 90)`. Angka 90
tertanam di dalam rumus, sehingga mengubah target satu kelas berarti
menyunting rumus, bukan mengganti satu sel.

**Perbaikan:** taruh target di satu sel (misalnya `Data Siswa!H5`), lalu
ubah rumusnya menjadi `=IF(ISBLANK($E$2:$E$301), "", 'Data Siswa'!$H$5)`.

---

## 8. ⚪ Rata IPA Kelas 6 kosong — ini BUKAN bug

Bulan Juli Kelas 6: `Rata B. Indo` dan `Rata MTK` terisi 24/24, sedangkan
`Rata IPA` kosong 24/24. Setelah ditelusuri, sheet `IPA` Kelas 6 memang
belum berisi satu pun baris materi — hanya dua baris berlabel bulan tanpa
nilai. Rumusnya benar, datanya yang belum ada.

Tidak ada yang perlu diperbaiki. Dicatat di sini supaya tidak salah
disimpulkan sebagai kerusakan rumus seperti temuan nomor 1.

---

## 9. ⚪ Belum terisi: `users_access` dan `No WA`

- Sheet `users_access` di Master Rekap masih berisi header saja. Tanpa isi,
  tidak ada guru atau kepala sekolah yang bisa masuk ke dashboard.
  Format: `email | nama | role | kelas`, dengan role `kepala_sekolah` atau
  `wali_kelas`.
- Kolom `No WA` kosong di seluruh file. Ini dibutuhkan untuk mengirim link
  akses orang tua, dan 6 digit terakhirnya dipakai sebagai PIN.

---

## 10. 🔴 Tabel sebaran nilai tidak menjumlah seluruh siswa

Ditemukan saat menghitung ulang angka rapor untuk dasbor wali kelas.
Tabel rekap pada `LAPORAN AKADEMIK` Kelas 2 bulan Februari (19 siswa)
berisi:

| Rentang | B. Indo | MTK | IPA |
|---|---|---|---|
| < 70 | 0 | 0 | 0 |
| 71-79 | 1 | 0 | 0 |
| 80-89 | 6 | 1 | 2 |
| 90-98 | 11 | 6 | 5 |
| 99-100 | 0 | 8 | 9 |
| **Jumlah** | **18** | **15** | **16** |

Tidak satu pun kolom mencapai 19. B. Indonesia kehilangan 1 siswa,
Matematika 4, IPA 3. Persentasenya pun tidak menjumlah 100% — kolom
Matematika hanya mencapai 79%.

Dihitung ulang dari tabel nilai di halaman yang sama, sebarannya
seharusnya:

| Rentang | B. Indo | MTK | IPA |
|---|---|---|---|
| < 70 | 0 | 0 | 0 |
| 70–79 | 1 | 0 | 0 |
| 80–89 | 6 | 1 | 2 |
| 90–98 | 11 | 8 | 5 |
| 99–100 | 1 | 10 | 12 |
| **Jumlah** | **19** | **19** | **19** |

Contoh yang paling gampang diperiksa: Della memperoleh 99 pada B.
Indonesia, tetapi baris `99-100` tertulis 0.

Dampaknya nyata untuk laporan ke direktur — sebaran nilai terlihat lebih
rendah daripada kenyataannya, terutama pada Matematika. Silakan periksa
rumus `COUNTIFS` pada tabel rekap tersebut; kemungkinan batas atas dan
batas bawah antar rentang tidak bersambung, sehingga sebagian nilai jatuh
di celah antar rentang.

Dasbor menghitung sendiri sebarannya dari nilai mentah, jadi angka di
aplikasi sudah benar tanpa menunggu perbaikan ini. Yang perlu diperbaiki
adalah rapor PDF yang masih dicetak dari spreadsheet.

---

## Tentang target yang kadang diisi per semester, kadang per bulan

Ini tidak perlu diseragamkan. `sync.js` memakai aturan **"pakai target
terakhir yang pernah diisi"**, yang melayani kedua kebiasaan sekaligus:

| Cara wali kelas mengisi | Hasil di aplikasi |
|---|---|
| Hanya Juli | Agustus s/d Juni memakai target Juli |
| Setiap bulan | Tiap bulan memakai targetnya sendiri |
| Juli, lalu diubah Januari | Agustus–Desember ikut Juli; Januari–Juni ikut Januari |

Yang **tidak** diteruskan adalah **capaian**. Target adalah janji yang
berlaku sampai diubah; capaian adalah fakta bulan itu. Bulan tanpa capaian
harus tetap kosong, supaya grafik menggambarkannya sebagai belum dinilai —
bukan sebagai hafalan yang berhenti di angka yang sama, dan bukan pula
sebagai nilai nol.

Hal yang sama berlaku untuk nilai bertanda `"s"` (sakit) di sheet mapel:
tersimpan sebagai kosong, tidak pernah sebagai 0.

---

## Ringkasan urutan pengerjaan

| # | Perbaikan | Prioritas |
|---|---|---|
| 1 | Tarik rumus `N2` ke `N3:N301` (Capaian Tahfidz) | Wajib sebelum sync |
| 2 | Isi NIS Kelas 1 | Wajib sebelum sync |
| 3 | Ubah `$100` → `$994` pada rumus rata-rata | Wajib sebelum sync |
| 5 | Target 2A & 2B jadi angka | Wajib sebelum sync |
| 9 | Isi `users_access` | Wajib sebelum login guru |
| 4 | Perlebar blok bulan jadi 30 baris | Sebelum ada siswa baru |
| 6 | Dropdown nama di `Grafik Siswa` | Kapan saja |
| 7 | Target 3 Mapel jadi rujukan sel | Kapan saja |
| 9 | Isi kolom `No WA` | Sebelum kirim link ke orang tua |

Setelah nomor 1, 2, 3, dan 5 selesai, jalankan menu
**SiPaDi → Cek Kesehatan Data** di Master Rekap. Menu itu membaca semua file
kelas dan melaporkan sisa masalah tanpa mengirim apa pun ke database.
