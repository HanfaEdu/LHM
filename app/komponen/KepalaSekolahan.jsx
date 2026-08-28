import Image from 'next/image';
import { SEKOLAH_BAWAAN } from '@/lib/sekolah';
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
 *     [logo]  SD YAUMI FATIMAH KUDUS        [Input/Edit LHM]
 *             Personalized Education                     [keluar]
 *     Naira Faida Hanifa
 *     Kelas 3 · Wali Kelas: ...                  Kelas ▾   Bulan ▾
 *
 * Logo hanya menyandingi dua baris identitas sekolah, sementara nama anak
 * dan keterangannya turun ke tepi kiri kartu. Sebelumnya keempat baris
 * dijejerkan di samping logo, sehingga di layar HP nama anak terdorong ke
 * lajur sempit dan patah menjadi beberapa baris -- padahal nama itulah
 * yang paling dulu perlu terbaca.
 *
 * Sisi kanan dipisah menjadi DUA zona yang berbeda maknanya, bukan satu
 * baris kontrol bercampur:
 *
 *   `aksi`  tindakan halaman -- pergi ke tempat lain, keluar akun.
 *           Ditaruh di pojok kanan ATAS, tempat baku bagi tindakan yang
 *           berlaku untuk seluruh halaman.
 *   `anak`  penyaring isi -- pemilih kelas, bulan, tahun ajaran.
 *           Ditaruh di bawah zona aksi.
 *
 * Urutannya penting, bukan sekadar rapi. Sebelumnya keduanya berbaris
 * bersama, dan di layar HP tombol "Input/Edit LHM" jatuh tepat DI BAWAH
 * pemilih bulan -- susunan yang persis sama dengan formulir, sehingga
 * tombolnya terbaca sebagai "terapkan bulan ini", bukan sebagai pintu ke
 * halaman lain. Dengan aksi berada di atas penyaring, salah baca itu
 * tidak mungkin lagi terjadi.
 *
 * `namaSekolah` datang dari tabel `sekolah` di database, bukan ditulis
 * di dalam kode. Itulah yang membuat sekolah baru -- SD Yaumi Fatimah
 * Pati, TK Yaumi Fatimah Juwana, SD BIAS Klaten, apa pun penamaannya --
 * cukup ditambahkan sebagai satu baris data, tanpa satu baris kode pun
 * yang perlu diubah.
 *
 * Nilai cadangannya nama sekolah pertama, supaya kepala halaman tidak
 * pernah tampil kosong: pada saat migrasi multi-sekolah belum
 * dijalankan, atau ketika data sekolah gagal terbaca, yang tampil tetap
 * nama yang benar bagi satu-satunya sekolah yang ada.
 *
 * `judul`, `keterangan`, `aksi`, dan `anak` semuanya opsional supaya
 * komponen ini tetap bisa dipakai di halaman yang belum punya konteks.
 */
export default function KepalaSekolahan({
  namaSekolah,
  judul,
  keterangan,
  aksi,
  anak,
}) {
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
            <p className={gaya.namaSekolah}>{namaSekolah || SEKOLAH_BAWAAN}</p>
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
      {(aksi || anak) && (
        <div className={gaya.kanan}>
          {aksi && <div className={gaya.aksiUtama}>{aksi}</div>}
          {anak && <div className={gaya.aksi}>{anak}</div>}
        </div>
      )}
    </header>
  );
}
