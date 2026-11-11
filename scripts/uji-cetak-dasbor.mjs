/**
 * Pemeriksaan hasil cetak dasbor wali kelas dan kepala sekolah.
 *
 *     node scripts/uji-cetak-dasbor.mjs            (butuh: next build lebih dulu)
 *
 * Yang diperiksa BUKAN "apakah halamannya terbuka", melainkan hal-hal
 * yang hanya muncul pada media cetak dan karena itu tidak pernah terlihat
 * saat mengembangkan di layar:
 *
 *   1. Lebar grafik. Recharts mematok lebar SVG dari pengukuran di layar
 *      dan tidak pernah mengukur ulang untuk kertas. Kalau mesin cetak di
 *      app/komponen/cetak.jsx putus, grafik akan tercetak selebar layar
 *      di tengah kertas A4 -- dan tidak ada satu pun galat yang muncul.
 *   2. Tidak ada yang melewati tepi kanan kertas.
 *   3. Kontrol (dropdown, tombol) benar-benar hilang, dan judul dokumen
 *      serta kaki berulang benar-benar muncul.
 *   4. Jumlah halaman masih wajar.
 *   5. Dua skenario cetak: laporan BULANAN tidak memuat "Telusur Satu
 *      Siswa" sama sekali; tombol "Cetak Laporan Siswa" mencetak HANYA
 *      bagian itu, untuk siswa yang sedang dipilih.
 *
 * Supabase tidak dihubungi sama sekali: seluruh permintaannya dicegat dan
 * dijawab data contoh, dan sesi login dipalsukan lewat localStorage. Jadi
 * berkas ini aman dijalankan siapa pun tanpa kunci apa pun.
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

const PORT = 3987;
const ASAL = `http://127.0.0.1:${PORT}`;
const keluaran = mkdtempSync(join(tmpdir(), 'cetak-'));

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

async function ukurCetak(page, label, kirimBeforeprint = true) {
  await page.emulateMedia({ media: 'print' });

  /* Dinyalakan dan DIUKUR DALAM SATU evaluate yang sama, tanpa jeda
     sedikit pun.
     
     Ini bukan kerewelan: peramban memotret halaman SEGERA setelah
     penangan beforeprint selesai, dalam bingkai yang sama. Versi
     sebelumnya menunggu 400ms lebih dulu, dan jeda itu memberi Recharts
     waktu menyelesaikan animasi batangnya -- sehingga uji ini lolos
     sementara hasil cetak sungguhan di PC keluar dengan batang yang
     menembus garis dasar dan menutupi nama siswa. Jeda pada uji cetak
     menguji halaman yang tidak pernah dicetak siapa pun. */
  /* kirimBeforeprint=false untuk skenario tombol "Cetak Laporan Siswa":
     di sana halaman sudah disiapkan oleh cetak() milik tombolnya sendiri,
     jadi beforeprint tidak boleh dikirim lagi (ia hanya akan menyiapkan
     ulang keadaan yang sama). */
  const hasil = await page.evaluate((kirim) => {
    if (kirim) window.dispatchEvent(new Event('beforeprint'));
    /* checkVisibility(), bukan getComputedStyle(el).display: display
       milik elemen sendiri tetap 'block' walau LELUHURNYA yang
       disembunyikan, sehingga pemeriksaan naif menyatakan dropdown masih
       tercetak padahal seluruh baris penyaringnya sudah hilang. */
    const terlihat = (el) => el.checkVisibility();
    /* Grafik dan tabel dihitung hanya yang TERLIHAT di kertas. Sejak
       laporan bulanan dan laporan siswa memuat bagian yang berbeda,
       sebagian grafik sengaja disembunyikan di tiap skenario; yang
       disembunyikan berlebar 0 dan bukan bagian dari lembar cetak. */
    const svg = [...document.querySelectorAll('.recharts-surface')].filter(terlihat);
    const tabel = [...document.querySelectorAll('table')].filter(terlihat);
    const lebarBadan = document.body.scrollWidth;
    return {
      lebarBadan,
      lebarSvg: svg.map((s) => Math.round(s.getBoundingClientRect().width)),
      lebarTabel: tabel.map((t) => Math.round(t.getBoundingClientRect().width)),
      kananTerjauh: Math.max(
        0,
        ...[...document.querySelectorAll('.recharts-surface, table, footer, div, section')]
          .filter(terlihat)
          .map((el) => Math.round(el.getBoundingClientRect().right))
      ),
      adaSelect: [...document.querySelectorAll('select')].some(terlihat),
      adaTombol: [...document.querySelectorAll('button, a[href]')].some(terlihat),
      teks: document.body.innerText,

      /* Dua cara grafik bisa rusak saat dicetak, keduanya tanpa galat
         apa pun, dan keduanya hanya terlihat di PDF yang sudah
         terlanjur dikirim.

         1. tembusTerjauh -- batang menembus ke BAWAH garis dasar sumbu
            X. Di situlah nama siswa ditulis, jadi batang yang
            melewatinya menutupi nama. Terjadi kalau grafik dibiarkan
            MENGANIMASIKAN dirinya dari ukuran layar ke ukuran kertas.

         2. batangKerdil -- batang tergambar setinggi hampir nol karena
            terpotret di tengah animasi MASUK. Grafiknya praktis kosong,
            tetapi pemeriksaan (1) tetap lolos: batang setinggi nol
            memang tidak menutupi nama siapa pun. */
      /* Tiga cara grafik bisa rusak saat dicetak, semuanya tanpa galat
         apa pun, dan semuanya hanya terlihat di PDF yang sudah
         terlanjur dikirim.

         1. tembusTerjauh -- batang menembus ke BAWAH garis dasar sumbu
            X. Di situlah nama siswa ditulis, jadi batang yang
            melewatinya menutupi nama. Terjadi kalau grafik dibiarkan
            MENGANIMASIKAN dirinya dari ukuran layar ke ukuran kertas.

         2. grafikKosong -- ada grafik yang batangnya tidak tergambar
            sama sekali, atau tergambar setinggi hampir nol karena
            terpotret di tengah animasi MASUK. Pemeriksaan (1) tetap
            lolos untuk kasus ini: batang setinggi nol memang tidak
            menutupi nama siapa pun.

         DIUKUR PER GRAFIK, bukan digabung. Versi sebelumnya menjumlahkan
         seluruh grafik pada halaman, sehingga satu grafik akademik yang
         batangnya tinggi menutupi kenyataan bahwa grafik Tahfidz dan
         Tahsin di bawahnya keluar kosong melompong. */
      ...(() => {
        const perGrafik = svg
          .map((svg) => {
            const garis = svg.querySelector('.recharts-xAxis .recharts-cartesian-axis-line');
            if (!garis) return null;
            const dasar = garis.getBoundingClientRect().bottom;
            const tinggiPlot = dasar - svg.getBoundingClientRect().top;
            const batang = [...svg.querySelectorAll(
              '.recharts-bar-rectangle path, .recharts-bar-rectangle rect'
            )].map((b) => b.getBoundingClientRect());
            /* Apakah grafik ini MEMANG punya seri batang. Diambil dari
               lapisan .recharts-bar, bukan dari ada-tidaknya persegi:
               grafik yang batangnya lenyap tetap punya lapisannya, dan
               justru itulah yang hendak ditangkap. Tidak boleh diambil
               dari "ada garis seri atau tidak" -- grafik Tahfidz dan
               Tahsin punya garis target, dan aturan itu membuat
               keduanya terkecuali dari pemeriksaan padahal merekalah
               yang paling sering keluar kosong. */
            const punyaSeriBatang = svg.querySelectorAll('.recharts-bar').length > 0;
            return {
              batang: batang.length,
              punyaSeriBatang,
              tertinggi: Math.max(0, ...batang.map((r) => r.height)),
              tembus: Math.max(0, ...batang.map((r) => r.bottom - dasar)),
              tinggiPlot,
            };
          })
          .filter(Boolean);

        /* Garis ambang (ReferenceLine) harus membentang PENUH dari tepi
           kiri ke tepi kanan bidang gambar. Kalau suatu saat ia kembali
           digambar sebagai seri Line, ujungnya akan berhenti di titik
           tengah kategori pertama dan terakhir -- menggantung, dan pada
           grafik berkategori sedikit (tujuh kelas) selisih itu langsung
           terbaca sebagai garis yang kurang panjang. */
        const celahAmbang = svg
          .flatMap((svg) => {
            const ref = svg.querySelector('.recharts-reference-line line');
            const kisi = svg.querySelector('.recharts-cartesian-grid-horizontal line');
            if (!ref || !kisi) return [];
            const r = ref.getBoundingClientRect();
            const k = kisi.getBoundingClientRect();
            return [Math.round(Math.max(r.left - k.left, k.right - r.right))];
          });

        return {
          jumlahGrafik: perGrafik.length,
          adaAmbang: celahAmbang.length,
          celahAmbangTerbesar: celahAmbang.length ? Math.max(...celahAmbang) : 0,
          tembusTerjauh: Math.round(Math.max(0, ...perGrafik.map((g) => g.tembus))),
          /* Grafik berseri batang yang tidak menggambar apa pun, atau
             yang batang tertingginya belum mencapai seperempat bidang
             gambarnya sendiri. */
          grafikKosong: perGrafik.filter(
            (g) => g.punyaSeriBatang && (g.batang === 0 || g.tertinggi < g.tinggiPlot * 0.25)
          ).length,
          rincianGrafik: perGrafik
            .map((g) => `${g.batang}b/${Math.round(g.tertinggi)}px`)
            .join(' '),
        };
      })(),
    };
  }, kirimBeforeprint);

  const pdf = join(keluaran, `${label}.pdf`);
  await page.pdf({ path: pdf, format: 'A4', printBackground: true, preferCSSPageSize: true });
  return { ...hasil, pdf };
}

