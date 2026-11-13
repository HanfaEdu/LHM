import { NextResponse } from 'next/server';
import { alamatPengalihan } from '@/lib/alamat-resmi';

/**
 * Kunjungan produksi lewat alamat *.vercel.app dipindahkan ke domain
 * sekolah, dengan path yang sama. Alasan dan pengecualiannya ada di
 * lib/alamat-resmi.js.
 *
 * Syarat agar ini terlihat bekerja: di Vercel → Settings → Deployment
 * Protection, Vercel Authentication harus "Only Preview Deployments".
 * Kalau masih melindungi alamat produksi, Vercel menampilkan halaman
 * login-nya SEBELUM middleware ini sempat berjalan.
 */
export function middleware(request) {
  // Host dibaca dari header, bukan dari request.url: di sebagian
  // lingkungan (next start, proksi) request.url memuat alamat internal
  // server, bukan alamat yang diketik pengunjung.
  const { pathname, search } = request.nextUrl;
  const host = request.headers.get('host') || request.nextUrl.host;
  const tujuan = alamatPengalihan(`https://${host}${pathname}${search}`, {
    situsResmi: process.env.NEXT_PUBLIC_SITE_URL,
    lingkungan: process.env.VERCEL_ENV,
  });
  if (!tujuan) return NextResponse.next();

  // 308: pengalihan permanen, dan peramban mengingatnya -- kunjungan
  // berikutnya dari tautan lama langsung menuju domain sekolah.
  return NextResponse.redirect(tujuan, 308);
}

export const config = {
  // Berkas build dan gambar tidak perlu melewati middleware; /api
  // dikecualikan di sini dan sekali lagi di alamatPengalihan().
  matcher: ['/((?!api/|_next/static/|_next/image/).*)'],
};
