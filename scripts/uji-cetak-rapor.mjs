/**
 * Pemeriksaan hasil cetak rapor orang tua.
 *
 *     node scripts/uji-cetak-rapor.mjs        (butuh: next build lebih dulu)
 *
 * Mesin cetaknya (app/komponen/cetak.jsx) dipakai bersama dengan dasbor
 * staf. Berkas ini yang menjaga supaya perubahan demi dasbor tidak
 * diam-diam merusak rapor yang dibaca orang tua -- kerusakannya tidak
 * pernah terlihat di layar, hanya di PDF yang sudah terlanjur dikirim.
 *
 * Yang diperiksa:
 *   - grafik digambar pada lebar kertas (~696px), bukan lebar layar HP;
 *   - seluruh <details> dibuka supaya keterangan poin Tahfidz/Tahsin
 *     ikut tercetak -- di atas kertas pembacanya tidak bisa membukanya
 *     sendiri, dan tanpa daftar itu angka pada grafik tidak berarti;
 *   - keadaan halaman KEMBALI seperti semula sesudah pratinjau ditutup.
 *
 * Tidak menyentuh Supabase: /api/rapor dicegat dan dijawab data contoh.
 */
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
/* Playwright bukan kebergantungan proyek ini -- ia hanya alat uji, dan
   memasukkannya ke package.json akan menyeret unduhan peramban ke tiap
   pemasangan. */
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

const PORT = 3993;
const anak = spawn('./node_modules/.bin/next', ['start','-p',String(PORT)], { cwd: process.cwd(), stdio:['ignore','pipe','pipe'] });
await new Promise(r => anak.stdout.on('data', d => String(d).includes('Ready') && r()));

const BULAN = ['Juli','Agustus','September'];
const bulanan = ['Juli','Agustus','September','Oktober','November','Desember','Januari','Februari','Maret','April','Mei','Juni']
  .map((b,i) => i < 3 ? ({
    bulan:b, rata_b_indo:82+i, rata_mtk:78+i*2, rata_ipa:88,
    target_akademik:90, target_tahfidz:4+i, capaian_tahfidz:3+i,
    nama_tahfidz:'Al Falaq', target_tahsin:3+i, capaian_tahsin:2+i, nama_tahsin:'Fathah',
  }) : ({ bulan:b, rata_b_indo:null, rata_mtk:null, rata_ipa:null, target_akademik:90,
    target_tahfidz:null, capaian_tahfidz:null, nama_tahfidz:null,
    target_tahsin:null, capaian_tahsin:null, nama_tahsin:null }));

const JAWABAN = {
  anak: { nis:'SDYFK-281', nama_lengkap:'Aisyah Nur Fadhilah', nama_panggilan:'Aisyah' },
  kelas: { nama_kelas:'2A', tahun_ajaran:'2026-2027', wali_kelas:'Siti Masruroh, S.Pd.', target_akademik:90 },
  sekolah: { nama:'SD Yaumi Fatimah Kudus' },
  bulanan,
  tahunAjaranTersedia: ['2026-2027'],
  perbandingan: Object.fromEntries(BULAN.map((b,i) => [b,
    ['A-1','B-1','C-1','Aisyah','D-1','E-1'].map((label,j) => ({
      label, anak: label === 'Aisyah',
      rata_b_indo: 76+j*3+i, rata_mtk: 74+j*4, rata_ipa: 80+j*2,
      target_tahfidz: 4+i, capaian_tahfidz: 3+i+(j%3),
      target_tahsin: 3+i, capaian_tahsin: 2+i+(j%2),
    })),
  ])),
};

const b = await chromium.launch();
const c = await b.newContext({ viewport:{ width:390, height:780 } });
const p = await c.newPage();
p.on('pageerror', e => console.log('  [pageerror]', String(e).slice(0,300)));
await p.route('**/api/rapor', r => r.fulfill({ status:200, contentType:'application/json', body: JSON.stringify(JAWABAN) }));
await p.goto(`http://127.0.0.1:${PORT}/rapor/uji-token-panjang-sekali`, { waitUntil:'networkidle' });
await p.waitForTimeout(1200);

let gagal = 0;
const periksa = (n, ok, ket='') => { if(!ok) gagal++; console.log(`${ok?'OK   ':'GAGAL'} ${n}${ket?` — ${ket}`:''}`); };

const isi = await p.locator('body').innerText();
periksa('halaman rapor termuat', !isi.includes('Application error') && isi.includes('Aisyah'));

await p.emulateMedia({ media:'print' });
await p.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
await p.waitForTimeout(500);

const h = await p.evaluate(() => ({
  lebarSvg: [...document.querySelectorAll('.recharts-surface')].map(s => Math.round(s.getBoundingClientRect().width)),
  lipatanTerbuka: [...document.querySelectorAll('details')].every(d => d.open),
  jumlahLipatan: document.querySelectorAll('details').length,
  teks: document.body.innerText,
}));
periksa('grafik memakai lebar kertas', h.lebarSvg.length>0 && h.lebarSvg.every(l => l>600 && l<=703),
  `lebar: ${[...new Set(h.lebarSvg)].join(', ')}`);
periksa('seluruh lipatan dibuka untuk dicetak', h.lipatanTerbuka, `${h.jumlahLipatan} lipatan`);
periksa('keterangan poin ikut tercetak', /Al Falaq|Al Ikhlas|Fathah/.test(h.teks));
periksa('kaki cetak memuat nama sekolah dan siswa',
  h.teks.includes('SD Yaumi Fatimah Kudus') && h.teks.includes('Aisyah Nur Fadhilah'));

// Keadaan dikembalikan sesudah pratinjau ditutup.
await p.evaluate(() => window.dispatchEvent(new Event('afterprint')));
await p.waitForTimeout(300);
const setelah = await p.evaluate(() => ({
  lebarSvg: [...document.querySelectorAll('.recharts-surface')].map(s => Math.round(s.getBoundingClientRect().width)),
  adaDitandai: document.querySelectorAll('details[data-dibuka-untuk-cetak]').length,
}));
periksa('grafik kembali ke lebar layar sesudah cetak',
  setelah.lebarSvg.every(l => l < 500), `lebar: ${[...new Set(setelah.lebarSvg)].join(', ')}`);
periksa('lipatan yang dibuka paksa ditutup kembali', setelah.adaDitandai === 0);

await p.pdf({ path: join(tmpdir(), 'rapor-uji.pdf'), format:'A4', printBackground:true, preferCSSPageSize:true });
await b.close(); anak.kill('SIGTERM');
console.log(gagal ? `\n${gagal} GAGAL\n` : '\nRapor orang tua aman.\n');
process.exit(gagal?1:0);
