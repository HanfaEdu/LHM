/**
 * ===================================================================
 * PINDAH AKUN — menyalin seluruh file Master Rekap & file kelas ke
 * akun Google lain, lalu menyambung ulang IMPORTRANGE-nya otomatis
 * ===================================================================
 *
 * Dipakai ketika file-file SiPaGi harus pindah pemilik, misalnya dari
 * akun belajar.id (penyimpanan organisasinya penuh, file jadi tidak bisa
 * diedit) ke akun Google pribadi. Kepemilikan file TIDAK bisa dipindah
 * antar-domain, jadi satu-satunya jalan adalah menyalin. Masalahnya,
 * salinan mendapat ID baru, sedangkan rumus IMPORTRANGE di Master Rekap
 * masih menunjuk ID file kelas yang lama. Skrip ini mengganti ID lama
 * itu dengan ID salinannya di SEMUA rumus, jadi tidak ada rumus yang
 * perlu disunting satu-satu.
 *
 * Data di Supabase, tautan rapor orang tua, dan dasbor TIDAK terpengaruh:
 * semuanya diikat ke KODE_SEKOLAH, bukan ke ID file. Selama KODE_SEKOLAH
 * di skrip sinkron tidak diubah, sinkronisasi dari salinan baru langsung
 * melanjutkan data yang sama.
 *
 * Panduan lengkap: perawatan/pindah-akun/README.md
 *
 * CARA PAKAI (ringkas)
 * --------------------
 * 1. Dari akun LAMA, bagikan folder/file sumber ke akun BARU (Editor).
 * 2. Masuk ke akun BARU, buka script.google.com > Proyek baru, tempel
 *    seluruh isi file ini.
 * 3. Isi DAFTAR_SUMBER di bawah, simpan.
 * 4. Jalankan `jalankanPindah`. Kalau waktunya habis, skrip memasang
 *    pemicu untuk melanjutkan sendiri satu menit kemudian. Tidak perlu
 *    ditunggui. Kemajuannya tercatat di spreadsheet "Log Pindah Akun
 *    SiPaGi" (tautannya ada di Log eksekusi).
 * 5. Setelah tahap "selesai", jalankan `periksaHasil` dan baca sheet
 *    "Periksa" di spreadsheet log.
 *
 * File sumber TIDAK diubah sama sekali. Skrip ini hanya membaca sumber
 * dan menulis ke salinan.
 */

// ===================================================================
// KONFIGURASI — ISI BAGIAN INI
// ===================================================================

/**
 * Tautan (atau ID) folder dan/atau file yang akan disalin. Folder
 * disalin beserta seluruh subfoldernya, dengan susunan folder yang sama.
 *
 * WAJIB: Master Rekap dan SEMUA file kelas yang dirujuk IMPORTRANGE-nya
 * ikut masuk daftar ini. File yang tidak ikut disalin tidak punya ID
 * baru, jadi IMPORTRANGE ke file itu tetap menunjuk file lama -- dan
 * `periksaHasil` akan melaporkannya.
 */
const DAFTAR_SUMBER = [
  // 'https://drive.google.com/drive/folders/ISI_ID_FOLDER_SEKOLAH_1',
  // 'https://drive.google.com/drive/folders/ISI_ID_FOLDER_SEKOLAH_2',
  // 'https://docs.google.com/spreadsheets/d/ISI_ID_FILE/edit',
];

/** Nama folder induk di Drive akun baru tempat semua salinan diletakkan. */
const NAMA_FOLDER_TUJUAN = 'SiPaGi (pindahan dari belajar.id)';

/**
 * true  -> salinan dibagikan ke orang yang sama dengan file sumbernya
 *          (editor tetap editor, pembaca tetap pembaca), plus pengaturan
 *          "siapa saja yang memiliki link" disamakan.
 * false -> salinan hanya bisa dibuka pemilik baru; bagikan sendiri nanti.
 *
 * Catatan: Google bisa mengirim surel pemberitahuan "file dibagikan
 * kepada Anda" ke tiap orang. Akun pribadi dibatasi sekitar 100 surel
 * per hari; kalau penerimanya sangat banyak, sebagian bisa gagal dan
 * tercatat di kolom Berbagi -- jalankan lagi esok harinya.
 */
