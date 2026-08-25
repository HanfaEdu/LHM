'use client';

/**
 * Isi legenda buatan sendiri untuk seluruh grafik.
 *
 * Recharts hanya menyediakan beberapa bentuk ikon bawaan, dan tidak satu
 * pun yang sesuai untuk garis target:
 *
 *   - "line"      : garis dengan bulatan, tetapi bulatannya berlubang dan
 *                   garisnya selalu utuh (mengabaikan pola putus-putus).
 *   - "plainline" : mengikuti pola putus-putus, tetapi tanpa bulatan.
 *   - "circle"    : bulatan terisi, tetapi tanpa garis.
 *
 * Yang dibutuhkan adalah gabungan keduanya: garis putus-putus dengan
 * bulatan terisi. Karena itu ikonnya digambar sendiri di sini.
 *
 * Bulatan target sengaja TERISI sementara bulatan seri nilai dibiarkan
 * BERLUBANG. Perbedaan itu bukan hiasan: pada grafik akademik, target dan
 * ketiga mata pelajaran sama-sama berupa garis bertitik, sehingga bentuk
 * bulatannya menjadi pembeda kedua setelah warna -- berguna bagi pembaca
 * yang kesulitan membedakan warna.
 */

const UKURAN = 14;
const TENGAH = UKURAN / 2;

function Ikon({ warna, putusPutus, jenis }) {
  // Batang digambar sebagai kotak, sesuai bentuk datanya di grafik.
  if (jenis === 'rect' || jenis === 'square') {
    return (
      <svg width={UKURAN} height={UKURAN} viewBox={`0 0 ${UKURAN} ${UKURAN}`} aria-hidden="true">
        <rect width={UKURAN} height={UKURAN} rx="2" fill={warna} />
      </svg>
    );
  }

  return (
    <svg width={UKURAN} height={UKURAN} viewBox={`0 0 ${UKURAN} ${UKURAN}`} aria-hidden="true">
      <line
        x1="0"
        y1={TENGAH}
        x2={UKURAN}
        y2={TENGAH}
        stroke={warna}
        strokeWidth="2"
        strokeDasharray={putusPutus ? '3 2' : undefined}
      />
      <circle
        cx={TENGAH}
        cy={TENGAH}
        r="3"
        fill={putusPutus ? warna : 'var(--kartu)'}
        stroke={warna}
        strokeWidth="2"
      />
    </svg>
  );
}

export default function LegendaGrafik({ payload }) {
  if (!payload?.length) return null;

  return (
    <ul
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: '0.35rem 1rem',
        listStyle: 'none',
        margin: 0,
        padding: '0.35rem 0 0',
        fontSize: 12,
      }}
    >
      {payload.map((seri) => (
        <li
          key={seri.dataKey ?? seri.value}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
        >
          <Ikon
            warna={seri.color}
            // Pola putus-putus dibaca dari serinya sendiri, bukan dari
            // daftar nama: grafik mana pun yang memakai garis putus-putus
            // otomatis mendapat ikon yang benar tanpa perlu didaftarkan.
            putusPutus={Boolean(seri.payload?.strokeDasharray)}
            jenis={seri.type}
          />
          <span style={{ color: 'var(--tinta-lembut)' }}>{seri.value}</span>
        </li>
      ))}
    </ul>
  );
}
