# Rencana Optimasi Sistem & Tampilan LHM

Disusun 11 November 2026 dari pembacaan kode dan pemeriksaan langsung
(hanya-baca) ke basis data produksi **Database LHM**. Dokumen ini adalah
**perintah kerja untuk pelaksana** (model yang lebih hemat): setiap butir
sudah memuat keputusan, berkas, dan cara mengujinya. Pelaksana tidak
perlu menimbang ulang rancangannya — cukup mengerjakan sesuai urutan.

---

## 0. Aturan kerja untuk pelaksana

1. **Satu fase = satu cabang = satu PR draf**, dikerjakan berurutan
   Fase 1 → 6. Jangan menggabung fase. Fase 1–3 adalah yang diminta
   pemilik secara langsung; kerjakan lebih dulu.
2. Bahasa kode, komentar, dan antarmuka: **Indonesia**, mengikuti gaya
   berkas yang ada (komentar menjelaskan *mengapa*, bukan *apa*).
3. JavaScript biasa, bukan TypeScript. Jangan menambah pustaka baru.
4. **Jangan menjalankan SQL apa pun ke basis data produksi.** Migrasi
   ditulis sebagai berkas di `migrasi/`; pemilik yang menjalankannya di
   Supabase SQL Editor (itu kebiasaan repositori ini).
5. `sync.js` dan `sync-pg.js` isinya kembar. Setiap perubahan di salah
   satunya **wajib** diterapkan ke keduanya.
6. Blok `@media print` di `app/dashboard/dasbor.module.css` harus tetap
   paling bawah berkas. Aturan cetak baru ditulis **di dalam** blok itu.
7. Sebelum mendorong: `npm run build` harus lulus, lalu jalankan skrip
   uji yang disebut di tiap fase.
8. Yang **tidak boleh** disentuh: tabel/fungsi berawalan `ekskul_`
   (milik aplikasi lain yang menumpang di basis data yang sama), token
   orang tua, dan isi `quran_mapping.js` / `lib/poin.js`.
9. Kalau ada butir yang ternyata tidak cocok dengan kodenya saat
   dikerjakan, berhenti di butir itu dan laporkan — jangan berimprovisasi.

---

## 1. Ringkasan temuan

Angka di kolom "Bukti" berasal dari basis data produksi hari ini
(7 sekolah, 26 kelas, 411 siswa, 5.328 baris nilai).

| # | Temuan | Bukti | Dampak | Fase |
|---|--------|-------|--------|------|
| A | Nilai 89,5–89,99 **ditampilkan "90"** tetapi **dihitung belum tuntas** | 27 nilai | Muncul "MTK 90 (target 90)" di daftar Perlu Pendampingan; ketuntasan kelas lebih rendah dari yang terbaca | 1 |
| B | "Capaian terbaik" hanya menyebut **satu** nama walau banyak yang sama | Sampai 22 siswa bernilai 100 dalam satu kelas-bulan | Yang disebut hanya nama yang paling awal menurut abjad | 1 |
| C | Narasi "ketuntasan tertinggi" hanya menyebut satu mapel walau seri | — | Sama seperti B, di tingkat mapel | 1 |
| D | Siswa tercatat di **dua kelas sekaligus** dalam satu tahun ajaran | 33 siswa SDYFP (5A dan 5B) | Jumlah siswa kelas menggelembung; rapor orang tua bisa membuka kelas yang **kosong**; tahun ajaran tampil dobel di menu | 1 & 5 |
| E | Garis target merah bertabrakan dengan batang Matematika (jingga-merah) | `--target #d03b3b` vs `--seri-2 #eb6834` | Garis target sulit dibedakan dari batang | 2 |
| F | Bagian "Telusur Satu Siswa" ikut tercetak di laporan bulanan | — | Lembar laporan berisi kotak kosong / data satu siswa yang tidak diminta | 3 |
| G | **Satu kunci sinkronisasi dipakai semua sekolah**, dan server mempercayai `sekolah_id` yang dikirim | `app/api/sync/route.js` | Skrip satu sekolah (atau siapa pun yang memegang kuncinya) bisa menimpa data sekolah lain dan mendaftarkan dirinya sebagai pimpinan sekolah lain | 4 |
| H | Fungsi penjaga RLS tanpa `search_path`; ada fungsi warisan `link_parent_by_nis_wa` yang bisa dipanggil tanpa login | Advisor Supabase | Celah pengerasan; fungsi warisan merujuk tabel yang sudah tidak ada | 4 |
| I | Tabel salinan `potret_20260918_*` dan `cadangan_akses_ortu_*` masih di skema `public` | 7 tabel | Berisi salinan data siswa dan token; saat ini tertutup RLS, tetapi tidak semestinya berada di skema yang terbuka ke API | 4 |
| J | Query tanpa batas akan **terpotong diam-diam di 1.000 baris** | `penempatan` sudah 444 baris; `/api/tautan` mengambil seluruhnya | Tahun ajaran depan sebagian siswa hilang dari daftar tautan tanpa pesan galat | 5 |
| K | Sinkronisasi hanya menambah, tidak pernah menghapus | Penyebab temuan D | Siswa yang pindah kelas tertinggal di kelas lama | 5 |
| L | Nilai di luar 0–100 lolos sampai dasbor | 2 baris (SDYFK 2A Oktober: 108,5 dan 102) | Salah ketik di spreadsheet ikut masuk rata-rata | 5 |
| M | Dasbor kepala sekolah memuat kelas satu per satu | `for … await` | Lambat; makin terasa bagi biro yang memegang banyak sekolah | 5 |

**Yang sudah diperiksa dan AMAN** (tidak perlu dikerjakan):
- RLS aktif di seluruh tabel; tidak ada kebijakan tulis untuk peramban.
- Tidak ada siswa/nilai yang menyeberang sekolah: 0 penempatan lintas
  sekolah, 0 nilai lintas sekolah, 0 NIS tanpa awalan kode sekolah.
