# Layanan WhatsApp untuk Orang Tua

Orang tua mengirim pesan **apa pun** ke nomor WhatsApp sekolah. Sistem
mengenali nomor pengirimnya sebagai orang tua siswa tertentu, lalu
membalas dengan tautan rapor anaknya sendiri.

```
Orang tua  ──WhatsApp──►  Nomor sekolah (perangkat Fonnte)
                                │  webhook
                                ▼
                     /api/wa  di Vercel
                                │  cocokkan nomor pengirim
                                ▼
                  siswa.wa_normal ──► akses_ortu.token
                                │
                                ▼
Orang tua  ◄──WhatsApp──  balasan berisi tautan rapor
```

Tautan yang dikirim adalah tautan yang **sudah ada** — yang sama dengan
yang diterbitkan kepala sekolah di halaman *Tautan Orang Tua*. Layanan ini
tidak membuat token baru dan tidak mengubah apa pun; ia hanya membuat
tautan itu bisa diminta lagi kapan saja tanpa menghubungi wali kelas.

## Kenapa nomor pengirim, bukan isi pesan

Percobaan sebelumnya meminta orang tua mengetik `Nama-Kelas`
(mis. `Faisal-3`), lalu mencocokkannya ke daftar. Cara itu punya dua cacat
yang tidak bisa ditambal dengan kalimat yang lebih baik:

1. **Bukan pengamanan sama sekali.** Nama dan kelas seorang siswa
   diketahui seluruh wali murid sekelas. Siapa pun bisa meminta tautan
   rapor anak orang lain dari nomor mana pun.
2. **Gagal untuk hampir semua orang.** `Faisal-3`, `faisal 3`,
   `Muhammad Faisal-3`, dan `Faisal kelas 3` adalah empat hal berbeda bagi
   mesin, dan yang diterima hanya yang persis sama dengan isi sel.

Nomor pengirim tidak punya dua masalah itu: ia diverifikasi WhatsApp
sendiri, tidak bisa salah ketik, dan sudah tercatat di kolom "No WA" Master
Rekap sejak awal. Karena itu **isi pesannya tidak dibaca sama sekali** —
"assalamu'alaikum", "p", dan stiker sama-sama dijawab dengan benar.

Konsekuensi yang perlu diketahui: balasan hanya sebaik isi kolom "No WA".
Jalankan **SiPaDi → Cek Kesehatan Data** di Master Rekap; ia menyebutkan
siswa mana yang kolomnya masih kosong atau isinya bukan nomor HP.

## Penyiapan

### 1. Jalankan migrasi

Supabase → SQL Editor → tempel isi `migrasi/003-layanan-wa.sql` → Run.

### 2. Perbarui `sync.js` di Apps Script, lalu sinkronkan

Tempel ulang seluruh isi `sync.js` versi ini (yang lama membaca kolom
"No WA" tetapi tidak pernah mengirimkannya), lalu jalankan
**SiPaDi → Sinkronkan Sekarang**.

> Urutannya penting. `sync.js` versi ini mengirim kolom `no_wa`, dan
> kolom itu baru ada setelah migrasi dijalankan. Kalau terbalik,
> sinkronisasi berhenti dengan pesan yang menyebutkan migrasi ini.

Memastikan nomornya benar-benar masuk:

```sql
SELECT count(*) FILTER (WHERE cardinality(wa_normal) > 0) AS punya_wa,
       count(*)                                          AS total
FROM   siswa;
```

### 3. Daftarkan nomor perangkat sekolah

```sql
UPDATE sekolah SET wa_pengirim = '628123456789' WHERE kode = 'SDYFK';
```

Boleh dilewati selama baru satu sekolah yang memakai layanan ini. Begitu
sekolah kedua bergabung, kolom ini **wajib** diisi keduanya: dialah yang
memisahkan pesan yang masuk ke nomor Kudus dari yang masuk ke nomor Pati.

### 4. Isi variabel lingkungan di Vercel

| Variabel | Isi |
|---|---|
| `FONNTE_TOKEN` | Token perangkat dari dasbor Fonnte |
| `WA_WEBHOOK_SECRET` | String acak buatan sendiri, mis. hasil `openssl rand -hex 16` |

Redeploy setelah diisi.

Kalau sekolah kedua memakai perangkat Fonnte sendiri, tambahkan
`FONNTE_TOKEN_<KODE_SEKOLAH>` — mis. `FONNTE_TOKEN_SDYFP`. Sistem memilih
token menurut sekolah pemilik nomor tujuan, dan jatuh ke `FONNTE_TOKEN`
kalau tidak ada. Token perangkat sengaja tidak disimpan di database:
kredensial tidak perlu ikut tercadangkan bersama data siswa.

