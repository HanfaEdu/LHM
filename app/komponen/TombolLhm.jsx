import { ArrowUpRight } from 'lucide-react';
import gaya from './tombol-lhm.module.css';

/** Spreadsheet tempat wali kelas mengisi dan menyunting nilai. */
const ALAMAT_LHM = 'https://laporan-akademik.vercel.app/';

/**
 * Tombol menuju halaman input nilai (LHM).
 *
 * Dipakai di dua tempat dengan latar yang berlawanan: di bawah kartu
 * login (latar biru tua tetap) dan di kepala dasbor wali kelas (latar
 * terang, atau gelap kalau perangkatnya bermode gelap). Karena itu
 * warnanya tidak dipatok di sini melainkan lewat `varian`, sementara
 * bentuk, ukuran, dan geraknya tetap sama di keduanya -- tombol yang
 * sama seharusnya terasa sebagai benda yang sama, di halaman mana pun
 * wali kelas menemuinya.
 *
 * Membuka tab baru, bukan menggantikan halaman ini: wali kelas yang
 * selesai mengisi nilai umumnya ingin kembali melihat dasbornya, dan
 * pada peramban HP tombol "kembali" setelah pindah domain sering
 * membawa mereka ke halaman login lagi, bukan ke tempat semula.
 */
export default function TombolLhm({ varian = 'terang', className = '' }) {
  return (
    <a
      href={ALAMAT_LHM}
      target="_blank"
      rel="noopener noreferrer"
      className={`${gaya.tombol} ${
        varian === 'gelap' ? gaya.gelap : gaya.terang
      } ${className}`}
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
