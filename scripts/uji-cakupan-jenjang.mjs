/**
 * Pemeriksaan cakupan jenjang biro akademik.
 *
 *     node scripts/uji-cakupan-jenjang.mjs
 *
 * Biro akademik terikat jenjang tertentu (biro SD, biro PG-TK),
 * sedangkan direktur area melihat lintas jenjang. Aturannya ada di
 * kolom users_access.cakupan_jenjang, dan ditegakkan di DUA tempat:
 *
 *   1. sekolah_yang_boleh() di migrasi/002-cakupan-jenjang.sql -- dipakai
 *      seluruh policy RLS, jadi inilah yang menjaga dasbor.
 *   2. dalamCakupan() di lib/cakupan.js -- dipakai /api/tautan, yang
 *      memakai service_role dan MELEWATI seluruh RLS.
 *
 * Dua tempat berarti dua kesempatan untuk berbeda diam-diam, dan
 * bedanya tidak akan terlihat sebagai galat: ia terlihat sebagai biro
 * yang tidak bisa melihat siswa di dasbornya, tetapi tetap bisa
 * mencabut tautan orang tua siswa itu. Karena itu skrip ini menjalankan
 * kasus yang SAMA PERSIS lewat keduanya lalu membandingkan hasilnya.
 *
 * SQL-nya diuji di Postgres sungguhan, bukan ditiru dengan JavaScript --
 * dan badan fungsinya DIPOTONG LANGSUNG dari berkas migrasi, sehingga
 * yang diuji benar-benar SQL yang dikirim ke Supabase. Kalau Postgres
 * tidak tersedia, bagian SQL dilewati dengan pemberitahuan (bagian
 * JavaScript tetap jalan) -- bukan dianggap lolos diam-diam.
 *
 * Supabase tidak dihubungi sama sekali.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import vm from 'node:vm';
import { join } from 'node:path';
import { dalamCakupan } from '../lib/cakupan.js';

let gagal = 0;
function periksa(nama, syarat, keterangan = '') {
  if (!syarat) gagal += 1;
  console.log(`${syarat ? 'OK   ' : 'GAGAL'} ${nama}${keterangan ? ` — ${keterangan}` : ''}`);
}

/* ----------------------------------------------------------------
   Sekolah contoh
   ----------------------------------------------------------------
   Sengaja memuat tiga jebakan sekaligus:
     - SD Klaten: area LAIN. Cakupan jenjang tidak boleh membuat batas
       area ikut longgar -- biro SD Pati Raya tetap tidak melihatnya.
     - "Tanpa Jenjang": jenjangnya kosong. Harus terlihat oleh direktur
       (cakupan kosong) tetapi TIDAK oleh biro mana pun yang bercakupan.
     - PG dan TK terpisah, supaya cakupan dua jenjang benar-benar teruji.
   ---------------------------------------------------------------- */
const SEKOLAH = [
  { id: 1, kode: 'PGYFK', nama: 'PG Kudus',      area: 'Pati Raya',   jenjang: 'PG' },
  { id: 2, kode: 'TKYFK', nama: 'TK Kudus',      area: 'Pati Raya',   jenjang: 'TK' },
  { id: 3, kode: 'SDYFK', nama: 'SD Kudus',      area: 'Pati Raya',   jenjang: 'SD' },
  { id: 4, kode: 'SDYFP', nama: 'SD Pati',       area: 'Pati Raya',   jenjang: 'SD' },
  { id: 5, kode: 'SDBK',  nama: 'SD Klaten',     area: 'Klaten-Solo', jenjang: 'SD' },
  { id: 6, kode: 'XXX',   nama: 'Tanpa Jenjang', area: 'Pati Raya',   jenjang: null },
];

