'use client';

import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { TAHFIDZ_MAPPING, TAHSIN_MAPPING, getQuranLevelName } from '@/quran_mapping';
import {
  MAPEL,
  bulanBerdata,
  bulat,
  capaianTerbaik,
  distribusi,
  ketuntasan,
  peringatanDini,
  rataRata,
  rekapQuran,
} from '@/lib/statistik';
import LegendaGrafik from '@/app/komponen/LegendaGrafik';
import { useUkuranGrafik } from '@/app/komponen/cetak';
import gaya from './dasbor.module.css';

/* ================================================================
   Ukuran grafik di atas kertas
   ================================================================
   Recharts mematok lebar SVG dari hasil pengukuran wadahnya di layar
   dan tidak pernah mengukur ulang saat halaman dicetak -- grafik yang
   lahir di layar HP tetap tergambar 390px di tengah kertas A4. Karena
   itu lebarnya diambil alih selama proses cetak.

   664px dipilih dari bidang isi A4: 210mm dikurangi margin @page 12mm
   kiri-kanan = 186mm (~703px pada 96dpi), dikurangi lagi bingkai dan
   bantalan kartu pada mode cetak (~2 + 20px), lalu disisakan beberapa
   piksel supaya pembulatan peramban tidak pernah membuatnya melewati
   tepi. Kalau margin @page di dasbor.module.css diubah, angka ini
   perlu ikut disesuaikan.

   250px tinggi, bukan 320px seperti di layar: sebuah laporan bulanan
   berisi lima grafik, dan pada tinggi layar kelimanya sendirian sudah
   menghabiskan empat halaman kertas. */
const LEBAR_GRAFIK_CETAK = 664;
const TINGGI_GRAFIK_CETAK = 250;

/* Diekspor karena dasbor kepala sekolah menggambar satu grafik langsung
   di halamannya sendiri (ketuntasan antar kelas), bukan lewat komponen
   di berkas ini -- dan grafik itu harus memakai lebar kertas yang sama. */
export function useUkuranGrafikDasbor() {
  return useUkuranGrafik(LEBAR_GRAFIK_CETAK, TINGGI_GRAFIK_CETAK);
}

const kotakTooltip = {
  background: 'var(--kartu)',
  border: '1px solid var(--garis)',
  borderRadius: 8,
  fontSize: 12,
  color: 'var(--tinta)',
};

/* ================================================================
   Meter ketuntasan — pengganti gauge di rapor PDF
   ================================================================ */
