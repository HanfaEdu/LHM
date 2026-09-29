import { supabase } from '@/lib/supabase';
import { BULAN_AJARAN } from '@/quran_mapping';
import { adaIsiBulan, potongTargetBulanKosong } from '@/lib/statistik';

/**
 * Pengambilan data untuk dasbor guru & kepala sekolah.
 *
 * Query dilakukan dari browser memakai anon key, jadi seluruh pembatasan
 * akses ditegakkan oleh RLS di Postgres — bukan oleh kode di halaman ini.
 * Wali kelas yang mencoba memuat kelas lain akan menerima nol baris dari
 * database, bukan sekadar tampilan yang disembunyikan.
 */

/** Profil pengguna yang sedang login (kepala sekolah / wali kelas). */
export async function muatProfil(email) {
  const { data, error } = await supabase
    .from('users_access')
    .select('email, nama, role, nama_kelas')
    .eq('email', email.toLowerCase().trim())
    .maybeSingle();

  if (error) throw error;
  return data;
}

/** Semua kelas yang boleh dilihat pengguna ini (RLS yang menyaring). */
export async function muatDaftarKelas() {
  const { data, error } = await supabase
    .from('kelas')
    .select('id, sekolah_id, tahun_ajaran, nama_kelas, wali_kelas, target_akademik')
    .order('tahun_ajaran', { ascending: false })
    .order('nama_kelas', { ascending: true });

  if (error) throw error;
  return data || [];
}

/**
 * Nama sekolah tempat pengguna ini bertugas.
 *
 * Query TERPISAH, bukan disisipkan ke dalam muatDaftarKelas(). Kalau
 * disisipkan sebagai relasi (`sekolah:sekolah_id (nama)`), PostgREST
 * menjawab GALAT -- bukan null -- pada database yang belum menjalankan
 * migrasi multi-sekolah, dan galat itu akan menjatuhkan seluruh dasbor.
 * Dipisahkan begini, kegagalannya tertelan di sini dan kepala halaman
 * cukup memakai nama cadangannya.
 *
 * RLS yang menentukan barisnya: tiap pengguna hanya melihat sekolahnya
 * sendiri, kecuali direktur area yang melihat seluruh sekolah di
 * areanya.
 */
export async function muatDaftarSekolah() {
  try {
    const { data, error } = await supabase
      .from('sekolah')
      .select('id, kode, nama, area, jenjang, link_lhm')
      .order('nama', { ascending: true });

    if (error) return [];
    return data || [];
  } catch {
    // Tabelnya belum ada (migrasi belum dijalankan). Bukan kegagalan
    // yang perlu diteruskan -- dasbor tetap berjalan tanpa ini.
    return [];
  }
}

/**
 * Satu sekolah saja -- dipakai dasbor wali kelas, yang menurut RLS
 * memang tidak pernah melihat lebih dari satu.
 */
export async function muatSekolah() {
  const daftar = await muatDaftarSekolah();
  return daftar.length ? daftar[0] : null;
}

/**
 * Nilai satu kelas untuk seluruh tahun ajaran, sudah digabung dengan
 * identitas siswa dan dikelompokkan per bulan.
 */
export async function muatNilaiKelas(kelasId) {
  const [{ data: nilai, error: e1 }, { data: penempatan, error: e2 }] = await Promise.all([
    supabase
      .from('nilai_bulanan')
      .select('*')
      .eq('kelas_id', kelasId),
    supabase
      .from('penempatan')
      .select('nis, siswa:nis (nis, nama_lengkap, nama_panggilan)')
      .eq('kelas_id', kelasId),
  ]);

  if (e1) throw e1;
  if (e2) throw e2;

  const identitas = new Map(
    (penempatan || [])
      .map((p) => p.siswa)
      .filter(Boolean)
      .map((s) => [s.nis, s])
  );

  const perBulan = {};
  BULAN_AJARAN.forEach((bulan) => {
    const baris = (nilai || [])
      .filter((n) => n.bulan === bulan)
      .map((n) => {
        const s = identitas.get(n.nis);
        return {
          ...n,
          nama_lengkap: s?.nama_lengkap || n.nis,
          nama_panggilan: s?.nama_panggilan || n.nis,
        };
      })
      .sort((a, b) => a.nama_panggilan.localeCompare(b.nama_panggilan, 'id'));

    if (baris.length) perBulan[bulan] = baris;
  });

  return { perBulan, jumlahSiswa: identitas.size };
}

