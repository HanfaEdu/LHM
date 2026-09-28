/**
 * Pemeriksaan pengingat wali kelas di sync.js.
 *
 *     node scripts/uji-pengingat-wali-kelas.mjs
 *
 * Menjalankan kode sync.js APA ADANYA di dalam VM, dengan spreadsheet,
 * Properti skrip, dan Fonnte digantikan boneka. Tidak ada pesan
 * WhatsApp yang benar-benar terkirim.
 */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const kode = readFileSync(new URL('../sync.js', import.meta.url), 'utf8');

function muat({ nilai = [], user = [], token = 'TOKEN-UJI', fonnte = () => ({ status: true }) } = {}) {
  const kiriman = [];
  const dialog = [];
  const tabel = { Sheet1: nilai, users_access: user };
  const ctx = {
    Logger: { log() {} },
    Utilities: { sleep() {} },
    PropertiesService: {
      getScriptProperties: () => ({ getProperty: (k) => (k === 'FONNTE_TOKEN' ? token : null) }),
    },
    UrlFetchApp: {
      fetch: (url, opsi) => {
        kiriman.push({ url, ...opsi.payload, token: opsi.headers.Authorization });
        const jawab = fonnte(opsi.payload.target);
        return { getResponseCode: () => 200, getContentText: () => JSON.stringify(jawab) };
      },
    },
    SpreadsheetApp: {
      getUi: () => ({
        alert: (judul, isi) => { dialog.push(judul + '\n' + isi); return 'YES'; },
        ButtonSet: { OK: 'OK', YES_NO: 'YES_NO' },
        Button: { YES: 'YES' },
      }),
      getActiveSpreadsheet: () => ({
        getSheetByName: (n) => (tabel[n] ? { getDataRange: () => ({ getValues: () => tabel[n] }) } : null),
      }),
    },
  };
  vm.createContext(ctx);
  vm.runInContext(kode, ctx);
  return { ctx, kiriman, dialog };
}

let gagalUji = 0;
const periksa = (nama, syarat) => {
  if (!syarat) gagalUji += 1;
  console.log(`${syarat ? 'OK   ' : 'GAGAL'} ${nama}`);
};

/* --- Bulan dan tahun ajaran --------------------------------------- */
const { ctx: c0 } = muat();
const w = (th, bln) => c0.bulanBerjalanPengingat(new Date(th, bln, 28));
periksa('28 Sep 2026 -> September 2026-2027',
  w(2026, 8).bulan === 'September' && w(2026, 8).tahunAjaran === '2026-2027');
periksa('28 Jan 2027 -> Januari 2026-2027 (belum ganti tahun ajaran)',
  w(2027, 0).bulan === 'Januari' && w(2027, 0).tahunAjaran === '2026-2027');
periksa('28 Jun 2026 -> Juni 2025-2026', w(2026, 5).tahunAjaran === '2025-2026');
periksa('28 Jul 2026 -> Juli 2026-2027', w(2026, 6).tahunAjaran === '2026-2027');

/* --- Data boneka, selalu untuk bulan BERJALAN ---------------------- */
const kini = c0.bulanBerjalanPengingat(new Date());
const bulanLain = kini.bulan === 'Juli' ? 'Agustus' : 'Juli';

const JUDUL = ['Tahun Ajaran', 'Kelas', 'Wali Kelas', 'Nama Lengkap', 'Nama Siswa', 'NISN/NIS',
  'No WA', 'Bulan', 'Target 3 Mapel', 'Rata B. Indo', 'Rata MTK', 'Rata IPA',
  'Target Tahfidz', 'Capaian Tahfidz', 'Target Tahsin', 'Capaian Tahsin'];
const baris = (kelas, nama, n = {}, bulan = kini.bulan, ta = kini.tahunAjaran) => [
  ta, kelas, 'Wali', nama + ' Lengkap', nama, '1', '', bulan, 90,
  n.bi ?? '', n.mtk ?? '', n.ipa ?? '', 5, n.tfz ?? '', 1, n.tsn ?? '',
];
const penuh = { bi: 90, mtk: 88, ipa: 91, tfz: 5, tsn: 1 };
const kosong25 = new Array(16).fill('');