/** email, peran, sekolah tempat terdaftar, cakupan, sekolah yang diharapkan. */
const KASUS = [
  {
    nama: 'direktur area (cakupan kosong) melihat seluruh jenjang di areanya',
    email: 'direktur@x', role: 'direktur_area', sekolah_id: 1, cakupan: null,
    harap: ['PGYFK', 'SDYFK', 'SDYFP', 'TKYFK', 'XXX'],
  },
  {
    nama: 'biro SD hanya melihat SD, dan tidak menembus batas area',
    email: 'birosd@x', role: 'direktur_area', sekolah_id: 3, cakupan: 'SD',
    harap: ['SDYFK', 'SDYFP'],
  },
  {
    nama: 'biro PG-TK melihat dua jenjang, tanpa satu pun SD',
    email: 'biropaud@x', role: 'direktur_area', sekolah_id: 1, cakupan: 'PG,TK',
    harap: ['PGYFK', 'TKYFK'],
  },
  {
    nama: 'huruf kecil dan spasi tetap dikenali (" pg , tk ")',
    email: 'biroluwes@x', role: 'direktur_area', sekolah_id: 1, cakupan: ' pg , tk ',
    harap: ['PGYFK', 'TKYFK'],
  },
  {
    nama: 'koma ganda tidak membocorkan sekolah tanpa jenjang ("SD,,TK")',
    email: 'birokoma@x', role: 'direktur_area', sekolah_id: 1, cakupan: 'SD,,TK',
    harap: ['SDYFK', 'SDYFP', 'TKYFK'],
  },
  {
    nama: 'kepala sekolah tidak terpengaruh kolom cakupan',
    email: 'kepsek@x', role: 'kepala_sekolah', sekolah_id: 3, cakupan: 'SD',
    harap: ['SDYFK'],
  },
  {
    nama: 'wali kelas tetap satu sekolah',
    email: 'wali@x', role: 'wali_kelas', sekolah_id: 3, cakupan: null,
    harap: ['SDYFK'],
  },
];

/* ================================================================
   BAGIAN 1 — SQL sungguhan
   ================================================================ */

/** Memotong badan sekolah_yang_boleh() dari berkas migrasi yang dikirim. */
function fungsiDariMigrasi() {
  const berkas = readFileSync('migrasi/002-cakupan-jenjang.sql', 'utf8');
  const mulai = berkas.indexOf('CREATE OR REPLACE FUNCTION sekolah_yang_boleh()');
  if (mulai === -1) throw new Error('sekolah_yang_boleh() tidak ditemukan di migrasi 002');
  const akhir = berkas.indexOf('\n$$;', mulai);
  if (akhir === -1) throw new Error('akhir sekolah_yang_boleh() tidak ditemukan');
  return berkas.slice(mulai, akhir + 4);
}

function cariBinPostgres() {
  for (const jalur of ['/usr/lib/postgresql/16/bin', '/usr/lib/postgresql/15/bin', '/usr/local/bin']) {
    if (existsSync(join(jalur, 'initdb'))) return jalur;
  }
  return null;
}

/**
 * Menyalakan Postgres sekali pakai. initdb menolak berjalan sebagai
 * root, jadi klasternya dijalankan sebagai pengguna `postgres` -- dan
 * karena pengguna itu tidak bisa menembus direktori sesi, datanya
 * ditaruh langsung di bawah direktori sementara sistem.
 */
function nyalakanPostgres(bin) {
  const akar = mkdtempSync(join(tmpdir(), 'pg-cakupan-'));
  const data = join(akar, 'data');
  const sebagai = process.getuid && process.getuid() === 0 ? 'postgres' : null;

  const jalankan = (perintah) => {
    const hasil = sebagai
      ? spawnSync('su', [sebagai, '-s', '/bin/sh', '-c', `PATH=${bin}:$PATH ${perintah}`],
          { encoding: 'utf8' })
      : spawnSync('/bin/sh', ['-c', `PATH=${bin}:$PATH ${perintah}`], { encoding: 'utf8' });
    return hasil.status === 0;
  };

  if (sebagai) spawnSync('chown', ['-R', `${sebagai}:${sebagai}`, akar]);
  if (!jalankan(`initdb -D ${data} -U postgres --auth=trust`)) return null;
  if (!jalankan(
    `pg_ctl -D ${data} -o '-p 55432 -k ${akar} -c listen_addresses=' -l ${akar}/log start`
  )) return null;

  return {
    akar,
    sql(teks) {
      const berkas = join(akar, 'perintah.sql');
      writeFileSync(berkas, teks);
      if (sebagai) spawnSync('chmod', ['644', berkas]);
      return execFileSync(join(bin, 'psql'),
        ['-h', akar, '-p', '55432', '-U', 'postgres', '-tAq', '-v', 'ON_ERROR_STOP=1', '-f', berkas],
        { encoding: 'utf8' });
    },
    matikan() {
      jalankan(`pg_ctl -D ${data} -m immediate stop`);
      rmSync(akar, { recursive: true, force: true });
    },
  };
}

