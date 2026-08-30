/**
 * Pemeriksaan akses biro akademik (peran direktur_area).
 *
 *     node scripts/uji-direktur-area.mjs      (butuh: next build lebih dulu)
 *
 * Biro akademik membawahi beberapa sekolah dalam satu Tim Manajemen.
 * Emailnya ditulis SEKALI saja -- users_access.email adalah PRIMARY KEY,
 * jadi menulisnya di tiap sekolah akan saling menimpa. Cakupan bacanya
 * ditentukan RLS lewat kolom `area`, bukan lewat jumlah barisnya.
 *
 * Yang diperiksa di sini adalah sisi tampilannya, karena RLS-nya sendiri
 * sudah diuji terpisah saat migrasi:
 *
 *   1. Kepala sekolah TIDAK BERUBAH SAMA SEKALI. Ini yang paling mudah
 *      rusak: pemilih sekolah yang bocor ke dasbor kepala sekolah akan
 *      membingungkan orang yang memang hanya punya satu sekolah.
 *   2. Biro mendapat pemilih sekolah, dan berganti sekolah benar-benar
 *      mengganti isi dasbornya -- bukan cuma judulnya.
 *   3. Kelas dari sekolah lain tidak ikut bocor ke dalam rekap. Kalau
 *      penyaringannya putus, "A1" Kudus dan "A1" Pati akan berdampingan
 *      tanpa bisa dibedakan.
 *   4. Daftar mapel ikut berganti kalau kedua sekolah beda jenjang --
 *      PG tanpa IPA, SD dengan IPA, pada satu sesi login yang sama.
 *
 * Supabase tidak dihubungi sama sekali.
 */
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

/* Playwright bukan kebergantungan proyek ini -- ia hanya alat uji. */
const require_ = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require_('playwright'));
} catch {
  try {
    ({ chromium } = require_('/opt/node22/lib/node_modules/playwright'));
  } catch {
    console.error('Playwright tidak ditemukan. Pasang dengan: npm i -g playwright');
    process.exit(2);
  }
}

const PORT = 3991;
const ASAL = `http://127.0.0.1:${PORT}`;

/* ----------------------------------------------------------------
   Dua sekolah, beda jenjang, dengan nama kelas yang SENGAJA SAMA.
   ----------------------------------------------------------------
   Nama kelas "A1" dipakai keduanya. Kalau penyaringan menurut sekolah
   putus, tabel rekap akan memuat dua baris "A1" -- dan itulah yang
   ditangkap pemeriksaan jumlah kelas di bawah.
   ---------------------------------------------------------------- */
const SEKOLAH = [
  { id: 1, kode: 'PGYFK', nama: 'PG Yaumi Fatimah Kudus', area: 'Pati Raya', jenjang: 'PG' },
  { id: 2, kode: 'SDYFP', nama: 'SD Yaumi Fatimah Pati', area: 'Pati Raya', jenjang: 'SD' },
];

const KELAS = [
  { id: 1, sekolah_id: 1, tahun_ajaran: '2026-2027', nama_kelas: 'A1', wali_kelas: 'Ustadzah Kudus', target_akademik: 90 },
  { id: 2, sekolah_id: 1, tahun_ajaran: '2026-2027', nama_kelas: 'A2', wali_kelas: 'Ustadzah Kudus 2', target_akademik: 90 },
  { id: 3, sekolah_id: 2, tahun_ajaran: '2026-2027', nama_kelas: 'A1', wali_kelas: 'Ustadz Pati', target_akademik: 90 },
];

const siswa = KELAS.flatMap((k) =>
  Array.from({ length: 8 }, (_, i) => ({
    nis: `${SEKOLAH.find((s) => s.id === k.sekolah_id).kode}-${k.id}${i}`,
    nama_lengkap: `Siswa ${k.nama_kelas} ${i + 1}`,
    nama_panggilan: `${k.nama_kelas}-${i + 1}`,
    kelas_id: k.id,
  }))
);

