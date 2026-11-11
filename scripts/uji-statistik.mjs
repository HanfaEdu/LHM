/**
 * Pemeriksaan hitungan statistik dasbor (lib/statistik.js).
 *
 *     node scripts/uji-statistik.mjs
 *
 * Aturan yang dijaga satu saja: ANGKA YANG DIGOLONGKAN HARUS ANGKA YANG
 * DITAMPILKAN. Nilai dibulatkan ke satuan (0,5 ke atas) lebih dulu, baru
 * dibandingkan dengan target -- sehingga 89,5 yang tertulis "90" juga
 * dihitung tuntas, dan tidak pernah muncul "MTK 90 (target 90)" di daftar
 * Perlu Pendampingan.
 *
 * Node murni, tanpa peramban dan tanpa jaringan.
 */
import {
  RENTANG,
  barisDinilai,
  capaianTerbaik,
  distribusi,
  kalimatTerbaik,
  ketuntasan,
  mapelUntuk,
  narasiKelas,
  peringatanDini,
} from '../lib/statistik.js';

let gagal = 0;
function periksa(nama, syarat, keterangan = '') {
  if (!syarat) gagal += 1;
  console.log(`${syarat ? 'OK   ' : 'GAGAL'} ${nama}${keterangan ? ` — ${keterangan}` : ''}`);
}

const baris1 = (kunci, nilai) => nilai.map((v, i) => ({ nis: `X-${i}`, nama_panggilan: `S${i}`, [kunci]: v }));

/* ---------------------------------------------------------------- 1.1 */
console.log('\n--- ketuntasan ---');
{
  const k = ketuntasan(baris1('rata_mtk', [89.5, 89.49, 90, 100, null]), 'rata_mtk', 90);
  periksa('tuntas 3 (89,5 dibulatkan 90; 89,49 menjadi 89)', k.tuntas === 3, `tuntas ${k.tuntas}`);
  periksa('dinilai 4 (null tidak dihitung)', k.dinilai === 4, `dinilai ${k.dinilai}`);
  periksa('persen 75', k.persen === 75, `persen ${k.persen}`);
}

console.log('\n--- distribusi ---');
{
  const nilai = [89.5, 89.49, 98.5, 70, 69.4, 99, null];
  const d = distribusi(baris1('rata_mtk', nilai), 'rata_mtk');
  const per = Object.fromEntries(d.map((r) => [r.label, r.jumlah]));
  periksa('89,5 masuk "90–98"', per['90–98'] === 1, JSON.stringify(per));
  periksa('89,49 masuk "80–89"', per['80–89'] === 1);
  periksa('98,5 masuk "99–100" (dibulatkan 99)', per['99–100'] === 2, 'bersama nilai 99');
  periksa('70 masuk "70–79"', per['70–79'] === 1);
  periksa('69,4 (dibulatkan 69) masuk "< 70"', per['< 70'] === 1);
  periksa('69,6 masuk "70–79" (dibulatkan 70)', distribusi(baris1('rata_mtk', [69.6]), 'rata_mtk')[1].jumlah === 1);
  const jumlah = d.reduce((a, r) => a + r.jumlah, 0);
  periksa('jumlah seluruh rentang = jumlah dinilai', jumlah === 6, `${jumlah} dari 6`);
  // Setiap bilangan bulat 0..100 harus masuk tepat satu rentang.
  let tumpangTindih = 0;
  for (let n = 0; n <= 100; n += 1) {
    const cocok = RENTANG.filter((r) => n >= r.min && n <= r.max).length;
    if (cocok !== 1) tumpangTindih += 1;
  }
  periksa('setiap nilai 0–100 masuk tepat satu rentang', tumpangTindih === 0, `${tumpangTindih} nilai bermasalah`);
}

