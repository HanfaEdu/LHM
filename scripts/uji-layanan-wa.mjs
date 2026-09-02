/**
 * Pemeriksaan layanan WhatsApp orang tua.
 *
 *     node scripts/uji-layanan-wa.mjs
 *
 * Tiga hal yang diperiksa, dan ketiganya adalah tempat layanan ini
 * paling mungkin gagal DIAM-DIAM — tanpa galat, hanya berupa orang tua
 * yang merasa diabaikan:
 *
 *   1. Pembakuan nomor (lib/nomor-wa.js). Kalau "081234567890" di
 *      spreadsheet dan "6281234567890" dari Fonnte tidak bertemu di satu
 *      bentuk, TIDAK ADA satu pun orang tua yang dikenali.
 *   2. Isi balasan (lib/wa-balasan.js). Nomor tak dikenal, tautan belum
 *      terbit, satu anak, dan dua anak adalah empat jawaban berbeda;
 *      tertukar satu saja dan orang tua dikirim ke wali kelas untuk
 *      masalah yang bukan miliknya.
 *   3. Kolom "No WA" benar-benar ikut terkirim dari Apps Script. Kolom
 *      itu sudah dibaca sejak versi pertama tetapi tidak pernah dikirim
 *      ke mana pun — persis kegagalan senyap yang dimaksud.
 *
 * Tidak menyentuh jaringan, spreadsheet, Supabase, maupun Fonnte.
 */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { nomorWa, nomorWaDaftar, nomorWaTampil } from '../lib/nomor-wa.js';
import { susunBalasan } from '../lib/wa-balasan.js';

let gagal = 0;
const periksa = (nama, syarat) => {
  if (!syarat) gagal += 1;
  console.log(`${syarat ? 'OK   ' : 'GAGAL'} ${nama}`);
};

// ===================================================================
console.log('--- pembakuan nomor (lib/nomor-wa.js) ---');
// ===================================================================

periksa('bentuk lokal: 081234567890', nomorWa('081234567890') === '6281234567890');
periksa('bertanda hubung: 0812-3456-7890', nomorWa('0812-3456-7890') === '6281234567890');
periksa('bertanda plus: +62 812 3456 7890', nomorWa('+62 812 3456 7890') === '6281234567890');
periksa('sudah 62: 6281234567890', nomorWa('6281234567890') === '6281234567890');

/* Inilah bentuk yang paling sering muncul di Master Rekap: Google Sheets
   membaca "081234567890" sebagai ANGKA, lalu nol di depannya hilang.
   Kalau bentuk ini tidak ditangani, sebagian besar baris tidak cocok. */
periksa('nol di depan hilang (sel terbaca angka): 81234567890',
  nomorWa('81234567890') === '6281234567890');

periksa('nomor dalam kalimat: "WA ibu 0812 3456 7890"',
  nomorWa('WA ibu 0812 3456 7890') === '6281234567890');

/* Satu sel kerap memuat nomor ayah DAN ibu. Keduanya harus terbaca:
   memilih salah satu berarti separuh orang tua tidak dikenali. */
periksa('dua nomor dipisah garis miring',
  nomorWaDaftar('0812 3456 7890 / 0813 4444 5555').join(',') ===
  '6281234567890,6281344445555');
periksa('dua nomor dipisah kata "dan"',
  nomorWaDaftar('Ibu 081234567890 dan Ayah 081355556666').length === 2);
periksa('nomor kembar tidak digandakan',
  nomorWaDaftar('081234567890 / 0812-3456-7890').length === 1);

/* Yang harus DITOLAK. Nomor tetap tidak pernah bisa menerima WhatsApp,
   jadi meloloskannya hanya membuat sel yang salah isi tampak benar. */
periksa('sel kosong ditolak', nomorWaDaftar('').length === 0);
periksa('tanda hubung saja ditolak', nomorWaDaftar('-').length === 0);
periksa('nomor tetap (0274) ditolak', nomorWaDaftar('0274 555123').length === 0);
periksa('terlalu pendek ditolak', nomorWaDaftar('0812345').length === 0);
periksa('deretan angka terlalu panjang ditolak',
  nomorWaDaftar('0812345678901234567').length === 0);
periksa('nomor luar negeri hanya lewat tanda plus',
  nomorWa('+60123456789') === '60123456789' && nomorWa('60123456789') === '');

periksa('bentuk tampil dikembalikan ke lokal',
  nomorWaTampil('6281234567890') === '0812-3456-7890');