console.log('--- aturan RLS di Postgres sungguhan ---');
const bin = cariBinPostgres();
const pg = bin ? nyalakanPostgres(bin) : null;

if (!pg) {
  console.log(
    'LEWAT Postgres tidak tersedia, bagian SQL tidak diuji.\n' +
    '      Pasang postgresql (paket "postgresql-16") untuk menjalankannya.'
  );
} else {
  try {
    pg.sql(`
      CREATE SCHEMA auth;
      CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $f$
          SELECT jsonb_build_object('email', current_setting('uji.email', true));
      $f$;
      CREATE TABLE sekolah (
          id BIGSERIAL PRIMARY KEY, kode TEXT, nama TEXT, area TEXT, jenjang TEXT);
      CREATE TABLE users_access (
          email TEXT PRIMARY KEY, role TEXT, sekolah_id BIGINT, cakupan_jenjang VARCHAR(60));
      ${SEKOLAH.map((s) =>
        `INSERT INTO sekolah VALUES (${s.id},'${s.kode}','${s.nama}','${s.area}',` +
        `${s.jenjang === null ? 'NULL' : `'${s.jenjang}'`});`).join('\n')}
      ${KASUS.map((k) =>
        `INSERT INTO users_access VALUES ('${k.email}','${k.role}',${k.sekolah_id},` +
        `${k.cakupan === null ? 'NULL' : `'${k.cakupan}'`});`).join('\n')}
      ${fungsiDariMigrasi()}
    `);

    for (const k of KASUS) {
      const keluar = pg.sql(
        `SET uji.email = '${k.email}';\n` +
        `SELECT coalesce(string_agg(kode, ',' ORDER BY kode), '') FROM sekolah ` +
        `WHERE id IN (SELECT sekolah_yang_boleh());`
      );
      const dapat = keluar.trim().split('\n').pop().trim();
      const harap = [...k.harap].sort().join(',');
      periksa(k.nama, dapat === harap, dapat === harap ? '' : `dapat "${dapat}", harap "${harap}"`);
    }
  } finally {
    pg.matikan();
  }
}

/* ================================================================
   BAGIAN 2 — kembarannya di JavaScript (/api/tautan)
   ================================================================
   Diuji dengan kasus yang sama supaya perbedaan sekecil apa pun
   ketahuan di sini, bukan di produksi. Hanya peran direktur_area yang
   dibandingkan: untuk kepala sekolah dan wali kelas, /api/tautan tidak
   pernah memanggil dalamCakupan() sama sekali -- cakupannya sudah
   dipatok ke satu sekolah lebih dulu. */
console.log('\n--- kembarannya di JavaScript (lib/cakupan.js) ---');
for (const k of KASUS.filter((x) => x.role === 'direktur_area')) {
  const areaBiro = SEKOLAH.find((s) => s.id === k.sekolah_id).area;
  const dapat = SEKOLAH
    .filter((s) => s.area === areaBiro && dalamCakupan(s.jenjang, k.cakupan))
    .map((s) => s.kode)
    .sort()
    .join(',');
  const harap = [...k.harap].sort().join(',');
  periksa(`sama dengan SQL: ${k.nama}`, dapat === harap,
    dapat === harap ? '' : `dapat "${dapat}", harap "${harap}"`);
}