export function MeterKetuntasan({ label, hasil }) {
  if (!hasil) {
    return (
      <div className={gaya.meter}>
        <p className={gaya.meterLabel}>{label}</p>
        <p className={gaya.kosong}>belum dinilai</p>
      </div>
    );
  }

  /* Rentang warna meter ketuntasan, ditetapkan sekolah:

       90-100  hijau    Baik
       75-89   oranye   Perlu dipantau
       60-74   kuning   Perlu perhatian
       0-59    merah    Perlu tindakan

     Digolongkan dari angka yang DITAMPILKAN, bukan dari nilai mentahnya.
     Ketuntasan 89,6% ditulis "90%" oleh pembulatan; kalau penggolongannya
     memakai nilai mentah, meter itu akan terbaca "90% - Perlu dipantau"
     dan tampak seperti kesalahan program. Dengan membulatkan lebih dulu,
     angka dan warnanya tidak pernah bisa saling bertentangan. */
  const persen = Number(bulat(hasil.persen));

  const TINGKAT = [
    { batas: 90, kunci: 'baik', nama: 'Baik' },
    { batas: 75, kunci: 'dipantau', nama: 'Perlu dipantau' },
    { batas: 60, kunci: 'perhatian', nama: 'Perlu perhatian' },
    { batas: 0, kunci: 'tindakan', nama: 'Perlu tindakan' },
  ];
  const tingkat = TINGKAT.find((t) => persen >= t.batas);

  /* Busur dan angka memakai warna BERBEDA dari rona yang sama.

     Busurnya setebal 11px, jadi ia boleh memakai warna cerah yang mudah
     dibedakan sekilas -- itulah gunanya meter ini. Angka persennya teks,
     dan kuning cerah di atas kartu putih hanya mencapai rasio kontras
     sekitar 1,8:1 -- jauh di bawah 3:1 yang dibutuhkan teks sebesar ini,
     dan di layar HP di bawah sinar matahari praktis lenyap. Karena itu
     angkanya memakai versi yang lebih tua dari rona yang sama: warnanya
     tetap terbaca sebagai kuning, tetapi bisa dibaca. */
  const warnaBusur = `var(--${tingkat.kunci})`;
  const warnaAngka = `var(--${tingkat.kunci}-teks)`;
  const namaStatus = tingkat.nama;

  // Busur setengah lingkaran, jari-jari 52, dari kiri ke kanan.
  const r = 52;
  const keliling = Math.PI * r;
  const terisi = (persen / 100) * keliling;

  return (
    <div className={gaya.meter}>
      <svg viewBox="0 0 130 76" width="100%" height="76" role="img"
           aria-label={`${label}: ketuntasan ${persen} persen, ${namaStatus}`}>
        <path
          d={`M 13 65 A ${r} ${r} 0 0 1 117 65`}
          fill="none"
          stroke="var(--garis)"
          strokeWidth="11"
          strokeLinecap="round"
        />
        <path
          d={`M 13 65 A ${r} ${r} 0 0 1 117 65`}
          fill="none"
          stroke={warnaBusur}
          strokeWidth="11"
          strokeLinecap="round"
          strokeDasharray={`${terisi} ${keliling}`}
        />
      </svg>
      <p className={gaya.meterAngka} style={{ color: warnaAngka }}>
        {persen}%
      </p>
      <p className={gaya.meterLabel}>{label}</p>
      {/* Status tidak disandarkan pada warna semata — ada teksnya. */}
      <p className={gaya.meterKet}>
        {namaStatus} · {hasil.tuntas} dari {hasil.dinilai} siswa
      </p>
    </div>
  );
}

/* ================================================================
   Grafik capaian per siswa dalam satu bulan
   ================================================================ */
