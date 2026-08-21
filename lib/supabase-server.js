import { createClient } from '@supabase/supabase-js';

/**
 * Klien Supabase khusus sisi server.
 *
 * Memakai service_role/secret key, sehingga menembus seluruh kebijakan
 * RLS. Berkas ini TIDAK BOLEH diimpor dari komponen yang berjalan di
 * browser (yang berawalan 'use client'). Kuncinya hanya ada di variabel
 * lingkungan tanpa awalan NEXT_PUBLIC_, jadi Next.js tidak akan pernah
 * menyertakannya ke dalam bundel klien.
 *
 * Nama variabel diperiksa berurutan karena integrasi resmi Supabase-Vercel
 * membuat nama sendiri (SUPABASE_URL, SUPABASE_SECRET_KEY) yang berbeda
 * dari yang diisi manual. Menerima keduanya menghindari kebingungan
 * "sudah diisi tapi tetap dibilang belum diatur".
 */
export function supabaseServer() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL;

  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY;

  // Pesan menyebut variabel mana yang benar-benar kosong. Pesan gabungan
  // ("A dan B belum diatur") menyesatkan saat hanya salah satu yang hilang,
  // dan penyebab tersering justru bukan lupa mengisi, melainkan variabel
  // itu hanya di-scope ke Production sementara yang berjalan Preview.
  if (!url || !key) {
    const kurang = [];
    if (!url) kurang.push('NEXT_PUBLIC_SUPABASE_URL (atau SUPABASE_URL)');
    if (!key) kurang.push('SUPABASE_SERVICE_ROLE_KEY (atau SUPABASE_SECRET_KEY)');

    throw new Error(
      'Variabel lingkungan belum terbaca: ' + kurang.join(', ') + '. ' +
      'Periksa di Vercel > Settings > Environment Variables bahwa variabel ' +
      'tersebut aktif untuk environment yang sedang dipakai (Preview, bukan ' +
      'Production saja), lalu Redeploy.'
    );
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