/* Sifat yang menentukan seluruh layanan: apa pun bentuk tulisannya di
   spreadsheet, hasilnya harus SAMA PERSIS dengan yang dikirim Fonnte. */
const dariFonnte = '6281234567890';
periksa('semua ragam tulisan bertemu di satu bentuk dengan kiriman Fonnte',
  ['081234567890', '0812-3456-7890', '+62 812 3456 7890', '81234567890',
   '62 812 3456 7890'].every((v) => nomorWa(v) === dariFonnte));

// ===================================================================
console.log('\n--- isi balasan (lib/wa-balasan.js) ---');
// ===================================================================

const SEKOLAH = 'SD Yaumi Fatimah Kudus';

const takDikenal = susunBalasan({ namaSekolah: SEKOLAH, anak: [] });
periksa('nomor tak dikenal: hasil "tidak_dikenal"', takDikenal.hasil === 'tidak_dikenal');
periksa('nomor tak dikenal: diarahkan ke wali kelas',
  /wali kelas/i.test(takDikenal.teks));

/* Percobaan sebelumnya meminta orang tua mengetik "Nama-Kelas". Itu
   bukan pengamanan sama sekali -- nama dan kelas seorang siswa diketahui
   seluruh wali murid sekelas -- dan layanan ini memang tidak membaca isi
   pesan. Meminta format itu di balasan hanya akan membuat orang tua
   mencoba lagi dan lagi tanpa pernah berhasil. */
periksa('nomor tak dikenal: TIDAK meminta format "Nama-Kelas"',
  !/nama-kelas/i.test(takDikenal.teks) && !/format/i.test(takDikenal.teks));
/* Balasan ini pergi ke nomor yang TIDAK dikenali sistem. Ia karena itu
   tidak boleh berpura-pura mengenal seorang anak -- termasuk lewat
   sapaan "Ananda X" yang isinya ditebak. */
periksa('nomor tak dikenal: tidak berpura-pura mengenal seorang anak',
  !/Ananda/.test(takDikenal.teks));

const belum = susunBalasan({
  namaSekolah: SEKOLAH,
  anak: [{ nama: 'Faisal', kelas: '3', tautan: null }],
});
periksa('tautan belum terbit: hasil "belum_terbit"', belum.hasil === 'belum_terbit');
periksa('tautan belum terbit: anak tetap disebut ditemukan',
  belum.teks.includes('Faisal') && /sudah kami temukan/i.test(belum.teks));
periksa('tautan belum terbit: tidak menyalahkan nomor orang tua',
  !/belum terdaftar/i.test(belum.teks));

const satu = susunBalasan({
  namaSekolah: SEKOLAH,
  anak: [{ nama: 'Faisal', kelas: '3', tautan: 'https://contoh.app/rapor/AbC123' }],
});
periksa('satu anak: hasil "terkirim"', satu.hasil === 'terkirim');
periksa('satu anak: tautannya utuh di dalam pesan',
  satu.teks.includes('https://contoh.app/rapor/AbC123'));
periksa('satu anak: nama dan kelas ikut disebut',
  satu.teks.includes('Faisal') && satu.teks.includes('Kelas 3'));
periksa('satu anak: nama sekolah muncul di kaki pesan', satu.teks.includes(SEKOLAH));
periksa('satu anak: diingatkan agar tautan tidak diteruskan',
  /tidak diteruskan/i.test(satu.teks));

/* Orang tua dengan dua anak di sekolah yang sama harus menerima KEDUA
   tautan sekaligus. Mengirim satu saja membuat mereka mengira sistem
   tidak mengenal anaknya yang lain. */
const dua = susunBalasan({
  namaSekolah: SEKOLAH,
  anak: [
    { nama: 'Faisal', kelas: '3', tautan: 'https://contoh.app/rapor/AAA' },
    { nama: 'Aisyah', kelas: '1', tautan: 'https://contoh.app/rapor/BBB' },
  ],
});
periksa('dua anak: kedua tautan dikirim sekaligus',
  dua.teks.includes('/rapor/AAA') && dua.teks.includes('/rapor/BBB'));
periksa('dua anak: kedua nama disebut',
  dua.teks.includes('Faisal') && dua.teks.includes('Aisyah'));

/* Campuran: satu anak sudah punya tautan, satu lagi belum. Yang sudah
   ada harus tetap terkirim -- bukan ditahan sampai keduanya siap. */