- 0 nilai tanpa penempatan, 0 tautan ganda per siswa, 0 akun tanpa sekolah.
- `/api/tautan` sudah menyaring sekolah sendiri sebelum setiap penulisan.
- Rapor orang tua menyamarkan nama teman sekelas di server.
- Service worker tidak menyimpan jawaban `/api/`.

---

## Fase 1 — Ketepatan hitung

Berkas utama: `lib/statistik.js`. Aturan dasarnya satu: **angka yang
digolongkan harus angka yang ditampilkan** (prinsip yang sama sudah
dipakai `MeterKetuntasan`).

### 1.1 Satu aturan pembulatan untuk tampil dan untuk tuntas

**Keputusan:** nilai akademik dibulatkan ke bilangan bulat (0,5 ke
atas), lalu dibandingkan dengan target. 89,5 → 90 → **tuntas**.
89,49 → 89 → belum.

Tambahkan di `lib/statistik.js` (di atas `ketuntasan`):

```js
/** Nilai akademik seperti yang DIBACA di layar: bilangan bulat. */
export function nilaiTampil(v) {
  if (v === null || v === undefined) return null;
  return Math.round(Number(v));
}

/** Tuntas bila nilai yang tampil sudah mencapai target. */
export function capaiTarget(v, target) {
  const n = nilaiTampil(v);
  return n !== null && n >= Number(target);
}
```

Lalu ubah pemakainya:

| Lokasi | Sekarang | Menjadi |
|--------|----------|---------|
| `ketuntasan()` | `b[kunci] >= target` | `capaiTarget(b[kunci], target)` |
| `peringatanDini()` cabang mapel | `b[m.kunci] < t` | `nilaiTampil(b[m.kunci]) < t` |
| `distribusi()` | `v >= r.min && v <= r.max` | bandingkan `nilaiTampil(v)` |
| `RENTANG` | batas `69.999`, `79.999`, … | batas bulat: `69`, `79`, `89`, `98` (min tetap 70/80/90/99) |
| `bulat(v, 0)` | `Number(v).toFixed(0)` | untuk `desimal === 0` kembalikan `String(nilaiTampil(v))` |
| `narasiKelas()` `perluPerhatian` | `m.k.persen < AMBANG` | `Number(bulat(m.k.persen)) < AMBANG_KETUNTASAN` |

`rekapQuran()` **tidak diubah** (poin sudah bilangan bulat).
Rapor orang tua (`app/rapor/[token]/page.jsx`) **tidak diubah**: di sana
nilai ditampilkan satu desimal, jadi angka dan kalimatnya sudah seia.

Perbarui komentar `RENTANG` dan kalimat di
`app/dashboard/wali-kelas/page.jsx` (kartu Sebaran Nilai) menjadi:
"Nilai dibulatkan lebih dulu; setiap nilai masuk tepat satu rentang."

### 1.2 Nilai tertinggi: semua peraih disebut

Ganti `capaianTerbaik()`:

```js
export function capaianTerbaik(baris, mapel = MAPEL) {
  return mapelSkor(mapel).map((m) => {
    const dinilai = baris.filter((b) => b[m.kunci] !== null && b[m.kunci] !== undefined);
    if (!dinilai.length) return null;
    const puncak = Math.max(...dinilai.map((b) => nilaiTampil(b[m.kunci])));
    const peraih = dinilai
      .filter((b) => nilaiTampil(b[m.kunci]) === puncak)
      .map((b) => b.nama_panggilan)
      .sort((a, b) => a.localeCompare(b, 'id'));
    return { kunci: m.kunci, mapel: m.pendek, nilai: puncak, peraih, dinilai: dinilai.length };
  }).filter(Boolean);
}
```

Ganti isi `CatatanTerbaik` di `app/dashboard/komponen.jsx` menjadi daftar
(bukan satu kalimat). Judul kecil: **"Nilai tertinggi bulan ini"**. Satu
baris per mapel.

**Aturan penulisan (sudah diputuskan): sebut SEMUA nama, atau sebut
jumlahnya saja — tidak pernah sebagian nama.** Menulis "Aira, Aisya,
Alif, dan 19 lainnya" mengulang cacat yang sedang diperbaiki: yang
tersebut hanya yang namanya paling awal menurut abjad.

| `peraih.length` | Kalimat |
|-----------------|---------|
| 1 | `Matematika: nilai tertinggi 98 diraih Aisya.` |
| 2–3 | `IPA: nilai tertinggi 100 diraih Aira, Alif, dan Ammar.` (pakai `gabung()` dari 1.3) |
| 4 atau lebih | `B. Indonesia: 22 dari 24 siswa meraih nilai tertinggi 100.` |
| sama dengan `dinilai` (dan > 1) | `B. Indonesia: seluruh 24 siswa meraih nilai 100.` |

Baris "seluruh" didahulukan atas baris lain: 2 peraih dari 2 siswa yang
dinilai ditulis "seluruh 2 siswa", bukan dua nama.

Pembandingnya ("dari 24") adalah `dinilai` — jumlah siswa yang punya
nilai mapel itu bulan ini — bukan jumlah siswa terdaftar. Nama mapel
memakai `label` (panjang), jadi tambahkan `label: m.label` pada hasil
`capaianTerbaik()`.

Untuk 4 peraih atau lebih, namanya tetap bisa dilihat **di layar**:
di ujung baris ada `<details className={gaya.namaPeraih}>` dengan
`<summary>lihat nama</summary>` berisi seluruh nama urut abjad, dipisah
koma. **Di cetakan daftar itu tidak ikut**: `usePersiapanCetak` membuka
semua `<details>` sebelum mencetak, jadi tambahkan `.namaPeraih` ke
daftar `display: none !important` di blok `@media print`. Laporan cetak
cukup memuat kalimat jumlahnya; siapa orangnya sudah terlihat di grafik
batang di atasnya.

Pakai `<ul className={gaya.daftarTerbaik}>`; gayanya meniru `.narasi`
(latar lembut, huruf 0.88rem), titik warna kecil di depan tiap baris
memakai `WARNA_MAPEL[t.kunci]`. Nama siswa dan angka "22 dari 24" /
"seluruh 24 siswa" dicetak tebal.

