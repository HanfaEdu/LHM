/**
 * ===================================================================
 * GOOGLE APPS SCRIPT — SINKRONISASI SPREADSHEET KELAS -> SUPABASE
 * Sistem Rapor Digital (SiPaDi) — SD Yaumi Fatimah Kudus
 * ===================================================================
 *
 * CARA PASANG
 * -----------
 * 1. Buka file Master Rekap di Google Sheets.
 * 2. Menu: Ekstensi > Apps Script.
 * 3. Hapus kode bawaan, tempel seluruh isi file ini.
 * 4. Isi SUPABASE_URL, SUPABASE_KEY, dan daftar FILE_KELAS di bawah.
 * 5. Simpan, lalu jalankan sekali fungsi `sinkronkanSemua` untuk
 *    memberi izin akses (authorize).
 * 6. Atur Pemicu: Pemicu > Tambah Pemicu > `sinkronkanSemua` >
 *    Berbasis waktu > Timer harian > 00:00-01:00.
 *
 * CATATAN ARSITEKTUR
 * ------------------
 * Script ini membaca LANGSUNG tiap file kelas lewat openById(), dan
 * TIDAK memakai IMPORTRANGE. IMPORTRANGE adalah titik gagal paling
 * rapuh dalam rantai ini: kena kuota, sering menghasilkan #REF! saat
 * file sumber dibuka-tutup, perlu authorize manual per file, dan
 * rentangnya (mis. A2:P301) diam-diam memotong data begitu jumlah
 * siswa bertambah. Membaca langsung menghilangkan semuanya.
 */

// ===================================================================
// KONFIGURASI — ISI BAGIAN INI
// ===================================================================

const SUPABASE_URL = 'https://xxxxxxxxxxxx.supabase.co';

// Gunakan service_role key. Aman karena script ini berjalan di server
// Google, tidak pernah dikirim ke browser siapa pun.
const SUPABASE_KEY = 'ISI_DENGAN_SERVICE_ROLE_KEY';

// Daftar file spreadsheet tiap kelas.
// ID diambil dari URL: docs.google.com/spreadsheets/d/<ID_INI>/edit
const FILE_KELAS = [
  { label: 'Kelas 1',  id: '1ni-fA-2z6sDIjOV0WojK3KjOnBk2D9mvwqCSLbMVhqU' },
  { label: 'Kelas 2A', id: 'GANTI_DENGAN_ID_FILE_KELAS_2A' },
  { label: 'Kelas 2B', id: 'GANTI_DENGAN_ID_FILE_KELAS_2B' },
  { label: 'Kelas 3',  id: 'GANTI_DENGAN_ID_FILE_KELAS_3' },
  { label: 'Kelas 6',  id: '13ylW9o1lZ79WoFyeZqngrmbZCYXvey7L5LOnzni03oc' },
];

/**
 * Penyelamat untuk target yang terlanjur ditulis sebagai teks.
 *
 * Nama materi Tahsin berulang: "Mad Asli" ada di bab 7, 8, DAN 9.
 * Jadi teks "Mad Ashli" tidak bisa dipulihkan otomatis menjadi angka —
 * script akan menolak menebak. Daftarkan di sini bila ada.
 *
 * Kunci: '<nama kelas>|<tahfidz|tahsin>|<teks apa adanya, huruf kecil>'
 */
const OVERRIDE_TARGET_TEKS = {
  '2A|tahsin|mad ashli': 7,   // disamakan dengan Kelas 2B yang menulis "Bab 7"
  '2B|tahsin|bab 7': 7,
};

// ===================================================================
// KONSTANTA
// ===================================================================

// Urutan bulan mengikuti TAHUN AJARAN, bukan kalender.
const BULAN_AJARAN = [
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
];

const SHEET_DATA_SISWA = 'Data Siswa';
const SHEET_REKAP      = 'Rekap Kelas';
const SHEET_USER       = 'users_access';

// ===================================================================
// TITIK MASUK
// ===================================================================

