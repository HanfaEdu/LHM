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
