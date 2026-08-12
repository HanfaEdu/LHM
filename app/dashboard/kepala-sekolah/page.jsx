'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { supabase } from '@/lib/supabase';
import { BULAN_AJARAN } from '@/quran_mapping';
import { muatDaftarKelas, muatNilaiKelas, muatProfil } from '@/lib/data-dasbor';
import { MAPEL, bulat, ketuntasan, rataRata, rekapQuran } from '@/lib/statistik';
import {
  CatatanTerbaik,
  GrafikKelasAkademik,
  GrafikKelasQuran,
  MeterKetuntasan,
  PeringatanDini,
  RekapQuran,
  TabelDistribusi,
} from '../komponen';
import gaya from '../dasbor.module.css';

export default function DasborKepalaSekolah() {
  const router = useRouter();
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState('');
  const [profil, setProfil] = useState(null);
  const [daftarKelas, setDaftarKelas] = useState([]);
  const [tahunAjaran, setTahunAjaran] = useState('');
  const [bulan, setBulan] = useState('');
  const [dataKelas, setDataKelas] = useState({}); // kelasId -> perBulan
  const [fokus, setFokus] = useState(''); // kelasId yang sedang ditelusuri

  useEffect(() => {
    (async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) {
          router.push('/login');
          return;
        }

        const p = await muatProfil(session.user.email);
        if (!p) {
          setGalat('Akun ini belum terdaftar. Hubungi admin untuk didaftarkan.');
          return;
        }
        setProfil(p);

        const semua = await muatDaftarKelas();
        if (!semua.length) {
          setGalat('Belum ada data kelas yang dapat diakses.');
          return;
        }
        setDaftarKelas(semua);
        setTahunAjaran(semua[0].tahun_ajaran);
      } catch (e) {
        setGalat(e.message || 'Gagal memuat data.');
      } finally {
        setMemuat(false);
      }
    })();
  }, [router]);

  const kelasTahunIni = useMemo(
    () => daftarKelas.filter((k) => k.tahun_ajaran === tahunAjaran),
    [daftarKelas, tahunAjaran]
  );

  // Memuat seluruh kelas pada tahun ajaran terpilih.
  useEffect(() => {
    if (!kelasTahunIni.length) return;
    let batal = false;

    (async () => {
      setMemuat(true);
      try {
        const hasil = {};
        for (const k of kelasTahunIni) {
          const { perBulan } = await muatNilaiKelas(k.id);
          hasil[k.id] = perBulan;
        }
        if (batal) return;
        setDataKelas(hasil);

        // Bulan terbaru yang sudah punya data di kelas mana pun.
        const adaData = BULAN_AJARAN.filter((b) =>
          Object.values(hasil).some((p) => p[b]?.length)
        );
        setBulan(adaData.length ? adaData[adaData.length - 1] : '');
      } catch (e) {
        if (!batal) setGalat(e.message || 'Gagal memuat nilai kelas.');
      } finally {
        if (!batal) setMemuat(false);
      }
    })();

    return () => {
      batal = true;
    };
  }, [kelasTahunIni]);

  const tahunTersedia = useMemo(
    () => [...new Set(daftarKelas.map((k) => k.tahun_ajaran))],
    [daftarKelas]
  );

  const bulanTersedia = useMemo(
    () => BULAN_AJARAN.filter((b) => Object.values(dataKelas).some((p) => p[b]?.length)),
    [dataKelas]
  );

  const ringkasan = useMemo(
    () =>
      kelasTahunIni.map((k) => {
        const baris = dataKelas[k.id]?.[bulan] || [];
        const target = Number(k.target_akademik ?? 90);
        const perMapel = MAPEL.map((m) => ketuntasan(baris, m.kunci, target));
        const semuaPersen = perMapel.filter(Boolean).map((x) => x.persen);

        return {
          kelas: k,
          baris,
          target,
          jumlah: baris.length,
          perMapel,
          ketuntasanRata: semuaPersen.length ? rataRata(semuaPersen) : null,
          tahfidz: rekapQuran(baris, 'capaian_tahfidz', 'target_tahfidz'),
          tahsin: rekapQuran(baris, 'capaian_tahsin', 'target_tahsin'),
        };
      }),
    [kelasTahunIni, dataKelas, bulan]
  );

  const grafikKelas = ringkasan
    .filter((r) => r.jumlah)
    .map((r) => ({
      nama: r.kelas.nama_kelas,
      'B. Indonesia': r.perMapel[0]?.persen ?? null,
      Matematika: r.perMapel[1]?.persen ?? null,
      IPA: r.perMapel[2]?.persen ?? null,
    }));

  const kelasFokus = ringkasan.find((r) => String(r.kelas.id) === String(fokus));

  if (galat) {
    return (
      <div className={gaya.halaman}>
        <div className={gaya.pesan}>
          <p>{galat}</p>
        </div>
      </div>
    );
  }

  if (memuat && !ringkasan.length) {
    return (
      <div className={gaya.halaman}>
        <div className={gaya.pesan}>
          <p className={gaya.subJudul}>Memuat data seluruh kelas…</p>
        </div>
      </div>
    );
  }

  return (
    <div className={gaya.halaman}>
      <div className={gaya.wadah}>
        <header className={gaya.kepala}>
          <div>
            <h1 className={gaya.judul}>Dasbor Sekolah · {bulan || 'belum ada data'}</h1>
            <p className={gaya.subJudul}>
              {profil?.nama} · {kelasTahunIni.length} kelas · Tahun Ajaran {tahunAjaran}
            </p>
          </div>

          <div className={gaya.penyaring}>
            {tahunTersedia.length > 1 && (
              <label>
                Tahun Ajaran
                <select
                  value={tahunAjaran}
                  onChange={(e) => {
                    setTahunAjaran(e.target.value);
                    setFokus('');
                  }}
                >
                  {tahunTersedia.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label>
              Bulan
              <select
                value={bulan}
                onChange={(e) => setBulan(e.target.value)}
                disabled={!bulanTersedia.length}
              >
                {bulanTersedia.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </header>

        <section className={gaya.kartu}>
          <h2 className={gaya.judulKartu}>Ketuntasan Antar Kelas</h2>
          <p className={gaya.ketKartu}>
            Persentase siswa yang mencapai target pada bulan {bulan}. Garis merah
            adalah ambang 80% — di bawah itu perlu perhatian khusus.
          </p>

          {grafikKelas.length ? (
            <div className={gaya.grafik}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={grafikKelas} margin={{ top: 8, right: 16, bottom: 8, left: -8 }}>
                  <CartesianGrid stroke="var(--garis)" vertical={false} />
                  <XAxis
                    dataKey="nama"
                    tick={{ fontSize: 12, fill: 'var(--tinta-lembut)' }}
                    tickLine={false}
                    axisLine={{ stroke: 'var(--garis)' }}
                  />
                  <YAxis
                    domain={[0, 100]}
                    unit="%"
                    tick={{ fontSize: 11, fill: 'var(--tinta-lembut)' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--kartu)',
                      border: '1px solid var(--garis)',
                      borderRadius: 8,
                      fontSize: 12,
                      color: 'var(--tinta)',
                    }}
                    formatter={(v, n) => [v === null ? 'belum dinilai' : `${bulat(v, 1)}%`, n]}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 12 }}
                    formatter={(nilai) => (
                      <span style={{ color: 'var(--tinta-lembut)' }}>{nilai}</span>
                    )}
                  />
                  <ReferenceLine y={80} stroke="var(--target)" strokeWidth={2} strokeDasharray="6 4" />
                  <Bar dataKey="B. Indonesia" fill="var(--seri-1)" radius={[4, 4, 0, 0]} maxBarSize={28} />
                  <Bar dataKey="Matematika" fill="var(--seri-2)" radius={[4, 4, 0, 0]} maxBarSize={28} />
                  <Bar dataKey="IPA" fill="var(--seri-3)" radius={[4, 4, 0, 0]} maxBarSize={28} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className={gaya.kosong}>Belum ada nilai untuk bulan ini.</p>
          )}
        </section>

        <section className={gaya.kartu}>
          <h2 className={gaya.judulKartu}>Rekap Seluruh Kelas</h2>
          <p className={gaya.ketKartu}>
            Klik nama kelas untuk menelusuri rinciannya.
          </p>
          <div className={gaya.gulir}>
            <table className={gaya.tabel}>
              <thead>
                <tr>
                  <th className={gaya.kiri}>Kelas</th>
                  <th className={gaya.kiri}>Wali Kelas</th>
                  <th>Siswa</th>
                  {MAPEL.map((m) => (
                    <th key={m.kunci}>{m.pendek}</th>
                  ))}
                  <th>Tuntas Tahfidz</th>
                  <th>Tuntas Tahsin</th>
                </tr>
              </thead>
              <tbody>
                {ringkasan.map((r) => (
                  <tr key={r.kelas.id}>
                    <td className={gaya.kiri}>
                      <button
                        type="button"
                        className={`${gaya.tombolKecil} ${
                          String(fokus) === String(r.kelas.id) ? gaya.tombolKecilAktif : ''
                        }`}
                        onClick={() =>
                          setFokus(String(fokus) === String(r.kelas.id) ? '' : String(r.kelas.id))
                        }
                      >
                        {r.kelas.nama_kelas}
                      </button>
                    </td>
                    <td className={gaya.kiri}>{r.kelas.wali_kelas || '–'}</td>
                    <td>{r.jumlah || <span className={gaya.kosong}>–</span>}</td>
                    {r.perMapel.map((k, i) => (
                      <td key={i}>
                        {k ? `${bulat(k.persen)}%` : <span className={gaya.kosong}>–</span>}
                      </td>
                    ))}
                    <td>
                      {r.tahfidz.persenTuntas === null ? (
                        <span className={gaya.kosong}>–</span>
                      ) : (
                        `${bulat(r.tahfidz.persenTuntas)}%`
                      )}
                    </td>
                    <td>
                      {r.tahsin.persenTuntas === null ? (
                        <span className={gaya.kosong}>–</span>
                      ) : (
                        `${bulat(r.tahsin.persenTuntas)}%`
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {kelasFokus && kelasFokus.jumlah > 0 && (
          <>
            <section className={gaya.kartu}>
              <h2 className={gaya.judulKartu}>
                Rincian Kelas {kelasFokus.kelas.nama_kelas} · {bulan}
              </h2>
              <p className={gaya.ketKartu}>
                {kelasFokus.kelas.wali_kelas} · {kelasFokus.jumlah} siswa · target{' '}
                {kelasFokus.target}
              </p>
              <div className={gaya.barisMeter}>
                {MAPEL.map((m, i) => (
                  <MeterKetuntasan
                    key={m.kunci}
                    label={m.label}
                    hasil={kelasFokus.perMapel[i]}
                  />
                ))}
              </div>
              <GrafikKelasAkademik baris={kelasFokus.baris} target={kelasFokus.target} />
              <CatatanTerbaik baris={kelasFokus.baris} />
            </section>

            <section className={gaya.kartu}>
              <h2 className={gaya.judulKartu}>Sebaran Nilai</h2>
              <TabelDistribusi baris={kelasFokus.baris} />
            </section>

            <div className={gaya.tumpuk2}>
              <section className={gaya.kartu}>
                <h2 className={gaya.judulKartu}>Tahfidz</h2>
                <GrafikKelasQuran jenis="tahfidz" baris={kelasFokus.baris} />
                <RekapQuran jenis="tahfidz" baris={kelasFokus.baris} />
              </section>
              <section className={gaya.kartu}>
                <h2 className={gaya.judulKartu}>Tahsin</h2>
                <GrafikKelasQuran jenis="tahsin" baris={kelasFokus.baris} />
                <RekapQuran jenis="tahsin" baris={kelasFokus.baris} />
              </section>
            </div>

            <section className={gaya.kartu}>
              <h2 className={gaya.judulKartu}>Perlu Pendampingan</h2>
              <PeringatanDini baris={kelasFokus.baris} target={kelasFokus.target} />
            </section>
          </>
        )}
      </div>
    </div>
  );
}
