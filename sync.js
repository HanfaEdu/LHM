/**
 * =========================================================================
 * GOOGLE APPS SCRIPT (GAS) - SYNC SPREADSHEET TO SUPABASE
 * =========================================================================
 * 
 * Pasang script ini pada Spreadsheet Master Anda:
 * 1. Di Google Sheets, buka: Ekstensi > Apps Script.
 * 2. Hapus kode bawaan dan tempel kode di bawah ini.
 * 3. Ubah nilai SUPABASE_URL dan SUPABASE_KEY dengan kredensial Anda.
 * 4. Atur Pemicu (Trigger) tengah malam untuk menjalankan fungsi syncAllData().
 */

const SUPABASE_URL = "https://your-project-id.supabase.co";
const SUPABASE_KEY = "your-service-role-key"; // Direkomendasikan service role key agar bypass RLS kebijakan tulis

// Fungsi Utama untuk Menjalankan Semua Sinkronisasi
function syncAllData() {
  Logger.log("Memulai sinkronisasi data...");
  try {
    syncAcademicData();
    syncUserAccess();
    Logger.log("Sinkronisasi selesai dengan sukses!");
  } catch (error) {
    Logger.log("Gagal melakukan sinkronisasi: " + error.toString());
  }
}

// Sinkronisasi Data Rekap Akademik & Qur'an
function syncAcademicData() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("RekapData") || 
                SpreadsheetApp.getActiveSpreadsheet().getSheets()[0]; // Ambil tab pertama jika "RekapData" tidak ada
  
  Logger.log("Membaca sheet akademik: " + sheet.getName());
  const data = sheet.getDataRange().getValues();
  
  // Mencari baris header kolom
  let headerRowIndex = -1;
  for (let r = 0; r < Math.min(data.length, 20); r++) {
    const row = data[r];
    if (row.indexOf("NISN/NIS") !== -1 || row.indexOf("Nama Siswa") !== -1) {
      headerRowIndex = r;
      break;
    }
  }
  
  if (headerRowIndex === -1) {
    throw new Error("Gagal menemukan baris header kolom (tidak ada kolom 'NISN/NIS' atau 'Nama Siswa').");
  }
  
  const headers = data[headerRowIndex].map(h => h.toString().trim());
  Logger.log("Header terdeteksi pada baris " + (headerRowIndex + 1) + ": " + JSON.stringify(headers));
  
  // Mapping indeks kolom secara dinamis berdasarkan nama header
  const colIndex = {
    tahunAjaran: headers.indexOf("Tahun Ajaran"),
    kelas: headers.indexOf("Kelas"),
    waliKelas: headers.indexOf("Wali Kelas"),
    namaLengkap: headers.indexOf("Nama Lengkap"),
    namaSiswa: headers.indexOf("Nama Siswa"),
    nis: headers.indexOf("NISN/NIS"),
    noWa: headers.indexOf("No WA"),
    bulan: headers.indexOf("Bulan"),
    rataBIndo: headers.indexOf("Rata B. Indo"),
    rataMtk: headers.indexOf("Rata MTK"),
    rataIpa: headers.indexOf("Rata IPA"),
    targetTahfidz: headers.indexOf("Target Tahfidz"),
    capaianTahfidz: headers.indexOf("Capaian Tahfidz"),
    targetTahsin: headers.indexOf("Target Tahsin"),
    capaianTahsin: headers.indexOf("Capaian Tahsin")
  };
  
  // Validasi kolom krusial
  if (colIndex.nis === -1 || colIndex.bulan === -1 || colIndex.tahunAjaran === -1) {
    throw new Error("Kolom krusial (Tahun Ajaran, NISN/NIS, Bulan) tidak ditemukan di spreadsheet.");
  }
  
  const payload = [];
  for (let i = headerRowIndex + 1; i < data.length; i++) {
    const row = data[i];
    
    // Validasi data minimal: NIS dan Bulan tidak boleh kosong
    const nisVal = row[colIndex.nis] ? row[colIndex.nis].toString().trim() : "";
    const bulanVal = row[colIndex.bulan] ? row[colIndex.bulan].toString().trim() : "";
    if (!nisVal || !bulanVal) continue; // Lewati baris kosong atau dekorasi
    
    payload.push({
      tahun_ajaran: row[colIndex.tahunAjaran] ? row[colIndex.tahunAjaran].toString().trim() : "",
      kelas: colIndex.kelas !== -1 && row[colIndex.kelas] ? row[colIndex.kelas].toString().trim() : "",
      wali_kelas: colIndex.waliKelas !== -1 && row[colIndex.waliKelas] ? row[colIndex.waliKelas].toString().trim() : "",
      nama_lengkap: colIndex.namaLengkap !== -1 && row[colIndex.namaLengkap] ? row[colIndex.namaLengkap].toString().trim() : "",
      nama_siswa: colIndex.namaSiswa !== -1 && row[colIndex.namaSiswa] ? row[colIndex.namaSiswa].toString().trim() : "",
      nis: nisVal,
      no_wa: colIndex.noWa !== -1 && row[colIndex.noWa] ? row[colIndex.noWa].toString().trim() : "",
      bulan: bulanVal,
      target_akademik: 90, // Target standar nilai akademik
      rata_b_indo: colIndex.rataBIndo !== -1 ? parseNumeric(row[colIndex.rataBIndo]) : null,
      rata_mtk: colIndex.rataMtk !== -1 ? parseNumeric(row[colIndex.rataMtk]) : null,
      rata_ipa: colIndex.rataIpa !== -1 ? parseNumeric(row[colIndex.rataIpa]) : null,
      target_tahfidz: colIndex.targetTahfidz !== -1 ? parseNumeric(row[colIndex.targetTahfidz]) : null,
      capaian_tahfidz: colIndex.capaianTahfidz !== -1 ? parseNumeric(row[colIndex.capaianTahfidz]) : null,
      target_tahsin: colIndex.targetTahsin !== -1 ? parseNumeric(row[colIndex.targetTahsin]) : null,
      capaian_tahsin: colIndex.capaianTahsin !== -1 ? parseNumeric(row[colIndex.capaianTahsin]) : null
    });
  }
  
  Logger.log("Jumlah data akademik siap kirim: " + payload.length);
  if (payload.length > 0) {
    sendToSupabase("rekap_akademik", payload);
  }
}

