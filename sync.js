/**
 * ===================================================================
 * GOOGLE APPS SCRIPT — SINKRONISASI MASTER REKAP -> SUPABASE
 * Sistem Rapor Digital (SiPaDi) — SD Yaumi Fatimah Kudus
 * ===================================================================
 *
 * CARA PASANG
 * -----------
 * 1. Buka file Master Rekap di Google Sheets.
 * 2. Menu: Ekstensi > Apps Script.
 * 3. Hapus kode bawaan, tempel seluruh isi file ini.
 * 4. Isi SUPABASE_URL dan SUPABASE_KEY di bawah.
 * 5. Simpan, lalu jalankan sekali fungsi `sinkronkanSemua` untuk
 *    memberi izin akses (authorize).
 * 6. Atur Pemicu: Pemicu > Tambah Pemicu > `sinkronkanSemua` >
 *    Berbasis waktu > Timer harian > 00:00-01:00.
 *
 * CATATAN ARSITEKTUR
 * ------------------
 * Script ini membaca SATU sheet saja: `Sheet1` di Master Rekap, yang
 * berisi 7 blok IMPORTRANGE (satu per kelas) yang sudah digabung wali
 * kelas. Ini lebih sederhana daripada membuka 7 file kelas satu per
 * satu — setiap baris sudah membawa kolom "Kelas" sendiri, sehingga
 * script ini tidak perlu tahu batas antar-blok sama sekali.
 *
 * Konsekuensinya: script ini bergantung pada IMPORTRANGE tetap hidup.
 * Untuk menjaga itu, `cekKesehatanData()` memvalidasi bahwa ketujuh
 * kelas di KELAS_DIHARAPKAN benar-benar muncul dengan jumlah siswa
 * yang wajar — kalau otorisasi salah satu file kelas putus, IMPORTRANGE
 * untuk kelas itu diam-diam kosong (bukan error keras), dan validasi
 * inilah yang menangkapnya sebelum data lompong ikut tersinkron.
 *
 * Sumber tiap blok (untuk keperluan investigasi bila IMPORTRANGE putus):
 *   Kelas 1  -> https://docs.google.com/spreadsheets/d/1ni-fA-2z6sDIjOV0WojK3KjOnBk2D9mvwqCSLbMVhqU
 *   Kelas 2A -> https://docs.google.com/spreadsheets/d/1ZRQk2OniU9a6py1JlNlgvKRnQlnu74XvD4oGf5mDc30
 *   Kelas 2B -> https://docs.google.com/spreadsheets/d/1mPPXLgRUi3udMbkSyEwJJha857IRQqXQNEVvhGG1Bxo
 *   Kelas 3  -> https://docs.google.com/spreadsheets/d/1-xj70IwyCD5YAvnf2Icimu4D6qRsp-zdL2mnDFRvwRI
 *   Kelas 4  -> https://docs.google.com/spreadsheets/d/1cv2W0S-0XZPJMoS_XqNlnowChGp9wODd0SCdxIu9bek
 *   Kelas 5  -> https://docs.google.com/spreadsheets/d/1CTR3F1mqzcTMYppMJH68id3lM8T5ofMPfPCmhPUVMk4
 *   Kelas 6  -> https://docs.google.com/spreadsheets/d/13ylW9o1lZ79WoFyeZqngrmbZCYXvey7L5LOnzni03oc
 */

// ===================================================================
// KONFIGURASI — ISI BAGIAN INI
// ===================================================================

// URL aplikasi Next.js Anda di Vercel (tanpa garis miring di akhir).
// GAS mengirim data ke SINI, bukan ke Supabase langsung -- lihat
// catatan "KENAPA LEWAT PROXY" di bawah.
const APP_URL = 'https://ISI_DENGAN_DOMAIN_VERCEL_ANDA.vercel.app';

// Kunci rahasia bersama antara GAS dan endpoint /api/sync di Vercel.
// HARUS SAMA PERSIS dengan env var SYNC_SHARED_SECRET di Vercel.
// Ini BUKAN kunci Supabase -- boleh dibuat sendiri, string acak apa saja.
const SYNC_SECRET = 'ISI_DENGAN_KUNCI_RAHASIA_YANG_SAMA_DENGAN_VERCEL';

/**
 * IDENTITAS SEKOLAH
 * -----------------
 * Satu Master Rekap melayani satu sekolah, jadi identitasnya cukup
 * ditulis sekali di sini -- tidak perlu diulang sebagai kolom di ribuan
 * baris spreadsheet, dan tidak bisa salah ketik di sebagian baris saja.
 *
 * Berlaku juga untuk sheet users_access: seluruh wali kelas dan kepala
 * sekolah di dalamnya otomatis menjadi milik sekolah ini, jadi sheet
 * itu pun tidak perlu kolom sekolah.
 *
 * (Kalau suatu saat satu Master Rekap harus melayani beberapa sekolah
 * sekaligus -- misalnya satu Tim Manajemen mengelola tiga SD dalam satu
 * berkas -- barulah dibutuhkan kolom "Sekolah" per baris. Belum dibuat,
 * karena sampai sekarang tiap sekolah punya Master Rekap sendiri.)
 *
 * KODE_SEKOLAH: singkat, huruf besar, dan TIDAK BOLEH DIUBAH setelah
 * ada siswa yang tersinkron. Kode inilah yang menjadi awalan nomor
 * induk global (SDYFK-281), memisahkan siswa 301 Kudus dari siswa
 * 301 Pati. Mengubahnya sesudah data masuk sama dengan mengganti
 * kunci seluruh siswa -- token orang tua akan kehilangan siswanya.
 *
 * Polanya <jenjang><singkatan sekolah>, karena TK dan SD di satu kota
 * adalah DUA sekolah berbeda dengan siswa dan wali kelas sendiri-sendiri:
 *
 *   SDYFK  -> 'SD Yaumi Fatimah Kudus'    area 'Pati Raya'
 *   SDYFP  -> 'SD Yaumi Fatimah Pati'     area 'Pati Raya'
 *   SDYFJ  -> 'SD Yaumi Fatimah Juwana'   area 'Pati Raya'
 *   TKYFJ  -> 'TK Yaumi Fatimah Juwana'   area 'Pati Raya'
 *   SDBK   -> 'SD BIAS Klaten'            area 'Klaten-Solo'
 *
 * Kodenya sendiri TIDAK diterjemahkan oleh sistem: yang tampil di kepala
 * dasbor adalah NAMA_SEKOLAH di bawah, apa adanya. Jadi sekolah baru
 * dengan penamaan seperti apa pun cukup mengisi dua baris ini -- tidak
 * ada daftar di dalam kode yang perlu ikut ditambah.
 */
