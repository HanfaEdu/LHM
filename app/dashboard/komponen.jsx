'use client';

import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { TAHFIDZ_MAPPING, TAHSIN_MAPPING, getQuranLevelName } from '@/quran_mapping';
import {
  MAPEL,
  bulat,
  capaianTerbaik,
  distribusi,
  ketuntasan,
  peringatanDini,
  rataRata,
  rekapQuran,
} from '@/lib/statistik';
import gaya from './dasbor.module.css';

const kotakTooltip = {
  background: 'var(--kartu)',
  border: '1px solid var(--garis)',
  borderRadius: 8,
  fontSize: 12,
  color: 'var(--tinta)',
};

const tulisLegenda = (nilai) => (
  <span style={{ color: 'var(--tinta-lembut)' }}>{nilai}</span>
);

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

  const persen = hasil.persen;

  // Ambang mengikuti kalimat rekap di rapor PDF: di bawah 80% berarti
  // perlu perhatian khusus.
  const status =
    persen >= 90 ? 'baik' : persen >= 80 ? 'waspada' : 'kritis';
  const warna = { baik: 'var(--baik)', waspada: 'var(--waspada)', kritis: 'var(--kritis)' }[
    status
  ];
  const namaStatus = { baik: 'Baik', waspada: 'Perlu dipantau', kritis: 'Perlu perhatian' }[
    status
  ];

  // Busur setengah lingkaran, jari-jari 52, dari kiri ke kanan.
  const r = 52;
  const keliling = Math.PI * r;
  const terisi = (persen / 100) * keliling;

  return (
    <div className={gaya.meter}>
      <svg viewBox="0 0 130 76" width="100%" height="76" role="img"
           aria-label={`${label}: ketuntasan ${bulat(persen)} persen`}>
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
          stroke={warna}
          strokeWidth="11"
          strokeLinecap="round"
          strokeDasharray={`${terisi} ${keliling}`}
        />
      </svg>
      <p className={gaya.meterAngka} style={{ color: warna }}>
        {bulat(persen)}%
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
  const data = baris.map((b) => ({
    nama: anonim ? b.label : b.nama_panggilan,
    ...b,
    target,
  }));

  const adaIsi = data.some((b) => MAPEL.some((m) => b[m.kunci] !== null));
  if (!adaIsi) return <p className={gaya.kosong}>Belum ada nilai untuk bulan ini.</p>;

  return (
    <div className={gaya.grafik}>
      <ResponsiveContainer width="100%" height="100%">
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
          <Legend wrapperStyle={{ fontSize: 12 }} formatter={tulisLegenda} />
          {/* Target digambar sebagai seri, bukan ReferenceLine: hanya seri
              yang ikut muncul di legenda, dan legenda itulah tempat pembaca
              mengetahui arti garis merah putus-putus ini.

              legendType="plainline" wajib: ikon legenda bawaan untuk seri
              garis selalu digambar utuh dan mengabaikan strokeDasharray,
              sehingga legendanya menjanjikan garis penuh sementara grafiknya
              menggambar garis putus-putus. Hanya tipe ikon ini yang membaca
              strokeDasharray dari seri yang bersangkutan. */}
          <Line
            dataKey="target"
            name="Target"
            legendType="plainline"
            stroke="var(--target)"
            strokeWidth={2}
            strokeDasharray="6 4"
            dot={false}
            activeDot={false}
            connectNulls
          />
          {/* Batang, bukan garis. Sumbu X di sini adalah nama siswa --
              kategori yang tidak berurutan. Garis akan menyambungkan Aksara
              ke Alesha seolah nilai satu murid "berubah menjadi" nilai murid
              berikutnya, padahal tidak ada hubungan apa pun di antara
              keduanya; kemiringannya lalu terbaca sebagai tren yang tidak
              ada. Garis tetap dipakai pada grafik per-siswa sepanjang tahun,
              di mana sumbu X-nya bulan dan tren memang bermakna. */}
          <Bar dataKey="rata_b_indo" name="B. Indonesia" fill="var(--seri-1)"
               radius={[3, 3, 0, 0]} maxBarSize={18} />
          <Bar dataKey="rata_mtk" name="Matematika" fill="var(--seri-2)"
               radius={[3, 3, 0, 0]} maxBarSize={18} />
          <Bar dataKey="rata_ipa" name="IPA" fill="var(--seri-3)"
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
  const kCapaian = jenis === 'tahfidz' ? 'capaian_tahfidz' : 'capaian_tahsin';
  const kTarget = jenis === 'tahfidz' ? 'target_tahfidz' : 'target_tahsin';
  const warna = jenis === 'tahfidz' ? 'var(--seri-1)' : 'var(--seri-3)';

  const data = baris
    .map((b) => ({ nama: anonim ? b.label : b.nama_panggilan, ...b }))
    .filter((b) => b[kCapaian] !== null);

  if (!data.length) {
    return <p className={gaya.kosong}>Belum ada capaian {jenis} untuk bulan ini.</p>;
  }

  return (
    <div className={gaya.grafik}>
      <ResponsiveContainer width="100%" height="100%">
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
          <Legend wrapperStyle={{ fontSize: 12 }} formatter={tulisLegenda} />
          {/* Siswa di bawah target diberi warna status agar terlihat tanpa
              harus membandingkan tinggi batang dengan garis target. */}
          {/* fill dipasang di Bar agar kotak legenda ikut berwarna; Cell di
              bawahnya menimpanya per siswa. */}
          <Bar
            dataKey={kCapaian}
            name="Capaian"
            fill={warna}
            radius={[4, 4, 0, 0]}
            maxBarSize={30}
          >
            {data.map((b, i) => (
              <Cell
                key={i}
                fill={
                  b[kTarget] !== null && b[kCapaian] < b[kTarget]
                    ? 'var(--kritis)'
                    : warna
                }
              />
            ))}
          </Bar>
          <Line
            dataKey={kTarget}
            name="Target"
            legendType="plainline"
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
   Grafik satu siswa sepanjang tahun ajaran
   ================================================================
   Berbeda dari GrafikKelasAkademik/GrafikKelasQuran di atas (satu bulan,
   seluruh siswa di sumbu X) -- dua fungsi ini untuk menelusuri SATU siswa
   sepanjang 12 bulan, sumbu X-nya bulan. Dipakai dasbor staf saat
   menelusuri satu murid tertentu; bentuknya sama dengan grafik yang
   dilihat orang tua di app/rapor/[token].
   ================================================================ */
export function GrafikTahunanAkademik({ bulanan, target }) {
  const adaIsi = bulanan.some(
    (b) => b.rata_b_indo !== null || b.rata_mtk !== null || b.rata_ipa !== null
  );
  if (!adaIsi) {
    return <p className={gaya.kosong}>Belum ada nilai akademik untuk siswa ini.</p>;
  }

  return (
    <div className={gaya.grafik}>
      <ResponsiveContainer width="100%" height="100%">
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
          <Legend wrapperStyle={{ fontSize: 12 }} formatter={tulisLegenda} />
          <Line
            dataKey="target"
            name="Target"
            legendType="plainline"
            stroke="var(--target)"
            strokeWidth={2}
            strokeDasharray="6 4"
            dot={false}
            activeDot={false}
            connectNulls
          />
          <Line dataKey="rata_b_indo" name="B. Indonesia" stroke="var(--seri-1)"
                strokeWidth={2} dot={{ r: 4 }} connectNulls={false} />
          <Line dataKey="rata_mtk" name="Matematika" stroke="var(--seri-2)"
                strokeWidth={2} dot={{ r: 4 }} connectNulls={false} />
          <Line dataKey="rata_ipa" name="IPA" stroke="var(--seri-3)"
                strokeWidth={2} dot={{ r: 4 }} connectNulls={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function GrafikTahunanQuran({ jenis, bulanan, warna }) {
  const kCapaian = jenis === 'tahfidz' ? 'capaian_tahfidz' : 'capaian_tahsin';
  const kTarget = jenis === 'tahfidz' ? 'target_tahfidz' : 'target_tahsin';
  const adaIsi = bulanan.some((b) => b[kCapaian] !== null && b[kCapaian] !== undefined);
  if (!adaIsi) {
    return <p className={gaya.kosong}>Belum ada capaian {jenis} untuk siswa ini.</p>;
  }

  return (
    <div className={gaya.grafik}>
      <ResponsiveContainer width="100%" height="100%">
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
          <Legend wrapperStyle={{ fontSize: 12 }} formatter={tulisLegenda} />
          <Bar dataKey={kCapaian} name="Capaian" fill={warna} radius={[4, 4, 0, 0]} maxBarSize={34} />
          <Line
            dataKey={kTarget}
            name="Target"
            legendType="plainline"
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
