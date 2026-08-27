'use client';

import { useEffect, useState } from 'react';
import { Share, Smartphone, X } from 'lucide-react';
import gaya from './tombol-pasang.module.css';

/**
 * Ajakan memasang halaman ini sebagai aplikasi di layar utama.
 *
 * Android sebenarnya memunculkan ajakannya sendiri, tetapi lewat menu
 * titik tiga peramban -- tempat yang praktis tidak pernah dibuka orang
 * tua. Karena itu ajakannya dimunculkan di halaman, di tempat yang
 * memang sedang dilihat.
 *
 * iPhone tidak punya ajakan otomatis sama sekali: Safari hanya
 * menyediakan "Tambah ke Layar Utama" di dalam menu Bagikan, dan tidak
 * ada satu pun cara bagi halaman untuk memanggilnya. Yang bisa
 * dilakukan hanya menunjukkan jalannya, dan itulah yang dilakukan di
 * sini.
 *
 * Tidak pernah muncul kalau:
 *   - aplikasinya sudah terpasang (halaman berjalan mode standalone),
 *   - peramban tidak menawarkan pemasangan sama sekali,
 *   - pembacanya sudah menutup ajakan ini sebelumnya.
 */
export default function TombolPasang({ nama }) {
  const [siap, setSiap] = useState(null); // event beforeinstallprompt
  const [iOS, setIOS] = useState(false);
  const [tampil, setTampil] = useState(false);

  const kunciTutup = 'pasang:ditutup';

  useEffect(() => {
    // Sudah terpasang -- tidak ada yang perlu ditawarkan.
    const terpasang =
      window.matchMedia?.('(display-mode: standalone)').matches ||
      window.navigator.standalone === true;
    if (terpasang) return;

    let ditutup = false;
    try {
      ditutup = localStorage.getItem(kunciTutup) === 'ya';
    } catch {
      // Peramban yang memblokir penyimpanan: ajakan tetap ditampilkan.
      // Lebih baik muncul dua kali daripada tidak pernah muncul.
    }
    if (ditutup) return;

    // iPadOS menyamar sebagai Mac sejak iOS 13, jadi layar sentuh ikut
    // diperiksa -- bukan hanya nama perangkatnya.
    const apple =
      /iphone|ipad|ipod/i.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const safari = /^((?!chrome|android|crios|fxios).)*safari/i.test(
      navigator.userAgent
    );

    if (apple && safari) {
      setIOS(true);
      setTampil(true);
      return;
    }

    const tangkap = (e) => {
      // Ajakan bawaan peramban ditahan supaya tidak muncul dua kali;
      // event-nya disimpan untuk dipanggil saat tombol di bawah ditekan.
      e.preventDefault();
      setSiap(e);
      setTampil(true);
    };
    const sudah = () => setTampil(false);

    window.addEventListener('beforeinstallprompt', tangkap);
    window.addEventListener('appinstalled', sudah);
    return () => {
      window.removeEventListener('beforeinstallprompt', tangkap);
      window.removeEventListener('appinstalled', sudah);
    };
  }, []);

  if (!tampil) return null;

  const tutup = () => {
    setTampil(false);
    try {
      localStorage.setItem(kunciTutup, 'ya');
    } catch {
      // Tidak bisa diingat: ajakan akan muncul lagi lain kali. Tidak apa.
    }
  };

  const pasang = async () => {
    if (!siap) return;
    siap.prompt();
    await siap.userChoice;
    setSiap(null);
    setTampil(false);
  };

  return (
    <div className={gaya.ajakan}>
      <Smartphone className={gaya.ikon} size={20} aria-hidden="true" />

      <div className={gaya.teks}>
        <p className={gaya.judul}>Pasang di layar utama</p>
        <p className={gaya.keterangan}>
          {iOS ? (
            <>
              Ketuk <Share size={14} className={gaya.ikonSebaris} aria-hidden="true" />{' '}
              <strong>Bagikan</strong> di bawah, lalu pilih{' '}
              <strong>Tambah ke Layar Utama</strong>.
            </>
          ) : nama ? (
            <>
              Buka rapor {nama} langsung dari ikonnya, tanpa mencari tautannya
              lagi di WhatsApp.
            </>
          ) : (
            <>Buka dasbor langsung dari ikonnya, tanpa membuka peramban dulu.</>
          )}
        </p>
      </div>

      {!iOS && (
        <button type="button" className={gaya.tombol} onClick={pasang}>
          Pasang
        </button>
      )}

      <button
        type="button"
        className={gaya.tutup}
        onClick={tutup}
        aria-label="Tutup ajakan pasang aplikasi"
        title="Jangan tampilkan lagi"
      >
        <X size={16} aria-hidden="true" />
      </button>
    </div>
  );
}