const KODE_SEKOLAH = 'SDYFK';
const NAMA_SEKOLAH = 'SD Yaumi Fatimah Kudus';
const AREA_SEKOLAH = 'Pati Raya';   // Tim Manajemen; boleh dikosongkan
const JENJANG_SEKOLAH = 'SD';       // PG | TK | SD | SMP | SMA

/**
 * Jenjang yang dikenal sistem.
 *
 * Bukan sekadar daftar isian: jenjang menentukan mata pelajaran mana
 * yang tampil (PG tidak menilai IPA) DAN menjadi dasar cakupan biro
 * akademik. Jenjang yang salah ketik -- 'SDIT' alih-alih 'SD' -- membuat
 * sekolahnya hilang dari pandangan biro yang bercakupan, tanpa satu pun
 * pesan galat. Karena itu isinya diperiksa, bukan dikirim apa adanya.
 *
 * Nama sekolah boleh apa saja ('SDIT Yaumi Fatimah'); yang harus salah
 * satu dari daftar ini hanya JENJANG_SEKOLAH.
 */
const JENJANG_VALID = ['PG', 'TK', 'SD', 'SMP', 'SMA'];

/** JENJANG_SEKOLAH yang sudah dirapikan, atau '' kalau tidak dikenal. */
function jenjangRapi() {
  const j = teks(JENJANG_SEKOLAH).toUpperCase();
  return JENJANG_VALID.indexOf(j) === -1 ? '' : j;
}

/**
 * Alamat tempat wali kelas sekolah INI mengisi dan menyunting nilai.
 *
 * Tiap sekolah punya aplikasi input LHM sendiri, jadi alamatnya ikut
 * dikirim bersama identitas sekolah -- bukan dipatok di dalam kode
 * dasbor. Tombol "Input/Edit LHM" di kepala dasbor wali kelas membaca
 * alamat inilah, sehingga wali kelas Pati menuju aplikasi Pati tanpa
 * ada satu baris pun yang perlu diubah di aplikasi dasbor.
 *
 * Boleh dikosongkan (''): tombolnya tidak akan muncul sama sekali,
 * yang jauh lebih baik daripada muncul lalu membawa wali kelas ke
 * aplikasi milik sekolah lain.
 *
 * Harus diawali https:// -- alamat http biasa ditolak oleh peramban HP
 * ketika dibuka dari halaman yang sudah https.
 */
const LINK_LHM = 'https://laporan-akademik.vercel.app/';

/**
 * KENAPA LEWAT PROXY, BUKAN LANGSUNG KE SUPABASE
 * -----------------------------------------------
 * Supabase menolak kunci sb_secret_... kalau permintaan terdeteksi
 * berasal dari browser ("Forbidden use of secret API key in browser").
 * UrlFetchApp Apps Script ikut ter-deteksi sebagai browser oleh
 * heuristik itu, walau GAS jelas berjalan di server Google -- menambah
 * header User-Agent kustom pun tidak menembusnya.
 *
 * Solusinya: GAS memanggil endpoint /api/sync di aplikasi Vercel kita
 * sendiri (pakai SYNC_SECRET di atas, bukan kunci Supabase). Endpoint
 * itu yang berjalan di server Vercel -- bukan browser -- barulah bicara
 * ke Supabase dengan kunci sb_secret_... yang sebenarnya.
 */

/**
 * Kelas yang seharusnya selalu ada di Master Rekap sekolah INI.
 *
 * Dipakai Cek Kesehatan Data untuk mendeteksi kalau IMPORTRANGE salah
 * satu kelas berhenti mengalir: kalau izin berbagi file sumber berubah,
 * blok kelas itu diam-diam kosong -- bukan galat keras -- dan tanpa
 * daftar ini, data lompong akan ikut tersinkron tanpa ada yang tahu.
 *
 * WAJIB DISESUAIKAN TIAP SEKOLAH. Isinya harus ditulis SAMA PERSIS
 * dengan yang ada di Master Rekap, termasuk besar-kecil hurufnya. Nama
 * kelas bebas -- sistem membacanya apa adanya, tidak pernah menganggapnya
 * angka:
 *
 *   SD  : ['1', '2A', '2B', '3', '4', '5', '6']
 *   PG  : ['Kumbang', 'Capung']   atau  ['PG Kecil', 'PG Besar']
 *
 * Batas 20 karakter per nama, mengikuti kolom kelas.nama_kelas di
 * database. Nama yang lebih panjang DITOLAK database dan menggagalkan
 * sinkronisasi -- Cek Kesehatan Data memperingatkannya lebih dulu.
 *
 * Boleh dikosongkan ([]) kalau daftar kelasnya belum tetap: pemeriksaan
 * IMPORTRANGE dilewati, pemeriksaan lain tetap berjalan.
 */
const KELAS_DIHARAPKAN = ['1', '2A', '2B', '3', '4', '5', '6'];

/** Batas panjang nama kelas, mengikuti kolom kelas.nama_kelas. */
const MAKS_NAMA_KELAS = 20;

