/**
 * Penyusun teks balasan WhatsApp.
 *
 * Dipisahkan dari app/api/wa/route.js supaya kalimat yang dibaca ratusan
 * orang tua bisa diuji tanpa menyentuh jaringan, database, maupun Fonnte
 * (lihat scripts/uji-layanan-wa.mjs). Berkas ini murni: teks masuk, teks
 * keluar, tidak ada efek samping.
 *
 * SATU HAL YANG SENGAJA TIDAK DILAKUKAN: menyapa orang tua dengan nama.
 * Sistem tahu nama anak, bukan nama pengirimnya -- kolom "No WA" tidak
 * mencatat nomor itu milik ayah, ibu, atau kakak. Sapaan "Ayah/Bunda"
 * selalu benar; sapaan yang menebak akan salah pada sebagian keluarga.
 */

const SALAM = 'Assalamu’alaikum Ayah/Bunda 🙏';

function kaki(namaSekolah) {
  return (
    '—\n' + namaSekolah + '\n\n' +
    '_Pesan ini dikirim otomatis oleh sistem. Balas pesan ini kapan saja ' +
    'untuk meminta tautannya lagi._'
  );
}

/** "Ananda Faisal (Kelas 3)" — kelas dilewati kalau belum diketahui. */
function barisAnak(anak) {
  const kelas = anak.kelas ? ' (Kelas ' + anak.kelas + ')' : '';
  return '👤 *Ananda ' + anak.nama + '*' + kelas;
}

/**
 * Menyusun balasan untuk satu nomor pengirim.
 *
 * @param {object} p
 * @param {string} p.namaSekolah
 * @param {Array<{nama: string, kelas: string|null, tautan: string|null}>} p.anak
 *        Seluruh siswa yang nomor orang tuanya cocok. Kosong = nomor
 *        tidak dikenali. `tautan` null = tautannya belum diterbitkan
 *        atau sedang dinonaktifkan.
 * @returns {{teks: string, hasil: string}} hasil dicatat ke wa_pesan.
 */
export function susunBalasan({ namaSekolah, anak }) {
  const sekolah = namaSekolah || 'Sekolah';

  /* --- Nomor tidak dikenali ---------------------------------------
     Diarahkan ke wali kelas, dan BUKAN diminta mengirim nama anaknya.
     Sistem memang tidak akan menerimanya: jawaban dibangun dari nomor
     pengirim, bukan dari isi pesan. Kalau orang tua diminta mengetik
     nama, siapa pun yang tahu nama seorang siswa bisa meminta tautan
     rapor anak itu dari nomor mana pun. */
  if (!anak.length) {
    return {
      hasil: 'tidak_dikenal',
      teks:
        SALAM + '\n\n' +
        'Mohon maaf, nomor WhatsApp ini belum terdaftar sebagai nomor orang ' +
        'tua siswa, sehingga kami belum dapat menemukan data putra/putri ' +
        'Ayah/Bunda.\n\n' +
        'Biasanya karena satu dari dua hal:\n' +
        '• Nomor yang terdaftar di sekolah berbeda dengan nomor ini\n' +
        '• Nomor sudah berganti dan belum dikabarkan ke sekolah\n\n' +
        'Silakan hubungi *wali kelas* untuk memperbarui nomor, dan ' +
        'tautan rapor akan langsung bisa diminta lewat nomor ini.\n\n' +
        kaki(sekolah),
    };
  }

  const punyaTautan = anak.filter((a) => a.tautan);
  const belum = anak.filter((a) => !a.tautan);

  /* --- Dikenali, tetapi belum satu pun tautan diterbitkan ---------
     Dibedakan dari kasus di atas dengan sengaja: yang ini BUKAN salah
     orang tua, dan mengirim mereka ke wali kelas untuk "memperbarui
     nomor" hanya akan membuat wali kelas mencari-cari masalah yang
     tidak ada. Nomornya sudah benar; yang belum dikerjakan ada di
     pihak sekolah. */
  if (!punyaTautan.length) {
    return {
      hasil: 'belum_terbit',
      teks:
        SALAM + '\n\n' +
        'Data Ananda sudah kami temukan:\n\n' +
        belum.map(barisAnak).join('\n') + '\n\n' +
        'Namun tautan rapor digitalnya belum diterbitkan oleh sekolah. ' +
        'Mohon menunggu — atau hubungi wali kelas bila sudah lewat beberapa ' +
        'hari.\n\n' +
        kaki(sekolah),
    };
  }

  /* --- Ada tautan yang bisa dikirim -------------------------------
     Satu balasan memuat SELURUH anak yang cocok. Orang tua dengan dua
     anak di sekolah yang sama menerima dua tautan sekaligus, bukan
     tautan anak yang kebetulan tersimpan lebih dulu. */
  const bagian = punyaTautan
    .map((a) => barisAnak(a) + '\n' + a.tautan)
    .join('\n\n');

  const catatanBelum = belum.length
    ? '\n\nTautan untuk ' +
      belum.map((a) => a.nama).join(' dan ') +
      ' belum diterbitkan sekolah. Mohon hubungi wali kelas.'
    : '';

  return {
    hasil: 'terkirim',
    teks:
      '📄 *LAPORAN AKADEMIK SISWA*\n\n' +
      SALAM + '\n\n' +
      (punyaTautan.length > 1
        ? 'Berikut tautan laporan akademik putra/putri Ayah/Bunda:'
        : 'Berikut tautan laporan akademik Ananda:') +
      '\n\n' + bagian + '\n\n' +
      'Tautan di atas bersifat *pribadi* — mohon tidak diteruskan ke grup ' +
      'atau siapa pun di luar keluarga.' +
      catatanBelum + '\n\n' +
      'Terima kasih atas perhatian Ayah/Bunda 😊\n\n' +
      kaki(sekolah),
  };
}
