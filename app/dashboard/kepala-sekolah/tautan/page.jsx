'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { TriangleAlert } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { muatDaftarKelas, muatProfil } from '@/lib/data-dasbor';
import { buatXlsx, unduhBlob } from '@/lib/xlsx';
import KepalaSekolahan from '@/app/komponen/KepalaSekolahan';
import gaya from '../../dasbor.module.css';

/**
 * Pengelolaan tautan rapor orang tua.
 *
 * Seluruh operasi lewat /api/tautan, bukan langsung ke Supabase: tabel
 * akses_ortu tidak punya policy SELECT, karena token adalah kredensial
 * yang tidak boleh terbaca dari browser dengan anon key.
 */
export default function HalamanTautan() {
  const router = useRouter();
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState('');
  const [pesan, setPesan] = useState('');
  const [profil, setProfil] = useState(null);
  const [tahunTersedia, setTahunTersedia] = useState([]);
  const [tahunAjaran, setTahunAjaran] = useState('');
  const [daftar, setDaftar] = useState([]);
  const [kelasPilih, setKelasPilih] = useState('semua');
  /* Biro akademik melihat siswa dari beberapa sekolah sekaligus. Tanpa
     penyaring ini, "A1" milik Kudus dan "A1" milik Pati berjajar dalam
     satu daftar tanpa bisa dibedakan -- dan tautan bisa diterbitkan ke
     kelas yang salah. Kepala sekolah tidak pernah melihat penyaring ini
     karena daftarnya hanya berisi satu sekolah. */
  const [sekolahPilih, setSekolahPilih] = useState('semua');
  const [sibuk, setSibuk] = useState(false);

  /** Memanggil /api/tautan dengan token sesi yang sedang berlaku. */
  const panggil = useCallback(async (isi) => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      router.push('/login');
      throw new Error('Sesi berakhir.');
    }

    const respons = await fetch('/api/tautan', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(isi),
    });

    const hasil = await respons.json();
    if (!respons.ok) throw new Error(hasil.error || 'Permintaan gagal.');
    return hasil;
  }, [router]);

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
        /* Biro akademik ikut mengelola tautan orang tua, dibatasi ke
           sekolah-sekolah dalam areanya. Penjagaan yang sesungguhnya ada
           di /api/tautan -- endpoint itu memakai service_role dan
           memeriksa sendiri sekolah pemanggilnya; pemeriksaan di sini
           hanya supaya orang yang salah alamat mendapat kalimat yang
           jelas, bukan tabel kosong. */
        if (p?.role !== 'kepala_sekolah' && p?.role !== 'direktur_area') {
          setGalat('Halaman ini hanya untuk kepala sekolah dan biro akademik.');
          return;
        }
        setProfil(p);

        const kelas = await muatDaftarKelas();
        const tahun = [...new Set(kelas.map((k) => k.tahun_ajaran))];
        setTahunTersedia(tahun);
        setTahunAjaran(tahun[0] || '');
      } catch (e) {
        setGalat(e.message || 'Gagal memuat data.');
      } finally {
        setMemuat(false);
      }
    })();
  }, [router]);

  const muatDaftar = useCallback(
    async (tahun) => {
      if (!tahun) return;
      setMemuat(true);
      setGalat('');
      try {
        const hasil = await panggil({ aksi: 'daftar', tahunAjaran: tahun });
        setDaftar(hasil.daftar || []);
      } catch (e) {
        setGalat(e.message);
      } finally {
        setMemuat(false);
      }
    },
    [panggil]
  );

  useEffect(() => {
    if (tahunAjaran) muatDaftar(tahunAjaran);
  }, [tahunAjaran, muatDaftar]);

  const daftarSekolah = useMemo(
    () =>
      [...new Set(daftar.map((d) => d.nama_sekolah).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, 'id')
      ),
    [daftar]
  );
  const banyakSekolah = daftarSekolah.length > 1;

  /* Disaring sekolah DULU, baru kelas: dua sekolah bisa punya nama kelas
     yang sama persis, jadi daftar kelasnya pun harus mengikuti sekolah
     yang sedang dipilih -- kalau tidak, memilih "A1" akan menampilkan
     siswa dari dua sekolah sekaligus. */
  const sesuaiSekolah = useMemo(
    () =>
      sekolahPilih === 'semua'
        ? daftar
        : daftar.filter((d) => d.nama_sekolah === sekolahPilih),
    [daftar, sekolahPilih]
  );

  const daftarKelas = useMemo(
    () =>
      [...new Set(sesuaiSekolah.map((d) => d.nama_kelas))].sort((a, b) =>
        a.localeCompare(b, 'id')
      ),
    [sesuaiSekolah]
  );

  // Kelas yang dipilih bisa saja tidak ada di sekolah yang baru dipilih.
  useEffect(() => {
    if (kelasPilih !== 'semua' && !daftarKelas.includes(kelasPilih)) {
      setKelasPilih('semua');
    }
  }, [daftarKelas, kelasPilih]);

  const tampil = useMemo(
    () =>
      kelasPilih === 'semua'
        ? sesuaiSekolah
        : sesuaiSekolah.filter((d) => d.nama_kelas === kelasPilih),
    [sesuaiSekolah, kelasPilih]
  );

  const belumPunya = tampil.filter((d) => !d.token);

  /**
   * Tautan selalu dibangun dari alamat RESMI aplikasi, bukan dari alamat
   * yang kebetulan sedang dibuka.
   *
   * Vercel menyediakan beberapa alamat cadangan untuk proyek yang sama --
   * mis. lhm-<slug-akun>.vercel.app, yang tetap hidup setelah nama proyek
   * diganti. Kalau tautan dibangun dari window.location.origin, kepala
   * sekolah yang membuka dasbor lewat salah satu alamat cadangan akan
   * menerbitkan dan mengunduh tautan beralamat cadangan itu, lalu
   * membagikannya ke ratusan orang tua. Tautannya berfungsi, tetapi
   * alamatnya bukan alamat resmi sekolah dan tidak bisa ditarik kembali
   * setelah tersebar.
   *
   * window.location.origin hanya dipakai kalau NEXT_PUBLIC_SITE_URL belum
   * terisi sama sekali (mis. saat dijalankan lokal).
   */
  const [asalCadangan, setAsalCadangan] = useState('');
  useEffect(() => setAsalCadangan(window.location.origin), []);

  const asalDomain = process.env.NEXT_PUBLIC_SITE_URL || asalCadangan;
  const tautanPenuh = (token) => `${asalDomain}/rapor/${token}`;
  const bedaAlamat = Boolean(asalCadangan && asalDomain && asalCadangan !== asalDomain);

  async function terbitkan(nisDaftar) {
    if (!nisDaftar.length) return;
    setSibuk(true);
    setPesan('');
    setGalat('');
    try {
      const hasil = await panggil({ aksi: 'terbitkan', nisDaftar });
      setPesan(
        `${hasil.diterbitkan} tautan diterbitkan` +
          (hasil.dilewati ? `, ${hasil.dilewati} dilewati karena sudah punya.` : '.')
      );
      await muatDaftar(tahunAjaran);
    } catch (e) {
      setGalat(e.message);
    } finally {
      setSibuk(false);
    }
  }

  /**
   * Mengganti token seorang siswa.
   *
   * Akibatnya lebih jauh daripada sekadar "tautan lama mati", dan itu
   * yang perlu disebut sebelum tombolnya ditekan: identitas aplikasi
   * yang dipasang orang tua di layar utama HP-nya berasal dari token
   * ini. Token berganti berarti aplikasi yang sudah terpasang menjadi
   * aplikasi yang berbeda -- ikonnya tetap ada tetapi tidak lagi bisa
   * membuka rapor apa pun, dan orang tua harus memasang ulang dari
   * tautan yang baru.
   *
   * Kalau yang dibutuhkan hanya menutup akses sementara, "Nonaktifkan"
   * jauh lebih tepat: token-nya tidak berubah, jadi aplikasi yang sudah
   * terpasang kembali berfungsi begitu diaktifkan lagi. Karena itu
   * jalan keluar itu ikut disebut di dalam peringatan ini -- peringatan
   * yang hanya melarang tanpa menawarkan jalan lain cenderung diabaikan.
   */
  async function ganti(nis, nama) {
    if (
      !window.confirm(
        `Ganti tautan ${nama}?\n\n` +
          '• Tautan lama langsung berhenti berfungsi, dan tautan baru ' +
          'harus dikirim ulang ke orang tuanya.\n\n' +
          '• Kalau orang tuanya sudah memasang rapor ini sebagai aplikasi ' +
          'di layar utama HP, ikon itu ikut mati. Mereka harus memasang ' +
          'ulang dari tautan yang baru.\n\n' +
          'Kalau hanya ingin menutup akses sementara, pakai "Nonaktifkan" ' +
          '— tautan dan aplikasinya tetap utuh dan bisa dihidupkan lagi.'
      )
    ) {
      return;
    }
    setSibuk(true);
    setPesan('');
    setGalat('');
    try {
      await panggil({ aksi: 'ganti', nis });
      setPesan(
        `Tautan ${nama} sudah diganti. Kirim ulang tautan barunya — dan ` +
          'kalau orang tuanya sudah memasangnya sebagai aplikasi, minta ' +
          'mereka memasang ulang dari tautan yang baru.'
      );
      await muatDaftar(tahunAjaran);
    } catch (e) {
      setGalat(e.message);
    } finally {
      setSibuk(false);
    }
  }

  async function ubahAktif(nis, nama, aktifBaru) {
    setSibuk(true);
    setPesan('');
    setGalat('');
    try {
      await panggil({ aksi: 'aktif', nis, aktif: aktifBaru });
      setPesan(`Tautan ${nama} ${aktifBaru ? 'diaktifkan kembali' : 'dinonaktifkan'}.`);
      await muatDaftar(tahunAjaran);
    } catch (e) {
      setGalat(e.message);
    } finally {
      setSibuk(false);
    }
  }

  /**
   * Unduh Excel: satu lembar per kelas, supaya kepala sekolah bisa
   * meneruskan satu berkas ini ke seluruh wali kelas, dan tiap wali kelas
   * langsung menemukan lembar kelasnya sendiri.
   */
  function unduhExcel() {
    const kelasDiunduh =
      kelasPilih === 'semua' ? daftarKelas : [kelasPilih];

    const lembar = kelasDiunduh.map((namaKelas) => {
      const baris = sesuaiSekolah.filter((d) => d.nama_kelas === namaKelas);
      return {
        nama: `Kelas ${namaKelas}`,
        baris: [
          ['No', 'NIS', 'Nama Lengkap', 'Nama Panggilan', 'Kelas', 'Status', 'Tautan Rapor'],
          ...baris.map((d, i) => [
            String(i + 1),
            d.nis,
            d.nama_lengkap,
            d.nama_panggilan,
            d.nama_kelas,
            !d.token ? 'Belum ada tautan' : d.aktif ? 'Aktif' : 'Nonaktif',
            d.token ? tautanPenuh(d.token) : '',
          ]),
        ],
      };
    });

    if (!lembar.length) return;

    const namaBerkas =
      kelasPilih === 'semua'
        ? `Tautan Rapor ${tahunAjaran}.xlsx`
        : `Tautan Rapor Kelas ${kelasPilih} ${tahunAjaran}.xlsx`;

    unduhBlob(buatXlsx(lembar), namaBerkas);
  }

  if (galat && !daftar.length) {
    return (
      <div className={gaya.halaman}>
        <div className={gaya.pesan}>
          <p>{galat}</p>
          <p style={{ marginTop: '1rem' }}>
            <Link href="/dashboard/kepala-sekolah">← Kembali ke dasbor</Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={gaya.halaman}>
      <div className={gaya.wadah}>
        <KepalaSekolahan
          judul="Tautan Rapor Orang Tua"
          keterangan={`${profil?.nama ?? ''} · ${daftar.length} siswa terdaftar`}
          anak={
            <div className={gaya.penyaring}>
              <label>
                Tahun Ajaran
                {tahunTersedia.length > 1 ? (
                  <select
                    value={tahunAjaran}
                    onChange={(e) => setTahunAjaran(e.target.value)}
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
              {/* Hanya muncul kalau daftarnya memang memuat lebih dari satu
                  sekolah -- bagi kepala sekolah, baris kontrolnya tidak
                  berubah sedikit pun. */}
              {banyakSekolah && (
                <label>
                  Sekolah
                  <select
                    value={sekolahPilih}
                    onChange={(e) => setSekolahPilih(e.target.value)}
                  >
                    <option value="semua">Semua sekolah</option>
                    {daftarSekolah.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label>
                Kelas
                <select value={kelasPilih} onChange={(e) => setKelasPilih(e.target.value)}>
                  <option value="semua">Semua kelas</option>
                  {daftarKelas.map((k) => (
                    <option key={k} value={k}>
                      Kelas {k}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          }
        />

        <section className={gaya.kartu}>
          <p className={gaya.ketKartu} style={{ marginBottom: '0.85rem' }}>
            Tautan bersifat pribadi per siswa dan berlaku lintas tahun ajaran —
            tidak perlu diterbitkan ulang saat naik kelas. Unduh Excel untuk
            dibagikan ke wali kelas; tiap kelas berada di lembar tersendiri.
          </p>

          {/* Ditulis di halaman, bukan hanya di kotak konfirmasi: kotak
              konfirmasi baru terbaca setelah tombolnya terlanjur ditekan,
              sementara pertimbangan "Ganti atau Nonaktifkan" perlu ada
              sebelum itu. */}
          <p className={gaya.catatanGanti}>
            <TriangleAlert size={16} aria-hidden="true" />
            <span>
              <strong>Ganti</strong> membuat token baru: tautan lama mati, dan
              aplikasi rapor yang sudah dipasang orang tua di layar utama HP
              ikut mati sehingga harus dipasang ulang. Untuk menutup akses
              sementara, pakai <strong>Nonaktifkan</strong> — tautan dan
              aplikasinya tetap utuh.
            </span>
          </p>

          <div className={gaya.penyaring} style={{ marginBottom: '0.85rem' }}>
            <button
              type="button"
              className={gaya.tombolAksi}
              onClick={() => terbitkan(belumPunya.map((d) => d.nis))}
              disabled={sibuk || !belumPunya.length}
            >
              Terbitkan {belumPunya.length ? `${belumPunya.length} ` : ''}tautan baru
            </button>
            <button
              type="button"
              className={`${gaya.tombolAksi} ${gaya.tombolSekunder}`}
              onClick={unduhExcel}
              disabled={sibuk || !daftar.length}
            >
              Unduh Excel
            </button>
            <Link href="/dashboard/kepala-sekolah" className={gaya.tautanKembali}>
              ← Kembali ke dasbor
            </Link>
          </div>

          {bedaAlamat && (
            <p className={`${gaya.narasi} ${gaya.peringatan}`}>
              Dasbor ini sedang dibuka lewat alamat cadangan{' '}
              <strong>{asalCadangan}</strong>. Tautan yang diterbitkan dan
              diunduh tetap memakai alamat resmi{' '}
              <strong>{asalDomain}</strong>, jadi aman dibagikan — tetapi
              sebaiknya dasbor dibuka dari alamat resmi itu juga.
            </p>
          )}

          {pesan && <p className={gaya.narasi}>{pesan}</p>}
          {galat && (
            <p className={`${gaya.narasi} ${gaya.peringatan}`}>{galat}</p>
          )}

          {memuat ? (
            <p className={gaya.kosong}>Memuat daftar…</p>
          ) : (
            <div className={gaya.gulir}>
              <table className={gaya.tabel}>
                <thead>
                  <tr>
                    <th>No</th>
                    <th className={gaya.kiri}>Nama Lengkap</th>
                    {banyakSekolah && <th className={gaya.kiri}>Sekolah</th>}
                    <th>Kelas</th>
                    <th>Status</th>
                    <th className={gaya.kiri}>Tautan</th>
                    <th>Tindakan</th>
                  </tr>
                </thead>
                <tbody>
                  {tampil.map((d, i) => (
                    <tr key={d.nis}>
                      <td>{i + 1}</td>
                      <td className={gaya.kiri}>{d.nama_lengkap}</td>
                      {banyakSekolah && (
                        <td className={gaya.kiri}>{d.nama_sekolah}</td>
                      )}
                      <td>{d.nama_kelas}</td>
                      <td>
                        {!d.token ? (
                          <span className={gaya.kosong}>belum ada</span>
                        ) : d.aktif ? (
                          'Aktif'
                        ) : (
                          'Nonaktif'
                        )}
                      </td>
                      <td className={`${gaya.kiri} ${gaya.selTautan}`}>
                        {d.token ? (
                          <code>{tautanPenuh(d.token)}</code>
                        ) : (
                          <span className={gaya.kosong}>–</span>
                        )}
                      </td>
                      <td>
                        <div className={gaya.tindakan}>
                          {!d.token ? (
                            <button
                              type="button"
                              className={gaya.tombolKecil}
                              onClick={() => terbitkan([d.nis])}
                              disabled={sibuk}
                            >
                              Terbitkan
                            </button>
                          ) : (
                            <>
                              <button
                                type="button"
                                className={gaya.tombolKecil}
                                onClick={() =>
                                  navigator.clipboard
                                    ?.writeText(tautanPenuh(d.token))
                                    .then(() => setPesan(`Tautan ${d.nama_panggilan} disalin.`))
                                }
                              >
                                Salin
                              </button>
                              <button
                                type="button"
                                className={gaya.tombolKecil}
                                onClick={() => ubahAktif(d.nis, d.nama_panggilan, !d.aktif)}
                                disabled={sibuk}
                              >
                                {d.aktif ? 'Nonaktifkan' : 'Aktifkan'}
                              </button>
                              <button
                                type="button"
                                className={gaya.tombolKecil}
                                onClick={() => ganti(d.nis, d.nama_panggilan)}
                                disabled={sibuk}
                              >
                                Ganti
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