### 1.3 Narasi kelas: mapel yang seri disebut semua

Di `narasiKelas()` tambahkan pembantu `gabung(daftar)` → "A", "A dan B",
"A, B, dan C". Lalu:

```js
const puncak = Math.max(...hasil.map((m) => Number(bulat(m.k.persen))));
const teratas = hasil.filter((m) => Number(bulat(m.k.persen)) === puncak);
```

- `teratas.length === 1` → kalimat lama.
- seri sebagian → "…ketuntasan tertinggi adalah A dan B, sama-sama 96%."
- seri semua (dan mapel > 1) → "Pada bulan X, seluruh mata pelajaran
  mencatat ketuntasan yang sama, yaitu 96%."

Kalimat penutup: pakai `gabung()` untuk daftar perlu perhatian, dan ubah
"berada di atas ambang 90%" menjadi **"sudah mencapai ambang 90%"**
(tepat 90% juga lulus).

### 1.4 Hitungan siswa: yang dinilai vs yang terdaftar

Sinkronisasi membuat baris kosong untuk setiap siswa-bulan, dan temuan D
menambah baris hantu. `baris.length` karena itu bukan "jumlah siswa yang
dinilai".

- Tambah di `lib/statistik.js`:
  `export function barisDinilai(baris) { return baris.filter(bulanBerdata); }`
- `app/dashboard/kepala-sekolah/page.jsx`, di dalam `ringkasan`:
  `const dinilai = barisDinilai(baris)`; simpan `baris: dinilai`,
  `jumlah: dinilai.length`, `terdaftar: baris.length`. Kolom "Siswa"
  menampilkan `28` bila sama, `28 / 33` bila berbeda (dengan
  `title="28 sudah dinilai dari 33 terdaftar"`).
- `app/dashboard/wali-kelas/page.jsx`: `const baris =
  barisDinilai(perBulan[bulan] || [])`. Keterangan kepala:
  `· 28 siswa` atau `· 28 dari 33 siswa sudah dinilai`.
- Daftar pilihan "Telusur Satu Siswa" tetap memakai seluruh siswa
  (`siswaDalamKelas`) — tidak diubah.

### 1.5 Rapor orang tua memilih kelas yang benar (akibat temuan D)

`app/api/rapor/route.js`:

1. `tahunAjaranTersedia` → unik:
   `[...new Set(daftarKelas.map((k) => k.tahun_ajaran))]`.
2. Bila satu tahun ajaran punya lebih dari satu kelas untuk anak itu,
   pilih kelas yang **punya nilai terisi**. Ambil
   `nilai_bulanan` anak untuk semua `kelas_id` calon (satu query
   `.in('kelas_id', idCalon)`), hitung per kelas memakai
   `adaIsiBulan`-setara (`bulanBerdata`), pilih yang terbanyak barisnya
   terisi; kalau seri, pilih `kelas.id` terbesar (yang paling baru dibuat).

### 1.6 Uji

Buat `scripts/uji-statistik.mjs` (Node murni, tanpa peramban; impor
`../lib/statistik.js` seperti `scripts/uji-cakupan-jenjang.mjs`). Kasus
wajib:

- `ketuntasan` atas nilai `[89.5, 89.49, 90, 100, null]`, target 90 →
  `tuntas 3`, `dinilai 4`, `persen 75`.
- `distribusi`: 89.5 masuk "90–98"; 89.49 masuk "80–89"; 98.5 masuk
  "99–100"; 70 masuk "70–79"; jumlah seluruh rentang = jumlah dinilai.
- `peringatanDini`: siswa bernilai 89.6 **tidak** muncul; 89.4 muncul
  dengan teks "89 (target 90)".
- `capaianTerbaik`: tiga siswa 100 dan satu 99.6 → `peraih.length 4`,
  urut abjad; satu siswa saja → `peraih.length 1`; `dinilai` tidak
  menghitung siswa yang nilainya null.
- Kalimat nilai tertinggi (pisahkan penyusunnya ke fungsi murni
  `kalimatTerbaik(t)` di `lib/statistik.js` supaya bisa diuji tanpa
  peramban; kembalikan `{ teks, tampilNama }`): 1 peraih memuat namanya;
  3 peraih memuat ketiga nama; 4 dari 24 → memuat "4 dari 24 siswa" dan
  **tidak** memuat satu nama pun; 24 dari 24 → memuat "seluruh 24 siswa".
- `narasiKelas`: dua mapel sama-sama 100% → memuat "sama"; satu mapel
  89,6% → **tidak** memuat "Perlu perhatian".
- `barisDinilai`: baris yang seluruh kolomnya null terbuang.

Jalankan juga `node scripts/uji-jenjang.mjs` dan
`node scripts/uji-cetak-dasbor.mjs` (butuh `npm run build`) untuk
memastikan tidak ada yang patah.

---

## Fase 2 — Grafik & warna

### 2.1 Garis target tidak lagi merah

**Keputusan:** garis target/ambang memakai **warna tinta netral**, putus-
putus. Merah disisakan hanya untuk satu arti: *di bawah target / perlu
tindakan*. Warna seri mapel (biru, jingga, hijau) **tidak diubah** —
paletnya sudah lolos uji buta warna dan sudah dikenal guru.

Ubah nilai `--target` di **dua** berkas, tiga tempat masing-masing
(terang, gelap, cetak):

| Berkas | Terang | Gelap | Cetak |
|--------|--------|-------|-------|
| `app/dashboard/dasbor.module.css` | `#3a3936` | `#e9e7df` | `#000000` |
| `app/rapor/[token]/rapor.module.css` | `#3a3936` | `#e9e7df` | `#000000` (bila blok cetaknya menimpa `--target`) |

Akibat sampingan yang harus dibereskan:

- `rapor.module.css` `.galat { color: var(--target) }` → ganti ke merah
  tetap: tambah token `--kritis: #d03b3b` (gelap `#e66767`) di berkas itu
  dan pakai `var(--kritis)`.
