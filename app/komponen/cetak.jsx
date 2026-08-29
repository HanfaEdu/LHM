'use client';

import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';

/**
 * Mesin cetak yang dipakai bersama rapor orang tua dan dasbor staf.
 *
 * Sebelumnya seluruh isi berkas ini hidup di dalam app/rapor/[token]/page.jsx
 * saja. Ketika dasbor wali kelas dan kepala sekolah ikut butuh simpan-PDF,
 * menyalinnya menjadi tiga salinan berarti tiga tempat yang harus ikut
 * diperbaiki setiap kali ditemukan satu lagi keanehan peramban -- dan
 * keanehan itu banyak, seperti terbaca di bawah. Jadi disatukan di sini.
 *
 * Yang TIDAK ada di sini: ukuran grafik cetak. Tiap halaman punya lebar
 * isinya sendiri (rapor punya kartu bertepi lebar, dasbor lebih rapat),
 * jadi angkanya dioper oleh pemanggil lewat useUkuranGrafik().
 */

/* Menyala hanya selagi halaman sedang disiapkan untuk dipotret peramban. */
export const KonteksCetak = createContext(false);

/**
 * Ukuran yang harus dipakai ResponsiveContainer milik Recharts.
 *
 * Recharts mengukur lebar induknya SEKALI lalu mematoknya di dalam atribut
 * width SVG. Pengukuran itu terjadi di layar, dan tidak pernah diulang saat
 * peramban berpindah ke media cetak -- sehingga grafik yang di layar HP
 * selebar 390px tetap tercetak 390px di tengah kertas A4, dengan dua
 * pertiga kertas dibiarkan kosong di sebelahnya.
 *
 * Satu-satunya jalan keluar adalah memberi tahu angkanya secara eksplisit
 * sebelum halaman dipotret; itulah yang dilakukan konteks ini.
 *
 * `cetak` di dalam hasilnya WAJIB dipakai untuk mematikan animasi tiap
 * seri (isAnimationActive={!ukuran.cetak}). Alasannya bukan penghematan:
 * Recharts MENGANIMASIKAN batangnya dari ukuran lama ke ukuran baru
 * setiap kali grafik berganti ukuran, sementara peramban memotret
 * halaman dalam bingkai yang sama begitu penangan beforeprint selesai.
 * Yang terpotret adalah bingkai PERTAMA animasi itu: sumbu sudah memakai
 * tinggi kertas, sedangkan batangnya masih setinggi ukuran layar --
 * sehingga batang menembus garis dasar dan menimpa nama siswa di
 * bawahnya. Tidak ada galat apa pun yang muncul; kerusakannya hanya
 * terlihat di PDF yang sudah terlanjur dicetak.
 */
export function useUkuranGrafik(lebarCetak, tinggiCetak) {
  const sedangDicetak = useContext(KonteksCetak);
  return sedangDicetak
    ? { width: lebarCetak, height: tinggiCetak, cetak: true }
    : { width: '100%', height: '100%', cetak: false };
}

/**
 * Menyiapkan halaman untuk dicetak, dan mengembalikannya sesudahnya.
 *
 * Mengembalikan { modeCetak, cetak }:
 *   modeCetak  -- disalurkan ke <KonteksCetak.Provider value={...}>
 *   cetak()    -- dipasang pada tombol "Simpan PDF"
 *
 * Dua jalan menuju cetak ditangani sekaligus, dan keduanya punya jebakan
 * sendiri:
 *
 *   Ctrl+P / menu peramban -> beforeprint. Peramban memotret halaman
 *   SEGERA setelah penanganya selesai, sementara render React yang biasa
 *   baru dikerjakan setelah itu. Karena itu flushSync, bukan setState
 *   biasa -- tanpanya, grafik pada jalur ini tetap tercetak selebar layar.
 *
 *   Tombol di halaman -> cetak(). Di HP, window.print() kembali seketika
 *   sementara pratinjaunya baru disiapkan belakangan, jadi dua penggambaran
 *   ditunggu lebih dulu. Menunggu satu frame saja belum cukup pada
 *   perangkat lambat.
 *
 * Pengembalian keadaan TIDAK memakai pewaktu. Pewaktu bisa habis selagi
 * pratinjau masih disiapkan, menutup kembali lipatan yang baru dibuka, dan
 * justru menghapus isinya dari PDF yang dihasilkan -- persis masalah yang
 * hendak diperbaiki. Yang dipakai kembalinya fokus ke halaman, karena di
 * HP pratinjau cetak adalah layar tersendiri dan afterprint sering tidak
 * pernah terpicu sama sekali.
 */
export function usePersiapanCetak() {
  const [modeCetak, setModeCetak] = useState(false);
  const sedangCetak = useRef(false);

  const siapkan = () => {
    sedangCetak.current = true;
    flushSync(() => setModeCetak(true));
    // Lipatan dibuka supaya isinya ikut terpotret. Yang memang tidak
    // dikehendaki di atas kertas disembunyikan lewat CSS cetak masing-
    // masing halaman, bukan dengan membiarkannya tertutup di sini.
    document.querySelectorAll('details:not([open])').forEach((d) => {
      d.dataset.dibukaUntukCetak = 'ya';
      d.open = true;
    });
  };

  const kembalikan = () => {
    document.querySelectorAll('details[data-dibuka-untuk-cetak]').forEach((d) => {
      d.open = false;
      delete d.dataset.dibukaUntukCetak;
    });
    setModeCetak(false);
    sedangCetak.current = false;
  };

  useEffect(() => {
    const sebelum = () => siapkan();

    const saatKembali = () => {
      if (sedangCetak.current && document.visibilityState === 'visible') {
        kembalikan();
      }
    };

    window.addEventListener('beforeprint', sebelum);
    window.addEventListener('afterprint', kembalikan);
    window.addEventListener('focus', saatKembali);
    document.addEventListener('visibilitychange', saatKembali);

    return () => {
      window.removeEventListener('beforeprint', sebelum);
      window.removeEventListener('afterprint', kembalikan);
      window.removeEventListener('focus', saatKembali);
      document.removeEventListener('visibilitychange', saatKembali);
    };
    // Pendengar sengaja didaftarkan sekali saja; fungsi di dalamnya hanya
    // menyentuh DOM, ref, dan penyetel state -- semuanya tidak berubah
    // perilakunya antar-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cetak = () => {
    siapkan();
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        try {
          window.print();
        } catch {
          // Peramban yang menolak print() tidak boleh meninggalkan halaman
          // dalam keadaan setengah disiapkan.
          kembalikan();
        }
      });
    });
  };

  return { modeCetak, cetak };
}
