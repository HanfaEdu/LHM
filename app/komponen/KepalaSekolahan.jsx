import Image from 'next/image';
import gaya from './kepala-sekolahan.module.css';

/**
 * Identitas sekolah di kepala tiap dasbor.
 *
 * Logo dan nama sekolah dipisahkan ke satu komponen supaya ketiga dasbor
 * (orang tua, wali kelas, kepala sekolah) tidak masing-masing punya versi
 * yang lambat laun berbeda. Ini juga yang meyakinkan orang tua bahwa
 * tautan WhatsApp yang mereka klik benar milik sekolah, bukan halaman
 * asing -- satu-satunya penanda yang mereka punya sebelum melihat nama
 * anaknya.
 *
 * `judul` dan `anak` mengisi baris di bawah nama sekolah; keduanya
 * opsional supaya komponen ini tetap bisa dipakai di halaman yang belum
 * punya konteks (mis. layar login).
 */
export default function KepalaSekolahan({ judul, keterangan, anak }) {
  return (
    <header className={gaya.kepala}>
      <div className={gaya.identitas}>
        <Image
          src="/logo.png"
          alt=""
          width={48}
          height={48}
          className={gaya.logo}
          priority
        />
        <div className={gaya.teks}>
          <p className={gaya.namaSekolah}>SD Yaumi Fatimah Kudus</p>
          {judul && <h1 className={gaya.judul}>{judul}</h1>}
          {keterangan && <p className={gaya.keterangan}>{keterangan}</p>}
        </div>
      </div>
      {anak && <div className={gaya.aksi}>{anak}</div>}
    </header>
  );
}
