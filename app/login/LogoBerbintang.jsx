import Image from 'next/image';
import gaya from './bintang.module.css';

/**
 * Logo sekolah dengan butiran bintang yang memancar dari belakangnya.
 *
 * Posisi tiap butir dibangkitkan sekali di tingkat modul memakai
 * pembangkit acak bersemai (bukan Math.random), karena komponen ini
 * dirender di server maupun di browser: Math.random akan menghasilkan
 * angka berbeda di kedua sisi dan React melaporkannya sebagai
 * ketidakcocokan hidrasi. Bersemai berarti "acak tapi sama di kedua
 * sisi" — cukup untuk mata, tenang bagi React.
 */

/** Pembangkit acak bersemai (mulberry32) — deterministik, 32-bit. */
function pembangkit(semai) {
  return function () {
    semai = (semai + 0x6d2b79f5) | 0;
    let t = semai;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Dua warna dari palet SiPaDi supaya bintangnya terasa satu keluarga
// dengan tombol dan judulnya, bukan hiasan yang ditempel dari luar.
const WARNA = ['rgba(0, 245, 212, 0.9)', 'rgba(0, 180, 216, 0.85)', 'rgba(255, 255, 255, 0.75)'];

const JUMLAH = 26;

const BINTANG = (() => {
  const acak = pembangkit(20260824);
  return Array.from({ length: JUMLAH }, () => {
    // Arah sebaran merata ke segala penjuru; jarak diberi batas bawah
    // supaya tidak ada butir yang hanya bergetar di tempat.
    const sudut = acak() * Math.PI * 2;
    const jarak = 78 + acak() * 62;

    return {
      dx: `${Math.cos(sudut) * jarak}px`,
      dy: `${Math.sin(sudut) * jarak}px`,
      // Dinaikkan 75% dari ukuran semula (2-4.6px) atas permintaan
      // pengguna: pada layar padat piksel, butiran sekecil itu nyaris
      // tidak terlihat.
      ukuran: `${3.5 + acak() * 4.55}px`,
      durasi: `${4.5 + acak() * 4}s`,
      // Jeda disebar sepanjang durasi supaya butir tidak berangkat
      // serentak dan terbaca sebagai ledakan berulang.
      jeda: `${acak() * 8}s`,
      terang: (0.45 + acak() * 0.5).toFixed(2),
      warna: WARNA[Math.floor(acak() * WARNA.length)],
    };
  });
})();

export default function LogoBerbintang() {
  return (
    <div className={gaya.panggung}>
      <div className={gaya.langit} aria-hidden="true">
        {BINTANG.map((b, i) => (
          <span
            key={i}
            className={gaya.bintang}
            style={{
              '--dx': b.dx,
              '--dy': b.dy,
              '--ukuran': b.ukuran,
              '--durasi': b.durasi,
              '--jeda': b.jeda,
              '--terang': b.terang,
              '--warna': b.warna,
            }}
          />
        ))}
      </div>
      <Image
        src="/logo.png"
        alt="Logo Sekolah BIAS"
        width={96}
        height={96}
        className={gaya.logo}
        priority
      />
    </div>
  );
}
