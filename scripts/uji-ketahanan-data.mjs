/**
 * Pemeriksaan Fase 5 — ketahanan data.
 *
 *     node scripts/uji-ketahanan-data.mjs
 *
 *   A. lib/ambil-semua.js: seluruh baris terbaca walau lebih dari 1.000,
 *      tanpa terlewat atau terbaca dua kali, dan galat tidak ditelan.
 *   B. lib/statistik.js: cap waktu sinkronisasi terakhir (5.5).
 *   C. sync.js DAN sync-pg.js, dijalankan apa adanya di VM (5.3 dan 5.4):
 *      nilai di luar 0-100 dikirim kosong dan dilaporkan; NIS yang
 *      tercatat di dua kelas dilaporkan dengan kalimat yang benar.
 *   D. perawatan/penempatan-ganda.sql di Postgres sungguhan sekali pakai:
 *      hanya kelas kosong yang dihapus, ROLLBACK bawaan tidak mengubah
 *      apa pun, dan COMMIT menghapus tepat yang dijanjikan.
 *
 * Tidak menyentuh jaringan, Supabase, maupun basis data produksi. Bagian
 * D dilewati dengan pemberitahuan (bukan dianggap lolos) bila Postgres
 * tidak terpasang.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import vm from 'node:vm';
import { ambilSemua } from '../lib/ambil-semua.js';
import { formatWaktuSinkron, terakhirSinkron } from '../lib/statistik.js';

let gagal = 0;
function periksa(nama, syarat, keterangan = '') {
  if (!syarat) gagal += 1;
  console.log(`${syarat ? 'OK   ' : 'GAGAL'} ${nama}${keterangan ? ` — ${keterangan}` : ''}`);
}

/* ================================================================ A */
console.log('\n--- A. ambilSemua ---');
{
  /** Query tiruan: tabel `n` baris berkunci 1..n, dengan batas 1.000 per jawaban seperti PostgREST. */
  const buatTiruan = (n, { galatDiHalaman = null } = {}) => {
    const catatan = { dibangun: 0, rentang: [] };
    const buat = () => {
      catatan.dibangun += 1;
      return {
        range(dari, sampai) {
          catatan.rentang.push([dari, sampai]);
          if (galatDiHalaman !== null && catatan.rentang.length === galatDiHalaman) {
            return Promise.resolve({ data: null, error: new Error('putus di tengah') });
          }
          const baris = [];
          for (let i = dari; i <= Math.min(sampai, n - 1, dari + 999); i += 1) baris.push({ id: i + 1 });
          return Promise.resolve({ data: baris, error: null });
        },
      };
    };
    return { buat, catatan };
  };

  let t = buatTiruan(2500);
  let hasil = await ambilSemua(t.buat);
  periksa('2.500 baris terbaca seluruhnya', hasil.length === 2500, `${hasil.length} baris`);
  periksa('tanpa baris ganda dan tanpa yang terlewat',
    new Set(hasil.map((b) => b.id)).size === 2500 && hasil[0].id === 1 && hasil[2499].id === 2500);
  periksa('tiga halaman (0-999, 1000-1999, 2000-2999)', t.catatan.rentang.length === 3
    && t.catatan.rentang[2][0] === 2000, JSON.stringify(t.catatan.rentang));
  periksa('query dibangun BARU tiap halaman', t.catatan.dibangun === 3, `${t.catatan.dibangun} kali`);

  t = buatTiruan(1000);
  hasil = await ambilSemua(t.buat);
  periksa('tepat 1.000 baris: halaman kosong menutup perulangan', hasil.length === 1000 && t.catatan.rentang.length === 2);

  t = buatTiruan(0);
  hasil = await ambilSemua(t.buat);
  periksa('tabel kosong -> larik kosong', hasil.length === 0 && t.catatan.rentang.length === 1);

  t = buatTiruan(999);
  hasil = await ambilSemua(t.buat);
  periksa('999 baris -> satu halaman saja', hasil.length === 999 && t.catatan.rentang.length === 1);

  t = buatTiruan(2500, { galatDiHalaman: 2 });
  let galat = null;
  try { await ambilSemua(t.buat); } catch (e) { galat = e; }
  periksa('galat di halaman ke-2 dilempar, bukan ditelan', galat && galat.message === 'putus di tengah');

  t = buatTiruan(25);
  hasil = await ambilSemua(t.buat, 10);
  periksa('ukuran halaman bisa diatur (25 baris @10 = 3 halaman)', hasil.length === 25 && t.catatan.rentang.length === 3);
}

