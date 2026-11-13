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
 * Mata pelajaran yang dinilai pada tiap jenjang.
 *
 * Playgroup tidak menilai IPA sama sekali -- yang ada di sana hanya
 * Bahasa, Matematika, Tahfidz, dan Tahsin. Tanpa aturan ini, dasbor PG
 * akan menampilkan meteran "IPA 0%", grafik dengan batang hijau yang
 * selalu kosong, dan kolom IPA yang seluruhnya bertanda hubung -- ketiganya
 * terbaca sebagai data yang belum diisi, bukan sebagai pelajaran yang
 * memang tidak ada.
 *
 * Hanya jenjang yang MENYIMPANG yang perlu didaftarkan; sisanya memakai
 * seluruh mapel. Jadi menambah SMP atau SMA kelak tidak menuntut apa pun
 * di sini, dan hanya jenjang yang benar-benar berbeda yang perlu ditulis.
 *
 * TK sengaja BELUM didaftarkan: belum ada keterangan dari gurunya apakah
 * di sana IPA dinilai atau tidak, dan menebaknya berarti menghilangkan
 * kolom yang mungkin memang mereka pakai. Begitu ada kepastian, cukup
 * tambahkan satu baris di bawah.
 */
const MAPEL_PER_JENJANG = {
  PG: [],
};

/**
 * Mapel berbentuk POIN (lihat lib/poin.js). Di Playgroup, B. Indonesia
 * dan Matematika tidak dinilai 0-100 melainkan dengan nomor tahapan dan
 * target per siswa per bulan -- persis seperti Tahfidz. Tuntas berarti
 * capaian >= target siswa itu sendiri, bukan >= 90.
 *
 * `kunciTarget` inilah pembedanya: ketuntasanMapel() dan peringatanDini()
 * membaca target dari barisnya sendiri kalau kolom itu ada, dan dari
 * target kelas kalau tidak. Grafik, sebaran, dan rata-rata yang hanya
 * bermakna untuk nilai 0-100 memakai mapelSkor() dan melewatkannya.
 */
const MAPEL_POIN_PER_JENJANG = {
  PG: [
    { kunci: 'capaian_peng_bindo', kunciTarget: 'target_peng_bindo', jenisPoin: 'peng_bindo', label: 'B. Indonesia', pendek: 'B. Indo' },
    { kunci: 'capaian_peng_mtk', kunciTarget: 'target_peng_mtk', jenisPoin: 'peng_mtk', label: 'Matematika', pendek: 'MTK' },
  ],
};

/**
 * Daftar mapel untuk satu jenjang. Jenjang kosong atau tak dikenal
 * mengembalikan seluruh mapel -- pada database yang belum menjalankan
 * migrasi multi-sekolah, jenjangnya memang belum terbaca, dan menampilkan
 * lebih banyak jauh lebih aman daripada diam-diam menyembunyikan nilai
 * yang sudah diisi guru.
 */
export function mapelUntuk(jenjang) {
  const j = String(jenjang || '').toUpperCase();
  const pilihan = MAPEL_PER_JENJANG[j];
  const skor = pilihan ? MAPEL.filter((m) => pilihan.includes(m.kunci)) : MAPEL;
  return [...skor, ...(MAPEL_POIN_PER_JENJANG[j] || [])];
}

/** Hanya mapel bernilai 0-100 -- untuk grafik, sebaran, dan rata-rata. */
export function mapelSkor(mapel) {
  return mapel.filter((m) => !m.kunciTarget);
}

/**
 * Ketuntasan satu mapel. Mapel poin (PG) dibandingkan dengan target
 * masing-masing siswa; mapel nilai dengan target kelas.
 */
export function ketuntasanMapel(baris, m, target) {
  if (!m.kunciTarget) return ketuntasan(baris, m.kunci, target);
  const r = rekapQuran(baris, m.kunci, m.kunciTarget);
  if (!r.dinilai) return null;
  return { persen: r.persenTuntas, tuntas: r.tuntas, dinilai: r.dinilai };
}

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
 * Nilai DIBULATKAN lebih dulu (nilaiTampil) baru dimasukkan ke rentang,
 * jadi batasnya bilangan bulat dan setiap nilai masuk tepat satu rentang:
 * 89,5 terbaca "90" di layar dan karena itu masuk "90–98", bukan "80–89".
 *
 * Satu koreksi terhadap tabel aslinya: di sana rentangnya ditulis
 * "... < 70" lalu "71-79", sehingga nilai tepat 70 tidak masuk kelompok
 * mana pun dan diam-diam hilang dari rekap. Di sini 70 masuk 70–79.
 */
