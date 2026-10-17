# Asisten Data

Halaman tanya-jawab di `/dashboard/asisten`. Kepala sekolah, biro akademik,
atau wali kelas mengetik pertanyaan dengan bahasa biasa; asisten mencari
angkanya, menggambar grafiknya, lalu menjawab — dan setiap langkah
pencariannya terlihat di panel Proses.

## Yang harus disiapkan sekali

Asisten memerlukan satu variabel lingkungan baru, `ANTHROPIC_API_KEY`.
Tanpa itu halamannya tetap terbuka, tetapi setiap pertanyaan dijawab
dengan pesan bahwa kuncinya belum diatur.

### 1. Buat kunci di Anthropic

1. Buka <https://console.anthropic.com> dan masuk. **Ini akun terpisah dari
   langganan Claude biasa** — langganan Pro/Max di claude.ai TIDAK
   memberi saldo API, dan sebaliknya.
2. Isi saldo lebih dulu: **Plans & Billing → Buy credits**. Kunci yang
   dibuat tanpa saldo akan ditolak begitu dipakai.
3. Masuk ke **Settings → API keys → Create Key**. Beri nama, misalnya
   `lhm-asisten`.
4. Salin kuncinya sekarang juga. Kunci hanya diperlihatkan **satu kali**;
   kalau tertutup, kunci itu tidak bisa dilihat lagi dan harus dibuat ulang.
   Bentuknya `sk-ant-api03-…`.

### 2. Pasang di Vercel

1. Buka proyek `lhm` di Vercel → **Settings → Environment Variables**.
2. Tambah variabel:
   - Name: `ANTHROPIC_API_KEY`
   - Value: kunci yang tadi disalin
   - Environments: centang **Production, Preview, dan Development**
     ketiganya. Variabel yang hanya aktif di Production membuat setiap
     preview deployment menjawab "kunci belum diatur", dan penyebabnya
     sulit ditebak dari pesannya.
3. **Redeploy.** Variabel lingkungan baru hanya terbaca oleh deployment
   yang dibuat setelahnya — deployment lama tetap tidak melihatnya.

Kunci ini **tidak** berawalan `NEXT_PUBLIC_`, jadi Next.js tidak akan
pernah menyertakannya ke dalam bundel yang dikirim ke peramban. Halaman
asisten berbicara ke `/api/asisten`, bukan langsung ke Anthropic.

### 3. Coba

Buka `/dashboard/asisten` (ada tombol **Asisten Data** di kepala dasbor
kepala sekolah) lalu klik salah satu pertanyaan usulan.

## Biaya

Tiap pertanyaan memanggil model beberapa kali — sekali untuk memutuskan
alat mana yang dipakai, sekali lagi setelah angkanya kembali, dan
seterusnya sampai cukup. Pantau pemakaiannya di Console → Usage, dan
pasang **spend limit** di Plans & Billing kalau ingin batas keras.

Instruksi sistem diberi `cache_control`, jadi bagian tetapnya dibaca dari
cache pada pertanyaan kedua dan seterusnya dalam satu percakapan — itu
memotong sebagian besar biaya token masukan.

## Apa yang boleh dilihat siapa

Wewenang ditegakkan di server, di `lib/asisten/konteks.js`, **bukan** di
prompt. Ini penting: endpoint asisten memakai `service_role`, yang
melewati seluruh RLS, persis seperti `/api/tautan`.

| Peran | Yang dimuat |
|---|---|
| `kepala_sekolah` | seluruh kelas di sekolahnya |
| `direktur_area` | seluruh sekolah di areanya, disaring `cakupan_jenjang` |
| `wali_kelas` | hanya kelasnya sendiri |

Data di luar cakupan tidak pernah dimuat ke memori, jadi tidak ada yang
bisa dibujuk keluar lewat susunan kalimat pertanyaan.

## Kenapa angkanya selalu sama dengan dasbor

Alat-alat asisten di `lib/asisten/perkakas.js` memanggil fungsi yang sama
persis dari `lib/statistik.js` yang dipakai dasbor — `ketuntasan()`,
`rekapQuran()`, `distribusi()`, `peringatanDini()`, `narasiKelas()`.
Asisten tidak pernah menghitung sendiri.

Kalau rumusnya diubah, keduanya berubah bersamaan. Itu disengaja:
asisten yang menghitung sendiri cepat atau lambat akan menjawab
"ketuntasan Matematika 87%" sementara dasbor di layar sebelah menulis
91%, dan tidak akan ada yang tahu mana yang benar.

## Berkas

```
app/dashboard/asisten/page.jsx            anjungan (HUD) — panel Proses, Visual, kotak tanya
app/dashboard/asisten/Grafik.jsx          penggambar SVG (batang, selisih, dumbbell, garis, sebar)
app/dashboard/asisten/asisten.module.css  gaya + animasi, patuh prefers-reduced-motion
app/api/asisten/route.js                  endpoint SSE: wewenang → loop alat → aliran jawaban
lib/asisten/konteks.js                    pemeriksaan wewenang + pemuatan data sesuai cakupan
lib/asisten/perkakas.js                   definisi & pelaksana alat, memakai lib/statistik.js
```

## Catatan teknis

- **Model**: `claude-opus-5`, penalaran adaptif dengan ringkasan
  ditampilkan (itulah isi panel "Ringkasan penalaran"), `effort: medium`.
- **Fallback sisi server** diaktifkan lewat konstanta `PAKAI_FALLBACK` di
  `app/api/asisten/route.js`: kalau satu permintaan ditolak penyaring
  keamanan model, Anthropic mengalihkannya ke model lain alih-alih
  mengembalikan jawaban kosong. Kalau organisasimu belum mendapat akses
  fitur beta itu dan muncul galat 400 yang menyebut `beta`/`fallback`,
  ubah konstanta itu menjadi `false`.
- **Batas putaran** 8 kali panggil-alat per pertanyaan, supaya satu
  pertanyaan tidak berputar tanpa henti.
- **Jawaban dialirkan** sebagai Server-Sent Events. Satu pertanyaan bisa
  memakan puluhan detik; menunggu diam-diam selama itu tidak bisa
  dibedakan dari macet, jadi tiap langkah dikirim begitu terjadi.
- **Grafik batang selalu mulai dari nol.** Untuk angka yang berdempetan
  tinggi (mis. ketuntasan 88–98% terhadap ambang 90%), model diarahkan
  memakai jenis `selisih` terhadap ambang — sumbu batang yang dipotong
  membuat beda satu poin terlihat seperti jurang.
