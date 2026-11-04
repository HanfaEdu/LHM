'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import Grafik from './Grafik';
import gaya from './asisten.module.css';

/**
 * Anjungan Asisten Data.
 *
 * Halaman ini tidak pernah memegang kunci Anthropic dan tidak pernah
 * menghitung angkanya sendiri. Ia mengirim pertanyaan ke /api/asisten
 * berikut token sesi Supabase, lalu menggambar apa yang dialirkan balik.
 * Wewenang ditegakkan di server: apa yang tidak boleh dilihat akun ini
 * tidak pernah sampai ke sini untuk digambar.
 *
 * Panel "Proses" bukan hiasan. Tiap baris adalah satu pemanggilan alat
 * yang benar-benar terjadi, berikut ringkasan apa yang dipindainya —
 * sehingga jawaban yang muncul di bawah bisa ditelusuri asalnya, bukan
 * diterima begitu saja.
 */

const USULAN = [
  'Kelas mana yang paling perlu perhatian bulan ini?',
  'Siapa saja siswa yang perlu pendampingan?',
  'Bandingkan capaian dan target Tahfidz per kelas',
  'Bagaimana sebaran nilai kelas dengan ketuntasan terendah?',
  'Ringkas kondisi sekolah bulan ini dalam tiga poin',
];

