'use client';

import { createContext, useContext } from 'react';
import { mapelSkor, mapelUntuk } from '@/lib/statistik';
import { poinUntuk } from '@/lib/poin';

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

/** Mapel bernilai 0-100 saja (kosong di PG) -- grafik, sebaran, rata-rata. */
export function useMapelSkor() {
  return mapelSkor(useMapel());
}

/** Jenjang yang sedang dilihat, untuk memilih peta nama poin (lib/poin.js). */
export function useJenjang() {
  return useContext(KonteksJenjang);
}

/** Ukuran berbentuk poin pada jenjang ini: Tahfidz, Tahsin, dan di PG
    juga B. Indonesia & Matematika. */
export function usePoin() {
  return poinUntuk(useContext(KonteksJenjang));
}
