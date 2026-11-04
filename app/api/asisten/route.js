import Anthropic from '@anthropic-ai/sdk';
import { NextResponse } from 'next/server';
import { pastikanBerwenang, muatKonteks } from '@/lib/asisten/konteks';
import {
  definisiAlat,
  jalankanAlat,
  ringkasPanggilan,
  ALAT_TAMPILAN,
} from '@/lib/asisten/perkakas';
import { AMBANG_KETUNTASAN } from '@/lib/statistik';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * Asisten data untuk dasbor.
 *
 * Kunci Anthropic HANYA ada di sini. Peramban tidak pernah menerimanya:
 * variabelnya tanpa awalan NEXT_PUBLIC_, jadi Next.js tidak akan pernah
 * menyertakannya ke bundel klien. Halaman asisten berbicara ke endpoint
 * ini, bukan ke api.anthropic.com.
 *
 * Jawaban dialirkan sebagai SSE, bukan menunggu selesai lalu dikirim
 * sekaligus. Bukan sekadar supaya terlihat hidup: satu pertanyaan bisa
 * memicu beberapa putaran pemanggilan alat dan memakan puluhan detik,
 * dan menunggu diam-diam selama itu tidak bisa dibedakan dari macet.
 */

const MODEL = 'claude-opus-5';

/* Fallback sisi server: kalau model menolak satu permintaan karena
   klasifikasi keamanan, Anthropic mengalihkannya ke model lain alih-alih
   mengembalikan jawaban kosong. Dimatikan dengan mengubah baris ini ke
   false kalau organisasinya belum mendapat akses beta tersebut. */
const PAKAI_FALLBACK = true;
const BETA_FALLBACK = 'server-side-fallback-2026-07-01';

/** Batas putaran alat, supaya satu pertanyaan tidak berputar tanpa henti. */
const MAKS_PUTARAN = 8;

function instruksi(konteks, profil) {
  const s = konteks.sekolah;
  const namaSekolah =
    s.length === 1 ? s[0].nama : `${s.length} sekolah: ${s.map((x) => x.nama).join(', ')}`;

  const peran =
    profil.role === 'kepala_sekolah'
      ? 'kepala sekolah'
      : profil.role === 'direktur_area'
        ? 'biro akademik / direktur area'
        : 'wali kelas';

  return [
    `Kamu asisten data akademik untuk ${namaSekolah}, tahun ajaran ${konteks.tahunAjaran}.`,
    `Penanya adalah ${profil.nama || 'pengguna'}, berperan sebagai ${peran}.`,
    '',
    'JAWAB SELALU DALAM BAHASA INDONESIA yang ringkas, lugas, dan sopan.',
    '',
    'DATA YANG BOLEH KAMU LIHAT:',
    `- ${konteks.kelas.length} kelas: ${konteks.kelas.map((k) => k.nama_kelas).join(', ')}.`,
    `- ${konteks.jumlahSiswa} siswa.`,
    `- Mata pelajaran yang dinilai di jenjang ini: ${konteks.mapel.map((m) => m.label).join(', ')}.`,
    `- Bulan yang SUDAH ADA DATANYA: ${konteks.bulanTerisi.join(', ') || '(belum ada)'}.`,
    '  Bulan lain dalam tahun ajaran BELUM diisi. Jangan pernah menyebut tren setahun penuh',
    '  kalau bulan yang terisi baru sedikit — sebutkan terus terang berapa bulan yang ada.',
    `- Ketuntasan akademik: persentase siswa yang mencapai target kelasnya. Ambang ${AMBANG_KETUNTASAN}%;`,
    `  di bawah itu kelas dianggap perlu perhatian khusus.`,
    '- Tahfidz dan Tahsin diukur dalam POIN, dengan target dan capaian terpisah tiap bulan.',
    '  Poin memetakan ke nama surah (tahfidz) dan nama bab tajwid (tahsin).',
    '',
    'CARA KERJA — ikuti urutannya:',
    '1. Ambil angka HANYA lewat alat yang tersedia. Jangan pernah menghitung dari ingatan,',
    '   dan jangan menyebut angka yang tidak dikembalikan salah satu alat.',
    '2. Setelah dapat angkanya, panggil gambar_grafik (atau tampilkan_tabel kalau berupa daftar)',
    '   supaya penanya melihat wujud datanya, bukan hanya membaca kalimat.',
    '3. Baru tulis jawaban akhir: 2–4 kalimat. Sebut angka konkret dan nama kelas/siswa.',
    '   Jangan mengulang isi grafik baris per baris — grafiknya sudah terlihat.',
    '4. Batasi daftar di grafik ke 10–15 baris supaya terbaca.',
    '5. Kalau pertanyaannya tidak bisa dijawab dari data ini, katakan apa yang kurang.',
    '   Jangan menebak, dan jangan mengarang nama siswa.',
    '',
    profil.role === 'wali_kelas'
      ? 'Catatan: penanya wali kelas, jadi data yang dimuat hanya kelasnya sendiri. Kalau ia menanyakan kelas lain, jelaskan bahwa datanya memang tidak tersedia untuk akunnya.'
      : '',
  ]
    .filter(Boolean)
    .join('\n');
}

