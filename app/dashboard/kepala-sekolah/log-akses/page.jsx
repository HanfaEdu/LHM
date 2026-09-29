'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { muatProfil, muatLogAksesRapor } from '@/lib/data-dasbor';
import KepalaSekolahan from '@/app/komponen/KepalaSekolahan';
import gaya from '../../dasbor.module.css';

/**
 * Riwayat pembukaan rapor orang tua (migrasi 006) -- kapan tiap anak
 * terakhir dibuka, berapa kali, dan siapa yang belum pernah sama sekali.
 *
 * Dua bagian: ringkasan per anak (untuk "siapa yang jarang/tidak pernah
 * buka"), dan riwayat mentah tiap pembukaan (untuk "polanya seperti
 * apa" -- rajin tiap minggu, atau hanya sekali lalu berhenti).
 */

const KETERANGAN_STATUS = {
  belum_terbit: { label: 'Belum diterbitkan', warna: 'var(--tinta-samar)' },
  belum_dibuka: { label: 'Belum pernah dibuka', warna: 'var(--tindakan-teks)' },
  sudah_dibuka: { label: 'Sudah dibuka', warna: 'var(--baik-teks)' },
};

/** belum_dibuka duluan -- itulah yang paling butuh ditindaklanjuti. */
const URUTAN_STATUS = { belum_dibuka: 0, sudah_dibuka: 1, belum_terbit: 2 };

const RENTANG = {
  hari_ini: 1,
  tujuh_hari: 7,
  tiga_puluh_hari: 30,
  semua: null,
};

