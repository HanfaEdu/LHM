import { createHash } from 'crypto';
import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { BULAN_AJARAN, getQuranLevelName } from '@/quran_mapping';
import { adaIsiBulan, potongTargetBulanKosong } from '@/lib/statistik';

export const dynamic = 'force-dynamic';

/**
 * Endpoint data rapor untuk orang tua.
 *
 * Seluruh pekerjaan dilakukan di server dengan alasan yang tidak bisa
 * ditawar: grafik perbandingan kelas mengharuskan browser menerima nilai
 * teman-teman sekelas. Kalau halaman ini query Supabase langsung dari
 * browser, nama lengkap dan NIS teman sekelas ikut terkirim dan tinggal
 * dibaca di tab Network — menyamarkannya di komponen grafik tidak
 * menyembunyikan apa pun. Di sini penyamaran terjadi SEBELUM data
 * meninggalkan server, sehingga nama teman sekelas memang tidak pernah
 * ada di dalam respons.
 */
export async function POST(request) {
  let token, pin, tahunAjaran;
  try {
    ({ token, pin, tahunAjaran } = await request.json());
  } catch {
    return NextResponse.json({ error: 'Permintaan tidak dikenali.' }, { status: 400 });
  }

  if (!token) {
    return NextResponse.json({ error: 'Tautan tidak lengkap.' }, { status: 400 });
  }

  const db = supabaseServer();

  const { data: akses, error: errAkses } = await db
    .from('akses_ortu')
    .select('nis, pin_hash, aktif')
    .eq('token', token)
    .maybeSingle();

  // Pesan sengaja disamakan untuk token tidak ada, token nonaktif, dan
  // PIN salah, supaya respons tidak bisa dipakai menebak token yang valid.
  const ditolak = () =>
    NextResponse.json(
      { error: 'Tautan atau PIN tidak cocok. Silakan hubungi wali kelas.' },
      { status: 401 }
    );

  if (errAkses) {
    return NextResponse.json({ error: 'Gangguan pada server.' }, { status: 500 });
  }
  if (!akses || !akses.aktif) return ditolak();

  if (akses.pin_hash) {
    if (!pin) {
      return NextResponse.json({ butuhPin: true }, { status: 200 });
    }
    const hash = createHash('sha256').update(`${pin}:${token}`).digest('hex');
    if (hash !== akses.pin_hash) return ditolak();
  }

  const nis = akses.nis;

  // --- Identitas anak ---
  const { data: anak } = await db
    .from('siswa')
    .select('nis, nama_lengkap, nama_panggilan')
    .eq('nis', nis)
    .maybeSingle();

  if (!anak) return ditolak();

  // --- Seluruh kelas yang pernah ditempati (untuk dropdown tahun ajaran) ---
  const { data: penempatan } = await db
    .from('penempatan')
    .select('kelas_id, kelas:kelas_id (id, tahun_ajaran, nama_kelas, wali_kelas, target_akademik)')
    .eq('nis', nis);

  const daftarKelas = (penempatan || [])
    .map((p) => p.kelas)
    .filter(Boolean)
    .sort((a, b) => b.tahun_ajaran.localeCompare(a.tahun_ajaran));

  if (!daftarKelas.length) {
    return NextResponse.json({ error: 'Data kelas belum tersedia.' }, { status: 404 });
  }

  const kelas =
    daftarKelas.find((k) => k.tahun_ajaran === tahunAjaran) || daftarKelas[0];

  /* Nama sekolah untuk kepala halaman rapor.
     Query terpisah dan kegagalannya ditelan: pada database yang belum
     menjalankan migrasi multi-sekolah, kolom kelas.sekolah_id memang
     belum ada, dan PostgREST menjawabnya dengan galat -- bukan null.
     Menyisipkannya sebagai relasi ke query kelas di atas berarti seluruh
     rapor gagal dimuat hanya karena kolom yang belum sempat dibuat. */
  let namaSekolah = null;
  try {
    const { data: sek } = await db
      .from('kelas')
      .select('sekolah:sekolah_id (nama)')
      .eq('id', kelas.id)
      .maybeSingle();
    namaSekolah = sek?.sekolah?.nama ?? null;
  } catch {
    // Belum dimigrasi. Halaman rapor memakai nama cadangannya.
  }

  // --- Nilai anak sepanjang tahun ajaran terpilih ---
  const { data: nilaiAnak } = await db
    .from('nilai_bulanan')
    .select('*')
    .eq('nis', nis)
    .eq('kelas_id', kelas.id);

  // --- Nilai seluruh kelas, untuk grafik perbandingan ---
  // Target ikut diambil: grafik perbandingan perlu menggambar garis target
  // pada bulan yang sedang dilihat, dan target Tahfidz/Tahsin berbeda tiap
  // bulan (tidak bisa diambil dari target_akademik yang tetap).
  const { data: nilaiKelas } = await db
    .from('nilai_bulanan')
    .select(
      'nis, bulan, urutan_bulan, rata_b_indo, rata_mtk, rata_ipa, ' +
        'target_tahfidz, capaian_tahfidz, target_tahsin, capaian_tahsin'
    )
    .eq('kelas_id', kelas.id);

  const { data: siswaKelas } = await db
    .from('penempatan')
    .select('nis, siswa:nis (nis, nama_lengkap, nama_panggilan)')
    .eq('kelas_id', kelas.id);

  const label = buatLabelAnonim(
    (siswaKelas || []).map((p) => p.siswa).filter(Boolean),
    nis,
    anak.nama_panggilan
  );

  // --- Rangkai 12 bulan tahun ajaran, termasuk yang belum terisi ---
  const perBulan = new Map((nilaiAnak || []).map((b) => [b.bulan, b]));
  const bulanan = potongTargetBulanKosong(BULAN_AJARAN.map((bulan, i) => {
    const b = perBulan.get(bulan) || {};
    return {
      bulan,
      urutan_bulan: i + 1,
      rata_b_indo: angka(b.rata_b_indo),
      rata_mtk: angka(b.rata_mtk),
      rata_ipa: angka(b.rata_ipa),
      target_akademik: angka(kelas.target_akademik) ?? 90,
      target_tahfidz: angka(b.target_tahfidz),
      capaian_tahfidz: angka(b.capaian_tahfidz),
      nama_tahfidz: getQuranLevelName('tahfidz', b.capaian_tahfidz),
      target_tahsin: angka(b.target_tahsin),
      capaian_tahsin: angka(b.capaian_tahsin),
      nama_tahsin: getQuranLevelName('tahsin', b.capaian_tahsin),
    };
  }));

  // --- Perbandingan kelas per bulan, sudah anonim ---
  const perbandingan = {};
  BULAN_AJARAN.forEach((bulan) => {
    const baris = (nilaiKelas || [])
      .filter((r) => r.bulan === bulan)
      .map((r) => ({
        label: label.get(r.nis) || 'Siswa',
        anak: r.nis === nis,
        rata_b_indo: angka(r.rata_b_indo),
        rata_mtk: angka(r.rata_mtk),
        rata_ipa: angka(r.rata_ipa),
        target_tahfidz: angka(r.target_tahfidz),
        capaian_tahfidz: angka(r.capaian_tahfidz),
        target_tahsin: angka(r.target_tahsin),
        capaian_tahsin: angka(r.capaian_tahsin),
      }))
      .sort((a, b) => a.label.localeCompare(b.label, 'id'));

    // Bulan tanpa satu pun nilai terisi sengaja tidak dimasukkan: baris
    // memang selalu ada untuk kedua belas bulan (sinkronisasi membuatnya
    // sekaligus), sehingga menyertakan semuanya membuat pemilih bulan
    // menawarkan Juni dan mendarat di sana sepanjang tahun ajaran.
    if (adaIsiBulan(baris)) perbandingan[bulan] = baris;
  });

  db.from('akses_ortu')
    .update({ terakhir_dibuka: new Date().toISOString() })
    .eq('token', token)
    .then(() => {}, () => {});

  return NextResponse.json({
    anak: { nama_lengkap: anak.nama_lengkap, nama_panggilan: anak.nama_panggilan },
    sekolah: { nama: namaSekolah },
    kelas: {
      nama_kelas: kelas.nama_kelas,
      wali_kelas: kelas.wali_kelas,
      tahun_ajaran: kelas.tahun_ajaran,
      target_akademik: angka(kelas.target_akademik) ?? 90,
    },
    tahunAjaranTersedia: daftarKelas.map((k) => k.tahun_ajaran),
    bulanan,
    perbandingan,
  });
}