- Cari `var(--target)` di `app/press/` — jika ada, perlakukan sama.
- Teks yang menyebut warna, ubah semuanya:
  - `kepala-sekolah/page.jsx` "Garis merah adalah ambang…" →
    "Garis putus-putus adalah ambang ketuntasan 90% — di bawah itu perlu
    perhatian khusus."
  - `wali-kelas/page.jsx` "Garis merah putus-putus adalah target kelas" →
    "Garis putus-putus adalah target kelas (90)."
  - `rapor/[token]/page.jsx` "titik merah menunjukkan target" →
    "penanda gelap menunjukkan target bulan itu"; perbarui juga komentar
    yang menyebut "garis merah".

### 2.2 Garis target diberi label langsung

Pada kedua `ReferenceLine` (`GrafikKelasAkademik` di `komponen.jsx` dan
`GrafikKetuntasanKelas` di `kepala-sekolah/page.jsx`) tambahkan:

```jsx
label={{
  value: `Target ${target}`,        // atau `Ambang ${AMBANG_KETUNTASAN}%`
  position: 'insideTopRight',
  fontSize: 11,
  fontWeight: 600,
  fill: 'var(--target)',
}}
```

Keterangan di legenda tetap dipertahankan.

### 2.3 Batang di bawah target dibuat lebih pucat

Di `GrafikKelasQuran` (`komponen.jsx`), pada `<Cell>`: tambahkan
`fillOpacity={dibawah ? 0.5 : 1}`; garis tepi merah tetap. Alasannya:
di Playgroup batang Matematika berwarna jingga, dan garis tepi merah di
atas jingga nyaris tak terlihat — pucat terbaca di semua warna. Ubah
ikon legenda "Di bawah target" di `LegendaGrafik` agar ikut pucat (terima
prop `pucat` pada item, pasang `opacity: 0.5` pada isiannya saja).

Di `GrafikKelasAkademik` terapkan hal yang sama per batang: ganti tiap
`<Bar>` agar berisi `<Cell>` per baris data dengan
`fillOpacity={capaiTarget(b[m.kunci], target) ? 1 : 0.5}`. Tambahkan
satu keterangan legenda lewat `tambahan`: "Lebih pucat = di bawah target".

### 2.4 Urutan batang bisa dipilih

Di `GrafikKelasAkademik` dan `GrafikKelasQuran` tambahkan sakelar kecil
dua pilihan di atas grafik: **Urut nama** (bawaan) | **Urut nilai**.
- Akademik: urut naik menurut rata-rata mapel yang terisi pada baris itu.
- Qur'an: urut naik menurut selisih `capaian − target` (yang paling
  tertinggal di kiri).
State lokal komponen (`useState`). Kelas gaya baru `.sakelar` (dua
tombol pil berdampingan, yang aktif berlatar `--seri-1`). Sakelar
disembunyikan saat cetak (tambahkan `.sakelar` ke daftar `display: none`
di blok cetak); cetakan mengikuti urutan yang sedang dipilih.

### 2.5 Sumbu & tooltip

- `GrafikKelasAkademik` dan `GrafikTahunanAkademik`: `domain={[0, 100]}`,
  `ticks={[0, 25, 50, 75, 100]}`, tambah `allowDataOverflow={false}`.
  (Sekarang 0–125; ruang kosong di atas 100 membuat batang tampak pendek.
  Nilai > 100 adalah salah ketik — ditangani Fase 5.)
- Tooltip akademik: tampilkan nilai asli satu desimal **dan** statusnya,
  mis. `89,6 → dibulatkan 90 · tuntas`. Formatter:
  `[`${bulat(v, 1)} · ${capaiTarget(v, target) ? 'tuntas' : 'di bawah target'}`, n]`.

### 2.6 Uji

`npm run build`, lalu `node scripts/uji-cetak-dasbor.mjs` dan
`node scripts/uji-cetak-rapor.mjs`. Periksa mata pada mode terang, gelap,
dan pratinjau cetak: garis target terlihat jelas, tidak ada teks "merah"
yang tersisa untuk garis target (`grep -rn "merah" app/` — yang boleh
tersisa hanya yang membahas status di bawah target dan meter).

---

## Fase 3 — Cetak

### 3.1 Laporan bulanan tidak memuat "Telusur Satu Siswa"

**Keputusan:** bagian Telusur **tidak pernah** ikut tercetak di laporan
bulanan (dipilih atau tidak dipilih siswanya). Sebagai gantinya ada
tombol cetak tersendiri untuk satu siswa (3.2), supaya kemampuan
mencetak capaian satu siswa tidak hilang.

- `dasbor.module.css`: tambah kelas `.bagianTelusur` (kosong di layar),
  dan di dalam blok `@media print`:
  `.bagianTelusur { display: none !important; }`
- Pasang `gaya.bagianTelusur` pada `<section>` Telusur di
  `kepala-sekolah/page.jsx` dan `wali-kelas/page.jsx`.

### 3.2 Tombol "Cetak Laporan Siswa"

Di kedua halaman:

```js
const [sasaranCetak, setSasaranCetak] = useState('bulanan'); // 'bulanan' | 'siswa'
// kembali ke bawaan begitu cetak selesai, supaya Ctrl+P berikutnya
// mencetak laporan bulanan
useEffect(() => { if (!modeCetak) setSasaranCetak('bulanan'); }, [modeCetak]);
const cetakSiswa = () => { flushSync(() => setSasaranCetak('siswa')); cetak(); };
```

(`flushSync` dari `react-dom`.) Pasang `data-cetak={sasaranCetak}` pada
`<div className={gaya.halaman}>`.

Tombol **"Cetak Laporan Siswa"** (pakai `TombolCetak` dengan label
berbeda bila komponennya menerima label; kalau tidak, tambahkan prop
`label`) diletakkan di kepala bagian Telusur, hanya muncul bila siswa
sudah dipilih.

Aturan cetak (di dalam blok `@media print`, setelah aturan 3.1):

