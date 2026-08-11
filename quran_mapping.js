// =========================================================================
// PEMETAAN CAPAIAN AL-QUR'AN (TAHFIDZ & TAHSIN)
// =========================================================================
// File ini mengekspor objek pemetaan poin angka ke nama Surah / Materi.

/**
 * Urutan bulan mengikuti TAHUN AJARAN, bukan kalender.
 * Dipakai sebagai sumbu X seluruh grafik; mengurutkan bulan menurut abjad
 * atau menurut kalender akan mengacaukan pembacaan tren.
 */
export const BULAN_AJARAN = [
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
  "Januari", "Februari", "Maret", "April", "Mei", "Juni"
];

export const TAHFIDZ_MAPPING = {
  1: "Al Faatihah",
  2: "An Nass",
  3: "Al Falaq",
  4: "Al Ikhlas",
  5: "Al Lahab",
  6: "An Nashr",
  7: "Al Kaafiruun",
  8: "Al Kautsar",
  9: "Al Maa’uun",
  10: "Al Quraisy",
  11: "Al Fiil",
  12: "Al Humazah",
  13: "Al ‘Ashr",
  14: "At Takatsur",
  15: "Al Qaari’ah",
  16: "Al ‘Aadiyaat",
  17: "Az Zalzalah",
  18: "Al Bayyinah",
  19: "Al Qodr",
  20: "Al ‘Alaq",
  21: "At Tiin",
  22: "Al Insyirah",
  23: "Adh Dhuha",
  24: "Al Lail",
  25: "Asy Syam",
  26: "Al Balad",
  27: "Al Fajr",
  28: "Al Ghaasyiyah",
  29: "Al A’laa",
  30: "At Thoriq",
  31: "Al Buruj",
  32: "Al- Insyiqoq",
  33: "Al Muthaffifin",
  34: "Al Infitar",
  35: "At - Takwir",
  36: "Abasa",
  37: "An Naziat",
  38: "An Naba'",
  39: "Al Mursalat",
  40: "Al Insan",
  41: "Al Qiyamah",
  42: "Al Muddassir",
  43: "Al Muzzammil",
  44: "Al Jinn",
  45: "Nuh",
  46: "Al Maarij",
  47: "Al Haqqah",
  48: "Al Qalam",
  49: "Al Mulk"
};

export const TAHSIN_MAPPING = {
  1: "Fathah",
  2: "Fathah",
  3: "Dhummah",
  4: "Tanwin",
  5: "Tanwin",
  6: "Tanwin",
  7: "Mad Asli",
  8: "Mad Asli",
  9: "Mad Asli",
  10: "Gunnah",
  11: "Gunnah",
  12: "Gunnah",
  13: "Mad Wajib",
  14: "Mad Wajib",
  15: "Mad Wajib",
  16: "Mad Wajib",
  17: "Qolqolah",
  18: "Qolqolah",
  19: "Qolqolah",
  20: "Qolqolah",
  21: "Qoidah",
  22: "Ikhfa'",
  23: "Idghom",
  24: "Idhar",
  25: "Juz Amma",
  26: "Juz 29",
  27: "Juz 1",
  28: "Tadarus"
};

/**
 * Mendapatkan deskripsi capaian Al-Qur'an berdasarkan poin.
 * @param {string} type - 'tahfidz' atau 'tahsin'
 * @param {number} points - Jumlah poin capaian
 * @returns {string} - Nama surat/materi atau "-" jika tidak ada
 */
export function getQuranLevelName(type, points) {
  if (points === null || points === undefined || points === "") return "-";
  const p = Math.floor(Number(points));
  if (type === "tahfidz") {
    return TAHFIDZ_MAPPING[p] || `Poin ${p}`;
  } else if (type === "tahsin") {
    return TAHSIN_MAPPING[p] || `Poin ${p}`;
  }
  return "-";
}
