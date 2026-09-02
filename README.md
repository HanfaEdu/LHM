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
| `app/api/wa/` | Webhook WhatsApp: mengenali nomor pengirim, membalas tautan rapor anaknya. |
| `migrasi/` | Perubahan skema susulan. Dijalankan berurutan, sekali masing-masing. |
| `docs/PERBAIKAN_SPREADSHEET.md` | Audit rumus + daftar perbaikan sebelum sync pertama. |
| `docs/AKSES_ORANG_TUA.md` | Cara menerbitkan tautan untuk orang tua (token saja secara default). |
| `docs/LAYANAN_WA.md` | Layanan WhatsApp: orang tua meminta ulang tautan rapor lewat chat. |
| `docs/TAHUN_AJARAN_BARU.md` | Yang disiapkan tiap naik tahun ajaran — dan yang tidak perlu disentuh. |

## Urutan penyiapan

1. Bereskan temuan di `docs/PERBAIKAN_SPREADSHEET.md` (nomor 1, 2, 3, 5).
2. Jalankan `schema.sql` di Supabase SQL Editor.
3. Isi variabel lingkungan Vercel: `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (kunci
   `secret`/`service_role`, dipakai server saja), dan `SYNC_SHARED_SECRET`
   (string acak buatan sendiri — kunci rahasia khusus antara GAS dan
   endpoint `/api/sync`, **bukan** kunci Supabase). Redeploy setelah diisi.
4. Pasang `sync.js` di Apps Script file Master Rekap, isi `APP_URL`
   (domain Vercel Anda) dan `SYNC_SECRET` (samakan persis dengan
   `SYNC_SHARED_SECRET` di langkah 3) di bagian atas berkas.
5. Jalankan menu **SiPaDi → Cek Kesehatan Data** untuk memastikan bersih.
6. Jalankan **SiPaDi → Sinkronkan Sekarang**, lalu pasang pemicu harian.
7. Jalankan berkas di `migrasi/` secara berurutan di Supabase SQL Editor.
8. Opsional — hidupkan layanan WhatsApp: `docs/LAYANAN_WA.md`.

**Kenapa GAS tidak bicara langsung ke Supabase:** Supabase memblokir
kunci `sb_secret_...` kalau permintaan terdeteksi berasal dari browser,
dan `UrlFetchApp` Apps Script ikut ter-deteksi begitu walau jelas
berjalan di server Google. `app/api/sync/route.js` jadi jembatan — GAS
memanggil endpoint itu (pakai `SYNC_SHARED_SECRET`, bukan kunci
Supabase), lalu endpoint itu sendiri (berjalan di server Vercel) yang
benar-benar bicara ke Supabase.

## Catatan penting soal data

- **Poin Al-Qur'an disimpan sebagai angka, bukan nama.** Nama materi Tahsin
  berulang (Mad Asli = bab 7, 8, dan 9), sehingga nama tidak bisa dipulihkan
  menjadi angka.
- **Kosong bukan nol.** Nilai `"s"` (sakit) dan bulan yang belum dinilai
  disimpan sebagai `NULL`, dan digambar sebagai garis terputus di grafik.
- **Bulan diurutkan menurut tahun ajaran** (Juli = 1 … Juni = 12) lewat
  kolom `urutan_bulan`, bukan menurut kalender atau abjad.
- **Nomor WA dibakukan di satu tempat saja** (`lib/nomor-wa.js`), dipakai
  baik saat menyimpan maupun saat mencocokkan pesan masuk. Aturan yang
  punya dua salinan akan menyimpang, dan simpangannya muncul sebagai
  orang tua yang tidak dikenali — tanpa satu pun pesan galat.
