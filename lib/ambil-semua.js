/**
 * Mengambil SELURUH baris sebuah query Supabase, 1.000 per halaman.
 *
 * PostgREST memotong setiap jawaban pada 1.000 baris (batas bawaan
 * Supabase) TANPA galat dan tanpa tanda apa pun: query yang kemarin
 * mengembalikan 800 baris, begitu datanya tumbuh melewati 1.000, diam-diam
 * mengembalikan 1.000 -- dan angka di dasbor menjadi salah tanpa satu
 * pesan yang menunjukkan sebabnya. Pembantu ini membaca halaman demi
 * halaman sampai habis.
 *
 * `buatQuery` adalah FUNGSI yang membangun query baru tiap halaman (query
 * Supabase tidak boleh dipakai ulang setelah dijalankan), dan query itu
 * WAJIB memuat .order() pada kunci yang unik. Tanpa urutan yang tetap,
 * Postgres bebas mengurutkan baris yang sama dengan cara berbeda di tiap
 * halaman, sehingga sebagian baris terbaca dua kali dan sebagian lain
 * tidak terbaca sama sekali.
 *
 * Contoh:
 *   const baris = await ambilSemua(() =>
 *     supabase.from('nilai_bulanan').select('*').eq('kelas_id', id).order('id'));
 *
 * Galat dari halaman mana pun dilempar apa adanya, bukan ditelan:
 * hasil separuh jalan yang tampak lengkap lebih buruk daripada gagal.
 */
export async function ambilSemua(buatQuery, ukuran = 1000) {
  const semua = [];
  for (let dari = 0; ; dari += ukuran) {
    const { data, error } = await buatQuery().range(dari, dari + ukuran - 1);
    if (error) throw error;
    semua.push(...(data || []));
    if (!data || data.length < ukuran) return semua;
  }
}
