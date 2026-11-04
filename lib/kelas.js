/**
 * Nama kelas untuk DITAMPILKAN.
 *
 * Nama kelas di database selalu huruf besar: normalKelas() di sync.js dan
 * sync-pg.js menyeragamkannya supaya "Playgroup" dan "playgroup" tidak
 * menjadi dua kelas, dan supaya wali kelas di users_access tetap cocok
 * dengan kelasnya. Di SD itu tidak terlihat (1, 2A, 3). Di PG nama
 * kelasnya kata, dan "PLAYGROUP" atau "PG KECIL" terbaca seperti orang
 * berteriak.
 *
 * Karena itu yang diubah hanya TAMPILANNYA, khusus jenjang PG: tiap kata
 * diberi huruf awal kapital, sedangkan singkatan pendek (PG, TK) dan kata
 * berangka (2A, 1) dibiarkan. Nilai di database tidak disentuh -- seluruh
 * pencocokan, penyaringan, dan kunci tetap memakai nama aslinya.
 *
 *   tampilKelas('PLAYGROUP', 'PG')  -> 'Playgroup'
 *   tampilKelas('PG BESAR 1', 'PG') -> 'PG Besar 1'
 *   tampilKelas('2A', 'SD')         -> '2A'   (SD tidak berubah)
 */
export function tampilKelas(nama, jenjang) {
  if (nama === null || nama === undefined || nama === '') return nama ?? '';
  if (String(jenjang || '').toUpperCase() !== 'PG') return nama;
  return String(nama)
    .split(' ')
    .map((kata) =>
      kata.length <= 2 || /\d/.test(kata)
        ? kata
        : kata.charAt(0).toUpperCase() + kata.slice(1).toLowerCase()
    )
    .join(' ');
}
