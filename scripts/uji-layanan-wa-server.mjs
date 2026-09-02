/**
 * Pemeriksaan endpoint /api/wa dari ujung ke ujung.
 *
 *     node scripts/uji-layanan-wa-server.mjs      (butuh: next build lebih dulu)
 *
 * scripts/uji-layanan-wa.mjs menguji bagian yang murni — pembakuan nomor
 * dan isi kalimat. Yang tersisa justru bagian yang paling berbahaya
 * kalau salah, dan tidak terlihat dari membaca kode:
 *
 *   1. Kunci webhook benar-benar menjaga. Endpoint ini mengirim tautan
 *      rapor; terbuka tanpa kunci berarti siapa pun bisa menghabiskan
 *      kuota WhatsApp sekolah.
 *   2. Balasan SELALU ke nomor pengirim yang sudah dicocokkan — tidak
 *      pernah ke nomor lain yang ikut dalam badan permintaan. Inilah
 *      yang membuat webhook palsu tidak berguna bagi pemalsunya.
 *   3. Pesan grup tidak pernah dibalas (tautan pribadi ke grup wali
 *      murid = terkirim ke seluruh anggota grup).
 *   4. Pesan yang masuk ke nomor sekolah A tidak dijawab dengan data
 *      sekolah B.
 *   5. Pembatas laju berhenti pada batasnya.
 *
 * Supabase dan Fonnte digantikan server tiruan di localhost. Tidak ada
 * satu pun WhatsApp yang benar-benar dikirim.
 */
import { spawn } from 'node:child_process';
import http from 'node:http';

const PORT_APP = 3993;
const PORT_DB = 3994;
const PORT_WA = 3995;
const KUNCI = 'kunci-uji-webhook';

let gagal = 0;
const periksa = (nama, syarat) => {
  if (!syarat) gagal += 1;
  console.log(`${syarat ? 'OK   ' : 'GAGAL'} ${nama}`);
};

/* ----------------------------------------------------------------
   Data tiruan: dua sekolah, dan seorang orang tua dengan DUA anak.
   ----------------------------------------------------------------
   Nomor 6281234567890 milik orang tua Faisal dan Aisyah di Kudus.
   Nomor 6289999999999 terdaftar di Pati — dipakai membuktikan bahwa
   pesan yang masuk ke perangkat Kudus tidak dijawab dengan data Pati. */
const SEKOLAH = [
  { id: 1, nama: 'SD Yaumi Fatimah Kudus', kode: 'SDYFK', wa_pengirim: '628111000111' },
  { id: 2, nama: 'SD Yaumi Fatimah Pati',  kode: 'SDYFP', wa_pengirim: '628222000222' },
];

const SISWA = [
  { nis: 'SDYFK-281', nama_lengkap: 'Muhammad Faisal', nama_panggilan: 'Faisal',
    sekolah_id: 1, wa_normal: ['6281234567890'] },
  { nis: 'SDYFK-282', nama_lengkap: 'Aisyah Putri', nama_panggilan: 'Aisyah',
    sekolah_id: 1, wa_normal: ['6281234567890'] },
  { nis: 'SDYFK-283', nama_lengkap: 'Umar Hadi', nama_panggilan: 'Umar',
    sekolah_id: 1, wa_normal: ['6281777888999'] },
  { nis: 'SDYFP-101', nama_lengkap: 'Zaid Anwar', nama_panggilan: 'Zaid',
    sekolah_id: 2, wa_normal: ['6289999999999'] },
];

const AKSES = [
  { nis: 'SDYFK-281', token: 'AAA111bbb222', aktif: true },
  { nis: 'SDYFK-282', token: 'CCC333ddd444', aktif: true },
  // Umar sengaja belum diterbitkan tautannya.
  { nis: 'SDYFP-101', token: 'EEE555fff666', aktif: true },
];

