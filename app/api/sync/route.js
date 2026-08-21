import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * Jembatan tulis untuk Apps Script -> Supabase.
 *
 * Google Apps Script (UrlFetchApp) tidak bisa memanggil Supabase langsung
 * memakai kunci sb_secret_...: Supabase menolaknya dengan "Forbidden use
 * of secret API key in browser" karena permintaan GAS ikut terdeteksi
 * sebagai browser oleh heuristik keamanan mereka -- walau GAS jelas
 * berjalan di server Google, bukan browser pengguna. Menambahkan header
 * User-Agent kustom tidak menembus deteksi ini.
 *
 * Endpoint ini jadi perantara: GAS memanggil endpoint ini (dengan kunci
 * rahasia milik kita sendiri, bukan kunci Supabase), lalu endpoint inilah
 * -- yang berjalan di server Vercel, bukan browser -- yang benar-benar
 * bicara ke Supabase memakai service_role/secret key.
 *
 * Nama tabel dibatasi lewat daftar putih supaya kunci rahasia yang bocor
 * tidak bisa dipakai menulis ke tabel sembarang.
 */

const TABEL_DIIZINKAN = ['kelas', 'siswa', 'penempatan', 'nilai_bulanan', 'users_access'];

export async function POST(request) {
  const kunciRahasia = request.headers.get('x-sync-secret');
  const kunciServer = process.env.SYNC_SHARED_SECRET;

  if (!kunciRahasia || kunciRahasia !== kunciServer) {
    // Info diagnostik SEMENTARA -- tidak membocorkan isi kunci, cuma
    // panjang karakternya, supaya kelihatan penyebabnya env var belum
    // ke-load (kosong) atau memang isinya beda (spasi nyasar, dll).
    // Hapus blok "diagnostik" ini setelah sinkronisasi berhasil sekali.
    return NextResponse.json(
      {
        error: 'Tidak diizinkan.',
        diagnostik: {
          kunci_dari_gas_panjang: kunciRahasia ? kunciRahasia.length : 0,
          kunci_di_server_ada: Boolean(kunciServer),
          kunci_di_server_panjang: kunciServer ? kunciServer.length : 0,
        },
      },
      { status: 401 }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Payload tidak valid.' }, { status: 400 });
  }

  const { tabel, data, onConflict } = body;
  if (!tabel || !Array.isArray(data) || !onConflict) {
    return NextResponse.json(
      { error: 'Field tabel, data (array), dan onConflict wajib diisi.' },
      { status: 400 }
    );
  }
  if (!TABEL_DIIZINKAN.includes(tabel)) {
    return NextResponse.json({ error: 'Tabel "' + tabel + '" tidak diizinkan.' }, { status: 400 });
  }
  if (data.length === 0) {
    return NextResponse.json({ data: [] });
  }

  try {
    const db = supabaseServer();
    const { data: hasil, error } = await db
      .from(tabel)
      .upsert(data, { onConflict })
      .select();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ data: hasil });
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Gangguan server.' }, { status: 500 });
  }
}
