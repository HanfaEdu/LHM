/**
 * Pemeriksaan sync-pg.js dari ujung ke ujung, tanpa jaringan.
 *
 *     node scripts/uji-sinkron-pg.mjs
 *
 * Menjalankan sync-pg.js APA ADANYA di dalam VM, dengan Master Rekap PG
 * tiruan (judul kolom persis seperti Master Rekap PG Kudus) dan /api/sync
 * tiruan yang merekam seluruh paket yang akan dikirim. Yang diperiksa:
 *
 *   1. Kolom Target/Capaian B. Indo & MTK terbaca, dibulatkan, dan
 *      targetnya diteruskan ke bulan kosong berikutnya.
 *   2. Kolom PG yang hilang MENGHENTIKAN sinkronisasi, bukan mengirim
 *      kosong diam-diam.
 *   3. Nama kelas di KELAS_DIHARAPKAN boleh ditulis seperti di sheet
 *      ('PG Kecil') -- tidak dilaporkan "TIDAK ditemukan".
 *   4. users_access salinan sekolah lain (wali kelas 1-6 di Master PG)
 *      diperingatkan oleh Cek Kesehatan Data.
 *   5. KODE_SEKOLAH contoh ('ISIKODE') ditolak.
 */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const asli = readFileSync(new URL('../sync-pg.js', import.meta.url), 'utf8');

function konfigurasi(kode, { kodeSekolah = 'PGYFK', nama = 'PG Yaumi Fatimah Kudus' } = {}) {
  const ganti = (dari, ke) => {
    if (!kode.includes(dari)) throw new Error('baris konfigurasi tidak ditemukan: ' + dari);
    kode = kode.replace(dari, ke);
  };
  ganti("const APP_URL = 'https://ISI_DENGAN_DOMAIN_VERCEL_ANDA.vercel.app';", "const APP_URL = 'https://uji.app';");
  ganti(/const KODE_SEKOLAH = '[^']*';/.exec(kode)[0], `const KODE_SEKOLAH = '${kodeSekolah}';`);
  ganti(/const NAMA_SEKOLAH = '[^']*';/.exec(kode)[0], `const NAMA_SEKOLAH = '${nama}';`);
  ganti(/const LINK_LHM = '[^']*';/.exec(kode)[0], "const LINK_LHM = '';");
  ganti(/const KELAS_DIHARAPKAN = \[[^\]]*\];/.exec(kode)[0],
    "const KELAS_DIHARAPKAN = ['PG Kecil', 'PG Besar 1'];");
  return kode;
}

const JUDUL = [
  'Tahun Ajaran', 'Kelas', 'Wali Kelas', 'Nama Lengkap', 'Nama Siswa', 'NISN/NIS', 'No WA',
  'Bulan', 'Target B. Indo', 'Capaian B. Indo', 'Target MTK', 'Capaian MTK',
  'Target Tahfidz', 'Capaian Tahfidz', 'Target Tahsin', 'Capaian Tahsin',
];

function barisSiswa(kelas, nama, nis, wa, bulan, isi) {
  return ['2026-2027', kelas, 'Ust Siska', nama, nama.split(' ')[0], nis, wa, bulan, ...isi];
}

function masterRekap({ tanpaKolom } = {}) {
  const judul = tanpaKolom ? JUDUL.map((j) => (j === tanpaKolom ? 'Kolom Lain' : j)) : JUDUL;
  return [
    judul,
    //                                                         tB  cB   tM cM  tTf cTf tTs cTs
    barisSiswa('PG Kecil', 'Naura Ceisya', 501, '6281234567801', 'Juli',
      [2, 2, 1, 2, 1, 2, 1, 1]),
    barisSiswa('PG Kecil', 'Areefa Shafia', 502, '6281234567802', 'Juli',
      [2, 1, 1, '1,6', 1, 1, 1, 2]),
    // Agustus: target B. Indo tidak diisi -> harus diteruskan dari Juli.
    barisSiswa('PG Kecil', 'Naura Ceisya', 501, '', 'Agustus',
      ['', 3, 2, 2, 3, 3, 2, 2]),
    barisSiswa('PG Kecil', 'Areefa Shafia', 502, '', 'Agustus',
      ['', 2, 2, 3, 3, 2, 2, 3]),
    // September: belum berjalan -- target TIDAK boleh diteruskan ke sini.
    barisSiswa('PG Kecil', 'Naura Ceisya', 501, '', 'September',
      ['', '', '', '', '', '', '', '']),
    barisSiswa('PG Besar 1', 'Lee Ji Hyun', 601, '6281234567803', 'Juli',
      [5, 6, 4, 4, 7, 7, 5, 4]),
    ['', '', '', '#N/A', '', '', '', '', '', '', '', '', '', '', '', ''],
  ];
}

// Salinan sheet users_access milik SD -- persis masalah di Master PG Kudus.
const USER_SALINAN_SD = [
  ['email', 'nama', 'role', 'kelas', 'Cakupan Jenjang'],
  ['kepsek.sd@contoh.id', 'Kepsek SD', 'Kepala_Sekolah', '', ''],
  ['wali6@contoh.id', '', 'Wali_Kelas', '6', ''],
  ['wali1@contoh.id', '', 'Wali_Kelas', '1', ''],
];
const USER_PG = [
  ['email', 'nama', 'role', 'kelas', 'Cakupan Jenjang'],
  ['siska@contoh.id', 'Ust Siska', 'Wali_Kelas', 'PG Kecil', ''],
];

