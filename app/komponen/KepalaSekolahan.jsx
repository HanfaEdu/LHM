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
 * Susunannya dua tingkat, bukan satu blok teks di samping logo:
 *
 *     [logo]  SD YAUMI FATIMAH KUDUS
 *             Personalized Education
 *     Naira Faida Hanifa
 *     Kelas 3 · Wali Kelas: ...
 *
 * Logo hanya menyandingi dua baris identitas sekolah, sementara nama anak
 * dan keterangannya turun ke tepi kiri kartu. Sebelumnya keempat baris
 * dijejerkan di samping logo, sehingga di layar HP nama anak terdorong ke
 * lajur sempit dan patah menjadi beberapa baris -- padahal nama itulah
 * yang paling dulu perlu terbaca.
 *
 * `judul`, `keterangan`, dan `anak` semuanya opsional supaya komponen ini
 * tetap bisa dipakai di halaman yang belum punya konteks.
 */
export default function KepalaSekolahan({ judul, keterangan, anak }) {
  return (
    <header className={gaya.kepala}>
      <div className={gaya.identitas}>
        <div className={gaya.merek}>
          <Image
            src="/logo.png"
            alt=""
            width={44}
            height={44}
            className={gaya.logo}
            priority
          />
          <div>
            <p className={gaya.namaSekolah}>SD Yaumi Fatimah Kudus</p>
            {/* Tagline sekolah. Ditulis miring dengan warna emas tua supaya
                terbaca sebagai kalimat identitas, bukan sebagai label data --
                sekaligus tetap tunduk pada hierarki: nama anak di bawahnya
                yang harus lebih dulu tertangkap mata. */}
            <p className={gaya.tagline}>Personalized Education</p>
          </div>
        </div>

        {judul && <h1 className={gaya.judul}>{judul}</h1>}
        {keterangan && <p className={gaya.keterangan}>{keterangan}</p>}
      </div>
      {anak && <div className={gaya.aksi}>{anak}</div>}
    </header>
  );
}
