/**
 * Pemeriksaan kunci sinkronisasi per sekolah (Fase 4.1).
 *
 *     node scripts/uji-sinkron-terikat.mjs
 *
 * Dua bagian:
 *   A. Fungsi murni lib/sinkron-terikat.js (periksaBaris dan kawan-kawan).
 *   B. Rute /api/sync UTUH dijalankan dengan basis data PALSU di memori:
 *      kunci salah -> 401; kunci lama tetap jalan; kunci sekolah menulis
 *      baris sahnya; satu baris melanggar -> 403 dan TIDAK ADA yang ditulis.
 *
 * Tidak menyentuh jaringan, Supabase, maupun basis data sungguhan.
 */
import { register } from 'node:module';
import {
  bacaKodeDirektur,
  bacaKunciSekolah,
  kodePemilikKunci,
  pesanPelanggaran,
  periksaBaris,
} from '../lib/sinkron-terikat.js';

let gagal = 0;
function periksa(nama, syarat, keterangan = '') {
  if (!syarat) gagal += 1;
  console.log(`${syarat ? 'OK   ' : 'GAGAL'} ${nama}${keterangan ? ` — ${keterangan}` : ''}`);
}

/* ================================================================ A */
console.log('\n--- A. periksaBaris ---');

const konteks = {
  kode: 'SDYFK',
  sekolahId: 1,
  idKelas: [10, 11],
  emailMilikLain: ['guru.pati@contoh.id'],
};
const ada = (tabel, data, k = konteks) => periksaBaris(tabel, data, k);

periksa('sekolah: kode sendiri lolos', ada('sekolah', [{ kode: 'SDYFK', nama: 'SD' }]).length === 0);
periksa('sekolah: kode sekolah lain ditolak', ada('sekolah', [{ kode: 'PGYFK' }]).length === 1);

periksa('kelas: sekolah_id sendiri lolos', ada('kelas', [{ sekolah_id: 1, nama_kelas: '1A' }]).length === 0);
periksa('kelas: sekolah_id lain ditolak', ada('kelas', [{ sekolah_id: 2, nama_kelas: '1A' }]).length === 1);
periksa('kelas: tanpa sekolah_id ditolak', ada('kelas', [{ nama_kelas: '1A' }]).length === 1);

periksa('siswa: sah lolos', ada('siswa', [{ sekolah_id: 1, nis: 'SDYFK-281' }]).length === 0);
periksa('siswa: NIS berawalan kode lain ditolak', ada('siswa', [{ sekolah_id: 1, nis: 'PGYFK-281' }]).length === 1);
periksa('siswa: NIS tanpa awalan ditolak', ada('siswa', [{ sekolah_id: 1, nis: '281' }]).length === 1);
periksa('siswa: sekolah_id lain ditolak', ada('siswa', [{ sekolah_id: 2, nis: 'SDYFK-281' }]).length === 1);
periksa('siswa: kode yang hanya mirip (SDYFKX-1) ditolak', ada('siswa', [{ sekolah_id: 1, nis: 'SDYFKX-1' }]).length === 1);

periksa('penempatan: sah lolos', ada('penempatan', [{ nis: 'SDYFK-281', kelas_id: 10 }]).length === 0);
periksa('penempatan: kelas_id di luar daftar ditolak', ada('penempatan', [{ nis: 'SDYFK-281', kelas_id: 99 }]).length === 1);
periksa('penempatan: NIS kode lain ditolak', ada('penempatan', [{ nis: 'PGYFK-1', kelas_id: 10 }]).length === 1);
periksa('nilai_bulanan: sah lolos', ada('nilai_bulanan', [{ nis: 'SDYFK-281', kelas_id: 11, bulan: 'Agustus' }]).length === 0);
periksa('nilai_bulanan: kelas_id di luar daftar ditolak', ada('nilai_bulanan', [{ nis: 'SDYFK-281', kelas_id: 99, bulan: 'Agustus' }]).length === 1);
periksa('kelas_id berupa teks "10" tetap dikenali', ada('penempatan', [{ nis: 'SDYFK-1', kelas_id: '10' }]).length === 0);

periksa('users_access: sah lolos', ada('users_access', [{ email: 'guru@contoh.id', role: 'wali_kelas', sekolah_id: 1 }]).length === 0);
periksa('users_access: sekolah_id lain ditolak', ada('users_access', [{ email: 'guru@contoh.id', role: 'wali_kelas', sekolah_id: 2 }]).length === 1);
periksa('users_access: email milik sekolah lain ditolak',
  ada('users_access', [{ email: 'Guru.Pati@contoh.id', role: 'kepala_sekolah', sekolah_id: 1 }]).length === 1);