/** Menu manual di Google Sheets, supaya tidak perlu menunggu tengah malam. */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('SiPaDi')
    .addItem('Sinkronkan Sekarang', 'sinkronkanSemua')
    .addItem('Cek Kesehatan Data (tanpa kirim)', 'cekKesehatanData')
    .addToUi();
}

/** Fungsi utama. Inilah yang dipasang sebagai pemicu tengah malam. */
function sinkronkanSemua() {
  const mulai = new Date();
  const catatan = [];

  FILE_KELAS.forEach(function (berkas) {
    if (berkas.id.indexOf('GANTI_DENGAN') === 0) {
      catatan.push('[LEWAT] ' + berkas.label + ': ID file belum diisi.');
      return;
    }
    try {
      const hasil = sinkronkanSatuKelas(berkas);
      catatan.push('[OK]   ' + berkas.label + ': ' + hasil.siswa +
                   ' siswa, ' + hasil.nilai + ' baris nilai.');
    } catch (e) {
      catatan.push('[GAGAL] ' + berkas.label + ': ' + e.message);
    }
  });

  try {
    const hasilUser = sinkronkanUserAccess();
    catatan.push(
      '[OK]   Hak akses: ' + hasilUser.terkirim + ' pengguna' +
      (hasilUser.dilewati ? ', ' + hasilUser.dilewati + ' baris dilewati (lihat log).' : '.')
    );
  } catch (e) {
    catatan.push('[GAGAL] Hak akses: ' + e.message);
  }

  const durasi = Math.round((new Date() - mulai) / 1000);
  const ringkasan = catatan.join('\n') + '\n\nSelesai dalam ' + durasi + ' detik.';
  Logger.log(ringkasan);
  return ringkasan;
}

/**
 * Membaca semua file kelas dan melaporkan masalah data TANPA mengirim
 * apa pun ke Supabase. Jalankan ini dulu sebelum sinkronisasi pertama.
 */
function cekKesehatanData() {
  const temuan = [];

  FILE_KELAS.forEach(function (berkas) {
    if (berkas.id.indexOf('GANTI_DENGAN') === 0) {
      temuan.push(berkas.label + ': ID file belum diisi.');
      return;
    }
    try {
      const isi = bacaFileKelas(berkas);
      const tanpaNis = isi.roster.filter(function (s) { return !s.nis; });
      if (tanpaNis.length) {
        temuan.push(berkas.label + ': ' + tanpaNis.length +
                    ' siswa tanpa NIS (' +
                    tanpaNis.map(function (s) { return s.namaPanggilan; }).join(', ') + ')');
      }

      // Kolom yang kosong total padahal bulan itu punya data lain
      const perBulan = {};
      isi.nilai.forEach(function (b) {
        if (!perBulan[b.bulan]) perBulan[b.bulan] = [];
        perBulan[b.bulan].push(b);
      });
      Object.keys(perBulan).forEach(function (bulan) {
        const baris = perBulan[bulan];
        const adaIsi = baris.some(function (b) {
          return b.rata_b_indo !== null || b.rata_mtk !== null ||
                 b.capaian_tahsin !== null;
        });
        if (!adaIsi) return;
        [['rata_ipa', 'Rata IPA'],
         ['capaian_tahfidz', 'Capaian Tahfidz'],
         ['capaian_tahsin', 'Capaian Tahsin']].forEach(function (pasangan) {
          const terisi = baris.filter(function (b) { return b[pasangan[0]] !== null; }).length;
          if (terisi === 0) {
            temuan.push(berkas.label + ' / ' + bulan + ': kolom ' + pasangan[1] +
                        ' kosong untuk semua ' + baris.length + ' siswa.');
          } else if (terisi === 1 && baris.length > 3) {
            temuan.push(berkas.label + ' / ' + bulan + ': kolom ' + pasangan[1] +
                        ' hanya terisi 1 dari ' + baris.length +
                        ' siswa — rumusnya kemungkinan besar belum ditarik ke bawah.');
          }
        });
      });

      isi.targetTeksBermasalah.forEach(function (t) { temuan.push(berkas.label + ': ' + t); });
    } catch (e) {
      temuan.push(berkas.label + ': GAGAL DIBACA — ' + e.message);
    }
  });

  const laporan = temuan.length
    ? 'Ditemukan ' + temuan.length + ' hal yang perlu diperiksa:\n\n' + temuan.join('\n')
    : 'Tidak ada masalah terdeteksi. Data siap disinkronkan.';
  Logger.log(laporan);

  try {
    SpreadsheetApp.getUi().alert('Cek Kesehatan Data', laporan, SpreadsheetApp.getUi().ButtonSet.OK);
  } catch (e) {
    // Dipanggil dari pemicu, bukan dari menu — cukup ke Logger.
  }
  return laporan;
}

