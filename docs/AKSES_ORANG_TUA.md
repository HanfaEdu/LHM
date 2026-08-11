# Menerbitkan Tautan Rapor untuk Orang Tua

Setiap siswa mendapat satu tautan pribadi berisi token acak:

```
https://<domain-anda>/rapor/<token>
```

Tautan dikirim sekali lewat WhatsApp. Orang tua tidak perlu membuat akun,
tidak perlu Gmail, dan tidak ada kata sandi yang bisa lupa. Sebagai lapis
kedua, halaman meminta **6 digit terakhir nomor WhatsApp** sebagai PIN.

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

## Memasang PIN

PIN disimpan sebagai `sha256(pin || ':' || token)`, tidak pernah sebagai
teks polos. Rumusnya harus sama persis dengan yang dipakai di
`app/api/rapor/route.js`.

Setelah kolom `No WA` di spreadsheet terisi dan tersinkron, PIN dapat
dibuat massal dari 6 digit terakhir nomor tersebut:

```sql
UPDATE akses_ortu
SET pin_hash = encode(
        digest(right(regexp_replace(no_wa, '\D', '', 'g'), 6) || ':' || token, 'sha256'),
        'hex')
WHERE no_wa IS NOT NULL
  AND length(regexp_replace(no_wa, '\D', '', 'g')) >= 6;
```

Siswa yang `pin_hash`-nya `NULL` dapat dibuka dengan token saja, tanpa PIN.
Itu berguna untuk masa uji coba, tetapi sebaiknya tidak dibiarkan permanen.

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

Menonaktifkan akses satu siswa:

```sql
UPDATE akses_ortu SET aktif = FALSE WHERE nis = '302';
```

Menerbitkan token baru (tautan lama langsung mati):

```sql
UPDATE akses_ortu
SET token = encode(gen_random_bytes(24), 'hex'), pin_hash = NULL
WHERE nis = '302';
```

Setelah mengganti token, PIN wajib dipasang ulang karena hash-nya
mengandung token.

## Catatan keamanan

- Token adalah 24 byte acak (48 karakter heksadesimal). Menebaknya secara
  acak tidak realistis.
- Respons untuk token tidak dikenal, token nonaktif, dan PIN salah dibuat
  identik, supaya tidak bisa dipakai menebak token yang valid.
- Siapa pun yang memegang tautan **dan** PIN dapat melihat data anak
  tersebut. Ingatkan orang tua untuk tidak meneruskan tautannya ke grup.
- Nama teman sekelas tidak pernah dikirim ke browser. Penyamaran terjadi di
  server, sebelum data meninggalkan `app/api/rapor/route.js`.
