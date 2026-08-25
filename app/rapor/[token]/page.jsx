'use client';

import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { BULAN_AJARAN, TAHFIDZ_MAPPING, TAHSIN_MAPPING, getQuranLevelName } from '@/quran_mapping';
import { bulanBerdata } from '@/lib/statistik';
import { Printer } from 'lucide-react';
import KepalaSekolahan from '@/app/komponen/KepalaSekolahan';
import LegendaGrafik from '@/app/komponen/LegendaGrafik';
import gaya from './rapor.module.css';

const WARNA = {
  bIndo: 'var(--seri-1)',
  mtk: 'var(--seri-2)',
  ipa: 'var(--seri-3)',
  target: 'var(--target)',
  tahfidz: 'var(--seri-1)',
  tahsin: 'var(--seri-3)',
};

/* ================================================================
   Ukuran grafik saat dicetak
   ================================================================
   Recharts menggambar SVG dengan lebar tetap dalam piksel, hasil
   pengukuran wadahnya saat halaman tampil di layar. Ukuran itu tidak
   pernah diukur ulang ketika halaman dicetak. Akibatnya grafik yang
   lahir di layar HP selebar 390px tetap digambar 390px di atas kertas
   yang bidang isinya sekitar 700px -- separuh halaman kosong di sebelah
   kanan tiap grafik, dan rapor dua bulan data membengkak jadi delapan
   halaman.

   Karena itu lebarnya diambil alih: selama proses cetak berlangsung,
   grafik digambar ulang pada lebar kertas, bukan lebar layar. Nilainya
   dipatok aman di dalam bidang isi A4 (186mm ~ 703px pada 96dpi) yang
   dikunci lewat .wadah di rapor.module.css -- kalau margin @page di
   sana diubah, angka ini perlu ikut disesuaikan.

   Konteks dipakai, bukan properti yang dioper turun, karena grafik
   terdalam ("Capaian Kelas") berada dua tingkat di bawah halaman dan
   jalur operannya hanya akan melewati komponen yang tidak
   berkepentingan sama sekali dengan urusan cetak. */
const LEBAR_GRAFIK_CETAK = 696;
const TINGGI_GRAFIK_CETAK = 300;

const KonteksCetak = createContext(false);

function useUkuranGrafik() {
  const sedangDicetak = useContext(KonteksCetak);
  return sedangDicetak
    ? { width: LEBAR_GRAFIK_CETAK, height: TINGGI_GRAFIK_CETAK }
    : { width: '100%', height: '100%' };
}

