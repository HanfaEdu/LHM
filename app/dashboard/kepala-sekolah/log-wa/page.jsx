'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { muatProfil, muatLogWa } from '@/lib/data-dasbor';
import { nomorWaTampil } from '@/lib/nomor-wa';
import KepalaSekolahan from '@/app/komponen/KepalaSekolahan';
import gaya from '../../dasbor.module.css';

/**
 * Log layanan WhatsApp orang tua -- siapa yang chat, kapan, dan hasilnya
 * apa. Lihat app/api/wa/route.js untuk arti tiap nilai `hasil`.
 *
 * Isi pesan orang tua TIDAK ditampilkan karena memang tidak pernah
 * disimpan (lihat migrasi 003) -- yang tercatat cukup nomor, waktu, dan
 * hasilnya, sama seperti yang dibaca lewat SQL Editor Supabase.
 */

const KETERANGAN_HASIL = {
  terkirim: { label: 'Terkirim', warna: 'var(--baik-teks)' },
  belum_terbit: { label: 'Belum diterbitkan', warna: 'var(--dipantau-teks)' },
  tidak_dikenal: { label: 'Nomor tak dikenal', warna: 'var(--perhatian-teks)' },
  tidak_dikenal_diam: { label: 'Tak dikenal (tak dibalas)', warna: 'var(--tinta-samar)' },
  dibatasi: { label: 'Dibatasi (terlalu sering)', warna: 'var(--tindakan-teks)' },
  gagal_kirim: { label: 'Gagal kirim', warna: 'var(--kritis)' },
};

function keteranganHasil(hasil) {
  return KETERANGAN_HASIL[hasil] || { label: hasil, warna: 'var(--tinta-samar)' };
}

/** Batas awal rentang waktu, dalam hari. 'semua' tidak difilter sama sekali. */
const RENTANG = {
  hari_ini: 1,
  tujuh_hari: 7,
  tiga_puluh_hari: 30,
  semua: null,
};

export default function HalamanLogWa() {
  const router = useRouter();
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState('');
  const [profil, setProfil] = useState(null);
  const [daftar, setDaftar] = useState([]);
  const [rentang, setRentang] = useState('hari_ini');

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

        setDaftar(await muatLogWa());
      } catch (e) {
        setGalat(e.message || 'Gagal memuat log WA.');
      } finally {
        setMemuat(false);
      }
    })();
  }, [router]);

  /* Batas hari dihitung dari waktu WIB, bukan UTC -- "hari ini" bagi
     kepala sekolah berarti hari kalender Indonesia, dan dibuat_pada
     tersimpan UTC. Mundur 7 jam dulu supaya potongan tanggalnya jatuh
     pada hari WIB yang benar. */
  const tampil = useMemo(() => {
    const batasHari = RENTANG[rentang];
    if (batasHari === null) return daftar;

    const sekarangWib = Date.now() + 7 * 60 * 60 * 1000;
    const awalHariWib = Math.floor(sekarangWib / 86400000) * 86400000 - (batasHari - 1) * 86400000;
    const batasUtc = awalHariWib - 7 * 60 * 60 * 1000;

    return daftar.filter((p) => new Date(p.dibuat_pada).getTime() >= batasUtc);
  }, [daftar, rentang]);

  const ringkasan = useMemo(() => {
    const per = {};
    for (const p of tampil) per[p.hasil] = (per[p.hasil] || 0) + 1;
    return per;
  }, [tampil]);

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
          judul="Log WhatsApp Orang Tua"
          keterangan={`${profil?.nama ?? ''} · ${tampil.length} pesan`}
          anak={
            <div className={gaya.penyaring}>
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
          }
        />

        <section className={gaya.kartu}>
          <p className={gaya.ketKartu} style={{ marginBottom: '0.85rem' }}>
            Nomor pengirim, waktu, dan hasil balasan otomatis layanan WhatsApp
            sekolah. Isi pesan orang tua tidak dicatat sama sekali -- hanya
            nomornya yang dipakai mengenali anak.
          </p>

          <div className={gaya.penyaring} style={{ marginBottom: '0.85rem' }}>
            <Link href="/dashboard/kepala-sekolah" className={gaya.tautanKembali}>
              ← Kembali ke dasbor
            </Link>
          </div>

          {Object.keys(ringkasan).length > 0 && (
            <p className={gaya.narasi} style={{ marginBottom: '0.85rem' }}>
              {Object.entries(ringkasan)
                .map(([hasil, jumlah]) => `${jumlah} ${keteranganHasil(hasil).label.toLowerCase()}`)
                .join(' · ')}
            </p>
          )}

          {memuat ? (
            <p className={gaya.kosong}>Memuat log…</p>
          ) : !tampil.length ? (
            <p className={gaya.kosong}>Belum ada pesan pada rentang ini.</p>
          ) : (
            <div className={gaya.gulir}>
              <table className={gaya.tabel}>
                <thead>
                  <tr>
                    <th className={gaya.kiri}>Waktu</th>
                    <th className={gaya.kiri}>Nomor</th>
                    <th className={gaya.kiri}>Anak</th>
                    <th className={gaya.kiri}>Hasil</th>
                  </tr>
                </thead>
                <tbody>
                  {tampil.map((p) => {
                    const ket = keteranganHasil(p.hasil);
                    return (
                      <tr key={p.id}>
                        <td className={gaya.kiri}>{formatWaktu(p.dibuat_pada)}</td>
                        <td className={gaya.kiri}>{nomorWaTampil(p.pengirim)}</td>
                        <td className={gaya.kiri}>
                          {p.anak.length ? (
                            p.anak.map((a) => a.nama_panggilan).join(' & ')
                          ) : (
                            <span className={gaya.kosong}>tidak dikenal</span>
                          )}
                        </td>
                        <td className={gaya.kiri} style={{ color: ket.warna }}>
                          {ket.label}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