const campur = susunBalasan({
  namaSekolah: SEKOLAH,
  anak: [
    { nama: 'Faisal', kelas: '3', tautan: 'https://contoh.app/rapor/AAA' },
    { nama: 'Aisyah', kelas: '1', tautan: null },
  ],
});
periksa('campuran: tautan yang sudah ada tetap dikirim',
  campur.hasil === 'terkirim' && campur.teks.includes('/rapor/AAA'));
periksa('campuran: anak yang belum punya tautan tetap disebut',
  campur.teks.includes('Aisyah') && /belum diterbitkan/i.test(campur.teks));

periksa('kelas yang belum diketahui tidak menghasilkan "Kelas null"',
  !/Kelas null|Kelas undefined/.test(
    susunBalasan({
      namaSekolah: SEKOLAH,
      anak: [{ nama: 'Faisal', kelas: null, tautan: 'https://contoh.app/rapor/AAA' }],
    }).teks
  ));

// ===================================================================
console.log('\n--- kolom "No WA" di Apps Script (sync.js) ---');
// ===================================================================
{
  const kode = readFileSync(new URL('../sync.js', import.meta.url), 'utf8');

  /* Master Rekap tiruan. Sengaja meniru dua kebiasaan nyata di lapangan:
       - No WA hanya diisi di baris bulan PERTAMA, kosong di bulan lain
       - satu siswa lain justru baru terisi di baris bulan kedua        */
  const tabel = [
    ['Tahun Ajaran', 'Kelas', 'Wali Kelas', 'Nama Lengkap', 'Nama Siswa',
     'NISN/NIS', 'No WA', 'Bulan', 'Rata B. Indo'],
    ['2026-2027', '3', 'Bu Ani', 'Muhammad Faisal', 'Faisal', 281, '081234567890', 'Juli', 90],
    ['2026-2027', '3', 'Bu Ani', 'Muhammad Faisal', 'Faisal', 281, '', 'Agustus', 92],
    ['2026-2027', '3', 'Bu Ani', 'Aisyah Putri', 'Aisyah', 282, '', 'Juli', 88],
    ['2026-2027', '3', 'Bu Ani', 'Aisyah Putri', 'Aisyah', 282, 81355556666, 'Agustus', 89],
    ['2026-2027', '3', 'Bu Ani', 'Umar Hadi', 'Umar', 283, '', 'Juli', 85],
  ];

  const ctx = {
    Logger: { log() {} },
    SpreadsheetApp: {
      getUi: () => ({ createMenu: () => ({ addItem() { return this; }, addToUi() {} }) }),
      getActiveSpreadsheet: () => ({
        getSheetByName: () => ({ getDataRange: () => ({ getValues: () => tabel }) }),
      }),
    },
  };
  vm.createContext(ctx);
  vm.runInContext(kode, ctx);

  const isi = ctx.bacaMasterRekap();
  const per = Object.fromEntries(isi.roster.map((s) => [s.nis, s]));

  periksa('No WA terbaca dari baris bulan pertama', per['281'].noWa === '081234567890');
  periksa('No WA yang baru terisi di bulan berikutnya tetap terjaring',
    per['282'].noWa === '81355556666');
  periksa('siswa tanpa No WA tidak dikarang-karang', per['283'].noWa === '');

  /* Yang paling penting: kolomnya benar-benar SAMPAI ke database.
     Terbaca tapi tidak terkirim adalah keadaan sistem ini sebelumnya. */
  const terkirim = {};
  ctx.pastikanSekolah = () => 1;
  ctx.kirim = (tabelNama, data, konflik, kembalikan) => {
    terkirim[tabelNama] = data;
    return kembalikan
      ? data.map((d, i) => ({ ...d, id: i + 1 }))
      : null;
  };
  ctx.sinkronkanDariMaster(isi);

  const siswa = Object.fromEntries((terkirim.siswa || []).map((s) => [s.nis_lokal, s]));
  periksa('baris siswa membawa field no_wa ke /api/sync',
    Object.prototype.hasOwnProperty.call(siswa['281'] || {}, 'no_wa'));
  periksa('nomor dikirim apa adanya (pembakuannya urusan /api/sync)',
    siswa['281'].no_wa === '081234567890');
  periksa('siswa tanpa nomor dikirim sebagai null, bukan string kosong',
    siswa['283'].no_wa === null);
}

console.log(gagal ? `\n${gagal} pemeriksaan GAGAL\n` : '\nSeluruh pemeriksaan lolos.\n');
process.exit(gagal ? 1 : 0);