const PENEMPATAN = [
  { nis: 'SDYFK-281', kelas: { nama_kelas: '2A', tahun_ajaran: '2025-2026' } },
  { nis: 'SDYFK-281', kelas: { nama_kelas: '3',  tahun_ajaran: '2026-2027' } },
  { nis: 'SDYFK-282', kelas: { nama_kelas: '1',  tahun_ajaran: '2026-2027' } },
  { nis: 'SDYFK-283', kelas: { nama_kelas: '5',  tahun_ajaran: '2026-2027' } },
  { nis: 'SDYFP-101', kelas: { nama_kelas: '4',  tahun_ajaran: '2026-2027' } },
];

/** Pesan yang sudah "masuk", untuk menguji pembatas laju. */
let pesanTercatat = [];

/* ----------------------------------------------------------------
   PostgREST tiruan
   ----------------------------------------------------------------
   Hanya sebanyak yang dipakai /api/wa: penyaringan cs. (larik memuat),
   eq., in., gte., serta hitungan head+count untuk pembatas laju. */
function nilaiFilter(cari, kunci) {
  const v = cari.get(kunci);
  return v === null ? null : decodeURIComponent(v);
}

const dbTiruan = http.createServer((req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT_DB}`);
  const tabel = url.pathname.replace('/rest/v1/', '');
  const cari = url.searchParams;
  const balas = (isi, status = 200, kepala = {}) => {
    res.writeHead(status, { 'content-type': 'application/json', ...kepala });
    res.end(JSON.stringify(isi));
  };
  const satuan = (req.headers.accept || '').includes('pgrst.object');

  if (req.method === 'POST' && tabel === 'wa_pesan') {
    let badan = '';
    req.on('data', (d) => { badan += d; });
    req.on('end', () => {
      pesanTercatat.push(...[].concat(JSON.parse(badan || '[]')));
      balas([], 201);
    });
    return;
  }

  if (tabel === 'sekolah') {
    if (satuan) {
      const id = Number((nilaiFilter(cari, 'id') || '').replace('eq.', ''));
      const s = SEKOLAH.find((x) => x.id === id);
      return balas(s ? { nama: s.nama } : null, s ? 200 : 406);
    }
    return balas(SEKOLAH);
  }

  if (tabel === 'wa_pesan') {
    const pengirim = (nilaiFilter(cari, 'pengirim') || '').replace('eq.', '');
    const jumlah = pesanTercatat.filter((p) => p.pengirim === pengirim).length;
    return balas([], 200, { 'content-range': `0-0/${jumlah}` });
  }

  if (tabel === 'siswa') {
    const memuat = (nilaiFilter(cari, 'wa_normal') || '').replace('cs.', '');
    const nomor = memuat.replace(/[{}"]/g, '');
    const sekolahId = (nilaiFilter(cari, 'sekolah_id') || '').replace('eq.', '');
    let hasil = SISWA.filter((s) => s.wa_normal.includes(nomor));
    if (sekolahId) hasil = hasil.filter((s) => String(s.sekolah_id) === sekolahId);
    return balas(hasil);
  }

  const daftarNis = () =>
    (nilaiFilter(cari, 'nis') || '').replace(/^in\.\(|\)$/g, '').split(',')
      .map((x) => x.replace(/"/g, ''));

  if (tabel === 'akses_ortu') {
    const nis = daftarNis();
    return balas(AKSES.filter((a) => nis.includes(a.nis)));
  }

  if (tabel === 'penempatan') {
    const nis = daftarNis();
    return balas(PENEMPATAN.filter((p) => nis.includes(p.nis)));
  }

  return balas([]);
});

/* ---------------------------------------------------------------- */
/* Fonnte tiruan: mencatat apa yang akan dikirim, tanpa mengirim.    */
let terkirimWa = [];
const waTiruan = http.createServer((req, res) => {
  let badan = '';
  req.on('data', (d) => { badan += d; });
  req.on('end', () => {
    const p = new URLSearchParams(badan);
    terkirimWa.push({
      target: p.get('target'),
      message: p.get('message'),
      token: req.headers.authorization,
    });
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ status: true }));
  });
});

await new Promise((r) => dbTiruan.listen(PORT_DB, '127.0.0.1', r));
await new Promise((r) => waTiruan.listen(PORT_WA, '127.0.0.1', r));

/* Server sisa dari pengujian sebelumnya adalah jebakan yang mahal:
   `next start` gagal mengikat port, diam saja, lalu SELURUH pemeriksaan
   dijawab oleh build LAMA yang kebetulan masih hidup. Hasilnya bisa
   hijau untuk kode yang bahkan belum ditulis. Karena itu diperiksa
   lebih dulu, dan dihentikan kalau ada. */
try {
  await fetch(`http://127.0.0.1:${PORT_APP}/api/wa`);
  console.error(
    `Port ${PORT_APP} sudah dipakai proses lain. Hentikan dulu ` +
    "(mis. 'pkill -f next-server'), lalu jalankan ulang berkas ini — " +
    'kalau tidak, seluruh pemeriksaan akan dijawab build yang lama.'
  );
  process.exit(2);
} catch {
  /* Tidak ada yang menjawab: port bebas, seperti yang diharapkan. */
}