periksa('direktur_area: tanpa pembatasan lolos (perilaku sekarang)',
  ada('users_access', [{ email: 'biro@contoh.id', role: 'direktur_area', sekolah_id: 1 }]).length === 0);
periksa('direktur_area: sekolah di luar daftar ditolak',
  ada('users_access', [{ email: 'biro@contoh.id', role: 'direktur_area', sekolah_id: 1 }],
    { ...konteks, kodeDirektur: ['PGYFK'] }).length === 1);
periksa('direktur_area: sekolah di dalam daftar lolos',
  ada('users_access', [{ email: 'biro@contoh.id', role: 'direktur_area', sekolah_id: 1 }],
    { ...konteks, kodeDirektur: ['sdyfk'] }).length === 0);
periksa('peran lain tidak terpengaruh pembatasan direktur',
  ada('users_access', [{ email: 'guru@contoh.id', role: 'wali_kelas', sekolah_id: 1 }],
    { ...konteks, kodeDirektur: ['PGYFK'] }).length === 0);

periksa('kolom id ditolak (tidak boleh menimpa baris sekolah lain)',
  ada('penempatan', [{ id: 5, nis: 'SDYFK-1', kelas_id: 10 }]).length === 1
  && ada('kelas', [{ id: 77, sekolah_id: 1, nama_kelas: '1A' }]).length === 1);
periksa('baris bukan objek ditolak', ada('siswa', [null, 'x']).length === 2);

{
  const campur = ada('siswa', [
    { sekolah_id: 1, nis: 'SDYFK-1' },
    { sekolah_id: 1, nis: 'PGYFK-2' },
    { sekolah_id: 1, nis: 'PGYFK-3' },
  ]);
  const pesan = pesanPelanggaran('siswa', campur);
  periksa('pesan menyebut tabel, jumlah, dan satu contoh',
    pesan.includes('"siswa"') && pesan.includes('2 baris') && pesan.includes('PGYFK-2') && !pesan.includes('PGYFK-3'), pesan);
}

console.log('\n--- A. kunci ---');
{
  const daftar = bacaKunciSekolah('{"sdyfk":"kunci-a","PGYFK":"kunci-b","KOSONG":"","BUKAN":5}');
  periksa('SYNC_SECRETS dibaca; kode jadi huruf besar; yang kosong/bukan teks dibuang',
    daftar.length === 2 && daftar[0].kode === 'SDYFK', JSON.stringify(daftar.map((d) => d.kode)));
  periksa('kunci a -> SDYFK', kodePemilikKunci('kunci-a', daftar) === 'SDYFK');
  periksa('kunci b -> PGYFK', kodePemilikKunci('kunci-b', daftar) === 'PGYFK');
  periksa('kunci salah -> null', kodePemilikKunci('kunci-c', daftar) === null);
  periksa('kunci kosong -> null', kodePemilikKunci('', daftar) === null && kodePemilikKunci(undefined, daftar) === null);
  periksa('JSON rusak -> daftar kosong (gagal tertutup)', bacaKunciSekolah('{rusak').length === 0);
  periksa('bukan objek -> daftar kosong', bacaKunciSekolah('["a"]').length === 0 && bacaKunciSekolah('') .length === 0);
  periksa('SYNC_KODE_DIREKTUR dipecah per koma', bacaKodeDirektur(' sdyfk, pgyfk ,').join() === 'SDYFK,PGYFK');
  periksa('SYNC_KODE_DIREKTUR kosong -> daftar kosong', bacaKodeDirektur('').length === 0 && bacaKodeDirektur(undefined).length === 0);
}

/* ================================================================ B */
console.log('\n--- B. rute /api/sync (basis data palsu) ---');

/* Alias "@/" dan "next/server" tidak dikenal Node biasa; dialihkan lewat
   hook pemuat supaya rute APA ADANYA bisa diimpor. */