export async function POST(request) {
  const wewenang = await pastikanBerwenang(request);
  if (wewenang.galat) {
    return NextResponse.json({ galat: wewenang.galat }, { status: wewenang.status });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      {
        galat:
          'ANTHROPIC_API_KEY belum diatur. Isi di Vercel > Settings > Environment ' +
          'Variables untuk environment yang sedang dipakai, lalu Redeploy. ' +
          'Lihat docs/ASISTEN.md untuk langkahnya.',
      },
      { status: 503 }
    );
  }

  let badan;
  try {
    badan = await request.json();
  } catch {
    return NextResponse.json({ galat: 'Permintaan tidak terbaca.' }, { status: 400 });
  }

  const pertanyaan = String(badan?.pertanyaan || '').trim();
  if (!pertanyaan) {
    return NextResponse.json({ galat: 'Pertanyaan kosong.' }, { status: 400 });
  }
  if (pertanyaan.length > 2000) {
    return NextResponse.json({ galat: 'Pertanyaan terlalu panjang.' }, { status: 400 });
  }

  const konteks = await muatKonteks({
    db: wewenang.db,
    profil: wewenang.profil,
    sekolahBoleh: wewenang.sekolahBoleh,
    tahunAjaran: badan?.tahunAjaran,
  });
  if (konteks.galat) {
    return NextResponse.json({ galat: konteks.galat }, { status: 404 });
  }

  /* Riwayat percakapan datang dari peramban, jadi tidak dipercaya: hanya
     peran dan teksnya yang diambil, dan panjangnya dipangkas. Isi apa pun
     di dalamnya tetap data, bukan perintah -- aturannya ada di `system`,
     yang tidak pernah berasal dari klien. */
  const riwayat = Array.isArray(badan?.riwayat)
    ? badan.riwayat
        .slice(-6)
        .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
        .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }))
    : [];

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const alat = definisiAlat(konteks);
  const encoder = new TextEncoder();

  const aliran = new ReadableStream({
    async start(controller) {
      let ditutup = false;
      const kirim = (jenis, data) => {
        if (ditutup) return;
        controller.enqueue(encoder.encode(`event: ${jenis}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      try {
        kirim('konteks', {
          sekolah: konteks.sekolah.map((s) => s.nama),
          tahunAjaran: konteks.tahunAjaran,
          kelas: konteks.kelas.map((k) => k.nama_kelas),
          bulanTerisi: konteks.bulanTerisi,
          jumlahSiswa: konteks.jumlahSiswa,
          peran: wewenang.profil.role,
          nama: wewenang.profil.nama,
        });

        const pesan = [...riwayat, { role: 'user', content: pertanyaan }];
        let putaran = 0;

        while (putaran < MAKS_PUTARAN) {
          putaran += 1;

          const parameter = {
            model: MODEL,
            max_tokens: 8000,
            system: [
              { type: 'text', text: instruksi(konteks, wewenang.profil), cache_control: { type: 'ephemeral' } },
            ],
            thinking: { type: 'adaptive', display: 'summarized' },
            output_config: { effort: 'medium' },
            tools: alat,
            messages: pesan,
          };

          const aliranPesan = PAKAI_FALLBACK
            ? anthropic.beta.messages.stream({
                ...parameter,
                betas: [BETA_FALLBACK],
                fallbacks: 'default',
              })
            : anthropic.messages.stream(parameter);

          for await (const peristiwa of aliranPesan) {
            if (peristiwa.type !== 'content_block_delta') continue;
            const d = peristiwa.delta;
            if (d.type === 'text_delta') kirim('teks', { potongan: d.text });
            else if (d.type === 'thinking_delta') kirim('pikir', { potongan: d.thinking });
          }

          const balasan = await aliranPesan.finalMessage();

          if (balasan.stop_reason === 'refusal') {
            kirim('galat', {
              pesan:
                'Permintaan ini ditolak oleh penyaring keamanan model. Coba susun ulang pertanyaannya.',
            });
            break;
          }

          if (balasan.stop_reason === 'max_tokens') {
            kirim('galat', { pesan: 'Jawaban terpotong karena terlalu panjang. Persempit pertanyaannya.' });
            break;
          }

          if (balasan.stop_reason === 'pause_turn') {
            pesan.push({ role: 'assistant', content: balasan.content });
            continue;
          }

          if (balasan.stop_reason !== 'tool_use') {
            kirim('selesai', { putaran });
            break;
          }

          const panggilan = balasan.content.filter((b) => b.type === 'tool_use');
          pesan.push({ role: 'assistant', content: balasan.content });

          const hasilAlat = [];
          for (const p of panggilan) {
            kirim('alat-mulai', { id: p.id, nama: p.name });
            try {
              const hasil = jalankanAlat(konteks, p.name, p.input || {});
              kirim('alat-selesai', {
                id: p.id,
                nama: p.name,
                ringkas: ringkasPanggilan(p.name, p.input || {}, hasil),
              });
              /* Alat penggambar mengirim masukannya apa adanya ke layar --
                 halaman yang menggambar, bukan server. */
              if (ALAT_TAMPILAN.has(p.name)) {
                kirim(p.name === 'gambar_grafik' ? 'gambar' : 'tabel', p.input || {});
              }
              hasilAlat.push({
                type: 'tool_result',
                tool_use_id: p.id,
                content: JSON.stringify(hasil),
              });
            } catch (e) {
              const pesanGalat = e?.message || 'Alat gagal dijalankan.';
              kirim('alat-gagal', { id: p.id, nama: p.name, pesan: pesanGalat });
              hasilAlat.push({
                type: 'tool_result',
                tool_use_id: p.id,
                is_error: true,
                content: pesanGalat,
              });
            }
          }

          pesan.push({ role: 'user', content: hasilAlat });
        }

        if (putaran >= MAKS_PUTARAN) {
          kirim('galat', {
            pesan: `Berhenti setelah ${MAKS_PUTARAN} putaran pencarian. Coba pertanyaan yang lebih spesifik.`,
          });
        }
      } catch (e) {
        /* Pesan galat SDK bisa memuat potongan permintaan; yang diteruskan
           ke peramban hanya kalimat ringkasnya. */
        const status = e?.status;
        let pesan = 'Asisten gagal menjawab.';
        if (status === 401) pesan = 'ANTHROPIC_API_KEY ditolak. Periksa kuncinya di Vercel.';
        else if (status === 429) pesan = 'Kuota Anthropic sedang penuh. Coba lagi sebentar lagi.';
        else if (status === 400 && /beta|fallback/i.test(e?.message || ''))
          pesan =
            'Permintaan ditolak API. Kalau organisasimu belum punya akses fitur fallback, ' +
            'ubah PAKAI_FALLBACK menjadi false di app/api/asisten/route.js.';
        else if (status >= 500) pesan = 'Layanan Anthropic sedang bermasalah. Coba lagi sebentar lagi.';
        console.error('[asisten]', e);
        kirim('galat', { pesan });
      } finally {
        ditutup = true;
        controller.close();
      }
    },
  });

  return new Response(aliran, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