const server = spawn('npx', ['next', 'start', '-p', String(PORT_APP)], {
  env: {
    ...process.env,
    NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${PORT_DB}`,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'kunci-anon-uji',
    SUPABASE_SERVICE_ROLE_KEY: 'kunci-service-uji',
    NEXT_PUBLIC_SITE_URL: 'https://akademik.contoh',
    WA_WEBHOOK_SECRET: KUNCI,
    FONNTE_TOKEN: 'token-fonnte-uji',
    FONNTE_API_URL: `http://127.0.0.1:${PORT_WA}/send`,
  },
  stdio: process.env.UJI_VERBOSE ? 'inherit' : 'ignore',
  /* Satu kelompok proses tersendiri supaya yang dihentikan nanti bukan
     hanya `npx`, melainkan `next-server` yang dijalankannya. Tanpa ini
     server anaknya tetap hidup setelah berkas uji selesai, menahan
     port, dan menjawab pengujian BERIKUTNYA dengan build yang lama. */
  detached: true,
});

let sudahBersih = false;
const bersihkan = () => {
  if (sudahBersih) return;
  sudahBersih = true;
  try { process.kill(-server.pid, 'SIGKILL'); } catch { /* sudah mati */ }
  dbTiruan.close();
  waTiruan.close();
};
process.on('exit', bersihkan);
process.on('SIGINT', () => { bersihkan(); process.exit(130); });

/** Menunggu server siap. */
let siap = false;
for (let i = 0; i < 60 && !siap; i++) {
  try {
    siap = (await fetch(`http://127.0.0.1:${PORT_APP}/api/wa`)).ok;
  } catch {
    /* belum siap */
  }
  if (!siap) await new Promise((r) => setTimeout(r, 500));
}

if (!siap) {
  console.error(
    'Server tidak pernah siap. Jalankan `npx next build` lebih dulu, ' +
    'lalu ulangi. (UJI_VERBOSE=1 menampilkan keluaran servernya.)'
  );
  bersihkan();
  process.exit(2);
}

/** Satu pesan masuk. `kunci` boleh dikosongkan untuk menguji penolakan. */
async function kirimWebhook(isi, { kunci = KUNCI, jenis = 'form' } = {}) {
  const alamat =
    `http://127.0.0.1:${PORT_APP}/api/wa` + (kunci ? `?kunci=${kunci}` : '');

  const respons = await fetch(alamat, {
    method: 'POST',
    headers: jenis === 'json' ? { 'content-type': 'application/json' } : undefined,
    body:
      jenis === 'json'
        ? JSON.stringify(isi)
        : new URLSearchParams(isi),
  });

  let badan = null;
  try { badan = await respons.json(); } catch { /* bukan JSON */ }
  return { status: respons.status, badan };
}

const bersihCatatan = () => { terkirimWa = []; pesanTercatat = []; };

// ===================================================================
console.log('--- kunci webhook ---');
// ===================================================================
{
  bersihCatatan();
  const tanpa = await kirimWebhook(
    { sender: '6281234567890', message: 'assalamualaikum' }, { kunci: '' });
  periksa('tanpa kunci ditolak 401', tanpa.status === 401);
  periksa('tanpa kunci: tidak ada WhatsApp yang dikirim', terkirimWa.length === 0);

  const salah = await kirimWebhook(
    { sender: '6281234567890', message: 'p' }, { kunci: 'kunci-yang-salah' });
  periksa('kunci salah ditolak 401', salah.status === 401);
  periksa('kunci salah: tidak ada WhatsApp yang dikirim', terkirimWa.length === 0);
}

