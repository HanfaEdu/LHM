/**
 * Pemeriksaan aturan mata pelajaran per jenjang.
 *
 *     node scripts/uji-jenjang.mjs          (butuh: next build lebih dulu)
 *
 * Playgroup tidak menilai IPA sama sekali. Aturannya ada di mapelUntuk()
 * pada lib/statistik.js, tetapi yang menentukan benar-tidaknya bukan
 * fungsi itu melainkan apakah SELURUH tempat yang menampilkan mapel sudah
 * ikut memakainya -- meteran, grafik kelas, tabel sebaran, rekap antar
 * kelas, grafik tahunan per siswa, tabel rincian bulanan, dan rapor orang
 * tua. Satu saja yang terlewat akan menampilkan kolom IPA kosong di
 * dasbor PG, dan itu terbaca sebagai data yang belum diisi -- bukan
 * sebagai pelajaran yang memang tidak ada.
 *
 * Karena itu yang diperiksa di sini bukan fungsinya, melainkan halaman
 * jadinya: kata "IPA" tidak boleh muncul sama sekali pada jenjang PG, dan
 * WAJIB muncul pada jenjang SD. Keduanya dijalankan dengan data yang
 * sama persis, hanya berbeda jenjang sekolahnya.
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

const PORT = 3989;
const ASAL = `http://127.0.0.1:${PORT}`;

/* ----------------------------------------------------------------
   Data contoh -- SAMA untuk kedua jenjang, termasuk nilai IPA-nya.
   ----------------------------------------------------------------
   Nilai IPA sengaja DIISI walau jenjangnya PG. Kalau data contohnya
   dikosongkan, uji ini akan lolos hanya karena tidak ada datanya, bukan
   karena aturannya bekerja.
   ---------------------------------------------------------------- */
const siswa = Array.from({ length: 12 }, (_, i) => ({
  nis: `SDYFK-${401 + i}`,
  nama_lengkap: `Siswa Contoh ${i + 1}`,
  nama_panggilan: `Anak${i + 1}`,
}));

