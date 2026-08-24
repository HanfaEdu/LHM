/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  env: {
    /**
     * Alamat resmi aplikasi, dipakai saat menyusun tautan rapor orang tua.
     *
     * Sebelumnya tautan dibangun dari window.location.origin — alamat yang
     * kebetulan sedang dibuka kepala sekolah. Vercel menyediakan beberapa
     * alamat cadangan untuk proyek yang sama (mis. lhm-<slug-akun>.vercel.app
     * yang tetap hidup setelah nama proyek diganti), sehingga tautan yang
     * diterbitkan bisa membawa alamat cadangan itu hanya karena dasbornya
     * dibuka dari sana. Tautan seperti itu tetap berfungsi, tetapi sudah
     * telanjur tersebar ke ratusan orang tua dengan alamat yang bukan alamat
     * resmi sekolah.
     *
     * VERCEL_PROJECT_PRODUCTION_URL diisi Vercel sendiri dengan domain
     * produksi proyek ini, jadi tautannya ikut benar tanpa perlu ada yang
     * dikonfigurasi manual — termasuk kalau domainnya diganti lagi nanti.
     * NEXT_PUBLIC_SITE_URL disediakan sebagai penimpa, untuk saat sekolah
     * memakai domain sendiri (mis. rapor.sdyaumifatimah.sch.id).
     */
    NEXT_PUBLIC_SITE_URL:
      process.env.NEXT_PUBLIC_SITE_URL ||
      (process.env.VERCEL_PROJECT_PRODUCTION_URL
        ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
        : ''),
  },
};

export default nextConfig;