function mdKeHtml(teks) {
  const aman = String(teks || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return aman
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .split(/\n\s*\n/)
    .map((p) => `<p>${p.replace(/\n/g, '<br/>')}</p>`)
    .join('');
}

export default function AnjunganAsisten() {
  const router = useRouter();
  const [siap, setSiap] = useState(false);
  const [galatAwal, setGalatAwal] = useState('');
  const [spanduk, setSpanduk] = useState('');

  const [pertanyaan, setPertanyaan] = useState('');
  const [sibuk, setSibuk] = useState(false);
  const [proses, setProses] = useState([]);
  const [pikir, setPikir] = useState('');
  const [jawaban, setJawaban] = useState('');
  const [tampilan, setTampilan] = useState([]);
  const [konteks, setKonteks] = useState(null);
  const [aktif, setAktif] = useState('');
  const [mulai, setMulai] = useState(0);
  const [detik, setDetik] = useState(0);
  const [riwayat, setRiwayat] = useState([]);

  const batalRef = useRef(null);
  const prosesRef = useRef(null);

  useEffect(() => {
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }
      setSiap(true);
    })().catch((e) => setGalatAwal(e?.message || 'Gagal memeriksa sesi.'));
  }, [router]);

  /* Penghitung durasi. Berjalan hanya saat ada permintaan berlangsung —
     satu pertanyaan bisa memakan puluhan detik, dan angka yang berjalan
     adalah beda antara "sedang bekerja" dan "mungkin macet". */
  useEffect(() => {
    if (!sibuk || !mulai) return undefined;
    const t = setInterval(() => setDetik(Math.round((Date.now() - mulai) / 1000)), 250);
    return () => clearInterval(t);
  }, [sibuk, mulai]);

  useEffect(() => {
    const el = prosesRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [proses, pikir]);

  const tambahBaris = useCallback((baris) => setProses((b) => [...b, baris]), []);

  const tanya = useCallback(
    async (teks) => {
      const q = String(teks || '').trim();
      if (!q || sibuk) return;

      setSibuk(true);
      setSpanduk('');
      setPertanyaan('');
      setJawaban('');
      setPikir('');
      setTampilan([]);
      setProses([{ jenis: 'tanya', teks: q }]);
      setAktif('menyiapkan');
      setMulai(Date.now());
      setDetik(0);

      const batal = new AbortController();
      batalRef.current = batal;

      let jawabanLokal = '';

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) {
          router.push('/login');
          return;
        }

        const tanggapan = await fetch('/api/asisten', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ pertanyaan: q, riwayat }),
          signal: batal.signal,
        });

        if (!tanggapan.ok || !tanggapan.body) {
          let pesan = `Permintaan gagal (${tanggapan.status}).`;
          try {
            const j = await tanggapan.json();
            if (j?.galat) pesan = j.galat;
          } catch {
            /* badan bukan JSON — pakai pesan bawaan di atas */
          }
          setSpanduk(pesan);
          tambahBaris({ jenis: 'gagal', teks: pesan });
          return;
        }

        const pembaca = tanggapan.body.getReader();
        const pengurai = new TextDecoder();
        let sisa = '';

        for (;;) {
          const { done, value } = await pembaca.read();
          if (done) break;
          sisa += pengurai.decode(value, { stream: true });

          const potongan = sisa.split('\n\n');
          sisa = potongan.pop() || '';

          for (const blok of potongan) {
            const barisBlok = blok.split('\n');
            const jenis = (barisBlok.find((l) => l.startsWith('event: ')) || '').slice(7).trim();
            const dataMentah = barisBlok
              .filter((l) => l.startsWith('data: '))
              .map((l) => l.slice(6))
              .join('\n');
            if (!jenis || !dataMentah) continue;

            let data;
            try {
              data = JSON.parse(dataMentah);
            } catch {
              continue;
            }

            if (jenis === 'konteks') {
              setKonteks(data);
              tambahBaris({
                jenis: 'usai',
                teks: `memuat ${data.jumlahSiswa} siswa · ${data.kelas.length} kelas · T.A. ${data.tahunAjaran}`,
              });
              tambahBaris({
                jenis: 'usai',
                teks: `bulan terisi: ${data.bulanTerisi.join(', ') || '(belum ada)'}`,
              });
              setAktif('menganalisis');
            } else if (jenis === 'pikir') {
              setPikir((p) => (p + data.potongan).slice(-1400));
            } else if (jenis === 'alat-mulai') {
              setAktif(data.nama);
              setProses((b) => [...b, { jenis: 'jalan', id: data.id, teks: data.nama }]);
            } else if (jenis === 'alat-selesai') {
              setProses((b) =>
                b.map((x) => (x.id === data.id ? { ...x, jenis: 'usai', teks: data.ringkas } : x))
              );
            } else if (jenis === 'alat-gagal') {
              setProses((b) =>
                b.map((x) =>
                  x.id === data.id ? { ...x, jenis: 'gagal', teks: `${data.nama}: ${data.pesan}` } : x
                )
              );
            } else if (jenis === 'gambar') {
              setTampilan((t) => [...t, { kind: 'grafik', spec: data }]);
            } else if (jenis === 'tabel') {
              setTampilan((t) => [...t, { kind: 'tabel', spec: data }]);
            } else if (jenis === 'teks') {
              jawabanLokal += data.potongan;
              setJawaban(jawabanLokal);
              setAktif('menulis jawaban');
            } else if (jenis === 'galat') {
              setSpanduk(data.pesan);
              tambahBaris({ jenis: 'gagal', teks: data.pesan });
            } else if (jenis === 'selesai') {
              tambahBaris({ jenis: 'usai', teks: 'selesai' });
            }
          }
        }

        if (jawabanLokal.trim()) {
          setRiwayat((r) =>
            [...r, { role: 'user', content: q }, { role: 'assistant', content: jawabanLokal }].slice(-6)
          );
        }
      } catch (e) {
        if (e?.name === 'AbortError') {
          tambahBaris({ jenis: 'gagal', teks: 'dihentikan' });
        } else {
          const pesan = e?.message || 'Gagal menghubungi asisten.';
          setSpanduk(pesan);
          tambahBaris({ jenis: 'gagal', teks: pesan });
        }
      } finally {
        batalRef.current = null;
        setSibuk(false);
        setAktif('');
      }
    },
    [riwayat, router, sibuk, tambahBaris]
  );

  const hentikan = useCallback(() => {
    if (batalRef.current) batalRef.current.abort();
  }, []);

  if (galatAwal) {
    return (
      <div className={gaya.halaman}>
        <p className={gaya.pesanTengah}>{galatAwal}</p>
      </div>
    );
  }

  if (!siap) {
    return (
      <div className={gaya.halaman}>
        <p className={gaya.pesanTengah}>Memeriksa sesi…</p>
      </div>
    );
  }

  const jumlahAlat = proses.filter((b) => b.jenis === 'usai' && b.id).length;

  return (
    <div className={gaya.halaman}>
      <div className={gaya.wadah}>
        <header className={gaya.kepala}>
          <h1 className={gaya.judul}>Asisten Data</h1>
          <span className={gaya.subJudul}>
            {konteks
              ? `${konteks.sekolah.join(' · ')} · T.A. ${konteks.tahunAjaran}`
              : 'tanya apa saja tentang capaian siswa'}
          </span>
          <span className={gaya.dorong} />
          <Link href="/dashboard/kepala-sekolah" className={gaya.tautKembali}>
            &larr; Dasbor
          </Link>
        </header>

        <div className={gaya.telemetri}>
          <Ubin label="Kelas" nilai={konteks ? konteks.kelas.length : '–'} sub={konteks ? konteks.kelas.join(', ') : 'menunggu pertanyaan'} />
          <Ubin label="Siswa" nilai={konteks ? konteks.jumlahSiswa : '–'} sub={konteks ? `peran: ${konteks.peran}` : ''} />
          <Ubin
            label="Bulan terisi"
            nilai={konteks ? konteks.bulanTerisi.length : '–'}
            sub={konteks ? konteks.bulanTerisi.slice(-2).join(', ') : ''}
          />
          <Ubin label="Alat dipanggil" nilai={jumlahAlat} sub="per pertanyaan" aktifkan={sibuk} />
          <Ubin label="Durasi" nilai={`${detik}s`} sub={sibuk ? 'berjalan' : 'siap'} aktifkan={sibuk} />
        </div>

        <div className={gaya.badan}>
          <section className={gaya.panel}>
            <div className={gaya.panelKepala}>
              <h2 className={gaya.panelJudul}>Proses</h2>
              <span className={gaya.panelStatus} data-sibuk={sibuk ? 'ya' : 'tidak'}>
                {sibuk ? 'bekerja' : 'siap'}
              </span>
            </div>

            <div className={gaya.pemindai}>
              <Cincin sibuk={sibuk} />
              <div className={gaya.pemindaiTeks}>
                <div className={gaya.pemindaiUtama}>{sibuk ? aktif || 'memindai…' : 'menunggu pertanyaan'}</div>
                <div className={gaya.pemindaiSub}>
                  {sibuk
                    ? `${jumlahAlat} alat selesai · ${detik}s`
                    : konteks
                      ? 'angka diambil langsung dari Database LHM'
                      : 'angka diambil langsung dari Database LHM'}
                </div>
              </div>
            </div>

            <div className={gaya.proses} ref={prosesRef}>
              {proses.map((b, i) => (
                <div key={i} className={`${gaya.baris} ${gaya[b.jenis] || ''}`}>
                  <span className={gaya.barisIkon}>
                    {b.jenis === 'jalan' ? '◠' : b.jenis === 'usai' ? '✓' : b.jenis === 'gagal' ? '✗' : '▸'}
                  </span>
                  <span className={gaya.barisTeks}>{b.teks}</span>
                </div>
              ))}
              {!proses.length ? (
                <div className={`${gaya.baris} ${gaya.samar}`}>
                  <span className={gaya.barisIkon}>·</span>
                  <span className={gaya.barisTeks}>Tiap langkah pencarian akan muncul di sini.</span>
                </div>
              ) : null}
            </div>

            {pikir ? (
              <div className={gaya.pikir}>
                <span className={gaya.pikirLabel}>Ringkasan penalaran</span>
                {pikir}
              </div>
            ) : null}

            {jawaban ? (
              <div className={gaya.jawaban}>
                <span dangerouslySetInnerHTML={{ __html: mdKeHtml(jawaban) }} />
                {sibuk ? <span className={gaya.kursor} /> : null}
              </div>
            ) : null}
          </section>

          <section className={gaya.panel}>
            <div className={gaya.panelKepala}>
              <h2 className={gaya.panelJudul}>Visual</h2>
              <span className={gaya.panelStatus}>
                {tampilan.length ? `${tampilan.length} tampilan` : 'belum ada'}
              </span>
            </div>
            <div className={gaya.kanvas}>
              {tampilan.map((t, i) =>
                t.kind === 'grafik' ? (
                  <Grafik key={i} spec={t.spec} />
                ) : (
                  <TabelSaja key={i} spec={t.spec} />
                )
              )}
              {!tampilan.length ? (
                <p className={gaya.kosong}>
                  Grafik dan tabel hasil analisis akan digambar di sini.
                </p>
              ) : null}
            </div>
          </section>
        </div>

        <div className={gaya.tanyaBar}>
          {spanduk ? (
            <div className={gaya.spanduk}>
              <span>{spanduk}</span>
            </div>
          ) : null}

          <div className={gaya.usulan}>
            {USULAN.map((u) => (
              <button key={u} type="button" disabled={sibuk} onClick={() => tanya(u)}>
                {u}
              </button>
            ))}
          </div>

          <div className={gaya.barisMasuk}>
            <input
              id="pertanyaan-asisten"
              className={gaya.masukan}
              type="text"
              autoComplete="off"
              placeholder="Tanyakan apa saja tentang capaian siswa…"
              value={pertanyaan}
              disabled={sibuk}
              onChange={(e) => setPertanyaan(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') tanya(pertanyaan);
              }}
            />
            {sibuk ? (
              <button type="button" className={gaya.henti} onClick={hentikan}>
                Hentikan
              </button>
            ) : null}
            <button type="button" className={gaya.kirim} disabled={sibuk} onClick={() => tanya(pertanyaan)}>
              Tanya
            </button>
          </div>

          <p className={gaya.catatan}>
            Angka dihitung dengan rumus yang sama seperti dasbor, langsung dari Database LHM.
            Yang tampil hanya data yang boleh dilihat akunmu.
          </p>
        </div>
      </div>
    </div>
  );
}