const SALIN_IZIN_BERBAGI = true;

/**
 * Hanya Google Sheets yang disalin. File lain (PDF, gambar, Docs) di
 * folder sumber dicatat sebagai "dilewati" supaya terlihat, tetapi tidak
 * disalin -- SiPaGi tidak membutuhkannya.
 */

// ===================================================================
// SELESAI KONFIGURASI — bagian di bawah tidak perlu diubah
// ===================================================================

/**
 * Batas aman satu eksekusi. Akun Google pribadi memotong eksekusi
 * Apps Script di 6 menit; berhenti di 4,5 menit menyisakan waktu untuk
 * menulis log dan memasang pemicu lanjutan.
 */
const BATAS_MS = 4.5 * 60 * 1000;

const PROP_TAHAP = 'PINDAH_TAHAP';
const PROP_LOG_ID = 'PINDAH_LOG_ID';
const PROP_FOLDER_ID = 'PINDAH_FOLDER_ID';
const FUNGSI_LANJUT = 'jalankanPindah';

const SHEET_PETA = 'Peta ID';
const SHEET_PERIKSA = 'Periksa';
const KOLOM = {
  sumberId: 1, nama: 2, jalur: 3, salinanId: 4, salinanUrl: 5,
  rumus: 6, sumberImport: 7, izinImport: 8, berbagi: 9, catatan: 10,
};
const JUDUL_PETA = [
  'ID Sumber', 'Nama File', 'Folder', 'ID Salinan', 'Tautan Salinan',
  'Rumus Diganti', 'Sumber IMPORTRANGE (ID baru)', 'Izin IMPORTRANGE',
  'Berbagi', 'Catatan',
];

/** ID Drive: 25+ karakter huruf, angka, '-' atau '_'. */
const POLA_ID = /[-\w]{25,}/g;
const TAHAPAN = ['inventaris', 'salin', 'rumus', 'izin', 'berbagi', 'selesai'];

// ===================================================================
// TITIK MASUK
// ===================================================================

/**
 * Menjalankan tahap demi tahap sampai selesai atau waktunya hampir
 * habis. Aman dijalankan berulang kali: baris yang sudah beres di
 * spreadsheet log dilewati.
 */
function jalankanPindah() {
  hapusPemicuLanjutan();
  const mulai = Date.now();
  const props = PropertiesService.getScriptProperties();
  const log = bukaLog();
  Logger.log('Log kemajuan: ' + log.getUrl());

  let tahap = props.getProperty(PROP_TAHAP) || 'inventaris';
  while (tahap !== 'selesai') {
    Logger.log('Tahap: ' + tahap);
    const tuntas = jalankanTahap(tahap, log, mulai);
    if (!tuntas) {
      pasangPemicuLanjutan();
      Logger.log('Waktu hampir habis. Dilanjutkan otomatis sekitar 1 menit lagi (tahap ' + tahap + ').');
      return;
    }
    tahap = TAHAPAN[TAHAPAN.indexOf(tahap) + 1];
    props.setProperty(PROP_TAHAP, tahap);
  }
  Logger.log('SELESAI. Jalankan periksaHasil, lalu baca sheet "' + SHEET_PERIKSA + '" di ' + log.getUrl());
}

/**
 * Memeriksa semua salinan: rumus IMPORTRANGE yang masih menunjuk file
 * di luar daftar salinan, dan sel IMPORTRANGE yang masih #REF! (izin
 * belum diberikan). Hasilnya ditulis ke sheet "Periksa".
 */