console.log('\n--- peringatanDini ---');
{
  const baris = [
    { nis: 'X-1', nama_panggilan: 'Aman', rata_mtk: 89.6 },
    { nis: 'X-2', nama_panggilan: 'Kurang', rata_mtk: 89.4 },
  ];
  const hasil = peringatanDini(baris, 90, mapelUntuk('SD'));
  periksa('89,6 tidak muncul', !hasil.some((b) => b.nama_panggilan === 'Aman'));
  const kurang = hasil.find((b) => b.nama_panggilan === 'Kurang');
  periksa('89,4 muncul dengan teks "89 (target 90)"',
    Boolean(kurang) && kurang.alasan.some((a) => a.includes('89 (target 90)')),
    kurang ? kurang.alasan.join(' | ') : 'tidak muncul');
}

/* ---------------------------------------------------------------- 1.2 */
console.log('\n--- capaianTerbaik ---');
{
  const baris = [
    { nama_panggilan: 'Citra', rata_mtk: 100 },
    { nama_panggilan: 'Aira', rata_mtk: 100 },
    { nama_panggilan: 'Bilal', rata_mtk: 100 },
    { nama_panggilan: 'Dani', rata_mtk: 99.6 },
    { nama_panggilan: 'Kosong', rata_mtk: null },
  ];
  const mtk = capaianTerbaik(baris, mapelUntuk('SD')).find((t) => t.kunci === 'rata_mtk');
  periksa('tiga siswa 100 dan satu 99,6 → 4 peraih (99,6 dibulatkan 100)', mtk.peraih.length === 4, `peraih ${mtk.peraih.length}`);
  periksa('nama diurutkan abjad', mtk.peraih.join(',') === 'Aira,Bilal,Citra,Dani', mtk.peraih.join(','));
  periksa('dinilai tidak menghitung nilai null', mtk.dinilai === 4, `dinilai ${mtk.dinilai}`);

  const satu = capaianTerbaik([{ nama_panggilan: 'Aisya', rata_mtk: 98 }, { nama_panggilan: 'Budi', rata_mtk: 90 }], mapelUntuk('SD'))
    .find((t) => t.kunci === 'rata_mtk');
  periksa('satu siswa saja → 1 peraih', satu.peraih.length === 1 && satu.peraih[0] === 'Aisya');
  periksa('hasil membawa label panjang mapel', satu.label === 'Matematika', satu.label);
}

console.log('\n--- kalimatTerbaik ---');
{
  const dasar = { kunci: 'rata_mtk', mapel: 'MTK', label: 'Matematika', nilai: 98 };
  const satu = kalimatTerbaik({ ...dasar, peraih: ['Aisya'], dinilai: 24 });
  periksa('1 peraih memuat namanya', satu.teks === 'Matematika: nilai tertinggi 98 diraih Aisya.', satu.teks);
  periksa('1 peraih: nama tertulis di kalimat', satu.tampilNama === true);

  const tiga = kalimatTerbaik({ ...dasar, label: 'IPA', nilai: 100, peraih: ['Aira', 'Alif', 'Ammar'], dinilai: 24 });
  periksa('3 peraih memuat ketiga nama',
    ['Aira', 'Alif', 'Ammar'].every((n) => tiga.teks.includes(n)) && tiga.teks.includes('Aira, Alif, dan Ammar'), tiga.teks);

  const empat = kalimatTerbaik({ ...dasar, label: 'B. Indonesia', nilai: 100, peraih: ['Aira', 'Alif', 'Ammar', 'Budi'], dinilai: 24 });
  periksa('4 dari 24 memuat "4 dari 24 siswa"', empat.teks.includes('4 dari 24 siswa'), empat.teks);
  periksa('4 dari 24 TIDAK memuat satu nama pun',
    !['Aira', 'Alif', 'Ammar', 'Budi'].some((n) => empat.teks.includes(n)), empat.teks);
  periksa('4 dari 24: nama tidak tertulis di kalimat', empat.tampilNama === false);

  const semua = kalimatTerbaik({
    ...dasar, label: 'B. Indonesia', nilai: 100,
    peraih: Array.from({ length: 24 }, (_, i) => `N${i}`), dinilai: 24,
  });
  periksa('24 dari 24 memuat "seluruh 24 siswa"', semua.teks.includes('seluruh 24 siswa'), semua.teks);

  const duaDariDua = kalimatTerbaik({ ...dasar, nilai: 100, peraih: ['Aira', 'Budi'], dinilai: 2 });
  periksa('2 dari 2 ditulis "seluruh 2 siswa", bukan dua nama',
    duaDariDua.teks.includes('seluruh 2 siswa') && !duaDariDua.teks.includes('Aira'), duaDariDua.teks);

  periksa('teks = gabungan potongan', empat.teks === empat.potongan.map((p) => p.teks).join(''));
}