// ===================================================================
// PEMBACAAN SPREADSHEET
// ===================================================================

/**
 * Membaca satu file kelas menjadi objek terstruktur.
 * Tidak menyentuh jaringan sama sekali — murni baca + normalisasi.
 */
function bacaFileKelas(berkas) {
  const ss = SpreadsheetApp.openById(berkas.id);

  // --- Metadata kelas, dari Data Siswa!G2:H4 ---
  const sheetSiswa = ss.getSheetByName(SHEET_DATA_SISWA);
  if (!sheetSiswa) throw new Error('Sheet "' + SHEET_DATA_SISWA + '" tidak ditemukan.');

  const meta = sheetSiswa.getRange('G2:H4').getValues();
  const namaKelas   = normalKelas(meta[0][1]);
  const waliKelas   = teks(meta[1][1]);
  const tahunAjaran = teks(meta[2][1]);

  if (!namaKelas)   throw new Error('Nama kelas kosong di Data Siswa!H2.');
  if (!tahunAjaran) throw new Error('Tahun ajaran kosong di Data Siswa!H4.');

  // --- Daftar siswa, dari Data Siswa!A2:E ---
  const barisSiswa = sheetSiswa.getRange(2, 1, Math.max(sheetSiswa.getLastRow() - 1, 1), 5).getValues();
  const roster = [];
  barisSiswa.forEach(function (r) {
    const namaLengkap = teks(r[1]);
    if (!namaLengkap) return;
    roster.push({
      namaLengkap:    namaLengkap,
      namaPanggilan:  teks(r[2]) || namaLengkap,
      nis:            normalNis(r[3]),
      noWa:           teks(r[4]),
    });
  });

  // --- Nilai bulanan, dari Rekap Kelas ---
  const sheetRekap = ss.getSheetByName(SHEET_REKAP);
  if (!sheetRekap) throw new Error('Sheet "' + SHEET_REKAP + '" tidak ditemukan.');

  const tabel = sheetRekap.getDataRange().getValues();
  const header = tabel[0].map(function (h) { return teks(h); });
  const kol = {
    namaLengkap:    header.indexOf('Nama Lengkap'),
    namaSiswa:      header.indexOf('Nama Siswa'),
    nis:            header.indexOf('NISN/NIS'),
    noWa:           header.indexOf('No WA'),
    bulan:          header.indexOf('Bulan'),
    rataBIndo:      header.indexOf('Rata B. Indo'),
    rataMtk:        header.indexOf('Rata MTK'),
    rataIpa:        header.indexOf('Rata IPA'),
    targetTahfidz:  header.indexOf('Target Tahfidz'),
    capaianTahfidz: header.indexOf('Capaian Tahfidz'),
    targetTahsin:   header.indexOf('Target Tahsin'),
    capaianTahsin:  header.indexOf('Capaian Tahsin'),
  };
  if (kol.namaLengkap === -1 || kol.bulan === -1) {
    throw new Error('Header "Nama Lengkap" / "Bulan" tidak ditemukan di ' + SHEET_REKAP + '.');
  }

  // Peta nama panggilan -> NIS, sebagai cadangan bila kolom NIS di
  // Rekap Kelas kosong (terjadi di file yang Data Siswa-nya belum diisi).
  const nisDariPanggilan = {};
  roster.forEach(function (s) {
    if (s.nis) nisDariPanggilan[kunci(s.namaPanggilan)] = s.nis;
  });

  const targetTeksBermasalah = [];
  const nilai = [];

  for (let i = 1; i < tabel.length; i++) {
    const r = tabel[i];
    const namaLengkap = teks(r[kol.namaLengkap]);
    const bulan = teks(r[kol.bulan]);

    // Blok bulan menyisakan baris kosong sebagai cadangan siswa baru.
    if (!namaLengkap || !bulan) continue;
    if (BULAN_AJARAN.indexOf(bulan) === -1) continue;

    const namaPanggilan = kol.namaSiswa !== -1 ? teks(r[kol.namaSiswa]) : '';
    let nis = kol.nis !== -1 ? normalNis(r[kol.nis]) : '';
    if (!nis) nis = nisDariPanggilan[kunci(namaPanggilan)] || '';

    nilai.push({
      nis:             nis,
      nama_lengkap:    namaLengkap,
      nama_panggilan:  namaPanggilan || namaLengkap,
      no_wa:           kol.noWa !== -1 ? teks(r[kol.noWa]) : '',
      bulan:           bulan,
      urutan_bulan:    BULAN_AJARAN.indexOf(bulan) + 1,
      rata_b_indo:     angka(r[kol.rataBIndo]),
      rata_mtk:        angka(r[kol.rataMtk]),
      rata_ipa:        angka(r[kol.rataIpa]),
      target_tahfidz:  poinQuran(r[kol.targetTahfidz],  'tahfidz', namaKelas, targetTeksBermasalah),
      capaian_tahfidz: poinQuran(r[kol.capaianTahfidz], 'tahfidz', namaKelas, targetTeksBermasalah),
      target_tahsin:   poinQuran(r[kol.targetTahsin],   'tahsin',  namaKelas, targetTeksBermasalah),
      capaian_tahsin:  poinQuran(r[kol.capaianTahsin],  'tahsin',  namaKelas, targetTeksBermasalah),
    });
  }

  isiTargetKeBulanBerikutnya(nilai);

  return {
    namaKelas:   namaKelas,
    waliKelas:   waliKelas,
    tahunAjaran: tahunAjaran,
    roster:      roster,
    nilai:       nilai,
    targetTeksBermasalah: unik(targetTeksBermasalah),
  };
}

