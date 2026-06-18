'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { getQuranLevelName } from '@/quran_mapping';
import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, Legend, ResponsiveContainer, ReferenceLine 
} from 'recharts';
import { LogOut, BookOpen, BarChart3, HelpCircle, Award, User, RefreshCw } from 'lucide-react';

const MONTH_ORDER = [
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
  "Januari", "Februari", "Maret", "April", "Mei", "Juni"
];

export default function ParentDashboard() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  
  // Data State
  const [childrenNis, setChildrenNis] = useState([]); // List anak yang terhubung
  const [selectedNis, setSelectedNis] = useState('');
  const [academicYears, setAcademicYears] = useState([]);
  const [selectedYear, setSelectedYear] = useState('');
  const [studentRecords, setStudentRecords] = useState([]); // Semua record anak terpilih
  const [classRecords, setClassRecords] = useState([]); // Record satu kelas (untuk grafik anonim)
  
  // UI State
  const [activeTab, setActiveTab] = useState('akademik');
  const [selectedMonth, setSelectedMonth] = useState(''); // Untuk grafik anonim
  const [anonMetric, setAnonMetric] = useState('akademik'); // 'akademik', 'tahfidz', 'tahsin'
  const [infoRecord, setInfoRecord] = useState(null); // Metadata anak aktif (Nama, Kelas, Wali)

  useEffect(() => {
    setMounted(true);
    
    const fetchSessionAndData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }
      
      setUser(session.user);
      const email = session.user.email.toLowerCase().trim();
      
      try {
        // Fetch anak yang terhubung ke email ini
        const { data: parentLinks, error: linksError } = await supabase
          .from('parent_links')
          .select('nis')
          .eq('parent_email', email);
          
        if (linksError) throw linksError;
        
        if (!parentLinks || parentLinks.length === 0) {
          router.push('/'); // Redirect ke halaman aktivasi jika belum ada link
          return;
        }
        
        const nisList = parentLinks.map(l => l.nis);
        setChildrenNis(nisList);
        setSelectedNis(nisList[0]);
      } catch (err) {
        console.error('Error fetching parent session data:', err);
      }
    };
    
    fetchSessionAndData();
  }, [router]);

  // Fetch data anak ketika NIS berubah
  useEffect(() => {
    if (!selectedNis) return;
    
    const fetchChildData = async () => {
      setLoading(true);
      try {
        // 1. Fetch seluruh record akademik anak ini
        const { data: records, error: recordsError } = await supabase
          .from('rekap_akademik')
          .select('*')
          .eq('nis', selectedNis);
          
        if (recordsError) throw recordsError;
        
        setStudentRecords(records || []);
        
        // Ekstrak Tahun Ajaran unik yang tersedia
        const years = Array.from(new Set((records || []).map(r => r.tahun_ajaran)));
        setAcademicYears(years);
        
        if (years.length > 0) {
          // Pilih tahun ajaran terbaru sebagai default
          const latestYear = years[years.length - 1];
          setSelectedYear(latestYear);
        } else {
          setLoading(false);
        }
      } catch (err) {
        console.error('Error fetching child records:', err);
        setLoading(false);
      }
    };
    
    fetchChildData();
  }, [selectedNis]);

  // Fetch data detail ketika tahun ajaran berubah
  useEffect(() => {
    if (!selectedNis || !selectedYear) return;
    
    const recordsInYear = studentRecords.filter(r => r.tahun_ajaran === selectedYear);
    
    if (recordsInYear.length > 0) {
      // Set metadata info anak dari record pertama
      const meta = recordsInYear[0];
      setInfoRecord(meta);
      
      // Ambil list bulan unik yang diurutkan untuk dropdown grafik anonim
      const months = recordsInYear.map(r => r.bulan);
      const sortedMonths = MONTH_ORDER.filter(m => months.includes(m));
      if (sortedMonths.length > 0) {
        setSelectedMonth(sortedMonths[sortedMonths.length - 1]); // Default ke bulan terakhir yang terisi
      }
    }
    
    // Fetch data satu kelas untuk grafik perbandingan anonim
    const fetchClassComparison = async () => {
      try {
        const { data: cData, error: cError } = await supabase
          .from('rekap_akademik')
          .select('*')
          .eq('tahun_ajaran', selectedYear)
          .eq('kelas', recordsInYear[0].kelas);
          
        if (cError) throw cError;
        setClassRecords(cData || []);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching class records:', err);
        setLoading(false);
      }
    };
    
    fetchClassComparison();
  }, [selectedYear, studentRecords, selectedNis]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  if (!mounted || loading) {
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
            <div className="progress-bar-fill" style={{ width: '90%' }}></div>
          </div>
          <p style={{ color: '#94a3b8' }}>Memuat Dashboard Orang Tua...</p>
        </div>
      </div>
    );
  }

  // Pengurutan data grafik bulanan anak
  const chartData = studentRecords
    .filter(r => r.tahun_ajaran === selectedYear)
    .sort((a, b) => MONTH_ORDER.indexOf(a.bulan) - MONTH_ORDER.indexOf(b.bulan));

  // Menghitung statistik ringkasan akademik anak
  const totalBIndo = chartData.reduce((acc, c) => acc + Number(c.rata_b_indo || 0), 0);
  const totalMtk = chartData.reduce((acc, c) => acc + Number(c.rata_mtk || 0), 0);
  const totalIpa = chartData.reduce((acc, c) => acc + Number(c.rata_ipa || 0), 0);
  const dataCount = chartData.filter(c => c.rata_b_indo !== null).length;
  
  const avgBIndo = dataCount > 0 ? (totalBIndo / dataCount).toFixed(1) : '0';
  const avgMtk = dataCount > 0 ? (totalMtk / dataCount).toFixed(1) : '0';
  const avgIpa = dataCount > 0 ? (totalIpa / dataCount).toFixed(1) : '0';
  const overallAverage = dataCount > 0 ? ((Number(avgBIndo) + Number(avgMtk) + Number(avgIpa)) / 3).toFixed(1) : '0';

  // Dapatkan poin Tahfidz/Tahsin tertinggi bulan terakhir terisi
  const latestQuranRecord = chartData[chartData.length - 1];
  const maxTahfidz = latestQuranRecord ? latestQuranRecord.capaian_tahfidz : 0;
  const maxTahsin = latestQuranRecord ? latestQuranRecord.capaian_tahsin : 0;
  const targetTahfidz = latestQuranRecord ? latestQuranRecord.target_tahfidz : 30;
  const targetTahsin = latestQuranRecord ? latestQuranRecord.target_tahsin : 16;

  // Persiapan data untuk grafik perbandingan anonim
  const filteredClassRecords = classRecords
    .filter(r => r.bulan === selectedMonth)
    .map((r, index) => {
      const isOwnChild = r.nis === selectedNis;
      const avgAcademic = ((Number(r.rata_b_indo || 0) + Number(r.rata_mtk || 0) + Number(r.rata_ipa || 0)) / 3);
      
      return {
        id: r.id,
        nis: r.nis,
        // Samarkan nama jika bukan milik anaknya sendiri
        displayName: isOwnChild ? r.nama_siswa : `Siswa Anonim ${index + 1}`,
        rata_akademik: Number(avgAcademic.toFixed(1)),
        capaian_tahfidz: Number(r.capaian_tahfidz || 0),
        capaian_tahsin: Number(r.capaian_tahsin || 0),
        isOwnChild: isOwnChild
      };
    })
    .sort((a, b) => {
      // Urutkan berdasarkan performa (menurun)
      if (anonMetric === 'akademik') return b.rata_akademik - a.rata_akademik;
      if (anonMetric === 'tahfidz') return b.capaian_tahfidz - a.capaian_tahfidz;
      return b.capaian_tahsin - a.capaian_tahsin;
    });

  // Kustomisasi Tooltip Recharts untuk Al-Qur'an (Tahfidz/Tahsin)
  const QuranTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const isTahfidz = payload[0].name.toLowerCase().includes('tahfidz');
      const capaian = isTahfidz ? data.capaian_tahfidz : data.capaian_tahsin;
      const target = isTahfidz ? data.target_tahfidz : data.target_tahsin;
      const typeStr = isTahfidz ? 'tahfidz' : 'tahsin';
      
      return (
        <div style={{ backgroundColor: '#1c2541', border: '1px solid rgba(255, 255, 255, 0.15)', padding: '12px', borderRadius: '8px' }}>
          <p style={{ fontWeight: '600', color: '#f8fafc', marginBottom: '4px' }}>Bulan: {data.bulan}</p>
          <p style={{ color: '#00f5d4' }}>
            Capaian: {capaian} ({getQuranLevelName(typeStr, capaian)})
          </p>
          <p style={{ color: '#ef4444' }}>
            Target Kelas: {target} ({getQuranLevelName(typeStr, target)})
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="dashboard-container">
      {/* HEADER UTAMA */}
      <header className="dashboard-header">
        <div>
          <span className="badge badge-success" style={{ marginBottom: '8px' }}>Portal Wali Murid</span>
          <h1 style={{ fontSize: '2rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
            Perkembangan Akademik & Qur'an
          </h1>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {/* Dropdown Selector Anak (jika link > 1 anak) */}
          {childrenNis.length > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <User size={18} style={{ color: '#94a3b8' }} />
              <select 
                className="form-select" 
                value={selectedNis} 
                onChange={(e) => setSelectedNis(e.target.value)}
                style={{ width: '180px', padding: '8px 12px' }}
              >
                {childrenNis.map(nis => (
                  <option key={nis} value={nis}>NIS {nis}</option>
                ))}
              </select>
            </div>
          )}

          {/* Selector Tahun Ajaran Historis */}
          <select 
            className="form-select" 
            value={selectedYear} 
            onChange={(e) => setSelectedYear(e.target.value)}
            style={{ width: '150px', padding: '8px 12px' }}
          >
            {academicYears.map(yr => (
              <option key={yr} value={yr}>TA {yr}</option>
            ))}
          </select>

          <button onClick={handleLogout} className="btn-secondary" style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <LogOut size={16} /> Keluar
          </button>
        </div>
      </header>

      {/* METADATA INFORMASI ANAK */}
      {infoRecord && (
        <div className="glass-card" style={{ marginBottom: '32px', padding: '20px', display: 'flex', flexWrap: 'wrap', gap: '40px', background: 'linear-gradient(135deg, rgba(28, 37, 65, 0.8) 0%, rgba(11, 19, 41, 0.8) 100%)' }}>
          <div>
            <span style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>NAMA LENGKAP SISWA</span>
            <strong style={{ fontSize: '1.25rem', color: '#f8fafc' }}>{infoRecord.nama_lengkap}</strong>
          </div>
          <div>
            <span style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>NIS / NISN</span>
            <span style={{ fontSize: '1.1rem', color: '#f8fafc', fontWeight: '500' }}>{infoRecord.nis}</span>
          </div>
          <div>
            <span style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>KELAS</span>
            <span style={{ fontSize: '1.1rem', color: '#00b4d8', fontWeight: '600' }}>{infoRecord.kelas}</span>
          </div>
          <div>
            <span style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>WALI KELAS</span>
            <span style={{ fontSize: '1.1rem', color: '#f8fafc', fontWeight: '500' }}>{infoRecord.wali_kelas}</span>
          </div>
        </div>
      )}

      {/* TAB NAVIGATION */}
      <nav className="tab-nav">
        <button className={`tab-btn ${activeTab === 'akademik' ? 'active' : ''}`} onClick={() => setActiveTab('akademik')}>
          <BookOpen size={16} style={{ marginRight: '6px', verticalAlign: 'middle' }} /> Capaian Akademik
        </button>
        <button className={`tab-btn ${activeTab === 'quran' ? 'active' : ''}`} onClick={() => setActiveTab('quran')}>
          <Award size={16} style={{ marginRight: '6px', verticalAlign: 'middle' }} /> Hafalan Al-Qur'an
        </button>
        <button className={`tab-btn ${activeTab === 'anonim' ? 'active' : ''}`} onClick={() => setActiveTab('anonim')}>
          <BarChart3 size={16} style={{ marginRight: '6px', verticalAlign: 'middle' }} /> Posisi di Kelas (Anonim)
        </button>
      </nav>

      {/* TAB CONTENT: AKADEMIK */}
      {activeTab === 'akademik' && (
        <div>
          <div className="grid-cols-3">
            {/* Rata-Rata Card */}
            <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
              <span style={{ fontSize: '0.9rem', color: '#94a3b8', marginBottom: '8px' }}>RATA-RATA AKADEMIK TAHUNAN</span>
              <strong style={{ fontSize: '3rem', color: '#00f5d4', fontWeight: '800' }}>{overallAverage}</strong>
              <span className="badge badge-success" style={{ marginTop: '8px' }}>Target: 90.0</span>
            </div>

            {/* Rekap Nilai Mapel */}
            <div className="glass-card" style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '16px', color: '#f8fafc' }}>Ringkasan Nilai Mata Pelajaran</h3>
              <div style={{ display: 'flex', justifyContent: 'space-around', flexWrap: 'wrap', gap: '20px' }}>
                <div style={{ textAlign: 'center' }}>
                  <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '6px' }}>B. Indonesia</p>
                  <strong style={{ fontSize: '2rem', color: '#00b4d8' }}>{avgBIndo}</strong>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '6px' }}>Matematika</p>
                  <strong style={{ fontSize: '2rem', color: '#00b4d8' }}>{avgMtk}</strong>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '6px' }}>IPA</p>
                  <strong style={{ fontSize: '2rem', color: '#00b4d8' }}>{avgIpa}</strong>
                </div>
              </div>
              <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '16px', lineHeight: '1.6', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '12px' }}>
                *Berdasarkan data hingga bulan <strong>{latestQuranRecord?.bulan || '-'}</strong>, perkembangan akademik Ananda <strong>{infoRecord?.nama_siswa}</strong> menunjukkan rata-rata nilai sebesar <strong>{overallAverage}</strong>. Ananda telah mencapai target yang ditetapkan dengan sangat baik.
              </p>
            </div>
          </div>

          {/* Grafik Tren Akademik */}
          <div className="glass-card" style={{ marginBottom: '32px' }}>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '24px', color: '#f8fafc' }}>Grafik Tren Akademik {selectedYear}</h3>
            <div style={{ width: '100%', height: 350 }}>
              <ResponsiveContainer>
                <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="bulan" stroke="#94a3b8" />
                  <YAxis domain={[60, 100]} stroke="#94a3b8" />
                  <Tooltip contentStyle={{ backgroundColor: '#1c2541', border: '1px solid rgba(255,255,255,0.1)' }} />
                  <Legend />
                  <ReferenceLine y={90} stroke="#ef4444" strokeDasharray="5 5" label={{ value: 'Target 90', fill: '#ef4444', position: 'insideTopLeft' }} />
                  <Line type="monotone" dataKey="rata_mtk" name="Matematika" stroke="#00b4d8" strokeWidth={3} activeDot={{ r: 8 }} />
                  <Line type="monotone" dataKey="rata_ipa" name="IPA" stroke="#00f5d4" strokeWidth={3} />
                  <Line type="monotone" dataKey="rata_b_indo" name="B. Indonesia" stroke="#10b981" strokeWidth={3} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: QURAN (TAHFIDZ & TAHSIN) */}
      {activeTab === 'quran' && (
        <div>
          {/* Progress Overview */}
          <div className="grid-cols-2">
            {/* Progress Tahfidz */}
            <div className="glass-card">
              <span className="badge badge-success" style={{ marginBottom: '8px' }}>Tahfidz</span>
              <h3 style={{ fontSize: '1.25rem', marginBottom: '16px' }}>Capaian Materi Tahfidz Terbaru</h3>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div>
                  <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Surah Tercapai:</span>
                  <p style={{ fontSize: '1.1rem', fontWeight: '600', color: '#00f5d4' }}>{getQuranLevelName('tahfidz', maxTahfidz)}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '1.8rem', fontWeight: '800', color: '#00f5d4' }}>{maxTahfidz}</span>
                  <span style={{ color: '#94a3b8' }}> / {targetTahfidz} Poin</span>
                </div>
              </div>
              <div className="progress-bar-container">
                <div className="progress-bar-fill" style={{ width: `${Math.min((maxTahfidz / targetTahfidz) * 100, 100)}%` }}></div>
              </div>
              <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '12px' }}>
                *Target kelas {infoRecord?.kelas} pada bulan ini adalah {targetTahfidz} poin ({getQuranLevelName('tahfidz', targetTahfidz)}).
              </p>
            </div>

            {/* Progress Tahsin */}
            <div className="glass-card">
              <span className="badge badge-success" style={{ marginBottom: '8px', backgroundColor: 'rgba(0, 180, 216, 0.15)', color: '#00b4d8', borderColor: 'rgba(0, 180, 216, 0.3)' }}>Tahsin</span>
              <h3 style={{ fontSize: '1.25rem', marginBottom: '16px' }}>Capaian Materi Tahsin Terbaru</h3>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div>
                  <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Materi Tercapai:</span>
                  <p style={{ fontSize: '1.1rem', fontWeight: '600', color: '#00b4d8' }}>{getQuranLevelName('tahsin', maxTahsin)}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '1.8rem', fontWeight: '800', color: '#00b4d8' }}>{maxTahsin}</span>
                  <span style={{ color: '#94a3b8' }}> / {targetTahsin} Poin</span>
                </div>
              </div>
              <div className="progress-bar-container">
                <div className="progress-bar-fill" style={{ width: `${Math.min((maxTahsin / targetTahsin) * 100, 100)}%`, background: 'linear-gradient(90deg, #00b4d8 0%, #3a506b 100%)' }}></div>
              </div>
              <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '12px' }}>
                *Target kelas {infoRecord?.kelas} pada bulan ini adalah {targetTahsin} poin ({getQuranLevelName('tahsin', targetTahsin)}).
              </p>
            </div>
          </div>

          {/* Bar Charts for Quran */}
          <div className="grid-cols-2">
            {/* Tahfidz Chart */}
            <div className="glass-card">
              <h3 style={{ fontSize: '1.1rem', marginBottom: '20px' }}>Grafik Capaian Tahfidz {selectedYear}</h3>
              <div style={{ width: '100%', height: 280 }}>
                <ResponsiveContainer>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="bulan" stroke="#94a3b8" />
                    <YAxis domain={[0, 50]} stroke="#94a3b8" />
                    <Tooltip content={<QuranTooltip />} />
                    <Legend />
                    <Bar dataKey="capaian_tahfidz" name="Capaian Tahfidz" fill="#00f5d4" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="target_tahfidz" name="Target Kelas" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Tahsin Chart */}
            <div className="glass-card">
              <h3 style={{ fontSize: '1.1rem', marginBottom: '20px' }}>Grafik Capaian Tahsin {selectedYear}</h3>
              <div style={{ width: '100%', height: 280 }}>
                <ResponsiveContainer>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="bulan" stroke="#94a3b8" />
                    <YAxis domain={[0, 30]} stroke="#94a3b8" />
                    <Tooltip content={<QuranTooltip />} />
                    <Legend />
                    <Bar dataKey="capaian_tahsin" name="Capaian Tahsin" fill="#00b4d8" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="target_tahsin" name="Target Kelas" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: ANONIM (POSISI DI KELAS) */}
      {activeTab === 'anonim' && (
        <div className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <h3 style={{ fontSize: '1.2rem', color: '#f8fafc' }}>Posisi Anak dalam Kelas</h3>
              <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginTop: '4px' }}>Nama siswa lain disamarkan secara anonim untuk menjaga privasi.</p>
            </div>
            
            <div style={{ display: 'flex', gap: '12px' }}>
              {/* Selector Bulan Data */}
              <select 
                className="form-select" 
                value={selectedMonth} 
                onChange={(e) => setSelectedMonth(e.target.value)}
                style={{ width: '130px', padding: '8px 12px' }}
              >
                {MONTH_ORDER.filter(m => Array.from(new Set(studentRecords.filter(r => r.tahun_ajaran === selectedYear).map(r => r.bulan))).includes(m)).map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>

              {/* Selector Metrik Pembanding */}
              <select 
                className="form-select" 
                value={anonMetric} 
                onChange={(e) => setAnonMetric(e.target.value)}
                style={{ width: '180px', padding: '8px 12px' }}
              >
                <option value="akademik">Rata-Rata Akademik</option>
                <option value="tahfidz">Poin Tahfidz</option>
                <option value="tahsin">Poin Tahsin</option>
              </select>
            </div>
          </div>

          {/* Grafik Batang Anonim */}
          <div style={{ width: '100%', height: 380 }}>
            <ResponsiveContainer>
              <BarChart data={filteredClassRecords} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="displayName" stroke="#94a3b8" tick={{ fontSize: 10, angle: -30, textAnchor: 'end' }} />
                <YAxis stroke="#94a3b8" />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1c2541', border: '1px solid rgba(255, 255, 255, 0.1)' }}
                  formatter={(value) => {
                    if (anonMetric === 'akademik') return [`${value} / 100`, 'Nilai Rata-rata'];
                    if (anonMetric === 'tahfidz') return [`${value} (${getQuranLevelName('tahfidz', value)})`, 'Poin Tahfidz'];
                    return [`${value} (${getQuranLevelName('tahsin', value)})`, 'Poin Tahsin'];
                  }}
                />
                <Bar 
                  dataKey={anonMetric === 'akademik' ? 'rata_akademik' : anonMetric === 'tahfidz' ? 'capaian_tahfidz' : 'capaian_tahsin'} 
                  name={anonMetric === 'akademik' ? 'Rata-Rata Nilai' : anonMetric === 'tahfidz' ? 'Poin Tahfidz' : 'Poin Tahsin'}
                >
                  {filteredClassRecords.map((entry, idx) => (
                    <cell 
                      key={`cell-${idx}`} 
                      // Menggunakan warna mencolok untuk anak sendiri, abu-abu untuk yang lain
                      fill={entry.isOwnChild ? '#00f5d4' : 'rgba(255, 255, 255, 0.15)'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div style={{ marginTop: '24px', display: 'flex', gap: '20px', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '12px 20px', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '16px', height: '16px', backgroundColor: '#00f5d4', borderRadius: '4px' }}></div>
              <span style={{ fontSize: '0.85rem' }}>Ananda {infoRecord?.nama_siswa}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '16px', height: '16px', backgroundColor: 'rgba(255, 255, 255, 0.15)', borderRadius: '4px' }}></div>
              <span style={{ fontSize: '0.85rem' }}>Siswa Lain (Anonim)</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