export const RENTANG = [
  { label: '< 70', min: -Infinity, max: 69 },
  { label: '70–79', min: 70, max: 79 },
  { label: '80–89', min: 80, max: 89 },
  { label: '90–98', min: 90, max: 98 },
  { label: '99–100', min: 99, max: Infinity },
];

/** Apakah satu baris bulan sudah punya isi apa pun (selain target). */
export function bulanBerdata(b) {
  return (
    b.rata_b_indo !== null && b.rata_b_indo !== undefined ||
    b.rata_mtk !== null && b.rata_mtk !== undefined ||
    b.rata_ipa !== null && b.rata_ipa !== undefined ||
    b.capaian_tahfidz !== null && b.capaian_tahfidz !== undefined ||
    b.capaian_tahsin !== null && b.capaian_tahsin !== undefined ||
    b.capaian_peng_bindo !== null && b.capaian_peng_bindo !== undefined ||
    b.capaian_peng_mtk !== null && b.capaian_peng_mtk !== undefined
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
    i <= batas
      ? b
      : { ...b, target_tahfidz: null, target_tahsin: null, target_peng_bindo: null, target_peng_mtk: null }
  );
}

/** Rata-rata yang mengabaikan NULL, bukan menghitungnya sebagai nol. */
export function rataRata(nilai) {
  const angka = nilai.filter((v) => v !== null && v !== undefined);
  if (!angka.length) return null;
  return angka.reduce((a, b) => a + b, 0) / angka.length;
}

/**
 * Nilai akademik seperti yang DIBACA di layar: bilangan bulat (0,5 ke atas
 * naik). Penggolongan tuntas, sebaran, dan daftar pendampingan semuanya
 * memakai angka ini, supaya angka yang tertulis dan statusnya tidak pernah
 * bertentangan -- "MTK 90 (target 90)" di daftar Perlu Pendampingan adalah
 * contoh yang dicegahnya.
 */
export function nilaiTampil(v) {
  if (v === null || v === undefined) return null;
  return Math.round(Number(v));
}