const hook = `
export async function resolve(spesifier, konteks, lanjut) {
  if (spesifier === '@/lib/supabase-server') {
    return { url: 'data:text/javascript,export const supabaseServer = () => globalThis.__dbPalsu;', shortCircuit: true };
  }
  if (spesifier === 'next/server') {
    return { url: 'data:text/javascript,' + encodeURIComponent(
      'export const NextResponse = { json: (isi, opsi = {}) => ({ status: (opsi && opsi.status) || 200, isi }) };'), shortCircuit: true };
  }
  if (spesifier.startsWith('@/')) {
    return lanjut(new URL('../' + spesifier.slice(2) + '.js', ${JSON.stringify(import.meta.url)}).href, konteks);
  }
  return lanjut(spesifier, konteks);
}`;
register('data:text/javascript,' + encodeURIComponent(hook));

/** Basis data palsu: mencatat setiap upsert, dan menjawab pembacaan dari isi `tabelAda`. */
function buatDbPalsu(tabelAda) {
  const upsert = [];
  const db = {
    upsert,
    from(nama) {
      const q = { nama, saring: [], masuk: null };
      const api = {
        select() { return api; },
        eq(kolom, nilai) { q.saring.push((b) => String(b[kolom]) === String(nilai)); return api; },
        in(kolom, daftar) { q.saring.push((b) => daftar.map(String).includes(String(b[kolom]))); return api; },
        maybeSingle() {
          const baris = (tabelAda[nama] || []).filter((b) => q.saring.every((f) => f(b)));
          return Promise.resolve({ data: baris[0] ?? null, error: null });
        },
        upsert(data, opsi) { upsert.push({ tabel: nama, data, opsi }); q.masuk = data; return api; },
        then(selesai) {
          if (q.masuk) return Promise.resolve({ data: q.masuk, error: null }).then(selesai);
          const baris = (tabelAda[nama] || []).filter((b) => q.saring.every((f) => f(b)));
          return Promise.resolve({ data: baris, error: null }).then(selesai);
        },
      };
      return api;
    },
  };
  return db;
}

const { POST } = await import('../app/api/sync/route.js');

const tabelAda = {
  sekolah: [{ id: 1, kode: 'SDYFK' }, { id: 2, kode: 'PGYFK' }],
  kelas: [{ id: 10, sekolah_id: 1 }, { id: 11, sekolah_id: 1 }, { id: 20, sekolah_id: 2 }],
  users_access: [{ email: 'guru.pati@contoh.id', sekolah_id: 2 }, { email: 'baru@contoh.id', sekolah_id: null }],
};

async function kirim(kunci, tabel, data, { env = {} } = {}) {
  const semua = {
    SYNC_SECRETS: JSON.stringify({ SDYFK: 'kunci-sdyfk', PGYFK: 'kunci-pgyfk' }),
    SYNC_SHARED_SECRET: 'kunci-lama',
    SYNC_KODE_DIREKTUR: '',
    ...env,
  };
  for (const [k, v] of Object.entries(semua)) {
    if (v === undefined) delete process.env[k]; else process.env[k] = v;
  }
  globalThis.__dbPalsu = buatDbPalsu(tabelAda);
  const permintaan = {
    headers: { get: (n) => (n === 'x-sync-secret' ? kunci ?? null : null) },
    json: async () => ({ tabel, data, onConflict: 'nis' }),
  };
  const jawab = await POST(permintaan);
  return { ...jawab, upsert: globalThis.__dbPalsu.upsert };
}