function periksaHasil() {
  const log = bukaLog();
  const peta = bacaPeta(log);
  const idBaru = {};
  peta.forEach(function (b) { if (b.salinanId) idBaru[b.salinanId] = true; });
  const idLama = {};
  peta.forEach(function (b) { idLama[b.sumberId] = b; });

  const temuan = [];
  peta.forEach(function (b) {
    if (!b.salinanId) {
      if (!/^dilewati/.test(b.catatan)) temuan.push([b.nama, '', 'Belum tersalin', b.catatan]);
      return;
    }
    let ss;
    try {
      ss = SpreadsheetApp.openById(b.salinanId);
    } catch (e) {
      temuan.push([b.nama, '', 'Salinan tidak bisa dibuka', e.message]);
      return;
    }
    ss.createTextFinder('IMPORTRANGE').matchFormulaText(true).findAll().forEach(function (sel) {
      const rumus = sel.getFormula();
      const alamat = sel.getSheet().getName() + '!' + sel.getA1Notation();
      (rumus.match(POLA_ID) || []).forEach(function (id) {
        if (idBaru[id]) return;
        const asal = idLama[id];
        temuan.push([
          b.nama, alamat,
          asal ? 'Masih menunjuk file LAMA (ID lama belum diganti)' : 'Menunjuk file yang tidak ikut disalin',
          id + (asal ? ' (' + asal.nama + ')' : ''),
        ]);
      });
      const tampil = String(sel.getDisplayValue());
      if (tampil.indexOf('#REF') === 0 || tampil.indexOf('#N/A') === 0) {
        temuan.push([b.nama, alamat, 'IMPORTRANGE menampilkan ' + tampil,
          'Buka file ini, klik sel tersebut, lalu klik "Izinkan akses".']);
      }
    });
  });

  let sheet = log.getSheetByName(SHEET_PERIKSA);
  if (sheet) sheet.clear(); else sheet = log.insertSheet(SHEET_PERIKSA);
  const isi = [['File', 'Sel', 'Masalah', 'Keterangan']].concat(
    temuan.length ? temuan : [['', '', 'Tidak ada masalah ditemukan.', '']]
  );
  sheet.getRange(1, 1, isi.length, 4).setValues(isi);
  sheet.setFrozenRows(1);
  Logger.log(temuan.length + ' temuan. Lihat sheet "' + SHEET_PERIKSA + '" di ' + log.getUrl());
}

/**
 * Mengulang dari tahap tertentu tanpa menghapus salinan yang sudah ada.
 * Contoh: setelah menambah file ke DAFTAR_SUMBER, jalankan
 * ulangiDariInventaris lalu jalankanPindah -- file yang sudah tersalin
 * tidak disalin dua kali.
 */
function ulangiDariInventaris() { setelTahap('inventaris'); }
function ulangiDariRumus() { setelTahap('rumus'); }

function setelTahap(tahap) {
  PropertiesService.getScriptProperties().setProperty(PROP_TAHAP, tahap);
  Logger.log('Tahap disetel ke "' + tahap + '". Jalankan jalankanPindah.');
}

// ===================================================================
// TAHAPAN
// ===================================================================

/** Mengembalikan true kalau tahap tuntas, false kalau waktunya habis. */
function jalankanTahap(tahap, log, mulai) {
  if (tahap === 'inventaris') return tahapInventaris(log);
  if (tahap === 'salin') return tahapSalin(log, mulai);
  if (tahap === 'rumus') return tahapRumus(log, mulai);
  if (tahap === 'izin') return tahapIzin(log, mulai);
  if (tahap === 'berbagi') return SALIN_IZIN_BERBAGI ? tahapBerbagi(log, mulai) : true;
  throw new Error('Tahap tidak dikenal: ' + tahap);
}