/**
 * Meneruskan target ke bulan-bulan berikutnya yang kosong.
 *
 * Sebagian guru mengisi target sekali di awal semester, sebagian lagi
 * mengisinya tiap bulan berjalan. Aturan "pakai target terakhir yang
 * pernah diisi" melayani kedua kebiasaan itu sekaligus, tanpa memaksa
 * siapa pun mengubah caranya:
 *
 *   diisi Juli saja      -> Agustus s/d Juni ikut target Juli
 *   diisi tiap bulan     -> tiap bulan pakai targetnya sendiri
 *   diisi Juli lalu Jan  -> Agustus-Desember ikut Juli, Januari-Juni ikut Januari
 *
 * CAPAIAN sengaja TIDAK diteruskan. Target adalah janji yang berlaku
 * sampai diubah; capaian adalah fakta bulan itu. Bulan tanpa capaian
 * harus tetap kosong supaya grafik menggambarnya sebagai belum dinilai,
 * bukan sebagai hafalan yang mandek di angka yang sama.
 */
function isiTargetKeBulanBerikutnya(nilai) {
  const perSiswa = {};
  nilai.forEach(function (b) {
    const k = b.nis || kunci(b.nama_lengkap);
    if (!perSiswa[k]) perSiswa[k] = [];
    perSiswa[k].push(b);
  });

  Object.keys(perSiswa).forEach(function (k) {
    const baris = perSiswa[k].sort(function (a, b) {
      return a.urutan_bulan - b.urutan_bulan;
    });
    let tahfidzTerakhir = null;
    let tahsinTerakhir  = null;
    baris.forEach(function (b) {
      if (b.target_tahfidz !== null) tahfidzTerakhir = b.target_tahfidz;
      else if (tahfidzTerakhir !== null) b.target_tahfidz = tahfidzTerakhir;

      if (b.target_tahsin !== null) tahsinTerakhir = b.target_tahsin;
      else if (tahsinTerakhir !== null) b.target_tahsin = tahsinTerakhir;
    });
  });
}

// ===================================================================
// SINKRONISASI
// ===================================================================

