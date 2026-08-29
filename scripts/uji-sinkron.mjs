/**
 * Pemeriksaan titik masuk sinkronisasi Apps Script.
 *
 *     node scripts/uji-sinkron.mjs
 *
 * Menjalankan sinkronkanSemua() APA ADANYA dari sync.js di dalam VM,
 * dengan layanan Google digantikan boneka. Yang diperiksa terutama satu
 * hal yang tidak terlihat dari membaca kode: apakah kegagalan benar-
 * benar dilempar keluar. Kalau tidak, pemicu tengah malam menganggap
 * sinkronisasi sukses dan tidak mengirim surel apa pun -- dasbor lalu
 * menampilkan angka lama seolah masih segar.
 *
 * Tidak menyentuh jaringan, spreadsheet, maupun basis data.
 */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const kode = readFileSync(new URL('../sync.js', import.meta.url), 'utf8');

function jalankan({ nilaiGagal, userGagal }) {
  const dialog = [];
  const log = [];
  const ctx = {
    Logger: { log: (t) => log.push(String(t)) },
    SpreadsheetApp: {
      getUi: () => ({
        alert: (judul, isi) => dialog.push(judul + '\n' + isi),
        ButtonSet: { OK: 'OK' },
        createMenu: () => ({ addItem() { return this; }, addToUi() {} }),
      }),
      getActiveSpreadsheet: () => { throw new Error('tidak dipakai'); },
    },
  };
  vm.createContext(ctx);
  vm.runInContext(kode, ctx);

  ctx.bacaMasterRekap = () => {
    if (nilaiGagal) throw new Error('IMPORTRANGE kelas 4 kosong');
    return { targetTeksBermasalah: [] };
  };
  ctx.sinkronkanDariMaster = () => ({ kelas: 7, siswa: 152, nilai: 1064 });
  ctx.sinkronkanUserAccess = () => {
    if (userGagal) throw new Error('sheet users_access tidak ditemukan');
    return { terkirim: 9, dilewati: 0 };
  };

  let lempar = null;
  try { ctx.sinkronkanSemua(); } catch (e) { lempar = e.message; }
  return { lempar, dialog };
}

let gagalUji = 0;
const periksa = (nama, syarat) => {
  if (!syarat) gagalUji += 1;
  console.log(`${syarat ? 'OK   ' : 'GAGAL'} ${nama}`);
};

const sukses = jalankan({});
periksa('sinkron berhasil: tidak melempar', sukses.lempar === null);
periksa('sinkron berhasil: dialog muncul', sukses.dialog.length === 1);
periksa('dialog memuat identitas sekolah',
  sukses.dialog[0].includes('SEKOLAH: SD Yaumi Fatimah Kudus'));
periksa('dialog memuat alamat input LHM',
  sukses.dialog[0].includes('Input LHM: https://laporan-akademik.vercel.app/'));
periksa('dialog memuat jumlah siswa', sukses.dialog[0].includes('152 siswa'));

const separuh = jalankan({ nilaiGagal: true });
periksa('separuh gagal: melempar', separuh.lempar !== null);
periksa('pesan lemparan memuat sebabnya',
  (separuh.lempar || '').includes('IMPORTRANGE kelas 4 kosong'));
periksa('pesan lemparan memuat bagian yang tetap berhasil',
  (separuh.lempar || '').includes('[OK]   Hak akses: 9 pengguna'));
periksa('separuh gagal: dialog tetap muncul lebih dulu', separuh.dialog.length === 1);

const semua = jalankan({ nilaiGagal: true, userGagal: true });
periksa('dua-duanya gagal: melempar', semua.lempar !== null);
periksa('dua-duanya gagal: kedua sebab tercatat',
  (semua.lempar || '').includes('[GAGAL] Nilai') &&
  (semua.lempar || '').includes('[GAGAL] Hak akses'));

console.log(gagalUji ? `\n${gagalUji} GAGAL\n` : '\nSemua lolos.\n');
console.log('--- contoh isi dialog ---\n' + sukses.dialog[0]);
process.exit(gagalUji ? 1 : 0);
