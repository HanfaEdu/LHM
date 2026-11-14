/**
 * Pemeriksaan Fase 6 -- tampilan dasbor yang lebih profesional dan dinamis.
 *
 *     node scripts/uji-tampilan-dasbor.mjs      (butuh: next build lebih dulu)
 *
 *   A. Fungsi murni di lib/statistik.js: tingkat status, selisih angka
 *      kunci, ringkasan, tren ketuntasan lintas kelas.
 *   B. Dasbor kepala sekolah dan wali kelas di peramban (SD): angka kunci
 *      dan selisihnya, titik status, baris fokus, kepala kolom lengket,
 *      tren, kerangka memuat, layar galat dengan "Coba lagi".
 *   C. Playgroup: tren dan ubin TIDAK memuat mapel yang tidak dinilai di PG.
 *   D. Kertas: kartu baru tercetak di laporan bulanan, tidak di laporan
 *      siswa, dan titik status tidak dibuang peramban.
 *   E. Fon dimuat dari domain sendiri (next/font), bukan Google Fonts.
 *
 * Supabase digantikan tanggapan tiruan; tidak ada permintaan yang keluar.
 */
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';

/* Playwright bukan kebergantungan proyek ini -- ia hanya alat uji, dan
   memasukkannya ke package.json akan menyeret unduhan peramban ke tiap
   pemasangan. Diambil dari pemasangan global kalau ada. */
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

const PORT = 3989;
const ASAL = `http://127.0.0.1:${PORT}`;
const keluaran = mkdtempSync(join(tmpdir(), 'tampilan-'));

/* ----------------------------------------------------------------
   Data contoh
   ---------------------------------------------------------------- */
const NAMA = [
  ['Aisyah Nur Fadhilah', 'Aisyah'], ['Bilal Arkan Pratama', 'Bilal'],
  ['Citra Ayu Lestari', 'Citra'], ['Danish Fahri Ramadhan', 'Danish'],
  ['Elvira Zahra Putri', 'Elvira'], ['Faiz Abdurrahman', 'Faiz'],
  ['Ghina Salsabila', 'Ghina'], ['Hafizh Nur Iman', 'Hafizh'],
  ['Ilham Maulana Yusuf', 'Ilham'], ['Jasmine Aulia Rahma', 'Jasmine'],
  ['Kaisar Rizky Pratama', 'Kaisar'], ['Laila Khairunnisa', 'Laila'],
  ['Malika Syifa Ramadhani', 'Malika'], ['Naufal Adi Wijaya', 'Naufal'],
  ['Olivia Nadhira Putri', 'Olivia'], ['Putra Bagas Nugroho', 'Putra'],
  ['Qonita Hasna Amira', 'Qonita'], ['Rasyid Hamzah Alfarizi', 'Rasyid'],
  ['Salma Kirana Dewi', 'Salma'], ['Taufik Hidayat Nugraha', 'Taufik'],
  ['Ulya Nabila Rahmadani', 'Ulya'], ['Vino Aditya Pramana', 'Vino'],
  ['Wardah Aisyah Zahrani', 'Wardah'], ['Yusuf Ibrahim Alkhalifi', 'Yusuf'],
];
const BULAN = ['Juli', 'Agustus', 'September'];

const siswa = NAMA.map(([lengkap, panggilan], i) => ({
  nis: `SDYFK-${281 + i}`,
  nama_lengkap: lengkap,
  nama_panggilan: panggilan,
}));