function sinkronkanSatuKelas(berkas) {
  const isi = bacaFileKelas(berkas);

  // 1. Kelas — dibuat/diperbarui dulu karena baris lain merujuk ke id-nya.
  const kelasTersimpan = kirim('kelas', [{
    tahun_ajaran: isi.tahunAjaran,
    nama_kelas:   isi.namaKelas,
    wali_kelas:   isi.waliKelas,
    updated_at:   new Date().toISOString(),
  }], 'tahun_ajaran,nama_kelas', true);

  const kelasId = kelasTersimpan[0].id;

  // 2. Siswa — identitas, disimpan sekali saja (bukan diulang tiap bulan).
  const siswa = isi.roster
    .filter(function (s) { return s.nis; })
    .map(function (s) {
      return {
        nis:            s.nis,
        nama_lengkap:   s.namaLengkap,
        nama_panggilan: s.namaPanggilan,
        updated_at:     new Date().toISOString(),
      };
    });
  if (siswa.length) kirim('siswa', siswa, 'nis');

  // 3. Penempatan siswa di kelas ini pada tahun ajaran ini.
  const penempatan = siswa.map(function (s) {
    return { nis: s.nis, kelas_id: kelasId };
  });
  if (penempatan.length) kirim('penempatan', penempatan, 'nis,kelas_id');

  // 4. Nilai bulanan — hanya angka.
  const nisDikenal = {};
  siswa.forEach(function (s) { nisDikenal[s.nis] = true; });

  const nilai = isi.nilai
    .filter(function (b) { return b.nis && nisDikenal[b.nis]; })
    .map(function (b) {
      return {
        nis:             b.nis,
        kelas_id:        kelasId,
        bulan:           b.bulan,
        urutan_bulan:    b.urutan_bulan,
        rata_b_indo:     b.rata_b_indo,
        rata_mtk:        b.rata_mtk,
        rata_ipa:        b.rata_ipa,
        target_tahfidz:  b.target_tahfidz,
        capaian_tahfidz: b.capaian_tahfidz,
        target_tahsin:   b.target_tahsin,
        capaian_tahsin:  b.capaian_tahsin,
        disinkron_pada:  new Date().toISOString(),
      };
    });

  // Dikirim bertahap supaya satu payload tidak melebihi batas UrlFetchApp.
  for (let i = 0; i < nilai.length; i += 400) {
    kirim('nilai_bulanan', nilai.slice(i, i + 400), 'nis,kelas_id,bulan');
  }

  return { siswa: siswa.length, nilai: nilai.length };
}

/**
 * Peran yang diterima tabel users_access. Sengaja hanya guru & kepala
 * sekolah — akses orang tua memakai jalur terpisah (lihat akses_ortu
 * dan docs/AKSES_ORANG_TUA.md), bukan baris di sheet ini.
 */
const PERAN_VALID = ['kepala_sekolah', 'wali_kelas'];

/** Membaca sheet 'users_access' di file Master (tempat script ini terpasang). */
function sinkronkanUserAccess() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_USER);
  if (!sheet) {
    Logger.log('Sheet "' + SHEET_USER + '" tidak ada. Sinkronisasi hak akses dilewati.');
    return { terkirim: 0, dilewati: 0 };
  }

  const tabel = sheet.getDataRange().getValues();
  const daftar = [];
  const dilewati = [];

  for (let i = 1; i < tabel.length; i++) {
    const email = teks(tabel[i][0]).toLowerCase();
    if (!email) continue;

    const role = teks(tabel[i][2]).toLowerCase();

    // Baris dengan peran di luar daftar dilewati, bukan ikut dikirim.
    // Database menolak peran yang tidak dikenal (CHECK constraint), dan
    // karena seluruh baris dikirim dalam satu paket, satu baris salah
    // akan menggagalkan sinkronisasi guru & kepsek yang sebenarnya benar.
    if (PERAN_VALID.indexOf(role) === -1) {
      dilewati.push(email + ' (peran "' + teks(tabel[i][2]) + '" tidak dikenal)');
      continue;
    }

    daftar.push({
      email:      email,
      nama:       teks(tabel[i][1]),
      role:       role,
      nama_kelas: role === 'wali_kelas' ? normalKelas(tabel[i][3]) : null,
    });
  }

  if (dilewati.length) {
    Logger.log('Baris users_access dilewati:\n' + dilewati.join('\n'));
  }
  if (daftar.length) kirim('users_access', daftar, 'email');
  return { terkirim: daftar.length, dilewati: dilewati.length };
}