const nilai = siswa.map((s, i) => ({
  id: i + 1,
  nis: s.nis,
  kelas_id: s.kelas_id,
  bulan: 'Juli',
  urutan_bulan: 1,
  rata_b_indo: 80 + (i % 15),
  rata_mtk: 78 + (i % 18),
  rata_ipa: 70 + (i % 25),
  target_tahfidz: 5,
  capaian_tahfidz: 4 + (i % 3),
  target_tahsin: 4,
  capaian_tahsin: 3 + (i % 3),
}));

/**
 * Menirukan penyaringan RLS: kepala sekolah hanya melihat sekolahnya
 * sendiri, biro melihat seluruh sekolah dalam areanya.
 */
function tabel(peran) {
  const bolehSekolah = peran === 'direktur_area' ? SEKOLAH : [SEKOLAH[0]];
  const idBoleh = bolehSekolah.map((x) => x.id);
  const kelasBoleh = KELAS.filter((k) => idBoleh.includes(k.sekolah_id));
  const kelasIdBoleh = kelasBoleh.map((k) => k.id);

  return {
    users_access: {
      email: 'biro@contoh.sch.id',
      nama: 'Ustadzah Halimah',
      role: peran,
      nama_kelas: null,
    },
    sekolah: bolehSekolah.map((x) => ({ ...x, link_lhm: 'https://contoh.app/' })),
    kelas: kelasBoleh,
    penempatan: siswa
      .filter((s) => kelasIdBoleh.includes(s.kelas_id))
      .map((s) => ({ nis: s.nis, siswa: s })),
    nilai_bulanan: nilai.filter((n) => kelasIdBoleh.includes(n.kelas_id)),
  };
}

function jalankanServer() {
  const anak = spawn('./node_modules/.bin/next', ['start', '-p', String(PORT)], {
    cwd: process.cwd(),
    env: { ...process.env, NODE_ENV: 'production' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return new Promise((selesai, gagal) => {
    const batas = setTimeout(() => gagal(new Error('server tidak siap')), 30000);
    anak.stdout.on('data', (d) => {
      if (String(d).includes('Ready') || String(d).includes('started server')) {
        clearTimeout(batas);
        selesai(anak);
      }
    });
    anak.stderr.on('data', (d) => process.stderr.write(String(d)));
  });
}

let gagal = 0;
function periksa(nama, syarat, keterangan = '') {
  if (!syarat) gagal += 1;
  console.log(`${syarat ? 'OK   ' : 'GAGAL'} ${nama}${keterangan ? ` — ${keterangan}` : ''}`);
}

async function buka(konteks, peran) {
  const page = await konteks.newPage();
  const isi = tabel(peran);

  await page.route('**/*.supabase.co/**', async (rute) => {
    const nama = new URL(rute.request().url()).pathname.split('/').pop();
    const data = isi[nama] ?? [];
    const tunggal = (rute.request().headers()['accept'] || '').includes('pgrst.object');
    await rute.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'content-range': '0-99/*' },
      body: JSON.stringify(tunggal && Array.isArray(data) ? data[0] ?? null : data),
    });
  });

  await page.addInitScript(() => {
    localStorage.setItem('sb-placeholder-project-auth-token', JSON.stringify({
      access_token: 'uji', token_type: 'bearer', refresh_token: 'uji',
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600 * 24 * 365,
      user: {
        id: '00000000-0000-0000-0000-000000000001',
        aud: 'authenticated', role: 'authenticated',
        email: 'biro@contoh.sch.id',
        app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z',
      },
    }));
  });

  await page.goto(`${ASAL}/dashboard/kepala-sekolah`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1300);
  return page;
}

/** Jumlah baris kelas di tabel "Rekap Seluruh Kelas". */
function hitungBarisRekap(page) {
  return page.locator('section')
    .filter({ hasText: 'Rekap Seluruh Kelas' })
    .first()
    .locator('tbody tr')
    .count();
}