/** Mendaftar semua file di DAFTAR_SUMBER ke sheet Peta ID. */
function tahapInventaris(log) {
  if (!DAFTAR_SUMBER.length) {
    throw new Error('DAFTAR_SUMBER masih kosong. Isi dulu di bagian KONFIGURASI.');
  }
  const sheet = log.getSheetByName(SHEET_PETA);
  const sudahAda = {};
  bacaPeta(log).forEach(function (b) { sudahAda[b.sumberId] = true; });

  const baru = [];
  DAFTAR_SUMBER.forEach(function (tautan) {
    const id = ambilId(tautan);
    if (!id) throw new Error('Tidak menemukan ID di: ' + tautan);
    let folder = null;
    try { folder = DriveApp.getFolderById(id); } catch (e) { /* bukan folder */ }
    if (folder) {
      telusuriFolder(folder, folder.getName(), baru, sudahAda);
    } else {
      const file = DriveApp.getFileById(id);
      daftarkanFile(file, '', baru, sudahAda);
    }
  });

  if (baru.length) {
    sheet.getRange(sheet.getLastRow() + 1, 1, baru.length, JUDUL_PETA.length).setValues(baru);
  }
  Logger.log('Inventaris: ' + baru.length + ' file baru terdaftar.');
  return true;
}

function telusuriFolder(folder, jalur, hasil, sudahAda) {
  const file = folder.getFiles();
  while (file.hasNext()) daftarkanFile(file.next(), jalur, hasil, sudahAda);
  const sub = folder.getFolders();
  while (sub.hasNext()) {
    const f = sub.next();
    telusuriFolder(f, jalur + '/' + f.getName(), hasil, sudahAda);
  }
}

function daftarkanFile(file, jalur, hasil, sudahAda) {
  const id = file.getId();
  if (sudahAda[id]) return;
  sudahAda[id] = true;
  const baris = new Array(JUDUL_PETA.length).fill('');
  baris[KOLOM.sumberId - 1] = id;
  baris[KOLOM.nama - 1] = file.getName();
  baris[KOLOM.jalur - 1] = jalur;
  if (file.getMimeType() !== MimeType.GOOGLE_SHEETS) {
    baris[KOLOM.catatan - 1] = 'dilewati: bukan Google Sheets (' + file.getMimeType() + ')';
  }
  hasil.push(baris);
}

/** Menyalin tiap file yang belum punya salinan. */
function tahapSalin(log, mulai) {
  const sheet = log.getSheetByName(SHEET_PETA);
  const peta = bacaPeta(log);
  for (let i = 0; i < peta.length; i++) {
    const b = peta[i];
    if (b.salinanId || /^dilewati/.test(b.catatan)) continue;
    if (Date.now() - mulai > BATAS_MS) return false;
    try {
      const salinan = DriveApp.getFileById(b.sumberId).makeCopy(b.nama, pastikanFolder(b.jalur));
      sheet.getRange(b.baris, KOLOM.salinanId, 1, 2).setValues([[salinan.getId(), salinan.getUrl()]]);
      sheet.getRange(b.baris, KOLOM.catatan).setValue('');
    } catch (e) {
      sheet.getRange(b.baris, KOLOM.catatan).setValue('GAGAL menyalin: ' + e.message);
    }
    SpreadsheetApp.flush();
  }
  return true;
}

/**
 * Mengganti setiap ID lama yang dikenal dengan ID salinannya, di rumus
 * maupun di sel teks biasa (beberapa Master Rekap menaruh URL sumber di
 * sebuah sel lalu memakai IMPORTRANGE(A1; ...)).
 */
function tahapRumus(log, mulai) {
  const sheet = log.getSheetByName(SHEET_PETA);
  const peta = bacaPeta(log);
  const ganti = {};
  peta.forEach(function (b) { if (b.salinanId) ganti[b.sumberId] = b.salinanId; });

  for (let i = 0; i < peta.length; i++) {
    const b = peta[i];
    if (!b.salinanId || b.rumus !== '') continue;
    if (Date.now() - mulai > BATAS_MS) return false;
    try {
      const hasil = gantiIdDiSpreadsheet(SpreadsheetApp.openById(b.salinanId), ganti);
      sheet.getRange(b.baris, KOLOM.rumus, 1, 2).setValues([[hasil.jumlah, hasil.sumber.join(', ')]]);
    } catch (e) {
      sheet.getRange(b.baris, KOLOM.catatan).setValue('GAGAL mengganti rumus: ' + e.message);
      sheet.getRange(b.baris, KOLOM.rumus).setValue('gagal');
    }
    SpreadsheetApp.flush();
  }
  return true;
}