/* ---------------------------------------------------------------- 1.3 */
console.log('\n--- narasiKelas ---');
{
  const duaMapel = [
    { kunci: 'rata_b_indo', label: 'B. Indonesia', pendek: 'B. Indo' },
    { kunci: 'rata_mtk', label: 'Matematika', pendek: 'MTK' },
  ];
  const seri = narasiKelas(
    [{ rata_b_indo: 100, rata_mtk: 95 }, { rata_b_indo: 95, rata_mtk: 100 }],
    90, 'Agustus', duaMapel);
  periksa('dua mapel sama-sama 100% → memuat "sama"', seri.includes('sama'), seri);
  periksa('seri semua → "seluruh mata pelajaran mencatat ketuntasan yang sama"',
    seri.includes('seluruh mata pelajaran mencatat ketuntasan yang sama, yaitu 100%'), seri);

  // 224 dari 250 siswa tuntas = 89,6%.
  const baris250 = Array.from({ length: 250 }, (_, i) => ({ rata_mtk: i < 224 ? 95 : 50 }));
  const hampir = narasiKelas(baris250, 90, 'Agustus', [duaMapel[1]]);
  periksa('satu mapel 89,6% → TIDAK memuat "Perlu perhatian"', !hampir.includes('Perlu perhatian'), hampir);
  periksa('89,6% tertulis 90% dan "sudah mencapai ambang"', hampir.includes('sebesar 90%') && hampir.includes('sudah mencapai ambang 90%'), hampir);

  const rendah = narasiKelas(
    [{ rata_b_indo: 95, rata_mtk: 50 }, { rata_b_indo: 95, rata_mtk: 50 }], 90, 'Agustus', duaMapel);
  periksa('di bawah ambang tetap disebut', rendah.includes('Perlu perhatian khusus pada Matematika'), rendah);

  const tunggal = narasiKelas([{ rata_b_indo: 100, rata_mtk: 100 }, { rata_b_indo: 100, rata_mtk: 50 }], 90, 'Agustus', duaMapel);
  periksa('satu mapel tertinggi memakai kalimat lama',
    tunggal.includes('ketuntasan tertinggi adalah B. Indonesia sebesar 100%'), tunggal);
}

/* ---------------------------------------------------------------- 1.4 */
console.log('\n--- barisDinilai ---');
{
  const baris = [
    { nis: 'A', rata_b_indo: null, rata_mtk: null, rata_ipa: null, capaian_tahfidz: null, capaian_tahsin: null, target_tahfidz: 5 },
    { nis: 'B', rata_b_indo: 80, rata_mtk: null },
    { nis: 'C', capaian_tahfidz: 4 },
  ];
  const hasil = barisDinilai(baris);
  periksa('baris yang seluruh kolomnya null terbuang (target saja tidak dihitung)',
    hasil.length === 2 && !hasil.some((b) => b.nis === 'A'), hasil.map((b) => b.nis).join(','));
}

console.log(gagal ? `\n${gagal} pemeriksaan GAGAL\n` : '\nSeluruh pemeriksaan lolos.\n');
process.exit(gagal ? 1 : 0);
