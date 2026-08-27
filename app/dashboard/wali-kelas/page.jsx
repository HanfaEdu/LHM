'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  bulanTerisi,
  muatDaftarKelas,
  muatNilaiKelas,
  muatProfil,
  siswaDalamKelas,
  susunBulananSiswa,
} from '@/lib/data-dasbor';
import { MAPEL, ketuntasan, narasiKelas } from '@/lib/statistik';
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
import TombolLhm from '@/app/komponen/TombolLhm';
import TombolKeluar from '@/app/komponen/TombolKeluar';
import TombolPasang from '@/app/komponen/TombolPasang';
import gaya from '../dasbor.module.css';

export default function DasborWaliKelas() {
  const router = useRouter();
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState('');
  const [profil, setProfil] = useState(null);
  const [daftarKelas, setDaftarKelas] = useState([]);
  const [kelasId, setKelasId] = useState('');
  const [perBulan, setPerBulan] = useState({});
  const [bulan, setBulan] = useState('');
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
          setGalat(
            'Akun ini belum terdaftar sebagai wali kelas. Hubungi admin untuk didaftarkan di sheet users_access.'
          );
          return;
        }
        setProfil(p);

        const semua = await muatDaftarKelas();
        // Kepala sekolah yang membuka halaman ini tetap melihat seluruh
        // kelas; RLS-lah yang menentukan, bukan halaman ini.
        setDaftarKelas(semua);
        if (semua.length) setKelasId(String(semua[0].id));
        else setGalat('Belum ada data kelas yang dapat diakses akun ini.');
      } catch (e) {
        setGalat(e.message || 'Gagal memuat data.');
      } finally {
        setMemuat(false);
      }
    })();
  }, [router]);

  useEffect(() => {
    if (!kelasId) return;
    let batal = false;

    (async () => {
      setMemuat(true);
      try {
        const { perBulan: hasil } = await muatNilaiKelas(kelasId);
        if (batal) return;
        setPerBulan(hasil);
        setNisSiswa(''); // pilihan siswa milik kelas lama, tidak berlaku lagi
        const terisi = bulanTerisi(hasil);
        setBulan(terisi.length ? terisi[terisi.length - 1] : '');
      } catch (e) {
        if (!batal) setGalat(e.message || 'Gagal memuat nilai kelas.');
      } finally {
        if (!batal) setMemuat(false);
      }
    })();

    return () => {
      batal = true;
    };
  }, [kelasId]);

  const kelas = daftarKelas.find((k) => String(k.id) === String(kelasId));
  const daftarBulan = useMemo(() => bulanTerisi(perBulan), [perBulan]);
  const baris = perBulan[bulan] || [];
  const target = Number(kelas?.target_akademik ?? 90);

  // Telusur satu siswa sepanjang tahun ajaran. Wali kelas hanya memegang
  // satu kelas, jadi cukup satu pilihan (nama) -- tidak perlu memilih kelas
  // lebih dulu seperti di dasbor kepala sekolah.
  const daftarSiswa = useMemo(() => siswaDalamKelas(perBulan), [perBulan]);
  const siswaTerpilih = daftarSiswa.find((s) => s.nis === nisSiswa);
  const bulananSiswa = useMemo(
    () => (nisSiswa ? susunBulananSiswa(perBulan, nisSiswa) : null),
    [perBulan, nisSiswa]
  );

  if (galat) {
    return (
      <div className={gaya.halaman}>
        <div className={gaya.pesan}>
          <p>{galat}</p>
        </div>
      </div>
    );
  }

  if (memuat && !kelas) {
    return (
      <div className={gaya.halaman}>
        <div className={gaya.pesan}>
          <p className={gaya.subJudul}>Memuat data…</p>
        </div>
      </div>
    );
  }

  return (
    <div className={gaya.halaman}>
      <div className={gaya.wadah}>
        <KepalaSekolahan
          judul={`Kelas ${kelas?.nama_kelas ?? ''} · ${bulan || 'belum ada data'}`}
          keterangan={`${kelas?.wali_kelas || profil?.nama || ''} · Tahun Ajaran ${
            kelas?.tahun_ajaran ?? ''
          }${baris.length ? ` · ${baris.length} siswa` : ''}`}
          aksi={
            <>
              <TombolLhm />
              <TombolKeluar />
            </>
          }
          anak={
            <div className={gaya.penyaring}>
            {daftarKelas.length > 1 && (
              <label>
                Kelas
                <select value={kelasId} onChange={(e) => setKelasId(e.target.value)}>
                  {daftarKelas.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.nama_kelas} — {k.tahun_ajaran}
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
                disabled={!daftarBulan.length}
              >
                {daftarBulan.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </label>
            {/* Berdiri di baris kontrol yang sama dengan pemilih kelas dan
                bulan, tetapi bukan bagian dari penyaringan: inilah pintu
                ke tempat wali kelas benar-benar bekerja, jadi ia harus
                terlihat tanpa perlu menggulir ke mana pun. */}
            </div>
          }
        />

        <TombolPasang />

        {!baris.length ? (
          <div className={gaya.kartu}>
            <p className={gaya.kosong}>
              Belum ada nilai yang tersinkron untuk kelas ini. Jalankan menu
              SiPaDi → Sinkronkan Sekarang di Master Rekap.
            </p>
          </div>
        ) : (
          <>
            <section className={`${gaya.kartu} ${gaya.kartuRingkas}`}>
              <h2 className={gaya.judulKartu}>Ketuntasan {bulan}</h2>
              <p className={gaya.ketKartu}>
                Persentase siswa yang mencapai target {target}. Siswa yang belum
                dinilai tidak ikut dihitung.
              </p>
              <div className={gaya.barisMeter}>
                {MAPEL.map((m) => (
                  <MeterKetuntasan
                    key={m.kunci}
                    label={m.label}
                    hasil={ketuntasan(baris, m.kunci, target)}
                  />
                ))}
              </div>
              <p className={gaya.narasi}>{narasiKelas(baris, target, bulan)}</p>
            </section>

            <section className={`${gaya.kartu} ${gaya.kartuAkademik}`}>
              <h2 className={gaya.judulKartu}>Capaian Hasil Belajar per Siswa</h2>
              <p className={gaya.ketKartu}>
                Garis merah putus-putus adalah target kelas ({target}).
              </p>
              <GrafikKelasAkademik baris={baris} target={target} />
              <CatatanTerbaik baris={baris} />
            </section>

            <section className={`${gaya.kartu} ${gaya.kartuAkademik}`}>
              <h2 className={gaya.judulKartu}>Sebaran Nilai</h2>
              <p className={gaya.ketKartu}>
                Setiap nilai masuk tepat satu rentang; nilai 70 dihitung di
                kelompok 70–79.
              </p>
              <TabelDistribusi baris={baris} />
            </section>

            <div className={gaya.tumpuk2}>
              <section className={`${gaya.kartu} ${gaya.kartuTahfidz}`}>
                <h2 className={gaya.judulKartu}>Capaian Tahfidz</h2>
                <p className={gaya.ketKartu}>
                  Batang bergaris tepi merah menandai siswa yang masih di bawah target.
                </p>
                <GrafikKelasQuran jenis="tahfidz" baris={baris} />
                <RekapQuran jenis="tahfidz" baris={baris} />
                <KeteranganQuran jenis="tahfidz" />
              </section>

              <section className={`${gaya.kartu} ${gaya.kartuTahsin}`}>
                <h2 className={gaya.judulKartu}>Capaian Tahsin</h2>
                <p className={gaya.ketKartu}>
                  Batang bergaris tepi merah menandai siswa yang masih di bawah target.
                </p>
                <GrafikKelasQuran jenis="tahsin" baris={baris} />
                <RekapQuran jenis="tahsin" baris={baris} />
                <KeteranganQuran jenis="tahsin" />
              </section>
            </div>

            <section className={`${gaya.kartu} ${gaya.kartuTindak}`}>
              <h2 className={gaya.judulKartu}>Perlu Pendampingan</h2>
              <p className={gaya.ketKartu}>
                Siswa yang berada di bawah target pada bulan {bulan}, beserta
                aspek yang perlu ditindaklanjuti.
              </p>
              <PeringatanDini baris={baris} target={target} />
            </section>
          </>
        )}

        {/* Menelusuri satu siswa sepanjang tahun ajaran -- pelengkap grafik
            di atas yang semuanya memotret satu bulan sekaligus seluruh
            kelas. Tampilannya sama persis dengan yang dilihat orang tua
            siswa tersebut, supaya wali kelas tahu apa yang sedang dibaca
            orang tua saat mereka bertanya. */}
        {daftarSiswa.length > 0 && (
          <section className={`${gaya.kartu} ${gaya.kartuAlat}`}>
            <div className={gaya.penyaring} style={{ justifyContent: 'space-between' }}>
              <div>
                <h2 className={gaya.judulKartu}>Telusur Satu Siswa</h2>
                <p className={gaya.ketKartu} style={{ margin: 0 }}>
                  {siswaTerpilih
                    ? `${siswaTerpilih.nama_lengkap} · sepanjang tahun ajaran ${kelas?.tahun_ajaran}`
                    : 'Pilih nama siswa untuk melihat capaiannya sepanjang tahun ajaran.'}
                </p>
              </div>
              <label>
                Nama Siswa
                <select value={nisSiswa} onChange={(e) => setNisSiswa(e.target.value)}>
                  <option value="">— pilih siswa —</option>
                  {daftarSiswa.map((s) => (
                    <option key={s.nis} value={s.nis}>
                      {s.nama_panggilan}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {bulananSiswa && (
              <>
                <h3 className={gaya.subJudulKartu} style={{ marginTop: '1.25rem' }}>
                  Capaian Akademik
                </h3>
                <GrafikTahunanAkademik bulanan={bulananSiswa} target={target} />

                <div className={gaya.tumpuk2} style={{ marginTop: '0.5rem' }}>
                  <div>
                    <h3 className={gaya.subJudulKartu}>Tahfidz</h3>
                    <GrafikTahunanQuran
                      jenis="tahfidz"
                      bulanan={bulananSiswa}
                      warna="var(--seri-1)"
                    />
                    <KeteranganQuran jenis="tahfidz" />
                  </div>
                  <div>
                    <h3 className={gaya.subJudulKartu}>Tahsin</h3>
                    <GrafikTahunanQuran
                      jenis="tahsin"
                      bulanan={bulananSiswa}
                      warna="var(--seri-3)"
                    />
                    <KeteranganQuran jenis="tahsin" />
                  </div>
                </div>
              </>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