/**
 * Penyelamat untuk target yang terlanjur ditulis sebagai teks DAN
 * namanya ambigu (Tahsin saja — nama Tahfidz tidak pernah berulang,
 * jadi selalu bisa dikenali otomatis lewat NAMA_TAHFIDZ).
 *
 * "Mad Asli" ada di bab 7, 8, DAN 9 — jadi tidak bisa ditebak otomatis.
 * Kunci: '<nama kelas>|tahsin|<teks apa adanya, huruf kecil>'
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

const SHEET_REKAP_MASTER = 'Sheet1';
const SHEET_USER = 'users_access';

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

  try {
    const isi = bacaMasterRekap();
    const hasil = sinkronkanDariMaster(isi);
    catatan.push(
      '[OK]   Nilai: ' + hasil.kelas + ' kelas, ' + hasil.siswa +
      ' siswa, ' + hasil.nilai + ' baris nilai.'
    );
    if (isi.targetTeksBermasalah.length) {
      catatan.push('       (' + isi.targetTeksBermasalah.length +
                   ' peringatan target — lihat log untuk detail.)');
      Logger.log('Peringatan target:\n' + isi.targetTeksBermasalah.join('\n'));
    }
  } catch (e) {
    catatan.push('[GAGAL] Nilai: ' + e.message);
  }

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
  const ringkasan =
    identitasSekolah() + '\n\n' +
    catatan.join('\n') + '\n\nSelesai dalam ' + durasi + ' detik.';
  Logger.log(ringkasan);
  tampilkanRingkasan(ringkasan);

  // Kedua bagian di atas sengaja memakai try/catch terpisah supaya
  // kegagalan yang satu tidak menjatuhkan yang lain. Efek sampingnya:
  // fungsi ini SELESAI DENGAN WAJAR walau seluruh isinya gagal -- dan
  // bagi pemicu tengah malam itu berarti Apps Script menganggapnya
  // sukses dan tidak mengirim pemberitahuan apa pun. Sinkronisasi bisa
  // mati berminggu-minggu tanpa ada yang tahu, sementara dasbor tetap
  // menampilkan angka lama seolah-olah masih segar.
  //
  // Karena itu kegagalan dilempar kembali di sini, sesudah ringkasannya
  // dicatat dan ditampilkan. Pesannya berisi ringkasan utuh, jadi surel
  // pemberitahuan bawaan Apps Script langsung memuat penyebabnya --
  // tanpa perlu MailApp, tanpa izin tambahan, dan tanpa alamat surel
  // yang harus ditulis di dalam skrip.
  //
  // Atur "Failure notification settings" pemicunya ke "Notify me
  // immediately" saat memasang pemicu.
  const adaGagal = catatan.some(function (baris) {
    return baris.indexOf('[GAGAL]') === 0;
  });
  if (adaGagal) throw new Error(ringkasan);

  return ringkasan;
}

/**
 * Menampilkan ringkasan sinkronisasi sebagai dialog.
 *
 * Sebelumnya ringkasan ini hanya masuk ke Logger, jadi orang yang
 * menekan "Sinkronkan Sekarang" dari menu tidak melihat apa-apa: tidak
 * tahu berapa siswa terkirim, tidak tahu kalau separuhnya gagal, dan
 * tidak membaca baris identitas sekolah yang justru ditaruh di paling
 * atas untuk dibaca.
 *
 * Saat dijalankan oleh pemicu tengah malam tidak ada antarmuka sama
 * sekali dan getUi() melempar galat; itu ditelan di sini, karena
 * ringkasannya toh sudah tercatat di Logger.
 */
function tampilkanRingkasan(ringkasan) {
  try {
    SpreadsheetApp.getUi().alert(
      'Sinkronisasi selesai', ringkasan, SpreadsheetApp.getUi().ButtonSet.OK
    );
  } catch (e) {
    // Dipanggil dari pemicu, bukan dari menu.
  }
}

/**
 * Baris identitas sekolah, ditampilkan di ATAS setiap laporan.
 *
 * Bukan hiasan. Cara paling wajar menyiapkan sekolah baru adalah
 * menyalin Master Rekap yang sudah jadi, dan salinan itu ikut membawa
 * skrip ini lengkap dengan KODE_SEKOLAH sekolah asalnya. Kalau
 * penyalinnya lupa menggantinya, seluruh siswa sekolah baru akan
 * dikirim dengan awalan sekolah lama -- dan siswa bernomor sama di
 * kedua sekolah akan saling menimpa TANPA satu pun pesan galat.
 *
 * Justru karena kegagalannya senyap, satu-satunya penjaga yang masuk
 * akal adalah membuat identitasnya mustahil terlewat: ia baris pertama
 * yang terbaca, baik pada Cek Kesehatan Data maupun pada ringkasan
 * sinkronisasi.
 */
function identitasSekolah() {
  const link = linkLhmRapi();
  return (
    'SEKOLAH: ' + NAMA_SEKOLAH + '  (kode ' + kodeSekolahRapi() + ')\n' +
    'Input LHM: ' + (link || '(belum diisi — tombolnya tidak ditampilkan)') + '\n' +
    'Pastikan ketiganya benar sebelum melanjutkan. Kalau berkas ini\n' +
    'salinan dari sekolah lain, ubah dulu KODE_SEKOLAH, NAMA_SEKOLAH,\n' +
    'dan LINK_LHM di bagian konfigurasi paling atas skrip.'
  );
}

/**
 * Membaca Master Rekap dan melaporkan masalah TANPA mengirim apa pun ke
 * Supabase. Jalankan ini dulu sebelum sinkronisasi pertama, dan setiap
 * kali menambah kelas atau siswa baru.
 */