export default function HalamanLogAkses() {
  const router = useRouter();
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState('');
  const [profil, setProfil] = useState(null);
  const [ringkasan, setRingkasan] = useState([]);
  const [riwayat, setRiwayat] = useState([]);
  const [rentang, setRentang] = useState('tujuh_hari');

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
        if (p?.role !== 'kepala_sekolah' && p?.role !== 'direktur_area') {
          setGalat('Halaman ini hanya untuk kepala sekolah dan biro akademik.');
          return;
        }
        setProfil(p);

        const hasil = await muatLogAksesRapor();
        setRingkasan(hasil.ringkasan);
        setRiwayat(hasil.riwayat);
      } catch (e) {
        setGalat(e.message || 'Gagal memuat log akses.');
      } finally {
        setMemuat(false);
      }
    })();
  }, [router]);

  const ringkasanUrut = useMemo(
    () =>
      [...ringkasan].sort((a, b) => {
        const u = URUTAN_STATUS[a.status] - URUTAN_STATUS[b.status];
        if (u !== 0) return u;
        if (a.jumlahDibuka !== b.jumlahDibuka) return a.jumlahDibuka - b.jumlahDibuka;
        const ta = a.terakhirDibuka ? new Date(a.terakhirDibuka).getTime() : 0;
        const tb = b.terakhirDibuka ? new Date(b.terakhirDibuka).getTime() : 0;
        return ta - tb;
      }),
    [ringkasan]
  );

  const jumlahBelumDibuka = ringkasan.filter((r) => r.status === 'belum_dibuka').length;

  /* Batas hari dihitung dari waktu WIB, sama seperti halaman Log WA. */
  const riwayatTampil = useMemo(() => {
    const batasHari = RENTANG[rentang];
    if (batasHari === null) return riwayat;

    const sekarangWib = Date.now() + 7 * 60 * 60 * 1000;
    const awalHariWib = Math.floor(sekarangWib / 86400000) * 86400000 - (batasHari - 1) * 86400000;
    const batasUtc = awalHariWib - 7 * 60 * 60 * 1000;

    return riwayat.filter((r) => new Date(r.dibuka_pada).getTime() >= batasUtc);
  }, [riwayat, rentang]);

  const formatWaktu = (iso) =>
    new Intl.DateTimeFormat('id-ID', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'Asia/Jakarta',
    }).format(new Date(iso));

  if (galat) {
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
          judul="Riwayat Akses Rapor"
          keterangan={`${profil?.nama ?? ''} · ${ringkasan.length} anak · ${jumlahBelumDibuka} belum pernah membuka`}
        />

        <section className={gaya.kartu}>
          <div className={gaya.penyaring} style={{ marginBottom: '0.85rem' }}>
            <Link href="/dashboard/kepala-sekolah" className={gaya.tautanKembali}>
              ← Kembali ke dasbor
            </Link>
          </div>

          <p className={gaya.ketKartu} style={{ marginBottom: '0.85rem' }}>
            Diurutkan yang paling butuh perhatian dulu: belum pernah dibuka,
            lalu yang paling jarang. Jumlah dan riwayat baru mulai terhitung
            sejak fitur ini dipasang -- "Terakhir Dibuka" tetap benar untuk
            pembukaan sebelum itu, tapi "Jumlah Dibuka" tidak menghitungnya.
          </p>

          {memuat ? (
            <p className={gaya.kosong}>Memuat ringkasan…</p>
          ) : (
            <div className={gaya.gulir}>
              <table className={gaya.tabel}>
                <thead>
                  <tr>
                    <th className={gaya.kiri}>Nama</th>
                    <th className={gaya.kiri}>Kelas</th>
                    <th className={gaya.kiri}>Status</th>
                    <th>Jumlah Dibuka</th>
                    <th className={gaya.kiri}>Terakhir Dibuka</th>
                  </tr>
                </thead>
                <tbody>
                  {ringkasanUrut.map((r) => {
                    const ket = KETERANGAN_STATUS[r.status];
                    return (
                      <tr key={r.nis}>
                        <td className={gaya.kiri}>{r.nama_lengkap}</td>
                        <td className={gaya.kiri}>
                          {r.kelas || <span className={gaya.kosong}>–</span>}
                        </td>
                        <td className={gaya.kiri} style={{ color: ket.warna }}>
                          {ket.label}
                        </td>
                        <td>{r.jumlahDibuka || <span className={gaya.kosong}>–</span>}</td>
                        <td className={gaya.kiri}>
                          {r.terakhirDibuka ? (
                            formatWaktu(r.terakhirDibuka)
                          ) : (
                            <span className={gaya.kosong}>–</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className={gaya.kartu}>
          <div className={gaya.kepalaAlat}>
            <div>
              <h2 className={gaya.judulKartu}>Riwayat Pembukaan</h2>
              <p className={gaya.ketKartu} style={{ margin: 0 }}>
                Satu baris per kali rapor dibuka -- untuk melihat polanya, bukan
                cuma totalnya.
              </p>
            </div>
            <label>
              Rentang
              <select value={rentang} onChange={(e) => setRentang(e.target.value)}>
                <option value="hari_ini">Hari ini</option>
                <option value="tujuh_hari">7 hari terakhir</option>
                <option value="tiga_puluh_hari">30 hari terakhir</option>
                <option value="semua">Semua</option>
              </select>
            </label>
          </div>

          {memuat ? (
            <p className={gaya.kosong}>Memuat riwayat…</p>
          ) : !riwayatTampil.length ? (
            <p className={gaya.kosong}>Belum ada pembukaan pada rentang ini.</p>
          ) : (
            <div className={gaya.gulir}>
              <table className={gaya.tabel}>
                <thead>
                  <tr>
                    <th className={gaya.kiri}>Waktu</th>
                    <th className={gaya.kiri}>Anak</th>
                  </tr>
                </thead>
                <tbody>
                  {riwayatTampil.map((r) => (
                    <tr key={r.id}>
                      <td className={gaya.kiri}>{formatWaktu(r.dibuka_pada)}</td>
                      <td className={gaya.kiri}>
                        {r.siswa?.nama_panggilan || r.siswa?.nama_lengkap || (
                          <span className={gaya.kosong}>siswa terhapus</span>
                        )}
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
