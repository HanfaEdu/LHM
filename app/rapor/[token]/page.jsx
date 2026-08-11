'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Cell,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { BULAN_AJARAN, getQuranLevelName } from '@/quran_mapping';
import gaya from './rapor.module.css';

const WARNA = {
  bIndo: 'var(--seri-1)',
  mtk: 'var(--seri-2)',
  ipa: 'var(--seri-3)',
  target: 'var(--target)',
  tahfidz: 'var(--seri-1)',
  tahsin: 'var(--seri-3)',
};

export default function HalamanRapor({ params }) {
  // Next.js 14: params adalah objek biasa, bukan Promise.
  const token = params.token;

  const [pin, setPin] = useState('');
  const [butuhPin, setButuhPin] = useState(false);
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState('');
  const [data, setData] = useState(null);
  const [tahunAjaran, setTahunAjaran] = useState('');

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

  return (
    <div className={gaya.halaman}>
      <div className={gaya.wadah}>
        <header className={gaya.kepala}>
          <div>
            <h1 className={gaya.namaAnak}>{data.anak.nama_lengkap}</h1>
            <p className={gaya.subJudul}>
              Kelas {data.kelas.nama_kelas}
              {data.kelas.wali_kelas ? ` · Wali Kelas: ${data.kelas.wali_kelas}` : ''}
            </p>
          </div>
          {data.tahunAjaranTersedia.length > 1 && (
            <label className={gaya.subJudul}>
              Tahun Ajaran
              <br />
              <select
                className={gaya.pilih}
                value={tahunAjaran}
                onChange={(e) => ambilData(pin || undefined, e.target.value)}
              >
                {data.tahunAjaranTersedia.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
          )}
        </header>

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

        <TabelBulanan bulanan={data.bulanan} />

        <PerbandinganKelas
          perbandingan={data.perbandingan}
          namaAnak={data.anak.nama_panggilan}
        />
      </div>
    </div>
  );
}

/* ================================================================
   Grafik akademik — tiga mapel sepanjang tahun ajaran
   ================================================================ */
function GrafikAkademik({ bulanan, target }) {
  const adaIsi = bulanan.some(
    (b) => b.rata_b_indo !== null || b.rata_mtk !== null || b.rata_ipa !== null
  );

  return (
    <section className={gaya.kartu}>
      <h2 className={gaya.judulKartu}>Capaian Akademik</h2>
      <p className={gaya.ketKartu}>
        Garis merah putus-putus adalah target sekolah ({target}). Bulan yang belum
        dinilai sengaja dibiarkan kosong, bukan digambar sebagai nol.
      </p>

      {adaIsi ? (
        <div className={gaya.grafik}>
          <ResponsiveContainer width="100%" height="100%">
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
              <Legend
                wrapperStyle={{ fontSize: 12 }}
                /* Teks legenda memakai warna tinta, bukan warna seri: identitas
                   sudah dibawa kotak warna di sebelahnya. */
                formatter={(nilai) => (
                  <span style={{ color: 'var(--tinta-lembut)' }}>{nilai}</span>
                )}
              />
              <ReferenceLine
                y={target}
                stroke={WARNA.target}
                strokeWidth={2}
                strokeDasharray="6 4"
                ifOverflow="extendDomain"
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
                formatter={(nilai, nama) => {
                  if (nilai === null || nilai === undefined) return ['belum dinilai', nama];
                  return [`${nilai} — ${getQuranLevelName(jenis, nilai)}`, nama];
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: 12 }}
                /* Teks legenda memakai warna tinta, bukan warna seri: identitas
                   sudah dibawa kotak warna di sebelahnya. */
                formatter={(nilai) => (
                  <span style={{ color: 'var(--tinta-lembut)' }}>{nilai}</span>
                )}
              />
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
                dot={{ r: 4, fill: WARNA.target, stroke: 'var(--kartu)', strokeWidth: 2 }}
                connectNulls={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className={gaya.kosong}>Belum ada capaian {jenis} yang diinput.</p>
      )}

      <p className={gaya.narasi}>{narasiQuran(jenis, bulanan)}</p>
    </section>
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

  return (
    <section className={gaya.kartu}>
      <h2 className={gaya.judulKartu}>Rincian Bulanan</h2>
      <p className={gaya.ketKartu}>
        Tanda “–” berarti bulan tersebut belum dinilai.
      </p>
      <div className={gaya.gulirTabel}>
        <table className={gaya.tabel}>
          <thead>
            <tr>
              <th>No</th>
              <th>Bulan</th>
              <th>B. Indonesia</th>
              <th>Matematika</th>
              <th>IPA</th>
              <th>Target</th>
              <th>Tahfidz</th>
              <th>Tahsin</th>
            </tr>
          </thead>
          <tbody>
            {bulanan.map((b, i) => (
              <tr key={b.bulan}>
                <td>{i + 1}</td>
                <td>{b.bulan}</td>
                <td>{tampil(b.rata_b_indo)}</td>
                <td>{tampil(b.rata_mtk)}</td>
                <td>{tampil(b.rata_ipa)}</td>
                <td>{b.target_akademik}</td>
                <td>
                  {b.capaian_tahfidz === null ? (
                    <span className={gaya.kosong}>–</span>
                  ) : (
                    `${b.capaian_tahfidz} · ${b.nama_tahfidz}`
                  )}
                </td>
                <td>
                  {b.capaian_tahsin === null ? (
                    <span className={gaya.kosong}>–</span>
                  ) : (
                    `${b.capaian_tahsin} · ${b.nama_tahsin}`
                  )}
                </td>
              </tr>
            ))}
            <tr className={gaya.barisRata}>
              <td colSpan={2}>Rata-Rata</td>
              <td>{tampil(rata('rata_b_indo'))}</td>
              <td>{tampil(rata('rata_mtk'))}</td>
              <td>{tampil(rata('rata_ipa'))}</td>
              <td colSpan={3}></td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

/* ================================================================
   Perbandingan dengan teman sekelas — nama teman disamarkan di server
   ================================================================ */
function PerbandinganKelas({ perbandingan, namaAnak }) {
  const bulanTersedia = useMemo(
    () => BULAN_AJARAN.filter((b) => perbandingan[b]?.length),
    [perbandingan]
  );

  const [bulan, setBulan] = useState('');
  const [ukuran, setUkuran] = useState('rata_b_indo');

  useEffect(() => {
    if (bulanTersedia.length && !bulan) {
      setBulan(bulanTersedia[bulanTersedia.length - 1]);
    }
  }, [bulanTersedia, bulan]);

  if (!bulanTersedia.length) return null;

  const baris = (perbandingan[bulan] || []).filter((r) => r[ukuran] !== null);
  const namaUkuran = {
    rata_b_indo: 'B. Indonesia',
    rata_mtk: 'Matematika',
    rata_ipa: 'IPA',
    capaian_tahfidz: 'Tahfidz',
    capaian_tahsin: 'Tahsin',
  }[ukuran];

  return (
    <section className={gaya.kartu}>
      <h2 className={gaya.judulKartu}>Posisi di Kelas</h2>
      <p className={gaya.ketKartu}>
        Nama teman sekelas ditampilkan sebagai inisial demi menjaga privasi mereka.
        Batang berwarna adalah putra/putri Anda.
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
        <label>
          Yang dibandingkan
          <select value={ukuran} onChange={(e) => setUkuran(e.target.value)}>
            <option value="rata_b_indo">B. Indonesia</option>
            <option value="rata_mtk">Matematika</option>
            <option value="rata_ipa">IPA</option>
            <option value="capaian_tahfidz">Tahfidz</option>
            <option value="capaian_tahsin">Tahsin</option>
          </select>
        </label>
      </div>

      {baris.length ? (
        <div className={gaya.grafik}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={baris} margin={{ top: 8, right: 16, bottom: 8, left: -8 }}>
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
              />
              <Tooltip contentStyle={kotakTooltip} />
              <Bar dataKey={ukuran} name={namaUkuran} radius={[4, 4, 0, 0]} maxBarSize={38}>
                {baris.map((r, i) => (
                  <Cell
                    key={i}
                    fill={r.anak ? 'var(--seri-2)' : 'var(--garis)'}
                    stroke={r.anak ? 'var(--seri-2)' : 'var(--tinta-samar)'}
                  />
                ))}
              </Bar>
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className={gaya.kosong}>
          Belum ada data {namaUkuran} untuk bulan {bulan}.
        </p>
      )}

      <p className={gaya.narasi}>{narasiPosisi(baris, ukuran, namaUkuran, namaAnak)}</p>
    </section>
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