### 5. Pasang webhook di Fonnte

Dasbor Fonnte → perangkat → **Webhook URL**:

```
https://<domain-anda>/api/wa?kunci=<isi WA_WEBHOOK_SECRET>
```

Memastikan alamatnya benar — buka di peramban, harus menjawab
`Layanan WhatsApp SiPaDi aktif.`:

```
https://<domain-anda>/api/wa
```

### 6. Coba dari HP

Kirim pesan apa saja dari nomor orang tua yang terdaftar. Balasannya
datang dalam beberapa detik.

## Yang dijawab sistem

| Keadaan | Balasan |
|---|---|
| Nomor cocok, tautan aktif | Tautan rapor tiap anak yang cocok |
| Nomor cocok, tautan belum diterbitkan | "Data Ananda sudah kami temukan, tautannya belum diterbitkan" |
| Nomor tidak dikenali | Diarahkan ke wali kelas untuk memperbarui nomor |
| Pesan dari grup | **Tidak dibalas sama sekali** |
| Lebih dari 8 pesan/jam dari satu nomor | Tidak dibalas |

Orang tua dengan **dua anak** di sekolah yang sama menerima kedua
tautannya dalam satu balasan.

Pesan grup sengaja tidak pernah dibalas: tautan rapor bersifat pribadi,
dan membalasnya ke grup wali murid berarti mengirimkannya ke seluruh
anggota grup sekaligus.

## Catatan keamanan

- **Balasan selalu ke nomor pengirim yang sudah dicocokkan**, tidak pernah
  ke nomor mana pun yang ikut dalam badan permintaan. Jadi sekalipun
  webhook dipanggil orang lain dengan data palsu, tautan yang terkirim
  mendarat di WhatsApp orang tua yang sebenarnya — bukan di tangan
  pemalsunya.
- `WA_WEBHOOK_SECRET` tetap wajib, tetapi perannya adalah mencegah
  penyalahgunaan kuota dan pesan sampah — bukan menjadi satu-satunya
  penjaga kerahasiaan tautan.
- Isi pesan orang tua **tidak disimpan**. Tabel `wa_pesan` hanya mencatat
  nomor pengirim, waktu, dan jenis jawabannya. Layanan ini memang tidak
  membaca isi pesan, jadi menyimpannya hanya menumpuk percakapan pribadi
  tanpa satu pun kegunaan.
- Nomor WA yang berganti tangan (nomor lama dipakai orang lain) menjadi
  risiko baru yang tidak ada sebelumnya: pemilik barunya akan menerima
  tautan bila mengirim pesan. Katup pengamannya sama seperti sebelumnya —
  perbarui kolom "No WA" di Master Rekap, dan ganti tokennya lewat halaman
  *Tautan Orang Tua* bila perlu.

## Kalau tidak ada balasan

Periksa berurutan:

1. **Webhook sampai?** Dasbor Fonnte punya riwayat pengiriman webhook.
   403/401 berarti `kunci` di URL tidak sama dengan `WA_WEBHOOK_SECRET`.
2. **Nomornya dikenali?**

   ```sql
   SELECT nis, nama_lengkap, no_wa, wa_normal FROM siswa
   WHERE  wa_normal @> ARRAY['6281234567890'];
   ```

   Kosong berarti kolom "No WA" siswa itu belum terisi atau isinya bukan
   nomor HP — betulkan di Master Rekap, lalu sinkronkan ulang.
3. **Pesannya tercatat?**

   ```sql
   SELECT dibuat_pada, pengirim, hasil, jumlah_anak
   FROM   wa_pesan ORDER BY dibuat_pada DESC LIMIT 20;
   ```

   `gagal_kirim` menunjuk ke Fonnte (kuota habis, perangkat terputus,
   token salah), bukan ke pencocokan data. `dibatasi` berarti nomor itu
   sudah melewati 8 pesan dalam sejam terakhir.

## Pengujian

```
node scripts/uji-layanan-wa.mjs          # pembakuan nomor, isi balasan, sync.js
npx next build                           # sekali, sebelum pengujian di bawah
node scripts/uji-layanan-wa-server.mjs   # /api/wa dari ujung ke ujung
```

Keduanya memakai Supabase dan Fonnte tiruan di localhost — tidak ada
WhatsApp yang benar-benar dikirim.
