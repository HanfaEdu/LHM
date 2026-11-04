'use client';

import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import {
  Bell, BookMarked, BookOpen, Building2, CalendarDays, Check, ChevronLeft,
  ChevronRight, Clock, Database, EyeOff, FileSpreadsheet, KeyRound, Layers,
  LayoutDashboard, Link2, Maximize, MessageCircle, Minimize, Moon,
  MousePointer2, Network, RefreshCw, School, Server, ShieldCheck, Smartphone,
  Sparkles, Users, X,
} from 'lucide-react';
import st from './press.module.css';

/* =====================================================================
   PRESENTASI SISTEM CAPAIAN AKADEMIK
   =====================================================================
   Satu kanvas berukuran tetap 1600 x 900 yang diskalakan memenuhi
   layar. Ukuran tetap dipilih dengan sengaja: IFP 4K, smart TV 1080p,
   dan laptop menampilkan susunan yang PERSIS sama, jadi yang dilihat
   saat berlatih di laptop adalah yang tampil di depan forum.

   Setiap slide punya sejumlah "langkah". Tombol Lanjut menaikkan
   langkah dulu; setelah langkah terakhir barulah pindah slide. Elemen
   ditandai <T n={k}> dan muncul ketika langkah >= k. Slide yang tidak
   aktif menerima langkah -1, sehingga semua elemennya tersembunyi dan
   animasinya diputar ulang dari awal setiap kali slide itu dibuka.

   Semua nama dan angka di sini FIKTIF.
   ===================================================================== */

const LEBAR = 1600;
const TINGGI = 900;

/** Elemen yang muncul pada langkah ke-n. */
function T({ n = 0, s, a = 'naik', d = 0, className = '', style, children, as: Tag = 'div' }) {
  const tampil = s >= n;
  return (
    <Tag
      className={`${st.t} ${st['a_' + a]} ${tampil ? st.on : ''} ${className}`}
      style={{ ...style, transitionDelay: tampil ? `${d}ms` : '0ms' }}
    >
      {children}
    </Tag>
  );
}

const nyala = (s, n) => (s >= n ? st.on : '');

/* ---------------------------------------------------------------------
   Peta lima bagian -- dipakai di slide gambaran besar, di pojok tiap
   slide bagian ("Anda di sini"), dan di penutup.
   --------------------------------------------------------------------- */
const SIMPUL = [
  { ikon: FileSpreadsheet, nama: 'Input', ket: 'Spreadsheet tiap kelas' },
  { ikon: Layers, nama: 'Rekap', ket: 'Master Rekap sekolah' },
  { ikon: Database, nama: 'Database', ket: 'Cermin data, diperbarui tiap malam' },
  { ikon: LayoutDashboard, nama: 'Dashboard', ket: 'Orang tua & sekolah' },
  { ikon: MessageCircle, nama: 'WhatsApp', ket: 'Balasan & pengingat otomatis' },
];

function PetaBesar({ s, mulai = 1, serentak = false }) {
  return (
    <div className={st.peta}>
      {SIMPUL.map((x, i) => {
        const n = serentak ? 0 : mulai + i;
        const d = serentak ? 200 + i * 260 : 0;
        const Ikon = x.ikon;
        return (
          <Fragment key={x.nama}>
            {i > 0 && (
              <span
                className={`${st.jalur} ${nyala(s, n)}`}
                style={{ transitionDelay: s >= n ? `${d}ms` : '0ms' }}
              />
            )}
            <T s={s} n={n} d={d + 150} a="skala" className={st.simpul}>
              <span className={st.simpulIkon}><Ikon size={56} strokeWidth={1.5} /></span>
              <strong>{x.nama}</strong>
              <span>{x.ket}</span>
            </T>
          </Fragment>
        );
      })}
    </div>
  );
}

function PetaMini({ aktif = [], besar = false }) {
  return (
    <div className={`${st.petaMini} ${besar ? st.petaMiniBesar : ''}`}>
      {SIMPUL.map((x, i) => {
        const Ikon = x.ikon;
        return (
          <Fragment key={x.nama}>
            {i > 0 && <span className={st.miniGaris} />}
            <span className={`${st.miniSimpul} ${aktif.includes(i) ? st.miniAktif : ''}`}>
              <Ikon size={besar ? 30 : 20} strokeWidth={1.8} />
              {besar && <small>{x.nama}</small>}
            </span>
          </Fragment>
        );
      })}
    </div>
  );
}

/* ---------------------------------------------------------------------
   Kerangka yang dipakai berulang
   --------------------------------------------------------------------- */
function Kepala({ s, label, judul, peta }) {
  return (
    <header className={st.kepala}>
      <div>
        <T s={s} a="kiri" className={st.label}>{label}</T>
        <T s={s} a="kiri" d={120} as="h2" className={st.judul}>{judul}</T>
      </div>
      {peta && <T s={s} a="kanan" d={250}><PetaMini aktif={peta} /></T>}
    </header>
  );
}

/** Daftar poin yang muncul satu per satu; poin terbaru disorot. */
function Poin({ s, items, mulai = 1, className = '' }) {
  return (
    <ul className={`${st.poin} ${className}`}>
      {items.map((p, i) => {
        const n = mulai + i;
        const Ikon = p.ikon;
        return (
          <T
            key={p.judul}
            s={s}
            n={n}
            a="kanan"
            as="li"
            className={s === n ? st.poinKini : ''}
          >
            <span className={st.poinTanda}>
              {Ikon ? <Ikon size={26} strokeWidth={1.8} /> : i + 1}
            </span>
            <div>
              <strong>{p.judul}</strong>
              {p.ket && <p>{p.ket}</p>}
            </div>
          </T>
        );
      })}
    </ul>
  );
}

function Hp({ children, className = '', judul = 'Sekolah BIAS', ikon = true }) {
  return (
    <div className={`${st.hp} ${className}`}>
      <div className={st.hpPoni} />
      <div className={st.hpBar}>
        {ikon && <span className={st.hpAvatar}><School size={18} /></span>}
        <div>
          <strong>{judul}</strong>
          <small>online</small>
        </div>
      </div>
      <div className={st.hpLayar}>{children}</div>
    </div>
  );
}