function Ubin({ label, nilai, sub, aktifkan }) {
  return (
    <div className={`${gaya.ubin} ${aktifkan ? gaya.ubinAktif : ''}`}>
      <span className={gaya.ubinLabel}>{label}</span>
      <span className={gaya.ubinNilai}>{nilai}</span>
      <span className={gaya.ubinSub}>{sub}</span>
    </div>
  );
}

/* Cincin pemindai. Dua busur berputar berlawanan arah selama ada
   permintaan berlangsung, dan diam begitu selesai — penanda keadaan,
   bukan hiasan yang berputar selamanya. */
function Cincin({ sibuk }) {
  return (
    <svg className={gaya.cincin} viewBox="0 0 52 52" aria-hidden="true">
      <circle cx="26" cy="26" r="23" fill="none" stroke="var(--garis)" strokeWidth="1" />
      <circle cx="26" cy="26" r="16" fill="none" stroke="var(--garis)" strokeWidth="1" />
      <g className={sibuk ? gaya.cincinPutar : gaya.cincinDiam}>
        <circle
          cx="26"
          cy="26"
          r="23"
          fill="none"
          stroke="var(--sorot)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray="30 115"
        />
      </g>
      <g className={sibuk ? gaya.cincinPutarBalik : gaya.cincinDiam}>
        <circle
          cx="26"
          cy="26"
          r="16"
          fill="none"
          stroke="var(--sorot-2)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray="18 82"
        />
      </g>
      <circle cx="26" cy="26" r="3" fill={sibuk ? 'var(--sorot-2)' : 'var(--tinta-samar)'} />
    </svg>
  );
}

function TabelSaja({ spec }) {
  const kolom = Array.isArray(spec.kolom) ? spec.kolom : [];
  const baris = Array.isArray(spec.baris) ? spec.baris : [];
  return (
    <figure className={gaya.figur}>
      <figcaption>
        <div className={gaya.figurJudul}>{spec.judul}</div>
        {spec.catatan ? <div className={gaya.figurCatatan}>{spec.catatan}</div> : null}
      </figcaption>
      <div className={gaya.gulirTabel}>
        <table className={gaya.tabel}>
          <thead>
            <tr>
              {kolom.map((k, i) => (
                <th key={i} className={i ? gaya.angka : undefined}>{String(k)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {baris.map((b, i) => (
              <tr key={i}>
                {(Array.isArray(b) ? b : [b]).map((c, j) => (
                  <td key={j} className={j ? gaya.angka : undefined}>
                    {c === null || c === undefined ? '–' : String(c)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}