function cekKesehatanData() {
  const temuan = [];
  let isi;

  try {
    isi = bacaMasterRekap();
  } catch (e) {
    temuan.push('Gagal membaca Master Rekap: ' + e.message);
    laporkanKesehatan(temuan);
    return temuan.join('\n');
  }

  // 1. Apakah ketujuh kelas yang diharapkan benar-benar muncul?
  const kelasDitemukan = {};
  isi.nilai.forEach(function (n) { kelasDitemukan[n.nama_kelas] = true; });

  KELAS_DIHARAPKAN.forEach(function (k) {
    if (!kelasDitemukan[k]) {
      temuan.push(
        'Kelas ' + k + ' TIDAK ditemukan di Master Rekap. Kemungkinan ' +
        'IMPORTRANGE terputus (izin berbagi file sumber berubah) — ' +
        'buka file kelas ' + k + ' dan cek apakah formula IMPORTRANGE ' +
        'masih menampilkan data, bukan #REF!.'
      );
    }
  });

  // 2. Untuk kelas yang muncul, apakah jumlah siswanya wajar (bukan 0)?
  KELAS_DIHARAPKAN.forEach(function (k) {
    if (!kelasDitemukan[k]) return;
    const siswaKelas = unik(
      isi.nilai.filter(function (n) { return n.nama_kelas === k && n.nis; })
               .map(function (n) { return n.nis; })
    );
    if (siswaKelas.length === 0) {
      temuan.push(
        'Kelas ' + k + ': ada baris di Master Rekap tapi 0 siswa punya ' +
        'NIS. Cek kolom NISN/NIS di file kelas ' + k + '.'
      );
    }
  });

  /* 2b. Nama kelas yang terlalu panjang.
     
     Kolom kelas.nama_kelas dibatasi 20 karakter, dan database MENOLAK
     nilai yang lebih panjang -- bukan memotongnya. Tanpa peringatan ini,
     sekolah yang memakai nama panjang ("Kelompok Bermain Kumbang", 24
     karakter) baru mengetahuinya sebagai galat mentah di tengah
     sinkronisasi, tanpa petunjuk kelas mana penyebabnya. */
  Object.keys(kelasDitemukan).forEach(function (k) {
    if (k && k.length > MAKS_NAMA_KELAS) {
      temuan.push(
        'Nama kelas "' + k + '" terlalu panjang (' + k.length + ' karakter, ' +
        'maksimal ' + MAKS_NAMA_KELAS + '). Sinkronisasi akan ditolak ' +
        'database. Persingkat namanya di Master Rekap.'
      );
    }
  });

  /* 2c. Kelas yang ADA di Master Rekap tapi tidak terdaftar di
     KELAS_DIHARAPKAN. Bukan kesalahan, tetapi hampir selalu berarti
     daftar di konfigurasi belum disesuaikan -- dan selama belum
     disesuaikan, pemeriksaan IMPORTRANGE tidak menjaga kelas itu sama
     sekali. */
  if (KELAS_DIHARAPKAN.length) {
    const tidakTerdaftar = Object.keys(kelasDitemukan).filter(function (k) {
      return k && KELAS_DIHARAPKAN.indexOf(k) === -1;
    });
    if (tidakTerdaftar.length) {
      temuan.push(
        'Kelas ini ada di Master Rekap tapi belum terdaftar di ' +
        'KELAS_DIHARAPKAN: ' + tidakTerdaftar.join(', ') + '. Tambahkan ' +
        'ke konfigurasi supaya ikut dijaga kalau IMPORTRANGE-nya putus.'
      );
    }
  }

  // 3. Siswa tanpa NIS (per kelas, supaya jelas kelas mana yang perlu dibenahi)
  const tanpaNisPerKelas = {};
  isi.nilai.forEach(function (n) {
    if (n.nama_lengkap && !n.nis) {
      tanpaNisPerKelas[n.nama_kelas] = (tanpaNisPerKelas[n.nama_kelas] || 0) + 1;
    }
  });
  Object.keys(tanpaNisPerKelas).forEach(function (k) {
    temuan.push('Kelas ' + k + ': ' + tanpaNisPerKelas[k] + ' baris siswa tanpa NIS.');
  });

  /* 3b. NIS yang dipakai lebih dari satu anak.

     NIS adalah identitas: seluruh sistem memakainya untuk mengenali
     siswa. Kalau dua anak memakai NIS yang sama -- salah ketik satu
     angka sudah cukup -- keduanya MELEBUR menjadi satu siswa di
     database. Namanya diambil dari baris yang terbaca lebih dulu, nilai
     keduanya bercampur di dasbor, dan satu tautan orang tua membuka
     data dua anak sekaligus.

     Tidak ada galat yang muncul untuk ini: bagi database keduanya
     memang satu siswa. Karena itu harus ditangkap di sini, di sisi
     spreadsheet, selagi kedua barisnya masih bisa dibedakan. */
  const kelasPerNis = {};
  const namaPerNis = {};
  isi.nilai.forEach(function (n) {
    if (!n.nis) return;
    const kunci = n.tahun_ajaran + '|' + n.nis;
    if (!kelasPerNis[kunci]) { kelasPerNis[kunci] = []; namaPerNis[kunci] = []; }
    if (kelasPerNis[kunci].indexOf(n.nama_kelas) === -1) {
      kelasPerNis[kunci].push(n.nama_kelas);
    }
    if (n.nama_lengkap && namaPerNis[kunci].indexOf(n.nama_lengkap) === -1) {
      namaPerNis[kunci].push(n.nama_lengkap);
    }
  });
  Object.keys(kelasPerNis).forEach(function (kunci) {
    const nis = kunci.split('|')[1];
    const kelas = kelasPerNis[kunci];
    const nama = namaPerNis[kunci];
    if (kelas.length > 1 || nama.length > 1) {
      temuan.push(
        'NIS ' + nis + ' dipakai lebih dari satu kali' +
        (kelas.length > 1 ? ' di kelas ' + kelas.join(' dan ') : ' di kelas ' + kelas[0]) +
        (nama.length > 1 ? ', atas nama: ' + nama.join(' / ') : '') +
        '. Kedua anak akan MELEBUR menjadi satu siswa dan nilainya ' +
        'bercampur. Perbaiki salah satu NIS-nya di Master Rekap.'
      );
    }
  });

  // 4. Kapasitas blok 25 baris/bulan — peringatkan kalau sudah mepet (>=23)
  KELAS_DIHARAPKAN.forEach(function (k) {
    const siswaKelas = unik(
      isi.nilai.filter(function (n) { return n.nama_kelas === k && n.nis; })
               .map(function (n) { return n.nis; })
    );
    if (siswaKelas.length >= 23) {
      temuan.push(
        'Kelas ' + k + ': ' + siswaKelas.length + ' dari kapasitas 25 siswa ' +
        'per blok bulan. Hampir penuh — tambah siswa lagi berisiko merusak ' +
        'susunan blok bulan berikutnya di sheet Rekap Kelas.'
      );
    }
  });

  // 5. Target/capaian Tahfidz-Tahsin yang tidak bisa dikenali otomatis
  isi.targetTeksBermasalah.forEach(function (t) { temuan.push(t); });

  /* 6. Jenjang sekolah.

     Jenjang bukan sekadar label: ia menentukan mata pelajaran yang
     tampil (PG tidak menilai IPA) DAN menjadi dasar cakupan biro
     akademik. Jenjang yang salah ketik membuat sekolah ini lenyap dari
     dasbor biro yang bercakupan -- tanpa satu pun pesan galat, karena
     bagi database itu sekadar jenjang yang tidak cocok. */
  if (!jenjangRapi()) {
    temuan.push(
      'JENJANG_SEKOLAH "' + JENJANG_SEKOLAH + '" tidak dikenal. Isi salah ' +
      'satu dari: ' + JENJANG_VALID.join(', ') + '. Selama belum dibetulkan, ' +
      'sinkronisasi akan berhenti dan sekolah ini tidak akan terlihat oleh ' +
      'biro akademik.'
    );
  }

  /* 7. Kolom "Cakupan Jenjang" di sheet users_access.

     Diperiksa di sini juga -- bukan hanya saat sinkronisasi -- supaya
     salah ketiknya terbaca sebagai salah ketik, bukan sebagai biro yang
     tiba-tiba tidak bisa melihat sekolah mana pun. */
  temuanCakupanJenjang().forEach(function (t) { temuan.push(t); });

  laporkanKesehatan(temuan);
  return temuan.join('\n');
}

