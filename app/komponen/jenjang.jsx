'use client';

import { createContext, useContext } from 'react';
import { mapelUntuk } from '@/lib/statistik';

/**
 * Jenjang sekolah yang sedang dilihat (PG, TK, SD, SMP, SMA).
 *
 * Dipakai untuk menentukan mata pelajaran mana yang ditampilkan: Playgroup
 * tidak menilai IPA sama sekali, jadi meteran, grafik, dan kolom tabelnya
 * tidak boleh ikut muncul di sana. Aturannya sendiri ada di mapelUntuk()
 * pada lib/statistik.js.
 *
 * Memakai konteks, bukan properti yang dioper turun, karena daftar mapel
 * dibutuhkan oleh enam komponen yang tersebar dua sampai tiga tingkat di
 * bawah halaman -- mengoperkannya berarti menambah properti yang sama pada
 * belasan tempat, dan satu saja yang terlewat menghasilkan satu grafik yang
 * diam-diam masih menampilkan IPA.
 *
 * PERINGATAN yang sudah terbukti mahal sekali di berkas ini: komponen yang
 * MEMASANG <Provider> tidak bisa ikut membaca konteksnya sendiri -- ia
 * hanya akan menerima nilai bawaan. Jadi halaman dasbor menghitung daftar
 * mapelnya sendiri lewat mapelUntuk(sekolah?.jenjang), dan useMapel() di
 * bawah ini hanya dipakai oleh komponen yang berada DI DALAM Provider.
 */
export const KonteksJenjang = createContext(null);

/** Daftar mapel yang berlaku untuk jenjang yang sedang dilihat. */
export function useMapel() {
  return mapelUntuk(useContext(KonteksJenjang));
}

/** True kalau mapel ini dinilai pada jenjang yang sedang dilihat. */
export function usePakaiMapel(kunci) {
  return useMapel().some((m) => m.kunci === kunci);
}
