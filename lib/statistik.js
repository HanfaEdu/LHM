/**
 * Perhitungan statistik kelas.
 *
 * Fungsi-fungsi di sini murni: masuk data, keluar angka. Tidak menyentuh
 * jaringan dan tidak menyimpan state, supaya rumusnya bisa dibaca dan
 * diperiksa tanpa menjalankan aplikasinya.
 */

export const MAPEL = [
  { kunci: 'rata_b_indo', label: 'B. Indonesia', pendek: 'B. Indo' },
  { kunci: 'rata_mtk', label: 'Matematika', pendek: 'MTK' },
  { kunci: 'rata_ipa', label: 'IPA', pendek: 'IPA' },
];

/**
 * Ambang persentase ketuntasan untuk B. Indonesia/Matematika/IPA: kelas
 * dianggap tuntas kalau 90% siswanya mencapai target. Konstan sepanjang
 * tahun ajaran -- tidak seperti target Tahfidz/Tahsin yang sengaja berubah
 * tiap bulan mengikuti kurikulum masing-masing kelas.
 */
export const AMBANG_KETUNTASAN = 90;

/**
 * Rentang distribusi nilai, mengikuti tabel rekap di rapor PDF.
 *
 * Satu koreksi terhadap tabel aslinya: di sana rentangnya ditulis
 * "... < 70" lalu "71-79", sehingga nilai tepat 70 tidak masuk kelompok
 * mana pun dan diam-diam hilang dari rekap. Di sini batasnya dirapatkan
 * menjadi 70-79 supaya setiap nilai pasti terhitung sekali.
 */
export const RENTANG = [
  { label: '< 70', min: -Infinity, max: 69.999 },
  { label: '70–79', min: 70, max: 79.999 },
  { label: '80–89', min: 80, max: 89.999 },
  { label: '90–98', min: 90, max: 98.999 },
  { label: '99–100', min: 99, max: Infinity },
];

/** Apakah satu baris bulan sudah punya isi apa pun (selain target). */
export function bulanBerdata(b) {
  return (
    b.rata_b_indo !== null && b.rata_b_indo !== undefined ||
    b.rata_mtk !== null && b.rata_mtk !== undefined ||
    b.rata_ipa !== null && b.rata_ipa !== undefined ||
    b.capaian_tahfidz !== null && b.capaian_tahfidz !== undefined ||
    b.capaian_tahsin !== null && b.capaian_tahsin !== undefined
  );
}

/**
 * Apakah satu bulan sudah benar-benar dinilai.
 *
 * Bukan sekadar "ada barisnya": sinkronisasi membuat satu baris per siswa
 * untuk kedua belas bulan sekaligus, termasuk bulan yang belum berjalan --
 * barisnya ada, isinya seluruhnya NULL. Menghitung baris saja membuat Juni
 * ikut dianggap terisi, dan pemilih bulan yang mengambil "bulan terakhir
 * yang ada datanya" akan mendarat di Juni sepanjang tahun.
 */
export function adaIsiBulan(baris) {
  return Array.isArray(baris) && baris.some(bulanBerdata);
}

/**
 * Menghapus target pada bulan-bulan yang belum berjalan.
 *
 * sync.js meneruskan target ke bulan berikutnya yang kosong, supaya guru
 * yang mengisi target sekali per semester tetap terlayani sama baiknya
 * dengan yang mengisinya tiap bulan. Tanpa batas, aturan itu membuat
 * target bulan Juli merambat sampai Juni: grafik menggambar titik target
 * untuk sebelas bulan yang belum dimulai, seolah-olah seluruh target
 * setahun sudah ditetapkan.
 *
 * Di sini target dipotong setelah bulan terakhir yang benar-benar punya
 * data. Bulan yang sedang berjalan tetap menampilkan targetnya (karena
 * sudah ada nilai yang masuk), sedangkan bulan yang belum tersentuh sama
 * sekali dibiarkan kosong.
 */
export function potongTargetBulanKosong(bulanan) {
  let batas = -1;
  bulanan.forEach((b, i) => {
    if (bulanBerdata(b)) batas = i;
  });

  return bulanan.map((b, i) =>
    i <= batas ? b : { ...b, target_tahfidz: null, target_tahsin: null }
  );
}

/** Rata-rata yang mengabaikan NULL, bukan menghitungnya sebagai nol. */
export function rataRata(nilai) {
  const angka = nilai.filter((v) => v !== null && v !== undefined);
  if (!angka.length) return null;
  return angka.reduce((a, b) => a + b, 0) / angka.length;
}

/**
 * Ketuntasan = persentase siswa yang mencapai target.
 * Siswa yang belum dinilai tidak masuk penyebut — kalau dihitung sebagai
 * tidak tuntas, kelas yang datanya belum lengkap akan terlihat buruk
 * padahal hanya belum diinput.
 */