const server = await jalankanServer();
const peramban = await chromium.launch();
const konteks = await peramban.newContext({ viewport: { width: 1280, height: 900 } });

try {
  /* ---------------- Kepala sekolah: tidak boleh berubah ---------------- */
  console.log('\n--- kepala sekolah (satu sekolah) ---');
  {
    const page = await buka(konteks, 'kepala_sekolah');
    const teks = await page.locator('body').innerText();

    periksa('halaman termuat tanpa galat', !teks.includes('Application error'));
    periksa('judul tetap "Dasbor Sekolah"', teks.includes('Dasbor Sekolah'));
    /* Kepala sekolah hanya punya pemilih Bulan (Tahun Ajaran menjadi teks
       selama baru satu tahun). Munculnya pemilih kedua berarti pemilih
       sekolah ikut bocor ke dasbor yang seharusnya tidak punya. */
    const jumlahPemilih = await page.locator('header select').count();
    periksa('TIDAK ada pemilih sekolah', jumlahPemilih === 1,
      `${jumlahPemilih} dropdown di kepala halaman`);
    periksa('tidak menyebut Biro Akademik', !teks.includes('Biro Akademik'));
    periksa('hanya kelas sekolah sendiri di rekap',
      (await hitungBarisRekap(page)) === 2, `${await hitungBarisRekap(page)} baris`);
    await page.close();
  }

  /* ---------------- Biro akademik: dua sekolah ---------------- */
  console.log('\n--- biro akademik (direktur_area) ---');
  {
    const page = await buka(konteks, 'direktur_area');
    let teks = await page.locator('body').innerText();

    periksa('halaman termuat tanpa galat', !teks.includes('Application error'));
    periksa('dikenali sebagai Biro Akademik dan menyebut areanya',
      teks.includes('Biro Akademik Pati Raya'));
    periksa('menyebut jumlah sekolah yang dibawahi', teks.includes('2 sekolah'));

    /* Diambil dari posisinya di baris kontrol kepala halaman, bukan dari
       teks label: <label> di sini membungkus <select>-nya, jadi teks
       labelnya ikut memuat seluruh nama pilihan dan getByLabel yang
       "exact" tidak pernah cocok. Pemilih sekolah selalu yang pertama. */
    const pemilih = page.locator('header select').first();
    periksa('ada pemilih sekolah', (await pemilih.count()) === 1);

    /* Sekolah pertama: PG Kudus, dua kelas, tanpa IPA. */
    periksa('judul menyebut sekolah yang sedang dilihat',
      teks.includes('PG Yaumi Fatimah Kudus'));
    let baris = await hitungBarisRekap(page);
    periksa('rekap hanya memuat kelas sekolah itu', baris === 2, `${baris} baris`);
    periksa('jenjang PG: IPA tidak tampil', !/\bIPA\b/.test(teks));

    /* Berpindah ke SD Pati: satu kelas, dan IPA muncul kembali. */
    await pemilih.selectOption('2');
    await page.waitForTimeout(1400);
    teks = await page.locator('body').innerText();

    periksa('berganti sekolah mengganti judulnya',
      teks.includes('SD Yaumi Fatimah Pati'));
    baris = await hitungBarisRekap(page);
    periksa('rekap ikut berganti, kelas sekolah lama tidak tertinggal',
      baris === 1, `${baris} baris`);
    periksa('jenjang SD: IPA tampil kembali pada sesi yang sama',
      /\bIPA\b/.test(teks));
    periksa('halaman tetap sehat sesudah berpindah',
      !teks.includes('Application error'));
    await page.close();
  }
} finally {
  await peramban.close();
  server.kill('SIGTERM');
}

console.log(gagal ? `\n${gagal} pemeriksaan GAGAL\n` : '\nSeluruh pemeriksaan lolos.\n');
process.exit(gagal ? 1 : 0);