/** Tuntas bila nilai yang tampil sudah mencapai target. */
export function capaiTarget(v, target) {
  const n = nilaiTampil(v);
  return n !== null && n >= Number(target);
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
  const tuntas = dinilai.filter((b) => capaiTarget(b[kunci], target)).length;
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
    const jumlah = dinilai.filter((v) => {
      const n = nilaiTampil(v);
      return n >= r.min && n <= r.max;
    }).length;
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
export function peringatanDini(baris, target, mapel = MAPEL) {
  return baris
    .map((b) => {
      const alasan = [];

      mapel.forEach((m) => {
        // Mapel poin (PG) memakai target siswa itu sendiri bulan ini.
        const t = m.kunciTarget ? b[m.kunciTarget] : target;
        if (t === null || t === undefined) return;
        if (b[m.kunci] !== null && b[m.kunci] !== undefined && nilaiTampil(b[m.kunci]) < t) {
          alasan.push(`${m.pendek} ${bulat(b[m.kunci])} (target ${t})`);
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

/**
 * Menyambung daftar menjadi kalimat: "A", "A dan B", "A, B, dan C".
 * Dipakai di mana pun beberapa nama/mapel disebut sekaligus, supaya tidak
 * ada lagi kalimat yang hanya menyebut salah satu dari yang seri.
 */
export function gabung(daftar) {
  if (daftar.length <= 1) return daftar.join('');
  if (daftar.length === 2) return `${daftar[0]} dan ${daftar[1]}`;
  return `${daftar.slice(0, -1).join(', ')}, dan ${daftar[daftar.length - 1]}`;
}

/** Narasi rekap kelas, meniru kalimat ringkasan di rapor PDF. */
export function narasiKelas(baris, target, bulan, mapel = MAPEL) {
  const hasil = mapel.map((m) => ({ ...m, k: ketuntasanMapel(baris, m, target) })).filter(
    (m) => m.k
  );
  if (!hasil.length) return `Belum ada nilai yang diinput untuk bulan ${bulan}.`;

  // Dibandingkan dari angka yang DITAMPILKAN (persen dibulatkan), bukan
  // dari nilai mentahnya: 89,6% tertulis "90%", jadi tidak boleh sekaligus
  // dinyatakan "perlu perhatian" karena di bawah ambang 90%.
  const persenBulat = (m) => Number(bulat(m.k.persen));
  const puncak = Math.max(...hasil.map(persenBulat));
  const teratas = hasil.filter((m) => persenBulat(m) === puncak);

  // Ambang ketuntasan akademik: 90% siswa di kelas itu mencapai target
  // (target skor per siswa, juga 90 secara default). Berbeda dari Tahfidz/
  // Tahsin yang targetnya sengaja berubah tiap bulan mengikuti kurikulum --
  // ambang untuk tiga mapel ini tetap sepanjang tahun.
  const perluPerhatian = hasil.filter((m) => persenBulat(m) < AMBANG_KETUNTASAN);

  let teks;
  if (teratas.length === 1) {
    teks = `Pada bulan ${bulan}, mata pelajaran dengan ketuntasan tertinggi adalah ${
      teratas[0].label
    } sebesar ${puncak}%.`;
  } else if (teratas.length === hasil.length) {
    teks = `Pada bulan ${bulan}, seluruh mata pelajaran mencatat ketuntasan yang sama, yaitu ${puncak}%.`;
  } else {
    teks = `Pada bulan ${bulan}, mata pelajaran dengan ketuntasan tertinggi adalah ${gabung(
      teratas.map((m) => m.label)
    )}, sama-sama ${puncak}%.`;
  }

  if (perluPerhatian.length) {
    teks += ` Perlu perhatian khusus pada ${gabung(
      perluPerhatian.map((m) => m.label)
    )}, yang ketuntasannya masih di bawah ${AMBANG_KETUNTASAN}%.`;
  } else {
    teks += ` Seluruh mata pelajaran sudah mencapai ambang ${AMBANG_KETUNTASAN}%.`;
  }

  return teks;
}

/**
 * Nilai tertinggi per mapel, beserta SEMUA siswa yang meraihnya.
 *
 * Sebelumnya hanya satu nama yang disebut walau banyak yang sama -- dan
 * yang tersebut selalu yang namanya paling awal menurut abjad. Sampai 22
 * siswa bisa bernilai 100 dalam satu kelas-bulan.
 *
 * `dinilai` = siswa yang punya nilai mapel itu bulan ini (bukan jumlah
 * siswa terdaftar); itulah pembanding untuk kalimat "N dari M siswa".
 */
export function capaianTerbaik(baris, mapel = MAPEL) {
  // Poin tahapan tertinggi bukan "capaian terbaik" -- anak yang target
  // bulan ini lebih tinggi wajar punya poin lebih tinggi.
  return mapelSkor(mapel).map((m) => {
    const dinilai = baris.filter((b) => b[m.kunci] !== null && b[m.kunci] !== undefined);
    if (!dinilai.length) return null;
    const puncak = Math.max(...dinilai.map((b) => nilaiTampil(b[m.kunci])));
    const peraih = dinilai
      .filter((b) => nilaiTampil(b[m.kunci]) === puncak)
      .map((b) => b.nama_panggilan)
      .sort((a, b) => a.localeCompare(b, 'id'));
    return {
      kunci: m.kunci,
      mapel: m.pendek,
      label: m.label,
      nilai: puncak,
      peraih,
      dinilai: dinilai.length,
    };
  }).filter(Boolean);
}

/**
 * Kalimat satu baris "Nilai tertinggi" dari hasil capaianTerbaik().
 *
 * Aturannya: sebut SEMUA nama, atau sebut jumlahnya saja -- tidak pernah
 * sebagian nama. "Aira, Aisya, Alif, dan 19 lainnya" mengulang cacat yang
 * diperbaiki di sini, sebab yang tersebut hanya yang namanya paling awal.
 *
 *   1 peraih              -> "Matematika: nilai tertinggi 98 diraih Aisya."
 *   2-3 peraih            -> semua nama disebut
 *   4 atau lebih          -> "B. Indonesia: 22 dari 24 siswa meraih nilai tertinggi 100."
 *   semua yang dinilai    -> "B. Indonesia: seluruh 24 siswa meraih nilai 100."
 *
 * Baris "seluruh" didahulukan: 2 peraih dari 2 siswa yang dinilai ditulis
 * "seluruh 2 siswa", bukan dua nama.
 *
 * Fungsi murni supaya bisa diuji tanpa peramban. `potongan` adalah kalimat
 * yang sama dipecah menjadi bagian biasa dan bagian tebal (nama siswa,
 * jumlah) untuk dirender komponen; `teks` ialah gabungannya. `tampilNama`
 * benar bila nama tertulis di dalam kalimat itu sendiri.
 */
export function kalimatTerbaik(t) {
  const n = t.peraih.length;
  let potongan;
  let tampilNama = false;

  if (n > 1 && n === t.dinilai) {
    potongan = [
      { teks: `${t.label}: ` },
      { teks: `seluruh ${t.dinilai} siswa`, tebal: true },
      { teks: ` meraih nilai ${t.nilai}.` },
    ];
  } else if (n >= 4) {
    potongan = [
      { teks: `${t.label}: ` },
      { teks: `${n} dari ${t.dinilai} siswa`, tebal: true },
      { teks: ` meraih nilai tertinggi ${t.nilai}.` },
    ];
  } else {
    tampilNama = true;
    potongan = [
      { teks: `${t.label}: nilai tertinggi ${t.nilai} diraih ` },
      { teks: gabung(t.peraih), tebal: true },
      { teks: '.' },
    ];
  }

  return { teks: potongan.map((p) => p.teks).join(''), tampilNama, potongan };
}

export function bulat(v, desimal = 0) {
  if (v === null || v === undefined) return '–';
  // Nol desimal berarti "seperti yang dibaca di layar": pembulatan yang
  // sama dengan penggolongan tuntas (nilaiTampil), bukan toFixed -- yang
  // membulatkan nilai biner mentah dan bisa berbeda di batas 0,5.
  if (desimal === 0) return String(nilaiTampil(v));
  return Number(v).toFixed(desimal);
}

/** Baris yang benar-benar sudah dinilai, tanpa baris kosong hasil sinkronisasi. */
export function barisDinilai(baris) {
  return baris.filter(bulanBerdata);
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

/**
 * Waktu sinkronisasi terakhir dari baris-baris yang SUDAH dimuat dasbor
 * (kolom disinkron_pada) -- tidak perlu query baru. Menerima beberapa
 * larik sekaligus. Mengembalikan teks ISO milik baris terbaru, atau null
 * bila tidak ada satu pun yang berisi waktu yang sah.
 */
export function terakhirSinkron(...kumpulan) {
  let terbaik = null;
  let waktuTerbaik = -Infinity;
  for (const baris of kumpulan) {
    for (const b of baris || []) {
      const waktu = b?.disinkron_pada ? Date.parse(b.disinkron_pada) : NaN;
      if (Number.isFinite(waktu) && waktu > waktuTerbaik) {
        waktuTerbaik = waktu;
        terbaik = b.disinkron_pada;
      }
    }
  }
  return terbaik;
}

const NAMA_BULAN_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

/**
 * "2026-11-10T07:05:00Z" -> "10 November 2026 14.05" (WIB).
 *
 * Zona waktu dipatok ke Asia/Jakarta, bukan zona peramban: sekolah-sekolah
 * ini seluruhnya di Jawa, dan angka yang sama harus terbaca sama di layar
 * kepala sekolah, di laporan cetak, dan di HP wali kelas yang sedang
 * bepergian. Bulannya ditulis sendiri (bukan lewat Intl) supaya hasilnya
 * tidak bergantung pada versi data bahasa di peramban.
 */
export function formatWaktuSinkron(iso) {
  const waktu = iso ? new Date(iso) : null;
  if (!waktu || Number.isNaN(waktu.getTime())) return null;

  // Digeser +7 jam lalu dibaca sebagai UTC: Asia/Jakarta tidak mengenal
  // waktu musim panas, jadi selisihnya tetap.
  const wib = new Date(waktu.getTime() + 7 * 3600 * 1000);
  const dua = (n) => String(n).padStart(2, '0');
  return (
    `${wib.getUTCDate()} ${NAMA_BULAN_ID[wib.getUTCMonth()]} ${wib.getUTCFullYear()} ` +
    `${dua(wib.getUTCHours())}.${dua(wib.getUTCMinutes())}`
  );
}

/* ================================================================
   Fase 6 — angka kunci, tingkat status, dan tren
   ================================================================ */

/**
 * Empat tingkat ketuntasan, ditetapkan sekolah:
 *
 *   90-100  Baik              (hijau)
 *   75-89   Perlu dipantau    (kuning)
 *   60-74   Perlu perhatian   (oranye)
 *   0-59    Perlu tindakan    (merah)
 *
 * Warnanya menanjak searah dengan kegentingannya, jadi urutan ini bukan
 * selera: oranye terbaca lebih mendesak daripada kuning. `kunci` sama
 * dengan nama token warna di dasbor.module.css (--baik, --dipantau,
 * --perhatian, --tindakan).
 *
 * Satu tabel untuk meter, titik status di tabel rekap, dan ubin angka --
 * dua salinan yang menyimpang akan membuat kelas yang sama berwarna
 * lain di dua tempat pada layar yang sama.
 */
export const TINGKAT_KETUNTASAN = [
  { batas: 90, kunci: 'baik', nama: 'Baik' },
  { batas: 75, kunci: 'dipantau', nama: 'Perlu dipantau' },
  { batas: 60, kunci: 'perhatian', nama: 'Perlu perhatian' },
  { batas: 0, kunci: 'tindakan', nama: 'Perlu tindakan' },
];

/**
 * Tingkat untuk SATU angka persen yang sudah DIBULATKAN (yang tampil di
 * layar). Ketuntasan 89,6% ditulis "90%"; digolongkan dari nilai mentah,
 * ia akan terbaca "90% - Perlu dipantau" dan tampak seperti galat. Maka
 * pemanggil membulatkan lebih dulu -- fungsi ini membulatkan lagi bila
 * lupa, supaya salahnya tidak diam-diam.
 */
export function tingkatKetuntasan(persenBulat) {
  const persen = Math.round(Number(persenBulat));
  return TINGKAT_KETUNTASAN.find((t) => persen >= t.batas) || TINGKAT_KETUNTASAN[TINGKAT_KETUNTASAN.length - 1];
}

/**
 * Ringkasan setiap kelas pada satu bulan: yang dihitung hanya siswa yang
 * SUDAH dinilai (sinkronisasi membuat baris kosong untuk setiap
 * siswa-bulan, dan siswa yang tercatat di dua kelas menambah baris
 * hantu), jadi baris.length bukan "jumlah siswa yang dinilai".
 *
 * Dipisahkan dari halaman supaya angka yang sama bisa dihitung untuk
 * BULAN LAIN -- ubin angka kunci membandingkan bulan ini dengan bulan
 * sebelumnya memakai rumus yang persis sama.
 *
 *   daftarKelas  kelas-kelas yang dirangkum (objek kelas dari database)
 *   dataKelas    kelasId -> perBulan (bulan -> baris siswa)
 */
export function susunRingkasan(daftarKelas, dataKelas, bulan, mapel) {
  return daftarKelas.map((k) => {
    const terdaftarBulanIni = dataKelas[k.id]?.[bulan] || [];
    const baris = barisDinilai(terdaftarBulanIni);
    const target = Number(k.target_akademik ?? 90);
    const perMapel = mapel.map((m) => ketuntasanMapel(baris, m, target));
    const semuaPersen = perMapel.filter(Boolean).map((x) => x.persen);

    return {
      kelas: k,
      baris,
      target,
      jumlah: baris.length,
      terdaftar: terdaftarBulanIni.length,
      perMapel,
      ketuntasanRata: semuaPersen.length ? rataRata(semuaPersen) : null,
      tahfidz: rekapQuran(baris, 'capaian_tahfidz', 'target_tahfidz'),
      tahsin: rekapQuran(baris, 'capaian_tahsin', 'target_tahsin'),
    };
  });
}

/**
 * Empat angka kunci sekolah dari ringkasan satu bulan:
 *
 *   dinilai, terdaftar  siswa yang sudah dinilai dari yang terdaftar
 *   ketuntasan          rata-rata ketuntasan antar kelas (null = belum ada)
 *   kelasDiBawah        kelas dengan >= 1 mapel di bawah ambang -- dinilai
 *                       dari persen yang DIBULATKAN, sama seperti yang
 *                       dibaca di tabel
 *   pendampingan        jumlah siswa hasil peringatanDini seluruh kelas
 */
export function angkaKunci(ringkasan, mapel) {
  let dinilai = 0;
  let terdaftar = 0;
  let pendampingan = 0;
  const kelasDiBawah = [];

  ringkasan.forEach((r) => {
    dinilai += r.jumlah;
    terdaftar += r.terdaftar;
    pendampingan += peringatanDini(r.baris, r.target, mapel).length;
    if (r.perMapel.some((k) => k && Math.round(k.persen) < AMBANG_KETUNTASAN)) {
      kelasDiBawah.push(r.kelas);
    }
  });

  return {
    dinilai,
    terdaftar,
    ketuntasan: rataRata(ringkasan.map((r) => r.ketuntasanRata)),
    kelasDiBawah,
    pendampingan,
  };
}

/**
 * Selisih satu angka terhadap bulan sebelumnya, untuk ubin angka kunci.
 *
 *   sekarang, sebelumnya  angka yang SUDAH dibulatkan seperti tampil di layar
 *   turunMembaik          true untuk angka yang makin kecil makin baik
 *                         (kelas di bawah ambang, siswa perlu pendampingan)
 *
 * Mengembalikan null bila salah satunya tidak ada (bulan sebelumnya belum
 * berdata -- selisih tidak dikarang). `arah` 'sama' tidak punya penilaian.
 */
export function selisihAngka(sekarang, sebelumnya, turunMembaik = false) {
  if (sekarang === null || sekarang === undefined || sebelumnya === null || sebelumnya === undefined) {
    return null;
  }
  const beda = sekarang - sebelumnya;
  if (beda === 0) return { arah: 'sama', besar: 0, membaik: null };
  return {
    arah: beda > 0 ? 'naik' : 'turun',
    besar: Math.abs(beda),
    membaik: turunMembaik ? beda < 0 : beda > 0,
  };
}

/**
 * Tren ketuntasan sepanjang tahun: untuk tiap bulan berdata, ketuntasan
 * tiap mapel atas SELURUH siswa dalam `kelompok`.
 *
 *   kelompok  [{ perBulan, target }] -- seluruh kelas sekolah (kepala
 *             sekolah) atau satu kelas (wali kelas)
 *
 * Kelas berbeda boleh punya target berbeda, jadi ketuntasannya dihitung
 * per kelas lebih dulu (ketuntasanMapel) lalu tuntas dan dinilai dijumlah:
 * persen gabungan = seluruh yang tuntas / seluruh yang dinilai. Persen
 * dibulatkan, sama seperti yang tampil di tabel dan ubin. Mapel tanpa satu
 * pun siswa dinilai pada bulan itu bernilai null (garis terputus, bukan nol).
 */
export function trenKetuntasan(kelompok, bulanBerdata, mapel) {
  return bulanBerdata.map((bulan) => {
    const baris = { bulan };
    mapel.forEach((m) => {
      let tuntas = 0;
      let dinilai = 0;
      kelompok.forEach(({ perBulan, target }) => {
        const r = ketuntasanMapel(barisDinilai(perBulan?.[bulan] || []), m, target);
        if (r) {
          tuntas += r.tuntas;
          dinilai += r.dinilai;
        }
      });
      baris[m.kunci] = dinilai ? Math.round((tuntas / dinilai) * 100) : null;
    });
    return baris;
  });
}