// ===================================================================
console.log('\n--- orang tua yang dikenali ---');
// ===================================================================
{
  bersihCatatan();
  const hasil = await kirimWebhook({
    sender: '6281234567890', message: 'Assalamualaikum bu', device: '628111000111',
  });

  periksa('dijawab 200', hasil.status === 200);
  periksa('hasil dicatat sebagai terkirim', hasil.badan?.hasil === 'terkirim');
  periksa('kedua anak ditemukan', hasil.badan?.anak === 2);
  periksa('satu balasan dikirim', terkirimWa.length === 1);

  const pesan = terkirimWa[0] || {};
  periksa('balasan dikirim ke nomor pengirim', pesan.target === '6281234567890');
  periksa('memakai token Fonnte dari env', pesan.token === 'token-fonnte-uji');
  /* Yang diperiksa adalah TOKEN masing-masing anak, bukan nama domainnya.
     NEXT_PUBLIC_SITE_URL dipatri ke dalam bundel saat `next build`
     (lihat next.config.mjs), sehingga menyetelnya saat `next start` --
     seperti yang dilakukan berkas uji ini -- memang tidak berpengaruh.
     Yang penting di sini: tautannya utuh, absolut, dan milik anak yang
     benar. */
  periksa('memuat tautan kedua anak',
    pesan.message?.includes('/rapor/AAA111bbb222') &&
    pesan.message?.includes('/rapor/CCC333ddd444'));
  periksa('tautan berupa alamat lengkap, bukan potongan',
    /https?:\/\/[^\s]+\/rapor\/AAA111bbb222/.test(pesan.message || ''));

  /* Faisal pernah di 2A (2025-2026) dan kini di kelas 3 (2026-2027).
     Menyebut kelas lamanya membuat orang tua ragu tautannya benar. */
  periksa('menyebut kelas terakhir, bukan kelas lama',
    pesan.message?.includes('Kelas 3') && !pesan.message?.includes('Kelas 2A'));

  periksa('nama sekolah diambil dari perangkat penerima',
    pesan.message?.includes('SD Yaumi Fatimah Kudus'));
  periksa('pesan dicatat ke wa_pesan',
    pesanTercatat.length === 1 && pesanTercatat[0].hasil === 'terkirim' &&
    pesanTercatat[0].jumlah_anak === 2);

  /* Isi pesan orang tua tidak boleh ikut tersimpan: layanan ini tidak
     membacanya sama sekali, jadi menyimpannya hanya menumpuk
     percakapan pribadi tanpa satu pun kegunaan. */
  periksa('isi pesan orang tua tidak ikut disimpan',
    !JSON.stringify(pesanTercatat[0]).includes('Assalamualaikum'));
}

// ===================================================================
console.log('\n--- badan permintaan berbentuk JSON ---');
// ===================================================================
{
  bersihCatatan();
  const hasil = await kirimWebhook(
    { data: { sender: '081234567890', message: 'halo', device: '628111000111' } },
    { jenis: 'json' }
  );
  periksa('bentuk JSON bersarang ikut terbaca', hasil.badan?.hasil === 'terkirim');
  periksa('nomor bentuk lokal dari Fonnte tetap cocok',
    terkirimWa[0]?.target === '6281234567890');
}

// ===================================================================
console.log('\n--- nomor yang tidak dikenali ---');
// ===================================================================
{
  bersihCatatan();
  const hasil = await kirimWebhook({
    sender: '6285000000000', message: 'assalamualaikum', device: '628111000111',
  });
  periksa('hasil "tidak_dikenal"', hasil.badan?.hasil === 'tidak_dikenal');
  periksa('tetap dibalas, bukan didiamkan', terkirimWa.length === 1);
  periksa('balasan tidak memuat satu pun tautan rapor',
    !terkirimWa[0]?.message?.includes('/rapor/'));
}