const nilai = [
  JUDUL,
  // Kelas 1 (angka, seperti terbaca dari Sheets): Brian belum MTK, IPA kosong semua
  baris(1, 'Alvaro', { ...penuh, ipa: '' }),
  baris(1, 'Brian', { ...penuh, mtk: '', ipa: '' }),
  kosong25,
  // Kelas 2 lengkap -- nilai 0 tetap dihitung terisi
  baris('2', 'Cici', { ...penuh, bi: 0 }),
  // Kelas 3: Dodi belum Tahsin, dan wali kelasnya tanpa nomor
  baris('3', 'Dodi', { ...penuh, tsn: '' }),
  // Kelas 4 hanya punya baris bulan LAIN dan tahun ajaran LAIN -> tidak boleh ikut
  baris('4', 'Eka', {}, bulanLain),
  baris('4', 'Fina', {}, kini.bulan, '2020-2021'),
  // Sel galat dihitung kosong
  baris('5', 'Gita', { ...penuh, tfz: '#REF!' }),
];

const JUDUL_USER = ['email', 'nama', 'role', 'kelas', 'Cakupan Jenjang', 'No WA'];
const user = [
  JUDUL_USER,
  ['k@x', 'Kepsek', 'Kepala_Sekolah', '', '', '081111111111'],
  ['a@x', 'Suaidah', 'Wali_Kelas', 1, '', '0812-3456-7890'],
  ['b@x', 'Turasmi', 'Wali_Kelas', '1', '', 81398765432],
  ['c@x', 'Murwati', 'Wali_Kelas', '2', '', '+62 857 1111 2222 / 0858 3333 4444'],
  ['', '', 'Wali_Kelas', '3', '', ''],
  ['d@x', 'Guru Lima', 'Wali_Kelas', '5', '', '0856-7777-8888'],
];

/* --- Perhitungan --------------------------------------------------- */
const { ctx } = muat();
const rencana = ctx.hitungPengingatWaliKelas(nilai, user, new Date(), 'SD');
const kelas = (n) => rencana.kelas.find((k) => k.namaKelas === n);

periksa('bulan yang diperiksa = bulan berjalan', rencana.bulan === kini.bulan);
periksa('kelas 1: MTK kurang satu siswa (Brian)',
  JSON.stringify(kelas('1').kurang.find((x) => x.nama === 'Matematika')?.kosong) === '["Brian"]');
periksa('kelas 1: IPA kosong untuk seluruh siswa',
  kelas('1').kurang.find((x) => x.nama === 'IPA')?.kosong.length === 2);
periksa('kelas 1: B. Indonesia tidak dilaporkan', !kelas('1').kurang.some((x) => x.nama === 'B. Indonesia'));
periksa('kelas 1: DUA wali kelas jadi penerima', kelas('1').penerima.length === 2);
periksa('nomor 0812-3456-7890 -> 6281234567890',
  kelas('1').penerima[0].nomor[0] === '6281234567890');
periksa('nomor yang kehilangan 0 di Sheets -> 6281398765432',
  kelas('1').penerima[1].nomor[0] === '6281398765432');
periksa('kelas 2: nilai 0 dihitung terisi, kelas lengkap', kelas('2').kurang.length === 0);
periksa('satu sel berisi dua nomor -> dua nomor',
  JSON.stringify(kelas('2').penerima[0].nomor) === '["6285711112222","6285833334444"]');
periksa('kelas 3: tanpa penerima, tercatat tanpa nomor',
  kelas('3').penerima.length === 0 && kelas('3').tanpaNomor.length === 1);
periksa('bulan lain & tahun ajaran lain tidak ikut', !kelas('4'));
periksa('sel #REF! dihitung kosong', kelas('5').kurang.some((x) => x.nama === 'Tahfidz'));
periksa('kepala sekolah bukan penerima',
  !rencana.kelas.some((k) => k.penerima.some((p) => p.nama === 'Kepsek')));

const pg = ctx.hitungPengingatWaliKelas(nilai, user, new Date(), 'PG');
periksa('jenjang PG: IPA tidak diperiksa',
  !pg.kelas.some((k) => k.kurang.some((x) => x.nama === 'IPA')));

