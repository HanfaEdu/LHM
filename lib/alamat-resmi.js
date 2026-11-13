/**
 * Ke mana kunjungan dari alamat Vercel dialihkan.
 *
 * Dipisahkan dari middleware.js supaya bisa diuji tanpa Next.js
 * (scripts/uji-alamat-resmi.mjs).
 *
 * MASALAHNYA
 * ----------
 * Proyek ini punya beberapa alamat *.vercel.app selain domain sekolah:
 * alamat produksi bawaan proyek (mis. lhm-<slug-akun>.vercel.app) dan
 * alamat tiap deployment. Sebelum domain sekolah dipakai, sebagian
 * tautan rapor sempat dibagikan dengan alamat-alamat itu, dan sebagian
 * orang tua memasang ikon rapor di layar utama HP dari sana. Ikon
 * terpasang selalu membuka alamat tempat ia dipasang, jadi tautan dan
 * ikon lama itu terus mengarah ke alamat Vercel.
 *
 * Fungsi ini memindahkan kunjungan seperti itu ke domain resmi dengan
 * path yang sama, sehingga /rapor/<token> lama tetap membuka rapor
 * anak yang sama di domain sekolah.
 *
 * YANG SENGAJA TIDAK DIALIHKAN
 * ----------------------------
 * - Domain selain *.vercel.app (akademik-bias.my.id, www.-nya). Pengalihan
 *   antara keduanya sudah diatur di Vercel → Domains. Kalau ikut diatur
 *   di sini dan kedua aturan berbeda arah (env tanpa www, domain utama
 *   pakai www), keduanya saling melempar tanpa henti.
 * - /api/*. Fonnte (webhook WA) dan Apps Script (/api/sync) memanggil
 *   endpoint ini dengan POST, dan alamat yang tersimpan di keduanya bisa
 *   saja masih alamat Vercel. Pengalihan untuk POST tidak selalu diikuti
 *   -- Apps Script mengubahnya menjadi GET -- sehingga balasan WA dan
 *   sinkronisasi malam akan berhenti diam-diam.
 * - Deployment pratinjau (VERCEL_ENV bukan 'production'). Alamatnya
 *   memang harus tetap bisa dibuka untuk mencoba perubahan sebelum
 *   di-merge.
 *
 * Mengembalikan alamat tujuan lengkap, atau null bila tidak perlu
 * dialihkan.
 */
export function alamatPengalihan(url, { situsResmi, lingkungan }) {
  if (lingkungan !== 'production' || !situsResmi) return null;

  let resmi;
  try {
    resmi = new URL(situsResmi);
  } catch {
    return null;
  }

  const kini = new URL(url);
  if (!kini.hostname.endsWith('.vercel.app')) return null;
  if (kini.hostname === resmi.hostname) return null;
  if (kini.pathname === '/api' || kini.pathname.startsWith('/api/')) return null;

  return `${resmi.origin}${kini.pathname}${kini.search}`;
}