```css
.halaman[data-cetak='siswa'] .wadah > section:not(.bagianTelusur),
.halaman[data-cetak='siswa'] .tumpuk2Luar,
.halaman[data-cetak='siswa'] .judulCetakBulanan,
.halaman[data-cetak='siswa'] .kakiBulanan { display: none !important; }
.halaman[data-cetak='siswa'] .bagianTelusur { display: block !important; }
.halaman[data-cetak='bulanan'] .judulCetakSiswa,
.halaman[data-cetak='bulanan'] .kakiSiswa { display: none !important; }
```

Penyesuaian markup yang dibutuhkan aturan di atas:

- `<div className={gaya.tumpuk2}>` kartu poin tingkat-kelas (yang berada
  langsung di bawah `.wadah`, bukan yang di dalam Telusur) diberi kelas
  tambahan `gaya.tumpuk2Luar`. Kartu "belum ada nilai" di wali kelas
  (`<div className={gaya.kartu}>`) juga diberi `gaya.tumpuk2Luar`.
- Judul dokumen dibuat dua varian di dalam `.judulCetak`:
  `<span className={gaya.judulCetakBulanan}>` (teks sekarang) dan
  `<span className={gaya.judulCetakSiswa}>` berisi
  `Laporan Capaian Siswa · {nama_lengkap} · Kelas {kelas} · T.A. {tahun}`.
- Kaki cetak sisi kiri dibuat dua varian dengan cara yang sama
  (`kakiBulanan` / `kakiSiswa`: `{nama_lengkap} · Kelas … · T.A. …`).
- Di mode siswa, `KeteranganQuran` di dalam Telusur tetap tersembunyi
  (aturan `.keterangan` yang ada sudah menanganinya).

### 3.3 Perbarui uji cetak