export function GrafikKelasAkademik({ baris, target, anonim }) {
  const ukuran = useUkuranGrafikDasbor();

  // `target` tidak lagi diikutkan ke tiap baris data: sejak digambar
  // sebagai ReferenceLine, ia bukan lagi seri yang perlu punya nilai per
  // siswa -- dan membiarkannya di sini hanya menambah satu baris "Target
  // 90" yang sama di setiap tooltip.
  const data = baris.map((b) => ({
    nama: anonim ? b.label : b.nama_panggilan,
    ...b,
  }));

  const adaIsi = data.some((b) => MAPEL.some((m) => b[m.kunci] !== null));
  if (!adaIsi) return <p className={gaya.kosong}>Belum ada nilai untuk bulan ini.</p>;

  return (
    <div className={gaya.grafik}>
      <ResponsiveContainer
        key={ukuran.cetak ? 'cetak' : 'layar'}
        width={ukuran.width}
        height={ukuran.height}
      >
        <ComposedChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: -8 }}>
          <CartesianGrid stroke="var(--garis)" vertical={false} />
          <XAxis
            dataKey="nama"
            tick={{ fontSize: 10, fill: 'var(--tinta-lembut)' }}
            tickLine={false}
            axisLine={{ stroke: 'var(--garis)' }}
            interval={0}
            angle={-45}
            textAnchor="end"
            height={78}
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
            formatter={(v, n) => [v === null ? 'belum dinilai' : bulat(v, 1), n]}
          />
          <Legend
            content={
              <LegendaGrafik
                tambahanDepan={[
                  {
                    kunci: 'target',
                    label: 'Target',
                    jenis: 'garis',
                    warna: 'var(--target)',
                    putusPutus: true,
                  },
                ]}
              />
            }
          />
          {/* ReferenceLine, bukan seri Line.
             
              Target kelas satu angka yang sama untuk seluruh siswa -- ia
              ambang, bukan data per siswa. Digambar sebagai seri, garisnya
              hanya membentang dari titik tengah batang pertama ke titik
              tengah batang terakhir, sehingga menggantung tidak sampai ke
              kedua tepi bidang gambar. Pada kelas berisi 24 siswa selisih
              itu kecil dan nyaris tak terlihat; pada grafik berkategori
              sedikit ia langsung terbaca sebagai garis yang kurang
              panjang.
             
              Konsekuensinya ReferenceLine tidak pernah muncul di legenda
              (ia bukan seri), jadi keterangannya disisipkan sendiri lewat
              tambahanDepan di atas -- di posisi yang sama seperti dulu. */}
          <ReferenceLine
            y={target}
            stroke="var(--target)"
            strokeWidth={2}
            strokeDasharray="6 4"
          />
          {/* Batang, bukan garis. Sumbu X di sini adalah nama siswa --
              kategori yang tidak berurutan. Garis akan menyambungkan Aksara
              ke Alesha seolah nilai satu murid "berubah menjadi" nilai murid
              berikutnya, padahal tidak ada hubungan apa pun di antara
              keduanya; kemiringannya lalu terbaca sebagai tren yang tidak
              ada. Garis tetap dipakai pada grafik per-siswa sepanjang tahun,
              di mana sumbu X-nya bulan dan tren memang bermakna. */}
          <Bar isAnimationActive={!ukuran.cetak} dataKey="rata_b_indo" name="B. Indonesia" fill="var(--seri-1)"
               radius={[3, 3, 0, 0]} maxBarSize={18} />
          <Bar isAnimationActive={!ukuran.cetak} dataKey="rata_mtk" name="Matematika" fill="var(--seri-2)"
               radius={[3, 3, 0, 0]} maxBarSize={18} />
          <Bar isAnimationActive={!ukuran.cetak} dataKey="rata_ipa" name="IPA" fill="var(--seri-3)"
               radius={[3, 3, 0, 0]} maxBarSize={18} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ================================================================
   Grafik Tahfidz / Tahsin satu kelas dalam satu bulan
   ================================================================ */
