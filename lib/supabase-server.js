import { createClient } from '@supabase/supabase-js';

/**
 * Klien Supabase khusus sisi server.
 *
 * Memakai service_role key, sehingga menembus seluruh kebijakan RLS.
 * Berkas ini TIDAK BOLEH diimpor dari komponen yang berjalan di browser
 * (yang berawalan 'use client'). Kuncinya hanya ada di variabel
 * lingkungan tanpa awalan NEXT_PUBLIC_, jadi Next.js tidak akan pernah
 * menyertakannya ke dalam bundel klien.
 */
export function supabaseServer() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY belum diatur.'
    );
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