/* ================================================================ B */
console.log('\n--- B. cap waktu sinkronisasi ---');
{
  periksa('format WIB: 07.05 UTC -> 14.05', formatWaktuSinkron('2026-11-10T07:05:00Z') === '10 November 2026 14.05',
    formatWaktuSinkron('2026-11-10T07:05:00Z'));
  periksa('lewat tengah malam WIB ikut ganti hari dan tahun', formatWaktuSinkron('2026-12-31T20:00:00Z') === '1 Januari 2027 03.00');
  periksa('format dengan pecahan detik dan offset', formatWaktuSinkron('2026-11-10T14:05:00.123+07:00') === '10 November 2026 14.05');
  periksa('kosong/rusak -> null', formatWaktuSinkron(null) === null && formatWaktuSinkron('bukan tanggal') === null);

  const a = [{ disinkron_pada: '2026-11-10T07:05:00Z' }, { disinkron_pada: null }];
  const b = [{ disinkron_pada: '2026-11-11T01:00:00.123+00:00' }, {}];
  periksa('mengambil yang TERBARU dari beberapa larik', terakhirSinkron(a, b) === '2026-11-11T01:00:00.123+00:00');
  periksa('dibandingkan menurut waktu, bukan teks',
    terakhirSinkron([{ disinkron_pada: '2026-11-10T20:00:00+07:00' }, { disinkron_pada: '2026-11-10T14:00:00Z' }]) === '2026-11-10T14:00:00Z');
  periksa('tanpa satu pun waktu -> null', terakhirSinkron([], [{}], undefined, [null]) === null);
}

/* ================================================================ C */
const BERKAS = [['sync.js', false], ['sync-pg.js', true]];

const HEADER = [
  'Tahun Ajaran', 'Kelas', 'Wali Kelas', 'Nama Lengkap', 'Nama Siswa', 'NISN/NIS', 'No WA', 'Bulan',
  'Target 3 Mapel', 'Rata B. Indo', 'Rata MTK', 'Rata IPA',
  'Target Tahfidz', 'Capaian Tahfidz', 'Target Tahsin', 'Capaian Tahsin',
];
const baris = (kelas, nama, nis, bulan, bindo, mtk, ipa) =>
  ['2026-2027', kelas, 'Bu Wali', nama, nama.split(' ')[0], nis, '081234567890', bulan, 90, bindo, mtk, ipa, '', '', '', ''];

function muatSkrip(berkas, tabel) {
  const kode = readFileSync(new URL(`../${berkas}`, import.meta.url), 'utf8');
  const log = [];
  const ctx = {
    Logger: { log: (t) => log.push(String(t)) },
    SpreadsheetApp: {
      getUi: () => ({
        alert() {},
        ButtonSet: { OK: 'OK' },
        createMenu: () => ({ addItem() { return this; }, addToUi() {} }),
      }),
      getActiveSpreadsheet: () => ({
        getSheetByName: (n) => (n === 'Sheet1'
          ? { getDataRange: () => ({ getValues: () => tabel }) }
          : null),
      }),
    },
  };
  vm.createContext(ctx);
  vm.runInContext(kode, ctx);
  return { ctx, log };
}