export function ketuntasan(baris, kunci, target) {
  const dinilai = baris.filter((b) => b[kunci] !== null && b[kunci] !== undefined);
  if (!dinilai.length) return null;
  const tuntas = dinilai.filter((b) => b[kunci] >= target).length;
  return {
    persen: (tuntas / dinilai.length) * 100,
    tuntas,
    dinilai: dinilai.length,
  };
}

/** Sebaran nilai satu mapel ke dalam rentang di atas. */
export function distribusi(baris, kunci) {
  const dinilai = baris
    .map((b) => b[kunci])
    .filter((v) => v !== null && v !== undefined);

  return RENTANG.map((r) => {
    const jumlah = dinilai.filter((v) => v >= r.min && v <= r.max).length;
    return {
      label: r.label,
      jumlah,
      persen: dinilai.length ? (jumlah / dinilai.length) * 100 : 0,
    };
  });
}

/** Rekap capaian Qur'an terhadap target: di atas / sesuai / di bawah. */
export function rekapQuran(baris, kunciCapaian, kunciTarget) {
  const dinilai = baris.filter(
    (b) =>
      b[kunciCapaian] !== null &&
      b[kunciCapaian] !== undefined &&
      b[kunciTarget] !== null &&
      b[kunciTarget] !== undefined
  );

  const diatas = dinilai.filter((b) => b[kunciCapaian] > b[kunciTarget]).length;
  const sesuai = dinilai.filter((b) => b[kunciCapaian] === b[kunciTarget]).length;
  const dibawah = dinilai.filter((b) => b[kunciCapaian] < b[kunciTarget]).length;

  return {
    diatas,
    sesuai,
    dibawah,
    dinilai: dinilai.length,
    tuntas: diatas + sesuai,
    persenTuntas: dinilai.length ? ((diatas + sesuai) / dinilai.length) * 100 : null,
  };
}

/**
 * Siswa yang perlu pendampingan pada bulan tertentu.
 * Dikembalikan berikut alasannya, supaya wali kelas tahu apa yang harus
 * ditindaklanjuti tanpa membuka tabel lagi.
 */
export function peringatanDini(baris, target) {
  return baris
    .map((b) => {
      const alasan = [];

      MAPEL.forEach((m) => {
        if (b[m.kunci] !== null && b[m.kunci] !== undefined && b[m.kunci] < target) {
          alasan.push(`${m.pendek} ${bulat(b[m.kunci])} (target ${target})`);
        }
      });

      if (
        b.capaian_tahfidz !== null && b.capaian_tahfidz !== undefined &&
        b.target_tahfidz !== null && b.target_tahfidz !== undefined &&
        b.capaian_tahfidz < b.target_tahfidz
      ) {
        alasan.push(`Tahfidz ${b.capaian_tahfidz} (target ${b.target_tahfidz})`);
      }

      if (
        b.capaian_tahsin !== null && b.capaian_tahsin !== undefined &&
        b.target_tahsin !== null && b.target_tahsin !== undefined &&
        b.capaian_tahsin < b.target_tahsin
      ) {
        alasan.push(`Tahsin ${b.capaian_tahsin} (target ${b.target_tahsin})`);
      }

      return { ...b, alasan };
    })
    .filter((b) => b.alasan.length)
    .sort((a, b) => b.alasan.length - a.alasan.length);
}

/** Narasi rekap kelas, meniru kalimat ringkasan di rapor PDF. */
export function narasiKelas(baris, target, bulan) {
  const hasil = MAPEL.map((m) => ({ ...m, k: ketuntasan(baris, m.kunci, target) })).filter(
    (m) => m.k
  );
  if (!hasil.length) return `Belum ada nilai yang diinput untuk bulan ${bulan}.`;

  const tertinggi = hasil.reduce((a, b) => (b.k.persen > a.k.persen ? b : a));
  // Ambang ketuntasan akademik: 90% siswa di kelas itu mencapai target
  // (target skor per siswa, juga 90 secara default). Berbeda dari Tahfidz/
  // Tahsin yang targetnya sengaja berubah tiap bulan mengikuti kurikulum --
  // ambang untuk tiga mapel ini tetap sepanjang tahun.
  const perluPerhatian = hasil.filter((m) => m.k.persen < AMBANG_KETUNTASAN);

  let teks = `Pada bulan ${bulan}, mata pelajaran dengan ketuntasan tertinggi adalah ${
    tertinggi.label
  } sebesar ${bulat(tertinggi.k.persen)}%.`;

  if (perluPerhatian.length) {
    teks += ` Perlu perhatian khusus pada ${perluPerhatian
      .map((m) => m.label)
      .join(' dan ')}, yang ketuntasannya masih di bawah ${AMBANG_KETUNTASAN}%.`;
  } else {
    teks += ` Seluruh mata pelajaran berada di atas ambang ${AMBANG_KETUNTASAN}%.`;
  }

  return teks;
}

