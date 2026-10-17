import { BULAN_AJARAN, getQuranLevelName } from '@/quran_mapping';
import {
  AMBANG_KETUNTASAN,
  bulat,
  capaianTerbaik,
  distribusi,
  ketuntasan,
  narasiKelas,
  peringatanDini,
  potongTargetBulanKosong,
  rataRata,
  rekapQuran,
} from '@/lib/statistik';

/**
 * Alat yang boleh dipanggil asisten.
 *
 * Tiap alat di sini adalah satu bagian dasbor kepala sekolah, dihitung
 * dengan fungsi yang SAMA PERSIS dari lib/statistik.js. Itu disengaja:
 * kalau asisten menghitung sendiri, cepat atau lambat ia akan menjawab
 * "ketuntasan Matematika 87%" sementara dasbor di layar sebelah menulis
 * 91% -- dan tidak akan ada yang tahu mana yang benar. Satu rumus, satu
 * angka, dua tampilan.
 *
 * Model tidak pernah menerima seluruh basis data. Ia hanya bisa meminta
 * potongan lewat alat-alat ini, dan tiap alat hanya melihat `konteks`
 * yang sudah disaring menurut wewenang pemanggil di lib/asisten/konteks.js.
 */

function cariKelas(konteks, nama) {
  if (!nama) return null;
  const cari = String(nama).trim().toLowerCase();
  return (
    konteks.kelas.find((k) => String(k.nama_kelas).trim().toLowerCase() === cari) ||
    konteks.kelas.find((k) => String(k.nama_kelas).trim().toLowerCase().includes(cari)) ||
    null
  );
}

function bulanDipakai(konteks, diminta) {
  if (diminta && konteks.bulanTerisi.includes(diminta)) return diminta;
  return konteks.bulanTerisi[konteks.bulanTerisi.length - 1] || '';
}

function barisKelas(konteks, kelas, bulan) {
  return konteks.perKelas[kelas.id]?.[bulan] || [];
}

function angka(v, d = 1) {
  if (v === null || v === undefined) return null;
  return Number(Number(v).toFixed(d));
}

/** Satu siswa sepanjang tahun ajaran, sama seperti yang dilihat orang tua. */
function bulananSiswa(perBulan, nis) {
  return potongTargetBulanKosong(
    BULAN_AJARAN.map((bulan) => {
      const b = (perBulan[bulan] || []).find((x) => x.nis === nis) || {};
      const n = (v) => (v === null || v === undefined || v === '' ? null : v);
      return {
        bulan,
        rata_b_indo: n(b.rata_b_indo),
        rata_mtk: n(b.rata_mtk),
        rata_ipa: n(b.rata_ipa),
        target_tahfidz: n(b.target_tahfidz),
        capaian_tahfidz: n(b.capaian_tahfidz),
        target_tahsin: n(b.target_tahsin),
        capaian_tahsin: n(b.capaian_tahsin),
      };
    })
  );
}

/* ================================================================
   Definisi alat yang dikirim ke model
   ================================================================ */

