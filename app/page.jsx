'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { LogOut, ShieldAlert } from 'lucide-react';

/**
 * Router setelah login Google.
 *
 * Halaman ini HANYA melayani guru dan kepala sekolah — mereka masuk lewat
 * users_access dan diarahkan ke dashboard sesuai perannya. Orang tua tidak
 * pernah sampai ke sini: akses mereka lewat tautan pribadi /rapor/<token>
 * yang dikirim via WhatsApp, tanpa login Google sama sekali (lihat
 * docs/AKSES_ORANG_TUA.md untuk alasannya).
 *
 * Kalau akun Google yang login tidak terdaftar di users_access, halaman
 * ini tidak mencoba menebak — cukup beri tahu dan arahkan ke jalur yang
 * benar, bukan membuka form aktivasi baru.
 */
export default function HomeRouter() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [terdaftar, setTerdaftar] = useState(true);

  useEffect(() => {
    const periksaPeran = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }

      const currentUser = session.user;
      setUser(currentUser);
      const email = currentUser.email.toLowerCase().trim();

      try {
        const { data: staf, error } = await supabase
          .from('users_access')
          .select('role')
          .eq('email', email)
          .maybeSingle();

        if (error) throw error;

        if (staf?.role === 'kepala_sekolah') {
          router.push('/dashboard/kepala-sekolah');
          return;
        }
        if (staf?.role === 'wali_kelas') {
          router.push('/dashboard/wali-kelas');
          return;
        }

        // Email login tidak ada di users_access — bukan guru/kepsek.
        setTerdaftar(false);
        setLoading(false);
      } catch (err) {
        console.error('Gagal memeriksa hak akses:', err);
        setTerdaftar(false);
        setLoading(false);
      }
    };

    periksaPeran();
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        height: '100vh', backgroundColor: '#0b1329', color: '#f8fafc',
        fontFamily: 'Outfit, sans-serif',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div className="progress-bar-container" style={{ width: '200px', margin: '0 auto 16px' }}>
            <div className="progress-bar-fill" style={{ width: '80%' }}></div>
          </div>
          <p style={{ color: '#94a3b8' }}>Memeriksa Hak Akses...</p>
        </div>
      </div>
    );
  }

  // Login berhasil tapi email tidak terdaftar sebagai guru/kepsek.
  return (
    <div style={{
      display: 'flex', justifyContent: 'center', alignItems: 'center',
      minHeight: '100vh', padding: '24px', position: 'relative',
    }}>
      <div className="glass-card" style={{ maxWidth: '480px', width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h1 style={{
            fontSize: '1.5rem',
            background: 'linear-gradient(135deg, #00b4d8 0%, #00f5d4 100%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>
            Akun Belum Terdaftar
          </h1>
          <button onClick={handleLogout} className="btn-secondary" style={{ padding: '8px 12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <LogOut size={14} /> Keluar
          </button>
        </div>

        <div className="warning-box" style={{ marginBottom: '20px' }}>
          <ShieldAlert className="warning-icon" />
          <div className="warning-content">
            Email <strong>{user?.email}</strong> belum terdaftar sebagai guru
            atau kepala sekolah di sistem ini.
          </div>
        </div>

        <p style={{ color: '#94a3b8', fontSize: '0.9rem', lineHeight: '1.6' }}>
          Jika Anda orang tua/wali siswa: dashboard rapor tidak diakses lewat
          login Google. Sekolah mengirimkan <strong>tautan pribadi</strong>{' '}
          lewat WhatsApp untuk masing-masing siswa — silakan buka tautan itu
          langsung, tanpa perlu masuk ke halaman ini.
        </p>
        <p style={{ color: '#94a3b8', fontSize: '0.9rem', lineHeight: '1.6', marginTop: '12px' }}>
          Jika Anda guru atau kepala sekolah dan seharusnya punya akses:
          hubungi admin sekolah untuk didaftarkan di sheet{' '}
          <code>users_access</code> pada Master Rekap.
        </p>
      </div>
    </div>
  );
}