{
  const sah = [{ sekolah_id: 1, nis: 'SDYFK-1', nama_lengkap: 'A' }];

  let r = await kirim('salah', 'siswa', sah);
  periksa('kunci salah -> 401, tidak menulis', r.status === 401 && r.upsert.length === 0);
  r = await kirim(null, 'siswa', sah);
  periksa('tanpa kunci -> 401', r.status === 401);

  r = await kirim('kunci-sdyfk', 'siswa', sah);
  periksa('kunci sekolah + baris sah -> 200 dan menulis', r.status === 200 && r.upsert.length === 1, `status ${r.status}`);

  r = await kirim('kunci-sdyfk', 'siswa', [...sah, { sekolah_id: 1, nis: 'PGYFK-9' }]);
  periksa('satu baris melanggar -> 403 dan TIDAK menulis apa pun', r.status === 403 && r.upsert.length === 0, r.isi?.error);
  periksa('pesan 403 menyebut tabel dan contoh', /"siswa"/.test(r.isi?.error || '') && /PGYFK-9/.test(r.isi?.error || ''));

  r = await kirim('kunci-pgyfk', 'siswa', sah);
  periksa('kunci sekolah LAIN tidak boleh menulis siswa SDYFK -> 403', r.status === 403 && r.upsert.length === 0);

  r = await kirim('kunci-sdyfk', 'penempatan', [{ nis: 'SDYFK-1', kelas_id: 10 }]);
  periksa('penempatan ke kelas sendiri -> 200', r.status === 200, `status ${r.status}`);
  r = await kirim('kunci-sdyfk', 'penempatan', [{ nis: 'SDYFK-1', kelas_id: 20 }]);
  periksa('penempatan ke kelas sekolah lain -> 403', r.status === 403 && r.upsert.length === 0);
  r = await kirim('kunci-sdyfk', 'nilai_bulanan', [{ nis: 'SDYFK-1', kelas_id: 20, bulan: 'Agustus' }]);
  periksa('nilai ke kelas sekolah lain -> 403', r.status === 403 && r.upsert.length === 0);

  r = await kirim('kunci-sdyfk', 'sekolah', [{ kode: 'PGYFK', nama: 'x' }]);
  periksa('sekolah berkode lain -> 403', r.status === 403 && r.upsert.length === 0);
  r = await kirim('kunci-sdyfk', 'sekolah', [{ kode: 'SDYFK', nama: 'SD' }]);
  periksa('sekolah berkode sendiri -> 200', r.status === 200);

  r = await kirim('kunci-sdyfk', 'users_access', [{ email: 'guru.pati@contoh.id', role: 'kepala_sekolah', sekolah_id: 1 }]);
  periksa('email milik sekolah lain -> 403 (tidak bisa merebut akun)', r.status === 403 && r.upsert.length === 0, r.isi?.error);
  r = await kirim('kunci-sdyfk', 'users_access', [{ email: 'baru@contoh.id', role: 'wali_kelas', sekolah_id: 1 }]);
  periksa('email yang sekolah_id-nya masih kosong -> 200', r.status === 200, `status ${r.status}`);
  r = await kirim('kunci-sdyfk', 'users_access', [{ email: 'x@contoh.id', role: 'wali_kelas', sekolah_id: 2 }]);
  periksa('users_access dengan sekolah_id lain -> 403', r.status === 403);

  r = await kirim('kunci-sdyfk', 'users_access', [{ email: 'biro@contoh.id', role: 'direktur_area', sekolah_id: 1 }]);
  periksa('direktur_area dengan SYNC_KODE_DIREKTUR kosong -> 200 (perilaku sekarang)', r.status === 200);
  r = await kirim('kunci-sdyfk', 'users_access', [{ email: 'biro@contoh.id', role: 'direktur_area', sekolah_id: 1 }],
    { env: { SYNC_KODE_DIREKTUR: 'PGYFK' } });
  periksa('direktur_area dari sekolah di luar SYNC_KODE_DIREKTUR -> 403', r.status === 403 && r.upsert.length === 0);

  r = await kirim('kunci-sdyfk', 'ekskul_apa_saja', sah);
  periksa('tabel di luar daftar putih -> 400', r.status === 400);

  /* Mode lama: perilaku persis seperti sebelumnya -- tanpa pemeriksaan baris. */
  r = await kirim('kunci-lama', 'siswa', [{ sekolah_id: 2, nis: 'PGYFK-9' }]);
  periksa('kunci lama masih jalan selama SYNC_SHARED_SECRET ada (tanpa pemeriksaan baris)', r.status === 200 && r.upsert.length === 1);
  r = await kirim('kunci-lama', 'siswa', sah, { env: { SYNC_SHARED_SECRET: undefined } });
  periksa('SYNC_SHARED_SECRET dihapus -> kunci lama mati (401)', r.status === 401 && r.upsert.length === 0);
  r = await kirim('kunci-sdyfk', 'siswa', sah, { env: { SYNC_SHARED_SECRET: undefined } });
  periksa('SYNC_SHARED_SECRET dihapus -> kunci sekolah tetap jalan', r.status === 200);
  r = await kirim('', 'siswa', sah, { env: { SYNC_SHARED_SECRET: '' } });
  periksa('kunci kosong tidak pernah cocok dengan variabel kosong', r.status === 401);
  r = await kirim('kunci-sdyfk', 'siswa', sah, { env: { SYNC_SECRETS: '{rusak' } });
  periksa('SYNC_SECRETS rusak -> kunci sekolah ditolak (401), bukan dilonggarkan', r.status === 401);
}

console.log(gagal ? `\n${gagal} pemeriksaan GAGAL\n` : '\nSeluruh pemeriksaan lolos.\n');
process.exit(gagal ? 1 : 0);