/**
 * Memeriksa kolom "Cakupan Jenjang" di sheet users_access.
 *
 * Selain salah ketik, ikut menangkap dua kesalahpahaman yang wajar:
 * kolom diisi untuk wali kelas/kepala sekolah (tidak berpengaruh —
 * keduanya sudah terikat satu sekolah), dan biro yang cakupannya
 * dikosongkan (sah, tetapi berarti lintas jenjang; disebutkan supaya
 * tidak terjadi tanpa disadari).
 */
function temuanCakupanJenjang() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_USER);
  if (!sheet) return [];

  const tabel = sheet.getDataRange().getValues();
  if (tabel.length < 2) return [];

  const judul = (tabel[0] || []).map(function (h) { return teks(h).toLowerCase(); });
  const kol = judul.indexOf('cakupan jenjang');
  if (kol === -1) return [];          // sheet lama; sah, berarti kosong

  const temuan = [];
  for (let i = 1; i < tabel.length; i++) {
    const email = teks(tabel[i][0]).toLowerCase();
    if (!email) continue;

    const role = teks(tabel[i][2]).toLowerCase();
    const isiSel = teks(tabel[i][kol]);

    if (role !== 'direktur_area') {
      if (isiSel) {
        temuan.push(
          email + ': kolom Cakupan Jenjang diisi "' + isiSel + '" padahal ' +
          'perannya ' + (role || '(kosong)') + '. Kolom ini hanya berlaku ' +
          'untuk direktur_area dan akan diabaikan.'
        );
      }
      continue;
    }

    const hasil = cakupanJenjangRapi(isiSel);
    if (hasil.salah.length) {
      temuan.push(
        email + ': cakupan jenjang "' + hasil.salah.join(', ') + '" tidak ' +
        'dikenal. Isi salah satu dari: ' + JENJANG_VALID.join(', ') +
        ' (boleh lebih dari satu, dipisah koma). Barisnya tidak akan dikirim.'
      );
    } else if (!hasil.nilai) {
      temuan.push(
        email + ': cakupan jenjang dikosongkan, jadi biro ini melihat ' +
        'SELURUH jenjang di areanya. Sah untuk direktur area — isi kolomnya ' +
        '(misal "SD" atau "PG,TK") kalau seharusnya terbatas.'
      );
    }
  }
  return temuan;
}

function laporkanKesehatan(temuan) {
  const isi = temuan.length
    ? 'Ditemukan ' + temuan.length + ' hal yang perlu diperiksa:\n\n' + temuan.join('\n')
    : 'Tidak ada masalah terdeteksi. Data siap disinkronkan.';

  // Identitas sekolah di paling atas, sebelum apa pun yang lain: inilah
  // satu-satunya kesempatan menangkap Master Rekap salinan yang lupa
  // diganti kode sekolahnya, sebelum satu baris pun terkirim.
  const laporan = identitasSekolah() + '\n\n' + isi;
  Logger.log(laporan);
  try {
    SpreadsheetApp.getUi().alert('Cek Kesehatan Data', laporan, SpreadsheetApp.getUi().ButtonSet.OK);
  } catch (e) {
    // Dipanggil dari pemicu, bukan dari menu — cukup ke Logger.
  }
}

// ===================================================================
// PEMBACAAN MASTER REKAP
// ===================================================================

/**
 * Membaca Sheet1 di Master Rekap menjadi objek terstruktur. Tidak
 * menyentuh jaringan sama sekali — murni baca + normalisasi.
 */
