'use client';

import { useEffect } from 'react';

/**
 * Mendaftarkan service worker. Tidak menggambar apa pun.
 *
 * Dipasang di tata letak akar supaya berlaku untuk ketiga dasbor
 * sekaligus: satu service worker melayani seluruh situs, sementara yang
 * membedakan aplikasi satu dari yang lain adalah manifestnya, bukan
 * service workernya.
 *
 * Pendaftaran sengaja ditunda sampai halaman selesai dimuat. Kalau
 * didaftarkan seketika, peramban mengunduh sw.js bersamaan dengan berkas
 * yang dibutuhkan halaman untuk tampil -- pada jaringan seluler lambat,
 * itu berarti rapornya sendiri muncul lebih lama demi sesuatu yang baru
 * berguna pada kunjungan berikutnya.
 */
export default function PendaftarSW() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const daftarkan = () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // Kegagalan pendaftaran tidak boleh mengganggu apa pun: tanpa
        // service worker, aplikasi tetap berjalan seperti situs biasa.
        // Yang hilang hanya kemampuan dibuka tanpa koneksi.
      });
    };

    if (document.readyState === 'complete') {
      daftarkan();
    } else {
      window.addEventListener('load', daftarkan, { once: true });
      return () => window.removeEventListener('load', daftarkan);
    }
  }, []);

  return null;
}