const tanpaKolom = ctx.hitungPengingatWaliKelas(nilai, user.map((b) => b.slice(0, 5)), new Date(), 'SD');
periksa('tanpa kolom "No WA": dicatat untuk diperiksa',
  tanpaKolom.catatan.some((c) => c.includes('"No WA"')));
periksa('tanpa kolom "No WA": tidak ada penerima',
  tanpaKolom.kelas.every((k) => k.penerima.length === 0));

const kolomDiF = user.map((b) => [b[0], b[1], b[2], b[3], b[4], '', b[5]]);
kolomDiF[0][5] = ''; kolomDiF[0][6] = 'No WA';
periksa('kolom "No WA" dicari lewat judul, bukan posisi F',
  ctx.hitungPengingatWaliKelas(nilai, kolomDiF, new Date(), 'SD')
    .kelas.find((k) => k.namaKelas === '1').penerima.length === 2);

/* --- Pratinjau tidak mengirim apa pun ------------------------------ */
const prat = muat({ nilai, user });
const isiPrat = prat.ctx.pratinjauPengingatWaliKelas();
periksa('pratinjau: tidak ada kiriman', prat.kiriman.length === 0);
periksa('pratinjau: memuat contoh pesan', isiPrat.includes('--- Contoh pesan untuk'));
periksa('pratinjau: kelas tanpa penerima disebut', isiPrat.includes('Wali Kelas 3 (No WA kosong)'));

/* --- Pengiriman ---------------------------------------------------- */
const kirim = muat({ nilai, user });
let lempar = null;
try { kirim.ctx.kirimPengingatWaliKelas(); } catch (e) { lempar = e.message; }
const target = kirim.kiriman.map((k) => k.target);
periksa('terkirim ke kedua wali kelas 1 dan wali kelas 5',
  JSON.stringify(target) === '["6281234567890","6281398765432","6285677778888"]');
periksa('kelas 2 yang lengkap tidak dikirimi', !target.some((t) => t.includes('6285711112222')));
periksa('token Fonnte dipakai', kirim.kiriman.every((k) => k.token === 'TOKEN-UJI'));
const pesan1 = kirim.kiriman[0]?.message || '';
periksa('pesan menyebut kelas dan bulan',
  pesan1.includes('*Kelas 1*') && pesan1.includes('*' + kini.bulan + '*'));
periksa('pesan menyebut siswa yang kurang', pesan1.includes('Brian'));
periksa('pesan membedakan "kosong semua"', pesan1.includes('*IPA*: belum ada nilai sama sekali'));
periksa('pesan menyertakan alamat input LHM', pesan1.includes('Input/Edit LHM: https://'));
periksa('kelas tanpa penerima -> melempar (supaya pemicu mengirim surel)',
  (lempar || '').includes('Wali Kelas 3'));

const bersih = muat({ nilai: nilai.filter((b) => b[1] !== '3'), user });
let lemparBersih = null;
try { bersih.ctx.kirimPengingatWaliKelas(); } catch (e) { lemparBersih = e.message; }
periksa('semua beres -> tidak melempar', lemparBersih === null);

const tolak = muat({
  nilai: nilai.filter((b) => b[1] !== '3'),
  user,
  fonnte: (t) => (t === '6281398765432' ? { status: false, reason: 'device disconnected' } : { status: true }),
});
let lemparTolak = null;
try { tolak.ctx.kirimPengingatWaliKelas(); } catch (e) { lemparTolak = e.message; }
periksa('Fonnte menolak (HTTP 200, status false) -> melempar dengan alasannya',
  (lemparTolak || '').includes('GAGAL: device disconnected'));
periksa('kiriman lain tetap jalan walau satu ditolak', tolak.kiriman.length === 3);

const tanpaToken = muat({ nilai, user, token: null });
let lemparToken = null;
try { tanpaToken.ctx.kirimPengingatWaliKelas(); } catch (e) { lemparToken = e.message; }
periksa('tanpa FONNTE_TOKEN -> melempar', (lemparToken || '').includes('FONNTE_TOKEN'));
periksa('tanpa FONNTE_TOKEN -> tidak ada kiriman', tanpaToken.kiriman.length === 0);

console.log(gagalUji ? `\n${gagalUji} GAGAL\n` : '\nSemua lolos.\n');
console.log('--- contoh pesan ---\n' + pesan1);
process.exit(gagalUji ? 1 : 0);