function gantiIdDiSpreadsheet(ss, ganti) {
  let jumlah = 0;
  const sumber = {};
  const ubah = function (teksAsli) {
    return String(teksAsli).replace(POLA_ID, function (id) {
      if (!ganti[id]) return id;
      sumber[ganti[id]] = true;
      return ganti[id];
    });
  };

  // Rumus.
  ss.createTextFinder('[-_A-Za-z0-9]{25,}').useRegularExpression(true).matchFormulaText(true)
    .findAll().forEach(function (sel) {
      const rumus = sel.getFormula();
      if (!rumus) return;
      const baru = ubah(rumus);
      if (baru !== rumus) { sel.setFormula(baru); jumlah++; }
    });

  // Sel teks biasa (bukan rumus) yang berisi URL/ID file.
  ss.createTextFinder('[-_A-Za-z0-9]{25,}').useRegularExpression(true)
    .findAll().forEach(function (sel) {
      if (sel.getFormula()) return;
      const nilai = sel.getValue();
      if (typeof nilai !== 'string') return;
      const baru = ubah(nilai);
      if (baru !== nilai) { sel.setValue(baru); jumlah++; }
    });

  return { jumlah: jumlah, sumber: Object.keys(sumber) };
}

/**
 * IMPORTRANGE ke file baru butuh izin sekali per pasangan file (tombol
 * "Izinkan akses"). Tahap ini mencoba memberikannya otomatis lewat
 * endpoint yang dipakai tombol itu sendiri. Endpoint ini TIDAK
 * didokumentasikan Google: kalau suatu saat berubah, kolomnya mencatat
 * kegagalan dan izin tinggal diberikan manual (lihat README).
 */
function tahapIzin(log, mulai) {
  const sheet = log.getSheetByName(SHEET_PETA);
  const peta = bacaPeta(log);
  const token = ScriptApp.getOAuthToken();

  for (let i = 0; i < peta.length; i++) {
    const b = peta[i];
    if (!b.salinanId || !b.sumberImport || b.izinImport !== '') continue;
    if (Date.now() - mulai > BATAS_MS) return false;
    const hasil = b.sumberImport.split(/,\s*/).filter(function (id) {
      return id && id !== b.salinanId;
    }).map(function (donor) {
      const url = 'https://docs.google.com/spreadsheets/d/' + b.salinanId +
        '/externaldata/addimportrangepermissions?donorDocId=' + donor;
      const r = UrlFetchApp.fetch(url, {
        method: 'post',
        headers: { Authorization: 'Bearer ' + token },
        muteHttpExceptions: true,
      });
      return r.getResponseCode() === 200;
    });
    const ok = hasil.filter(Boolean).length;
    sheet.getRange(b.baris, KOLOM.izinImport).setValue(
      ok === hasil.length ? 'OK (' + ok + ')' : ok + ' dari ' + hasil.length + ' — sisanya izinkan manual'
    );
    SpreadsheetApp.flush();
  }
  return true;
}

/** Menyamakan daftar editor/pembaca dan akses tautan dengan file sumber. */
function tahapBerbagi(log, mulai) {
  const sheet = log.getSheetByName(SHEET_PETA);
  const peta = bacaPeta(log);
  const saya = Session.getEffectiveUser().getEmail().toLowerCase();

  for (let i = 0; i < peta.length; i++) {
    const b = peta[i];
    if (!b.salinanId || b.berbagi !== '') continue;
    if (Date.now() - mulai > BATAS_MS) return false;
    const gagal = [];
    let jumlah = 0;
    try {
      const sumber = DriveApp.getFileById(b.sumberId);
      const salinan = DriveApp.getFileById(b.salinanId);
      const lain = function (u) { return u.getEmail() && u.getEmail().toLowerCase() !== saya; };
      sumber.getEditors().filter(lain).forEach(function (u) {
        try { salinan.addEditor(u.getEmail()); jumlah++; } catch (e) { gagal.push(u.getEmail()); }
      });
      sumber.getViewers().filter(lain).forEach(function (u) {
        try { salinan.addViewer(u.getEmail()); jumlah++; } catch (e) { gagal.push(u.getEmail()); }
      });
      try {
        salinan.setSharing(sumber.getSharingAccess(), sumber.getSharingPermission());
      } catch (e) {
        gagal.push('akses tautan (' + e.message + ')');
      }
      sheet.getRange(b.baris, KOLOM.berbagi).setValue(
        gagal.length ? 'sebagian: ' + jumlah + ' orang; gagal: ' + gagal.join(', ') : 'OK (' + jumlah + ' orang)'
      );
    } catch (e) {
      sheet.getRange(b.baris, KOLOM.berbagi).setValue('gagal: ' + e.message);
    }
    SpreadsheetApp.flush();
  }
  return true;
}