function Pembatas({ s, no, judul, ket, peta }) {
  return (
    <div className={st.tengah}>
      <T s={s} a="skala" className={st.nomorBagian}>{no}</T>
      <T s={s} d={200} className={st.labelBesar}>Bagian {no}</T>
      <T s={s} d={350} a="kabur" as="h2" className={st.judulBagian}>{judul}</T>
      <T s={s} d={600} className={st.petaPembatas}><PetaMini aktif={peta} besar /></T>
      <T s={s} n={1} as="p" className={st.subjudul}>{ket}</T>
    </div>
  );
}

/* =====================================================================
   SLIDE
   ===================================================================== */

function Pembuka({ s }) {
  return (
    <div className={st.tengah}>
      <T s={s} a="skala" className={st.logoBungkus}>
        <span className={st.logoCincin} />
        <span className={st.logoCincin2} />
        <img src="/logo.png" alt="" className={st.logo} />
      </T>
      <T s={s} d={250} className={st.labelBesar}>Sekolah BIAS</T>
      <T s={s} d={450} a="kabur" as="h1" className={st.judulUtama}>Capaian Akademik</T>
      <T s={s} n={1} as="p" className={st.subjudul}>
        Perjalanan satu nilai — dari kelas sampai ke genggaman orang tua
      </T>
      <T s={s} n={2} a="skala" className={st.kutipan}>
        Orang tua dapat melihat perkembangan anaknya <em>setiap hari</em>,
        cukup lewat satu tautan.
      </T>
    </div>
  );
}

const MASALAH = [
  { dulu: 'Perkembangan baru terlihat saat rapor semester', kini: 'Perkembangan terlihat setiap bulan, diperbarui setiap hari' },
  { dulu: 'Orang tua baru tahu di akhir', kini: 'Orang tua ikut mendampingi sejak awal' },
  { dulu: 'Rekap nilai dikerjakan manual', kini: 'Rekap tersusun otomatis' },
];

function Masalah({ s }) {
  return (
    <>
      <Kepala s={s} label="Latar belakang" judul="Mengapa sistem ini dibuat?" />
      <div className={st.barisKartu}>
        {MASALAH.map((m, i) => (
          <T key={m.dulu} s={s} n={i + 1} className={st.kartuBalik}>
            <div
              className={`${st.balikDalam} ${s >= 4 ? st.dibalik : ''}`}
              style={{ transitionDelay: `${i * 220}ms` }}
            >
              <div className={`${st.sisi} ${st.sisiDulu}`}>
                <span className={st.ikonBulat}><X size={34} /></span>
                <small>Sebelumnya</small>
                <p>{m.dulu}</p>
              </div>
              <div className={`${st.sisi} ${st.sisiKini}`}>
                <span className={st.ikonBulat}><Check size={34} /></span>
                <small>Sekarang</small>
                <p>{m.kini}</p>
              </div>
            </div>
          </T>
        ))}
      </div>
      <T s={s} n={4} d={900} as="p" className={st.catatanBawah}>
        <Sparkles size={26} /> Satu sistem menjawab ketiganya sekaligus.
      </T>
    </>
  );
}

function GambaranBesar({ s }) {
  return (
    <>
      <Kepala s={s} label="Gambaran besar" judul="Lima bagian, satu aliran data" />
      <div className={st.petaBungkus}>
        <PetaBesar s={s} />
      </div>
      <T s={s} n={6} as="p" className={st.catatanBawah}>
        Mari kita ikuti satu nilai menelusuri kelima bagian ini.
      </T>
    </>
  );
}

/* ----- Bagian 1: Input --------------------------------------------- */

const KELAS = ['1', '2A', '2B', '3', '4', '5', '6'];
const SISWA = [
  ['Aisyah Putri', '88', '82', '85', 'An-Naba', 'Bab 8'],
  ['Bilal Ramadhan', '90', '78', '84', 'Abasa', 'Bab 7'],
  ['Hana Salsabila', '86', '', '', '', ''],
  ['Muhammad Rafi', '', '', '', '', ''],
];