export function definisiAlat(konteks) {
  const daftarKelas = konteks.kelas.map((k) => k.nama_kelas);
  const daftarBulan = konteks.bulanTerisi;

  const kelasProp = {
    type: 'string',
    description: `Nama kelas. Yang tersedia: ${daftarKelas.join(', ')}.`,
  };
  const bulanProp = {
    type: 'string',
    description: `Bulan tahun ajaran. Yang sudah ada datanya: ${daftarBulan.join(', ')}. Kosongkan untuk bulan terakhir yang terisi.`,
  };

  return [
    {
      name: 'ketuntasan_antar_kelas',
      description:
        'Rekap seluruh kelas pada satu bulan: persentase siswa yang mencapai target untuk tiap mata pelajaran, plus persen tuntas Tahfidz dan Tahsin. Ini isi tabel "Rekap Seluruh Kelas" dan grafik "Ketuntasan Antar Kelas" di dasbor kepala sekolah. Pakai ini untuk pertanyaan yang membandingkan kelas.',
      input_schema: {
        type: 'object',
        properties: { bulan: bulanProp },
      },
    },
    {
      name: 'rincian_kelas',
      description:
        'Rincian satu kelas pada satu bulan: ketuntasan per mapel, kalimat narasi rekap, nilai tiap siswa, dan capaian terbaik per mapel. Ini isi bagian "Rincian Per Kelas".',
      input_schema: {
        type: 'object',
        properties: { kelas: kelasProp, bulan: bulanProp },
        required: ['kelas'],
      },
    },
    {
      name: 'sebaran_nilai',
      description:
        'Sebaran nilai satu kelas ke dalam rentang <70, 70-79, 80-89, 90-98, 99-100 untuk tiap mapel. Ini isi bagian "Sebaran Nilai".',
      input_schema: {
        type: 'object',
        properties: { kelas: kelasProp, bulan: bulanProp },
        required: ['kelas'],
      },
    },
    {
      name: 'rekap_quran',
      description:
        'Rekap Tahfidz atau Tahsin satu kelas: berapa siswa di atas, sesuai, dan di bawah target, berikut capaian tiap siswa lengkap dengan nama surah atau bab tajwidnya.',
      input_schema: {
        type: 'object',
        properties: {
          kelas: kelasProp,
          bulan: bulanProp,
          jenis: { type: 'string', enum: ['tahfidz', 'tahsin'] },
        },
        required: ['kelas', 'jenis'],
      },
    },
    {
      name: 'perlu_pendampingan',
      description:
        'Siswa yang perlu pendampingan pada satu bulan, berikut alasannya (mapel apa dan berapa nilainya terhadap target, termasuk Tahfidz/Tahsin yang belum mencapai target). Ini isi bagian "Perlu Pendampingan". Kosongkan kelas untuk memindai seluruh kelas sekaligus.',
      input_schema: {
        type: 'object',
        properties: {
          kelas: { ...kelasProp, description: kelasProp.description + ' Kosongkan untuk semua kelas.' },
          bulan: bulanProp,
          batas: { type: 'integer', description: 'Jumlah siswa maksimum yang dikembalikan. Bawaan 20.' },
        },
      },
    },
    {
      name: 'telusur_siswa',
      description:
        'Capaian satu siswa sepanjang tahun ajaran, bulan demi bulan -- akademik, Tahfidz dan Tahsin. Dicari dari nama lengkap atau nama panggilan. Ini isi bagian "Telusur Satu Siswa".',
      input_schema: {
        type: 'object',
        properties: {
          nama: { type: 'string', description: 'Nama lengkap atau nama panggilan siswa.' },
        },
        required: ['nama'],
      },
    },
    {
      name: 'gambar_grafik',
      description:
        'Menggambar hasil ke layar penanya. Panggil ini SETELAH mengambil angkanya. Jenis yang tersedia: ' +
        '"batang" (perbandingan besaran, batang mendatar, selalu mulai dari nol), ' +
        '"selisih" (nilai bisa negatif dan positif, mis. jarak ke target -- biru di atas nol, merah di bawah), ' +
        '"dumbbell" (dua titik per baris, mis. target vs capaian), ' +
        '"garis" (perubahan antar bulan), ' +
        '"sebar" (hubungan dua besaran). ' +
        'PENTING: batang selalu mulai dari nol, jadi untuk angka yang berdempetan tinggi (mis. ketuntasan 88-98% terhadap ambang 90%) JANGAN pakai "batang" -- pakai "selisih" terhadap ambang, atau "dumbbell".',
      input_schema: {
        type: 'object',
        properties: {
          jenis: { type: 'string', enum: ['batang', 'selisih', 'dumbbell', 'garis', 'sebar'] },
          judul: { type: 'string' },
          catatan: { type: 'string', description: 'Satu kalimat penjelas di bawah judul.' },
          satuan: { type: 'string', description: 'mis. "%" atau "poin".' },
          acuan: { type: 'number', description: `Garis acuan, mis. ambang ketuntasan ${AMBANG_KETUNTASAN}. Hanya untuk jenis "batang".` },
          label_dari: { type: 'string' },
          label_ke: { type: 'string' },
          sumbu_x: { type: 'string' },
          sumbu_y: { type: 'string' },
          data: {
            type: 'array',
            description:
              'batang/selisih: [{label, nilai}] · dumbbell: [{label, dari, ke}] · sebar: [{label, x, y}]. Maksimal 24 baris.',
            items: { type: 'object' },
          },
          kategori: { type: 'array', items: { type: 'string' }, description: 'garis: nama titik sumbu-x, mis. ["Juli","Agustus"].' },
          seri: { type: 'array', items: { type: 'object' }, description: 'garis: [{nama, nilai:[angka per kategori]}].' },
          tabel_kolom: { type: 'array', items: { type: 'string' } },
          tabel_baris: { type: 'array', items: { type: 'array' } },
        },
        required: ['jenis', 'judul'],
      },
    },
    {
      name: 'tampilkan_tabel',
      description:
        'Menampilkan tabel angka ke layar penanya, untuk hasil yang lebih enak dibaca sebagai daftar daripada sebagai grafik (mis. daftar siswa berikut alasan pendampingannya).',
      input_schema: {
        type: 'object',
        properties: {
          judul: { type: 'string' },
          catatan: { type: 'string' },
          kolom: { type: 'array', items: { type: 'string' } },
          baris: { type: 'array', items: { type: 'array' } },
        },
        required: ['judul', 'kolom', 'baris'],
      },
    },
  ];
}