export function GrafikKelasQuran({ jenis, baris, anonim }) {
  const ukuran = useUkuranGrafikDasbor();

  const kCapaian = jenis === 'tahfidz' ? 'capaian_tahfidz' : 'capaian_tahsin';
  const kTarget = jenis === 'tahfidz' ? 'target_tahfidz' : 'target_tahsin';
  const warna = jenis === 'tahfidz' ? 'var(--seri-1)' : 'var(--seri-3)';

  const data = baris
    .map((b) => ({ nama: anonim ? b.label : b.nama_panggilan, ...b }))
    .filter((b) => b[kCapaian] !== null);

  if (!data.length) {
    return <p className={gaya.kosong}>Belum ada capaian {jenis} untuk bulan ini.</p>;
  }

  const adaDibawahTarget = data.some(
    (b) => b[kTarget] !== null && b[kCapaian] < b[kTarget]
  );

  return (
    <div className={gaya.grafik}>
      <ResponsiveContainer
        key={ukuran.cetak ? 'cetak' : 'layar'}
        width={ukuran.width}
        height={ukuran.height}
      >
        <ComposedChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: -8 }}>
          <CartesianGrid stroke="var(--garis)" vertical={false} />
          <XAxis
            dataKey="nama"
            tick={{ fontSize: 10, fill: 'var(--tinta-lembut)' }}
            tickLine={false}
            axisLine={{ stroke: 'var(--garis)' }}
            interval={0}
            angle={-45}
            textAnchor="end"
            height={78}
          />
          <YAxis
            tick={{ fontSize: 11, fill: 'var(--tinta-lembut)' }}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={kotakTooltip}
            formatter={(v, n) =>
              v === null || v === undefined
                ? ['belum dinilai', n]
                : [`${v} — ${getQuranLevelName(jenis, v)}`, n]
            }
          />
          {/* Keterangan "Di bawah target" hanya dimunculkan kalau memang
              ada siswa yang di bawah target -- legenda untuk sesuatu yang
              tidak ada di grafiknya hanya membuat pembaca mencari-cari. */}
          <Legend
            content={
              <LegendaGrafik
                bulatanTarget
                tambahan={
                  adaDibawahTarget
                    ? [
                        {
                          kunci: 'dibawah',
                          label: 'Di bawah target',
                          warna,
                          warnaTepi: 'var(--kritis)',
                        },
                      ]
                    : undefined
                }
              />
            }
          />
          {/* Siswa di bawah target ditandai GARIS TEPI merah, bukan isian
              merah. Dengan isian merah, satu grafik memuat dua warna yang
              sama pekatnya -- biru dan merah pada Tahfidz, hijau dan merah
              pada Tahsin -- dan keduanya berebut dibaca sebagai "jenis
              data yang berbeda", padahal isinya sama-sama capaian siswa.
              Yang berbeda statusnya, bukan datanya.

              Isian tetap satu warna per grafik (biru Tahfidz, hijau
              Tahsin) sehingga grafiknya terbaca sebagai satu kesatuan,
              dan status di bawah target dibawa oleh garis tepinya saja --
              lapisan terpisah yang tidak mengubah arti warna isian.

              fill dipasang di Bar agar kotak legenda ikut berwarna; Cell
              di bawahnya menimpanya per siswa. */}
          <Bar
            isAnimationActive={!ukuran.cetak}
            dataKey={kCapaian}
            name="Capaian"
            fill={warna}
            radius={[4, 4, 0, 0]}
            maxBarSize={30}
          >
            {data.map((b, i) => {
              const dibawah = b[kTarget] !== null && b[kCapaian] < b[kTarget];
              return (
                <Cell
                  key={i}
                  fill={warna}
                  stroke={dibawah ? 'var(--kritis)' : 'none'}
                  /* 2.5px, bukan 1px: pada layar HP batangnya hanya sekitar
                     20px lebar, dan garis setipis 1px di tepi batang
                     berwarna pekat praktis lenyap. */
                  strokeWidth={dibawah ? 2.5 : 0}
                />
              );
            })}
          </Bar>
          <Line
            isAnimationActive={!ukuran.cetak}
            dataKey={kTarget}
            name="Target"
            stroke="var(--target)"
            strokeWidth={2}
            strokeDasharray="4 4"
            dot={false}
            connectNulls
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ================================================================
   Tabel distribusi nilai
   ================================================================ */
