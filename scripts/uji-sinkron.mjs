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

/* ----------------------------------------------------------------
   Cek Kesehatan Data: NIS yang dipakai dua anak
   ----------------------------------------------------------------
   Ditemukan di data sungguhan: satu NIS terpakai di dua kelas
   sekaligus. Ini tidak pernah memunculkan galat -- bagi database
   keduanya memang satu siswa. Akibatnya kedua anak melebur, namanya
   diambil dari baris yang terbaca lebih dulu, nilainya bercampur di
   dasbor, dan satu tautan orang tua membuka data dua anak.

   Karena satu-satunya yang bisa menangkapnya adalah pemeriksaan ini,
   pemeriksaannya sendiri harus dijaga -- kalau ia diam, tidak ada
   lapis lain di belakangnya.
   ---------------------------------------------------------------- */
function temuanKesehatan(nilai) {
  const ctx = {
    Logger: { log() {} },
    SpreadsheetApp: {
      getUi: () => ({ createMenu: () => ({ addItem() { return this; }, addToUi() {} }) }),
      getActiveSpreadsheet: () => ({ getSheetByName: () => null }),
    },
  };
  vm.createContext(ctx);
  vm.runInContext(kode, ctx);
  ctx.bacaMasterRekap = () => ({ nilai, targetTeksBermasalah: [] });

  let temuan = [];
  ctx.laporkanKesehatan = (t) => { temuan = t; };
  ctx.cekKesehatanData();
  return temuan.join('\n');
}

const bulanUji = ['Juli', 'Agustus'];
const barisUji = (nis, nama, kelas) => bulanUji.map((b) => ({
  nis, nama_lengkap: nama, nama_kelas: kelas,
  tahun_ajaran: '2026-2027', bulan: b,
}));

const kembar = temuanKesehatan([
  ...barisUji('SDYFK-301', 'Anak Satu', '2B'),
  ...barisUji('SDYFK-301', 'Anak Dua', '4'),
  ...barisUji('SDYFK-302', 'Anak Tiga', '4'),
]);
periksa('NIS kembar antar kelas terdeteksi', kembar.includes('NIS SDYFK-301 dipakai'));
periksa('kedua kelasnya disebut', kembar.includes('kelas 2B dan 4'));
periksa('kedua namanya disebut', kembar.includes('Anak Satu / Anak Dua'));
periksa('NIS yang sehat tidak ikut dilaporkan', !kembar.includes('SDYFK-302 dipakai'));

/* Satu NIS, satu kelas, tetapi dua nama berbeda -- salah ketik nama,
   atau dua anak sekelas yang NIS-nya kembar. Sama berbahayanya. */
const namaGanda = temuanKesehatan([
  ...barisUji('SDYFK-303', 'Anak Empat', '4'),
  ...barisUji('SDYFK-303', 'Anak Lima', '4'),
]);
periksa('NIS kembar dalam satu kelas ikut terdeteksi',
  namaGanda.includes('NIS SDYFK-303 dipakai'));

/* Baris tanpa NIS tidak boleh saling dianggap kembar: semuanya
   ber-NIS kosong, dan kalau ikut dikelompokkan, seluruh siswa yang
   NIS-nya belum terbit akan dilaporkan sebagai satu anak. */
const tanpaNis = temuanKesehatan([
  ...barisUji('', 'Belum Ber-NIS A', '2B'),
  ...barisUji('', 'Belum Ber-NIS B', '4'),
]);
periksa('baris tanpa NIS tidak dianggap kembar', !tanpaNis.includes('dipakai lebih dari satu'));
periksa('baris tanpa NIS tetap dilaporkan sebagai NIS kosong',
  tanpaNis.includes('baris siswa tanpa NIS'));

console.log(gagalUji ? `\n${gagalUji} GAGAL\n` : '\nSemua lolos.\n');
console.log('--- contoh isi dialog ---\n' + sukses.dialog[0]);
process.exit(gagalUji ? 1 : 0);
