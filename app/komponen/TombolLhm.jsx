import { ArrowUpRight } from 'lucide-react';
import { LINK_LHM_BAWAAN } from '@/lib/sekolah';
import gaya from './tombol-lhm.module.css';

/**
 * Tombol menuju aplikasi input nilai (LHM) milik sekolah ini.
 *
 * Alamatnya DATA, bukan tetapan: tiap sekolah di jaringan punya
 * aplikasi input LHM sendiri, dan alamatnya dikirim Apps Script
 * bersama identitas sekolah (kolom `link_lhm`). Karena itu tombol ini
 * menerima `alamat` dari pemanggilnya alih-alih menyimpannya sendiri --
 * satu berkas dasbor yang sama melayani sekolah mana pun.
 *
 * Kalau alamatnya belum ada, tombolnya TIDAK ditampilkan. Tombol yang
 * hilang membuat wali kelas bertanya; tombol yang mengarah ke aplikasi
 * sekolah lain membuat mereka mengisi nilai di tempat yang salah dan
 * baru ketahuan berminggu-minggu kemudian.
 *
 * Membuka tab baru, bukan menggantikan halaman ini: wali kelas yang
 * selesai mengisi nilai umumnya ingin kembali melihat dasbornya, dan
 * pada peramban HP tombol "kembali" setelah pindah domain sering
 * membawa mereka ke halaman login lagi, bukan ke tempat semula.
 */
export default function TombolLhm({ alamat, className = '' }) {
  // Cadangan dipakai selama masa peralihan: sebelum migrasi dijalankan
  // dan sebelum sinkronisasi pertama, database belum punya alamat apa
  // pun. Lihat catatan kedaluwarsanya di lib/sekolah.js.
  const tujuan = alamat || LINK_LHM_BAWAAN;
  if (!tujuan) return null;

  return (
    <a
      href={tujuan}
      target="_blank"
      rel="noopener noreferrer"
      className={`${gaya.tombol} ${className}`}
    >
      Input/Edit LHM
      {/* Panah serong: penanda baku bahwa tautan ini keluar dari aplikasi
          dan terbuka di tab lain. Tanpa itu, wali kelas yang menekannya
          mengira dirinya masih di dalam SiPaDi. */}
      <ArrowUpRight size={18} className={gaya.panah} aria-hidden="true" />
      <span className={gaya.luar}>(terbuka di tab baru)</span>
    </a>
  );
}
