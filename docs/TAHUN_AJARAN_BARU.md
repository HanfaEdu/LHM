# Naik Tahun Ajaran

Yang perlu disiapkan tiap awal tahun ajaran, dan apa yang **tidak** perlu
disentuh sama sekali.

## Yang berubah tiap tahun: file spreadsheet

Ya, polanya sama seperti tahun ini:

1. Buat 7 file kelas baru (salin dari file tahun sebelumnya, lalu kosongkan
   isinya). Isi blok identitas di tiap file: **Kelas**, **Wali Kelas**, dan
   **Tahun** dengan tahun ajaran yang sedang berjalan, mis. `2027-2028`.
2. Buat file **Master Rekap** baru, pasang IMPORTRANGE ke ketujuh file kelas
   yang baru, dan otorisasi ketujuhnya.
3. Pasang `sync.js` di Apps Script file Master Rekap yang baru, isi `APP_URL`
   dan `SYNC_SECRET` sama persis seperti tahun sebelumnya.
4. Pasang pemicu harian di file yang baru, dan **matikan pemicu di file
   Master Rekap tahun lama** — kalau dibiarkan, keduanya akan sinkron
   bergantian dan data tahun lama ikut ditulis ulang tanpa perlu.

Kolom **Tahun** inilah yang menentukan segalanya. Selama isinya benar, data
tahun baru masuk sebagai baris `kelas` yang terpisah, bukan menimpa tahun
lama.

## Yang tidak berubah: database dan aplikasi

Tidak ada yang perlu diubah di Supabase maupun di kode. Skema sudah
dirancang untuk menyimpan banyak tahun sekaligus:

- Tabel `kelas` berkunci unik `(tahun_ajaran, nama_kelas)`. "Kelas 2A
  2026-2027" dan "Kelas 2A 2027-2028" adalah dua baris berbeda dengan wali
  kelas dan target masing-masing.
- Tabel `penempatan` menghubungkan siswa ke kelas **per tahun**. Siswa yang
  sama naik dari 1 → 2A → 3 tanpa datanya digandakan, dan riwayatnya utuh.
- Tabel `nilai_bulanan` menyimpan `kelas_id`, bukan nama kelas. Nilai kelas 2
  tahun lalu tetap melekat pada kelas 2 tahun lalu walau anaknya sekarang
  sudah kelas 3.

## Yang tidak perlu diulang: tautan orang tua

**Token orang tua tidak perlu diterbitkan ulang tiap tahun.** Token melekat
pada NIS siswa, bukan pada kelas atau tahun ajaran. Tautan WhatsApp yang
dikirim di tahun pertama tetap berfungsi di tahun-tahun berikutnya, dan
otomatis menampilkan kelas terbaru anak tersebut.

Token baru hanya perlu diterbitkan untuk **siswa baru** (lihat
`docs/AKSES_ORANG_TUA.md`) — query di sana memang hanya membuat token bagi
siswa yang belum punya, jadi aman dijalankan ulang tiap tahun.

## Yang dilihat orang tua

Di kepala halaman rapor ada keterangan **Tahun Ajaran**. Selama baru ada
satu tahun, itu tampil sebagai teks biasa. Begitu siswa punya data di lebih
dari satu tahun, kolom itu berubah sendiri menjadi menu pilihan — orang tua
bisa menengok capaian tahun-tahun sebelumnya, lengkap dengan nama kelas dan
wali kelas yang berlaku saat itu. Tidak ada yang perlu diaktifkan; ini
mengikuti isi data.

Perbandingan "Posisi di Kelas" juga ikut tahun yang dipilih: teman sekelas
yang ditampilkan adalah teman sekelas **pada tahun itu**, bukan teman
sekelas sekarang.