// ===================================================================
// PEMBANTU
// ===================================================================

function ambilId(tautan) {
  const s = String(tautan || '').trim();
  const m = s.match(/\/(?:folders|d)\/([-\w]{25,})/) || s.match(/[?&]id=([-\w]{25,})/);
  if (m) return m[1];
  return /^[-\w]{25,}$/.test(s) ? s : '';
}

function bukaLog() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty(PROP_LOG_ID);
  if (id) {
    try { return SpreadsheetApp.openById(id); } catch (e) { /* terhapus — buat baru */ }
  }
  const log = SpreadsheetApp.create('Log Pindah Akun SiPaGi');
  const sheet = log.getSheets()[0].setName(SHEET_PETA);
  sheet.getRange(1, 1, 1, JUDUL_PETA.length).setValues([JUDUL_PETA]).setFontWeight('bold');
  sheet.setFrozenRows(1);
  DriveApp.getFileById(log.getId()).moveTo(folderInduk());
  props.setProperty(PROP_LOG_ID, log.getId());
  return log;
}

function bacaPeta(log) {
  const sheet = log.getSheetByName(SHEET_PETA);
  const n = sheet.getLastRow() - 1;
  if (n < 1) return [];
  return sheet.getRange(2, 1, n, JUDUL_PETA.length).getValues().map(function (r, i) {
    return {
      baris: i + 2,
      sumberId: String(r[KOLOM.sumberId - 1]),
      nama: String(r[KOLOM.nama - 1]),
      jalur: String(r[KOLOM.jalur - 1]),
      salinanId: String(r[KOLOM.salinanId - 1]),
      rumus: String(r[KOLOM.rumus - 1]),
      sumberImport: String(r[KOLOM.sumberImport - 1]),
      izinImport: String(r[KOLOM.izinImport - 1]),
      berbagi: String(r[KOLOM.berbagi - 1]),
      catatan: String(r[KOLOM.catatan - 1]),
    };
  });
}

function folderInduk() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty(PROP_FOLDER_ID);
  if (id) {
    try { return DriveApp.getFolderById(id); } catch (e) { /* terhapus — buat baru */ }
  }
  const folder = DriveApp.createFolder(NAMA_FOLDER_TUJUAN);
  props.setProperty(PROP_FOLDER_ID, folder.getId());
  return folder;
}

const cacheFolder = {};

/** Folder tujuan untuk jalur relatif "A/B/C", dibuat kalau belum ada. */
function pastikanFolder(jalur) {
  if (cacheFolder[jalur]) return cacheFolder[jalur];
  let folder = folderInduk();
  jalur.split('/').filter(Boolean).forEach(function (nama) {
    const ada = folder.getFoldersByName(nama);
    folder = ada.hasNext() ? ada.next() : folder.createFolder(nama);
  });
  cacheFolder[jalur] = folder;
  return folder;
}

function pasangPemicuLanjutan() {
  ScriptApp.newTrigger(FUNGSI_LANJUT).timeBased().after(60 * 1000).create();
}

function hapusPemicuLanjutan() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === FUNGSI_LANJUT) ScriptApp.deleteTrigger(t);
  });
}
