'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import gaya from './tombol-keluar.module.css';

/**
 * Tombol keluar akun untuk dasbor wali kelas dan kepala sekolah.
 *
 * Hanya lambang, tanpa tulisan: di baris kepala dasbor sudah berjajar
 * pemilih tahun, pemilih bulan, dan tombol menuju halaman lain -- satu
 * tombol bertulisan lagi akan berebut perhatian dengan semuanya,
 * padahal keluar akun adalah hal yang paling jarang ditekan di halaman
 * ini. Namanya tetap dibawa lewat aria-label dan title, sehingga
 * pembaca layar dan penunjuk tetikus tetap mendapat kata "Keluar".
 *
 * TIDAK dipasang di dasbor orang tua: halaman itu dibuka lewat tautan
 * pribadi tanpa login sama sekali, jadi tidak ada sesi yang bisa
 * diakhiri di sana.
 */
export default function TombolKeluar() {
  const router = useRouter();
  const [keluar, setKeluar] = useState(false);

  const tangani = async () => {
    // Penjaga terhadap tekanan ganda: pada koneksi lambat, tombol yang
    // ditekan dua kali menjalankan signOut kedua saat sesi sudah tidak
    // ada, dan yang kedua itu berakhir sebagai galat di konsol.
    if (keluar) return;
    setKeluar(true);
    try {
      await supabase.auth.signOut();
    } finally {
      // Tetap diarahkan ke halaman login walau signOut gagal: sesi lokal
      // sudah dibuang lebih dulu oleh pustaka Supabase, jadi bertahan di
      // dasbor hanya akan menampilkan data yang tidak bisa dimuat ulang.
      router.push('/login');
    }
  };

  return (
    <button
      type="button"
      onClick={tangani}
      disabled={keluar}
      className={gaya.tombol}
      aria-label="Keluar dari akun"
      title="Keluar dari akun"
    >
      <LogOut size={18} aria-hidden="true" />
    </button>
  );
}