function jalankan(fungsi, { master = masterRekap(), user = USER_PG, kodeOpsi } = {}) {
  const terkirim = [];
  const dialog = [];
  const lembar = { Sheet1: master, users_access: user };
  let idKelas = 0;
  const ctx = {
    Logger: { log() {} },
    SpreadsheetApp: {
      getUi: () => ({
        alert: (judul, isi) => dialog.push(judul + '\n' + isi),
        ButtonSet: { OK: 'OK' },
        createMenu: () => ({ addItem() { return this; }, addToUi() {} }),
      }),
      getActiveSpreadsheet: () => ({
        getSheetByName: (n) =>
          lembar[n] ? { getDataRange: () => ({ getValues: () => lembar[n] }) } : null,
      }),
    },
    UrlFetchApp: {
      fetch: (_url, opsi) => {
        const isi = JSON.parse(opsi.payload);
        terkirim.push(isi);
        let data = [];
        if (isi.tabel === 'sekolah') data = [{ id: 99 }];
        if (isi.tabel === 'kelas') {
          data = isi.data.map((k) => ({ ...k, id: ++idKelas }));
        }
        return {
          getResponseCode: () => 200,
          getContentText: () => JSON.stringify({ data }),
        };
      },
    },
  };
  vm.createContext(ctx);
  vm.runInContext(konfigurasi(asli, kodeOpsi), ctx);
  let lempar = null;
  let hasil = null;
  try { hasil = ctx[fungsi](); } catch (e) { lempar = e.message; }
  return { terkirim, dialog, lempar, hasil };
}

let gagal = 0;
const periksa = (nama, syarat, ket = '') => {
  if (!syarat) gagal += 1;
  console.log(`${syarat ? 'OK   ' : 'GAGAL'} ${nama}${ket ? ` — ${ket}` : ''}`);
};

// --- 1. Sinkronisasi normal ---
{
  const { terkirim, lempar } = jalankan('sinkronkanSemua');
  periksa('sinkron PG berhasil tanpa galat', lempar === null, lempar || '');

  const nilai = terkirim.filter((t) => t.tabel === 'nilai_bulanan').flatMap((t) => t.data);
  const cari = (nis, bulan) => nilai.find((n) => n.nis === `PGYFK-${nis}` && n.bulan === bulan);

  const naJuli = cari(501, 'Juli');
  periksa('capaian & target B. Indo terbaca', naJuli?.capaian_peng_bindo === 2 && naJuli?.target_peng_bindo === 2);
  periksa('capaian & target MTK terbaca', naJuli?.capaian_peng_mtk === 2 && naJuli?.target_peng_mtk === 1);
  periksa('kolom rata_* tetap kosong di PG', naJuli?.rata_b_indo === null && naJuli?.rata_mtk === null);
  periksa('poin berkoma dibulatkan ("1,6" -> 2)', cari(502, 'Juli')?.capaian_peng_mtk === 2);
  periksa('target B. Indo diteruskan ke Agustus yang kosong', cari(501, 'Agustus')?.target_peng_bindo === 2);
  periksa('target tidak diteruskan ke September yang belum berjalan',
    cari(501, 'September')?.target_peng_bindo === null);
  periksa('baris #N/A tidak ikut terkirim', !nilai.some((n) => !n.nis));

  const kelas = terkirim.find((t) => t.tabel === 'kelas')?.data || [];
  periksa('nama kelas PG terkirim (dirapikan huruf besar)',
    kelas.map((k) => k.nama_kelas).sort().join('|') === 'PG BESAR 1|PG KECIL');
  const wali = terkirim.find((t) => t.tabel === 'users_access')?.data || [];
  periksa('wali kelas PG cocok dengan nama kelasnya', wali[0]?.nama_kelas === 'PG KECIL');
  const sekolah = terkirim.find((t) => t.tabel === 'sekolah')?.data?.[0];
  periksa('sekolah terkirim ber-jenjang PG', sekolah?.jenjang === 'PG' && sekolah?.kode === 'PGYFK');
}

// --- 2. Kolom PG hilang ---
{
  const { terkirim, lempar } = jalankan('sinkronkanSemua', {
    master: masterRekap({ tanpaKolom: 'Capaian MTK' }),
  });
  periksa('kolom PG hilang -> sinkronisasi gagal dengan pesan', /Capaian MTK/.test(lempar || ''));
  periksa('kolom PG hilang -> tidak ada nilai yang terkirim',
    !terkirim.some((t) => t.tabel === 'nilai_bulanan'));
}

// --- 3 & 4. Cek Kesehatan Data ---
{
  const { hasil } = jalankan('cekKesehatanData');
  periksa('KELAS_DIHARAPKAN "PG Kecil" tidak dilaporkan hilang', !/TIDAK ditemukan/.test(hasil),
    /TIDAK ditemukan/.test(hasil) ? hasil.split('\n').find((b) => /TIDAK/.test(b)) : '');
  periksa('users_access PG yang benar tidak diperingatkan', !/salinan dari sekolah lain/.test(hasil));

  const salinan = jalankan('cekKesehatanData', { user: USER_SALINAN_SD }).hasil;
  periksa('users_access salinan SD diperingatkan', /wali6@contoh\.id/.test(salinan) && /KOSONGKAN/.test(salinan));
  periksa('akun kepala sekolah salinan ikut disebut', /kepsek\.sd@contoh\.id/.test(salinan));
}

// --- 5. Konfigurasi contoh belum diisi ---
{
  const { lempar } = jalankan('sinkronkanSemua', {
    kodeOpsi: { kodeSekolah: 'ISIKODE', nama: 'ISI_NAMA_LENGKAP_SEKOLAH_INI' },
  });
  periksa('KODE_SEKOLAH contoh ditolak', /masih berisi contoh/.test(lempar || ''));
}

console.log(gagal ? `\n${gagal} pemeriksaan GAGAL\n` : '\nSeluruh pemeriksaan lolos.\n');
process.exit(gagal ? 1 : 0);