/* ================================================================
   Pelaksana alat
   ================================================================ */

export function jalankanAlat(konteks, nama, input) {
  const mapel = konteks.mapel;

  if (nama === 'ketuntasan_antar_kelas') {
    const bulan = bulanDipakai(konteks, input.bulan);
    const baris = konteks.kelas.map((k) => {
      const b = barisKelas(konteks, k, bulan);
      const target = Number(k.target_akademik ?? 90);
      const perMapel = mapel.map((m) => {
        const kt = ketuntasan(b, m.kunci, target);
        return { mapel: m.label, persen_tuntas: kt ? angka(kt.persen) : null, tuntas: kt?.tuntas ?? null, dinilai: kt?.dinilai ?? null };
      });
      const persen = perMapel.map((x) => x.persen_tuntas).filter((v) => v !== null);
      const tf = rekapQuran(b, 'capaian_tahfidz', 'target_tahfidz');
      const ts = rekapQuran(b, 'capaian_tahsin', 'target_tahsin');
      return {
        kelas: k.nama_kelas,
        wali_kelas: k.wali_kelas || null,
        jumlah_siswa: b.length,
        target_akademik: target,
        per_mapel: perMapel,
        ketuntasan_rata: persen.length ? angka(rataRata(persen)) : null,
        tahfidz: { persen_tuntas: angka(tf.persenTuntas), di_atas: tf.diatas, sesuai: tf.sesuai, di_bawah: tf.dibawah },
        tahsin: { persen_tuntas: angka(ts.persenTuntas), di_atas: ts.diatas, sesuai: ts.sesuai, di_bawah: ts.dibawah },
      };
    });
    return { bulan, ambang_ketuntasan: AMBANG_KETUNTASAN, jumlah_kelas: baris.length, baris };
  }

  if (nama === 'rincian_kelas') {
    const k = cariKelas(konteks, input.kelas);
    if (!k) throw new Error(`Kelas "${input.kelas}" tidak ada. Yang tersedia: ${konteks.kelas.map((x) => x.nama_kelas).join(', ')}.`);
    const bulan = bulanDipakai(konteks, input.bulan);
    const b = barisKelas(konteks, k, bulan);
    if (!b.length) throw new Error(`Kelas ${k.nama_kelas} belum punya nilai untuk bulan ${bulan}.`);
    const target = Number(k.target_akademik ?? 90);
    return {
      kelas: k.nama_kelas,
      wali_kelas: k.wali_kelas || null,
      bulan,
      target_akademik: target,
      jumlah_siswa: b.length,
      ketuntasan: mapel.map((m) => {
        const kt = ketuntasan(b, m.kunci, target);
        return { mapel: m.label, persen_tuntas: kt ? angka(kt.persen) : null, tuntas: kt?.tuntas ?? null, dinilai: kt?.dinilai ?? null };
      }),
      narasi: narasiKelas(b, target, bulan, mapel),
      capaian_terbaik: capaianTerbaik(b, mapel),
      siswa: b.map((s) => {
        const o = { nama: s.nama_panggilan, nama_lengkap: s.nama_lengkap };
        mapel.forEach((m) => { o[m.pendek] = angka(s[m.kunci]); });
        return o;
      }),
    };
  }

  if (nama === 'sebaran_nilai') {
    const k = cariKelas(konteks, input.kelas);
    if (!k) throw new Error(`Kelas "${input.kelas}" tidak ada.`);
    const bulan = bulanDipakai(konteks, input.bulan);
    const b = barisKelas(konteks, k, bulan);
    if (!b.length) throw new Error(`Kelas ${k.nama_kelas} belum punya nilai untuk bulan ${bulan}.`);
    return {
      kelas: k.nama_kelas,
      bulan,
      per_mapel: mapel.map((m) => ({
        mapel: m.label,
        rentang: distribusi(b, m.kunci).map((r) => ({ rentang: r.label, jumlah: r.jumlah, persen: angka(r.persen) })),
      })),
    };
  }

  if (nama === 'rekap_quran') {
    const k = cariKelas(konteks, input.kelas);
    if (!k) throw new Error(`Kelas "${input.kelas}" tidak ada.`);
    const jenis = input.jenis === 'tahsin' ? 'tahsin' : 'tahfidz';
    const bulan = bulanDipakai(konteks, input.bulan);
    const b = barisKelas(konteks, k, bulan);
    if (!b.length) throw new Error(`Kelas ${k.nama_kelas} belum punya nilai untuk bulan ${bulan}.`);
    const kc = `capaian_${jenis}`;
    const kt = `target_${jenis}`;
    const r = rekapQuran(b, kc, kt);
    return {
      kelas: k.nama_kelas,
      bulan,
      jenis,
      di_atas: r.diatas,
      sesuai: r.sesuai,
      di_bawah: r.dibawah,
      dinilai: r.dinilai,
      persen_tuntas: angka(r.persenTuntas),
      siswa: b
        .filter((s) => s[kc] !== null && s[kc] !== undefined)
        .map((s) => ({
          nama: s.nama_panggilan,
          capaian_poin: s[kc],
          target_poin: s[kt] ?? null,
          selisih: s[kt] === null || s[kt] === undefined ? null : s[kc] - s[kt],
          capaian_nama: getQuranLevelName(jenis, s[kc]),
          target_nama: s[kt] === null || s[kt] === undefined ? null : getQuranLevelName(jenis, s[kt]),
        })),
    };
  }

  if (nama === 'perlu_pendampingan') {
    const bulan = bulanDipakai(konteks, input.bulan);
    const batas = Number(input.batas) > 0 ? Number(input.batas) : 20;
    const kelasDipindai = input.kelas ? [cariKelas(konteks, input.kelas)].filter(Boolean) : konteks.kelas;
    if (!kelasDipindai.length) throw new Error(`Kelas "${input.kelas}" tidak ada.`);

    const semua = [];
    kelasDipindai.forEach((k) => {
      const b = barisKelas(konteks, k, bulan);
      const target = Number(k.target_akademik ?? 90);
      peringatanDini(b, target, mapel).forEach((s) => {
        semua.push({
          nama: s.nama_panggilan,
          nama_lengkap: s.nama_lengkap,
          kelas: k.nama_kelas,
          wali_kelas: k.wali_kelas || null,
          jumlah_alasan: s.alasan.length,
          alasan: s.alasan,
        });
      });
    });
    semua.sort((a, b) => b.jumlah_alasan - a.jumlah_alasan);
    return {
      bulan,
      total_cocok: semua.length,
      ditampilkan: Math.min(batas, semua.length),
      siswa: semua.slice(0, batas),
    };
  }

  if (nama === 'telusur_siswa') {
    const cari = String(input.nama || '').trim().toLowerCase();
    if (!cari) throw new Error('Sebutkan nama siswanya.');
    const hit = [];
    konteks.kelas.forEach((k) => {
      const perBulan = konteks.perKelas[k.id] || {};
      const dilihat = new Set();
      Object.values(perBulan).forEach((baris) => {
        baris.forEach((s) => {
          if (dilihat.has(s.nis)) return;
          dilihat.add(s.nis);
          const cocok =
            String(s.nama_lengkap).toLowerCase().includes(cari) ||
            String(s.nama_panggilan).toLowerCase().includes(cari);
          if (cocok) hit.push({ kelas: k, siswa: s, perBulan });
        });
      });
    });
    if (!hit.length) throw new Error(`Tidak ada siswa bernama "${input.nama}" dalam data yang boleh dilihat akun ini.`);
    if (hit.length > 6) throw new Error(`"${input.nama}" cocok ke ${hit.length} siswa. Perjelas namanya.`);

    return hit.map(({ kelas, siswa, perBulan }) => {
      const target = Number(kelas.target_akademik ?? 90);
      return {
        nama_lengkap: siswa.nama_lengkap,
        nama_panggilan: siswa.nama_panggilan,
        kelas: kelas.nama_kelas,
        wali_kelas: kelas.wali_kelas || null,
        target_akademik: target,
        bulanan: bulananSiswa(perBulan, siswa.nis)
          .filter((b) =>
            b.rata_b_indo !== null || b.rata_mtk !== null || b.rata_ipa !== null ||
            b.capaian_tahfidz !== null || b.capaian_tahsin !== null
          )
          .map((b) => ({
            bulan: b.bulan,
            b_indo: angka(b.rata_b_indo),
            mtk: angka(b.rata_mtk),
            ipa: angka(b.rata_ipa),
            tahfidz: b.capaian_tahfidz === null ? null : {
              capaian: b.capaian_tahfidz,
              target: b.target_tahfidz,
              surah: getQuranLevelName('tahfidz', b.capaian_tahfidz),
            },
            tahsin: b.capaian_tahsin === null ? null : {
              capaian: b.capaian_tahsin,
              target: b.target_tahsin,
              bab: getQuranLevelName('tahsin', b.capaian_tahsin),
            },
          })),
      };
    });
  }

  /* Dua alat penggambar tidak menghitung apa pun -- hasilnya diteruskan
     apa adanya ke peramban lewat SSE, dan halaman yang menggambarnya. */
  if (nama === 'gambar_grafik') {
    if (input.jenis === 'garis') {
      if (!input.kategori?.length || !input.seri?.length) throw new Error('Jenis "garis" perlu kategori dan seri.');
    } else if (!input.data?.length) {
      throw new Error('Data grafik kosong.');
    }
    return { digambar: input.jenis, baris: (input.data || input.seri || []).length };
  }

  if (nama === 'tampilkan_tabel') {
    if (!input.kolom?.length || !input.baris?.length) throw new Error('Tabel perlu kolom dan baris.');
    return { ditampilkan: input.baris.length };
  }

  throw new Error(`Alat tidak dikenal: ${nama}`);
}

