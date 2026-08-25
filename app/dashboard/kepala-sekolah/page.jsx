'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { supabase } from '@/lib/supabase';
import { BULAN_AJARAN } from '@/quran_mapping';
import {
  muatDaftarKelas,
  muatNilaiKelas,
  muatProfil,
  siswaDalamKelas,
  susunBulananSiswa,
} from '@/lib/data-dasbor';
import {
  AMBANG_KETUNTASAN,
  MAPEL,
  adaIsiBulan,
  bulat,
  ketuntasan,
  narasiKelas,
  rataRata,
  rekapQuran,
} from '@/lib/statistik';
import {
  CatatanTerbaik,
  GrafikKelasAkademik,
  GrafikKelasQuran,
  GrafikTahunanAkademik,
  GrafikTahunanQuran,
  KeteranganQuran,
  MeterKetuntasan,
  PeringatanDini,
  RekapQuran,
  TabelDistribusi,
} from '../komponen';
import KepalaSekolahan from '@/app/komponen/KepalaSekolahan';
import LegendaGrafik from '@/app/komponen/LegendaGrafik';
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
  const [kelasSiswa, setKelasSiswa] = useState(''); // kelasId untuk telusur per siswa
  const [nisSiswa, setNisSiswa] = useState('');

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

        // Bulan terbaru yang sudah benar-benar dinilai di kelas mana pun.
        // Diukur dari isi barisnya: sinkronisasi membuat baris untuk kedua
        // belas bulan sekaligus, jadi menghitung baris saja akan selalu
        // mendarat di Juni sepanjang tahun ajaran.
        const adaData = BULAN_AJARAN.filter((b) =>
          Object.values(hasil).some((p) => adaIsiBulan(p[b]))
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
    () => BULAN_AJARAN.filter((b) => Object.values(dataKelas).some((p) => adaIsiBulan(p[b]))),
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
      ambang: AMBANG_KETUNTASAN,
    }));

  const kelasFokus = ringkasan.find((r) => String(r.kelas.id) === String(fokus));

  // --- Telusur satu siswa: pilih kelas, lalu pilih nama ---
  const kelasSiswaObj = kelasTahunIni.find((k) => String(k.id) === String(kelasSiswa));
  const daftarSiswaKelasSiswa = useMemo(
    () => (kelasSiswa ? siswaDalamKelas(dataKelas[kelasSiswa] || {}) : []),
    [dataKelas, kelasSiswa]
  );
  const siswaTerpilih = daftarSiswaKelasSiswa.find((s) => s.nis === nisSiswa);
  const targetSiswa = Number(kelasSiswaObj?.target_akademik ?? 90);
  const bulananSiswa = useMemo(() => {
    if (!kelasSiswa || !nisSiswa) return null;
    return susunBulananSiswa(dataKelas[kelasSiswa] || {}, nisSiswa);
  }, [dataKelas, kelasSiswa, nisSiswa]);

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
        <KepalaSekolahan
          judul={`Dasbor Sekolah · ${bulan || 'belum ada data'}`}
          keterangan={`${profil?.nama ?? ''} · ${kelasTahunIni.length} kelas`}
          anak={
            <div className={gaya.penyaring}>
            {/* Selalu ditampilkan, bukan hanya saat sudah ada lebih dari satu
                tahun -- sama seperti dasbor orang tua. Begitu tahun kedua
                berjalan, kolom ini otomatis berubah dari teks menjadi menu
                pilihan tanpa perlu disentuh lagi. */}
            <label>
              Tahun Ajaran
              {tahunTersedia.length > 1 ? (
                <select
                  value={tahunAjaran}
                  onChange={(e) => {
                    setTahunAjaran(e.target.value);
                    setFokus('');
                    setKelasSiswa('');
                    setNisSiswa('');
                  }}
                >
                  {tahunTersedia.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              ) : (
                <span className={gaya.nilaiStatis}>{tahunAjaran}</span>
              )}
            </label>
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
            <Link href="/dashboard/kepala-sekolah/tautan" className={gaya.tombolAksi}>
              Tautan Orang Tua
            </Link>
            </div>
          }
        />

        <section className={gaya.kartu}>
          <h2 className={gaya.judulKartu}>Ketuntasan Antar Kelas</h2>
          <p className={gaya.ketKartu}>
            Persentase siswa yang mencapai target pada bulan {bulan}. Garis merah
            adalah ambang ketuntasan {AMBANG_KETUNTASAN}% — di bawah itu perlu
            perhatian khusus.
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
                  <Legend content={<LegendaGrafik />} />
                  {/* Sebagai seri, bukan ReferenceLine, supaya simbol garis
                      merah putus-putusnya ikut muncul di legenda. */}
                  <Line
                    dataKey="ambang"
                    name={`Ambang ${AMBANG_KETUNTASAN}%`}
                    stroke="var(--target)"
                    strokeWidth={2}
                    strokeDasharray="6 4"
                    dot={false}
                    activeDot={false}
                    connectNulls
                  />
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

        {/* Pemilih kelas berada di LUAR blok bersyarat di bawahnya. Kalau
            ditaruh di dalam, dropdown-nya baru muncul setelah sebuah kelas
            sudah terpilih -- artinya tidak pernah bisa dipakai untuk memilih
            kelas yang pertama. */}
        <section className={gaya.kartu}>
          <div className={gaya.penyaring} style={{ justifyContent: 'space-between' }}>
            <div>
              <h2 className={gaya.judulKartu}>
                Rincian Per Kelas
                {kelasFokus ? ` · Kelas ${kelasFokus.kelas.nama_kelas} · ${bulan}` : ''}
              </h2>
              <p className={gaya.ketKartu} style={{ margin: 0 }}>
                {kelasFokus
                  ? `${kelasFokus.kelas.wali_kelas || '–'} · ${kelasFokus.jumlah} siswa · target ${kelasFokus.target}`
                  : 'Pilih satu kelas untuk melihat grafik tiga mapel, sebaran nilai, Tahfidz, dan Tahsin kelas itu.'}
              </p>
            </div>
            <label>
              Pilih Kelas
              <select value={fokus} onChange={(e) => setFokus(e.target.value)}>
                <option value="">— pilih kelas —</option>
                {ringkasan.map((r) => (
                  <option key={r.kelas.id} value={r.kelas.id}>
                    {r.kelas.nama_kelas}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {kelasFokus && kelasFokus.jumlah > 0 && (
            <>
              <div className={gaya.barisMeter}>
                {MAPEL.map((m, i) => (
                  <MeterKetuntasan
                    key={m.kunci}
                    label={m.label}
                    hasil={kelasFokus.perMapel[i]}
                  />
                ))}
              </div>
              <p className={gaya.narasi}>
                {narasiKelas(kelasFokus.baris, kelasFokus.target, bulan)}
              </p>
              <GrafikKelasAkademik baris={kelasFokus.baris} target={kelasFokus.target} />
              <CatatanTerbaik baris={kelasFokus.baris} />
            </>
          )}

          {kelasFokus && kelasFokus.jumlah === 0 && (
            <p className={gaya.kosong}>
              Kelas {kelasFokus.kelas.nama_kelas} belum punya nilai untuk bulan {bulan}.
            </p>
          )}
        </section>

        {kelasFokus && kelasFokus.jumlah > 0 && (
          <>

            <section className={gaya.kartu}>
              <h2 className={gaya.judulKartu}>Sebaran Nilai</h2>
              <TabelDistribusi baris={kelasFokus.baris} />
            </section>

            <div className={gaya.tumpuk2}>
              <section className={gaya.kartu}>
                <h2 className={gaya.judulKartu}>Tahfidz</h2>
                <GrafikKelasQuran jenis="tahfidz" baris={kelasFokus.baris} />
                <RekapQuran jenis="tahfidz" baris={kelasFokus.baris} />
                <KeteranganQuran jenis="tahfidz" />
              </section>
              <section className={gaya.kartu}>
                <h2 className={gaya.judulKartu}>Tahsin</h2>
                <GrafikKelasQuran jenis="tahsin" baris={kelasFokus.baris} />
                <RekapQuran jenis="tahsin" baris={kelasFokus.baris} />
                <KeteranganQuran jenis="tahsin" />
              </section>
            </div>

            <section className={gaya.kartu}>
              <h2 className={gaya.judulKartu}>Perlu Pendampingan</h2>
              <PeringatanDini baris={kelasFokus.baris} target={kelasFokus.target} />
            </section>
          </>
        )}

        {/* Menelusuri satu siswa tertentu, bukan seluruh kelas sekaligus --
            dua pilihan (kelas, lalu nama) supaya daftar nama tidak perlu
            memuat seluruh 113 siswa sekaligus. Kosong secara bawaan, sama
            seperti drill-down kelas di atas. */}
        <section className={gaya.kartu}>
          <h2 className={gaya.judulKartu}>Telusur Satu Siswa</h2>
          <p className={gaya.ketKartu}>
            Pilih kelas, lalu nama siswa, untuk melihat capaiannya sepanjang
            tahun ajaran {tahunAjaran} — tampilan yang sama seperti yang
            dilihat orang tua siswa tersebut.
          </p>

          <div className={gaya.penyaring}>
            <label>
              Kelas
              <select
                value={kelasSiswa}
                onChange={(e) => {
                  setKelasSiswa(e.target.value);
                  setNisSiswa('');
                }}
              >
                <option value="">— pilih kelas —</option>
                {kelasTahunIni.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.nama_kelas}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Nama Siswa
              <select
                value={nisSiswa}
                onChange={(e) => setNisSiswa(e.target.value)}
                disabled={!daftarSiswaKelasSiswa.length}
              >
                <option value="">— pilih siswa —</option>
                {daftarSiswaKelasSiswa.map((s) => (
                  <option key={s.nis} value={s.nis}>
                    {s.nama_panggilan}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {bulananSiswa && (
            <>
              <h3 className={gaya.judulKartu} style={{ marginTop: '1.25rem' }}>
                Capaian Akademik · {siswaTerpilih?.nama_lengkap}
              </h3>
              <GrafikTahunanAkademik bulanan={bulananSiswa} target={targetSiswa} />

              <div className={gaya.tumpuk2} style={{ marginTop: '0.5rem' }}>
                <div>
                  <h3 className={gaya.judulKartu}>Tahfidz</h3>
                  <GrafikTahunanQuran jenis="tahfidz" bulanan={bulananSiswa} warna="var(--seri-1)" />
                  <KeteranganQuran jenis="tahfidz" />
                </div>
                <div>
                  <h3 className={gaya.judulKartu}>Tahsin</h3>
                  <GrafikTahunanQuran jenis="tahsin" bulanan={bulananSiswa} warna="var(--seri-3)" />
                  <KeteranganQuran jenis="tahsin" />
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
