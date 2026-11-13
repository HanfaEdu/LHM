/**
 * Pemeriksaan pengalihan alamat Vercel ke domain sekolah.
 *
 *     node scripts/uji-alamat-resmi.mjs
 *
 * Yang paling penting dijaga: /api tidak pernah dialihkan (webhook WA
 * dan sinkronisasi Apps Script akan berhenti diam-diam), dan domain
 * sekolah sendiri tidak pernah dialihkan (bisa saling lempar dengan
 * pengaturan Domains di Vercel).
 */
import { alamatPengalihan } from '../lib/alamat-resmi.js';

let gagal = 0;
const periksa = (nama, hasil, harap) => {
  const ok = hasil === harap;
  if (!ok) gagal += 1;
  console.log(`${ok ? 'OK   ' : 'GAGAL'} ${nama}${ok ? '' : `\n      dapat: ${hasil}\n      harap: ${harap}`}`);
};

const prod = { situsResmi: 'https://www.akademik-bias.my.id', lingkungan: 'production' };

periksa('tautan rapor lama di alamat proyek dialihkan, path & token utuh',
  alamatPengalihan('https://lhm-abc123.vercel.app/rapor/k7Qx9?pin=1', prod),
  'https://www.akademik-bias.my.id/rapor/k7Qx9?pin=1');
periksa('alamat deployment juga dialihkan',
  alamatPengalihan('https://lhm-git-main-tim.vercel.app/dashboard/wali-kelas', prod),
  'https://www.akademik-bias.my.id/dashboard/wali-kelas');
periksa('beranda dialihkan',
  alamatPengalihan('https://lhm-abc123.vercel.app/', prod),
  'https://www.akademik-bias.my.id/');
periksa('webhook WA tidak dialihkan',
  alamatPengalihan('https://lhm-abc123.vercel.app/api/wa', prod), null);
periksa('sinkronisasi Apps Script tidak dialihkan',
  alamatPengalihan('https://lhm-abc123.vercel.app/api/sync', prod), null);
periksa('domain sekolah tanpa www tidak disentuh (diurus Vercel Domains)',
  alamatPengalihan('https://akademik-bias.my.id/rapor/x', prod), null);
periksa('domain sekolah dengan www tidak disentuh',
  alamatPengalihan('https://www.akademik-bias.my.id/rapor/x', prod), null);
periksa('deployment pratinjau tidak dialihkan',
  alamatPengalihan('https://lhm-git-fitur-tim.vercel.app/press',
    { ...prod, lingkungan: 'preview' }), null);
periksa('lokal (tanpa VERCEL_ENV) tidak dialihkan',
  alamatPengalihan('http://localhost:3000/', { ...prod, lingkungan: undefined }), null);
periksa('situs resmi kosong: tidak dialihkan',
  alamatPengalihan('https://lhm-abc123.vercel.app/', { situsResmi: '', lingkungan: 'production' }), null);
periksa('situs resmi sendiri *.vercel.app: tidak mengalihkan ke dirinya',
  alamatPengalihan('https://akademik-bias.vercel.app/rapor/x',
    { situsResmi: 'https://akademik-bias.vercel.app', lingkungan: 'production' }), null);
periksa('env bergaris miring di akhir tetap benar',
  alamatPengalihan('https://lhm-abc123.vercel.app/press',
    { situsResmi: 'https://www.akademik-bias.my.id/', lingkungan: 'production' }),
  'https://www.akademik-bias.my.id/press');

console.log(gagal ? `\n${gagal} GAGAL\n` : '\nSemua lolos.\n');
process.exit(gagal ? 1 : 0);