for (const [berkas] of BERKAS) {
  console.log(`\n--- C. ${berkas} ---`);
  const tabel = [
    HEADER,
    baris('2A', 'Ani Lestari', 'N1', 'Oktober', 105, 90, 88),    // 105: di luar rentang
    baris('2A', 'Budi Santoso', 'N2', 'Oktober', 85, -3, 100),   // -3: di luar; 100: sah (batas)
    baris('2A', 'Citra Dewi', 'N3', 'Oktober', 0, 100, 87.5),    // 0 dan 100: sah
    baris('2B', 'Dina Mawar', 'N4', 'Oktober', 90, 90, 90),
    baris('2A', 'Dina Mawar', 'N4', 'Oktober', 90, 90, 90),      // pindah kelas: satu nama, dua kelas
    baris('2A', 'Eka Putra', 'N5', 'Oktober', 90, 90, 90),
    baris('2B', 'Fajar Nugroho', 'N5', 'Oktober', 90, 90, 90),   // NIS sama, NAMA beda
  ];
  const { ctx, log } = muatSkrip(berkas, tabel);
  const isi = ctx.bacaMasterRekap();

  const nilaiDari = (nis, kunci) => isi.nilai.find((n) => n.nis === nis && n.nama_kelas === '2A')[kunci];
  periksa('105 dikirim kosong (null)', nilaiDari('N1', 'rata_b_indo') === null);
  periksa('-3 dikirim kosong (null)', nilaiDari('N2', 'rata_mtk') === null);
  periksa('100 (batas atas) tetap masuk', nilaiDari('N2', 'rata_ipa') === 100);
  periksa('0 (batas bawah) tetap masuk dan BUKAN dianggap kosong', nilaiDari('N3', 'rata_b_indo') === 0);
  periksa('nilai pecahan sah tetap masuk', nilaiDari('N3', 'rata_ipa') === 87.5);
  periksa('nilai lain di baris yang sama tidak ikut terbuang', nilaiDari('N1', 'rata_mtk') === 90);
  periksa('dua nilai di luar rentang tercatat', isi.nilaiDiLuarRentang.length === 2, `${isi.nilaiDiLuarRentang.length}`);
  const catat = isi.nilaiDiLuarRentang.find((x) => x.nama === 'Ani Lestari');
  periksa('catatan memuat kelas, bulan, nama, mapel, nilai',
    Boolean(catat) && catat.kelas === '2A' && catat.bulan === 'Oktober' && catat.mapel === 'B. Indonesia' && catat.nilai === 105,
    JSON.stringify(catat));

  // Cek Kesehatan Data
  ctx.temuanUserAccess = () => [];
  ctx.temuanCakupanJenjang = () => [];
  let laporan = [];
  ctx.laporkanKesehatan = (t) => { laporan = t; };
  ctx.cekKesehatanData();
  const semua = laporan.join('\n');
  periksa('Cek Kesehatan melaporkan nilai di luar 0–100',
    /Nilai di luar 0–100: kelas 2A, Oktober, Ani Lestari, B\. Indonesia = 105/.test(semua)
    && /Budi Santoso, Matematika = -3/.test(semua));
  periksa('nilai yang sah TIDAK dilaporkan', !/Nilai di luar[^\n]*Citra/.test(semua));
  periksa('siswa pindah kelas (satu nama, dua kelas) dilaporkan dengan kalimat pindah kelas',
    /NIS N4 \(Dina Mawar\) tercatat di lebih dari satu kelas pada tahun ajaran 2026-2027: 2B dan 2A/.test(semua)
    && /perawatan\/penempatan-ganda\.sql/.test(semua), semua.split('\n').find((x) => x.includes('N4')) || '(tidak ada)');
  periksa('NIS sama untuk DUA ANAK berbeda tetap memakai peringatan "melebur"',
    /NIS N5 dipakai lebih dari satu kali.*Eka Putra \/ Fajar Nugroho.*MELEBUR/.test(semua.replace(/\n/g, ' ')),
    semua.split('\n').find((x) => x.includes('N5')) || '(tidak ada)');
  periksa('siswa pindah kelas TIDAK dituduh "melebur"', !/N4[^\n]*MELEBUR/.test(semua));

  // Ringkasan sinkronisasi
  const ctx2 = muatSkrip(berkas, tabel);
  ctx2.ctx.identitasSekolah = () => 'Sekolah uji';   // konfigurasi bawaan berisi contoh
  ctx2.ctx.sinkronkanDariMaster = () => ({ kelas: 2, siswa: 5, nilai: 7 });
  ctx2.ctx.sinkronkanUserAccess = () => ({ terkirim: 1, dilewati: 0 });
  const ringkasan = ctx2.ctx.sinkronkanSemua();
  periksa('ringkasan sinkron menyebut "2 nilai di luar 0–100 dilewati"', /2 nilai di luar 0–100 dilewati/.test(ringkasan));
  periksa('log memuat rincian nilai yang dilewati', ctx2.log.some((t) => /Ani Lestari, B\. Indonesia = 105/.test(t)));

  // Tanpa nilai di luar rentang: tidak ada catatan sama sekali.
  const bersih = muatSkrip(berkas, [HEADER, baris('2A', 'Ani Lestari', 'N1', 'Oktober', 95, 90, 88)]);
  bersih.ctx.identitasSekolah = () => 'Sekolah uji';
  bersih.ctx.sinkronkanDariMaster = () => ({ kelas: 1, siswa: 1, nilai: 1 });
  bersih.ctx.sinkronkanUserAccess = () => ({ terkirim: 1, dilewati: 0 });
  periksa('data bersih: ringkasan tidak menyebut nilai di luar rentang', !/di luar 0–100/.test(bersih.ctx.sinkronkanSemua()));
}

