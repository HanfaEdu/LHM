/* ===================================================================
   SERVICE WORKER — SiPaDi / Akademik SD Yaumi Fatimah Kudus
   ===================================================================
   Ditulis tangan, bukan memakai pustaka pembangkit. Isinya memang hanya
   sebanyak ini, dan pustaka seperti next-pwa menambah satu lapisan
   pembangkitan pada proses build yang harus ikut dijaga setiap kali
   Next.js naik versi -- harganya jauh lebih mahal daripada enam puluh
   baris yang bisa dibaca utuh di sini.

   Tugasnya dua:
     1. Membuat aplikasi bisa dipasang ke layar utama.
     2. Membuat kerangka halaman tetap terbuka tanpa koneksi.

   Yang TIDAK diurus di sini: data rapor itu sendiri. Data itu diambil
   lewat POST ke /api/rapor, dan Cache API tidak bisa menyimpan jawaban
   permintaan POST sama sekali. Karena itu penyimpanannya ditangani
   halaman rapor sendiri lewat localStorage -- lihat "Salinan luring" di
   app/rapor/[token]/page.jsx.
   =================================================================== */

// Dinaikkan setiap kali isi berkas ini berubah. Singgahan versi lama
// dibuang saat versi baru aktif.
const VERSI = 'v1';
const SINGGAHAN = `sipadi-${VERSI}`;

/** Berkas yang alamatnya mengandung sidik isi, jadi tidak pernah basi. */
function berkasTetap(alamat) {
  return (
    alamat.pathname.startsWith('/_next/static/') ||
    alamat.pathname.startsWith('/ikon/') ||
    alamat.pathname === '/logo.png' ||
    alamat.pathname === '/icon.png'
  );
}

self.addEventListener('install', () => {
  // Tidak ada yang disimpan di muka: nama berkas JS Next.js mengandung
  // sidik isi yang baru diketahui saat halaman benar-benar dibuka.
  // Singgahan diisi sambil jalan oleh penangan fetch di bawah.
  self.skipWaiting();
});

self.addEventListener('activate', (peristiwa) => {
  peristiwa.waitUntil(
    (async () => {
      const nama = await caches.keys();
      await Promise.all(
        nama.filter((n) => n !== SINGGAHAN).map((n) => caches.delete(n))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (peristiwa) => {
  const permintaan = peristiwa.request;

  // Hanya GET yang boleh disinggah; POST ke /api/rapor dan permintaan
  // lintas-asal dibiarkan lewat apa adanya.
  if (permintaan.method !== 'GET') return;

  const alamat = new URL(permintaan.url);
  if (alamat.origin !== self.location.origin) return;

  // Data dan manifest selalu dari jaringan: manifest memuat nama anak
  // yang bisa berubah, dan token yang dicabut harus benar-benar berhenti
  // berlaku, bukan dilayani dari singgahan.
  if (
    alamat.pathname.startsWith('/api/') ||
    alamat.pathname.endsWith('.webmanifest')
  ) {
    return;
  }

  // ----------------------------------------------------------------
  // Berkas tetap: singgahan lebih dulu.
  // ----------------------------------------------------------------
  if (berkasTetap(alamat)) {
    peristiwa.respondWith(
      (async () => {
        const tersimpan = await caches.match(permintaan);
        if (tersimpan) return tersimpan;
        const jawaban = await fetch(permintaan);
        if (jawaban.ok) {
          const singgahan = await caches.open(SINGGAHAN);
          singgahan.put(permintaan, jawaban.clone());
        }
        return jawaban;
      })()
    );
    return;
  }

  // ----------------------------------------------------------------
  // Halaman: jaringan lebih dulu, singgahan sebagai jaring pengaman.
  // ----------------------------------------------------------------
  // Urutan ini penting dan sengaja bukan sebaliknya. Rapor adalah
  // dokumen yang angkanya berubah tiap bulan; melayani halaman dari
  // singgahan lebih dulu berarti orang tua bisa membaca capaian bulan
  // lalu tanpa tahu ada yang lebih baru. Singgahan di sini hanya untuk
  // keadaan benar-benar tanpa sinyal.
  if (permintaan.mode === 'navigate') {
    peristiwa.respondWith(
      (async () => {
        try {
          const jawaban = await fetch(permintaan);
          if (jawaban.ok) {
            const singgahan = await caches.open(SINGGAHAN);
            singgahan.put(permintaan, jawaban.clone());
          }
          return jawaban;
        } catch (e) {
          const tersimpan = await caches.match(permintaan);
          if (tersimpan) return tersimpan;
          // Halaman ini belum pernah dibuka saat ada sinyal -- tidak ada
          // apa pun yang bisa ditampilkan selain penjelasan apa adanya.
          return new Response(
            `<!doctype html><html lang="id"><meta charset="utf-8">
             <meta name="viewport" content="width=device-width,initial-scale=1">
             <title>Tidak ada koneksi</title>
             <div style="font-family:system-ui,sans-serif;max-width:26rem;
                         margin:20vh auto;padding:0 1.25rem;text-align:center;
                         color:#333;line-height:1.6">
               <h1 style="font-size:1.15rem;color:#000">Tidak ada koneksi</h1>
               <p>Halaman ini belum pernah dibuka saat ada sinyal, jadi belum
                  ada salinan yang bisa ditampilkan.</p>
               <p style="color:#666;font-size:.9rem">Coba lagi setelah
                  tersambung ke internet.</p>
             </div></html>`,
            { headers: { 'Content-Type': 'text/html; charset=utf-8' }, status: 503 }
          );
        }
      })()
    );
  }
});