// ===================================================================
// HELPER
// ===================================================================

/** POST upsert ke Supabase REST. Mengembalikan baris hasil bila diminta. */
function kirim(tabel, data, kolomKonflik, kembalikan) {
  const preferensi = ['resolution=merge-duplicates'];
  preferensi.push(kembalikan ? 'return=representation' : 'return=minimal');

  const respons = UrlFetchApp.fetch(
    SUPABASE_URL + '/rest/v1/' + tabel + '?on_conflict=' + encodeURIComponent(kolomKonflik),
    {
      method: 'post',
      contentType: 'application/json',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: 'Bearer ' + SUPABASE_KEY,
        Prefer: preferensi.join(','),
      },
      payload: JSON.stringify(data),
      muteHttpExceptions: true,
    }
  );

  const kode = respons.getResponseCode();
  if (kode < 200 || kode >= 300) {
    throw new Error('Supabase menolak tabel [' + tabel + '] (HTTP ' + kode + '): ' +
                    respons.getContentText().slice(0, 300));
  }
  return kembalikan ? JSON.parse(respons.getContentText()) : null;
}

/** Sel -> teks bersih. */
function teks(v) {
  if (v === null || v === undefined) return '';
  return String(v).trim().replace(/\s+/g, ' ');
}

/** Kunci pembanding yang tahan beda spasi & kapital. */
function kunci(v) {
  return teks(v).toLowerCase();
}

/**
 * NIS selalu string.
 * Google Sheets menyimpan sebagian NIS sebagai angka dan sebagian sebagai
 * teks di file yang sama, sehingga 302 bisa terbaca "302" atau "302.0".
 * Tanpa normalisasi ini, satu siswa bisa terpecah jadi dua baris.
 */
function normalNis(v) {
  if (v === null || v === undefined || v === '') return '';
  if (typeof v === 'number') return String(Math.round(v));
  return String(v).trim().replace(/\.0+$/, '');
}

/** Nama kelas: 1 -> "1", "2a" -> "2A", "2 (Dua)" -> "2". */
function normalKelas(v) {
  let s = teks(v).toUpperCase();
  if (!s) return '';
  s = s.replace(/\s*\(.*\)\s*/g, '');       // buang "(Dua)"
  s = s.replace(/^KELAS\s+/, '');           // buang awalan "Kelas "
  s = s.replace(/\.0+$/, '');               // 2.0 -> 2
  return s.trim();
}

/**
 * Sel -> angka atau null.
 *
 * "s" (sakit/izin) dan sel kosong sama-sama menjadi null, BUKAN 0.
 * Kalau ketidakhadiran dihitung sebagai nol, rata-rata anak yang sering
 * sakit akan anjlok padahal ia tidak pernah dinilai rendah.
 */
function angka(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return isFinite(v) ? v : null;

  const s = String(v).trim();
  if (!s) return null;
  if (/^[a-zA-Z]+$/.test(s)) return null;   // "s", "i", "a", "-"

  // Terima format Indonesia (94,125) maupun Inggris (94.125).
  const n = Number(s.indexOf(',') !== -1 && s.indexOf('.') === -1
    ? s.replace(',', '.')
    : s);
  return isNaN(n) ? null : n;
}

/**
 * Sel target/capaian Al-Qur'an -> poin (angka).
 *
 * Angka dipakai apa adanya. Teks dicoba dicocokkan ke nama surah/materi;
 * bila namanya ambigu (nama materi Tahsin berulang di beberapa bab),
 * script menolak menebak dan mencatatnya sebagai temuan agar diperbaiki
 * di spreadsheet — lebih baik kosong daripada salah angka.
 */