// ===================================================================
console.log('\n--- tautan belum diterbitkan ---');
// ===================================================================
{
  bersihCatatan();
  const hasil = await kirimWebhook({
    sender: '6281777888999', message: 'nuwun sewu', device: '628111000111',
  });
  periksa('hasil "belum_terbit"', hasil.badan?.hasil === 'belum_terbit');
  periksa('nama anak tetap disebut', terkirimWa[0]?.message?.includes('Umar'));
  periksa('tidak ada tautan yang dikarang',
    !terkirimWa[0]?.message?.includes('/rapor/'));
}

// ===================================================================
console.log('\n--- pemilahan antar sekolah ---');
// ===================================================================
{
  bersihCatatan();
  /* Nomor ini terdaftar di Pati, tetapi pesannya masuk ke perangkat
     Kudus. Tanpa pemilahan, data Pati akan terkirim lewat perangkat
     Kudus -- satu aplikasi melayani banyak sekolah. */
  const hasil = await kirimWebhook({
    sender: '6289999999999', message: 'p', device: '628111000111',
  });
  periksa('nomor sekolah lain tidak dikenali di perangkat ini',
    hasil.badan?.hasil === 'tidak_dikenal');
  periksa('tidak membocorkan tautan sekolah lain',
    !terkirimWa[0]?.message?.includes('EEE555fff666'));

  bersihCatatan();
  const benar = await kirimWebhook({
    sender: '6289999999999', message: 'p', device: '628222000222',
  });
  periksa('nomor yang sama dikenali di perangkat sekolahnya sendiri',
    benar.badan?.hasil === 'terkirim');
  periksa('kaki pesan memakai nama sekolah yang benar',
    terkirimWa[0]?.message?.includes('SD Yaumi Fatimah Pati'));
}

// ===================================================================
console.log('\n--- pesan grup ---');
// ===================================================================
{
  bersihCatatan();
  const hasil = await kirimWebhook({
    sender: '6281234567890', message: 'info rapor', device: '628111000111',
    group: 'Wali Murid Kelas 3',
  });
  periksa('pesan grup dijawab 200 tanpa dibalas',
    hasil.status === 200 && terkirimWa.length === 0);
  periksa('pesan grup tidak menyisakan catatan', pesanTercatat.length === 0);
}

// ===================================================================
console.log('\n--- balasan tidak bisa dialihkan ---');
// ===================================================================
{
  bersihCatatan();
  /* Webhook palsu yang mencoba mengarahkan tautan ke nomor lain. Field
     `target` sengaja disisipkan; endpoint ini tidak boleh membacanya. */
  await kirimWebhook({
    sender: '6281234567890', message: 'p', device: '628111000111',
    target: '6280000000000', tujuan: '6280000000000',
  });
  periksa('tautan tetap mendarat di nomor pengirim, bukan nomor sisipan',
    terkirimWa[0]?.target === '6281234567890');
}

// ===================================================================
console.log('\n--- pembatas laju ---');
// ===================================================================
{
  bersihCatatan();
  for (let i = 0; i < 8; i++) {
    await kirimWebhook({
      sender: '6281234567890', message: 'p', device: '628111000111',
    });
  }
  periksa('delapan pesan pertama dijawab', terkirimWa.length === 8);

  const kesembilan = await kirimWebhook({
    sender: '6281234567890', message: 'p', device: '628111000111',
  });
  periksa('pesan kesembilan tidak dibalas', terkirimWa.length === 8);
  periksa('pembatasan dicatat sebagai "dibatasi"',
    kesembilan.badan?.lewat === 'dibatasi' &&
    pesanTercatat[pesanTercatat.length - 1].hasil === 'dibatasi');

  /* Batasnya per nomor, bukan per sistem: satu orang tua yang berlebihan
     tidak boleh membungkam seluruh sekolah. */
  const lain = await kirimWebhook({
    sender: '6281777888999', message: 'p', device: '628111000111',
  });
  periksa('nomor lain tetap dilayani', lain.badan?.hasil === 'belum_terbit');
}

console.log(gagal ? `\n${gagal} pemeriksaan GAGAL\n` : '\nSeluruh pemeriksaan lolos.\n');
bersihkan();
process.exit(gagal ? 1 : 0);