/**
 * Memberi label anonim kepada teman sekelas.
 *
 * Inisial saja tidak cukup: di Kelas 2 ada Aisya, Ammar, Alif, Aira, dan
 * Aurora — sumbu X-nya akan terbaca "A, A, A, A, A". Maka inisial yang
 * dipakai lebih dari satu siswa diberi nomor urut yang stabil (A-1, A-2),
 * diurutkan menurut NIS supaya labelnya tidak berpindah-pindah tiap bulan.
 *
 * Hanya anak sendiri yang tampil dengan nama.
 */
function buatLabelAnonim(daftarSiswa, nisAnak, namaAnak) {
  const perInisial = new Map();

  daftarSiswa
    .filter((s) => s.nis !== nisAnak)
    .sort((a, b) => String(a.nis).localeCompare(String(b.nis), 'id'))
    .forEach((s) => {
      const inisial = (s.nama_lengkap || s.nama_panggilan || '?')
        .trim()
        .charAt(0)
        .toUpperCase();
      if (!perInisial.has(inisial)) perInisial.set(inisial, []);
      perInisial.get(inisial).push(s.nis);
    });

  const label = new Map();
  perInisial.forEach((daftarNis, inisial) => {
    daftarNis.forEach((n, i) => {
      label.set(n, daftarNis.length === 1 ? inisial : `${inisial}-${i + 1}`);
    });
  });

  label.set(nisAnak, namaAnak);
  return label;
}

/** Menjaga NULL tetap NULL. Nilai 0 yang sah tidak boleh berubah jadi null. */
function angka(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
