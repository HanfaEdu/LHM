'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import gaya from './asisten.module.css';

/**
 * Penggambar grafik untuk asisten.
 *
 * Spesifikasinya datang dari model lewat alat gambar_grafik, jadi bentuk
 * datanya tidak pernah dipastikan lebih dulu -- setiap nilai diperlakukan
 * sebagai mungkin kosong. Grafik yang datanya tidak masuk akal digambar
 * seadanya dan tetap menampilkan tabel angkanya, bukan melempar galat
 * yang menjatuhkan seluruh halaman.
 *
 * Batang SELALU mulai dari nol. Sumbu batang yang dipotong (mis. mulai
 * dari 70 saat nilainya 88-98) membuat selisih satu poin terlihat seperti
 * jurang -- untuk angka yang berdempetan tinggi, jenis "selisih" terhadap
 * acuan adalah bentuk yang jujur, dan itulah yang diminta dari model.
 */

const PALET = ['var(--seri-1)', 'var(--seri-2)', 'var(--seri-3)', 'var(--seri-4)'];

function angkaAtauNull(v) {
  const n = Number(v);
  return v === null || v === undefined || v === '' || Number.isNaN(n) ? null : n;
}

function fmt(v, d = 1) {
  const n = angkaAtauNull(v);
  return n === null ? '–' : n.toFixed(d);
}

function batasBagus(v) {
  if (!(v > 0)) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const m = v / p;
  const s = m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10;
  return s * p;
}

function useLebar() {
  const ref = useRef(null);
  const [lebar, setLebar] = useState(560);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const ukur = () => setLebar(Math.max(260, el.clientWidth || 560));
    ukur();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(ukur);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, lebar];
}