// Sinkronisasi Hak Akses Guru & Kasek
function syncUserAccess() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("UserAccess");
  if (!sheet) {
    Logger.log("Sheet 'UserAccess' tidak ditemukan. Lewati sinkronisasi user.");
    return;
  }
  
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return; // Kosong atau hanya header
  
  const payload = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const emailVal = row[0] ? row[0].toString().toLowerCase().trim() : "";
    if (!emailVal) continue; // Skip jika email kosong
    
    payload.push({
      email: emailVal,
      nama: row[1] ? row[1].toString().trim() : "",
      role: row[2] ? row[2].toString().trim() : "wali_kelas", // Default 'wali_kelas'
      kelas: row[3] ? row[3].toString().trim() : null
    });
  }
  
  Logger.log("Jumlah data user akses siap kirim: " + payload.length);
  if (payload.length > 0) {
    sendToSupabase("users_access", payload);
  }
}

// Helper untuk Parsing Angka Secara Aman
function parseNumeric(val) {
  if (val === "" || val === null || val === undefined) return null;
  const num = Number(val);
  return isNaN(num) ? null : num;
}

// Helper fetch HTTP POST Upsert ke Supabase
function sendToSupabase(tableName, dataArray) {
  const url = `${SUPABASE_URL}/rest/v1/${tableName}`;
  const options = {
    method: "POST",
    contentType: "application/json",
    headers: {
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${SUPABASE_KEY}`,
      "Prefer": "resolution=merge-duplicates" // Mengaktifkan mode UPSERT otomatis berdasarkan Unique Constraint
    },
    payload: JSON.stringify(dataArray),
    muteHttpExceptions: true
  };
  
  const response = UrlFetchApp.fetch(url, options);
  const code = response.getResponseCode();
  if (code >= 200 && code < 300) {
    Logger.log(`Sukses sinkronisasi ke tabel [${tableName}]: ${dataArray.length} baris.`);
  } else {
    throw new Error(`Gagal mengirim data ke tabel [${tableName}]. Kode HTTP: ${code}. Respon: ${response.getContentText()}`);
  }
}
