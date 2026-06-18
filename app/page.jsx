'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { LogOut, UserCheck, ShieldAlert } from 'lucide-react';

export default function HomeRouter() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isLinking, setIsLinking] = useState(false);
  
  // State untuk form aktivasi orang tua
  const [nis, setNis] = useState('');
  const [noWa, setNoWa] = useState('');
  const [errorMsg, setErrorMsg] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  useEffect(() => {
    const checkUserRole = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }

      const currentUser = session.user;
      setUser(currentUser);
      const email = currentUser.email.toLowerCase().trim();

      try {
        // 1. Cek tabel users_access (Guru & Kasek)
        const { data: teacherData, error: teacherError } = await supabase
          .from('users_access')
          .select('*')
          .eq('email', email)
          .maybeSingle();

        if (teacherError) throw teacherError;

        if (teacherData) {
          if (teacherData.role === 'kepala_sekolah') {
            router.push('/dashboard/kepala-sekolah');
            return;
          } else if (teacherData.role === 'wali_kelas') {
            router.push('/dashboard/wali-kelas');
            return;
          }
        }

        // 2. Cek tabel parent_links (Orang Tua terdaftar)
        const { data: parentData, error: parentError } = await supabase
          .from('parent_links')
          .select('nis')
          .eq('parent_email', email)
          .limit(1);

        if (parentError) throw parentError;

        if (parentData && parentData.length > 0) {
          router.push('/dashboard/orang-tua');
          return;
        }

        // Jika tidak terdaftar di keduanya, tampilkan form aktivasi Orang Tua
        setLoading(false);
      } catch (err) {
        console.error('Error checking roles:', err);
        setErrorMsg('Terjadi kesalahan sistem dalam memverifikasi akun.');
        setLoading(false);
      }
    };

    checkUserRole();
  }, [router]);

  const handleLinkAccount = async (e) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsLinking(true);

    if (!nis.trim() || !noWa.trim()) {
      setErrorMsg('NIS dan Nomor WhatsApp wajib diisi.');
      setIsLinking(false);
      return;
    }

    try {
      // 1. Validasi kecocokan NIS dan No WA di tabel rekap_akademik
      const { data: matchData, error: matchError } = await supabase
        .from('rekap_akademik')
        .select('nis, nama_lengkap')
        .eq('nis', nis.trim())
        .eq('no_wa', noWa.trim())
        .limit(1);

      if (matchError) throw matchError;

      if (!matchData || matchData.length === 0) {
        setErrorMsg('Data tidak ditemukan. Pastikan NIS anak dan Nomor WhatsApp Anda sesuai dengan data Wali Kelas.');
        setIsLinking(false);
        return;
      }

      const childName = matchData[0].nama_lengkap;

      // 2. Insert ke parent_links
      const { error: insertError } = await supabase
        .from('parent_links')
        .insert([
          {
            parent_email: user.email.toLowerCase().trim(),
            nis: nis.trim()
          }
        ]);

      if (insertError) {
        if (insertError.code === '23505') { // Unique constraint violation
          router.push('/dashboard/orang-tua');
          return;
        }
        throw insertError;
      }

      setSuccessMsg(`Berhasil menghubungkan akun dengan Ananda ${childName}!`);
      setTimeout(() => {
        router.push('/dashboard/orang-tua');
      }, 1500);

    } catch (err) {
      console.error('Error linking account:', err);
      setErrorMsg(err.message || 'Gagal menghubungkan akun. Silakan coba lagi.');
    } finally {
      setIsLinking(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
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
            <div className="progress-bar-fill" style={{ width: '80%' }}></div>
          </div>
          <p style={{ color: '#94a3b8' }}>Memeriksa Hak Akses...</p>
        </div>
      </div>
    );
  }

  // Tampilan Form Aktivasi Akun Orang Tua
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      padding: '24px',
      position: 'relative'
    }}>
      <div className="glass-card" style={{ maxWidth: '500px', width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h1 style={{
            fontSize: '1.75rem',
            background: 'linear-gradient(135deg, #00b4d8 0%, #00f5d4 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>
            Aktivasi Akun Wali Murid
          </h1>
          <button onClick={handleLogout} className="btn-secondary" style={{ padding: '8px 12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <LogOut size={14} /> Keluar
          </button>
        </div>

        <p style={{ color: '#94a3b8', fontSize: '0.9rem', lineHeight: '1.5', marginBottom: '24px' }}>
          Selamat datang, <strong>{user?.email}</strong>. Email Anda belum terdaftar sebagai staf sekolah. Silakan aktivasi akun Anda sebagai orang tua/wali murid dengan mengisi NIS anak dan nomor WhatsApp yang dilaporkan pada Wali Kelas.
        </p>

        {errorMsg && (
          <div className="warning-box" style={{ marginBottom: '20px' }}>
            <ShieldAlert className="warning-icon" />
            <div className="warning-content">{errorMsg}</div>
          </div>
        )}

        {successMsg && (
          <div className="badge badge-success" style={{ display: 'flex', padding: '12px', borderRadius: '8px', marginBottom: '20px', width: '100%', fontSize: '0.85rem' }}>
            {successMsg}
          </div>
        )}

        <form onSubmit={handleLinkAccount}>
          <div className="form-group">
            <label className="form-label" htmlFor="nis">Nomor Induk Siswa (NIS / NISN)</label>
            <input
              className="form-input"
              type="text"
              id="nis"
              placeholder="Contoh: 12401"
              value={nis}
              onChange={(e) => setNis(e.target.value)}
              disabled={isLinking}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="noWa">Nomor WhatsApp Terdaftar</label>
            <input
              className="form-input"
              type="text"
              id="noWa"
              placeholder="Contoh: 08123456789"
              value={noWa}
              onChange={(e) => setNoWa(e.target.value)}
              disabled={isLinking}
            />
          </div>

          <button className="btn-primary" type="submit" style={{ width: '100%', justifyContent: 'center', marginTop: '12px' }} disabled={isLinking}>
            <UserCheck size={18} />
            {isLinking ? 'Menghubungkan...' : 'Hubungkan Akun'}
          </button>
        </form>
      </div>
    </div>
  );
}