/**
 * Bulan-bulan yang sudah benar-benar dinilai, urut menurut tahun ajaran.
 *
 * Diukur dari isi barisnya, bukan dari ada-tidaknya baris: sinkronisasi
 * membuat baris untuk kedua belas bulan sekaligus, sehingga menghitung
 * baris saja membuat seluruh tahun tampak sudah terisi.
 */
export function bulanTerisi(perBulan) {
  return BULAN_AJARAN.filter((b) => adaIsiBulan(perBulan[b]));
}

/**
 * Kumpulan siswa yang pernah muncul di perBulan satu kelas.
 *
 * Diambil dari gabungan seluruh bulan, bukan hanya satu bulan tertentu --
 * siswa yang bulan ini belum dinilai tetap harus muncul di daftar pilihan,
 * bukan hilang begitu saja.
 */
export function siswaDalamKelas(perBulan) {
  const map = new Map();
  Object.values(perBulan).forEach((baris) => {
    baris.forEach((b) => {
      if (!map.has(b.nis)) map.set(b.nis, b);
    });
  });
  return [...map.values()].sort((a, b) =>
    a.nama_panggilan.localeCompare(b.nama_panggilan, 'id')
  );
}

/**
 * Menyusun ulang perBulan satu kelas (per bulan -> banyak siswa) menjadi
 * satu siswa -> 12 bulan, format yang dipakai grafik tahunan per siswa
 * (sama seperti yang dilihat orang tua di /rapor/[token]).
 */
export function susunBulananSiswa(perBulan, nis) {
  return potongTargetBulanKosong(BULAN_AJARAN.map((bulan) => {
    const baris = (perBulan[bulan] || []).find((b) => b.nis === nis) || {};
    return {
      bulan,
      rata_b_indo: nilaiAtauNull(baris.rata_b_indo),
      rata_mtk: nilaiAtauNull(baris.rata_mtk),
      rata_ipa: nilaiAtauNull(baris.rata_ipa),
      target_tahfidz: nilaiAtauNull(baris.target_tahfidz),
      capaian_tahfidz: nilaiAtauNull(baris.capaian_tahfidz),
      target_tahsin: nilaiAtauNull(baris.target_tahsin),
      capaian_tahsin: nilaiAtauNull(baris.capaian_tahsin),
    };
  }));
}

function nilaiAtauNull(v) {
  return v === null || v === undefined || v === '' ? null : v;
}

/**
 * Log layanan WhatsApp orang tua (lihat app/api/wa/route.js), digabung
 * dengan nama anak di sisi browser -- sama seperti muatNilaiKelas()
 * menggabung nilai dengan identitas siswa.
 *
 * TIDAK bisa digabung lewat satu query PostgREST: pengirim dicocokkan ke
 * siswa.wa_normal lewat operator larik (@>), bukan lewat kunci asing,
 * dan PostgREST hanya bisa menyisipkan (embed) relasi yang bertumpu pada
 * foreign key. wa_pesan sengaja tidak menyimpan nis siswa -- satu nomor
 * bisa menjawab untuk lebih dari satu anak (kakak-adik), dan sebaliknya.
 *
 * Baris yang tampil sudah dibatasi RLS (migrasi 005): kepala sekolah
 * hanya menerima wa_pesan yang pengirimnya cocok siswa di sekolah yang
 * boleh ia lihat, jadi penyaringan sekolah di sini tidak diperlukan lagi.
 */
export async function muatLogWa() {
  const [{ data: pesan, error: e1 }, { data: siswa, error: e2 }] = await Promise.all([
    supabase
      .from('wa_pesan')
      .select('id, pengirim, hasil, jumlah_anak, dibuat_pada')
      .order('dibuat_pada', { ascending: false })
      .limit(500),
    supabase.from('siswa').select('nama_lengkap, nama_panggilan, wa_normal'),
  ]);

  if (e1) throw e1;
  if (e2) throw e2;

  // Larik siswa per nomor, bukan Map nomor->satu siswa: nomor yang sama
  // wajar menjawab untuk beberapa anak sekaligus (kakak-adik).
  const siswaPerNomor = new Map();
  for (const s of siswa || []) {
    for (const nomor of s.wa_normal || []) {
      if (!siswaPerNomor.has(nomor)) siswaPerNomor.set(nomor, []);
      siswaPerNomor.get(nomor).push(s);
    }
  }

  return (pesan || []).map((p) => ({
    ...p,
    anak: siswaPerNomor.get(p.pengirim) || [],
  }));
}

