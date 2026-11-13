import { createHash, timingSafeEqual } from 'crypto';

/**
 * Pemeriksa sinkronisasi "terikat sekolah" untuk /api/sync.
 *
 * KENAPA ADA
 * ----------
 * /api/sync memakai service_role, yang MENEMBUS seluruh RLS. Dengan satu
 * kunci bersama untuk semua sekolah, siapa pun yang memegang Apps Script
 * salah satu sekolah -- atau menemukan kuncinya -- dapat menulis baris
 * apa pun ke enam tabel: menimpa nilai sekolah lain, atau menambah baris
 * users_access yang menjadikan emailnya kepala sekolah/direktur di
 * sekolah mana pun.
 *
 * Maka tiap sekolah punya kunci sendiri (env SYNC_SECRETS), dan kunci
 * itu hanya boleh menulis baris milik sekolahnya. Berkas ini berisi
 * aturannya sebagai fungsi MURNI -- tanpa jaringan dan tanpa basis data --
 * supaya bisa diuji sendirian (scripts/uji-sinkron-terikat.mjs). Yang
 * mengambil data pembanding dari basis data (sekolahId, idKelas,
 * emailMilikLain) adalah app/api/sync/route.js.
 */

/* ------------------------------------------------------------------
   Kunci
   ------------------------------------------------------------------ */

/**
 * Membaca env SYNC_SECRETS: JSON {"SDYFK":"<kunci>", "PGYFK":"<kunci>"}.
 *
 * Kode dijadikan HURUF BESAR karena sync.js merapikan kode sekolah
 * dengan cara yang sama sebelum mengirimnya. Isi yang rusak (bukan JSON,
 * atau bukan objek) menghasilkan daftar kosong, bukan galat: hasilnya
 * "tidak ada kunci terikat yang cocok", sehingga gagal TERTUTUP -- hanya
 * kunci lama (SYNC_SHARED_SECRET) yang masih bisa masuk.
 */
export function bacaKunciSekolah(mentah) {
  if (!mentah) return [];
  let isi;
  try {
    isi = JSON.parse(mentah);
  } catch {
    return [];
  }
  if (!isi || typeof isi !== 'object' || Array.isArray(isi)) return [];

  return Object.entries(isi)
    .map(([kode, kunci]) => ({
      kode: String(kode).toUpperCase().replace(/[^A-Z0-9]/g, ''),
      kunci: typeof kunci === 'string' ? kunci.trim() : '',
    }))
    .filter((x) => x.kode && x.kunci);
}

/**
 * Membandingkan dua teks dalam waktu tetap.
 *
 * Keduanya di-hash lebih dulu supaya panjangnya sama: timingSafeEqual
 * melempar galat untuk panjang berbeda, dan memeriksa panjang lebih dulu
 * (seperti app/api/wa/route.js) membocorkan panjang kunci.
 */
export function samaAman(a, b) {
  const x = createHash('sha256').update(String(a ?? '')).digest();
  const y = createHash('sha256').update(String(b ?? '')).digest();
  return timingSafeEqual(x, y);
}

/**
 * Mencari kode sekolah pemilik kunci yang dikirim. null = tidak ada.
 *
 * SEMUA kunci dibandingkan tanpa berhenti di yang pertama cocok, supaya
 * lamanya jawaban tidak memberi tahu kunci keberapa yang hampir benar.
 */
export function kodePemilikKunci(dikirim, daftarKunci) {
  const kunci = String(dikirim || '').trim();
  if (!kunci) return null;

  let ditemukan = null;
  for (const { kode, kunci: milik } of daftarKunci) {
    if (samaAman(kunci, milik) && ditemukan === null) ditemukan = kode;
  }
  return ditemukan;
}

/* ------------------------------------------------------------------
   Aturan tiap baris
   ------------------------------------------------------------------ */

/** Tabel yang barisnya diperiksa. Tabel lain tidak pernah sampai sini. */
export const TABEL_TERIKAT = [
  'sekolah',
  'kelas',
  'siswa',
  'penempatan',
  'nilai_bulanan',
  'users_access',
];

const sama = (a, b) => a !== null && a !== undefined && b !== null && b !== undefined
  && String(a) === String(b);

const teksAwal = (nilai, awalan) => typeof nilai === 'string' && nilai.startsWith(awalan);

function jadikanHimpunan(daftar) {
  if (daftar instanceof Set) return new Set([...daftar].map(String));
  return new Set((daftar || []).map(String));
}