/* ----------------------------------------------------------------
   Jalan
   ---------------------------------------------------------------- */
const HALAMAN = [
  ['wali_kelas', '/dashboard/wali-kelas', 'wali-kelas'],
  ['kepala_sekolah', '/dashboard/kepala-sekolah', 'kepala-sekolah'],
];

/* Membuka halaman dan memilih satu siswa. Dibuka pada lebar 390px (HP):
   di sinilah kesalahan lebar grafik paling merusak, karena selisih
   layar-kertas paling besar. Tiap skenario memakai halaman SEGAR, supaya
   keadaan sisa skenario sebelumnya tidak ikut terukur. */
async function bukaDanPilihSiswa(konteks, peran, jalur) {
  const page = await siapkanHalaman(konteks, peran);
  await page.goto(`${ASAL}${jalur}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);

  /* Kedua penelusuran dibuka supaya isi laporan yang sebenarnya ikut
     diuji, bukan cuma kepala halamannya. Dipilih lewat posisi bagian,
     bukan lewat teks label: di dasbor kepala sekolah ada dua label
     yang sama-sama memuat kata "Kelas". */
  if (peran === 'kepala_sekolah') {
    // "Rincian Per Kelas" -- grafik, sebaran, Tahfidz/Tahsin satu kelas.
    await page.locator('section').filter({ hasText: 'Rincian Per Kelas' })
      .first().locator('select').first().selectOption('1');
    await page.waitForTimeout(500);
    // "Telusur Satu Siswa" -- kelasnya dulu, daftar nama menyusul.
    const telusur = page.locator('section').filter({ hasText: 'Telusur Satu Siswa' }).first();
    await telusur.locator('select').first().selectOption('1');
    await page.waitForTimeout(400);
  }
  await page.getByLabel('Nama Siswa').selectOption(siswa[0].nis);
  await page.waitForTimeout(900);
  return page;
}

/* Bidang isi A4 = 210mm - 2x12mm = 186mm = 703px pada 96dpi. */
const BATAS = 703;

/* Pemeriksaan yang berlaku di KEDUA skenario cetak. */
function periksaBersama(h) {
  periksa('grafik memakai lebar kertas, bukan lebar layar',
    h.lebarSvg.length > 0 && h.lebarSvg.every((l) => l > 600),
    `lebar SVG: ${[...new Set(h.lebarSvg)].join(', ')}`);
  periksa('tidak ada grafik yang melewati bidang isi A4',
    h.lebarSvg.every((l) => l <= BATAS), `batas ${BATAS}px`);
  periksa('tidak ada tabel yang melewati bidang isi A4',
    h.lebarTabel.every((l) => l <= BATAS),
    `lebar tabel: ${[...new Set(h.lebarTabel)].join(', ')}`);
  periksa('tidak ada isi yang menyembul ke luar halaman',
    h.kananTerjauh <= BATAS + 1, `tepi terjauh ${h.kananTerjauh}px`);
  periksa('dropdown tidak ikut tercetak', !h.adaSelect);
  periksa('tombol tidak ikut tercetak', !h.adaTombol);
  periksa('batang grafik tidak menembus garis dasar (menimpa nama siswa)',
    h.tembusTerjauh <= 2, `tembus ${h.tembusTerjauh}px ke bawah garis`);
  periksa('tidak ada grafik yang keluar kosong',
    h.jumlahGrafik > 0 && h.grafikKosong === 0,
    `${h.jumlahGrafik} grafik → ${h.rincianGrafik}`);
  periksa('kaki mencantumkan nama sekolah',
    h.teks.includes('SD Yaumi Fatimah Kudus'));
  periksa('kaki mencantumkan tanggal cetak', h.teks.includes('dicetak'));
  periksa('daftar keterangan poin tidak ikut tercetak',
    !h.teks.includes('Lihat keterangan seluruh capaian'));
}

const server = await jalankanServer();
const peramban = await chromium.launch();
const konteks = await peramban.newContext({ viewport: { width: 390, height: 780 } });
const NAMA_LENGKAP = siswa[0].nama_lengkap;

try {
  for (const [peran, jalur, label] of HALAMAN) {
    /* ============================================================
       Skenario 1 -- laporan BULANAN (Ctrl+P / beforeprint)
       Bagian "Telusur Satu Siswa" TIDAK BOLEH ikut tercetak, walau
       siswanya sudah dipilih di layar.
       ============================================================ */
    console.log(`\n=== ${label} · cetak bulanan (dibuka pada layar 390px) ===`);
    {
      const page = await bukaDanPilihSiswa(konteks, peran, jalur);

      const isiLayar = await page.locator('body').innerText();
      periksa('halaman termuat tanpa galat',
        !isiLayar.includes('Application error'),
        isiLayar.slice(0, 60).replace(/\n+/g, ' '));
      periksa('tabel rincian bulanan ada di layar',
        (await page.locator('table').count()) > 0);
      periksa('nama surah tampil di tabel', isiLayar.includes('Rincian Bulanan'));

      /* Telusur harus tetap hidup di LAYAR: yang disembunyikan hanya
         hasil cetaknya. */
      periksa('Telusur Satu Siswa tetap tampil di layar',
        isiLayar.includes('Telusur Satu Siswa'));
      periksa('tombol "Cetak Laporan Siswa" tampil di layar setelah siswa dipilih',
        await page.getByRole('button', { name: 'Cetak Laporan Siswa' }).isVisible());

      const h = await ukurCetak(page, `${label}-bulanan`);
      periksaBersama(h);
      periksa('garis ambang membentang penuh ke kedua tepi bidang gambar',
        h.adaAmbang > 0 && h.celahAmbangTerbesar <= 2,
        `${h.adaAmbang} garis ambang, celah terbesar ${h.celahAmbangTerbesar}px`);
      periksa('judul dokumen tercetak', h.teks.includes('Laporan Bulanan'));
      periksa('judul laporan siswa TIDAK tercetak di laporan bulanan',
        !h.teks.includes('Laporan Capaian Siswa'));
      periksa('judul bagian "Telusur Satu Siswa" TIDAK ikut tercetak',
        !h.teks.includes('Telusur Satu Siswa'));
      periksa('nama lengkap siswa yang ditelusuri TIDAK ikut tercetak',
        !h.teks.includes(NAMA_LENGKAP), NAMA_LENGKAP);
      periksa('tombol "Cetak Laporan Siswa" tidak ikut tercetak',
        !h.teks.includes('Cetak Laporan Siswa'));
      if (peran === 'kepala_sekolah') {
        periksa('judul rincian per kelas menyebut kelasnya',
          /Rincian Per Kelas · Kelas 2A/.test(h.teks));
      }
      console.log(`     PDF: ${h.pdf}`);
      await page.close();
    }

    /* ============================================================
       Skenario 2 -- klik tombol "Cetak Laporan Siswa"
       Yang tercetak HANYA bagian Telusur untuk siswa terpilih, dengan
       judul dan kaki yang menyebut nama siswa.

       window.print ditimpa: dialog cetak sungguhan tidak bisa dibuka
       di peramban tanpa kepala. Penimpa hanya mencatat bahwa print()
       dipanggil; keadaan halaman (data-cetak, KonteksCetak) yang
       disiapkan tombolnya tetap utuh, dan itulah yang diukur.
       ============================================================ */
    console.log(`\n=== ${label} · tombol "Cetak Laporan Siswa" (dibuka pada layar 390px) ===`);
    {
      const page = await bukaDanPilihSiswa(konteks, peran, jalur);
      await page.evaluate(() => {
        window.__printDipanggil = false;
        window.print = () => { window.__printDipanggil = true; };
      });
      await page.getByRole('button', { name: 'Cetak Laporan Siswa' }).click();
      await page.waitForFunction(() => window.__printDipanggil === true, null, { timeout: 5000 });

      const h = await ukurCetak(page, `${label}-siswa`, false);
      periksaBersama(h);
      periksa('judul "Laporan Capaian Siswa" tercetak', h.teks.includes('Laporan Capaian Siswa'));
      periksa('nama lengkap siswa tercetak', h.teks.includes(NAMA_LENGKAP), NAMA_LENGKAP);
      periksa('kaki menyebut nama siswa dan kelasnya',
        new RegExp(`${NAMA_LENGKAP} · Kelas 2A`).test(h.teks));
      periksa('"Rekap Seluruh Kelas" TIDAK tercetak', !h.teks.includes('Rekap Seluruh Kelas'));
      periksa('"Ketuntasan" TIDAK tercetak', !h.teks.includes('Ketuntasan'));
      periksa('judul laporan bulanan TIDAK tercetak', !h.teks.includes('Laporan Bulanan'));
      periksa('tabel rincian bulanan siswa tercetak', h.teks.includes('Rincian Bulanan'));
      console.log(`     PDF: ${h.pdf}`);
      await page.close();
    }
  }
} finally {
  await peramban.close();
  server.kill('SIGTERM');
}

console.log(gagal ? `\n${gagal} pemeriksaan GAGAL\n` : '\nSeluruh pemeriksaan lolos.\n');
process.exit(gagal ? 1 : 0);