function poinQuran(v, jenis, namaKelas, catatan) {
  const langsung = angka(v);
  if (langsung !== null) return Math.round(langsung);

  const t = kunci(v);
  if (!t) return null;

  const override = OVERRIDE_TARGET_TEKS[namaKelas + '|' + jenis + '|' + t];
  if (override !== undefined) return override;

  const peta = jenis === 'tahfidz' ? NAMA_TAHFIDZ : NAMA_TAHSIN;
  const cocok = [];
  Object.keys(peta).forEach(function (poin) {
    if (kunci(peta[poin]) === t) cocok.push(Number(poin));
  });

  if (cocok.length === 1) return cocok[0];

  catatan.push(cocok.length === 0
    ? 'Target/capaian ' + jenis + ' bertuliskan "' + teks(v) +
      '" tidak dikenali. Isi dengan angka, atau daftarkan di OVERRIDE_TARGET_TEKS.'
    : 'Target/capaian ' + jenis + ' bertuliskan "' + teks(v) +
      '" ambigu (cocok dengan bab ' + cocok.join(', ') +
      '). Isi dengan angka, atau daftarkan di OVERRIDE_TARGET_TEKS.');
  return null;
}

function unik(arr) {
  const terlihat = {};
  return arr.filter(function (x) {
    if (terlihat[x]) return false;
    terlihat[x] = true;
    return true;
  });
}

// Salinan mapping untuk keperluan script ini (Apps Script tidak bisa
// meng-import quran_mapping.js). Sumber kebenaran tetap tabel
// mapping_quran di Supabase; ini hanya untuk memulihkan target yang
// terlanjur ditulis sebagai teks.
const NAMA_TAHFIDZ = {
  1: 'Al Faatihah', 2: 'An Nass', 3: 'Al Falaq', 4: 'Al Ikhlas',
  5: 'Al Lahab', 6: 'An Nashr', 7: 'Al Kaafiruun', 8: 'Al Kautsar',
  9: 'Al Maa’uun', 10: 'Al Quraisy', 11: 'Al Fiil', 12: 'Al Humazah',
  13: 'Al ‘Ashr', 14: 'At Takatsur', 15: 'Al Qaari’ah',
  16: 'Al ‘Aadiyaat', 17: 'Az Zalzalah', 18: 'Al Bayyinah',
  19: 'Al Qodr', 20: 'Al ‘Alaq', 21: 'At Tiin', 22: 'Al Insyirah',
  23: 'Adh Dhuha', 24: 'Al Lail', 25: 'Asy Syam', 26: 'Al Balad',
  27: 'Al Fajr', 28: 'Al Ghaasyiyah', 29: 'Al A’laa', 30: 'At Thoriq',
  31: 'Al Buruj', 32: 'Al- Insyiqoq', 33: 'Al Muthaffifin', 34: 'Al Infitar',
  35: 'At - Takwir', 36: 'Abasa', 37: 'An Naziat', 38: 'An Naba\'',
  39: 'Al Mursalat', 40: 'Al Insan', 41: 'Al Qiyamah', 42: 'Al Muddassir',
  43: 'Al Muzzammil', 44: 'Al Jinn', 45: 'Nuh', 46: 'Al Maarij',
  47: 'Al Haqqah', 48: 'Al Qalam', 49: 'Al Mulk',
};

const NAMA_TAHSIN = {
  1: 'Fathah', 2: 'Fathah', 3: 'Dhummah', 4: 'Tanwin', 5: 'Tanwin',
  6: 'Tanwin', 7: 'Mad Asli', 8: 'Mad Asli', 9: 'Mad Asli', 10: 'Gunnah',
  11: 'Gunnah', 12: 'Gunnah', 13: 'Mad Wajib', 14: 'Mad Wajib',
  15: 'Mad Wajib', 16: 'Mad Wajib', 17: 'Qolqolah', 18: 'Qolqolah',
  19: 'Qolqolah', 20: 'Qolqolah', 21: 'Qoidah', 22: 'Ikhfa\'',
  23: 'Idghom', 24: 'Idhar', 25: 'Juz Amma', 26: 'Juz 29', 27: 'Juz 1',
  28: 'Tadarus',
};