/** Alat yang hasilnya digambar di layar, bukan sekadar dibaca model. */
export const ALAT_TAMPILAN = new Set(['gambar_grafik', 'tampilkan_tabel']);

/** Ringkasan satu baris untuk panel Proses. */
export function ringkasPanggilan(nama, input, hasil) {
  switch (nama) {
    case 'ketuntasan_antar_kelas':
      return `memindai ${hasil.jumlah_kelas} kelas · ${hasil.bulan}`;
    case 'rincian_kelas':
      return `merinci kelas ${hasil.kelas} · ${hasil.bulan} · ${hasil.jumlah_siswa} siswa`;
    case 'sebaran_nilai':
      return `menghitung sebaran nilai kelas ${hasil.kelas} · ${hasil.bulan}`;
    case 'rekap_quran':
      return `rekap ${hasil.jenis} kelas ${hasil.kelas} · ${hasil.dinilai} siswa dinilai`;
    case 'perlu_pendampingan':
      return `memeriksa peringatan dini · ${hasil.bulan} → ${hasil.total_cocok} siswa`;
    case 'telusur_siswa':
      return `membuka profil ${hasil.map((s) => s.nama_panggilan).join(', ')}`;
    case 'gambar_grafik':
      return `menggambar ${input.jenis} · ${input.judul}`;
    case 'tampilkan_tabel':
      return `menyusun tabel · ${input.judul}`;
    default:
      return nama;
  }
}

export { bulat };
