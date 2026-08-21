import { createClient } from '@supabase/supabase-js';

/**
 * Klien Supabase untuk browser (dasbor guru & kepala sekolah).
 *
 * Memakai kunci publishable/anon yang memang dirancang boleh terlihat di
 * browser -- pembatasan aksesnya ditegakkan kebijakan RLS di Postgres,
 * bukan dengan menyembunyikan kunci ini.
 *
 * Nama variabel diperiksa berurutan karena integrasi resmi Supabase-Vercel
 * membuat NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, sementara pengisian manual
 * biasanya memakai NEXT_PUBLIC_SUPABASE_ANON_KEY. Keduanya diterima.
 */
const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  'https://placeholder-project.supabase.co';

const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  'placeholder-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