{
  // Kedua skrip kembar: fungsi baru harus sama persis.
  const ambil = (berkas, nama) => {
    const k = readFileSync(new URL(`../${berkas}`, import.meta.url), 'utf8');
    const awal = k.indexOf(`function ${nama}(`);
    return k.slice(awal, k.indexOf('\n}\n', awal) + 3);
  };
  for (const nama of ['kosongkanNilaiDiLuarRentang', 'kalimatNilaiDiLuarRentang']) {
    periksa(`${nama}() sama persis di sync.js dan sync-pg.js`, ambil('sync.js', nama) === ambil('sync-pg.js', nama) && ambil('sync.js', nama).length > 40);
  }
}

/* ================================================================ D */
console.log('\n--- D. perawatan/penempatan-ganda.sql di Postgres sungguhan ---');

function cariBinPostgres() {
  for (const jalur of ['/usr/lib/postgresql/16/bin', '/usr/lib/postgresql/15/bin', '/usr/local/bin']) {
    if (existsSync(join(jalur, 'initdb'))) return jalur;
  }
  return null;
}

function nyalakanPostgres(bin) {
  const akar = mkdtempSync(join(tmpdir(), 'pg-ganda-'));
  const data = join(akar, 'data');
  const sebagai = process.getuid && process.getuid() === 0 ? 'postgres' : null;
  const jalankan = (perintah) => {
    const h = sebagai
      ? spawnSync('su', [sebagai, '-s', '/bin/sh', '-c', `PATH=${bin}:$PATH ${perintah}`], { encoding: 'utf8' })
      : spawnSync('/bin/sh', ['-c', `PATH=${bin}:$PATH ${perintah}`], { encoding: 'utf8' });
    return h.status === 0;
  };
  if (sebagai) spawnSync('chown', ['-R', `${sebagai}:${sebagai}`, akar]);
  if (!jalankan(`initdb -D ${data} -U postgres --auth=trust`)) return null;
  if (!jalankan(`pg_ctl -D ${data} -o '-p 55433 -k ${akar} -c listen_addresses=' -l ${akar}/log start`)) return null;
  return {
    sql(teks) {
      const berkas = join(akar, 'perintah.sql');
      writeFileSync(berkas, teks);
      if (sebagai) spawnSync('chmod', ['644', berkas]);
      return execFileSync(join(bin, 'psql'),
        ['-h', akar, '-p', '55433', '-U', 'postgres', '-tAq', '-v', 'ON_ERROR_STOP=1', '-f', berkas],
        { encoding: 'utf8' });
    },
    matikan() {
      jalankan(`pg_ctl -D ${data} -m immediate stop`);
      rmSync(akar, { recursive: true, force: true });
    },
  };
}

