'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { getQuranLevelName } from '@/quran_mapping';
import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, Legend, ResponsiveContainer, ReferenceLine 
} from 'recharts';
import { 
  LogOut, School, ShieldAlert, GraduationCap, ChevronRight, X,
  BookOpen, Award, Users, AlertTriangle, Presentation
} from 'lucide-react';

const MONTH_ORDER = [
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
  "Januari", "Februari", "Maret", "April", "Mei", "Juni"
];

export default function KepalaSekolahDashboard() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [principal, setPrincipal] = useState(null);
  
  // Data State
  const [academicYears, setAcademicYears] = useState([]);
  const [selectedYear, setSelectedYear] = useState('');
  const [classes, setClasses] = useState([]); // List kelas unik di tahun tersebut
  const [selectedClass, setSelectedClass] = useState('Semua Kelas');
  const [months, setMonths] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [allRecords, setAllRecords] = useState([]); // Seluruh data di tahun aktif
  
  // Drill-down State
  const [selectedStudentNis, setSelectedStudentNis] = useState(null);
  const [selectedStudentName, setSelectedStudentName] = useState('');
  const [studentDetailedRecords, setStudentDetailedRecords] = useState([]);
  const [detailedTab, setDetailedTab] = useState('akademik');

  useEffect(() => {
    setMounted(true);
    
    const fetchPrincipalSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }
      
      const email = session.user.email.toLowerCase().trim();
      
      try {
        // Fetch data Kepala Sekolah
        const { data: userData, error: uError } = await supabase
          .from('users_access')
          .select('*')
          .eq('email', email)
          .maybeSingle();
          
        if (uError) throw uError;
        
        if (!userData || userData.role !== 'kepala_sekolah') {
          // Jika bukan Kasek, kembalikan ke router utama
          router.push('/');
          return;
        }
        
        setPrincipal(userData);
        
        // Fetch semua Tahun Ajaran yang tersedia di sekolah
        const { data: yearsData, error: yearsErr } = await supabase
          .from('rekap_akademik')
          .select('tahun_ajaran');
          
        if (yearsErr) throw yearsErr;
        
        const years = Array.from(new Set(yearsData.map(r => r.tahun_ajaran)));
        setAcademicYears(years);
        
        if (years.length > 0) {
          setSelectedYear(years[years.length - 1]); // Pilih tahun ajaran terbaru
        } else {
          setLoading(false);
        }
        
      } catch (err) {
        console.error('Error fetching principal data:', err);
        setLoading(false);
      }
    };
    
    fetchPrincipalSession();
  }, [router]);

  // Fetch seluruh data sekolah untuk tahun ajaran aktif
  useEffect(() => {
    if (!selectedYear) return;
    
    const fetchYearData = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('rekap_akademik')
          .select('*')
          .eq('tahun_ajaran', selectedYear);
          
        if (error) throw error;
        
        setAllRecords(data || []);
        
        // Ekstrak kelas unik
        const uniqueClasses = Array.from(new Set(data.map(r => r.kelas)));
        setClasses(uniqueClasses);
        setSelectedClass('Semua Kelas'); // Reset ke Semua Kelas saat tahun berubah
        
        // Ekstrak bulan unik
        const uniqueMonths = Array.from(new Set(data.map(r => r.bulan)));
        const sortedMonths = MONTH_ORDER.filter(m => uniqueMonths.includes(m));
        setMonths(sortedMonths);
        
        if (sortedMonths.length > 0) {
          setSelectedMonth(sortedMonths[sortedMonths.length - 1]);
        }
        
        setLoading(false);
      } catch (err) {
        console.error('Error fetching school data:', err);
        setLoading(false);
      }
    };
    
    fetchYearData();
  }, [selectedYear]);

  // Fetch detail data drill-down siswa
  useEffect(() => {
    if (!selectedStudentNis) return;
    
    const fetchStudentDetails = async () => {
      try {
        const { data, error } = await supabase
          .from('rekap_akademik')
          .select('*')
          .eq('nis', selectedStudentNis);
          
        if (error) throw error;
        setStudentDetailedRecords(data || []);
      } catch (err) {
        console.error('Error fetching student details:', err);
      }
    };
    
    fetchStudentDetails();
  }, [selectedStudentNis]);

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
          <p style={{ color: '#94a3b8' }}>Memuat Dashboard Kepala Sekolah...</p>
        </div>
      </div>
    );
  }

  // Filter data untuk Bulan yang dipilih
  const monthlyData = allRecords.filter(r => r.bulan === selectedMonth);

  // Filter data spesifik jika kelas tertentu dipilih
  const filteredData = selectedClass === 'Semua Kelas'
    ? monthlyData
    : monthlyData.filter(r => r.kelas === selectedClass);

  // Perhitungan Ringkasan Statistik
  const totalStudents = filteredData.length;
  
  const avgBIndo = totalStudents > 0 
    ? (filteredData.reduce((acc, c) => acc + Number(c.rata_b_indo || 0), 0) / totalStudents).toFixed(1)
    : '0';
  const avgMtk = totalStudents > 0 
    ? (filteredData.reduce((acc, c) => acc + Number(c.rata_mtk || 0), 0) / totalStudents).toFixed(1)
    : '0';
  const avgIpa = totalStudents > 0 
    ? (filteredData.reduce((acc, c) => acc + Number(c.rata_ipa || 0), 0) / totalStudents).toFixed(1)
    : '0';

  const countTuntasBIndo = filteredData.filter(r => Number(r.rata_b_indo || 0) >= 90).length;
  const countTuntasMtk = filteredData.filter(r => Number(r.rata_mtk || 0) >= 90).length;
  const countTuntasIpa = filteredData.filter(r => Number(r.rata_ipa || 0) >= 90).length;

  const pctTuntasBIndo = totalStudents > 0 ? ((countTuntasBIndo / totalStudents) * 100).toFixed(0) : 0;
  const pctTuntasMtk = totalStudents > 0 ? ((countTuntasMtk / totalStudents) * 100).toFixed(0) : 0;
  const pctTuntasIpa = totalStudents > 0 ? ((countTuntasIpa / totalStudents) * 100).toFixed(0) : 0;

  const countTuntasTahfidz = filteredData.filter(r => Number(r.capaian_tahfidz || 0) >= Number(r.target_tahfidz || 30)).length;
  const countTuntasTahsin = filteredData.filter(r => Number(r.capaian_tahsin || 0) >= Number(r.target_tahsin || 16)).length;
  const pctTuntasTahfidz = totalStudents > 0 ? ((countTuntasTahfidz / totalStudents) * 100).toFixed(0) : 0;
  const pctTuntasTahsin = totalStudents > 0 ? ((countTuntasTahsin / totalStudents) * 100).toFixed(0) : 0;

  // early warning kelas (spesifik atau global)
  const warnings = [];
  filteredData.forEach(student => {
    const academicIssues = [];
    if (student.rata_b_indo !== null && Number(student.rata_b_indo) < 90) academicIssues.push('B. Indonesia');
    if (student.rata_mtk !== null && Number(student.rata_mtk) < 90) academicIssues.push('Matematika');
    if (student.rata_ipa !== null && Number(student.rata_ipa) < 90) academicIssues.push('IPA');

    const isTahfidzWarning = student.capaian_tahfidz !== null && Number(student.capaian_tahfidz) < Number(student.target_tahfidz);
    const isTahsinWarning = student.capaian_tahsin !== null && Number(student.capaian_tahsin) < Number(student.target_tahsin);

    if (academicIssues.length > 0 || isTahfidzWarning || isTahsinWarning) {
      warnings.push({
        nis: student.nis,
        nama: student.nama_siswa,
        kelas: student.kelas,
        academicIssues,
        isTahfidzWarning,
        isTahsinWarning,
        details: student
      });
    }
  });

  // Urutkan siswa
  const sortedFilteredData = [...filteredData].sort((a, b) => a.nama_siswa.localeCompare(b.nama_siswa));

  // Persiapan data perbandingan kelas (khusus untuk tampilan "Semua Kelas")
  const classComparisonData = classes.map(clsName => {
    const classRows = monthlyData.filter(r => r.kelas === clsName);
    const totalClassSt = classRows.length;
    const avgAcademic = totalClassSt > 0 
      ? (classRows.reduce((acc, c) => acc + ((Number(c.rata_b_indo || 0) + Number(c.rata_mtk || 0) + Number(c.rata_ipa || 0)) / 3), 0) / totalClassSt)
      : 0;
    
    return {
      kelas: clsName,
      rata_rata: Number(avgAcademic.toFixed(1)),
      tuntas_tahfidz: totalClassSt > 0 
        ? Math.round((classRows.filter(r => Number(r.capaian_tahfidz || 0) >= Number(r.target_tahfidz || 30)).length / totalClassSt) * 100)
        : 0,
      tuntas_tahsin: totalClassSt > 0
        ? Math.round((classRows.filter(r => Number(r.capaian_tahsin || 0) >= Number(r.target_tahsin || 16)).length / totalClassSt) * 100)
        : 0
    };
  });

  const QuranTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const isTahfidz = payload[0].name.toLowerCase().includes('tahfidz');
      const capaian = isTahfidz ? data.capaian_tahfidz : data.capaian_tahsin;
      const target = isTahfidz ? data.target_tahfidz : data.target_tahsin;
      const typeStr = isTahfidz ? 'tahfidz' : 'tahsin';
      
      return (
        <div style={{ backgroundColor: '#1c2541', border: '1px solid rgba(255, 255, 255, 0.15)', padding: '12px', borderRadius: '8px' }}>
          <p style={{ fontWeight: '600', color: '#f8fafc', marginBottom: '4px' }}>{data.nama_siswa} ({data.kelas})</p>
          <p style={{ color: '#00f5d4' }}>
            Capaian: {capaian} ({getQuranLevelName(typeStr, capaian)})
          </p>
          <p style={{ color: '#ef4444' }}>
            Target: {target} ({getQuranLevelName(typeStr, target)})
          </p>
        </div>
      );
    }
    return null;
  };

  const detailChartData = studentDetailedRecords
    .filter(r => r.tahun_ajaran === selectedYear)
    .sort((a, b) => MONTH_ORDER.indexOf(a.bulan) - MONTH_ORDER.indexOf(b.bulan));

  return (
    <div className="dashboard-container">
      {/* HEADER DASHBOARD */}
      <header className="dashboard-header">
        <div>
          <span className="badge badge-success" style={{ marginBottom: '8px', backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#10b981', borderColor: 'rgba(16, 185, 129, 0.3)' }}>Portal Kepala Sekolah</span>
          <h1 style={{ fontSize: '2rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <School size={28} style={{ color: '#00b4d8' }} /> Dashboard Global
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginTop: '4px' }}>Kepala Sekolah: {principal?.nama}</p>
        </div>
        
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Dropdown Kelas */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Presentation size={18} style={{ color: '#94a3b8' }} />
            <select 
              className="form-select" 
              value={selectedClass} 
              onChange={(e) => setSelectedClass(e.target.value)}
              style={{ width: '160px', padding: '8px 12px' }}
            >
              <option value="Semua Kelas">Semua Kelas</option>
              {classes.map(cls => (
                <option key={cls} value={cls}>Kelas {cls}</option>
              ))}
            </select>
          </div>

          {/* Dropdown Tahun Ajaran */}
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

          {/* Dropdown Bulan */}
          <select 
            className="form-select" 
            value={selectedMonth} 
            onChange={(e) => setSelectedMonth(e.target.value)}
            style={{ width: '130px', padding: '8px 12px' }}
          >
            {months.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>

          <button onClick={handleLogout} className="btn-secondary" style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <LogOut size={16} /> Keluar
          </button>
        </div>
      </header>

      {/* METRIK GLOBAL CARDS */}
      <div className="grid-cols-3">
        {/* Total Siswa */}
        <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ backgroundColor: 'rgba(0, 180, 216, 0.1)', color: '#00b4d8', padding: '16px', borderRadius: '12px' }}>
            <Users size={32} />
          </div>
          <div>
            <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>TOTAL SISWA TERDAFTAR</span>
            <h2 style={{ fontSize: '2rem', fontWeight: '800', marginTop: '4px' }}>{totalStudents}</h2>
          </div>
        </div>

        {/* Nilai Rata-rata Sekolah */}
        <div className="glass-card" style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'space-around', alignItems: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>RATA B. INDO</span>
            <h3 style={{ fontSize: '1.75rem', color: '#00b4d8', marginTop: '6px' }}>{avgBIndo}</h3>
          </div>
          <div style={{ textAlign: 'center', borderLeft: '1px solid rgba(255,255,255,0.05)', borderRight: '1px solid rgba(255,255,255,0.05)', padding: '0 40px' }}>
            <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>RATA MATEMATIKA</span>
            <h3 style={{ fontSize: '1.75rem', color: '#00f5d4', marginTop: '6px' }}>{avgMtk}</h3>
          </div>
          <div style={{ textAlign: 'center' }}>
            <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>RATA IPA</span>
            <h3 style={{ fontSize: '1.75rem', color: '#10b981', marginTop: '6px' }}>{avgIpa}</h3>
          </div>
        </div>
      </div>

      {/* TAMPILAN VIEW: SEMUA KELAS (GLOBAL COMPARISON) */}
      {selectedClass === 'Semua Kelas' ? (
        <div>
          {/* Grafik Perbandingan Antar Kelas */}
          <div className="grid-cols-2">
            {/* Rata-Rata Akademik per Kelas */}
            <div className="glass-card">
              <h3 style={{ fontSize: '1.1rem', marginBottom: '20px' }}>Rata-Rata Hasil Akademik per Kelas</h3>
              <div style={{ width: '100%', height: 280 }}>
                <ResponsiveContainer>
                  <BarChart data={classComparisonData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="kelas" stroke="#94a3b8" />
                    <YAxis domain={[60, 100]} stroke="#94a3b8" />
                    <Tooltip contentStyle={{ backgroundColor: '#1c2541', border: '1px solid rgba(255,255,255,0.1)' }} />
                    <Bar dataKey="rata_rata" name="Rata-Rata Nilai" fill="#00b4d8" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Qur'an Ketuntasan per Kelas */}
            <div className="glass-card">
              <h3 style={{ fontSize: '1.1rem', marginBottom: '20px' }}>Persentase Ketuntasan Qur'an per Kelas (%)</h3>
              <div style={{ width: '100%', height: 280 }}>
                <ResponsiveContainer>
                  <BarChart data={classComparisonData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="kelas" stroke="#94a3b8" />
                    <YAxis domain={[0, 100]} stroke="#94a3b8" />
                    <Tooltip contentStyle={{ backgroundColor: '#1c2541', border: '1px solid rgba(255,255,255,0.1)' }} />
                    <Legend />
                    <Bar dataKey="tuntas_tahfidz" name="Ketuntasan Tahfidz" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="tuntas_tahsin" name="Ketuntasan Tahsin" fill="#a855f7" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* TAMPILAN VIEW: KELAS SPESIFIK (DRILL DOWN GURU) */
        <div>
          {/* Gauge Ketuntasan Kelas terpilih */}
          <div className="glass-card" style={{ marginBottom: '32px' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '24px', color: '#f8fafc' }}>Tingkat Ketuntasan Kelas {selectedClass} (% Siswa Tuntas)</h3>
            <div className="gauge-container">
              <div className="gauge-item">
                <div className="gauge-circle" style={{ '--percentage': `${pctTuntasBIndo * 3.6}deg`, '--accent-color': '#00b4d8' }}>
                  <span className="gauge-value">{pctTuntasBIndo}%</span>
                </div>
                <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>B. Indonesia</span>
              </div>
              <div className="gauge-item">
                <div className="gauge-circle" style={{ '--percentage': `${pctTuntasMtk * 3.6}deg`, '--accent-color': '#00f5d4' }}>
                  <span className="gauge-value">{pctTuntasMtk}%</span>
                </div>
                <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Matematika</span>
              </div>
              <div className="gauge-item">
                <div className="gauge-circle" style={{ '--percentage': `${pctTuntasIpa * 3.6}deg`, '--accent-color': '#10b981' }}>
                  <span className="gauge-value">{pctTuntasIpa}%</span>
                </div>
                <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>IPA</span>
              </div>
              <div className="gauge-item">
                <div className="gauge-circle" style={{ '--percentage': `${pctTuntasTahfidz * 3.6}deg`, '--accent-color': '#f59e0b' }}>
                  <span className="gauge-value">{pctTuntasTahfidz}%</span>
                </div>
                <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Tahfidz Qur'an</span>
              </div>
              <div className="gauge-item">
                <div className="gauge-circle" style={{ '--percentage': `${pctTuntasTahsin * 3.6}deg`, '--accent-color': '#a855f7' }}>
                  <span className="gauge-value">{pctTuntasTahsin}%</span>
                </div>
                <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Tahsin Qur'an</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* EARLY WARNING SYSTEM (GLOBAL/SPESIFIK) */}
      <div className="glass-card" style={{ marginBottom: '32px', borderLeft: '4px solid var(--danger)' }}>
        <h3 style={{ fontSize: '1.1rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', color: '#ef4444' }}>
          <AlertTriangle size={20} /> Siswa Perlu Pendampingan Khusus ({selectedClass})
        </h3>
        {warnings.length === 0 ? (
          <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Seluruh siswa telah mencapai target bulan ini. Pertahankan!</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
            {warnings.slice(0, 6).map(w => ( // Potong maksimal 6 di dashboard agar rapi
              <div key={w.nis} style={{ background: 'rgba(239, 68, 68, 0.03)', border: '1px solid rgba(239, 68, 68, 0.15)', borderRadius: '10px', padding: '14px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <strong style={{ fontSize: '0.95rem', color: '#f8fafc' }}>{w.nama}</strong>
                    <span className="badge" style={{ backgroundColor: 'rgba(255,255,255,0.05)', fontSize: '0.7rem', padding: '2px 6px' }}>Kls {w.kelas}</span>
                  </div>
                  <span style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginTop: '2px' }}>NIS: {w.nis}</span>
                  
                  <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {w.academicIssues.length > 0 && (
                      <span style={{ fontSize: '0.75rem', color: '#fca5a5' }}>
                        ⚠️ Di bawah target Nilai: {w.academicIssues.join(', ')}
                      </span>
                    )}
                    {w.isTahfidzWarning && (
                      <span style={{ fontSize: '0.75rem', color: '#fde047' }}>
                        📖 Tahfidz di bawah target ({w.details.capaian_tahfidz}/{w.details.target_tahfidz})
                      </span>
                    )}
                    {w.isTahsinWarning && (
                      <span style={{ fontSize: '0.75rem', color: '#fde047' }}>
                        📖 Tahsin di bawah target ({w.details.capaian_tahsin}/{w.details.target_tahsin})
                      </span>
                    )}
                  </div>
                </div>
                
                <button 
                  onClick={() => {
                    setSelectedStudentNis(w.nis);
                    setSelectedStudentName(w.details.nama_lengkap);
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#00b4d8',
                    fontSize: '0.8rem',
                    textAlign: 'left',
                    padding: 0,
                    marginTop: '12px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    fontWeight: '600'
                  }}
                >
                  Lihat Detail Perkembangan <ChevronRight size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* TABEL DIREKTORI SISWA */}
      <div className="glass-card">
        <h3 style={{ fontSize: '1.2rem', marginBottom: '20px' }}>Direktori Siswa & Capaian</h3>
        <div className="table-wrapper">
          <table className="premium-table">
            <thead>
              <tr>
                <th>No</th>
                <th>Nama Siswa</th>
                <th>Kelas</th>
                <th>NIS</th>
                <th>B. Indonesia</th>
                <th>Matematika</th>
                <th>IPA</th>
                <th>Tahfidz</th>
                <th>Tahsin</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {sortedFilteredData.map((student, idx) => {
                const isWarning = warnings.some(w => w.nis === student.nis);
                
                return (
                  <tr key={student.nis} style={isWarning ? { backgroundColor: 'rgba(239, 68, 68, 0.02)' } : undefined}>
                    <td>{idx + 1}</td>
                    <td>
                      <strong style={{ color: '#f8fafc' }}>{student.nama_lengkap}</strong>
                      {isWarning && (
                        <span className="badge badge-danger" style={{ fontSize: '0.65rem', padding: '2px 6px', marginLeft: '8px' }}>
                          Perlu Perhatian
                        </span>
                      )}
                    </td>
                    <td>{student.kelas}</td>
                    <td>{student.nis}</td>
                    <td>{student.rata_b_indo !== null ? student.rata_b_indo : '-'}</td>
                    <td>{student.rata_mtk !== null ? student.rata_mtk : '-'}</td>
                    <td>{student.rata_ipa !== null ? student.rata_ipa : '-'}</td>
                    <td>
                      <span style={{ fontSize: '0.85rem' }}>
                        {student.capaian_tahfidz !== null ? `${student.capaian_tahfidz} (${getQuranLevelName('tahfidz', student.capaian_tahfidz)})` : '-'}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.85rem' }}>
                        {student.capaian_tahsin !== null ? `${student.capaian_tahsin} (${getQuranLevelName('tahsin', student.capaian_tahsin)})` : '-'}
                      </span>
                    </td>
                    <td>
                      <button 
                        className="btn-secondary" 
                        style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                        onClick={() => {
                          setSelectedStudentNis(student.nis);
                          setSelectedStudentName(student.nama_lengkap);
                        }}
                      >
                        Inspeksi
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL INSPEKSI DRILL DOWN SISWA */}
      {selectedStudentNis && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundColor: 'rgba(11, 19, 41, 0.85)',
          backdropFilter: 'blur(8px)',
          zIndex: 1000,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '24px'
        }}>
          <div className="glass-card" style={{
            maxWidth: '1000px',
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto',
            position: 'relative',
            border: '1px solid rgba(0, 180, 216, 0.3)'
          }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '16px' }}>
              <div>
                <span className="badge badge-success" style={{ marginBottom: '6px' }}>Inspeksi Perkembangan</span>
                <h2 style={{ fontSize: '1.5rem' }}>{selectedStudentName}</h2>
                <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>NIS: {selectedStudentNis}</p>
              </div>
              <button 
                onClick={() => {
                  setSelectedStudentNis(null);
                  setStudentDetailedRecords([]);
                }} 
                className="btn-secondary" 
                style={{ padding: '8px', borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Tab Nav */}
            <div className="tab-nav" style={{ marginBottom: '24px' }}>
              <button className={`tab-btn ${detailedTab === 'akademik' ? 'active' : ''}`} onClick={() => setDetailedTab('akademik')}>
                <BookOpen size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} /> Tren Akademik
              </button>
              <button className={`tab-btn ${detailedTab === 'quran' ? 'active' : ''}`} onClick={() => setDetailedTab('quran')}>
                <Award size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} /> Progres Qur'an
              </button>
            </div>

            {/* Modal Tab Content */}
            {detailedTab === 'akademik' ? (
              <div>
                <div style={{ width: '100%', height: 320, marginBottom: '24px' }}>
                  <ResponsiveContainer>
                    <LineChart data={detailChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="bulan" stroke="#94a3b8" />
                      <YAxis domain={[60, 100]} stroke="#94a3b8" />
                      <Tooltip contentStyle={{ backgroundColor: '#1c2541', border: '1px solid rgba(255,255,255,0.1)' }} />
                      <Legend />
                      <ReferenceLine y={90} stroke="#ef4444" strokeDasharray="5 5" label={{ value: 'Target 90', fill: '#ef4444', position: 'insideTopLeft' }} />
                      <Line type="monotone" dataKey="rata_mtk" name="Matematika" stroke="#00b4d8" strokeWidth={3} />
                      <Line type="monotone" dataKey="rata_ipa" name="IPA" stroke="#00f5d4" strokeWidth={3} />
                      <Line type="monotone" dataKey="rata_b_indo" name="B. Indonesia" stroke="#10b981" strokeWidth={3} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                {/* Tahfidz */}
                <div className="glass-card" style={{ background: 'rgba(255,255,255,0.01)' }}>
                  <h4 style={{ marginBottom: '16px' }}>Tren Tahfidz Bulanan</h4>
                  <div style={{ width: '100%', height: 240 }}>
                    <ResponsiveContainer>
                      <BarChart data={detailChartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="bulan" stroke="#94a3b8" />
                        <YAxis domain={[0, 50]} stroke="#94a3b8" />
                        <Tooltip content={<QuranTooltip />} />
                        <Bar dataKey="capaian_tahfidz" name="Capaian" fill="#00f5d4" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="target_tahfidz" name="Target" fill="#ef4444" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Tahsin */}
                <div className="glass-card" style={{ background: 'rgba(255,255,255,0.01)' }}>
                  <h4 style={{ marginBottom: '16px' }}>Tren Tahsin Bulanan</h4>
                  <div style={{ width: '100%', height: 240 }}>
                    <ResponsiveContainer>
                      <BarChart data={detailChartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="bulan" stroke="#94a3b8" />
                        <YAxis domain={[0, 30]} stroke="#94a3b8" />
                        <Tooltip content={<QuranTooltip />} />
                        <Bar dataKey="capaian_tahsin" name="Capaian" fill="#00b4d8" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="target_tahsin" name="Target" fill="#ef4444" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