// Angka dibuat dari rumus, bukan acak: dua jalannya harus menghasilkan
// halaman yang sama persis, kalau tidak perbandingan antar-jalan tidak
// berarti apa-apa.
const nilai = [];
siswa.forEach((s, i) => {
  BULAN.forEach((bulan, b) => {
    nilai.push({
      id: nilai.length + 1,
      nis: s.nis,
      kelas_id: 1,
      bulan,
      urutan_bulan: b + 1,
      rata_b_indo: 74 + ((i * 7 + b * 3) % 26),
      rata_mtk: 70 + ((i * 11 + b * 5) % 30),
      rata_ipa: i % 9 === 4 && b === 2 ? null : 78 + ((i * 5 + b * 2) % 22),
      target_tahfidz: 4 + b,
      capaian_tahfidz: 3 + b + (i % 3),
      target_tahsin: 3 + b,
      capaian_tahsin: 2 + b + (i % 4),
    });
  });
});

const TABEL = {
  users_access: {
    email: 'guru@contoh.sch.id',
    nama: 'Siti Masruroh, S.Pd.',
    role: null, // diisi per halaman di bawah
    nama_kelas: '2A',
  },
  sekolah: [{
    id: 1, kode: 'SDYFK', nama: 'SD Yaumi Fatimah Kudus',
    area: 'Pati Raya', jenjang: 'SD',
    link_lhm: 'https://laporan-akademik.vercel.app/',
  }],
  kelas: [{
    id: 1, tahun_ajaran: '2026-2027', nama_kelas: '2A',
    wali_kelas: 'Siti Masruroh, S.Pd.', target_akademik: 90,
  }],
  penempatan: siswa.map((s) => ({ nis: s.nis, siswa: s })),
  nilai_bulanan: nilai,
};

/* ----------------------------------------------------------------
   Server
   ---------------------------------------------------------------- */
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

/* ----------------------------------------------------------------
   Pemeriksaan
   ---------------------------------------------------------------- */
let gagal = 0;
function periksa(nama, syarat, keterangan = '') {
  if (!syarat) gagal += 1;
  console.log(`${syarat ? 'OK   ' : 'GAGAL'} ${nama}${keterangan ? ` — ${keterangan}` : ''}`);
}

async function siapkanHalaman(konteks, peran) {
  const page = await konteks.newPage();

  // Seluruh lalu lintas Supabase dicegat. Tidak ada satu permintaan pun
  // yang benar-benar keluar.
  await page.route('**/*.supabase.co/**', async (rute) => {
    const url = new URL(rute.request().url());
    const tabel = url.pathname.split('/').pop();
    let isi = TABEL[tabel];
    if (tabel === 'users_access') isi = { ...TABEL.users_access, role: peran };
    if (isi === undefined) isi = [];
    // maybeSingle()/single() meminta objek tunggal, bukan larik.
    // Untuk menguji kerangka memuat dan layar galat.
    if (tabel === 'nilai_bulanan' && globalThis.__tunda) await new Promise((r) => setTimeout(r, globalThis.__tunda));
    if (tabel === 'kelas' && globalThis.__gagal) {
      await rute.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'Koneksi putus' }) });
      return;
    }
    const tunggal = (rute.request().headers()['accept'] || '').includes('pgrst.object');
    const badan = tunggal && Array.isArray(isi) ? isi[0] ?? null : isi;
    await rute.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'content-range': '0-99/*' },
      body: JSON.stringify(badan),
    });
  });

  await page.addInitScript(() => {
    const sesi = {
      access_token: 'uji', token_type: 'bearer', refresh_token: 'uji',
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600 * 24 * 365,
      user: {
        id: '00000000-0000-0000-0000-000000000001',
        aud: 'authenticated', role: 'authenticated',
        email: 'guru@contoh.sch.id',
        app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z',
      },
    };
    localStorage.setItem('sb-placeholder-project-auth-token', JSON.stringify(sesi));
  });

  return page;
}


import {
  TINGKAT_KETUNTASAN,
  angkaKunci,
  selisihAngka,
  susunRingkasan,
  tingkatKetuntasan,
  trenKetuntasan,
  mapelUntuk,
} from '../lib/statistik.js';

