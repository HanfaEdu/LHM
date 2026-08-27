/**
 * Manifest aplikasi untuk STAF (wali kelas dan kepala sekolah).
 *
 * Satu aplikasi saja untuk keduanya, karena keduanya memang masuk lewat
 * pintu yang sama: halaman ini membaca peran dari users_access lalu
 * mengarahkan sendiri ke dasbor yang sesuai. Memisahkannya menjadi dua
 * aplikasi hanya akan memaksa sekolah menjelaskan mana yang harus
 * dipasang oleh siapa.
 *
 * Rapor orang tua TIDAK memakai manifest ini -- tiap tautan siswa
 * menyajikan manifestnya sendiri di
 * app/rapor/[token]/manifest.webmanifest/route.js, supaya tiap anak
 * menjadi aplikasi terpisah di layar utama.
 */
export default function manifest() {
  return {
    // id memisahkan identitas aplikasi dari alamat awalnya. Dipatok
    // eksplisit supaya aplikasi yang sudah terpasang tidak berubah
    // identitas kalau suatu saat start_url digeser.
    id: '/',
    name: 'SiPaDi — SD Yaumi Fatimah Kudus',
    short_name: 'SiPaDi',
    description:
      'Dasbor capaian akademik, Tahfidz, dan Tahsin untuk wali kelas dan kepala sekolah.',
    lang: 'id',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    // Biru tua halaman masuk: warna inilah yang dipakai sistem untuk
    // layar pembuka sesaat sebelum halaman siap. Kalau diisi warna
    // terang dasbor, tiap peluncuran diawali kedipan putih menuju biru.
    background_color: '#0b1329',
    theme_color: '#0b1329',
    categories: ['education'],
    icons: [
      {
        src: '/ikon/sipadi-192.png',
        sizes: '192x192',
        type: 'image/png',
        // 'any maskable' sekaligus: seluruh isi ikon sudah dirancang
        // berada di dalam lingkaran aman 80%, jadi ia tetap utuh baik
        // dipakai apa adanya maupun dipangkas Android menjadi bentuk
        // apa pun sesuai peluncur yang dipakai pemiliknya.
        purpose: 'any maskable',
      },
      {
        src: '/ikon/sipadi-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any maskable',
      },
    ],
  };
}