export default function HalamanRapor({ params }) {
  // Next.js 14: params adalah objek biasa, bukan Promise.
  const token = params.token;

  const [pin, setPin] = useState('');
  const [butuhPin, setButuhPin] = useState(false);
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState('');
  const [data, setData] = useState(null);
  const [tahunAjaran, setTahunAjaran] = useState('');

  /* Menyala hanya selagi halaman disiapkan untuk dicetak; dipakai grafik
     lewat KonteksCetak untuk menggambar diri pada lebar kertas. */
  const [modeCetak, setModeCetak] = useState(false);

  /* Tanggal cetak diisi setelah komponen terpasang, bukan saat render.
     new Date() di badan render menghasilkan nilai yang berbeda antara
     server dan peramban, dan React menolak hasil render yang tidak
     cocok itu. */
  const [tanggalCetak, setTanggalCetak] = useState('');

  useEffect(() => {
    setTanggalCetak(
      new Intl.DateTimeFormat('id-ID', { dateStyle: 'long' }).format(new Date())
    );
  }, []);

  async function ambilData(pinDipakai, tahun) {
    setMemuat(true);
    setGalat('');
    try {
      const respons = await fetch('/api/rapor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, pin: pinDipakai, tahunAjaran: tahun }),
      });
      const isi = await respons.json();

      if (isi.butuhPin) {
        setButuhPin(true);
        return;
      }
      if (!respons.ok) {
        setGalat(isi.error || 'Data tidak dapat dimuat.');
        return;
      }
      setData(isi);
      setTahunAjaran(isi.kelas.tahun_ajaran);
      setButuhPin(false);
    } catch {
      setGalat('Tidak dapat terhubung ke server. Periksa koneksi internet.');
    } finally {
      setMemuat(false);
    }
  }

  useEffect(() => {
    ambilData(undefined, undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  /**
   * Membuka seluruh lipatan sebelum dicetak, lalu menutupnya kembali.
   *
   * CSS saja tidak cukup: isi <details> yang tertutup disembunyikan
   * peramban lewat mekanisme internalnya sendiri, bukan sekadar
   * display:none yang bisa ditimpa aturan @media print. Akibatnya
   * keterangan poin Tahfidz/Tahsin tidak ikut tercetak sama sekali --
   * padahal justru di atas kertas pembacanya tidak bisa membukanya
   * sendiri, dan tanpa daftar itu angka pada grafik tidak bisa
   * diterjemahkan.
   */
  const sedangCetak = useRef(false);

  const bukaLipatan = () => {
    document.querySelectorAll('details:not([open])').forEach((d) => {
      d.dataset.dibukaUntukCetak = 'ya';
      d.open = true;
    });
  };

  /**
   * Menyiapkan halaman untuk dipotret peramban: lipatan dibuka dan grafik
   * digambar ulang pada lebar kertas.
   *
   * flushSync dipakai, bukan setState biasa, karena jalur Ctrl+P memanggil
   * ini dari dalam beforeprint -- peramban memotret halaman segera setelah
   * penanganya selesai, sementara render React yang biasa baru dikerjakan
   * setelahnya. Tanpa flushSync, grafik pada jalur itu tetap tercetak
   * selebar layar.
   */
  const siapkanCetak = () => {
    sedangCetak.current = true;
    flushSync(() => setModeCetak(true));
    bukaLipatan();
  };

  const kembalikanLipatan = () => {
    document.querySelectorAll('details[data-dibuka-untuk-cetak]').forEach((d) => {
      d.open = false;
      delete d.dataset.dibukaUntukCetak;
    });
    setModeCetak(false);
    sedangCetak.current = false;
  };

  useEffect(() => {
    const sebelum = () => {
      siapkanCetak();
    };

    /**
     * Di HP, pratinjau cetak adalah layar tersendiri dan afterprint sering
     * tidak pernah terpicu. Kembalinya fokus ke halaman adalah tanda yang
     * jauh lebih bisa diandalkan bahwa pratinjaunya sudah ditutup -- entah
     * karena dicetak, dibatalkan, atau tertutup tanpa sengaja.
     */
    const saatKembali = () => {
      if (sedangCetak.current && document.visibilityState === 'visible') {
        kembalikanLipatan();
      }
    };

    window.addEventListener('beforeprint', sebelum);
    window.addEventListener('afterprint', kembalikanLipatan);
    window.addEventListener('focus', saatKembali);
    document.addEventListener('visibilitychange', saatKembali);

    return () => {
      window.removeEventListener('beforeprint', sebelum);
      window.removeEventListener('afterprint', kembalikanLipatan);
      window.removeEventListener('focus', saatKembali);
      document.removeEventListener('visibilitychange', saatKembali);
    };
    // Pendengar sengaja didaftarkan sekali saja; fungsi di dalamnya hanya
    // menyentuh DOM, ref, dan penyetel state -- semuanya tidak berubah
    // perilakunya antar-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Sebagian peramban HP tidak memicu beforeprint saat mencetak lewat menu
   * bagikan, jadi lipatannya dibuka langsung di sini.
   *
   * Dua penggambaran ditunggu sebelum window.print(): di HP, print()
   * kembali seketika sementara pratinjaunya disiapkan belakangan, sehingga
   * lipatan yang baru saja dibuka belum tentu sudah tergambar saat halaman
   * dipotret. Menunggu satu frame saja belum cukup pada perangkat lambat.
   *
   * Pengembalian lipatan TIDAK lagi memakai pewaktu. Pewaktu bisa habis
   * selagi pratinjau masih disiapkan, menutup lipatannya kembali, dan
   * justru menghapus keterangan poin dari PDF yang dihasilkan -- persis
   * masalah yang hendak diperbaiki. Sekarang menunggu fokus kembali ke
   * halaman.
   */
  function cetak() {
    siapkanCetak();

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        try {
          window.print();
        } catch {
          // Peramban yang menolak print() tidak boleh meninggalkan
          // lipatan dalam keadaan terbuka.
          kembalikanLipatan();
        }
      });
    });
  }

  if (butuhPin && !data) {
    return (
      <div className={gaya.halaman}>
        <form
          className={gaya.gerbang}
          onSubmit={(e) => {
            e.preventDefault();
            ambilData(pin, undefined);
          }}
        >
          <h1 className={gaya.namaAnak}>Rapor Digital</h1>
          <p className={gaya.subJudul}>
            Masukkan 6 digit terakhir nomor WhatsApp yang terdaftar di sekolah.
          </p>
          <input
            type="tel"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
            placeholder="······"
            aria-label="PIN"
          />
          <button className={gaya.tombol} disabled={pin.length < 4 || memuat}>
            {memuat ? 'Memeriksa…' : 'Buka Rapor'}
          </button>
          {galat && <p className={gaya.galat}>{galat}</p>}
        </form>
      </div>
    );
  }

  if (memuat && !data) {
    return (
      <div className={gaya.halaman}>
        <p className={gaya.subJudul} style={{ textAlign: 'center', marginTop: '4rem' }}>
          Memuat data…
        </p>
      </div>
    );
  }

  if (galat && !data) {
    return (
      <div className={gaya.halaman}>
        <div className={gaya.gerbang}>
          <p className={gaya.galat}>{galat}</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const tahunTampil = tahunAjaran || data.kelas.tahun_ajaran;

  return (
    <KonteksCetak.Provider value={modeCetak}>
    <div className={gaya.halaman}>
      <div className={gaya.wadah}>
        <KepalaSekolahan
          judul={data.anak.nama_lengkap}
          keterangan={`Kelas ${data.kelas.nama_kelas}${
            data.kelas.wali_kelas ? ` · Wali Kelas: ${data.kelas.wali_kelas}` : ''
          }`}
          anak={
            <>
              {/* Tahun ajaran selalu ditampilkan, bukan hanya saat sudah ada
                  lebih dari satu. Tanpa ini, orang tua di tahun pertama tidak
                  punya petunjuk data yang dilihatnya itu tahun yang mana --
                  dan begitu tahun kedua berjalan, kolom ini berubah sendiri
                  menjadi pilihan untuk menengok tahun-tahun sebelumnya. */}
              <div className={gaya.tahunAjaran}>
              <span className={gaya.labelTahun}>Tahun Ajaran</span>
              {data.tahunAjaranTersedia.length > 1 ? (
                <select
                  className={gaya.pilih}
                  value={tahunAjaran}
                  aria-label="Pilih tahun ajaran"
                  onChange={(e) => ambilData(pin || undefined, e.target.value)}
                >
                  {data.tahunAjaranTersedia.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              ) : (
                <span className={gaya.nilaiTahun}>{data.kelas.tahun_ajaran}</span>
              )}
              {/* Dropdown-nya sendiri disembunyikan saat dicetak karena
                  tidak bisa diklik di atas kertas. Tanpa baris pengganti
                  ini, label "TAHUN AJARAN" tercetak tanpa tahunnya pada
                  rapor siswa yang sudah punya lebih dari satu tahun
                  data. */}
              {data.tahunAjaranTersedia.length > 1 && (
                <span className={gaya.judulCetak}>{tahunTampil}</span>
              )}
              </div>

              {/* Tombol cetak dijadikan saudara sejajar tahun ajaran, bukan
                  ditumpuk di bawahnya. Ditumpuk, keduanya terbaca sebagai
                  satu kelompok -- seolah tombolnya bagian dari pemilih tahun
                  -- padahal fungsinya tidak berhubungan sama sekali.

                  window.print() dipakai apa adanya, bukan pustaka pengubah
                  halaman menjadi gambar: dialog cetak bawaan browser sudah
                  menyediakan "Simpan sebagai PDF" di HP maupun komputer,
                  hasilnya berupa teks yang bisa dicari dan grafik yang tetap
                  tajam saat diperbesar, dan tidak ada satu byte pun tambahan
                  yang perlu diunduh orang tua. Kerapiannya diatur seluruhnya
                  lewat @media print di rapor.module.css. */}
              <button
                type="button"
                className={gaya.tombolCetak}
                onClick={cetak}
              >
                <Printer size={16} aria-hidden="true" />
                Simpan PDF
              </button>
            </>
          }
        />

        <GrafikAkademik bulanan={data.bulanan} target={data.kelas.target_akademik} />

        <div className={gaya.tumpuk}>
          <GrafikQuran
            jenis="tahfidz"
            judul="Capaian Tahfidz"
            bulanan={data.bulanan}
            warna={WARNA.tahfidz}
          />
          <GrafikQuran
            jenis="tahsin"
            judul="Capaian Tahsin"
            bulanan={data.bulanan}
            warna={WARNA.tahsin}
          />
        </div>

        {/* Posisi di kelas naik ke atas tabel: inilah yang dicari orang tua
            tiap bulan. Tabel dua belas bulan ditaruh paling bawah karena di
            awal tahun ajaran hampir seluruh barisnya masih "-", dan
            menempatkannya di tengah memaksa menggulir jauh hanya untuk
            melewati sebelas baris kosong. */}
        <PerbandinganKelas
          perbandingan={data.perbandingan}
          namaAnak={data.anak.nama_panggilan}
          namaKelas={data.kelas.nama_kelas}
          targetAkademik={data.kelas.target_akademik}
        />

        <TabelBulanan bulanan={data.bulanan} />
      </div>

      {/* Identitas di kaki tiap halaman cetakan. Rapor ini keluar sebagai
          berkas beberapa halaman; tanpa penanda, halaman kedua dan
          seterusnya hanya berisi grafik tanpa satu pun keterangan milik
          siapa -- masalah nyata begitu lembarnya tercetak dan tercampur
          dengan rapor anak lain. Disembunyikan sepenuhnya di layar. */}
      <footer className={gaya.kakiCetak} aria-hidden="true">
        <span>
          {data.anak.nama_lengkap} · Kelas {data.kelas.nama_kelas}
          {tahunTampil ? ` · T.A. ${tahunTampil}` : ''}
        </span>
        <span>
          SD Yaumi Fatimah Kudus
          {tanggalCetak ? ` · dicetak ${tanggalCetak}` : ''}
        </span>
      </footer>
    </div>
    </KonteksCetak.Provider>
  );
}

/* ================================================================
   Grafik akademik — tiga mapel sepanjang tahun ajaran
   ================================================================ */
function GrafikAkademik({ bulanan, target }) {
  const ukuranGrafik = useUkuranGrafik();
  const adaIsi = bulanan.some(
    (b) => b.rata_b_indo !== null || b.rata_mtk !== null || b.rata_ipa !== null
  );

  return (
    <section className={gaya.kartu}>
      <h2 className={gaya.judulKartu}>Capaian Akademik</h2>

      {adaIsi ? (
        <div className={gaya.grafik}>
          <ResponsiveContainer {...ukuranGrafik}>
            <LineChart data={bulanan} margin={{ top: 8, right: 16, bottom: 8, left: -8 }}>
              <CartesianGrid stroke="var(--garis)" vertical={false} />
              <XAxis
                dataKey="bulan"
                tick={{ fontSize: 11, fill: 'var(--tinta-lembut)' }}
                tickLine={false}
                axisLine={{ stroke: 'var(--garis)' }}
                interval={0}
                angle={-35}
                textAnchor="end"
                height={60}
              />
              <YAxis
                domain={[0, 125]}
                ticks={[0, 25, 50, 75, 100, 125]}
                tick={{ fontSize: 11, fill: 'var(--tinta-lembut)' }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                contentStyle={kotakTooltip}
                formatter={(nilai, nama) => [nilai === null ? 'belum dinilai' : nilai, nama]}
              />
              <Legend content={<LegendaGrafik />} />
              {/* Target digambar sebagai seri, bukan ReferenceLine: hanya
                  seri yang muncul di legenda, dan legenda itulah satu-satunya
                  tempat pembaca bisa tahu garis merah putus-putus ini artinya
                  apa setelah keterangan panjangnya dihapus. */}
              <Line
                dataKey="target_akademik"
                name="Target"
                stroke={WARNA.target}
                strokeWidth={2}
                strokeDasharray="6 4"
                dot={false}
                activeDot={false}
                connectNulls
              />
              {/* connectNulls dibiarkan false: bulan tanpa nilai harus memutus
                  garis, bukan disambung seolah-olah nilainya berpindah halus. */}
              <Line
                type="monotone"
                dataKey="rata_b_indo"
                name="B. Indonesia"
                stroke={WARNA.bIndo}
                strokeWidth={2}
                dot={{ r: 4 }}
                connectNulls={false}
              />
              <Line
                type="monotone"
                dataKey="rata_mtk"
                name="Matematika"
                stroke={WARNA.mtk}
                strokeWidth={2}
                dot={{ r: 4 }}
                connectNulls={false}
              />
              <Line
                type="monotone"
                dataKey="rata_ipa"
                name="IPA"
                stroke={WARNA.ipa}
                strokeWidth={2}
                dot={{ r: 4 }}
                connectNulls={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className={gaya.kosong}>Belum ada nilai yang diinput untuk tahun ajaran ini.</p>
      )}

      <p className={gaya.narasi}>{narasiAkademik(bulanan, target)}</p>
    </section>
  );
}

/* ================================================================
   Grafik Tahfidz / Tahsin — batang capaian + titik target
   ================================================================ */
function GrafikQuran({ jenis, judul, bulanan, warna }) {
  const ukuranGrafik = useUkuranGrafik();
  const kolomCapaian = jenis === 'tahfidz' ? 'capaian_tahfidz' : 'capaian_tahsin';
  const kolomTarget = jenis === 'tahfidz' ? 'target_tahfidz' : 'target_tahsin';

  const adaIsi = bulanan.some((b) => b[kolomCapaian] !== null);

  return (
    <section className={gaya.kartu}>
      <h2 className={gaya.judulKartu}>{judul}</h2>
      <p className={gaya.ketKartu}>
        Batang menunjukkan capaian, titik merah menunjukkan target bulan itu.
      </p>

      {adaIsi ? (
        <div className={gaya.grafik}>
          <ResponsiveContainer {...ukuranGrafik}>
            <ComposedChart data={bulanan} margin={{ top: 8, right: 16, bottom: 8, left: -8 }}>
              <CartesianGrid stroke="var(--garis)" vertical={false} />
              <XAxis
                dataKey="bulan"
                tick={{ fontSize: 11, fill: 'var(--tinta-lembut)' }}
                tickLine={false}
                axisLine={{ stroke: 'var(--garis)' }}
                interval={0}
                angle={-35}
                textAnchor="end"
                height={60}
              />
              <YAxis
                tick={{ fontSize: 11, fill: 'var(--tinta-lembut)' }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={kotakTooltip}
                formatter={(nilai, nama) => {
                  if (nilai === null || nilai === undefined) return ['belum dinilai', nama];
                  return [`${nilai} — ${getQuranLevelName(jenis, nilai)}`, nama];
                }}
              />
              <Legend content={<LegendaGrafik bulatanTarget />} />
              <Bar
                dataKey={kolomCapaian}
                name="Capaian"
                fill={warna}
                radius={[4, 4, 0, 0]}
                maxBarSize={34}
              />
              <Line
                dataKey={kolomTarget}
                name="Target"
                stroke={WARNA.target}
                strokeWidth={2}
                strokeDasharray="4 4"
                dot={<TitikTargetBerpendar />}
                activeDot={{ r: 6, fill: WARNA.target, stroke: 'var(--kartu)', strokeWidth: 2 }}
                connectNulls={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className={gaya.kosong}>Belum ada capaian {jenis} yang diinput.</p>
      )}

      <p className={gaya.narasi}>{narasiQuran(jenis, bulanan)}</p>
      <KeteranganQuran jenis={jenis} />
    </section>
  );
}

/**
 * Keterangan poin -> nama surah/materi, tertutup secara bawaan.
 *
 * Grafik di atas hanya menunjukkan angka pada sumbunya -- poin disimpan
 * sebagai angka karena nama materi Tahsin berulang di beberapa bab (Mad
 * Asli ada di bab 7, 8, dan 9), sehingga arahnya tidak bisa dibalik
 * otomatis. Panel ini menerjemahkan angka itu, seperti kolom keterangan
 * di sebelah grafik pada rapor cetak.
 */
function KeteranganQuran({ jenis }) {
  const peta = jenis === 'tahfidz' ? TAHFIDZ_MAPPING : TAHSIN_MAPPING;
  const daftar = Object.entries(peta)
    .map(([poin, nama]) => ({ poin: Number(poin), nama }))
    .sort((a, b) => a.poin - b.poin);

  return (
    <details className={gaya.keterangan}>
      <summary>
        Lihat keterangan seluruh capaian {jenis === 'tahfidz' ? 'Tahfidz' : 'Tahsin'}
      </summary>
      {/* Di atas kertas, kalimat "Lihat keterangan..." tidak masuk akal --
          daftarnya sudah tercetak, tidak ada yang perlu diklik. Judul ini
          menggantikannya saat dicetak; summary-nya sendiri disembunyikan
          lewat @media print. */}
      <p className={gaya.judulCetak}>
        Keterangan capaian {jenis === 'tahfidz' ? 'Tahfidz' : 'Tahsin'}
      </p>
      <ol className={gaya.daftarKeterangan}>
        {daftar.map((d) => (
          <li key={d.poin}>
            <strong>{d.poin}.</strong> {d.nama}
          </li>
        ))}
      </ol>
    </details>
  );
}

/**
 * Titik target dengan lingkaran pendar di belakangnya.
 *
 * Yang berdenyut hanya lingkaran halo, bukan titik intinya — kalau titik
 * yang membesar-mengecil, pembaca bisa salah menyangka nilainya berubah.
 * Bulan tanpa target tidak digambar sama sekali (bukan digambar di nol).
 */
function TitikTargetBerpendar({ cx, cy, value }) {
  if (value === null || value === undefined || cx === undefined || cy === undefined) {
    return null;
  }
  return (
    <g>
      <circle className={gaya.pendarTarget} cx={cx} cy={cy} r={6} fill={WARNA.target} />
      <circle cx={cx} cy={cy} r={4} fill={WARNA.target} stroke="var(--kartu)" strokeWidth={2} />
    </g>
  );
}

/* ================================================================
   Tabel 12 bulan
   ================================================================ */
function TabelBulanan({ bulanan }) {
  const rata = (kolom) => {
    const angka = bulanan.map((b) => b[kolom]).filter((v) => v !== null);
    if (!angka.length) return null;
    return angka.reduce((a, b) => a + b, 0) / angka.length;
  };

  // Jumlah bulan yang benar-benar sudah terisi dipakai sebagai ringkasan di
  // kepala lipatan, supaya orang tua tahu ada berapa isinya tanpa membuka.
  const bulanTerisi = bulanan.filter(
    (b) =>
      b.rata_b_indo !== null ||
      b.rata_mtk !== null ||
      b.rata_ipa !== null ||
      b.capaian_tahfidz !== null ||
      b.capaian_tahsin !== null
  ).length;

  return (
    <section className={gaya.kartu}>
      {/* Terbuka secara bawaan: tabel ini rekap resmi yang dicari orang tua,
          bukan lampiran. Tetap dapat dilipat kalau ingin diringkas, dan
          tetap ditaruh paling bawah supaya baris-baris yang belum terisi di
          awal tahun tidak mendorong grafik ke luar layar. */}
      <details className={gaya.lipatan} open>
        <summary>
          <span className={gaya.penanda}>▶</span>
          Rincian Bulanan
          <span className={gaya.ketKartu} style={{ margin: 0, fontWeight: 400 }}>
            ({bulanTerisi} dari 12 bulan sudah terisi)
          </span>
        </summary>

        <div className={gaya.isiLipatan}>
      <div className={gaya.gulirTabel}>
        <table className={gaya.tabel}>
          {/* Kepala tabel dua tingkat: tanpa pengelompokan ini, kolom
              "Tahfidz" dan "Tahsin" tidak menjelaskan apakah isinya capaian
              atau target -- dan keduanya memang ditampilkan berdampingan. */}
          <thead>
            <tr>
              <th rowSpan={2}>No</th>
              <th rowSpan={2}>Bulan</th>
              <th colSpan={4}>Nilai Rata-Rata</th>
              <th colSpan={2}>Tahfidz</th>
              <th colSpan={2}>Tahsin</th>
            </tr>
            <tr>
              <th>B. Indonesia</th>
              <th>Matematika</th>
              <th>IPA</th>
              <th>Target</th>
              <th>Capaian</th>
              <th>Target</th>
              <th>Capaian</th>
              <th>Target</th>
            </tr>
          </thead>
          <tbody>
            {bulanan.map((b, i) => {
              // Target akademik hanya bermakna untuk bulan yang sudah
              // berjalan. Menampilkan "90" di dua belas baris membuat bulan
              // yang belum dimulai terlihat seolah sudah punya patokan aktif.
              const berjalan = bulanBerdata(b);
              return (
                <tr key={b.bulan}>
                  <td>{i + 1}</td>
                  <td>{b.bulan}</td>
                  <td>{tampil(b.rata_b_indo)}</td>
                  <td>{tampil(b.rata_mtk)}</td>
                  <td>{tampil(b.rata_ipa)}</td>
                  <td>{berjalan ? b.target_akademik : <span className={gaya.kosong}>–</span>}</td>
                  <td>
                    {b.capaian_tahfidz === null ? (
                      <span className={gaya.kosong}>–</span>
                    ) : (
                      `${b.capaian_tahfidz} · ${b.nama_tahfidz}`
                    )}
                  </td>
                  <td>{tampilPoin(b.target_tahfidz, 'tahfidz')}</td>
                  <td>
                    {b.capaian_tahsin === null ? (
                      <span className={gaya.kosong}>–</span>
                    ) : (
                      `${b.capaian_tahsin} · ${b.nama_tahsin}`
                    )}
                  </td>
                  <td>{tampilPoin(b.target_tahsin, 'tahsin')}</td>
                </tr>
              );
            })}
            <tr className={gaya.barisRata}>
              <td colSpan={2}>Rata-Rata</td>
              <td>{tampil(rata('rata_b_indo'))}</td>
              <td>{tampil(rata('rata_mtk'))}</td>
              <td>{tampil(rata('rata_ipa'))}</td>
              {/* Lima kolom sisanya sengaja tidak dirata-ratakan: target
                  akademik sama sepanjang tahun, sedangkan Tahfidz dan
                  Tahsin bersifat kumulatif -- rata-rata poinnya tidak
                  berarti apa-apa. Diisi tanda hubung, bukan dibiarkan
                  kosong, supaya barisnya tidak terlihat seperti tabel
                  yang gagal termuat. */}
              {[0, 1, 2, 3, 4].map((i) => (
                <td key={i}>
                  <span className={gaya.kosong}>–</span>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
        </div>
      </details>
    </section>
  );
}

/* ================================================================
   Capaian seluruh kelas — nama teman disamarkan di server
   ================================================================
   Lima grafik ditampilkan sekaligus, bukan satu grafik dengan pemilih
   ukuran. Alasannya cetakan: orang tua yang menyimpan halaman ini sebagai
   PDF hanya akan mendapat ukuran yang kebetulan sedang dipilih, sementara
   yang lain hilang tanpa jejak dari lembar cetakannya.

   Tiap mapel dipisah menjadi grafik sendiri, bukan digabung menjadi satu
   grafik tiga seri. Dengan satu seri per grafik, batang anak sendiri bisa
   diberi warna sementara teman sekelasnya diabukan; pada grafik tiga seri
   cara itu tidak bisa dipakai, karena mengabukan teman sekelas berarti
   menghapus pembeda antar-mapel bagi mereka.
*/
function PerbandinganKelas({ perbandingan, namaAnak, namaKelas, targetAkademik }) {
  const bulanTersedia = useMemo(
    () => BULAN_AJARAN.filter((b) => perbandingan[b]?.length),
    [perbandingan]
  );

  const [bulan, setBulan] = useState('');

  useEffect(() => {
    if (bulanTersedia.length && !bulan) {
      setBulan(bulanTersedia[bulanTersedia.length - 1]);
    }
  }, [bulanTersedia, bulan]);

  if (!bulanTersedia.length) return null;

  const semuaBaris = perbandingan[bulan] || [];

  const UKURAN = [
    { kunci: 'rata_b_indo', nama: 'B. Indonesia', jenisQuran: null },
    { kunci: 'rata_mtk', nama: 'Matematika', jenisQuran: null },
    { kunci: 'rata_ipa', nama: 'IPA', jenisQuran: null },
    { kunci: 'capaian_tahfidz', nama: 'Tahfidz', jenisQuran: 'tahfidz' },
    { kunci: 'capaian_tahsin', nama: 'Tahsin', jenisQuran: 'tahsin' },
  ];

  return (
    <section className={gaya.kartu}>
      <h2 className={gaya.judulKartu}>Capaian Kelas {namaKelas}</h2>
      <p className={gaya.ketKartu}>
        Batang berwarna adalah capaian putra/putri Anda.
      </p>

      <div className={gaya.penyaring}>
        <label>
          Bulan
          <select value={bulan} onChange={(e) => setBulan(e.target.value)}>
            {bulanTersedia.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Pemilih bulan di atas disembunyikan saat dicetak karena tidak bisa
          diklik di atas kertas -- tanpa baris ini, kelima grafik tercetak
          tanpa satu pun keterangan bulan mana yang sedang ditampilkan. */}
      <p className={gaya.judulCetak}>Bulan {bulan}</p>

      {UKURAN.map((u) => (
        <GrafikSatuUkuran
          key={u.kunci}
          semuaBaris={semuaBaris}
          bulan={bulan}
          namaAnak={namaAnak}
          targetAkademik={targetAkademik}
          {...u}
        />
      ))}
    </section>
  );
}

/** Satu grafik untuk satu ukuran: seluruh kelas pada bulan terpilih. */
function GrafikSatuUkuran({
  semuaBaris,
  bulan,
  kunci,
  nama,
  jenisQuran,
  namaAnak,
  targetAkademik,
}) {
  const ukuranGrafik = useUkuranGrafik();
  const baris = semuaBaris.filter((r) => r[kunci] !== null && r[kunci] !== undefined);

  // Target akademik tetap sepanjang tahun, sedangkan target Tahfidz/Tahsin
  // berubah tiap bulan -- karena itu diambil dari baris bulan ini, bukan
  // dari satu angka di tingkat kelas. Seluruh siswa satu kelas berbagi
  // target yang sama, jadi baris pertama yang terisi sudah mewakili.
  const target = jenisQuran
    ? baris.map((r) => r[`target_${jenisQuran}`]).find((v) => v !== null && v !== undefined) ??
      null
    : targetAkademik ?? null;

  if (!baris.length) {
    return (
      <div className={gaya.blokUkuran}>
        <h3 className={gaya.judulUkuran}>{nama}</h3>
        <p className={gaya.kosong}>
          Belum ada data {nama} untuk bulan {bulan}.
        </p>
      </div>
    );
  }

  return (
    <div className={gaya.blokUkuran}>
      <h3 className={gaya.judulUkuran}>{nama}</h3>

      <div className={gaya.grafik}>
        <ResponsiveContainer {...ukuranGrafik}>
          <ComposedChart
            data={baris.map((r) => ({ ...r, target }))}
            margin={{ top: 8, right: 16, bottom: 8, left: -8 }}
          >
            <CartesianGrid stroke="var(--garis)" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: 'var(--tinta-lembut)' }}
              tickLine={false}
              axisLine={{ stroke: 'var(--garis)' }}
              interval={0}
              angle={-45}
              textAnchor="end"
              height={70}
            />
            <YAxis
              tick={{ fontSize: 11, fill: 'var(--tinta-lembut)' }}
              tickLine={false}
              axisLine={false}
              allowDecimals={!jenisQuran}
            />
            <Tooltip
              contentStyle={kotakTooltip}
              formatter={(nilai, namaSeri) =>
                jenisQuran && nilai !== null && nilai !== undefined
                  ? [`${nilai} — ${getQuranLevelName(jenisQuran, nilai)}`, namaSeri]
                  : [nilai, namaSeri]
              }
            />
            <Legend content={<LegendaGrafik bulatanTarget={Boolean(jenisQuran)} />} />
            {/* fill dipasang di Bar semata-mata agar kotak warna di legenda
                ikut berwarna: Recharts mengambil warna legenda dari fill
                milik Bar, bukan dari Cell, sehingga tanpa ini kotaknya
                digambar hitam dan tidak cocok dengan batang mana pun. Cell
                di bawahnya tetap menimpa warna per siswa. */}
            <Bar
              dataKey={kunci}
              name={nama}
              fill="var(--seri-2)"
              radius={[4, 4, 0, 0]}
              maxBarSize={38}
            >
              {baris.map((r, i) => (
                <Cell
                  key={i}
                  fill={r.anak ? 'var(--seri-2)' : 'var(--garis)'}
                  stroke={r.anak ? 'var(--seri-2)' : 'var(--tinta-samar)'}
                />
              ))}
            </Bar>
            {/* Ditaruh sesudah Bar supaya garisnya tergambar di atas batang,
                bukan tertimbun di belakangnya. */}
            {target !== null && (
              <Line
                dataKey="target"
                name="Target"
                stroke={WARNA.target}
                strokeWidth={2}
                strokeDasharray="6 4"
                dot={false}
                activeDot={false}
                connectNulls
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <p className={gaya.narasi}>{narasiPosisi(baris, kunci, nama, namaAnak)}</p>
      {/* Keterangan hanya relevan untuk Tahfidz/Tahsin -- sumbu Y-nya poin,
          bukan nilai 0-100 yang sudah bisa dibaca apa adanya. */}
      {jenisQuran && <KeteranganQuran jenis={jenisQuran} />}
    </div>
  );
}


/* ================================================================
   Narasi otomatis
   ================================================================ */
function narasiAkademik(bulanan, target) {
  const terisi = bulanan.filter(
    (b) => b.rata_b_indo !== null || b.rata_mtk !== null || b.rata_ipa !== null
  );
  if (!terisi.length) return 'Narasi akan muncul setelah nilai bulan pertama diinput.';

  const semua = terisi.flatMap((b) =>
    [b.rata_b_indo, b.rata_mtk, b.rata_ipa].filter((v) => v !== null)
  );
  const rata = semua.reduce((a, b) => a + b, 0) / semua.length;
  const bulanTerakhir = terisi[terisi.length - 1].bulan;

  const penilaian =
    rata >= target
      ? 'Capaian ini sudah berada di atas target sekolah.'
      : `Capaian ini masih ${(target - rata).toFixed(1)} poin di bawah target sekolah.`;

  return `Berdasarkan data hingga bulan ${bulanTerakhir}, rata-rata nilai akademik adalah ${rata.toFixed(
    1
  )}. ${penilaian}`;
}

function narasiQuran(jenis, bulanan) {
  const kolom = jenis === 'tahfidz' ? 'capaian_tahfidz' : 'capaian_tahsin';
  const kolomTarget = jenis === 'tahfidz' ? 'target_tahfidz' : 'target_tahsin';
  const terisi = bulanan.filter((b) => b[kolom] !== null);
  if (!terisi.length) return 'Narasi akan muncul setelah capaian pertama diinput.';

  const akhir = terisi[terisi.length - 1];
  const nama = getQuranLevelName(jenis, akhir[kolom]);
  const label = jenis === 'tahfidz' ? 'hafalan' : 'materi';

  if (akhir[kolomTarget] === null) {
    return `Sampai bulan ${akhir.bulan}, ${label} telah mencapai ${nama} (poin ${akhir[kolom]}).`;
  }

  const selisih = akhir[kolom] - akhir[kolomTarget];
  const keterangan =
    selisih > 0
      ? `melampaui target sebanyak ${selisih} tingkat`
      : selisih === 0
        ? 'tepat sesuai target'
        : `masih ${Math.abs(selisih)} tingkat di bawah target`;

  return `Sampai bulan ${akhir.bulan}, ${label} telah mencapai ${nama} (poin ${akhir[kolom]}), ${keterangan}.`;
}

function narasiPosisi(baris, ukuran, namaUkuran, namaAnak) {
  if (!baris.length) return '';
  const nilai = baris.map((r) => r[ukuran]);
  const rata = nilai.reduce((a, b) => a + b, 0) / nilai.length;
  const anak = baris.find((r) => r.anak);
  if (!anak) return `Rata-rata kelas untuk ${namaUkuran} adalah ${rata.toFixed(1)}.`;

  const selisih = anak[ukuran] - rata;
  const posisi =
    selisih > 0
      ? `${selisih.toFixed(1)} poin di atas rata-rata kelas`
      : selisih < 0
        ? `${Math.abs(selisih).toFixed(1)} poin di bawah rata-rata kelas`
        : 'tepat di rata-rata kelas';

  return `${namaAnak} berada ${posisi} (${anak[ukuran]} berbanding ${rata.toFixed(
    1
  )}) untuk ${namaUkuran}.`;
}

/* ================================================================
   Bantu
   ================================================================ */
const kotakTooltip = {
  background: 'var(--kartu)',
  border: '1px solid var(--garis)',
  borderRadius: 8,
  fontSize: 12,
  color: 'var(--tinta)',
};

function tampil(nilai) {
  if (nilai === null || nilai === undefined) return <span className={gaya.kosong}>–</span>;
  return Number(nilai).toFixed(nilai % 1 === 0 ? 0 : 1);
}

/** Poin Qur'an beserta nama surah/materinya, atau "–" bila belum ada. */
function tampilPoin(poin, jenis) {
  if (poin === null || poin === undefined) return <span className={gaya.kosong}>–</span>;
  return `${poin} · ${getQuranLevelName(jenis, poin)}`;
}