/* ================================================================ A */
console.log('\n--- A. fungsi murni ---');
{
  periksa('90 -> Baik', tingkatKetuntasan(90).kunci === 'baik');
  periksa('89 -> Perlu dipantau', tingkatKetuntasan(89).kunci === 'dipantau');
  periksa('75 -> Perlu dipantau; 74 -> Perlu perhatian', tingkatKetuntasan(75).kunci === 'dipantau' && tingkatKetuntasan(74).kunci === 'perhatian');
  periksa('60 -> Perlu perhatian; 59 -> Perlu tindakan', tingkatKetuntasan(60).kunci === 'perhatian' && tingkatKetuntasan(59).kunci === 'tindakan');
  periksa('0 dan 100 punya tingkat', tingkatKetuntasan(0).kunci === 'tindakan' && tingkatKetuntasan(100).kunci === 'baik');
  periksa('89,6 digolongkan dari angka bulat (90 -> Baik)', tingkatKetuntasan(89.6).kunci === 'baik');
  periksa('empat tingkat, urut dari batas tertinggi', TINGKAT_KETUNTASAN.length === 4 && TINGKAT_KETUNTASAN.every((t, i, a) => i === 0 || a[i - 1].batas > t.batas));

  const naik = selisihAngka(5, 3);
  periksa('naik: arah, besar, membaik', naik.arah === 'naik' && naik.besar === 2 && naik.membaik === true);
  const turun = selisihAngka(2, 3);
  periksa('turun: memburuk', turun.arah === 'turun' && turun.besar === 1 && turun.membaik === false);
  periksa('sama: tanpa penilaian', selisihAngka(4, 4).arah === 'sama' && selisihAngka(4, 4).membaik === null);
  periksa('turunMembaik: turun = membaik', selisihAngka(1, 3, true).membaik === true);
  periksa('turunMembaik: naik = memburuk', selisihAngka(4, 3, true).membaik === false);
  periksa('bulan sebelumnya kosong -> tanpa selisih', selisihAngka(5, null) === null && selisihAngka(null, 5) === null && selisihAngka(5, undefined) === null);

  const mapel = mapelUntuk('SD');
  const baris = (n, bi, mtk, ipa) => Array.from({ length: n }, (_, i) => ({ nis: `X${i}`, nama_panggilan: `S${i}`, rata_b_indo: bi, rata_mtk: mtk, rata_ipa: ipa }));
  const kelasA = { id: 1, nama_kelas: '1A', target_akademik: 90 };
  const kelasB = { id: 2, nama_kelas: '1B', target_akademik: 80 };
  const dataKelas = {
    1: { Agustus: baris(10, 95, 95, 95), September: [...baris(8, 95, 95, 95), ...baris(2, 50, 95, 95)] },
    2: { Agustus: baris(10, 85, 85, 85), September: baris(10, 85, 85, 85) },
  };
  const ring = susunRingkasan([kelasA, kelasB], dataKelas, 'September', mapel);
  periksa('ringkasan: jumlah siswa dinilai per kelas', ring[0].jumlah === 10 && ring[1].jumlah === 10);
  const kunci = angkaKunci(ring, mapel);
  periksa('angkaKunci: siswa dinilai = 20 dari 20', kunci.dinilai === 20 && kunci.terdaftar === 20);
  periksa('angkaKunci: kelas di bawah ambang = 1A (B. Indo 80% < 90%)', kunci.kelasDiBawah.length === 1 && kunci.kelasDiBawah[0].nama_kelas === '1A', JSON.stringify(kunci.kelasDiBawah.map((k) => k.nama_kelas)));
  periksa('angkaKunci: pendampingan = 2 siswa (nilai 50)', kunci.pendampingan === 2, `${kunci.pendampingan}`);
  const ringAgu = susunRingkasan([kelasA, kelasB], dataKelas, 'Agustus', mapel);
  const kunciAgu = angkaKunci(ringAgu, mapel);
  periksa('Agustus: tidak ada kelas di bawah ambang', kunciAgu.kelasDiBawah.length === 0 && kunciAgu.pendampingan === 0);
  periksa('selisih pendampingan Agustus->September = naik 2 (memburuk)',
    JSON.stringify(selisihAngka(kunci.pendampingan, kunciAgu.pendampingan, true)) === JSON.stringify({ arah: 'naik', besar: 2, membaik: false }));
  const tuntasS = Math.round(kunci.ketuntasan);
  const tuntasA = Math.round(kunciAgu.ketuntasan);
  periksa('ketuntasan rata-rata antar kelas turun dari Agustus ke September', tuntasS < tuntasA, `${tuntasA}% -> ${tuntasS}%`);

  const tren = trenKetuntasan(
    [{ perBulan: dataKelas[1], target: 90 }, { perBulan: dataKelas[2], target: 80 }],
    ['Agustus', 'September'], mapel);
  periksa('tren: dua bulan', tren.length === 2 && tren[0].bulan === 'Agustus');
  periksa('tren: target BERBEDA per kelas dihormati (1B target 80, nilai 85 = tuntas)', tren[0].rata_b_indo === 100 && tren[0].rata_mtk === 100, JSON.stringify(tren[0]));
  periksa('tren: persen gabungan = seluruh tuntas / seluruh dinilai (18/20 = 90)', tren[1].rata_b_indo === 90, JSON.stringify(tren[1]));
  periksa('tren: bulan tanpa data -> null, bukan 0', trenKetuntasan([{ perBulan: dataKelas[1], target: 90 }], ['Maret'], mapel)[0].rata_mtk === null);
  periksa('tren: persen berupa bilangan bulat', tren.every((r) => mapel.every((m) => r[m.kunci] === null || Number.isInteger(r[m.kunci]))));
}