const nilai = siswa.map((s, i) => ({
  id: i + 1,
  nis: s.nis,
  kelas_id: 1,
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

function tabel(jenjang, peran) {
  return {
    users_access: {
      email: 'guru@contoh.sch.id',
      nama: 'Ustadzah Contoh',
      role: peran,
      nama_kelas: 'A1',
    },
    sekolah: [{
      id: 1, kode: 'PGYFK', nama: 'Sekolah Contoh',
      area: 'Pati Raya', jenjang, link_lhm: 'https://contoh.app/',
    }],
    kelas: [{
      id: 1, tahun_ajaran: '2026-2027', nama_kelas: 'A1',
      wali_kelas: 'Ustadzah Contoh', target_akademik: 90,
    }],
    penempatan: siswa.map((s) => ({ nis: s.nis, siswa: s })),
    nilai_bulanan: nilai,
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

async function bukaDasbor(konteks, jenjang, peran, jalur) {
  const page = await konteks.newPage();
  const isi = tabel(jenjang, peran);

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
        email: 'guru@contoh.sch.id',
        app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z',
      },
    }));
  });

  await page.goto(`${ASAL}${jalur}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  return page;
}

/** Membuka seluruh penelusuran supaya grafik & tabel per siswa ikut terbentuk. */
async function bukaTelusur(page, peran) {
  if (peran === 'kepala_sekolah') {
    await page.locator('section').filter({ hasText: 'Rincian Per Kelas' })
      .first().locator('select').first().selectOption('1');
    await page.waitForTimeout(500);
    await page.locator('section').filter({ hasText: 'Telusur Satu Siswa' })
      .first().locator('select').first().selectOption('1');
    await page.waitForTimeout(400);
  }
  await page.getByLabel('Nama Siswa').selectOption(siswa[0].nis);
  await page.waitForTimeout(900);
}

const server = await jalankanServer();
const peramban = await chromium.launch();
const konteks = await peramban.newContext({ viewport: { width: 1280, height: 900 } });

try {
  for (const [peran, jalur, label] of [
    ['wali_kelas', '/dashboard/wali-kelas', 'wali kelas'],
    ['kepala_sekolah', '/dashboard/kepala-sekolah', 'kepala sekolah'],
  ]) {
    for (const jenjang of ['SD', 'PG']) {
      const page = await bukaDasbor(konteks, jenjang, peran, jalur);
      await bukaTelusur(page, peran);

      const teks = await page.locator('body').innerText();
      /* Diperiksa dari TEKS HALAMAN, bukan dari jumlah elemen: nama mapel
         muncul di meteran, judul kolom, dan legenda grafik sekaligus, dan
         satu pemeriksaan ini menangkap ketiganya. */
      const adaIPA = /\bIPA\b/.test(teks);
      const adaMtk = /Matematika|\bMTK\b/.test(teks);
      const adaBIndo = /B\. Ind(onesia|o)/.test(teks);
      const adaQuran = /Tahfidz/.test(teks) && /Tahsin/.test(teks);

      console.log(`\n--- ${label}, jenjang ${jenjang} ---`);
      periksa('halaman termuat tanpa galat', !teks.includes('Application error'));
      periksa('Bahasa Indonesia tampil', adaBIndo);
      periksa('Matematika tampil', adaMtk);
      periksa('Tahfidz dan Tahsin tampil', adaQuran);

      if (jenjang === 'PG') {
        periksa('IPA TIDAK tampil sama sekali', !adaIPA,
          adaIPA ? 'masih ada "IPA" di halaman' : 'bersih');
      } else {
        periksa('IPA tampil (jenjang SD tidak boleh ikut kehilangan IPA)', adaIPA);
      }

      await page.close();
    }
  }

  /* ----------------------------------------------------------------
     Rapor orang tua
     ----------------------------------------------------------------
     Jalurnya berbeda dari dasbor: jenjang dibawa oleh jawaban /api/rapor,
     bukan oleh query Supabase dari peramban. Jadi ia bisa putus sendiri
     tanpa membuat dasbor ikut gagal -- karena itu diuji terpisah. */
  const BULAN12 = [
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  ];
  for (const jenjang of ['SD', 'PG']) {
    const page = await konteks.newPage();
    await page.route('**/api/rapor', (r) =>
      r.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          anak: { nama_lengkap: 'Anak Contoh', nama_panggilan: 'Anak' },
          sekolah: { nama: 'Sekolah Contoh', jenjang },
          kelas: {
            nama_kelas: 'A1', wali_kelas: 'Ustadzah Contoh',
            tahun_ajaran: '2026-2027', target_akademik: 90,
          },
          tahunAjaranTersedia: ['2026-2027'],
          bulanan: BULAN12.map((b, i) => (i < 2
            ? {
                bulan: b, rata_b_indo: 85 + i, rata_mtk: 82 + i, rata_ipa: 78 + i,
                target_akademik: 90,
                target_tahfidz: 5, capaian_tahfidz: 4 + i, nama_tahfidz: 'Al Falaq',
                target_tahsin: 4, capaian_tahsin: 3 + i, nama_tahsin: 'Fathah',
              }
            : {
                bulan: b, rata_b_indo: null, rata_mtk: null, rata_ipa: null,
                target_akademik: 90,
                target_tahfidz: null, capaian_tahfidz: null, nama_tahfidz: null,
                target_tahsin: null, capaian_tahsin: null, nama_tahsin: null,
              })),
          perbandingan: Object.fromEntries(['Juli', 'Agustus'].map((b, i) => [b,
            ['A-1', 'Anak', 'B-1', 'C-1'].map((label, j) => ({
              label, anak: label === 'Anak',
              rata_b_indo: 76 + j * 3 + i, rata_mtk: 74 + j * 4, rata_ipa: 80 + j * 2,
              target_tahfidz: 5, capaian_tahfidz: 4 + (j % 3),
              target_tahsin: 4, capaian_tahsin: 3 + (j % 2),
            })),
          ])),
        }),
      })
    );
    await page.goto(`${ASAL}/rapor/uji-token-jenjang`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);

    const teks = await page.locator('body').innerText();
    const adaIPA = /\bIPA\b/.test(teks);

    console.log(`\n--- rapor orang tua, jenjang ${jenjang} ---`);
    periksa('halaman termuat tanpa galat',
      !teks.includes('Application error') && teks.includes('Anak'));
    periksa('Bahasa Indonesia tampil', /B\. Ind(onesia|o)/.test(teks));
    periksa('Matematika tampil', /Matematika/.test(teks));
    if (jenjang === 'PG') {
      periksa('IPA TIDAK tampil sama sekali', !adaIPA,
        adaIPA ? 'masih ada "IPA" di halaman' : 'bersih');
    } else {
      periksa('IPA tampil', adaIPA);
    }
    await page.close();
  }
} finally {
  await peramban.close();
  server.kill('SIGTERM');
}

console.log(gagal ? `\n${gagal} pemeriksaan GAGAL\n` : '\nSeluruh pemeriksaan lolos.\n');
process.exit(gagal ? 1 : 0);
