# Menerbitkan Tautan Rapor untuk Orang Tua

Setiap siswa mendapat satu tautan pribadi berisi token acak:

```
https://<domain-anda>/rapor/<token>
```

Tautan dikirim sekali lewat WhatsApp. Orang tua tidak perlu membuat akun,
tidak perlu Gmail, dan tidak ada kata sandi yang bisa lupa.

**Default: token saja, tanpa PIN.** Token 24-byte acak (48 karakter) sudah
berfungsi sebagai identitas sekaligus kredensial — pola yang sama dengan
link berbagi Google Docs atau Notion. Menebaknya secara acak tidak
realistis (2^192 kemungkinan). PIN tetap tersedia sebagai opsi per-siswa
kalau suatu saat dibutuhkan (lihat bagian bawah), tapi tidak wajib.

## Menerbitkan token

Jalankan di Supabase SQL Editor. Aktifkan `pgcrypto` sekali saja:

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;
```

Lalu terbitkan token untuk seluruh siswa yang belum punya:

```sql
INSERT INTO akses_ortu (nis, token, no_wa)
SELECT s.nis,
       encode(gen_random_bytes(24), 'hex'),   -- token 48 karakter
       NULL
FROM siswa s
WHERE NOT EXISTS (
    SELECT 1 FROM akses_ortu a WHERE a.nis = s.nis
);
```

Selesai — `pin_hash` dibiarkan `NULL`, jadi tautan langsung terbuka begitu
diklik, tanpa diminta apa pun lagi.

## Mengambil daftar tautan untuk dikirim

```sql
SELECT s.nama_lengkap,
       a.no_wa,
       'https://<domain-anda>/rapor/' || a.token AS tautan
FROM akses_ortu a
JOIN siswa s ON s.nis = a.nis
JOIN penempatan p ON p.nis = s.nis
JOIN kelas k ON k.id = p.kelas_id
WHERE a.aktif AND k.tahun_ajaran = '2026-2027'
ORDER BY k.nama_kelas, s.nama_lengkap;
```

Hasilnya bisa disalin ke Google Sheets untuk dikirim massal.

## Mencabut atau mengganti tautan

Ini katup pengaman utama pengganti PIN: kalau sebuah tautan ternyata
tersebar ke tempat yang tidak seharusnya (diteruskan ke grup, HP hilang,
dll), matikan atau ganti tokennya — tautan lama langsung berhenti berfungsi.

Menonaktifkan akses satu siswa:

```sql
UPDATE akses_ortu SET aktif = FALSE WHERE nis = '302';
```

Menerbitkan token baru (tautan lama langsung mati, kirim ulang yang baru):

```sql
UPDATE akses_ortu
SET token = encode(gen_random_bytes(24), 'hex'), pin_hash = NULL
WHERE nis = '302';
```

## Memasang PIN untuk siswa tertentu (opsional)

Kalau untuk satu-dua siswa dirasa perlu lapisan tambahan (mis. orang tua
sendiri yang minta), PIN bisa dipasang khusus untuk siswa itu. PIN
disimpan sebagai `sha256(pin || ':' || token)`, tidak pernah sebagai teks
polos — rumusnya harus sama persis dengan `app/api/rapor/route.js`.

```sql
UPDATE akses_ortu
SET pin_hash = encode(digest('123456' || ':' || token, 'sha256'), 'hex')
WHERE nis = '302';
```

Kalau ingin memakai 6 digit terakhir nomor WA sebagai PIN massal (bukan
default, tapi tersedia bila kebijakan sekolah berubah):

```sql
UPDATE akses_ortu
SET pin_hash = encode(
        digest(right(regexp_replace(no_wa, '\D', '', 'g'), 6) || ':' || token, 'sha256'),
        'hex')
WHERE no_wa IS NOT NULL
  AND length(regexp_replace(no_wa, '\D', '', 'g')) >= 6;
```

Catatan kalau memilih ini: PIN yang berasal dari nomor WA yang sama dengan
tempat link dikirim tidak banyak menambah perlindungan terhadap kebocoran
paling realistis (HP dipakai bergantian di rumah) — siapa pun yang punya
akses ke chat itu biasanya juga tahu nomornya. PIN lebih berarti kalau
diisi dengan sesuatu yang **tidak** ada di percakapan yang sama, mis.
tanggal lahir anak.

Setelah mengganti token, PIN wajib dipasang ulang karena hash-nya
mengandung token.

## Catatan keamanan

- Token adalah 24 byte acak (48 karakter heksadesimal) — sudah cukup kuat
  sebagai satu-satunya kredensial untuk data serapor ini (nilai akademik,
  bukan data finansial/kesehatan).
- Respons untuk token tidak dikenal, token nonaktif, dan PIN salah (kalau
  dipasang) dibuat identik, supaya tidak bisa dipakai menebak token yang
  valid.
- Tautan ini berlaku selama setahun penuh di chat WhatsApp — jauh lebih
  lama daripada link login sekali pakai. Siapa pun yang memegang tautan
  dapat melihat data anak tersebut selama itu; katup pengamannya adalah
  mencabut/mengganti token (lihat di atas), bukan menghafal PIN.
- Nama teman sekelas tidak pernah dikirim ke browser. Penyamaran terjadi di
  server, sebelum data meninggalkan `app/api/rapor/route.js`.