function Navigasi({ s }) {
  return (
    <>
      <Kepala s={s} label="Bagian 1 · Input nilai" judul="Satu pintu ke spreadsheet kelas" peta={[0]} />
      <div className={st.duaKolom}>
        <T s={s} a="kiri" d={200} className={st.jendela}>
          <div className={st.jendelaBar}><i /><i /><i /><span>Input LHM</span></div>
          <div className={st.jendelaIsi}>
            <div className={st.navJudul}>Pilih kelas untuk mengisi nilai bulan ini</div>
            <div className={st.tabJenjang}>
              {['PG', 'TK', 'SD'].map((j) => (
                <span key={j} className={j === 'SD' ? st.tabAktif : ''}>{j}</span>
              ))}
            </div>
            <div className={st.gridKelas}>
              {KELAS.map((k, i) => (
                <T
                  key={k}
                  s={s}
                  n={1}
                  a="skala"
                  d={i * 90}
                  className={`${st.tombolKelas} ${k === '4' && s >= 2 ? st.ditekan : ''}`}
                >
                  Kelas {k}
                </T>
              ))}
            </div>
            <MousePointer2
              className={`${st.kursor} ${s >= 2 ? st.kursorJalan : ''} ${s >= 1 ? st.kursorAda : ''}`}
              size={46}
              fill="currentColor"
            />
          </div>
          <div className={`${st.lembar} ${s >= 3 ? st.lembarBuka : ''}`}>
            <div className={st.lembarBar}><FileSpreadsheet size={24} /> Nilai Kelas 4 — November</div>
            <table className={st.tabel}>
              <thead>
                <tr><th>Nama</th><th>B. Indo</th><th>MTK</th><th>IPA</th><th>Tahfidz</th><th>Tahsin</th></tr>
              </thead>
              <tbody>
                {SISWA.map((r) => (
                  <tr key={r[0]}>
                    {r.map((c, j) => (
                      <td key={j} className={r[0] === 'Hana Salsabila' && j === 2 ? st.selKetik : ''}>
                        {r[0] === 'Hana Salsabila' && j === 2 ? <span>80</span> : c}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </T>
        <Poin
          s={s}
          items={[
            { judul: 'Tersusun per jenjang dan kelas', ket: 'Satu halaman berisi tombol menuju setiap kelas.' },
            { judul: 'Wali kelas cukup memilih kelasnya', ket: 'Tidak perlu menyimpan banyak tautan spreadsheet.' },
            { judul: 'Spreadsheet kelas langsung terbuka', ket: 'Nilai diisi di tempat yang sudah biasa dipakai.' },
          ]}
        />
      </div>
    </>
  );
}

/* Titik ujung jalur di SVG rekap: kanan tiap kartu kelas -> kiri Master. */
const JALUR_REKAP = KELAS.map((_, i) => {
  const y = 34 + i * 70;
  return `M 230 ${y} C 360 ${y}, 380 250, 510 250`;
});

function Rekap({ s }) {
  return (
    <>
      <Kepala s={s} label="Bagian 1 · Input nilai" judul="Dari tujuh kelas menjadi satu rekap" peta={[0, 1]} />
      <div className={st.duaKolom}>
        <div className={st.rekap}>
          <div className={st.daftarKelas}>
            {KELAS.map((k, i) => (
              <T key={k} s={s} a="kiri" d={i * 70} className={`${st.chipKelas} ${k === '4' && s >= 1 ? st.chipAktif : ''}`}>
                <FileSpreadsheet size={22} /> Kelas {k}
                {k === '4' && <span className={`${st.nilaiBaru} ${nyala(s, 1)}`}>80 ✎</span>}
              </T>
            ))}
          </div>
          <svg className={`${st.jalurRekap} ${nyala(s, 2)}`} viewBox="0 0 520 500" aria-hidden>
            {JALUR_REKAP.map((d, i) => (
              <g key={i}>
                <path id={`jr${i}`} d={d} />
                <circle r="6">
                  <animateMotion dur="2.6s" begin={`${i * 0.35}s`} repeatCount="indefinite">
                    <mpath href={`#jr${i}`} />
                  </animateMotion>
                </circle>
              </g>
            ))}
          </svg>
          <T s={s} n={2} a="skala" className={st.master}>
            <div className={st.masterKepala}><Layers size={28} /> Master Rekap</div>
            {KELAS.map((k, i) => (
              <div key={k} className={`${st.masterBaris} ${nyala(s, 2)}`} style={{ transitionDelay: `${400 + i * 160}ms` }}>
                <span>Kelas {k}</span>
                <span>{[24, 22, 21, 25, 25, 23, 22][i]} siswa</span>
                <Check size={20} />
              </div>
            ))}
          </T>
          <T s={s} n={3} a="naik" className={st.lencana}>
            <ShieldCheck size={24} /> Ketujuh kelas lengkap — siap dikirim
          </T>
        </div>
        <Poin
          s={s}
          items={[
            { judul: 'Wali kelas mengisi spreadsheet kelasnya', ket: 'Masing-masing bekerja di file sendiri.' },
            { judul: 'Terkumpul otomatis di Master Rekap', ket: 'Ketujuh kelas bergabung dalam satu tabel, tanpa disalin manual.' },
            { judul: 'Diperiksa sebelum dikirim', ket: 'Kalau ada kelas yang tiba-tiba kosong, sekolah langsung diberi tahu.' },
          ]}
        />
      </div>
    </>
  );
}

function Sinkron({ s }) {
  return (
    <>
      <Kepala s={s} label="Bagian 1 · Input nilai" judul="Setiap malam, data berpindah sendiri" peta={[1, 2, 3]} />
      <div className={st.malam}>
        <T s={s} n={1} a="skala" className={st.bulan}>
          <span className={st.bulanCahaya} />
          <Moon size={68} strokeWidth={1.4} />
          {[0, 1, 2, 3, 4].map((i) => <i key={i} className={st.bintangKecil} />)}
        </T>
        <T s={s} n={1} d={300} className={st.jam}>
          <Clock size={30} /> 00.00 — setiap tengah malam
        </T>
        <div className={st.rantai}>
          {[
            { ikon: Layers, nama: 'Master Rekap', ket: 'Tempat guru bekerja' },
            { ikon: Database, nama: 'Database', ket: 'Riwayat lintas tahun ajaran' },
            { ikon: LayoutDashboard, nama: 'Dashboard', ket: 'Angka terbaru setiap pagi' },
          ].map((x, i) => {
            const Ikon = x.ikon;
            return (
              <Fragment key={x.nama}>
                {i > 0 && (
                  <span
                    className={`${st.jalur} ${st.jalurPanjang} ${nyala(s, 2)}`}
                    style={{ transitionDelay: s >= 2 ? `${i * 500}ms` : '0ms' }}
                  />
                )}
                <T s={s} n={i === 0 ? 1 : 2} d={i === 0 ? 500 : i * 500 + 300} a="skala" className={st.simpul}>
                  <span className={st.simpulIkon}><Ikon size={52} strokeWidth={1.5} /></span>
                  <strong>{x.nama}</strong>
                  <span>{x.ket}</span>
                </T>
              </Fragment>
            );
          })}
        </div>
        <T s={s} n={3} a="skala" className={st.pesanKunci}>
          Guru tetap bekerja di spreadsheet yang sudah dikenal.
          <strong> Tidak ada aplikasi baru yang harus dipelajari.</strong>
        </T>
      </div>
    </>
  );
}

/* ----- Bagian 2: Dashboard orang tua -------------------------------- */

const BULAN = ['Jul', 'Agu', 'Sep', 'Okt', 'Nov'];
const SERI = [
  { nama: 'B. Indonesia', warna: 'var(--toska)', nilai: [78, 81, 80, 85, 88] },
  { nama: 'Matematika', warna: 'var(--emas)', nilai: [70, 74, 79, 78, 82] },
  { nama: 'IPA', warna: 'var(--mawar)', nilai: [75, 77, 82, 84, 85] },
];
const titikGrafik = (nilai) =>
  nilai.map((v, i) => `${20 + i * 70},${150 - (v - 65) * 5}`).join(' ');

function DashboardOrtu({ s }) {
  return (
    <>
      <Kepala s={s} label="Bagian 2 · Dashboard orang tua" judul="Satu anak, satu tautan" peta={[3]} />
      <div className={st.duaKolom}>
        <T s={s} a="naik" d={200} className={st.hpTengah}>
          <Hp>
            <div className={`${st.layarChat} ${s >= 2 ? st.keluar : ''}`}>
              <div className={st.gelembungMasuk}>
                <b>📄 LAPORAN AKADEMIK SISWA</b>
                <span>👤 <b>Ananda Aisyah Putri</b> (Kelas 4)</span>
                <u className={st.tautan}>
                  akademik-bias.my.id/rapor/k7Qx…
                  <i className={`${st.riak} ${nyala(s, 1)}`} />
                </u>
              </div>
            </div>
            <div className={`${st.layarRapor} ${s >= 2 ? st.masuk : ''}`}>
              <div className={st.raporKepala}>
                <small>Capaian Akademik</small>
                <strong>Aisyah Putri</strong>
                <span>Kelas 4 · November</span>
              </div>
              <div className={st.meteran}>
                {SERI.map((x) => (
                  <div key={x.nama} style={{ '--w': x.warna }}>
                    <b>{x.nilai[4]}</b>
                    <small>{x.nama}</small>
                  </div>
                ))}
              </div>
              <div className={st.grafikKartu}>
                <svg viewBox="0 0 320 170" className={`${st.grafik} ${nyala(s, 3)}`}>
                  {[0, 1, 2, 3].map((g) => <line key={g} x1="10" x2="310" y1={25 + g * 40} y2={25 + g * 40} />)}
                  {SERI.map((x, i) => (
                    <polyline key={x.nama} points={titikGrafik(x.nilai)} style={{ stroke: x.warna, transitionDelay: `${i * 350}ms` }} />
                  ))}
                  {BULAN.map((b, i) => <text key={b} x={20 + i * 70} y="168">{b}</text>)}
                </svg>
              </div>
            </div>
          </Hp>
        </T>
        <Poin
          s={s}
          items={[
            { judul: 'Tautan unik untuk setiap siswa', ket: 'Dikirim ke orang tua, dibuka tanpa perlu login.', ikon: Link2 },
            { judul: 'Langsung terbuka di HP', ket: 'Ringan, dan bisa dipasang di layar utama seperti aplikasi.', ikon: Smartphone },
            { judul: 'Grafik perkembangan bulan demi bulan', ket: 'B. Indonesia, Matematika, dan IPA dalam satu pandangan.', ikon: LayoutDashboard },
          ]}
        />
      </div>
    </>
  );
}

const BATANG_KELAS = [62, 74, 70, 88, 66, 79, 84, 58, 72, 81];

function TahfidzTahsin({ s }) {
  return (
    <>
      <Kepala s={s} label="Bagian 2 · Dashboard orang tua" judul="Tahfidz, Tahsin, dan posisi di kelas" peta={[3]} />
      <div className={st.tigaKartu}>
        <T s={s} n={1} a="naik" className={st.kartu}>
          <div className={st.kartuJudul}><BookOpen size={28} /> Tahfidz</div>
          <div className={st.cincinBungkus}>
            <svg viewBox="0 0 120 120" className={`${st.cincin} ${nyala(s, 1)}`}>
              <circle cx="60" cy="60" r="50" />
              <circle cx="60" cy="60" r="50" style={{ '--p': 0.72 }} />
            </svg>
            <div className={st.cincinAngka}><b>72%</b><small>Juz 30</small></div>
          </div>
          <p className={st.kartuKet}>Terakhir disetor: <b>QS. Al-Ghasyiyah</b></p>
        </T>
        <T s={s} n={2} a="naik" className={st.kartu}>
          <div className={st.kartuJudul}><BookMarked size={28} /> Tahsin</div>
          <div className={st.anakTangga}>
            {Array.from({ length: 12 }, (_, i) => (
              <span
                key={i}
                className={`${i < 8 && s >= 2 ? st.tanggaIsi : ''} ${i === 7 ? st.tanggaKini : ''}`}
                style={{ transitionDelay: `${300 + i * 110}ms` }}
              >
                {i + 1}
              </span>
            ))}
          </div>
          <p className={st.kartuKet}>Sedang belajar: <b>Bab 8 · Mad Asli</b></p>
        </T>
        <T s={s} n={3} a="naik" className={st.kartu}>
          <div className={st.kartuJudul}><Users size={28} /> Posisi di kelas</div>
          <div className={st.batangKelas}>
            {BATANG_KELAS.map((v, i) => (
              <span
                key={i}
                className={i === 3 ? st.batangAnak : ''}
                style={{ height: s >= 3 ? `${v}%` : '4%', transitionDelay: `${300 + i * 80}ms` }}
              >
                {i === 3 && <small>Ananda</small>}
              </span>
            ))}
          </div>
          <p className={st.kartuKet}><EyeOff size={20} /> Nama teman sekelas disamarkan</p>
        </T>
      </div>
      <T s={s} n={3} d={1200} as="p" className={st.catatanBawah}>
        <RefreshCw size={24} /> Data diperbarui setiap hari, mengikuti input guru.
      </T>
    </>
  );
}

/* ----- Bagian 3: Dashboard sekolah ---------------------------------- */

const PERAN = [
  { ikon: Users, judul: 'Wali kelas', ket: 'Seluruh siswa di kelasnya — siapa yang melaju, siapa yang perlu didampingi.' },
  { ikon: School, judul: 'Kepala sekolah', ket: 'Semua kelas di sekolahnya, termasuk penerbitan tautan dan catatan akses orang tua.' },
  { ikon: Building2, judul: 'Biro jenjang', ket: 'Perbandingan capaian antar sekolah dalam satu jenjang.' },
  { ikon: Network, judul: 'Direktur', ket: 'Gambaran utuh seluruh jaringan Sekolah BIAS.' },
];

function DashboardSekolah({ s }) {
  return (
    <>
      <Kepala s={s} label="Bagian 3 · Dashboard sekolah" judul="Empat tingkat pandangan" peta={[3]} />
      <div className={st.duaKolom}>
        <div className={st.lensa}>
          {PERAN.map((p, i) => {
            const Ikon = p.ikon;
            return (
              <div
                key={p.judul}
                className={`${st.bingkai} ${st['bingkai' + i]} ${nyala(s, i + 1)} ${s === i + 1 ? st.bingkaiKini : ''}`}
              >
                <span className={st.bingkaiLabel}><Ikon size={20} /> {p.judul}</span>
              </div>
            );
          })}
          <div className={`${st.titikSiswa} ${nyala(s, 1)}`}>
            {Array.from({ length: 20 }, (_, i) => <i key={i} style={{ transitionDelay: `${200 + i * 40}ms` }} />)}
          </div>
        </div>
        <Poin s={s} items={PERAN} className={st.poinRapat} />
      </div>
    </>
  );
}

/* ----- Bagian 4: Layanan WhatsApp ----------------------------------- */

function Gerbang({ s }) {
  return (
    <>
      <Kepala s={s} label="Bagian 4 · Layanan WhatsApp" judul="Gerbang WhatsApp sekolah" peta={[4]} />
      <div className={st.gerbang}>
        <T s={s} n={1} a="kiri" className={st.ujung}>
          <div className={st.tumpukHp}>
            <Smartphone size={60} strokeWidth={1.4} />
            <Smartphone size={60} strokeWidth={1.4} />
            <Smartphone size={60} strokeWidth={1.4} />
          </div>
          <strong>Orang tua & guru</strong>
        </T>

        <div className={st.lajur}>
          <span className={`${st.jalur} ${st.jalurMaju} ${nyala(s, 2)}`} />
          <T s={s} n={2} d={300} className={st.lajurLabel}>Pesan masuk</T>
          <span className={`${st.jalur} ${st.jalurMundur} ${nyala(s, 3)}`} />
          <T s={s} n={3} d={300} className={`${st.lajurLabel} ${st.lajurEmas}`}>Balasan terkirim</T>
        </div>

        <T s={s} n={1} a="skala" d={250} className={st.gerbangInti}>
          <span className={st.denyut} />
          <span className={st.denyut} style={{ animationDelay: '1.5s' }} />
          <Server size={84} strokeWidth={1.3} />
          <strong>Gerbang WhatsApp</strong>
          <span className={st.online}><i /> Online 24 jam</span>
        </T>

        <div className={st.lajur}>
          <span className={`${st.jalur} ${st.jalurMaju} ${nyala(s, 2)}`} style={{ transitionDelay: s >= 2 ? '500ms' : '0ms' }} />
          <T s={s} n={2} d={700} className={st.lajurLabel}>Diteruskan</T>
          <span className={`${st.jalur} ${st.jalurMundur} ${nyala(s, 3)}`} />
          <T s={s} n={3} d={300} className={`${st.lajurLabel} ${st.lajurEmas}`}>Jawaban sistem</T>
        </div>

        <T s={s} n={1} a="kanan" d={400} className={st.ujung}>
          <span className={st.simpulIkon}><Sparkles size={56} strokeWidth={1.4} /></span>
          <strong>Sistem Capaian Akademik</strong>
        </T>
      </div>
      <T s={s} n={4} a="skala" className={st.pesanKunci}>
        Ibarat <strong>resepsionis yang tidak pernah tidur</strong>: menjaga satu nomor WhatsApp
        sekolah tetap aktif, menerima setiap pesan, lalu menyampaikan balasannya.
      </T>
    </>
  );
}

const NOMOR_DB = ['0813-2•••-4410', '0857-1•••-2093', '0812-3456-7890', '0821-7•••-1188', '0896-4•••-5521'];

function Balasan({ s }) {
  return (
    <>
      <Kepala s={s} label="Bagian 4 · Layanan WhatsApp" judul="Disapa, langsung dibalas" peta={[2, 4]} />
      <div className={st.duaKolom}>
        <T s={s} a="naik" d={200} className={st.hpTengah}>
          <Hp>
            <div className={`${st.obrolan} ${st.obrolanRapat}`}>
              <T s={s} n={1} a="kanan" className={st.gelembungKeluar}>
                <span>Assalamu’alaikum, mohon kirim link <mark className={st.kataKunci}>akademik</mark> 🙏</span>
                <small>07.12 ✓✓</small>
              </T>
              <div className={`${st.mengetik} ${s === 3 ? st.on : ''}`}><i /><i /><i /></div>
              <T s={s} n={4} a="kiri" className={st.gelembungMasuk}>
                <b>📄 LAPORAN AKADEMIK SISWA</b>
                <span>👤 <b>Ananda Aisyah Putri</b> (Kelas 4)</span>
                <u className={st.tautan}>akademik-bias.my.id/rapor/k7Qx…</u>
                <span>👤 <b>Ananda Ahmad Fauzan</b> (Kelas 1)</span>
                <u className={st.tautan}>akademik-bias.my.id/rapor/p2Lm…</u>
                <small>07.12</small>
              </T>
            </div>
          </Hp>
        </T>
        <div className={st.pencocok}>
          <T s={s} n={2} a="kanan" className={st.pengirim}>
            <Smartphone size={28} />
            <div><small>Nomor pengirim</small><b>0812-3456-7890</b></div>
          </T>
          <T s={s} n={2} a="kanan" d={200} className={st.daftarNomor}>
            <div className={st.daftarJudul}><Database size={22} /> Nomor orang tua terdaftar</div>
            {NOMOR_DB.map((x, i) => (
              <div key={x} className={`${st.barisNomor} ${i === 2 && s >= 3 ? st.cocok : ''}`}>{x}</div>
            ))}
            <span className={`${st.pemindai} ${s === 2 ? st.on : ''}`} />
          </T>
          <T s={s} n={3} a="skala" d={200} className={st.hasilCocok}>
            <Check size={30} />
            <div>
              <small>Dikenali sebagai orang tua dari</small>
              <b>Aisyah Putri (Kelas 4) & Ahmad Fauzan (Kelas 1)</b>
            </div>
          </T>
          <div className={st.chipBaris}>
            <T s={s} n={4} d={500} className={st.chip}>Cukup sertakan kata “akademik”</T>
            <T s={s} n={4} d={700} className={st.chip}>Yang dikenali nomornya, bukan nama</T>
            <T s={s} n={4} d={900} className={st.chip}>Percakapan lain tidak dibalas otomatis</T>
          </div>
        </div>
      </div>
    </>
  );
}

const PROGRES = [
  { nama: 'B. Indonesia', isi: 100 },
  { nama: 'Matematika', isi: 64 },
  { nama: 'IPA', isi: 100 },
  { nama: 'Tahfidz', isi: 84 },
  { nama: 'Tahsin', isi: 100 },
];

function Pengingat({ s }) {
  return (
    <>
      <Kepala s={s} label="Bagian 4 · Layanan WhatsApp" judul="Pengingat wali kelas tiap tanggal 28" peta={[1, 4]} />
      <div className={st.tigaPengingat}>
        <T s={s} a="kiri" d={200} className={`${st.kartu} ${st.kalender}`}>
          <div className={st.kartuJudul}><CalendarDays size={28} /> November 2026</div>
          <div className={st.gridTanggal}>
            {['S', 'S', 'R', 'K', 'J', 'S', 'M'].map((h, i) => <b key={i}>{h}</b>)}
            {Array.from({ length: 6 }, (_, i) => <span key={'k' + i} />)}
            {Array.from({ length: 30 }, (_, i) => (
              <span key={i} className={i + 1 === 28 ? `${st.tgl28} ${nyala(s, 1)}` : ''}>
                {i + 1}
                {i + 1 === 28 && <Bell size={18} className={st.lonceng} />}
              </span>
            ))}
          </div>
        </T>

        <T s={s} n={2} a="naik" className={st.kartu}>
          <div className={st.kartuJudul}><Layers size={28} /> Progres input · Kelas 4</div>
          <div className={st.progres}>
            {PROGRES.map((p, i) => (
              <div key={p.nama} className={p.isi < 100 ? st.kurang : ''}>
                <span>{p.nama}</span>
                <div className={st.progresJalur}>
                  <i style={{ width: s >= 2 ? `${p.isi}%` : '0%', transitionDelay: `${300 + i * 200}ms` }} />
                </div>
                <b>{p.isi === 100 ? <Check size={22} /> : `${p.isi}%`}</b>
              </div>
            ))}
          </div>
        </T>

        <T s={s} n={3} a="kanan" className={st.hpKecil}>
          <Hp judul="Pengingat otomatis">
            <div className={st.obrolan}>
              <div className={`${st.gelembungMasuk} ${st.gelembungKecil}`}>
                <span>Assalamu’alaikum Bapak/Ibu <b>Ustadzah Fatimah</b> 🙏</span>
                <span>Pengingat nilai <b>Kelas 4</b> bulan <b>November</b> (T.A. 2026-2027). Per hari ini yang belum terisi:</span>
                <span>• <b>Rata MTK</b>: 9 dari 25 siswa belum</span>
                <span>• <b>Capaian Tahfidz</b>: 4 dari 25 siswa belum</span>
                <span>Input/Edit LHM: <u className={st.tautan}>tautan halaman input</u></span>
              </div>
            </div>
          </Hp>
        </T>
      </div>
      <div className={st.chipBaris} style={{ justifyContent: 'center', marginTop: 28 }}>
        <T s={s} n={4} className={st.chip}>Kelas yang sudah lengkap tidak dikirimi</T>
        <T s={s} n={4} d={200} className={st.chip}>Langsung berisi tautan ke halaman input</T>
        <T s={s} n={4} d={400} className={st.chip}>Berjalan sendiri setiap bulan</T>
      </div>
    </>
  );
}

/* ----- Keamanan & penutup ------------------------------------------- */

const AMAN = [
  { ikon: Link2, judul: 'Tautan unik per anak', ket: 'Kode acak yang tidak bisa ditebak. Satu tautan hanya membuka satu anak.' },
  { ikon: KeyRound, judul: 'PIN bila diperlukan', ket: 'Lapisan pengaman tambahan yang bisa diaktifkan sekolah.' },
  { ikon: EyeOff, judul: 'Nama teman disamarkan', ket: 'Perbandingan kelas tanpa membuka identitas siswa lain.' },
  { ikon: ShieldCheck, judul: 'Akses sesuai peran', ket: 'Wali kelas melihat kelasnya, kepala sekolah melihat sekolahnya.' },
];

function Keamanan({ s }) {
  return (
    <>
      <Kepala s={s} label="Kepercayaan" judul="Data anak tetap terjaga" />
      <div className={st.empatKartu}>
        {AMAN.map((x, i) => {
          const Ikon = x.ikon;
          return (
            <T key={x.judul} s={s} n={i + 1} a="naik" className={`${st.kartu} ${st.kartuAman}`}>
              <span className={st.ikonAman}><Ikon size={48} strokeWidth={1.5} /></span>
              <strong>{x.judul}</strong>
              <p>{x.ket}</p>
            </T>
          );
        })}
      </div>
    </>
  );
}

function Penutup({ s }) {
  return (
    <div className={st.tengah}>
      <div className={st.petaPenutup}><PetaBesar s={s} serentak /></div>
      <T s={s} n={1} a="kabur" as="h2" className={st.judulUtama} style={{ fontSize: 104 }}>
        Capaian Akademik
      </T>
      <T s={s} n={1} d={300} as="p" className={st.subjudul}>
        Nilai diinput sekali — tersampaikan setiap hari.
      </T>
      <T s={s} n={2} a="skala" className={st.terimaKasih}>
        <span>Terima kasih</span>
        <small>Jazakumullahu khairan</small>
      </T>
      <T s={s} n={2} d={400} className={st.alamat}>akademik-bias.my.id</T>
    </div>
  );
}

/* =====================================================================
   DAFTAR SLIDE
   langkah = jumlah klik Lanjut di dalam slide sebelum pindah.
   rona    = warna lembut latar untuk bagian itu.
   ===================================================================== */
const RONA = { awal: '#2f8f83', input: '#4f9a6b', ortu: '#b9924a', sekolah: '#3f7fa6', wa: '#3aa57a' };

const SLIDE = [
  { judul: 'Pembuka', langkah: 2, rona: RONA.awal, isi: (s) => <Pembuka s={s} /> },
  { judul: 'Latar belakang', langkah: 4, rona: RONA.awal, isi: (s) => <Masalah s={s} /> },
  { judul: 'Gambaran besar', langkah: 6, rona: RONA.awal, isi: (s) => <GambaranBesar s={s} /> },
  {
    judul: 'Bagian 1', langkah: 1, rona: RONA.input,
    isi: (s) => <Pembatas s={s} no={1} judul="Input Nilai" peta={[0, 1, 2]}
      ket="Guru mengisi nilai di spreadsheet — sistem yang mengantarkannya." />,
  },
  { judul: 'Halaman navigasi', langkah: 3, rona: RONA.input, isi: (s) => <Navigasi s={s} /> },
  { judul: 'Master Rekap', langkah: 3, rona: RONA.input, isi: (s) => <Rekap s={s} /> },
  { judul: 'Sinkron malam', langkah: 3, rona: RONA.input, isi: (s) => <Sinkron s={s} /> },
  {
    judul: 'Bagian 2', langkah: 1, rona: RONA.ortu,
    isi: (s) => <Pembatas s={s} no={2} judul="Dashboard Orang Tua" peta={[3]}
      ket="Setiap siswa punya halaman capaiannya sendiri — dinamis, interaktif, dan selalu terbaru." />,
  },
  { judul: 'Satu anak, satu tautan', langkah: 3, rona: RONA.ortu, isi: (s) => <DashboardOrtu s={s} /> },
  { judul: 'Tahfidz & Tahsin', langkah: 3, rona: RONA.ortu, isi: (s) => <TahfidzTahsin s={s} /> },
  {
    judul: 'Bagian 3', langkah: 1, rona: RONA.sekolah,
    isi: (s) => <Pembatas s={s} no={3} judul="Dashboard Sekolah" peta={[3]}
      ket="Dari satu kelas sampai seluruh jaringan — tiap peran melihat yang menjadi tanggung jawabnya." />,
  },
  { judul: 'Empat tingkat', langkah: 4, rona: RONA.sekolah, isi: (s) => <DashboardSekolah s={s} /> },
  {
    judul: 'Bagian 4', langkah: 1, rona: RONA.wa,
    isi: (s) => <Pembatas s={s} no={4} judul="Layanan WhatsApp" peta={[4]}
      ket="Tautan rapor yang bisa diminta kapan saja, dan pengingat yang datang tepat waktu." />,
  },
  { judul: 'Gerbang WhatsApp', langkah: 4, rona: RONA.wa, isi: (s) => <Gerbang s={s} /> },
  { judul: 'Balasan otomatis', langkah: 4, rona: RONA.wa, isi: (s) => <Balasan s={s} /> },
  { judul: 'Pengingat tanggal 28', langkah: 4, rona: RONA.wa, isi: (s) => <Pengingat s={s} /> },
  { judul: 'Keamanan data', langkah: 4, rona: RONA.awal, isi: (s) => <Keamanan s={s} /> },
  { judul: 'Penutup', langkah: 2, rona: RONA.awal, isi: (s) => <Penutup s={s} /> },
];

const TOTAL_LANGKAH = SLIDE.reduce((n, x) => n + x.langkah + 1, 0);
const LANGKAH_SEBELUM = SLIDE.map((_, i) =>
  SLIDE.slice(0, i).reduce((n, x) => n + x.langkah + 1, 0));

/* =====================================================================
   LATAR
   ===================================================================== */
const PARTIKEL = Array.from({ length: 28 }, (_, i) => ({
  left: `${(i * 37 + 11) % 100}%`,
  top: `${(i * 53 + 7) % 100}%`,
  size: 2 + (i % 3) * 1.5,
  dur: 22 + ((i * 7) % 18),
  delay: -((i * 5) % 22),
}));

function Latar({ rona }) {
  return (
    <div className={st.latar} aria-hidden>
      <div className={st.rona} style={{ backgroundColor: rona }} />
      <div className={`${st.gumpal} ${st.gumpal1}`} />
      <div className={`${st.gumpal} ${st.gumpal2}`} />
      <div className={`${st.gumpal} ${st.gumpal3}`} />
      <div className={`${st.gumpal} ${st.gumpal4}`} />
      <svg className={st.pola} viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid slice">
        <defs>
          <pattern id="bintang8" width="100" height="100" patternUnits="userSpaceOnUse">
            <g fill="none" stroke="currentColor" strokeWidth="1">
              <rect x="25" y="25" width="50" height="50" />
              <rect x="25" y="25" width="50" height="50" transform="rotate(45 50 50)" />
              <circle cx="50" cy="50" r="12" />
              <path d="M0 50 H14 M86 50 H100 M50 0 V14 M50 86 V100" />
            </g>
          </pattern>
        </defs>
        <rect width="1000" height="1000" fill="url(#bintang8)" />
      </svg>
      <div className={st.cahaya} />
      {PARTIKEL.map((p, i) => (
        <i
          key={i}
          className={st.partikel}
          style={{
            left: p.left, top: p.top, width: p.size, height: p.size,
            animationDuration: `${p.dur}s, ${4 + (i % 5)}s`,
            animationDelay: `${p.delay}s, ${-(i % 4)}s`,
          }}
        />
      ))}
      <div className={st.vinyet} />
    </div>
  );
}

/* =====================================================================
   HALAMAN
   ===================================================================== */
export default function Presentasi() {
  const [pos, setPos] = useState({ i: 0, s: 0 });
  const [skala, setSkala] = useState(1);
  const [layarPenuh, setLayarPenuh] = useState(false);
  const [diam, setDiam] = useState(false);
  const sentuh = useRef(null);
  const kunciLayar = useRef(null);

  const maju = useCallback(() => setPos((p) => {
    if (p.s < SLIDE[p.i].langkah) return { i: p.i, s: p.s + 1 };
    if (p.i < SLIDE.length - 1) return { i: p.i + 1, s: 0 };
    return p;
  }), []);

  const mundur = useCallback(() => setPos((p) => {
    if (p.s > 0) return { i: p.i, s: p.s - 1 };
    // Kembali ke slide sebelumnya dalam keadaan utuh, bukan dari awal:
    // penyaji yang mundur biasanya ingin melihat ulang isinya, bukan
    // memutar ulang seluruh animasinya.
    if (p.i > 0) return { i: p.i - 1, s: SLIDE[p.i - 1].langkah };
    return p;
  }), []);

  const lompat = useCallback((i) => setPos({ i, s: 0 }), []);

  const alihLayarPenuh = useCallback(() => {
    try {
      if (document.fullscreenElement) document.exitFullscreen();
      else document.documentElement.requestFullscreen?.();
    } catch { /* peramban TV tertentu tidak mendukung -- abaikan */ }
  }, []);

  // Skala kanvas mengikuti layar.
  useEffect(() => {
    const ukur = () => setSkala(Math.min(window.innerWidth / LEBAR, window.innerHeight / TINGGI));
    ukur();
    window.addEventListener('resize', ukur);
    return () => window.removeEventListener('resize', ukur);
  }, []);

  // Slide awal dari alamat (#5 = slide ke-5), supaya bisa langsung
  // membuka bagian tertentu saat sesi tanya jawab.
  useEffect(() => {
    const baca = () => {
      const n = parseInt(window.location.hash.slice(1), 10);
      if (n >= 1 && n <= SLIDE.length) setPos((p) => (p.i === n - 1 ? p : { i: n - 1, s: 0 }));
    };
    baca();
    window.addEventListener('hashchange', baca);
    return () => window.removeEventListener('hashchange', baca);
  }, []);

  // Lewati putaran pertama: saat itu pos masih slide 1 dan alamat
  // #nomor yang dibuka belum sempat dibaca -- menulisnya akan menimpa
  // alamat itu dengan #1.
  const putaranPertama = useRef(true);
  useEffect(() => {
    if (putaranPertama.current) { putaranPertama.current = false; return; }
    window.history.replaceState(null, '', `#${pos.i + 1}`);
  }, [pos.i]);

  // Papan ketik, remote TV, dan klik presenter (yang mengirim PageDown).
  useEffect(() => {
    const tekan = (e) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const k = e.key;
      // Tombol OK remote pada tombol yang sedang terfokus sudah memicu
      // klik tombol itu sendiri; kalau ikut ditangani di sini, slide
      // maju dua langkah sekaligus.
      if ((k === 'Enter' || k === ' ') && e.target.closest?.('button')) return;
      if (['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter', 'MediaTrackNext'].includes(k)) {
        e.preventDefault(); maju();
      } else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace', 'MediaTrackPrevious'].includes(k)) {
        e.preventDefault(); mundur();
      } else if (k === 'Home') {
        lompat(0);
      } else if (k === 'End') {
        lompat(SLIDE.length - 1);
      } else if (k === 'f' || k === 'F') {
        alihLayarPenuh();
      }
    };
    window.addEventListener('keydown', tekan);
    return () => window.removeEventListener('keydown', tekan);
  }, [maju, mundur, lompat, alihLayarPenuh]);

  // Layar penuh + cegah TV/IFP meredup saat presentasi berlangsung.
  useEffect(() => {
    const ubah = async () => {
      const penuh = !!document.fullscreenElement;
      setLayarPenuh(penuh);
      try {
        if (penuh && navigator.wakeLock) kunciLayar.current = await navigator.wakeLock.request('screen');
        else { await kunciLayar.current?.release(); kunciLayar.current = null; }
      } catch { /* tidak semua peramban mengizinkan */ }
    };
    document.addEventListener('fullscreenchange', ubah);
    return () => document.removeEventListener('fullscreenchange', ubah);
  }, []);

  // Kursor dan tombol memudar saat tidak disentuh, supaya layar bersih.
  useEffect(() => {
    let waktu;
    const gerak = () => {
      setDiam(false);
      clearTimeout(waktu);
      waktu = setTimeout(() => setDiam(true), 3000);
    };
    gerak();
    window.addEventListener('pointermove', gerak);
    window.addEventListener('pointerdown', gerak);
    return () => {
      clearTimeout(waktu);
      window.removeEventListener('pointermove', gerak);
      window.removeEventListener('pointerdown', gerak);
    };
  }, []);

  // Sentuhan: usap kiri/kanan, atau ketuk -- sepertiga kiri layar
  // untuk mundur, sisanya untuk maju.
  const mulaiSentuh = (e) => {
    if (e.target.closest('button')) return;
    sentuh.current = { x: e.clientX, y: e.clientY };
  };
  const akhirSentuh = (e) => {
    const awal = sentuh.current;
    sentuh.current = null;
    if (!awal || e.target.closest('button')) return;
    const dx = e.clientX - awal.x;
    const dy = e.clientY - awal.y;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0) maju(); else mundur();
      return;
    }
    if (Math.abs(dx) < 12 && Math.abs(dy) < 12) {
      if (e.clientX < window.innerWidth / 3) mundur(); else maju();
    }
  };

  const kini = SLIDE[pos.i];
  const kemajuan = (LANGKAH_SEBELUM[pos.i] + pos.s + 1) / TOTAL_LANGKAH;

  return (
    <div
      className={`${st.akar} ${diam ? st.diam : ''}`}
      onPointerDown={mulaiSentuh}
      onPointerUp={akhirSentuh}
    >
      <Latar rona={kini.rona} />

      <div
        className={st.kanvas}
        style={{ transform: `translate(-50%, -50%) scale(${skala})` }}
      >
        {SLIDE.map((x, i) => (
          <section
            key={x.judul}
            className={`${st.slide} ${i === pos.i ? st.aktif : ''}`}
            aria-hidden={i !== pos.i}
          >
            {x.isi(i === pos.i ? pos.s : -1)}
          </section>
        ))}
        <div className={`${st.petunjuk} ${pos.i === 0 && pos.s === 0 ? st.on : ''}`}>
          Sentuh layar atau tekan <ChevronRight size={22} /> untuk melanjutkan
        </div>
      </div>

      <div className={st.kemajuan} style={{ transform: `scaleX(${kemajuan})` }} />

      <nav className={st.kontrol}>
        <span className={st.posisi}>
          <b>{pos.i + 1}</b> / {SLIDE.length} · {kini.judul}
        </span>
        <div className={st.titik}>
          {SLIDE.map((x, i) => (
            <button
              key={x.judul}
              type="button"
              aria-label={`Ke slide ${i + 1}: ${x.judul}`}
              className={i === pos.i ? st.titikAktif : ''}
              onClick={() => lompat(i)}
            />
          ))}
        </div>
        <div className={st.tombolGrup}>
          <button type="button" onClick={mundur} aria-label="Kembali"><ChevronLeft size={30} /></button>
          <button type="button" onClick={maju} className={st.tombolLanjut} aria-label="Lanjut">
            Lanjut <ChevronRight size={30} />
          </button>
          <button type="button" onClick={alihLayarPenuh} aria-label="Layar penuh">
            {layarPenuh ? <Minimize size={26} /> : <Maximize size={26} />}
          </button>
        </div>
      </nav>
    </div>
  );
}
