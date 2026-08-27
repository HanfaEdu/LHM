'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { LogIn } from 'lucide-react';
import LogoBerbintang from './LogoBerbintang';
import TombolLhm from '@/app/komponen/TombolLhm';

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Cek status sesi saat loading page
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        // Redirect ke router utama untuk diproses hak aksesnya
        router.push('/');
      } else {
        setLoading(false);
      }
    };
    checkSession();
  }, [router]);

  const handleGoogleLogin = async () => {
    setError(null);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          // Arahkan kembali ke router utama setelah sukses OAuth
          redirectTo: typeof window !== 'undefined' ? `${window.location.origin}/` : undefined
        }
      });
      if (error) throw error;
    } catch (err) {
      setError(err.message || 'Gagal masuk menggunakan Google.');
    }
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        backgroundColor: '#0b1329',
        color: '#f8fafc',
        fontFamily: 'Outfit, sans-serif'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div className="progress-bar-container" style={{ width: '200px', margin: '0 auto 16px' }}>
            <div className="progress-bar-fill" style={{ width: '60%' }}></div>
          </div>
          <p style={{ color: '#94a3b8' }}>Memuat Sistem...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      /* Kolom, bukan baris: tombol LHM berdiri DI BAWAH kartu login,
         bukan di dalamnya -- ia bukan bagian dari proses masuk, dan
         menaruhnya di dalam kartu akan membuatnya terbaca sebagai
         alternatif cara login. */
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      gap: '18px',
      minHeight: '100vh',
      padding: '20px',
      position: 'relative'
    }}>
      <div className="glass-card" style={{ maxWidth: '440px', width: '100%', textAlign: 'center' }}>
        <LogoBerbintang />
        <h1 style={{
          fontSize: '2.25rem',
          marginBottom: '8px',
          background: 'linear-gradient(135deg, #00b4d8 0%, #00f5d4 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent'
        }}>
          SiPaDi
        </h1>
        <p style={{ color: '#94a3b8', fontSize: '0.95rem', marginBottom: '10px' }}>
          Sistem Perkembangan Akademik Digital Terintegrasi SD Yaumi Fatimah Kudus
        </p>
        {/* Tagline sekolah. Di halaman gelap ini emas cerah justru yang
            terbaca; emas tua yang dipakai di dasbor akan tenggelam. */}
        <p
          style={{
            color: '#e0c070',
            fontStyle: 'italic',
            fontWeight: 600,
            fontSize: '0.85rem',
            letterSpacing: '0.03em',
            marginBottom: '30px',
          }}
        >
          Personalized Education
        </p>

        {error && (
          <div className="badge badge-danger" style={{ display: 'flex', padding: '12px', borderRadius: '8px', marginBottom: '20px', textAlign: 'left' }}>
            <span>{error}</span>
          </div>
        )}

        <button className="btn-primary" onClick={handleGoogleLogin} style={{ width: '100%', justifyContent: 'center', padding: '14px' }}>
          <LogIn size={20} />
          Masuk dengan Akun Google
        </button>

        <div style={{ marginTop: '32px', fontSize: '0.8rem', color: '#64748b' }}>
          <p>© 2026 SD Yaumi Fatimah Kudus. All rights reserved.</p>
        </div>
      </div>

      {/* Jalan pintas bagi wali kelas yang datang ke sini semata-mata
          untuk mengisi nilai. Sebelumnya mereka harus masuk dulu, lalu
          mencari tautannya di dalam dasbor -- padahal mengisi nilai
          tidak membutuhkan sesi login sama sekali. */}
      <TombolLhm varian="gelap" />
    </div>
  );
}