const bin = cariBinPostgres();
const pg = bin ? nyalakanPostgres(bin) : null;

if (!pg) {
  console.log('LEWAT Postgres tidak tersedia, bagian SQL tidak diuji.\n' +
              '      Pasang postgresql (paket "postgresql-16") untuk menjalankannya.');
} else {
  try {
    const berkasSql = readFileSync('perawatan/penempatan-ganda.sql', 'utf8');
    const iLangkah1 = berkasSql.indexOf('-- LANGKAH 1 — LIHAT DULU');
    const iLangkah2 = berkasSql.indexOf('-- LANGKAH 2 — HAPUS');
    periksa('berkas memuat LANGKAH 1 dan LANGKAH 2', iLangkah1 > 0 && iLangkah2 > iLangkah1);
    periksa('LANGKAH 2 berakhir dengan ROLLBACK bawaan', /ROLLBACK;\s+-- ← ganti menjadi COMMIT;/.test(berkasSql));
    const langkah1 = berkasSql.slice(iLangkah1, iLangkah2);
    const langkah2 = berkasSql.slice(berkasSql.indexOf('BEGIN;', iLangkah2));

    // Skema sekecil yang dibutuhkan, dengan nama kolom yang sama seperti schema.sql / migrasi 007.
    pg.sql(`
      CREATE TABLE kelas (id BIGSERIAL PRIMARY KEY, sekolah_id BIGINT, tahun_ajaran TEXT, nama_kelas TEXT);
      CREATE TABLE siswa (nis TEXT PRIMARY KEY, nama_lengkap TEXT);
      CREATE TABLE penempatan (id BIGSERIAL PRIMARY KEY, nis TEXT NOT NULL, kelas_id BIGINT NOT NULL, UNIQUE (nis, kelas_id));
      CREATE TABLE nilai_bulanan (
        id BIGSERIAL PRIMARY KEY, nis TEXT NOT NULL, kelas_id BIGINT NOT NULL, bulan TEXT NOT NULL,
        rata_b_indo NUMERIC, rata_mtk NUMERIC, rata_ipa NUMERIC,
        target_tahfidz INT, capaian_tahfidz INT, target_tahsin INT, capaian_tahsin INT,
        capaian_peng_bindo INT, capaian_peng_mtk INT, UNIQUE (nis, kelas_id, bulan));

      INSERT INTO kelas (id, sekolah_id, tahun_ajaran, nama_kelas) VALUES
        (1, 1, '2026-2027', '5A'), (2, 1, '2026-2027', '5B'), (3, 1, '2025-2026', '5A');
      INSERT INTO siswa VALUES ('S1','Satu'),('S2','Dua'),('S3','Tiga'),('S4','Empat'),('S5','Lima'),('S6','Enam'),('S7','Tujuh');

      -- S1: 5A kosong (hanya TARGET terisi), 5B berisi  -> 5A dihapus
      -- S2: 5A berisi, 5B kosong                       -> 5B dihapus
      -- S3: kosong di kedua kelas                      -> tidak disentuh
      -- S4: berisi di kedua kelas                      -> tidak disentuh
      -- S5: hanya satu kelas                           -> tidak disentuh
      -- S6: tahun ajaran BERBEDA (5A 2026 dan 5A 2025) -> tidak disentuh
      -- S7: capaian PG (capaian_peng_mtk) terisi di 5B, 5A kosong -> 5A dihapus
      INSERT INTO penempatan (nis, kelas_id) VALUES
        ('S1',1),('S1',2),('S2',1),('S2',2),('S3',1),('S3',2),('S4',1),('S4',2),('S5',1),('S6',1),('S6',3),('S7',1),('S7',2);

      INSERT INTO nilai_bulanan (nis, kelas_id, bulan, target_tahfidz) VALUES
        ('S1',1,'Agustus',3),('S1',1,'September',3),('S1',1,'Oktober',3);
      INSERT INTO nilai_bulanan (nis, kelas_id, bulan, rata_mtk) VALUES
        ('S1',2,'Agustus',90),('S1',2,'September',88);
      INSERT INTO nilai_bulanan (nis, kelas_id, bulan, rata_ipa) VALUES ('S2',1,'Agustus',80);
      INSERT INTO nilai_bulanan (nis, kelas_id, bulan) VALUES ('S2',2,'Agustus'),('S2',2,'September');
      INSERT INTO nilai_bulanan (nis, kelas_id, bulan) VALUES ('S3',1,'Agustus'),('S3',2,'Agustus');
      INSERT INTO nilai_bulanan (nis, kelas_id, bulan, rata_b_indo) VALUES ('S4',1,'Agustus',70),('S4',2,'Agustus',75);
      INSERT INTO nilai_bulanan (nis, kelas_id, bulan, rata_mtk) VALUES ('S5',1,'Agustus',60);
      INSERT INTO nilai_bulanan (nis, kelas_id, bulan, rata_mtk) VALUES ('S6',1,'Agustus',60),('S6',3,'Agustus',65);
      INSERT INTO nilai_bulanan (nis, kelas_id, bulan) VALUES ('S7',1,'Agustus');
      INSERT INTO nilai_bulanan (nis, kelas_id, bulan, capaian_peng_mtk) VALUES ('S7',2,'Agustus',4);
    `);

    const hitung = (tabel) => Number(pg.sql(`SELECT COUNT(*) FROM ${tabel};`).trim());
    const sebelum = { p: hitung('penempatan'), n: hitung('nilai_bulanan') };

    // LANGKAH 1
    const daftar = pg.sql(langkah1).trim().split('\n').map((r) => r.split('|'));
    const tindakan = (nis, kelas) => {
      const nama = { S1: 'Satu', S2: 'Dua', S3: 'Tiga', S4: 'Empat', S7: 'Tujuh' }[nis];
      return (daftar.find((r) => r[0] === nama && r[3] === kelas) || [])[5];
    };
    periksa('LANGKAH 1: hanya siswa ber-penempatan ganda yang muncul (S1,S2,S3,S4,S7 = 10 baris)', daftar.length === 10, `${daftar.length} baris`);
    periksa('LANGKAH 1: S1 5A (kosong, ada nilai di 5B) AKAN DIHAPUS', /AKAN DIHAPUS/.test(tindakan('S1', '5A')));
    periksa('LANGKAH 1: S1 5B dipertahankan', tindakan('S1', '5B') === 'dipertahankan');
    periksa('LANGKAH 1: S2 5B AKAN DIHAPUS', /AKAN DIHAPUS/.test(tindakan('S2', '5B')));
    periksa('LANGKAH 1: S3 (kosong di kedua) tidak disentuh', /tidak disentuh/.test(tindakan('S3', '5A')) && /tidak disentuh/.test(tindakan('S3', '5B')));
    periksa('LANGKAH 1: S4 (terisi di kedua) dipertahankan', tindakan('S4', '5A') === 'dipertahankan' && tindakan('S4', '5B') === 'dipertahankan');
    periksa('LANGKAH 1: S7 (capaian PG) 5A AKAN DIHAPUS', /AKAN DIHAPUS/.test(tindakan('S7', '5A')));
    periksa('LANGKAH 1: S6 (tahun ajaran berbeda) tidak muncul', !daftar.some((r) => r[0] === 'Enam'));
    periksa('LANGKAH 1: kolom bulan_terisi benar (S1 5A=0, S1 5B=2)',
      (daftar.find((r) => r[0] === 'Satu' && r[3] === '5A') || [])[4] === '0'
      && (daftar.find((r) => r[0] === 'Satu' && r[3] === '5B') || [])[4] === '2');
    periksa('LANGKAH 1 hanya membaca (jumlah baris tetap)', hitung('penempatan') === sebelum.p && hitung('nilai_bulanan') === sebelum.n);

    // LANGKAH 2 bawaan (ROLLBACK)
    const keluar2 = pg.sql(langkah2).trim().split('\n');
    periksa('LANGKAH 2 melaporkan 3 penempatan akan dihapus', keluar2[0] === '3', keluar2.join(' / '));
    periksa('LANGKAH 2 melaporkan 6 baris nilai & 3 penempatan dihapus', keluar2[1] === '6|3', keluar2[1]);
    periksa('LANGKAH 2 melaporkan sisa ganda: S1,S2,S7 sudah bersih; S3 dan S4 tersisa (2)', keluar2[2] === '2', keluar2[2]);
    periksa('ROLLBACK bawaan: TIDAK ada yang berubah', hitung('penempatan') === sebelum.p && hitung('nilai_bulanan') === sebelum.n,
      `penempatan ${hitung('penempatan')}/${sebelum.p}, nilai ${hitung('nilai_bulanan')}/${sebelum.n}`);

    // LANGKAH 2 dengan COMMIT
    periksa('petunjuk "ROLLBACK -> COMMIT" bisa diterapkan', langkah2.includes('ROLLBACK;'));
    pg.sql(langkah2.replace('ROLLBACK;', 'COMMIT;'));
    periksa('COMMIT: 3 penempatan terhapus', hitung('penempatan') === sebelum.p - 3, `${hitung('penempatan')}`);
    periksa('COMMIT: 6 baris nilai terhapus', hitung('nilai_bulanan') === sebelum.n - 6, `${hitung('nilai_bulanan')}`);
    const sisa = pg.sql(`SELECT nis || '@' || kelas_id FROM penempatan ORDER BY 1;`).trim().split('\n').join(',');
    periksa('COMMIT: yang tersisa tepat yang seharusnya',
      sisa === 'S1@2,S2@1,S3@1,S3@2,S4@1,S4@2,S5@1,S6@1,S6@3,S7@2', sisa);
    periksa('COMMIT: nilai terisi S1 di 5B utuh', Number(pg.sql(`SELECT COUNT(*) FROM nilai_bulanan WHERE nis='S1' AND kelas_id=2;`)) === 2);
    periksa('COMMIT: siswa tidak ada yang terhapus', hitung('siswa') === 7);
    periksa('COMMIT: nilai S3 yang kosong di kedua kelas tidak disentuh',
      Number(pg.sql(`SELECT COUNT(*) FROM nilai_bulanan WHERE nis='S3';`)) === 2);

    // Dijalankan lagi: tidak ada yang tersisa untuk dihapus (idempoten).
    const ulang = pg.sql(langkah2).trim().split('\n');
    periksa('dijalankan ulang: tidak ada lagi yang dihapus', ulang[0] === '0' && ulang[1] === '0|0', ulang.slice(0, 2).join(' / '));
  } finally {
    pg.matikan();
  }
}

console.log(gagal ? `\n${gagal} pemeriksaan GAGAL\n` : '\nSeluruh pemeriksaan lolos.\n');
process.exit(gagal ? 1 : 0);