export default function Grafik({ spec }) {
  const [ref, lebar] = useLebar();
  const [tabelTampil, setTabelTampil] = useState(false);
  const [tip, setTip] = useState(null);

  const tunjuk = useCallback((e, isi) => {
    setTip({ x: e.clientX, y: e.clientY, isi });
  }, []);
  const lepas = useCallback(() => setTip(null), []);

  const punyaTabel = Array.isArray(spec.tabel_kolom) && Array.isArray(spec.tabel_baris);

  return (
    <figure className={gaya.figur}>
      <figcaption>
        <div className={gaya.figurJudul}>{spec.judul}</div>
        {spec.catatan ? <div className={gaya.figurCatatan}>{spec.catatan}</div> : null}
      </figcaption>

      {spec.jenis === 'dumbbell' ? (
        <div className={gaya.legenda}>
          <span>
            <i style={{ background: 'var(--seri-2)' }} />
            {spec.label_dari || 'target'}
          </span>
          <span>
            <i style={{ background: 'var(--seri-1)' }} />
            {spec.label_ke || 'capaian'}
          </span>
        </div>
      ) : null}

      <div className={gaya.bidang} ref={ref}>
        <Isi spec={spec} lebar={lebar} tunjuk={tunjuk} lepas={lepas} />
      </div>

      <div className={gaya.figurKaki}>
        <span className={gaya.sumber}>
          Dihitung dari Database LHM dengan rumus yang sama seperti dasbor
        </span>
        {punyaTabel ? (
          <button type="button" className={gaya.tombolTabel} onClick={() => setTabelTampil((v) => !v)}>
            {tabelTampil ? 'sembunyikan angka' : 'tabel angka'}
          </button>
        ) : null}
      </div>

      {punyaTabel && tabelTampil ? (
        <div className={gaya.gulirTabel}>
          <table className={gaya.tabel}>
            <thead>
              <tr>
                {spec.tabel_kolom.map((k, i) => (
                  <th key={i} className={i ? gaya.angka : undefined}>{String(k)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {spec.tabel_baris.map((b, i) => (
                <tr key={i}>
                  {(Array.isArray(b) ? b : [b]).map((c, j) => (
                    <td key={j} className={j ? gaya.angka : undefined}>{c === null || c === undefined ? '–' : String(c)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {tip ? (
        <div
          className={gaya.tip}
          style={{
            left: Math.min(tip.x + 14, (typeof window !== 'undefined' ? window.innerWidth : 1200) - 230),
            top: tip.y + 14,
          }}
        >
          {tip.isi}
        </div>
      ) : null}
    </figure>
  );
}

function Isi({ spec, lebar, tunjuk, lepas }) {
  if (spec.jenis === 'garis') return <Garis spec={spec} lebar={lebar} tunjuk={tunjuk} lepas={lepas} />;
  if (spec.jenis === 'sebar') return <Sebar spec={spec} lebar={lebar} tunjuk={tunjuk} lepas={lepas} />;
  return <Mendatar spec={spec} lebar={lebar} tunjuk={tunjuk} lepas={lepas} />;
}

/* --- batang | selisih | dumbbell : semuanya mendatar, supaya nama
       kelas dan nama siswa yang panjang tetap terbaca utuh --- */
function Mendatar({ spec, lebar, tunjuk, lepas }) {
  const data = (Array.isArray(spec.data) ? spec.data : []).slice(0, 24);
  const n = data.length;
  if (!n) return <p className={gaya.kosong}>Tidak ada data untuk digambar.</p>;

  const dumbbell = spec.jenis === 'dumbbell';
  const menyebar = spec.jenis === 'selisih';
  const lebarLabel = Math.min(170, Math.max(70, lebar * 0.3));
  const kananSisa = 52;
  const tinggiBaris = n > 18 ? 20 : n > 12 ? 24 : 28;
  const atas = spec.acuan !== null && spec.acuan !== undefined && !menyebar ? 22 : 10;
  const bawah = 26;
  const H = atas + n * tinggiBaris + bawah;
  const x0 = lebarLabel;
  const x1 = Math.max(x0 + 40, lebar - kananSisa);

  const nilai = [];
  data.forEach((d) => {
    if (dumbbell) {
      const a = angkaAtauNull(d.dari);
      const b = angkaAtauNull(d.ke);
      if (a !== null) nilai.push(a);
      if (b !== null) nilai.push(b);
    } else {
      const v = angkaAtauNull(d.nilai);
      if (v !== null) nilai.push(v);
    }
  });
  if (!nilai.length) nilai.push(0, 1);

  let lo;
  let hi;
  if (menyebar) {
    const m = batasBagus(Math.max(...nilai.map(Math.abs), 1));
    lo = -m;
    hi = m;
  } else {
    lo = 0;
    hi = batasBagus(Math.max(...nilai, 1));
  }
  const acuan = angkaAtauNull(spec.acuan);
  const skala = (v) => x0 + ((v - lo) / (hi - lo || 1)) * (x1 - x0);
  const nol = menyebar ? skala(0) : x0;
  const satuan = spec.satuan || '';

  const tanda = [];
  for (let i = 0; i <= 4; i += 1) tanda.push(lo + ((hi - lo) * i) / 4);

  return (
    <svg width={lebar} height={H} viewBox={`0 0 ${lebar} ${H}`} role="img" aria-label={spec.judul}>
      {tanda.map((t, i) => (
        <g key={i}>
          <line x1={skala(t)} y1={atas} x2={skala(t)} y2={atas + n * tinggiBaris} stroke="var(--garis)" strokeWidth="1" />
          <text x={skala(t)} y={H - 9} textAnchor="middle" fill="var(--tinta-samar)" fontSize="10" fontFamily="var(--font-mono)">
            {Math.round(t * 10) / 10}
          </text>
        </g>
      ))}

      {data.map((d, i) => {
        const y = atas + i * tinggiBaris;
        const cy = y + tinggiBaris / 2;
        const maksHuruf = Math.floor(lebarLabel / 6.6);
        const teks = String(d.label ?? '');
        const potong = teks.length > maksHuruf ? `${teks.slice(0, maksHuruf - 1)}…` : teks;
        const tebal = Math.min(13, tinggiBaris - 9);

        let badan;
        let isiTip;

        if (dumbbell) {
          const a = angkaAtauNull(d.dari);
          const b = angkaAtauNull(d.ke);
          const xa = skala(a ?? lo);
          const xb = skala(b ?? lo);
          badan = (
            <>
              <line x1={xa} y1={cy} x2={xb} y2={cy} stroke="var(--garis-kuat)" strokeWidth="2" strokeLinecap="round" />
              <circle cx={xa} cy={cy} r="5" fill="var(--kartu)" stroke="var(--seri-2)" strokeWidth="2.5" />
              <circle cx={xb} cy={cy} r="5" fill="var(--seri-1)" stroke="var(--kartu)" strokeWidth="2" />
              <text x={Math.max(xa, xb) + 9} y={cy + 4} fill="var(--tinta-lembut)" fontSize="10.5" fontFamily="var(--font-mono)">
                {fmt(b, 0)}
              </text>
            </>
          );
          isiTip = (
            <>
              <b>{teks}</b>
              <br />
              {(spec.label_dari || 'dari')}: {fmt(a)}{satuan}
              <br />
              {(spec.label_ke || 'ke')}: {fmt(b)}{satuan}
            </>
          );
        } else {
          const v = angkaAtauNull(d.nilai);
          const bx = skala(v ?? lo);
          const kiri = Math.min(nol, bx);
          const w = Math.abs(bx - nol);
          let warna = 'var(--seri-1)';
          if (menyebar) warna = (v ?? 0) < 0 ? 'var(--target)' : 'var(--seri-1)';
          else if (acuan !== null && v !== null && v < acuan) warna = 'var(--target)';
          const negatif = menyebar && (v ?? 0) < 0;
          badan = (
            <>
              <rect
                className={gaya.batang}
                x={kiri}
                y={cy - tebal / 2}
                width={Math.max(1.5, w)}
                height={tebal}
                fill={warna}
                rx="3"
                style={{ transformOrigin: `${nol}px ${cy}px`, animationDelay: `${Math.min(i * 28, 400)}ms` }}
              />
              <text
                x={negatif ? kiri - 7 : kiri + w + 7}
                y={cy + 4}
                textAnchor={negatif ? 'end' : 'start'}
                fill="var(--tinta-lembut)"
                fontSize="10.5"
                fontFamily="var(--font-mono)"
              >
                {menyebar && (v ?? 0) > 0 ? '+' : ''}
                {fmt(v, 1)}
              </text>
            </>
          );
          isiTip = (
            <>
              <b>{teks}</b>
              <br />
              {fmt(v)}{satuan}
              {d.catatan ? (
                <>
                  <br />
                  {String(d.catatan)}
                </>
              ) : null}
            </>
          );
        }

        return (
          <g key={i}>
            <text x={x0 - 9} y={cy + 4} textAnchor="end" fill="var(--tinta-lembut)" fontSize="11.5">
              {potong}
            </text>
            {badan}
            <rect
              x="0"
              y={y}
              width={lebar}
              height={tinggiBaris}
              fill="transparent"
              onMouseMove={(e) => tunjuk(e, isiTip)}
              onMouseLeave={lepas}
            />
          </g>
        );
      })}

      {menyebar ? (
        <line x1={nol} y1={atas} x2={nol} y2={atas + n * tinggiBaris} stroke="var(--garis-kuat)" strokeWidth="1.5" />
      ) : null}

      {acuan !== null && !menyebar && acuan >= lo && acuan <= hi ? (
        <>
          <line
            x1={skala(acuan)}
            y1={atas - 2}
            x2={skala(acuan)}
            y2={atas + n * tinggiBaris + 2}
            stroke="var(--target)"
            strokeWidth="1.5"
            strokeDasharray="5 4"
          />
          <text x={skala(acuan)} y={atas - 7} textAnchor="middle" fill="var(--target)" fontSize="9.5" fontFamily="var(--font-mono)">
            ambang {acuan}
            {satuan}
          </text>
        </>
      ) : null}

      <line x1={x0} y1={atas + n * tinggiBaris} x2={x1} y2={atas + n * tinggiBaris} stroke="var(--garis-kuat)" strokeWidth="1" />
    </svg>
  );
}

function Garis({ spec, lebar, tunjuk, lepas }) {
  const kategori = Array.isArray(spec.kategori) ? spec.kategori : [];
  const seri = (Array.isArray(spec.seri) ? spec.seri : []).slice(0, 4);
  if (!kategori.length || !seri.length) return <p className={gaya.kosong}>Tidak ada data untuk digambar.</p>;

  const kiri = 46;
  const kanan = 16;
  const atas = 14;
  const bawah = 30;
  const H = Math.max(210, Math.min(310, lebar * 0.46));
  const x0 = kiri;
  const x1 = lebar - kanan;
  const y0 = atas;
  const y1 = H - bawah;

  const semua = [];
  seri.forEach((s) => (Array.isArray(s.nilai) ? s.nilai : []).forEach((v) => {
    const n = angkaAtauNull(v);
    if (n !== null) semua.push(n);
  }));
  if (!semua.length) semua.push(0, 1);
  const hi = batasBagus(Math.max(...semua, 1));
  const lo = 0;
  const sy = (v) => y1 - ((v - lo) / (hi - lo || 1)) * (y1 - y0);
  const sx = (i) => (kategori.length < 2 ? (x0 + x1) / 2 : x0 + (i / (kategori.length - 1)) * (x1 - x0));
  const satuan = spec.satuan || '';

  return (
    <svg width={lebar} height={H} viewBox={`0 0 ${lebar} ${H}`} role="img" aria-label={spec.judul}>
      {[0, 1, 2, 3, 4].map((i) => {
        const v = lo + ((hi - lo) * i) / 4;
        return (
          <g key={i}>
            <line x1={x0} y1={sy(v)} x2={x1} y2={sy(v)} stroke="var(--garis)" strokeWidth="1" />
            <text x={x0 - 8} y={sy(v) + 4} textAnchor="end" fill="var(--tinta-samar)" fontSize="10" fontFamily="var(--font-mono)">
              {Math.round(v * 10) / 10}
            </text>
          </g>
        );
      })}
      {kategori.map((k, i) => (
        <text key={i} x={sx(i)} y={H - 9} textAnchor="middle" fill="var(--tinta-lembut)" fontSize="11">
          {String(k)}
        </text>
      ))}
      {seri.map((s, si) => {
        const warna = PALET[si % PALET.length];
        const titik = (Array.isArray(s.nilai) ? s.nilai : [])
          .map((v, i) => ({ i, v: angkaAtauNull(v) }))
          .filter((t) => t.v !== null);
        const d = titik.map((t, k) => `${k ? 'L' : 'M'}${sx(t.i)} ${sy(t.v)}`).join('');
        return (
          <g key={si}>
            {d ? <path className={gaya.garis} d={d} fill="none" stroke={warna} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" /> : null}
            {titik.map((t) => (
              <circle
                key={t.i}
                cx={sx(t.i)}
                cy={sy(t.v)}
                r="4.5"
                fill={warna}
                stroke="var(--kartu)"
                strokeWidth="2"
                onMouseMove={(e) => tunjuk(e, (
                  <>
                    <b>{String(s.nama || `Seri ${si + 1}`)}</b>
                    <br />
                    {String(kategori[t.i])}: {fmt(t.v)}{satuan}
                  </>
                ))}
                onMouseLeave={lepas}
              />
            ))}
            {titik.length ? (
              <text
                x={sx(titik[titik.length - 1].i) - 6}
                y={sy(titik[titik.length - 1].v) - 10}
                textAnchor="end"
                fill="var(--tinta-lembut)"
                fontSize="10.5"
                fontFamily="var(--font-mono)"
              >
                {String(s.nama || '')} {fmt(titik[titik.length - 1].v)}
              </text>
            ) : null}
          </g>
        );
      })}
      <line x1={x0} y1={y1} x2={x1} y2={y1} stroke="var(--garis-kuat)" strokeWidth="1" />
    </svg>
  );
}

function Sebar({ spec, lebar, tunjuk, lepas }) {
  const data = (Array.isArray(spec.data) ? spec.data : [])
    .map((d) => ({ label: d.label, kelas: d.kelas, x: angkaAtauNull(d.x), y: angkaAtauNull(d.y) }))
    .filter((d) => d.x !== null && d.y !== null);
  if (!data.length) return <p className={gaya.kosong}>Tidak ada data untuk digambar.</p>;

  const kiri = 46;
  const kanan = 18;
  const atas = 14;
  const bawah = 40;
  const H = Math.max(230, Math.min(340, lebar * 0.56));
  const x0 = kiri;
  const x1 = lebar - kanan;
  const y0 = atas;
  const y1 = H - bawah;
  const xhi = batasBagus(Math.max(...data.map((d) => d.x), 1));
  const yhi = batasBagus(Math.max(...data.map((d) => d.y), 1));
  const sx = (v) => x0 + (v / (xhi || 1)) * (x1 - x0);
  const sy = (v) => y1 - (v / (yhi || 1)) * (y1 - y0);

  return (
    <svg width={lebar} height={H} viewBox={`0 0 ${lebar} ${H}`} role="img" aria-label={spec.judul}>
      {[0, 1, 2, 3, 4].map((i) => (
        <g key={i}>
          <line x1={x0} y1={sy((yhi * i) / 4)} x2={x1} y2={sy((yhi * i) / 4)} stroke="var(--garis)" strokeWidth="1" />
          <text x={x0 - 8} y={sy((yhi * i) / 4) + 4} textAnchor="end" fill="var(--tinta-samar)" fontSize="10" fontFamily="var(--font-mono)">
            {Math.round(((yhi * i) / 4) * 10) / 10}
          </text>
          <text x={sx((xhi * i) / 4)} y={H - 22} textAnchor="middle" fill="var(--tinta-samar)" fontSize="10" fontFamily="var(--font-mono)">
            {Math.round(((xhi * i) / 4) * 10) / 10}
          </text>
        </g>
      ))}
      {data.map((d, i) => (
        <circle
          key={i}
          className={gaya.titik}
          cx={sx(d.x)}
          cy={sy(d.y)}
          r="5"
          fill="var(--seri-1)"
          fillOpacity="0.75"
          stroke="var(--kartu)"
          strokeWidth="1.5"
          style={{ animationDelay: `${Math.min(i * 12, 500)}ms` }}
          onMouseMove={(e) => tunjuk(e, (
            <>
              <b>{String(d.label ?? '')}</b>
              {d.kelas ? ` · kelas ${d.kelas}` : ''}
              <br />
              {spec.sumbu_x || 'x'}: {fmt(d.x)}
              <br />
              {spec.sumbu_y || 'y'}: {fmt(d.y)}
            </>
          ))}
          onMouseLeave={lepas}
        />
      ))}
      <text x={(x0 + x1) / 2} y={H - 5} textAnchor="middle" fill="var(--tinta-lembut)" fontSize="11">
        {spec.sumbu_x || ''}
      </text>
      <text x="12" y={(y0 + y1) / 2} textAnchor="middle" fill="var(--tinta-lembut)" fontSize="11" transform={`rotate(-90 12 ${(y0 + y1) / 2})`}>
        {spec.sumbu_y || ''}
      </text>
      <line x1={x0} y1={y1} x2={x1} y2={y1} stroke="var(--garis-kuat)" strokeWidth="1" />
    </svg>
  );
}