/* ================================================================ B */
const server = await jalankanServer();
const peramban = await chromium.launch();
const HALAMAN_UJI = [
  ['kepala_sekolah', '/dashboard/kepala-sekolah', 'kepala sekolah'],
  ['wali_kelas', '/dashboard/wali-kelas', 'wali kelas'],
];

try {
  console.log('\n--- B. peramban, SD ---');
  for (const [lebar, tag] of [[390, 'HP 390px'], [1100, 'desktop 1100px']]) {
    const konteks = await peramban.newContext({ viewport: { width: lebar, height: 800 } });
    for (const [peran, jalur, label] of HALAMAN_UJI) {
      globalThis.__tunda = 0; globalThis.__gagal = false;
      const page = await siapkanHalaman(konteks, peran);
      await page.goto(`${ASAL}${jalur}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);
      const teks = await page.locator('body').innerText();
      const awal = `${label} (${tag})`;
      periksa(`${awal}: kartu Tren Ketuntasan tampil (3 bulan berdata)`, teks.includes('Tren Ketuntasan'));
      const tren = page.locator('section').filter({ hasText: 'Tren Ketuntasan' }).first();
      periksa(`${awal}: tren menggambar tiga garis mapel`, (await tren.locator('.recharts-line').count()) === 3);
      periksa(`${awal}: tren memuat garis ambang 90%`, (await tren.locator('.recharts-reference-line').count()) === 1);
      /* 6.5: baris penyaring di luar kartu kepala, tepat di bawahnya, dan
         menempel di puncak layar saat halaman digulir jauh. */
      {
        const bar = page.locator('[class*="barisPenyaring"]').first();
        periksa(`${awal}: baris penyaring ada, dengan dropdown`, (await bar.locator('select').count()) >= 1);
        periksa(`${awal}: tidak ada dropdown lagi di dalam kartu kepala`, (await page.locator('header select').count()) === 0);
        const urutan = await page.evaluate(() => {
          const h = document.querySelector('header');
          const b = document.querySelector('[class*="barisPenyaring"]');
          return { sesudah: h.nextElementSibling === b, saudara: h.parentElement === b.parentElement };
        });
        periksa(`${awal}: baris penyaring tepat di bawah kartu kepala`, urutan.sesudah && urutan.saudara, JSON.stringify(urutan));
        const pos = await bar.evaluate((e) => { const c = getComputedStyle(e); return [c.position, c.top, c.zIndex, c.backgroundColor].join(' '); });
        periksa(`${awal}: sticky, top 0, z-index 5, latar kartu`, /^sticky 0px 5 rgb\(255, 255, 255\)$/.test(pos), pos);
        const awalY = await bar.evaluate((e) => Math.round(e.getBoundingClientRect().top));
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.waitForTimeout(250);
        const y = await bar.evaluate((e) => { const r = e.getBoundingClientRect(); return { top: Math.round(r.top), tinggi: Math.round(r.height) }; });
        periksa(`${awal}: setelah digulir ke dasar halaman, baris menempel di puncak layar`, y.top === 0 && awalY > 0, `awal ${awalY}px -> ${y.top}px (tinggi ${y.tinggi}px)`);
        periksa(`${awal}: tinggi baris lengket wajar (<= 45% layar)`, y.tinggi <= 800 * 0.45, `${y.tinggi}px`);
        const dropdownTerlihat = await bar.locator('select').first().evaluate((e) => { const r = e.getBoundingClientRect(); return r.top >= 0 && r.bottom <= window.innerHeight; });
        periksa(`${awal}: dropdown masih terlihat dan bisa dipakai saat digulir`, dropdownTerlihat);
        await page.evaluate(() => window.scrollTo(0, 0));
      }
      if (peran === 'kepala_sekolah') {
        periksa(`${awal}: Angka Kunci dengan empat ubin`,
          ['Siswa dinilai', 'Ketuntasan akademik', 'Kelas di bawah ambang', 'Perlu pendampingan'].every((t) => teks.includes(t)));
        periksa(`${awal}: Angka Kunci di ATAS "Ketuntasan Antar Kelas"`,
          teks.indexOf('Angka Kunci') > 0 && teks.indexOf('Angka Kunci') < teks.indexOf('Ketuntasan Antar Kelas'));
        periksa(`${awal}: ubin memuat selisih terhadap bulan sebelumnya`, /dari Agustus/.test(teks));
        const titik = await page.locator('[class*="titikStatus"]').count();
        periksa(`${awal}: titik status di sel persen tabel rekap`, titik >= 3, `${titik} titik`);
        const warna = await page.locator('[class*="titikStatus"]').evaluateAll((els) => els.map((e) => getComputedStyle(e).backgroundColor));
        periksa(`${awal}: titik berwarna (bukan transparan)`, warna.every((w) => w && w !== 'rgba(0, 0, 0, 0)'), warna.join(' | '));
        await page.locator('table button').first().click();
        await page.waitForTimeout(300);
        const bg = await page.locator('tr[class*="barisFokus"]').first().evaluate((e) => getComputedStyle(e).backgroundColor);
        periksa(`${awal}: baris yang difokuskan diberi latar`, bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent', bg);
        const th = await page.locator('table thead th').first().evaluate((e) => getComputedStyle(e).position);
        periksa(`${awal}: kepala kolom tabel rekap lengket`, th === 'sticky', th);
        const tabular = await page.locator('[class*="ubinAngka"]').first().evaluate((e) => getComputedStyle(e).fontVariantNumeric);
        periksa(`${awal}: angka ubin tabular-nums`, /tabular-nums/.test(tabular), tabular);
      }
      await page.close();
    }
    await konteks.close();
  }

  console.log('\n--- B. keadaan memuat dan gagal ---');
  {
    const konteks = await peramban.newContext({ viewport: { width: 390, height: 800 } });
    for (const [peran, jalur, label] of HALAMAN_UJI) {
      globalThis.__tunda = 2500; globalThis.__gagal = false;
      const page = await siapkanHalaman(konteks, peran);
      await page.goto(`${ASAL}${jalur}`, { waitUntil: 'commit' });
      await page.waitForTimeout(1500);
      periksa(`${label}: kerangka tampil selagi nilai dimuat`, (await page.locator('[class*="kerangka"]').count()) >= 3);
      const teksMuat = await page.locator('body').innerText();
      periksa(`${label}: tidak ada tulisan "Belum ada nilai" yang menyesatkan saat memuat`, !teksMuat.includes('Belum ada nilai'));
      await page.waitForTimeout(3500);
      periksa(`${label}: kerangka hilang setelah data tiba`,
        (await page.locator('[class*="kerangka"]').count()) === 0 && (await page.locator('body').innerText()).includes('Ketuntasan'));
      await page.close();

      globalThis.__tunda = 0; globalThis.__gagal = true;
      const p2 = await siapkanHalaman(konteks, peran);
      await p2.goto(`${ASAL}${jalur}`, { waitUntil: 'networkidle' });
      await p2.waitForTimeout(1200);
      periksa(`${label}: layar galat punya tombol "Coba lagi"`, await p2.getByRole('button', { name: 'Coba lagi' }).isVisible());
      await p2.close();
    }
    globalThis.__tunda = 0; globalThis.__gagal = false;

    // Animasi kerangka dihormati oleh pengguna "kurangi gerak".
    const hemat = await peramban.newContext({ viewport: { width: 390, height: 800 }, reducedMotion: 'reduce' });
    globalThis.__tunda = 2500;
    const ph = await siapkanHalaman(hemat, 'kepala_sekolah');
    await ph.goto(`${ASAL}/dashboard/kepala-sekolah`, { waitUntil: 'commit' });
    await ph.waitForTimeout(1500);
    const anim = await ph.locator('[class*="kerangka"]').first().evaluate((e) => getComputedStyle(e).animationName);
    periksa('kerangka tidak beranimasi bila pengguna memilih gerak dikurangi', anim === 'none', anim);
    globalThis.__tunda = 0;
    await ph.close(); await hemat.close(); await konteks.close();
  }

  console.log('\n--- C. Playgroup: tidak ada IPA ---');
  {
    // PG: B. Indonesia dan Matematika berbentuk poin; IPA tidak dinilai.
    TABEL.sekolah[0].jenjang = 'PG';
    nilai.length = 0;
    siswa.forEach((s, i) => {
      BULAN.forEach((bulan, b) => {
        nilai.push({
          id: nilai.length + 1, nis: s.nis, kelas_id: 1, bulan, urutan_bulan: b + 1,
          rata_b_indo: null, rata_mtk: null, rata_ipa: null,
          target_tahfidz: 4, capaian_tahfidz: 3 + (i % 3), target_tahsin: 3, capaian_tahsin: 2 + (i % 4),
          target_peng_bindo: 3 + b, capaian_peng_bindo: 2 + b + (i % 3),
          target_peng_mtk: 3 + b, capaian_peng_mtk: 2 + b + (i % 4),
        });
      });
    });
    const konteks = await peramban.newContext({ viewport: { width: 1100, height: 800 } });
    for (const [peran, jalur, label] of HALAMAN_UJI) {
      const page = await siapkanHalaman(konteks, peran);
      await page.goto(`${ASAL}${jalur}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);
      const tren = page.locator('section').filter({ hasText: 'Tren Ketuntasan' }).first();
      periksa(`PG ${label}: kartu tren tampil`, (await tren.count()) > 0);
      periksa(`PG ${label}: tren hanya dua garis (B. Indonesia, Matematika)`, (await tren.locator('.recharts-line').count()) === 2);
      const teksTren = await tren.innerText();
      periksa(`PG ${label}: tren tidak menyebut IPA`, !/IPA/.test(teksTren), teksTren.replace(/\n+/g, ' ').slice(0, 120));
      if (peran === 'kepala_sekolah') {
        const kartuAngka = page.locator('section').filter({ hasText: 'Angka Kunci' }).first();
        periksa('PG kepala sekolah: ubin angka tidak menyebut IPA', !/IPA/.test(await kartuAngka.innerText()));
        const rekap = page.locator('section').filter({ hasText: 'Rekap Seluruh Kelas' }).first();
        periksa('PG kepala sekolah: tabel rekap tanpa kolom IPA', !/IPA/.test(await rekap.innerText()));
      }
      await page.close();
    }
    await konteks.close();
    TABEL.sekolah[0].jenjang = 'SD';
  }

  console.log('\n--- D. kertas ---');
  {
    // Dikembalikan ke data SD (nilai diisi ulang di bawah).
    nilai.length = 0;
    siswa.forEach((s, i) => {
      BULAN.forEach((bulan, b) => {
        nilai.push({
          id: nilai.length + 1, nis: s.nis, kelas_id: 1, bulan, urutan_bulan: b + 1,
          rata_b_indo: 74 + ((i * 7 + b * 3) % 26), rata_mtk: 70 + ((i * 11 + b * 5) % 30),
          rata_ipa: i % 9 === 4 && b === 2 ? null : 78 + ((i * 5 + b * 2) % 22),
          target_tahfidz: 4 + b, capaian_tahfidz: 3 + b + (i % 3), target_tahsin: 3 + b, capaian_tahsin: 2 + b + (i % 4),
        });
      });
    });
    const konteks = await peramban.newContext({ viewport: { width: 390, height: 780 } });
    for (const [peran, jalur, label] of HALAMAN_UJI) {
      const page = await siapkanHalaman(konteks, peran);
      await page.goto(`${ASAL}${jalur}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);
      await page.emulateMedia({ media: 'print' });
      const hasil = await page.evaluate(() => {
        window.dispatchEvent(new Event('beforeprint'));
        const kartu = (judul) => [...document.querySelectorAll('section')].find((s) => s.querySelector('h2')?.textContent.trim().startsWith(judul));
        const terlihat = (el) => Boolean(el) && el.checkVisibility();
        const titik = document.querySelector('[class*="titikStatus"]');
        return {
          tren: terlihat(kartu('Tren Ketuntasan')),
          angka: terlihat(kartu('Angka Kunci')),
          titikCetak: titik ? getComputedStyle(titik).printColorAdjust || getComputedStyle(titik).webkitPrintColorAdjust : null,
          gulir: (() => { const g = document.querySelector('[class*="gulirTinggi"]'); return g ? getComputedStyle(g).maxHeight : null; })(),
          kerangka: document.querySelectorAll('[class*="kerangka"]').length,
          barisPenyaring: terlihat(document.querySelector('[class*="barisPenyaring"]')),
        };
      });
      periksa(`${label}: kartu Tren Ketuntasan ikut tercetak`, hasil.tren === true);
      periksa(`${label}: baris penyaring (6.5) tidak tercetak, bingkainya pun tidak`, hasil.barisPenyaring === false);
      if (peran === 'kepala_sekolah') {
        periksa('kepala sekolah: kartu Angka Kunci ikut tercetak', hasil.angka === true);
        periksa('kepala sekolah: titik status tidak dibuang peramban (print-color-adjust: exact)', hasil.titikCetak === 'exact', String(hasil.titikCetak));
        periksa('kepala sekolah: tabel rekap tidak digulir di kertas (max-height: none)', hasil.gulir === 'none', String(hasil.gulir));
      }
      // Laporan siswa: kartu bulanan disembunyikan.
      const siswaMode = await page.evaluate(() => {
        document.querySelector('[data-cetak]').setAttribute('data-cetak', 'siswa');
        const kartu = (judul) => [...document.querySelectorAll('section')].find((s) => s.querySelector('h2')?.textContent.trim().startsWith(judul));
        return { tren: kartu('Tren Ketuntasan')?.checkVisibility(), angka: kartu('Angka Kunci')?.checkVisibility() };
      });
      periksa(`${label}: laporan siswa TIDAK memuat kartu Tren`, siswaMode.tren === false);
      if (peran === 'kepala_sekolah') periksa('kepala sekolah: laporan siswa TIDAK memuat Angka Kunci', siswaMode.angka === false);
      await page.close();
    }
    await konteks.close();
  }

  console.log('\n--- F. cincin fokus ---');
  {
    const konteks = await peramban.newContext({ viewport: { width: 1100, height: 800 } });
    const page = await siapkanHalaman(konteks, 'kepala_sekolah');
    await page.goto(`${ASAL}/dashboard/kepala-sekolah`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);
    /* Tombol nama kelas di tabel rekap tidak punya gaya fokus sendiri,
       jadi memakai aturan global. (Tombol aksi di kepala dan dropdown
       penyaring punya sorot bayangan sendiri sejak dulu; itu dibiarkan.) */
    for (let i = 0; i < 80; i++) {
      await page.keyboard.press('Tab');
      if (await page.evaluate(() => document.activeElement.tagName === 'BUTTON' && document.activeElement.closest('table'))) break;
    }
    const f = await page.evaluate(() => {
      const e = document.activeElement; const c = getComputedStyle(e);
      const seri1 = getComputedStyle(document.querySelector('[class*="halaman"]')).getPropertyValue('--seri-1').trim();
      return { tag: e.tagName, warna: c.outlineColor, gaya: c.outlineStyle, lebar: c.outlineWidth, seri1 };
    });
    periksa('papan ketik: elemen berfokus adalah tombol/dropdown', ['BUTTON', 'SELECT'].includes(f.tag), f.tag);
    {
      periksa('cincin fokus berwarna --seri-1 PEKAT (alfa 1), bukan 35%', f.warna === 'rgb(42, 120, 214)' && f.seri1.toLowerCase() === '#2a78d6', `${f.warna} / ${f.seri1}`);
      periksa('cincin fokus 2px solid', f.gaya === 'solid' && f.lebar === '2px', `${f.gaya} ${f.lebar}`);
    }
    await konteks.close();
  }

  console.log('\n--- E. fon ---');
  {
    const konteks = await peramban.newContext({ viewport: { width: 390, height: 800 } });
    const page = await siapkanHalaman(konteks, 'kepala_sekolah');
    const luar = [];
    page.on('request', (r) => { const u = r.url(); if (!u.startsWith(ASAL) && !u.includes('supabase.co')) luar.push(u); });
    await page.goto(`${ASAL}/dashboard/kepala-sekolah`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);
    periksa('tidak ada permintaan ke Google Fonts (fon disajikan dari domain sendiri)', !luar.some((u) => /fonts\.g/.test(u)), luar.slice(0, 2).join(' '));
    const info = await page.evaluate(async () => {
      await document.fonts.ready;
      return {
        judul: getComputedStyle(document.querySelector('h1')).fontFamily,
        isi: getComputedStyle(document.body).fontFamily,
        dimuat: [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family),
      };
    });
    periksa('judul memakai Outfit dari next/font dan fonnya termuat', /__Outfit/.test(info.judul) && info.dimuat.some((f) => /Outfit/.test(f)), info.judul.slice(0, 50));
    periksa('isi memakai Inter dari next/font dan fonnya termuat', /__Inter/.test(info.isi) && info.dimuat.some((f) => /Inter/.test(f)), info.isi.slice(0, 50));
    await konteks.close();
  }
} finally {
  await peramban.close();
  server.kill();
}

console.log(gagal ? `\n${gagal} pemeriksaan GAGAL\n` : '\nSeluruh pemeriksaan lolos.\n');
process.exit(gagal ? 1 : 0);