/**
 * Log setiap kali rapor dibuka orang tua (migrasi 006), plus ringkasan
 * per anak -- untuk menjawab "siapa yang sering buka" dan "siapa yang
 * belum pernah buka", bukan cuma "kapan terakhir".
 *
 * status/aktif/terakhir_dibuka WAJIB lewat /api/tautan, BUKAN query
 * langsung ke akses_ortu: tabel itu sengaja tidak punya satu pun policy
 * SELECT (lihat app/api/tautan/route.js) karena menyimpan token, jadi
 * query langsung dari sini akan selalu kembali KOSONG -- bukan galat,
 * cuma nol baris -- dan seluruh anak akan salah tampil "belum
 * diterbitkan" walau tautannya sudah aktif. /api/tautan sudah menghitung
 * ulang aksi 'daftar' persis untuk halaman Tautan Orang Tua; dipakai lagi
 * di sini alih-alih membuat jalur server baru.
 *
 * akses_dibuka beda ceritanya: nis di sana BENAR-BENAR kunci asing ke
 * siswa dan sudah punya policy SELECT sendiri (migrasi 006), jadi bisa
 * dibaca langsung dan disisipkan (embed) lewat satu query PostgREST.
 */
export async function muatLogAksesRapor() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error('Sesi berakhir. Silakan masuk kembali.');

  // Tahun ajaran TERKINI: muatDaftarKelas() sudah mengurutkannya menurun,
  // sama seperti nilai bawaan di dasbor kepala sekolah.
  const kelas = await muatDaftarKelas();
  const tahunAjaran = kelas[0]?.tahun_ajaran;
  if (!tahunAjaran) return { ringkasan: [], riwayat: [] };

  const [daftarRespons, { data: riwayat, error: eRiwayat }] = await Promise.all([
    fetch('/api/tautan', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ aksi: 'daftar', tahunAjaran }),
    }),
    supabase
      .from('akses_dibuka')
      .select('id, nis, dibuka_pada, siswa:nis (nama_lengkap, nama_panggilan)')
      .order('dibuka_pada', { ascending: false })
      .limit(2000),
  ]);

  const isiDaftar = await daftarRespons.json();
  if (!daftarRespons.ok) throw new Error(isiDaftar.error || 'Gagal memuat daftar siswa.');
  if (eRiwayat) throw eRiwayat;

  const jumlahPer = new Map();
  const terakhirLogPer = new Map();
  for (const r of riwayat || []) {
    jumlahPer.set(r.nis, (jumlahPer.get(r.nis) || 0) + 1);
    // riwayat sudah terurut terbaru dulu, jadi kemunculan PERTAMA per nis
    // adalah yang paling baru.
    if (!terakhirLogPer.has(r.nis)) terakhirLogPer.set(r.nis, r.dibuka_pada);
  }

  const ringkasan = (isiDaftar.daftar || []).map((d) => {
    const jumlahDibuka = jumlahPer.get(d.nis) || 0;
    // d.terakhir_dibuka dipakai sebagai cadangan: rapor yang dibuka
    // SEBELUM migrasi 006 tidak akan pernah muncul di akses_dibuka, dan
    // tanpa ini anak itu tampak seolah belum pernah dibuka sama sekali.
    const terakhirDibuka = terakhirLogPer.get(d.nis) || d.terakhir_dibuka || null;

    let status;
    if (!d.token || !d.aktif) status = 'belum_terbit';
    else if (!terakhirDibuka) status = 'belum_dibuka';
    else status = 'sudah_dibuka';

    return {
      nis: d.nis,
      nama_lengkap: d.nama_lengkap,
      nama_panggilan: d.nama_panggilan,
      kelas: d.nama_kelas || null,
      status,
      jumlahDibuka,
      terakhirDibuka,
    };
  });

  return { ringkasan, riwayat: riwayat || [] };
}