function bacaMasterRekap() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_REKAP_MASTER);
  if (!sheet) {
    throw new Error('Sheet "' + SHEET_REKAP_MASTER + '" tidak ditemukan di Master Rekap.');
  }

  const tabel = sheet.getDataRange().getValues();
  const header = tabel[0].map(teks);
  const kol = {
    tahunAjaran:    header.indexOf('Tahun Ajaran'),
    namaKelas:      header.indexOf('Kelas'),
    waliKelas:      header.indexOf('Wali Kelas'),
    namaLengkap:    header.indexOf('Nama Lengkap'),
    namaSiswa:      header.indexOf('Nama Siswa'),
    nis:            header.indexOf('NISN/NIS'),
    noWa:           header.indexOf('No WA'),
    bulan:          header.indexOf('Bulan'),
    targetAkademik: header.indexOf('Target 3 Mapel'),
    rataBIndo:      header.indexOf('Rata B. Indo'),
    rataMtk:        header.indexOf('Rata MTK'),
    rataIpa:        header.indexOf('Rata IPA'),
    targetTahfidz:  header.indexOf('Target Tahfidz'),
    capaianTahfidz: header.indexOf('Capaian Tahfidz'),
    targetTahsin:   header.indexOf('Target Tahsin'),
    capaianTahsin:  header.indexOf('Capaian Tahsin'),
  };
  if (kol.namaKelas === -1 || kol.bulan === -1 || kol.tahunAjaran === -1 || kol.namaLengkap === -1) {
    throw new Error(
      'Kolom krusial (Tahun Ajaran/Kelas/Bulan/Nama Lengkap) tidak ' +
      'ditemukan di header Sheet1. Header tidak boleh diubah namanya.'
    );
  }

  const roster = [];            // {nis, namaLengkap, namaPanggilan} — dedup per NIS
  const rosterTerlihat = {};
  const kelasMap = {};          // 'tahunAjaran|namaKelas' -> {tahunAjaran, namaKelas, waliKelas, targetAkademik}
  const nilai = [];
  const targetTeksBermasalah = [];

  for (let i = 1; i < tabel.length; i++) {
    const r = tabel[i];
    const namaLengkap = teks(r[kol.namaLengkap]);
    const bulan = teks(r[kol.bulan]);
    const namaKelas = normalKelas(r[kol.namaKelas]);

    // Blok bulan menyisakan baris kosong sebagai cadangan siswa baru.
    if (!namaLengkap || !bulan || !namaKelas) continue;
    if (BULAN_AJARAN.indexOf(bulan) === -1) continue;

    const tahunAjaran = teks(r[kol.tahunAjaran]);
    const nis = normalNis(r[kol.nis]);
    const namaPanggilan = kol.namaSiswa !== -1 ? teks(r[kol.namaSiswa]) : '';

    if (nis && !rosterTerlihat[nis]) {
      rosterTerlihat[nis] = true;
      roster.push({ nis: nis, namaLengkap: namaLengkap, namaPanggilan: namaPanggilan || namaLengkap });
    }

    const kunciKelas = tahunAjaran + '|' + namaKelas;
    if (!kelasMap[kunciKelas]) {
      kelasMap[kunciKelas] = {
        tahunAjaran: tahunAjaran, namaKelas: namaKelas,
        waliKelas: '', targetAkademik: null,
      };
    }
    const infoKelas = kelasMap[kunciKelas];
    if (!infoKelas.waliKelas) {
      const wk = kol.waliKelas !== -1 ? teks(r[kol.waliKelas]) : '';
      if (wk) infoKelas.waliKelas = wk;
    }
    if (infoKelas.targetAkademik === null) {
      const ta = kol.targetAkademik !== -1 ? angka(r[kol.targetAkademik]) : null;
      if (ta !== null) infoKelas.targetAkademik = ta;
    }

    nilai.push({
      nis:             nis,
      nama_lengkap:    namaLengkap,
      nama_panggilan:  namaPanggilan || namaLengkap,
      nama_kelas:      namaKelas,
      tahun_ajaran:    tahunAjaran,
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
    roster: roster,
    kelasMap: kelasMap,
    nilai: nilai,
    targetTeksBermasalah: unik(targetTeksBermasalah),
  };
}

/**
 * Meneruskan target ke bulan-bulan berikutnya yang kosong, per siswa
 * PER KELAS (satu siswa yang naik kelas antar tahun ajaran punya baris
 * target tersendiri untuk tiap kelasnya, tidak boleh tercampur).
 *
 * Sebagian guru mengisi target sekali di awal semester, sebagian lagi
 * mengisinya tiap bulan berjalan. Aturan "pakai target terakhir yang
 * pernah diisi" melayani kedua kebiasaan itu sekaligus.
 *
 * CAPAIAN sengaja TIDAK diteruskan — itu fakta bulan itu, bukan janji
 * yang berlaku sampai diubah. Bulan tanpa capaian harus tetap kosong.
 *
 * Penerusan BERHENTI di bulan terakhir yang benar-benar punya isi. Tanpa
 * batas ini, target bulan Juli merambat sampai Juni dan grafik menggambar
 * titik target untuk sebelas bulan yang belum dimulai — terbaca seolah
 * seluruh target setahun sudah ditetapkan wali kelas, padahal belum.
 */
function isiTargetKeBulanBerikutnya(nilai) {
  const perSiswaKelas = {};
  nilai.forEach(function (b) {
    const k = (b.nis || kunci(b.nama_lengkap)) + '|' + b.tahun_ajaran + '|' + b.nama_kelas;
    if (!perSiswaKelas[k]) perSiswaKelas[k] = [];
    perSiswaKelas[k].push(b);
  });

  Object.keys(perSiswaKelas).forEach(function (k) {
    const baris = perSiswaKelas[k].sort(function (a, b) {
      return a.urutan_bulan - b.urutan_bulan;
    });
    // Batas penerusan: indeks bulan terakhir yang punya isi apa pun selain
    // target. Bulan sesudahnya belum berjalan, jadi tidak berhak mewarisi
    // target bulan sebelumnya.
    let batas = -1;
    baris.forEach(function (b, i) {
      if (
        b.rata_b_indo !== null ||
        b.rata_mtk !== null ||
        b.rata_ipa !== null ||
        b.capaian_tahfidz !== null ||
        b.capaian_tahsin !== null
      ) {
        batas = i;
      }
    });

    let tahfidzTerakhir = null;
    let tahsinTerakhir = null;
    baris.forEach(function (b, i) {
      if (b.target_tahfidz !== null) tahfidzTerakhir = b.target_tahfidz;
      else if (tahfidzTerakhir !== null && i <= batas) b.target_tahfidz = tahfidzTerakhir;

      if (b.target_tahsin !== null) tahsinTerakhir = b.target_tahsin;
      else if (tahsinTerakhir !== null && i <= batas) b.target_tahsin = tahsinTerakhir;
    });
  });
}

// ===================================================================
// SINKRONISASI
// ===================================================================

/**
 * Nomor induk global: kode sekolah + nomor lokal, mis. "SDYFK-281".
 *
 * NIS di Master Rekap adalah nomor lokal tiga digit, bukan NISN
 * nasional -- Kudus, Pati, dan Juwana hampir pasti memakai deret angka
 * yang sama. Tanpa awalan ini, siswa 301 Kudus dan siswa 301 Pati
 * menjadi satu baris yang sama di database: namanya saling menimpa dan
 * nilainya tertukar, tanpa satu pun pesan galat.
 */
function nisGlobal(nisLokal) {
  return kodeSekolahRapi() + '-' + nisLokal;
}

/**
 * Kode sekolah yang sudah dirapikan: huruf besar, tanpa spasi, hanya
 * huruf dan angka.
 *
 * Kode ini menjadi bagian dari kunci setiap siswa, jadi 'sdyfk' dan
 * 'SDYFK' tidak boleh menghasilkan dua siswa yang berbeda hanya karena
 * beda cara mengetik saat memasang skrip di sekolah baru.
 */
function kodeSekolahRapi() {
  const rapi = String(KODE_SEKOLAH || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (rapi.length < 2) {
    throw new Error(
      'KODE_SEKOLAH belum diisi dengan benar. Isi dengan huruf dan angka ' +
      'saja, minimal dua karakter — misalnya SDYFK untuk SD Yaumi Fatimah Kudus.'
    );
  }
  return rapi;
}

/**
 * Alamat input LHM yang sudah diperiksa.
 *
 * Diperiksa di sini, bukan di dasbor, karena di sinilah orang
 * mengetiknya -- dan kesalahan ketiknya ketahuan saat sinkronisasi,
 * bukan berminggu-minggu kemudian ketika seorang wali kelas menekan
 * tombol yang ternyata mati.
 *
 * Alamat kosong dikembalikan sebagai null, bukan galat: sekolah yang
 * belum punya aplikasi input LHM tetap boleh memakai dasbornya.
 */
function linkLhmRapi() {
  const rapi = String(LINK_LHM || '').trim();
  if (!rapi) return null;

  if (!/^https:\/\/\S+$/.test(rapi)) {
    throw new Error(
      'LINK_LHM harus berupa alamat lengkap yang diawali https:// dan ' +
      'tanpa spasi — misalnya https://laporan-akademik.vercel.app/. ' +
      'Kosongkan (\'\') kalau sekolah ini belum punya aplikasi input LHM.'
    );
  }
  return rapi;
}

/**
 * Menyimpan identitas sekolah dan mengembalikan id-nya.
 *
 * Dipanggil oleh kedua bagian sinkronisasi (nilai dan hak akses), bukan
 * dipanggil sekali lalu id-nya dioper. Keduanya sengaja berjalan dalam
 * blok try terpisah supaya kegagalan yang satu tidak menjatuhkan yang
 * lain; kalau id-nya dioper, bagian hak akses ikut mati begitu bagian
 * nilai gagal. Menyimpan satu baris yang sama dua kali tidak berbiaya.
 */
function pastikanSekolah() {
  const jenjang = jenjangRapi();
  if (!jenjang) {
    throw new Error(
      'JENJANG_SEKOLAH "' + JENJANG_SEKOLAH + '" tidak dikenal. Isi salah ' +
      'satu dari: ' + JENJANG_VALID.join(', ') + '. Jenjang menentukan ' +
      'mata pelajaran yang tampil dan cakupan biro akademik, jadi salah ' +
      'ketik di sini membuat sekolah ini hilang dari dasbor biro tanpa ' +
      'pesan galat.'
    );
  }

  const tersimpan = kirim('sekolah', [{
    kode: kodeSekolahRapi(),
    nama: NAMA_SEKOLAH,
    area: AREA_SEKOLAH || null,
    jenjang: jenjang,
    link_lhm: linkLhmRapi(),
  }], 'kode', true);

  if (!tersimpan.length || !tersimpan[0].id) {
    throw new Error(
      'Identitas sekolah gagal disimpan. Periksa KODE_SEKOLAH dan ' +
      'NAMA_SEKOLAH di bagian konfigurasi, lalu pastikan migrasi ' +
      'migrasi/001-multi-sekolah.sql sudah dijalankan di Supabase.'
    );
  }
  return tersimpan[0].id;
}

function sinkronkanDariMaster(isi) {
  // 0. Sekolah — identitasnya dulu, karena kelas merujuk ke id-nya.
  const sekolahId = pastikanSekolah();

  // 1. Kelas — dibuat/diperbarui dulu karena baris lain merujuk ke id-nya.
  const daftarKelas = Object.keys(isi.kelasMap).map(function (k) { return isi.kelasMap[k]; });
  const kelasTersimpan = kirim('kelas', daftarKelas.map(function (k) {
    return {
      sekolah_id: sekolahId,
      tahun_ajaran: k.tahunAjaran,
      nama_kelas: k.namaKelas,
      wali_kelas: k.waliKelas,
      target_akademik: k.targetAkademik !== null ? k.targetAkademik : 90,
      updated_at: new Date().toISOString(),
    };
  }), 'sekolah_id,tahun_ajaran,nama_kelas', true);

  const kelasIdMap = {};
  kelasTersimpan.forEach(function (row) {
    kelasIdMap[row.tahun_ajaran + '|' + row.nama_kelas] = row.id;
  });

  // 2. Siswa — identitas, disimpan sekali saja (bukan diulang tiap bulan).
  const siswaValid = isi.roster.filter(function (s) { return s.nis; });
  if (siswaValid.length) {
    kirim('siswa', siswaValid.map(function (s) {
      return {
        sekolah_id: sekolahId,
        nis: nisGlobal(s.nis),
        nis_lokal: s.nis,
        nama_lengkap: s.namaLengkap, nama_panggilan: s.namaPanggilan,
        updated_at: new Date().toISOString(),
      };
    }), 'nis');
  }
  const nisValid = {};
  siswaValid.forEach(function (s) { nisValid[s.nis] = true; });

  // 3. Penempatan siswa di kelasnya masing-masing (dedup nis+kelas_id).
  const penempatanTerlihat = {};
  const penempatan = [];
  isi.nilai.forEach(function (n) {
    if (!n.nis || !nisValid[n.nis]) return;
    const kelasId = kelasIdMap[n.tahun_ajaran + '|' + n.nama_kelas];
    if (!kelasId) return;
    const key = n.nis + '|' + kelasId;
    if (penempatanTerlihat[key]) return;
    penempatanTerlihat[key] = true;
    penempatan.push({ nis: nisGlobal(n.nis), kelas_id: kelasId });
  });
  if (penempatan.length) kirim('penempatan', penempatan, 'nis,kelas_id');

  // 4. Nilai bulanan — hanya angka.
  const nilaiKirim = isi.nilai
    .filter(function (n) {
      return n.nis && nisValid[n.nis] && kelasIdMap[n.tahun_ajaran + '|' + n.nama_kelas];
    })
    .map(function (n) {
      const kelasId = kelasIdMap[n.tahun_ajaran + '|' + n.nama_kelas];
      return {
        nis: nisGlobal(n.nis),
        kelas_id: kelasId,
        bulan: n.bulan,
        urutan_bulan: n.urutan_bulan,
        rata_b_indo: n.rata_b_indo,
        rata_mtk: n.rata_mtk,
        rata_ipa: n.rata_ipa,
        target_tahfidz: n.target_tahfidz,
        capaian_tahfidz: n.capaian_tahfidz,
        target_tahsin: n.target_tahsin,
        capaian_tahsin: n.capaian_tahsin,
        disinkron_pada: new Date().toISOString(),
      };
    });

  // Dikirim bertahap supaya satu payload tidak melebihi batas UrlFetchApp.
  for (let i = 0; i < nilaiKirim.length; i += 400) {
    kirim('nilai_bulanan', nilaiKirim.slice(i, i + 400), 'nis,kelas_id,bulan');
  }

  return { kelas: daftarKelas.length, siswa: siswaValid.length, nilai: nilaiKirim.length };
}

/**
 * Peran yang diterima tabel users_access. Sengaja hanya guru & kepala
 * sekolah — akses orang tua memakai jalur terpisah (lihat akses_ortu
 * dan docs/AKSES_ORANG_TUA.md), bukan baris di sheet ini.
 */
/**
 * Peran yang diterima database (CHECK constraint di users_access).
 *
 * 'direktur_area' untuk biro akademik yang membawahi beberapa sekolah
 * dalam satu Tim Manajemen. Emailnya cukup ditulis SEKALI, di sheet
 * users_access salah satu sekolah di wilayah itu -- bukan di semua
 * sekolah. users_access.email adalah PRIMARY KEY, jadi email yang sama
 * ditulis di dua Master Rekap akan saling menimpa: sekolah yang sinkron
 * paling akhir yang menang, dan karena tiap sekolah punya pemicu
 * sendiri, pemenangnya bisa berganti tiap malam tanpa satu pun pesan
 * galat. Cakupan bacanya ditentukan kolom `area` sekolah tempat
 * emailnya terdaftar, bukan oleh jumlah barisnya.
 */
const PERAN_VALID = ['kepala_sekolah', 'wali_kelas', 'direktur_area'];

/**
 * Merapikan isi kolom "Cakupan Jenjang" pada sheet users_access.
 *
 * KENAPA CAKUPAN JADI KOLOM, BUKAN PERAN TERSENDIRI
 * -------------------------------------------------
 * Biro SD dan biro PG-TK MELAKUKAN hal yang persis sama -- melihat
 * dasbor, mengelola tautan orang tua, mencetak laporan. Yang berbeda
 * hanya sekolah mana yang ia pegang. Itu perbedaan cakupan, bukan
 * perbedaan peran, dan menjadikannya peran (`direktur_sd`,
 * `direktur_pgtk`) berarti tiap kombinasi baru menuntut peran baru
 * beserta aturan RLS dan pengujiannya sendiri.
 *
 *   dikosongkan -> null  : seluruh jenjang dalam areanya (direktur area)
 *   'SD'        -> 'SD'  : hanya SD dalam areanya
 *   'pg, tk'    -> 'PG,TK': hanya PG dan TK dalam areanya
 *
 * Mengembalikan { nilai, salah }. `salah` berisi jenjang yang tidak
 * dikenal; barisnya lalu DILEWATI, tidak dikirim setengah benar --
 * cakupan yang salah ketik menghasilkan biro yang tidak melihat apa pun,
 * dan itu terbaca sebagai "sistemnya rusak", bukan sebagai salah ketik.
 */
function cakupanJenjangRapi(nilaiSel) {
  const mentah = teks(nilaiSel);
  if (!mentah) return { nilai: null, salah: [] };

  const bagian = mentah.toUpperCase().split(',');
  const bersih = [];
  const salah = [];

  for (let i = 0; i < bagian.length; i++) {
    const j = bagian[i].replace(/\s+/g, '');
    if (!j) continue;                                  // koma ganda
    if (JENJANG_VALID.indexOf(j) === -1) salah.push(j);
    else if (bersih.indexOf(j) === -1) bersih.push(j); // buang kembar
  }

  if (salah.length) return { nilai: null, salah: salah };
  return { nilai: bersih.length ? bersih.join(',') : null, salah: [] };
}

/** Membaca sheet 'users_access' di Master Rekap. */
function sinkronkanUserAccess() {
  const sekolahId = pastikanSekolah();
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_USER);
  if (!sheet) {
    Logger.log('Sheet "' + SHEET_USER + '" tidak ada. Sinkronisasi hak akses dilewati.');
    return { terkirim: 0, dilewati: 0 };
  }

  const tabel = sheet.getDataRange().getValues();
  const daftar = [];
  const dilewati = [];

  /* Kolom "Cakupan Jenjang" dicari lewat NAMA judulnya, bukan posisi.
     Kolom ini menyusul belakangan, dan sheet users_access sekolah lama
     belum memilikinya -- dicari lewat nama, sheet lama tetap jalan
     (indexOf -> -1 -> dianggap kosong -> seluruh jenjang), sedangkan
     posisi tetap akan salah baca begitu ada yang menyisipkan kolom. */
  const judul = (tabel[0] || []).map(function (h) {
    return teks(h).toLowerCase();
  });
  const kolCakupan = judul.indexOf('cakupan jenjang');

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

    /* Cakupan jenjang hanya berlaku bagi biro/direktur. Kepala sekolah
       dan wali kelas sudah terikat satu sekolah lewat sekolah_id, jadi
       nilainya dikosongkan supaya tidak ada yang mengira kolom itu
       membatasi mereka juga. */
    let cakupan = null;
    if (role === 'direktur_area' && kolCakupan !== -1) {
      const hasil = cakupanJenjangRapi(tabel[i][kolCakupan]);
      if (hasil.salah.length) {
        dilewati.push(
          email + ' (cakupan jenjang "' + hasil.salah.join(', ') + '" tidak ' +
          'dikenal; isi salah satu dari: ' + JENJANG_VALID.join(', ') + ')'
        );
        continue;
      }
      cakupan = hasil.nilai;
    }

    daftar.push({
      email:           email,
      nama:            teks(tabel[i][1]),
      role:            role,
      nama_kelas:      role === 'wali_kelas' ? normalKelas(tabel[i][3]) : null,
      sekolah_id:      sekolahId,
      cakupan_jenjang: cakupan,
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

/**
 * Upsert lewat /api/sync di Vercel (lihat "KENAPA LEWAT PROXY" di atas).
 * Mengembalikan baris hasil bila diminta.
 */
function kirim(tabel, data, kolomKonflik, kembalikan) {
  const respons = UrlFetchApp.fetch(APP_URL + '/api/sync', {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-sync-secret': SYNC_SECRET },
    payload: JSON.stringify({ tabel: tabel, data: data, onConflict: kolomKonflik }),
    muteHttpExceptions: true,
  });

  const kode = respons.getResponseCode();
  if (kode < 200 || kode >= 300) {
    throw new Error('Proxy /api/sync menolak tabel [' + tabel + '] (HTTP ' + kode + '): ' +
                    respons.getContentText().slice(0, 300));
  }
  return kembalikan ? JSON.parse(respons.getContentText()).data : null;
}

/** Sel -> teks bersih. */
function teks(v) {
  if (v === null || v === undefined) return '';
  return String(v).trim().replace(/\s+/g, ' ');
}

/**
 * Kunci pembanding yang tahan beda spasi, kapital, dan tanda hubung.
 * "Al-Qiyamah" dan "Al Qiyamah" harus dikenali sebagai nama yang sama.
 */
function kunci(v) {
  return teks(v).toLowerCase().replace(/-/g, ' ').replace(/\s+/g, ' ').trim();
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
 * Angka dipakai apa adanya. Teks dicoba dicocokkan ke nama surah/materi
 * (tahan beda tanda hubung/spasi/kapital lewat kunci()). Nama Tahfidz
 * tidak pernah berulang sehingga selalu bisa dikenali otomatis; nama
 * Tahsin bisa ambigu (mis. "Mad Asli" ada di bab 7, 8, dan 9) — untuk
 * itu dicek dulu ke OVERRIDE_TARGET_TEKS sebelum menyerah.
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

  catatan.push(
    'Kelas ' + namaKelas + ': target/capaian ' + jenis + ' bertuliskan "' + teks(v) + '" ' +
    (cocok.length === 0
      ? 'tidak dikenali. Isi dengan angka, atau daftarkan di OVERRIDE_TARGET_TEKS.'
      : 'ambigu (cocok dengan bab ' + cocok.join(', ') + '). Isi dengan angka, ' +
        'atau daftarkan di OVERRIDE_TARGET_TEKS.')
  );
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