/** Siswa dengan capaian terbaik per mapel, seperti catatan di rapor PDF. */
export function capaianTerbaik(baris) {
  return MAPEL.map((m) => {
    const dinilai = baris.filter((b) => b[m.kunci] !== null && b[m.kunci] !== undefined);
    if (!dinilai.length) return null;
    const terbaik = dinilai.reduce((a, b) => (b[m.kunci] > a[m.kunci] ? b : a));
    return { mapel: m.pendek, nama: terbaik.nama_panggilan, nilai: bulat(terbaik[m.kunci]) };
  }).filter(Boolean);
}

export function bulat(v, desimal = 0) {
  if (v === null || v === undefined) return '–';
  return Number(v).toFixed(desimal);
}

/* ================================================================
   Bulan yang terpilih saat dasbor dibuka
   ================================================================ */

/** Nama bulan menurut kalender, untuk memetakan tanggal hari ini. */
const BULAN_KALENDER = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

/** Urutan bulan menurut TAHUN AJARAN, bukan kalender. */
const URUTAN_AJARAN = [
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
];

/**
 * Tahun ajaran yang sedang berjalan, mis. "2026-2027".
 * Bergantinya di bulan Juli, bukan Januari.
 */
export function tahunAjaranBerjalan(sekarang = new Date()) {
  const th = sekarang.getFullYear();
  return sekarang.getMonth() >= 6 ? `${th}-${th + 1}` : `${th - 1}-${th}`;
}

/**
 * Bulan yang sebaiknya terpilih saat dasbor pertama kali dibuka.
 *
 * Sebelumnya yang dipilih selalu bulan TERAKHIR yang sudah ada datanya.
 * Terdengar masuk akal, tetapi keliru di lapangan: nilai bulan Juli baru
 * selesai diinput awal Agustus, nilai Agustus baru selesai awal
 * September, dan seterusnya. Begitu seorang wali kelas memasukkan satu
 * saja nilai bulan Agustus di tanggal 2 -- atau sekadar menetapkan
 * target Tahfidz bulan itu -- Agustus langsung menjadi "bulan terakhir
 * yang ada datanya", dan seluruh dasbor sekolah mendarat di bulan yang
 * isinya masih hampir seluruhnya kosong. Kepala sekolah membuka dasbor
 * lalu melihat ketuntasan 6%, padahal yang terjadi hanya datanya belum
 * masuk.
 *
 * Aturannya sekarang mengikuti cara kerja sekolah, bukan cara kerja
 * basis data: yang ditampilkan lebih dulu adalah bulan SEBELUM bulan
 * berjalan -- bulan yang penilaiannya sudah selesai.
 *
 * Tiga hal yang ditangani:
 *
 * 1. Juli tetap Juli. Tidak ada bulan sebelum Juli dalam satu tahun
 *    ajaran, jadi di bulan pertama tidak ada yang bisa dimundurkan.
 *
 * 2. Kalau bulan sasaran itu ternyata belum ada datanya, dipilih bulan
 *    berdata terakhir yang TIDAK melewatinya. Contoh: dasbor dibuka
 *    bulan Desember padahal sinkronisasi terakhir hanya sampai
 *    September -- yang ditampilkan September, bukan November yang kosong
 *    dan bukan pula bulan sesudahnya.
 *
 * 3. Tahun ajaran yang sudah lewat tidak punya "bulan berjalan" sama
 *    sekali. Untuk tahun lampau, yang ditampilkan bulan terakhir yang
 *    ada datanya -- memundurkannya satu bulan tidak berarti apa-apa di
 *    tahun yang sudah selesai.
 *
 * Pengguna tetap bisa memilih bulan mana pun lewat dropdown; ini hanya
 * menentukan yang mana yang terbuka lebih dulu.
 *
 * @param bulanTersedia daftar bulan berdata, urut menurut tahun ajaran
 * @param tahunAjaran   tahun ajaran yang sedang dilihat, mis. "2026-2027"
 */
export function bulanBawaan(bulanTersedia, tahunAjaran, sekarang = new Date()) {
  if (!bulanTersedia?.length) return '';

  const terakhir = bulanTersedia[bulanTersedia.length - 1];

  // (3) Tahun ajaran lampau.
  if (tahunAjaran && tahunAjaran !== tahunAjaranBerjalan(sekarang)) {
    return terakhir;
  }

  const namaSekarang = BULAN_KALENDER[sekarang.getMonth()];
  const posSekarang = URUTAN_AJARAN.indexOf(namaSekarang);
  if (posSekarang < 0) return terakhir;

  // (1) Juli (posisi 0) tidak dimundurkan.
  const sasaran = Math.max(0, posSekarang - 1);

  // (2) Bulan berdata terakhir yang tidak melewati sasaran.
  let pilihan = '';
  bulanTersedia.forEach((b) => {
    const pos = URUTAN_AJARAN.indexOf(b);
    if (pos >= 0 && pos <= sasaran) pilihan = b;
  });

  // Belum ada satu pun bulan berdata sampai sasaran -- berarti datanya
  // justru baru dimulai setelah itu (mis. sekolah baru memakai sistem
  // ini di tengah tahun). Yang ada itulah yang ditampilkan.
  return pilihan || terakhir;
}
