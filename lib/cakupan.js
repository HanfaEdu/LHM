/**
 * Cakupan jenjang biro akademik.
 *
 * Biro akademik terikat jenjang tertentu (biro SD, biro PG-TK),
 * sedangkan direktur area melihat lintas jenjang. Keduanya berperan
 * `direktur_area` dan MELAKUKAN hal yang sama; yang berbeda hanya
 * sekolah mana yang dipegang -- itu perbedaan cakupan, bukan peran.
 * Aturannya karena itu menjadi satu kolom, `users_access.cakupan_jenjang`.
 *
 *   kosong / null -> seluruh jenjang dalam areanya
 *   'SD'          -> hanya SD dalam areanya
 *   'PG,TK'       -> hanya PG dan TK dalam areanya
 *
 * ATURAN INI DITULIS DUA KALI, DAN ITU DISENGAJA
 * ---------------------------------------------
 * Kembarannya ada di sekolah_yang_boleh() pada
 * migrasi/002-cakupan-jenjang.sql, dan keduanya HARUS berubah bersama.
 * Alasannya bukan kelalaian melainkan dua jalur akses yang berbeda:
 *
 *   - Dasbor bertanya ke Supabase memakai anon key, jadi RLS-lah yang
 *     menyaring. Kode di peramban tidak dipercaya sama sekali.
 *   - /api/tautan memakai service_role, yang MELEWATI seluruh RLS,
 *     sehingga ia wajib menyaring sendiri. Tanpa itu biro PG-TK dapat
 *     menerbitkan dan mencabut tautan orang tua siswa SD hanya dengan
 *     mengirim NIS-nya -- tanpa pernah bisa melihat siswa itu di
 *     dasbornya.
 *
 * Kesamaan keduanya dijaga scripts/uji-cakupan-jenjang.mjs, yang
 * menjalankan kasus yang sama persis lewat Postgres sungguhan dan lewat
 * fungsi di bawah ini, lalu membandingkan hasilnya.
 */

/** Memecah isi kolom cakupan menjadi daftar jenjang huruf besar. */
export function daftarCakupan(cakupan) {
  return String(cakupan ?? '')
    .toUpperCase()
    .split(',')
    .map((j) => j.replace(/\s+/g, ''))
    .filter(Boolean);
}

/**
 * Apakah sekolah berjenjang `jenjang` termasuk cakupan `cakupan`?
 *
 * Gagal TERTUTUP: cakupan yang terisi sementara jenjang sekolahnya
 * kosong dianggap TIDAK termasuk. Sekolah tanpa jenjang lebih baik
 * hilang dari satu dasbor biro -- dan ketahuan -- daripada muncul di
 * dasbor semua biro tanpa ada yang menyadarinya. Cek Kesehatan Data di
 * Apps Script menahannya lebih dulu di hulu.
 */
export function dalamCakupan(jenjang, cakupan) {
  const daftar = daftarCakupan(cakupan);
  if (daftar.length === 0) return true;        // kosong = seluruh jenjang

  const punya = String(jenjang ?? '').trim().toUpperCase();
  return punya !== '' && daftar.includes(punya);
}