export function TabelDistribusi({ baris }) {
  const sebaran = MAPEL.map((m) => ({ mapel: m, data: distribusi(baris, m.kunci) }));

  return (
    <div className={gaya.gulir}>
      <table className={gaya.tabel}>
        <thead>
          <tr>
            <th rowSpan={2} className={gaya.kiri}>Rentang Nilai</th>
            <th colSpan={3}>Jumlah Siswa</th>
            <th colSpan={3}>Persentase</th>
          </tr>
          <tr>
            {MAPEL.map((m) => <th key={`j-${m.kunci}`}>{m.pendek}</th>)}
            {MAPEL.map((m) => <th key={`p-${m.kunci}`}>{m.pendek}</th>)}
          </tr>
        </thead>
        <tbody>
          {sebaran[0].data.map((_, i) => (
            <tr key={i}>
              <td className={gaya.kiri}>{sebaran[0].data[i].label}</td>
              {sebaran.map((s) => (
                <td key={`j-${s.mapel.kunci}`}>{s.data[i].jumlah}</td>
              ))}
              {sebaran.map((s) => (
                <td key={`p-${s.mapel.kunci}`}>{bulat(s.data[i].persen, 1)}%</td>
              ))}
            </tr>
          ))}
          <tr style={{ fontWeight: 700 }}>
            <td className={gaya.kiri}>Rata-Rata Kelas</td>
            {MAPEL.map((m) => (
              <td key={m.kunci}>{bulat(rataRata(baris.map((b) => b[m.kunci])), 1)}</td>
            ))}
            <td colSpan={3}></td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/* ================================================================
   Rekap Qur'an: di atas / sesuai / di bawah target
   ================================================================ */
export function RekapQuran({ jenis, baris }) {
  const r = rekapQuran(
    baris,
    jenis === 'tahfidz' ? 'capaian_tahfidz' : 'capaian_tahsin',
    jenis === 'tahfidz' ? 'target_tahfidz' : 'target_tahsin'
  );

  if (!r.dinilai) return <p className={gaya.kosong}>Belum ada data {jenis}.</p>;

  const persen = (n) => `${bulat((n / r.dinilai) * 100, 1)}%`;

  return (
    <div className={gaya.gulir}>
      <table className={gaya.tabel} style={{ minWidth: 320 }}>
        <thead>
          <tr>
            <th className={gaya.kiri}>Keterangan</th>
            <th>Jumlah</th>
            <th>Persentase</th>
          </tr>
        </thead>
        <tbody>
          <tr><td className={gaya.kiri}>Di atas target</td><td>{r.diatas}</td><td>{persen(r.diatas)}</td></tr>
          <tr><td className={gaya.kiri}>Sesuai target</td><td>{r.sesuai}</td><td>{persen(r.sesuai)}</td></tr>
          <tr><td className={gaya.kiri}>Di bawah target</td><td>{r.dibawah}</td><td>{persen(r.dibawah)}</td></tr>
          <tr style={{ fontWeight: 700 }}>
            <td className={gaya.kiri}>Siswa tuntas</td><td>{r.tuntas}</td><td>{persen(r.tuntas)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/* ================================================================
   Peringatan dini
   ================================================================ */
export function PeringatanDini({ baris, target }) {
  const perlu = peringatanDini(baris, target);

  if (!perlu.length) {
    return (
      <p className={gaya.narasi}>
        Tidak ada siswa yang berada di bawah target pada bulan ini.
      </p>
    );
  }

  return (
    <>
      <ul className={gaya.daftarPeringatan}>
        {perlu.map((b) => (
          <li key={b.nis || b.nama_panggilan}>
            <span className={gaya.namaSiswa}>{b.nama_panggilan}</span>
            <span className={gaya.alasan}>{b.alasan.join(' · ')}</span>
          </li>
        ))}
      </ul>
      <p className={`${gaya.narasi} ${gaya.peringatan}`}>
        {perlu.length} siswa memerlukan pendampingan. Daftar ini disusun menurut
        banyaknya aspek yang di bawah target, bukan menurut nilai terendah.
      </p>
    </>
  );
}

/* ================================================================
   Ringkasan naratif
   ================================================================ */
export function CatatanTerbaik({ baris }) {
  const terbaik = capaianTerbaik(baris);
  if (!terbaik.length) return null;
  return (
    <p className={gaya.narasi}>
      Capaian terbaik bulan ini:{' '}
      {terbaik.map((t) => `${t.nama} (${t.mapel} ${t.nilai})`).join(', ')}.
    </p>
  );
}

/* ================================================================
   Keterangan poin -> nama surah/materi
   ================================================================
   Grafik Tahfidz/Tahsin hanya menampilkan angka pada sumbunya (poin
   disimpan sebagai angka karena nama materi Tahsin berulang di beberapa
   bab -- lihat quran_mapping.js). Panel ini menerjemahkan angka itu balik
   ke nama, seperti kolom keterangan di sebelah grafik pada rapor PDF.
   Tertutup secara bawaan karena daftarnya bisa sampai 49 baris. */
export function KeteranganQuran({ jenis }) {
  const peta = jenis === 'tahfidz' ? TAHFIDZ_MAPPING : TAHSIN_MAPPING;
  const daftar = Object.entries(peta)
    .map(([poin, nama]) => ({ poin: Number(poin), nama }))
    .sort((a, b) => a.poin - b.poin);

  return (
    <details className={gaya.keterangan}>
      <summary>
        Lihat keterangan seluruh capaian {jenis === 'tahfidz' ? 'Tahfidz' : 'Tahsin'}
        {/* Jumlah poin disebutkan di label, bukan disembunyikan di balik
            lipatan. Tanpa angka ini, "Lihat keterangan" tidak memberi
            petunjuk apa pun tentang ada berapa isinya -- dan tombol yang
            tidak menjanjikan apa-apa jarang ditekan. */}
        <span className={gaya.jumlahPoin}>{daftar.length} poin</span>
      </summary>
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

/* ================================================================
   Rincian bulanan satu siswa
   ================================================================
   Salinan tabel yang sama dengan yang dibaca orang tua di
   app/rapor/[token]. Disediakan juga di dasbor staf karena grafik saja
   tidak menjawab pertanyaan yang paling sering muncul saat wali kelas
   dan orang tua duduk berhadapan: "bulan Oktober nilainya berapa persis,
   dan surah apa yang sudah selesai?". Angka pastinya hanya ada di sini.

   Sengaja dibuat identik dengan tampilan orang tua, bukan versi ringkas
   tersendiri: kalau keduanya berbeda susunan, wali kelas harus
   menerjemahkan dulu apa yang sedang dilihat orang tua di layar HP-nya.
   ================================================================ */
export function TabelBulananSiswa({ bulanan, target }) {
  const rata = (kolom) => {
    const angka = bulanan.map((b) => b[kolom]).filter((v) => v !== null);
    if (!angka.length) return null;
    return angka.reduce((a, b) => a + b, 0) / angka.length;
  };

  const tampil = (nilai) => {
    if (nilai === null || nilai === undefined) {
      return <span className={gaya.kosong}>–</span>;
    }
    return Number(nilai).toFixed(nilai % 1 === 0 ? 0 : 1);
  };

  /* Poin Qur'an selalu disertai nama surah/materinya. Angka 12 sendirian
     tidak berarti apa-apa bagi siapa pun yang tidak hafal pemetaannya --
     termasuk kepala sekolah yang sedang menyusun laporan. */
  const tampilPoin = (poin, jenis) => {
    if (poin === null || poin === undefined) {
      return <span className={gaya.kosong}>–</span>;
    }
    return `${poin} · ${getQuranLevelName(jenis, poin)}`;
  };

  return (
    <div className={gaya.gulir}>
      <table className={`${gaya.tabel} ${gaya.tabelBulanan}`}>
        {/* Kepala dua tingkat: tanpa pengelompokan ini, kolom "Tahfidz"
            dan "Tahsin" tidak menjelaskan apakah isinya capaian atau
            target -- dan keduanya memang berdampingan. */}
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
            /* Target akademik hanya bermakna untuk bulan yang sudah
               berjalan. Menampilkan "90" di dua belas baris membuat bulan
               yang belum dimulai terlihat seolah sudah punya patokan. */
            const berjalan = bulanBerdata(b);
            return (
              <tr key={b.bulan}>
                <td>{i + 1}</td>
                <td className={gaya.kiri}>{b.bulan}</td>
                <td>{tampil(b.rata_b_indo)}</td>
                <td>{tampil(b.rata_mtk)}</td>
                <td>{tampil(b.rata_ipa)}</td>
                <td>{berjalan ? target : <span className={gaya.kosong}>–</span>}</td>
                <td>{tampilPoin(b.capaian_tahfidz, 'tahfidz')}</td>
                <td>{tampilPoin(b.target_tahfidz, 'tahfidz')}</td>
                <td>{tampilPoin(b.capaian_tahsin, 'tahsin')}</td>
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
                akademik sama sepanjang tahun, sedangkan Tahfidz dan Tahsin
                bersifat kumulatif -- rata-rata poinnya tidak berarti
                apa-apa. Diisi tanda hubung, bukan dibiarkan kosong, supaya
                barisnya tidak terlihat seperti tabel yang gagal termuat. */}
            {[0, 1, 2, 3, 4].map((i) => (
              <td key={i}>
                <span className={gaya.kosong}>–</span>
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/* ================================================================
   Grafik satu siswa sepanjang tahun ajaran
   ================================================================
   Berbeda dari GrafikKelasAkademik/GrafikKelasQuran di atas (satu bulan,
   seluruh siswa di sumbu X) -- dua fungsi ini untuk menelusuri SATU siswa
   sepanjang 12 bulan, sumbu X-nya bulan. Dipakai dasbor staf saat
   menelusuri satu murid tertentu; bentuknya sama dengan grafik yang
   dilihat orang tua di app/rapor/[token].
   ================================================================ */
export function GrafikTahunanAkademik({ bulanan, target }) {
  const ukuran = useUkuranGrafikDasbor();

  const adaIsi = bulanan.some(
    (b) => b.rata_b_indo !== null || b.rata_mtk !== null || b.rata_ipa !== null
  );
  if (!adaIsi) {
    return <p className={gaya.kosong}>Belum ada nilai akademik untuk siswa ini.</p>;
  }

  return (
    <div className={gaya.grafik}>
      <ResponsiveContainer
        key={ukuran.cetak ? 'cetak' : 'layar'}
        width={ukuran.width}
        height={ukuran.height}
      >
        <ComposedChart
          data={bulanan.map((b) => ({ ...b, target }))}
          margin={{ top: 8, right: 16, bottom: 8, left: -8 }}
        >
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
            formatter={(v, n) => [v === null || v === undefined ? 'belum dinilai' : v, n]}
          />
          <Legend content={<LegendaGrafik />} />
          <Line
            isAnimationActive={!ukuran.cetak}
            dataKey="target"
            name="Target"
            stroke="var(--target)"
            strokeWidth={2}
            strokeDasharray="6 4"
            dot={false}
            activeDot={false}
            connectNulls
          />
          <Line isAnimationActive={!ukuran.cetak} dataKey="rata_b_indo" name="B. Indonesia" stroke="var(--seri-1)"
                strokeWidth={2} dot={{ r: 4 }} connectNulls={false} />
          <Line isAnimationActive={!ukuran.cetak} dataKey="rata_mtk" name="Matematika" stroke="var(--seri-2)"
                strokeWidth={2} dot={{ r: 4 }} connectNulls={false} />
          <Line isAnimationActive={!ukuran.cetak} dataKey="rata_ipa" name="IPA" stroke="var(--seri-3)"
                strokeWidth={2} dot={{ r: 4 }} connectNulls={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function GrafikTahunanQuran({ jenis, bulanan, warna }) {
  const ukuran = useUkuranGrafikDasbor();

  const kCapaian = jenis === 'tahfidz' ? 'capaian_tahfidz' : 'capaian_tahsin';
  const kTarget = jenis === 'tahfidz' ? 'target_tahfidz' : 'target_tahsin';
  const adaIsi = bulanan.some((b) => b[kCapaian] !== null && b[kCapaian] !== undefined);
  if (!adaIsi) {
    return <p className={gaya.kosong}>Belum ada capaian {jenis} untuk siswa ini.</p>;
  }

  return (
    <div className={gaya.grafik}>
      <ResponsiveContainer
        key={ukuran.cetak ? 'cetak' : 'layar'}
        width={ukuran.width}
        height={ukuran.height}
      >
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
            formatter={(v, n) =>
              v === null || v === undefined
                ? ['belum dinilai', n]
                : [`${v} — ${getQuranLevelName(jenis, v)}`, n]
            }
          />
          <Legend content={<LegendaGrafik bulatanTarget />} />
          <Bar isAnimationActive={!ukuran.cetak} dataKey={kCapaian} name="Capaian" fill={warna} radius={[4, 4, 0, 0]} maxBarSize={34} />
          <Line
            isAnimationActive={!ukuran.cetak}
            dataKey={kTarget}
            name="Target"
            stroke="var(--target)"
            strokeWidth={2}
            strokeDasharray="4 4"
            dot={{ r: 4, fill: 'var(--target)', stroke: 'var(--kartu)', strokeWidth: 2 }}
            connectNulls={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export { ketuntasan, MAPEL, bulat };
