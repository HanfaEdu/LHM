# SiPaDi — Sistem Rapor Digital

Web app untuk menyajikan capaian akademik (B. Indonesia, Matematika, IPA)
serta Tahfidz & Tahsin secara personal kepada orang tua, wali kelas, dan
kepala sekolah. SD Yaumi Fatimah Kudus.

## Alur data

```
File kelas x7 (Google Sheets)   <- wali kelas input di sini, tidak berubah
        |  IMPORTRANGE (per kelas, sudah dipasang di tiap file)
        v
Master Rekap - Sheet1           <- gabungan 7 kelas, kolom "Kelas" per baris
        |  Apps Script, baca 1 sheet, pemicu tengah malam
        v
     Supabase (Postgres)        <- riwayat lintas tahun, RLS
        |
        |  Next.js Route Handler (anonimisasi nama teman sekelas)
        v
   Dashboard (Vercel)           <- orang tua / wali kelas / kepala sekolah
```

Input tetap di Google Sheets. Supabase hanya menjadi cermin baca-saja yang
diperbarui tiap malam. Apps Script membaca **satu sheet saja** (`Sheet1` di
Master Rekap) — setiap baris sudah membawa kolom "Kelas" sendiri lewat
IMPORTRANGE, jadi GAS tidak perlu tahu batas antar-blok atau membuka 7 file
satu-satu. Konsekuensinya, `sync.js` memvalidasi bahwa ketujuh kelas selalu
muncul dengan jumlah siswa wajar — kalau otorisasi IMPORTRANGE salah satu
file kelas putus, itu akan diam-diam kosong tanpa validasi ini.

## Isi repositori

| Berkas | Keterangan |
|---|---|
| `schema.sql` | Skema Supabase. Jalankan di SQL Editor, aman diulang. |
| `sync.js` | Google Apps Script. Dipasang di file Master Rekap. |
| `quran_mapping.js` | Peta poin → nama surah (Tahfidz) & bab materi (Tahsin). |
| `app/rapor/[token]/` | Dashboard orang tua (tautan pribadi, tanpa login). |
| `app/api/rapor/` | Endpoint server: verifikasi token (PIN opsional) + penyamaran nama sekelas. |
| `docs/PERBAIKAN_SPREADSHEET.md` | Audit rumus + daftar perbaikan sebelum sync pertama. |
| `docs/AKSES_ORANG_TUA.md` | Cara menerbitkan tautan untuk orang tua (token saja secara default). |

## Urutan penyiapan

1. Bereskan temuan di `docs/PERBAIKAN_SPREADSHEET.md` (nomor 1, 2, 3, 5).
2. Jalankan `schema.sql` di Supabase SQL Editor.
3. Pasang `sync.js` di Apps Script file Master Rekap, isi konfigurasi di
   bagian atas berkas.
4. Jalankan menu **SiPaDi → Cek Kesehatan Data** untuk memastikan bersih.
5. Jalankan **SiPaDi → Sinkronkan Sekarang**, lalu pasang pemicu harian.
6. Isi variabel lingkungan Vercel: `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, dan `SUPABASE_SERVICE_ROLE_KEY`
   (service role hanya dipakai di sisi server, tidak pernah di browser).

## Catatan penting soal data

- **Poin Al-Qur'an disimpan sebagai angka, bukan nama.** Nama materi Tahsin
  berulang (Mad Asli = bab 7, 8, dan 9), sehingga nama tidak bisa dipulihkan
  menjadi angka.
- **Kosong bukan nol.** Nilai `"s"` (sakit) dan bulan yang belum dinilai
  disimpan sebagai `NULL`, dan digambar sebagai garis terputus di grafik.
- **Bulan diurutkan menurut tahun ajaran** (Juli = 1 … Juni = 12) lewat
  kolom `urutan_bulan`, bukan menurut kalender atau abjad.