`scripts/uji-cetak-dasbor.mjs` saat ini **mengharuskan** Telusur ikut
tercetak (baris "nama siswa yang ditelusuri ikut tercetak" dan "judul
bagian penelusuran ikut tercetak"). Ubah menjadi dua skenario:

1. Cetak bulanan (jalur `beforeprint` seperti sekarang) →
   `!h.teks.includes('Telusur Satu Siswa')` **dan** nama lengkap siswa
   yang dipilih tidak ada di teks cetak.
2. Klik tombol "Cetak Laporan Siswa" (tangkap `window.print` dengan
   `page.exposeFunction`/penimpaan seperti pola yang ada) → teks cetak
   memuat "Laporan Capaian Siswa" dan nama lengkap siswa, **tidak**
   memuat "Rekap Seluruh Kelas" / "Ketuntasan".

Pemeriksaan lain (lebar grafik, tepi A4, kaki, tombol) tetap berlaku di
kedua skenario.

---

## Fase 4 — Keamanan & batas tiap sekolah

### 4.1 Kunci sinkronisasi per sekolah (temuan G — paling penting)

Sekarang: satu `SYNC_SHARED_SECRET` untuk seluruh sekolah, tersimpan
polos di Apps Script tiap sekolah, dan `/api/sync` menulis baris apa pun
ke enam tabel termasuk `users_access`.

**Rancangan (sudah diputuskan):**

- Variabel lingkungan baru di Vercel: `SYNC_SECRETS`, berisi JSON
  `{"SDYFK":"<kunci>","PGYFK":"<kunci>", …}` — satu kunci acak per kode
  sekolah.
- `app/api/sync/route.js`:
  1. Cocokkan header `x-sync-secret` ke tiap nilai `SYNC_SECRETS`
     memakai `timingSafeEqual` (tiru `app/api/wa/route.js`). Cocok →
     `kode` sekolah diketahui → **mode terikat**.
  2. Tidak cocok, tetapi sama dengan `SYNC_SHARED_SECRET` (bila variabel
     itu masih ada) → **mode lama**, perilaku persis seperti sekarang.
     Ini masa peralihan; begitu pemilik menghapus `SYNC_SHARED_SECRET`
     dari Vercel, mode lama mati dengan sendirinya.
  3. Selain itu → 401.
- Dalam **mode terikat**, sebelum `upsert`, setiap baris diperiksa.
  Ambil `sekolahId` dari tabel `sekolah` menurut `kode` (untuk tabel
  `sekolah` sendiri, pemeriksaan dilakukan sebelum baris itu ada), dan
  `idKelas` = seluruh `kelas.id` milik sekolah itu.

  | Tabel | Syarat tiap baris |
  |-------|-------------------|
  | `sekolah` | `kode === kode` pemilik kunci |
  | `kelas` | `sekolah_id === sekolahId` |
  | `siswa` | `sekolah_id === sekolahId` **dan** `nis` berawalan `kode + '-'` |
  | `penempatan`, `nilai_bulanan` | `nis` berawalan `kode + '-'` **dan** `kelas_id` ada di `idKelas` |
  | `users_access` | `sekolah_id === sekolahId`; **dan** email itu belum dimiliki sekolah lain (query `users_access` `.in('email', …)` lalu tolak yang `sekolah_id`-nya berbeda) |

  Satu baris saja melanggar → seluruh permintaan ditolak **403** dengan
  pesan yang menyebut tabel, jumlah baris, dan contoh satu nilai yang
  melanggar (tanpa menulis apa pun). Gagal tertutup.
- Peran `direktur_area` lewat sinkronisasi: variabel opsional
  `SYNC_KODE_DIREKTUR` (daftar kode dipisah koma). Bila diisi, hanya
  sekolah berkode itu yang boleh mengirim baris `role: 'direktur_area'`;
  sekolah lain ditolak 403. Bila kosong → perilaku sekarang.
- `sync.js` & `sync-pg.js`: **tidak ada perubahan kode** — hanya nilai
  `SYNC_SECRET` di tiap spreadsheet yang diganti pemilik. Perbarui
  komentar di sekitar `SYNC_SECRET` dan `README.md`/`docs/MULTI_SEKOLAH.md`
  untuk menjelaskan kunci per sekolah dan langkah peralihannya.

**Uji:** `scripts/uji-sinkron-terikat.mjs` — impor fungsi pemeriksa
(pisahkan ke `lib/sinkron-terikat.js` sebagai fungsi murni
`periksaBaris(tabel, data, { kode, sekolahId, idKelas, emailMilikLain })`
yang mengembalikan daftar pelanggaran) dan uji: baris sah lolos; NIS
berawalan kode lain ditolak; `sekolah_id` lain ditolak; `kelas_id` di
luar daftar ditolak; email milik sekolah lain ditolak; tabel `sekolah`
berkode lain ditolak.

**Langkah pemilik sesudah PR digabung** (tulis di deskripsi PR):
buat 7 kunci acak → isi `SYNC_SECRETS` di Vercel → Redeploy → ganti
`SYNC_SECRET` di 7 Apps Script → jalankan sinkronisasi tiap sekolah →
hapus `SYNC_SHARED_SECRET` → Redeploy.

### 4.2 Migrasi `migrasi/009-pengerasan-keamanan.sql`

Tulis berkas (idempoten, dalam satu `BEGIN … COMMIT`) berisi:

```sql
-- a. search_path tetap untuk fungsi penjaga RLS
ALTER FUNCTION is_kepala_sekolah()  SET search_path = public, pg_temp;
ALTER FUNCTION kelas_yang_diampu()  SET search_path = public, pg_temp;
ALTER FUNCTION sekolah_yang_boleh() SET search_path = public, pg_temp;
ALTER FUNCTION satu_sekolah_saja()  SET search_path = public, pg_temp;

-- b. fungsi warisan rancangan lama (merujuk tabel yang sudah tidak ada)
DROP FUNCTION IF EXISTS link_parent_by_nis_wa(text, text);
REVOKE EXECUTE ON FUNCTION rls_auto_enable() FROM anon, authenticated, PUBLIC;

-- c. peramban hanya boleh MEMBACA; semua penulisan lewat server
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON sekolah, kelas, siswa, penempatan, nilai_bulanan, users_access,
     akses_ortu, akses_dibuka, wa_pesan, mapping_quran
  FROM anon, authenticated;
REVOKE ALL ON akses_ortu FROM anon, authenticated;

-- d. siswa dan kelas dalam satu baris HARUS satu sekolah
CREATE OR REPLACE FUNCTION tolak_lintas_sekolah()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF (SELECT sekolah_id FROM siswa WHERE nis = NEW.nis)
     IS DISTINCT FROM (SELECT sekolah_id FROM kelas WHERE id = NEW.kelas_id) THEN
    RAISE EXCEPTION 'Siswa % dan kelas % berada di sekolah yang berbeda',
      NEW.nis, NEW.kelas_id USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS jaga_sekolah_penempatan ON penempatan;
CREATE TRIGGER jaga_sekolah_penempatan
  BEFORE INSERT OR UPDATE OF nis, kelas_id ON penempatan
  FOR EACH ROW EXECUTE FUNCTION tolak_lintas_sekolah();

DROP TRIGGER IF EXISTS jaga_sekolah_nilai ON nilai_bulanan;
CREATE TRIGGER jaga_sekolah_nilai
  BEFORE INSERT OR UPDATE OF nis, kelas_id ON nilai_bulanan
  FOR EACH ROW EXECUTE FUNCTION tolak_lintas_sekolah();
```

Butir (d) aman dipasang: saat ini 0 baris melanggar. Butir (c) tidak
mengubah perilaku aplikasi — peramban memang tidak pernah menulis.
**Jangan** mencabut `EXECUTE` fungsi penjaga dari `anon`: kebijakan RLS
memanggilnya untuk setiap peran, dan mencabutnya mengubah "nol baris"
menjadi galat.

Sertakan di ujung berkas blok "PEMERIKSAAN SESUDAH MIGRASI" (query
hitung yang hasilnya harus 0) seperti pola migrasi 001.

### 4.3 Tabel salinan keluar dari skema `public` (temuan I)

Tulis `perawatan/pindahkan-potret.sql` (BUKAN di `migrasi/`, karena
menyentuh tabel sekali-pakai): `CREATE SCHEMA IF NOT EXISTS arsip;` lalu
`ALTER TABLE public.<nama> SET SCHEMA arsip;` untuk tujuh tabel
`potret_20260918_0539_*` dan `cadangan_akses_ortu_20260918_0539`, plus
`REVOKE ALL ON SCHEMA arsip FROM anon, authenticated;`. Datanya tidak
dihapus; hanya tidak lagi terjangkau API. Pemilik yang memutuskan kapan
menjalankannya.

### 4.4 Perketat `/api/tautan`

`aksi: 'daftar'` saat ini mengambil seluruh `penempatan` dan seluruh
`akses_ortu` **semua sekolah**, baru menyaringnya di JavaScript. Ubah:

1. Ambil dulu `kelas` dengan `.in('sekolah_id', sekolahBoleh)
   .eq('tahun_ajaran', tahunAjaran)` → `idKelas`.
2. `penempatan` `.in('kelas_id', idKelas)`.
3. `akses_ortu` `.in('nis', daftarNis)` (pecah per 200 NIS).
4. Semua query memakai pembantu halaman 4.5.

Hasil yang dikembalikan harus sama persis dengan sekarang.

### 4.5 Catatan yang TIDAK dikerjakan sekarang (cukup dicatat di PR)

- Pembatas laju `/api/rapor`: token 12 karakter (±71 bit) tidak realistis
  ditebak, dan saat ini tidak ada satu pun tautan ber-PIN (0 dari 315).
  Bila PIN kelak dipakai, pembatas laju menjadi wajib.
- `kelas_yang_diampu()` mencocokkan nama kelas di **semua** tahun ajaran:
  wali kelas 2A tahun ini ikut melihat 2A tahun lalu. Baru relevan
  setelah ada tahun ajaran kedua — putuskan saat itu.
- 1 akun wali kelas di `users_access` kelasnya tidak cocok dengan kelas
  mana pun (ia tidak melihat apa-apa). Perlu dibetulkan di sheet
  `users_access` sekolahnya, bukan di kode.

---

## Fase 5 — Ketahanan data

### 5.1 Tidak ada lagi query yang terpotong di 1.000 baris (temuan J)

Buat `lib/ambil-semua.js`:

```js
/** Mengambil SELURUH baris sebuah query Supabase, 1.000 per halaman. */
export async function ambilSemua(buatQuery, ukuran = 1000) {
  const semua = [];
  for (let dari = 0; ; dari += ukuran) {
    const { data, error } = await buatQuery().range(dari, dari + ukuran - 1);
    if (error) throw error;
    semua.push(...(data || []));
    if (!data || data.length < ukuran) return semua;
  }
}
```

`buatQuery` adalah fungsi yang membangun query baru tiap halaman dan
**wajib** memuat `.order()` pada kunci unik agar halaman tidak tumpang
tindih. Pakai di:

- `lib/data-dasbor.js`: `muatNilaiKelas` (dua query), `muatLogWa`
  (query `siswa`), `muatDaftarKelas`.
- `app/api/tautan/route.js` (4.4) dan `app/api/rapor/route.js`
  (`nilaiKelas`, `siswaKelas`).
- `app/api/wa/route.js`: query yang tidak difilter per NIS/sekolah.

`muatLogAksesRapor`: `jumlahDibuka` dihitung dari 2.000 baris terakhir
saja, sehingga angkanya akan salah begitu riwayat melewati 2.000. Ambil
hitungan per NIS lewat `ambilSemua` atas kolom `nis, dibuka_pada` saja
(tanpa embed `siswa`), dan pertahankan `.limit(2000)` hanya untuk daftar
riwayat yang ditampilkan.

### 5.2 Dasbor kepala sekolah memuat kelas serentak (temuan M)

`kepala-sekolah/page.jsx`: ganti `for … await muatNilaiKelas` dengan
`Promise.all(kelasTahunIni.map(…))`. Tambahkan `setDataKelas({})` di awal
efek agar data sekolah sebelumnya tidak sempat tampil saat berganti
sekolah.

### 5.3 Nilai di luar 0–100 (temuan L)

- `sync.js` & `sync-pg.js`, di **Cek Kesehatan Data**: laporkan setiap
  nilai mapel < 0 atau > 100 (kelas, bulan, nama, mapel, nilainya) sebagai
  temuan "harus diperbaiki". Di jalur sinkronisasi, nilai seperti itu
  **dikirim sebagai `null`** dan dicatat di ringkasan hasil sinkron
  ("3 nilai di luar 0–100 dilewati") — lebih baik kosong dan ketahuan
  daripada masuk rata-rata.
- Dasbor: tidak ada perubahan (sumbu sudah 0–100 dari Fase 2).
- Dua baris yang sudah telanjur ada (SDYFK 2A Oktober) hilang sendiri
  setelah spreadsheet dibetulkan dan disinkron ulang; catat di PR.

### 5.4 Siswa yang pindah kelas tidak tertinggal di kelas lama (temuan D, K)

Dua bagian, **yang kedua butuh persetujuan pemilik sebelum dijalankan**:

1. **Pencegahan di sinkronisasi.** Di Cek Kesehatan Data (kedua skrip):
   laporkan NIS yang muncul di lebih dari satu kelas pada tahun ajaran
   yang sama di Master Rekap. Ini menangkap kasusnya di hulu.
2. **Pembersihan.** Tulis `perawatan/penempatan-ganda.sql` berisi:
   - query **lihat-dulu** (daftar siswa, kedua kelasnya, jumlah bulan
     terisi di masing-masing);
   - perintah hapus yang hanya menyentuh penempatan + baris nilai pada
     kelas yang **tidak punya satu pun nilai terisi** untuk siswa itu,
     sementara ia punya nilai terisi di kelas lain pada tahun ajaran yang
     sama. Siswa yang kosong di kedua kelas tidak disentuh.
   Dibungkus `BEGIN; … ROLLBACK;` secara bawaan dengan petunjuk mengganti
   ke `COMMIT` setelah hasilnya diperiksa.

Jangan membuat penghapusan otomatis di `/api/sync` pada fase ini.

### 5.5 Cap waktu kesegaran data

Di kepala dasbor wali kelas dan kepala sekolah tampilkan
"Data terakhir disinkron: 10 November 2026 14.05" — nilai terbesar
`disinkron_pada` dari baris yang sudah dimuat (tidak perlu query baru).
Letakkan di `keterangan` `KepalaSekolahan`, dan ikut di kaki cetak.

---

## Fase 6 — Tampilan lebih profesional & dinamis

Semua memakai token warna dan kelas yang sudah ada di
`dasbor.module.css`; tidak ada pustaka baru.

### 6.1 Baris angka kunci di puncak dasbor kepala sekolah

Kartu baru di atas "Ketuntasan Antar Kelas", empat ubin sejajar
(`grid` 4 kolom, 2 kolom di HP):

| Ubin | Isi | Sumber |
|------|-----|--------|
| Siswa dinilai | `Σ jumlah` · kecil: "dari N terdaftar" | `ringkasan` |
| Ketuntasan akademik | rata-rata `ketuntasanRata` antar kelas, % | `ringkasan` |
| Kelas di bawah ambang | jumlah kelas dengan ≥ 1 mapel < 90% · kecil: nama kelasnya | `ringkasan` |
| Perlu pendampingan | jumlah siswa hasil `peringatanDini` seluruh kelas | `ringkasan` |

Tiap ubin menampilkan **selisih terhadap bulan sebelumnya** (▲ 3 / ▼ 2 /
"sama") bila bulan sebelumnya berdata — hitung `ringkasan` yang sama
untuk bulan sebelum `bulan` di `bulanTersedia`. Warna selisih: hijau
`--baik-teks` bila membaik, `--tindakan-teks` bila memburuk (untuk dua
ubin terakhir, turun = membaik). Angka besar memakai warna tinta, bukan
warna status.

### 6.2 Tabel "Rekap Seluruh Kelas" terbaca sekilas

- Tiap sel persen diberi titik status di depannya memakai empat tingkat
  yang sama dengan meter (`--baik`, `--dipantau`, `--perhatian`,
  `--tindakan`); angkanya tetap warna tinta. Pindahkan tabel `TINGKAT`
  dari `MeterKetuntasan` ke `lib/statistik.js` sebagai
  `tingkatKetuntasan(persenBulat)` dan pakai di keduanya.
- Baris yang sedang difokuskan diberi latar `--pendar-nyala`.
- Kepala kolom lengket (`position: sticky; top: 0`) di dalam `.gulir`.
- Di cetak: titik status tetap tercetak (`print-color-adjust: exact`).

### 6.3 Tren ketuntasan sepanjang tahun

Kartu baru "Tren Ketuntasan" di bawah tabel rekap kepala sekolah, dan di
dasbor wali kelas di bawah meter: grafik garis, sumbu X = bulan berdata,
satu garis per mapel (warna `WARNA_MAPEL`), garis ambang 90% netral
berlabel. Datanya `ketuntasanMapel` per bulan atas seluruh siswa sekolah
(kepala sekolah) atau kelas (wali kelas). Tampil hanya bila bulan
berdata ≥ 2. Ikut tercetak di laporan bulanan.

### 6.4 Keadaan memuat dan gagal

- Ganti teks "Memuat data…" dengan kerangka (skeleton): kepala + tiga
  kartu abu-abu berdenyut (`@keyframes` opasitas; hormati
  `prefers-reduced-motion`).
- Layar galat diberi tombol **"Coba lagi"** (`location.reload()`) dan,
  untuk pesan "belum terdaftar", tombol keluar.
- Saat berganti bulan/kelas/sekolah, isi lama diredupkan (`opacity .5`)
  sampai data baru siap, bukan berkedip kosong.

### 6.5 Baris penyaring lengket

`.penyaring` di kepala dasbor dibuat lengket di puncak layar saat
digulir (`position: sticky; top: 0; z-index: 5`, latar `--kartu`, garis
bawah tipis), supaya bulan dan kelas bisa diganti tanpa kembali ke atas.
Tidak berlaku saat cetak.

### 6.6 Kerapian kecil

- Angka di tabel dan ubin: `font-variant-numeric: tabular-nums`.
- `app/globals.css` memuat fon lewat `@import` Google Fonts yang menahan
  render; ganti dengan `next/font/google` di `app/layout.jsx` (Inter &
  Outfit), variabel CSS-nya tetap `--font-title` / `--font-body`.
- Semua tombol dan `<select>` punya `:focus-visible` yang jelas
  (`outline: 2px solid var(--pendar-fokus)`).

### 6.7 Uji

`npm run build`; `node scripts/uji-cetak-dasbor.mjs` (perbarui batas
jumlah halaman bila kartu tren menambah satu halaman);
`node scripts/uji-jenjang.mjs` (dasbor PG tidak boleh menampilkan ubin
atau garis untuk mapel yang tidak dinilai di PG).

---

## 7. Keputusan yang sudah ditetapkan (jangan ditimbang ulang)

| Hal | Keputusan |
|-----|-----------|
| Pembulatan | Bulat ke satuan, 0,5 ke atas; tuntas bila hasil bulat ≥ target |
| Nilai tertinggi | 1–3 peraih disebut namanya; 4 atau lebih ditulis "N dari M siswa" (nama bisa dibuka di layar, tidak dicetak); tidak pernah sebagian nama |
| Warna target | Tinta netral putus-putus + label; merah hanya untuk "di bawah target" |
| Warna mapel | Tidak diubah |
| Telusur di cetak bulanan | Selalu disembunyikan; ada tombol cetak khusus satu siswa |
| Kunci sinkron | Satu kunci per sekolah lewat `SYNC_SECRETS`; kunci lama tetap jalan sampai dihapus |
| Nilai > 100 | Dikirim sebagai kosong + dilaporkan; basis data tidak diberi CHECK |
| Penghapusan data | Tidak ada yang otomatis; hanya lewat berkas `perawatan/` yang dijalankan pemilik |

## 8. Yang perlu jawaban pemilik (tidak menghalangi Fase 1–3)

1. ~~Pembulatan 89,5 → tuntas~~ — **dijawab 11 Nov 2026: setuju**
   (bersama persetujuan Fase 1–3 dan aturan penulisan nama di 1.2).
2. ~~Fase 4.1: siapa yang boleh mendaftarkan biro/direktur area~~ —
   **dijawab 11 Nov 2026: tetap seperti sekarang.** Pemilik sendiri yang
   mengisi baris biro/direktur, di sheet `users_access` sekolahnya
   sendiri. Jadi `SYNC_KODE_DIREKTUR` tetap dibuat sebagai pilihan dan
   **dibiarkan kosong** (perilaku sekarang). Catatan untuk pemilik: teks
   peran `direktur_area` tertulis di kode dan dokumen, jadi bukan
   rahasia; bila kelak ingin dikunci, cukup isi variabel itu dengan kode
   sekolah pemilik — cara kerjanya tidak berubah sama sekali.
3. **Fase 5.4**: setuju 33 penempatan ganda SDYFP (5A/5B) dibersihkan
   dengan berkas `perawatan/penempatan-ganda.sql`?
4. **Fase 4.3**: tabel potret September dipindah ke skema `arsip`, atau
   dihapus saja?

## 9. Daftar periksa tiap PR

- [ ] Hanya memuat satu fase
- [ ] `npm run build` lulus
- [ ] Skrip uji fase itu lulus (hasilnya ditempel di deskripsi PR)
- [ ] `sync.js` dan `sync-pg.js` tetap kembar (bila disentuh)
- [ ] Tidak ada aturan CSS di bawah blok `@media print`
- [ ] Deskripsi PR memuat "Langkah pemilik" (migrasi / variabel Vercel /
      Apps Script) bila ada
- [ ] Tidak ada SQL yang dijalankan ke produksi
