'use client';

import { Printer } from 'lucide-react';
import gaya from './tombol-cetak.module.css';

/**
 * Tombol "Simpan PDF" di kepala dasbor staf.
 *
 * Tidak ada pustaka pembuat PDF di baliknya, dan itu disengaja. Dialog
 * cetak bawaan peramban sudah menyediakan "Simpan sebagai PDF" di HP
 * maupun komputer; hasilnya berupa teks yang bisa dicari dan grafik yang
 * tetap tajam saat diperbesar, sementara pustaka yang memotret halaman
 * menjadi gambar menghasilkan berkas besar yang pecah saat dizum. Seluruh
 * kerapiannya diatur lewat @media print di dasbor.module.css.
 *
 * Bentuknya sengaja lebih tenang daripada tombol "Input/Edit LHM" di
 * sebelahnya: mencetak adalah tindakan sesekali, sedangkan mengisi nilai
 * adalah pekerjaan harian wali kelas. Dua tombol berwarna pekat
 * berdampingan akan membuat keduanya terbaca sama pentingnya.
 */
export default function TombolCetak({ onClick, label = 'Simpan PDF' }) {
  return (
    <button type="button" className={gaya.tombol} onClick={onClick}>
      <Printer size={16} aria-hidden="true" />
      {label}
    </button>
  );
}