/* Beberapa bentuk yang tidak diwakili kasus di atas. */
console.log('\n--- bentuk isian lain ---');
periksa('cakupan kosong ("") = seluruh jenjang', dalamCakupan('SD', '') === true);
periksa('cakupan undefined = seluruh jenjang', dalamCakupan('SD', undefined) === true);
periksa('jenjang kosong ditolak saat cakupan terisi', dalamCakupan('', 'SD') === false);
periksa('jenjang null ditolak saat cakupan terisi', dalamCakupan(null, 'SD') === false);
periksa('jenjang null diterima saat cakupan kosong', dalamCakupan(null, null) === true);
periksa('jenjang berspasi tetap cocok', dalamCakupan(' sd ', 'SD') === true);
periksa('jenjang di luar cakupan ditolak', dalamCakupan('SMP', 'PG,TK') === false);

/* ================================================================
   BAGIAN 3 — sisi Apps Script (sync.js)
   ================================================================
   Kolomnya diisi manusia di spreadsheet, jadi di sinilah isian
   berantakan pertama kali bertemu sistem. cakupanJenjangRapi()
   dijalankan APA ADANYA dari sync.js di dalam VM, dengan layanan Google
   digantikan boneka -- sama seperti scripts/uji-sinkron.mjs.

   Yang dijaga: salah ketik harus DITOLAK, bukan dikirim apa adanya.
   Cakupan 'SDIT' yang lolos ke database menghasilkan biro yang tidak
   melihat satu sekolah pun, dan itu terbaca sebagai sistem rusak --
   bukan sebagai salah ketik yang bisa dibetulkan sendiri. */
console.log('\n--- pembacaan kolom di Apps Script (sync.js) ---');
{
  const kode = readFileSync(new URL('../sync.js', import.meta.url), 'utf8');
  const ctx = {
    Logger: { log() {} },
    SpreadsheetApp: {
      getUi: () => ({ createMenu: () => ({ addItem() { return this; }, addToUi() {} }) }),
      getActiveSpreadsheet: () => { throw new Error('tidak dipakai'); },
    },
  };
  vm.createContext(ctx);
  vm.runInContext(kode, ctx);

  const rapi = (x) => ctx.cakupanJenjangRapi(x);

  periksa('sel kosong -> null (seluruh jenjang)',
    rapi('').nilai === null && rapi('').salah.length === 0);
  periksa('"SD" -> "SD"', rapi('SD').nilai === 'SD');
  periksa('" pg , tk " -> "PG,TK"', rapi(' pg , tk ').nilai === 'PG,TK');
  periksa('koma ganda diabaikan: "SD,,TK" -> "SD,TK"', rapi('SD,,TK').nilai === 'SD,TK');
  periksa('kembar dibuang: "SD,SD" -> "SD"', rapi('SD,SD').nilai === 'SD');

  const salah = rapi('SDIT');
  periksa('jenjang tidak dikenal ditolak, bukan diteruskan',
    salah.nilai === null && salah.salah.join(',') === 'SDIT');

  const campur = rapi('SD,SMK');
  periksa('satu salah membatalkan seluruh isian (tidak dikirim separuh)',
    campur.nilai === null && campur.salah.join(',') === 'SMK');

  /* jenjangRapi() menjaga hulunya: jenjang sekolah yang salah ketik
     membuat sekolahnya lenyap dari dasbor biro yang bercakupan, tanpa
     satu pun pesan galat. Diuji dengan menyetel ulang baris
     konfigurasinya, karena nilainya konstanta di dalam berkas. */
  const dengan = (nilai) => {
    const c = { ...ctx };
    vm.createContext(c);
    vm.runInContext(
      kode.replace(/const JENJANG_SEKOLAH = '[^']*';/, `const JENJANG_SEKOLAH = '${nilai}';`),
      c
    );
    return c.jenjangRapi();
  };

  periksa('JENJANG_SEKOLAH sekolah ini dikenali', ctx.jenjangRapi() === 'SD');
  periksa('huruf kecil dirapikan: "pg" -> "PG"', dengan('pg') === 'PG');
  periksa('berspasi dirapikan: " tk " -> "TK"', dengan(' tk ') === 'TK');
  periksa('jenjang salah ketik ditolak: "SDIT" -> ""', dengan('SDIT') === '');
  periksa('jenjang kosong ditolak', dengan('') === '');
}

console.log(gagal ? `\n${gagal} pemeriksaan GAGAL\n` : '\nSeluruh pemeriksaan lolos.\n');
process.exit(gagal ? 1 : 0);