/**
 * Memeriksa seluruh baris satu permintaan. Mengembalikan daftar
 * pelanggaran -- kosong berarti semua baris sah.
 *
 *   tabel   nama tabel tujuan
 *   data    array baris yang akan di-upsert
 *   konteks {
 *     kode            kode sekolah pemilik kunci (huruf besar)
 *     sekolahId       id sekolah itu di tabel sekolah; null bila belum ada
 *     idKelas         seluruh kelas.id milik sekolah itu
 *     emailMilikLain  email (huruf kecil) yang SUDAH dimiliki sekolah lain
 *     kodeDirektur    daftar kode yang boleh mengirim peran direktur_area;
 *                     kosong/tidak ada = tanpa pembatasan (perilaku lama)
 *   }
 *
 * Setiap pelanggaran: { indeks, alasan, nilai } -- nilai adalah isi yang
 * melanggar, untuk contoh di pesan galat.
 */
export function periksaBaris(tabel, data, konteks = {}) {
  const { kode, sekolahId = null, emailMilikLain = [], kodeDirektur = [] } = konteks;
  const idKelas = jadikanHimpunan(konteks.idKelas);
  const lainnya = jadikanHimpunan([...(emailMilikLain || [])].map((e) => String(e).toLowerCase()));
  const awalanNis = `${kode}-`;
  const pelanggaran = [];

  const lapor = (indeks, alasan, nilai) => pelanggaran.push({ indeks, alasan, nilai: String(nilai ?? '(kosong)') });

  (data || []).forEach((baris, i) => {
    if (!baris || typeof baris !== 'object' || Array.isArray(baris)) {
      lapor(i, 'baris bukan objek', JSON.stringify(baris));
      return;
    }

    /* Kolom `id` tidak pernah dikirim sync.js. Tanpanya pun, baris dengan
       `id` milik sekolah lain bisa dipakai sebagai kunci konflik (upsert
       onConflict:'id') untuk MENIMPA baris sekolah itu. */
    if (tabel !== 'sekolah' && Object.prototype.hasOwnProperty.call(baris, 'id')) {
      lapor(i, 'baris tidak boleh membawa kolom id', baris.id);
      return;
    }

    switch (tabel) {
      case 'sekolah':
        if (baris.kode !== kode) lapor(i, 'kode sekolah bukan milik kunci ini', baris.kode);
        break;

      case 'kelas':
        if (!sama(baris.sekolah_id, sekolahId)) lapor(i, 'sekolah_id bukan sekolah pemilik kunci', baris.sekolah_id);
        break;

      case 'siswa':
        if (!sama(baris.sekolah_id, sekolahId)) lapor(i, 'sekolah_id bukan sekolah pemilik kunci', baris.sekolah_id);
        else if (!teksAwal(baris.nis, awalanNis)) lapor(i, `nis tidak berawalan "${awalanNis}"`, baris.nis);
        break;

      case 'penempatan':
      case 'nilai_bulanan':
        if (!teksAwal(baris.nis, awalanNis)) lapor(i, `nis tidak berawalan "${awalanNis}"`, baris.nis);
        else if (!idKelas.has(String(baris.kelas_id))) lapor(i, 'kelas_id bukan kelas sekolah pemilik kunci', baris.kelas_id);
        break;

      case 'users_access': {
        if (!sama(baris.sekolah_id, sekolahId)) {
          lapor(i, 'sekolah_id bukan sekolah pemilik kunci', baris.sekolah_id);
          break;
        }
        const email = String(baris.email || '').toLowerCase().trim();
        if (lainnya.has(email)) {
          lapor(i, 'email sudah terdaftar di sekolah lain', baris.email);
          break;
        }
        const daftarDirektur = (kodeDirektur || []).map((k) => String(k).toUpperCase());
        if (baris.role === 'direktur_area' && daftarDirektur.length && !daftarDirektur.includes(kode)) {
          lapor(i, 'sekolah ini tidak boleh mengirim peran direktur_area', baris.email);
        }
        break;
      }

      default:
        lapor(i, 'tabel tidak dikenal', tabel);
    }
  });

  return pelanggaran;
}

/**
 * Pesan galat 403 dari daftar pelanggaran: menyebut tabel, jumlah baris,
 * dan SATU contoh nilai yang melanggar.
 */
export function pesanPelanggaran(tabel, pelanggaran) {
  const contoh = pelanggaran[0];
  return (
    `Ditolak: ${pelanggaran.length} baris untuk tabel "${tabel}" melanggar batas sekolah ` +
    `pemilik kunci sinkronisasi (contoh: ${contoh.alasan} -- ${contoh.nilai}). ` +
    'Tidak ada data yang ditulis.'
  );
}

/** Membaca SYNC_KODE_DIREKTUR: kode dipisah koma -> daftar huruf besar. */
export function bacaKodeDirektur(mentah) {
  return String(mentah || '')
    .split(',')
    .map((k) => k.trim().toUpperCase())
    .filter(Boolean);
}
