/**
 * Halaman ini sudah tidak dipakai.
 *
 * Akses orang tua kini melalui tautan pribadi berisi token:
 *   /rapor/<token>
 *
 * Alasannya ada dua. Pertama, orang tua tidak login Google — data kontak
 * yang dipunyai sekolah adalah nomor WhatsApp, bukan email. Kedua, grafik
 * perbandingan kelas menuntut penyamaran nama dilakukan di server, dan
 * halaman lama meng-query Supabase langsung dari browser sehingga nama
 * teman sekelas akan ikut terkirim mentah.
 */
export default function OrangTuaDialihkan() {
  return (
    <main
      style={{
        maxWidth: 520,
        margin: '4rem auto',
        padding: '2rem',
        fontFamily: 'system-ui, sans-serif',
        lineHeight: 1.7,
        textAlign: 'center',
      }}
    >
      <h1 style={{ fontSize: '1.4rem', marginBottom: '0.75rem' }}>Rapor Digital</h1>
      <p>
        Halaman ini sudah dipindahkan. Silakan buka rapor putra/putri Anda melalui
        tautan pribadi yang dikirim sekolah lewat WhatsApp.
      </p>
      <p style={{ color: '#666', fontSize: '0.9rem' }}>
        Belum menerima tautan? Hubungi wali kelas.
      </p>
    </main>
  );
}
