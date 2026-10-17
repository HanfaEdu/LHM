# Pindah akun: dari belajar.id ke akun Google pribadi

Panduan ini dipakai ketika file SiPaGi harus pindah pemilik. Kasus yang memicunya adalah kuota penyimpanan **organisasi** belajar.id yang penuh. Banner di Drive tertulis *"Organisasi Anda telah melampaui batas penyimpanan Google Workspace"*. Akibatnya semua file milik akun belajar.id hanya bisa dibaca, dan wali kelas tidak bisa mengisi nilai. Menghapus file milik sendiri tidak membantu, karena yang penuh adalah kuota bersama seluruh organisasi.

Kepemilikan file tidak bisa dipindah ke domain lain, jadi file harus **disalin**. Salinan mendapat ID baru, sehingga IMPORTRANGE di Master Rekap ikut putus. `PindahAkun.gs` menyalin semua file sekaligus lalu mengganti ID lama dengan ID baru di semua rumus.

## Yang TIDAK berubah

- **Supabase, dasbor, tautan rapor orang tua, dan layanan WA** tidak berubah. Semuanya diikat ke `KODE_SEKOLAH`, bukan ke ID file. Syaratnya, `KODE_SEKOLAH` di skrip sinkron salinan **jangan diubah**.
- **File sumber** tidak diubah. Skrip hanya membacanya, jadi kalau ada yang salah, file lama masih utuh.

## Langkah

### 1. Siapkan akses (dari akun belajar.id)

Bagikan folder tiap sekolah (atau file Master Rekap dan semua file kelasnya) ke akun pribadi sebagai **Editor**. Status Editor diperlukan supaya daftar orang yang diberi akses bisa ikut disalin.

Sebelum menyalin, catat dulu dari editor Apps Script **tiap Master Rekap**:
- isi properti skrip `FONNTE_TOKEN` di Setelan Proyek → Properti skrip. Properti skrip tidak ikut tersalin.
- pemicu yang terpasang beserta jadwalnya, misalnya `sinkronkanSemua` tiap 6 jam dan `kirimPengingatWaliKelas` tanggal 28. Pemicu juga tidak ikut tersalin.

### 2. Jalankan skrip pemindah (di akun pribadi)

1. Buka script.google.com, lalu buat **Proyek baru**. Tempel seluruh isi `PindahAkun.gs`.
2. Isi `DAFTAR_SUMBER` dengan tautan folder/file dari langkah 1. Semua sekolah boleh dimasukkan sekaligus.
3. Jalankan `jalankanPindah` dan setujui izinnya.
4. Buka tautan **Log Pindah Akun SiPaGi** yang muncul di Log eksekusi. Batas eksekusi akun pribadi 6 menit, jadi skrip berhenti sendiri sebelum batas itu dan melanjutkan otomatis semenit kemudian. Tidak perlu ditunggui. Tunggu sampai Log eksekusi terakhir menulis `SELESAI`.

   Tahapan skrip: inventaris → salin → ganti ID di rumus → izin IMPORTRANGE → samakan pembagian akses.
5. Jalankan `periksaHasil`, lalu baca sheet **Periksa**. Isi yang mungkin muncul:
   - *Menunjuk file yang tidak ikut disalin*: ada file kelas yang belum masuk `DAFTAR_SUMBER`. Tambahkan, lalu jalankan `ulangiDariInventaris` dan `jalankanPindah`. File yang sudah tersalin tidak disalin dua kali.
   - *IMPORTRANGE menampilkan #REF!*: izin otomatis gagal. Buka Master Rekap salinan, klik sel itu, lalu klik **Izinkan akses**. Ini sekali per file kelas. Pemberian izin otomatis memakai jalur yang tidak didokumentasikan Google, jadi cara manual ini selalu menjadi cadangan.

### 3. Hidupkan lagi sinkronisasi (tiap Master Rekap salinan)

Skrip sinkron (`sync.js` / `sync-pg.js`) ikut tersalin di dalam Master Rekap, beserta `APP_URL`, `SYNC_SECRET`, dan `KODE_SEKOLAH`-nya.

1. Buka Master Rekap salinan, lalu **Ekstensi → Apps Script**.
2. Isi lagi properti skrip `FONNTE_TOKEN` kalau sekolah itu memakai pengingat WA.
3. Jalankan **SiPaGi → Cek Kesehatan Data**. Langkah ini memastikan semua kelas terbaca lewat IMPORTRANGE yang baru.
4. Jalankan **SiPaGi → Sinkronkan Sekarang**, lalu pasang lagi pemicunya.
5. **Matikan pemicu di Master Rekap LAMA**, supaya dua file tidak bergantian menyinkronkan data yang berbeda.

### 4. Beri tahu wali kelas

Wali kelas mengisi di **salinan**, bukan file lama. Kirim tautan baru dari kolom *Tautan Salinan* di log. Supaya file lama tidak terisi tanpa sengaja, ubah akses file lama menjadi Pembaca saja.

## Batas akun Google pribadi yang relevan

| Batas | Nilai | Dampak ke SiPaGi |
|---|---|---|
| Lama satu eksekusi | 6 menit | Satu kali sinkron hanya membaca satu sheet, selesai dalam hitungan detik. Aman. |
| Total waktu jalan pemicu | 90 menit per hari per akun | Dihitung dari **semua** sekolah. Lihat durasi di ringkasan sinkron ("Selesai dalam N detik"). Contoh: 20 sekolah × 4 kali sehari × 30 detik = 40 menit, masih aman. |
| Penyimpanan | 15 GB, dibagi dengan Gmail dan Foto | File Sheets hampir tidak memakai kuota. |
| Pengingat WA tanggal 28 | jeda 3 detik per pesan | Hanya dikirim ke wali kelas, beberapa pesan per sekolah. Aman. |
