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
  LogOut, Users, GraduationCap, AlertTriangle, ChevronRight, X,
  BookOpen, Award, CheckCircle, BarChart3, HelpCircle 
} from 'lucide-react';

const MONTH_ORDER = [
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
  "Januari", "Februari", "Maret", "April", "Mei", "Juni"
];

export default function WaliKelasDashboard() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [teacher, setTeacher] = useState(null);
  
  // Data State
  const [academicYears, setAcademicYears] = useState([]);
  const [selectedYear, setSelectedYear] = useState('');
  const [months, setMonths] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [classData, setClassData] = useState([]); // Seluruh data untuk kelas + tahun ini
  
  // Drill-down State
  const [selectedStudentNis, setSelectedStudentNis] = useState(null);
  const [selectedStudentName, setSelectedStudentName] = useState('');
  const [studentDetailedRecords, setStudentDetailedRecords] = useState([]);
  const [detailedTab, setDetailedTab] = useState('akademik');

  useEffect(() => {
    setMounted(true);
    
    const fetchTeacherSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }
      
      const email = session.user.email.toLowerCase().trim();
      
      try {
        // Fetch data Wali Kelas
        const { data: teacherData, error: tError } = await supabase
          .from('users_access')
          .select('*')
          .eq('email', email)
          .maybeSingle();
          
        if (tError) throw tError;
        
        if (!teacherData || teacherData.role !== 'wali_kelas') {
          // Jika bukan Wali Kelas, tendang ke router utama
          router.push('/');
          return;
        }
        
        setTeacher(teacherData);
        
        // Fetch semua Tahun Ajaran yang tersedia untuk kelas yang diampu
        const { data: allRecords, error: allErr } = await supabase
          .from('rekap_akademik')
          .select('tahun_ajaran')
          .eq('kelas', teacherData.kelas);
          
        if (allErr) throw allErr;
        
        const years = Array.from(new Set(allRecords.map(r => r.tahun_ajaran)));
        setAcademicYears(years);
        
        if (years.length > 0) {
          setSelectedYear(years[years.length - 1]); // Pilih tahun ajaran terbaru
        } else {
          setLoading(false);
        }
        
      } catch (err) {
        console.error('Error fetching teacher data:', err);
        setLoading(false);
      }
    };
    
    fetchTeacherSession();
  }, [router]);

  // Fetch seluruh data kelas untuk tahun ajaran aktif
  useEffect(() => {
    if (!teacher || !selectedYear) return;
    
    const fetchClassData = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('rekap_akademik')
          .select('*')
          .eq('kelas', teacher.kelas)
          .eq('tahun_ajaran', selectedYear);
          
        if (error) throw error;
        
        setClassData(data || []);
        
        // Ekstrak bulan-bulan unik
        const uniqueMonths = Array.from(new Set(data.map(r => r.bulan)));
        const sortedMonths = MONTH_ORDER.filter(m => uniqueMonths.includes(m));
        setMonths(sortedMonths);
        
        if (sortedMonths.length > 0) {
          setSelectedMonth(sortedMonths[sortedMonths.length - 1]); // Default ke bulan terbaru
        }
        
        setLoading(false);
      } catch (err) {
        console.error('Error fetching class year data:', err);
        setLoading(false);
      }
    };
    
    fetchClassData();
  }, [selectedYear, teacher]);

  // Fetch data detail siswa untuk drill-down modal
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
        console.error('Error fetching student detail records:', err);
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
          <p style={{ color: '#94a3b8' }}>Memuat Dashboard Wali Kelas...</p>
        </div>
      </div>
    );
  }

  // Filter data untuk bulan yang dipilih
  const monthlyData = classData.filter(r => r.bulan === selectedMonth);

  // Perhitungan Statistik
  const totalStudents = monthlyData.length;
  
  // Hitung rata-rata kelas per mapel
  const avgBIndo = totalStudents > 0 
    ? (monthlyData.reduce((acc, c) => acc + Number(c.rata_b_indo || 0), 0) / totalStudents).toFixed(1)
    : '0';
  const avgMtk = totalStudents > 0 
    ? (monthlyData.reduce((acc, c) => acc + Number(c.rata_mtk || 0), 0) / totalStudents).toFixed(1)
    : '0';
  const avgIpa = totalStudents > 0 
    ? (monthlyData.reduce((acc, c) => acc + Number(c.rata_ipa || 0), 0) / totalStudents).toFixed(1)
    : '0';

  // Hitung persentase ketuntasan (nilai >= target)
  const countTuntasBIndo = monthlyData.filter(r => Number(r.rata_b_indo || 0) >= 90).length;
  const countTuntasMtk = monthlyData.filter(r => Number(r.rata_mtk || 0) >= 90).length;
  const countTuntasIpa = monthlyData.filter(r => Number(r.rata_ipa || 0) >= 90).length;

  const pctTuntasBIndo = totalStudents > 0 ? ((countTuntasBIndo / totalStudents) * 100).toFixed(0) : 0;
  const pctTuntasMtk = totalStudents > 0 ? ((countTuntasMtk / totalStudents) * 100).toFixed(0) : 0;
  const pctTuntasIpa = totalStudents > 0 ? ((countTuntasIpa / totalStudents) * 100).toFixed(0) : 0;

  // Qur'an Ketuntasan (capaian >= target)
  const countTuntasTahfidz = monthlyData.filter(r => Number(r.capaian_tahfidz || 0) >= Number(r.target_tahfidz || 30)).length;
  const countTuntasTahsin = monthlyData.filter(r => Number(r.capaian_tahsin || 0) >= Number(r.target_tahsin || 16)).length;
  const pctTuntasTahfidz = totalStudents > 0 ? ((countTuntasTahfidz / totalStudents) * 100).toFixed(0) : 0;
  const pctTuntasTahsin = totalStudents > 0 ? ((countTuntasTahsin / totalStudents) * 100).toFixed(0) : 0;

  // Analisis Early Warning (Peringatan Dini)
  const warnings = [];
  monthlyData.forEach(student => {
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
        academicIssues,
        isTahfidzWarning,
        isTahsinWarning,
        details: student
      });
    }
  });

  // Urutkan siswa berdasarkan nama untuk tabel & grafik
  const sortedMonthlyData = [...monthlyData].sort((a, b) => a.nama_siswa.localeCompare(b.nama_siswa));

  // Kustomisasi Tooltip Recharts Qur'an
  const QuranTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const isTahfidz = payload[0].name.toLowerCase().includes('tahfidz');
      const capaian = isTahfidz ? data.capaian_tahfidz : data.capaian_tahsin;
      const target = isTahfidz ? data.target_tahfidz : data.target_tahsin;
      const typeStr = isTahfidz ? 'tahfidz' : 'tahsin';
      
      return (
        <div style={{ backgroundColor: '#1c2541', border: '1px solid rgba(255, 255, 255, 0.15)', padding: '12px', borderRadius: '8px' }}>
          <p style={{ fontWeight: '600', color: '#f8fafc', marginBottom: '4px' }}>{data.nama_siswa}</p>
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

  // Persiapan data grafik tren detail siswa (drill-down)
  const detailChartData = studentDetailedRecords
    .filter(r => r.tahun_ajaran === selectedYear)
    .sort((a, b) => MONTH_ORDER.indexOf(a.bulan) - MONTH_ORDER.indexOf(b.bulan));

  return (
    <div className="dashboard-container">
      {/* HEADER DASHBOARD */}
      <header className="dashboard-header">
        <div>
          <span className="badge badge-success" style={{ marginBottom: '8px', backgroundColor: 'rgba(0, 180, 216, 0.15)', color: '#00b4d8', borderColor: 'rgba(0, 180, 216, 0.3)' }}>Portal Wali Kelas</span>
          <h1 style={{ fontSize: '2rem' }}>Kelas {teacher?.kelas}</h1>
          <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginTop: '4px' }}>Wali Kelas: {teacher?.nama}</p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
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

      {/* METRIK KELAS SUMMARY CARDS */}
      <div className="grid-cols-3">
        {/* Total Siswa */}
        <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ backgroundColor: 'rgba(0, 180, 216, 0.1)', color: '#00b4d8', padding: '16px', borderRadius: '12px' }}>
            <Users size={32} />
          </div>
          <div>
            <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>TOTAL SISWA AKTIF</span>
            <h2 style={{ fontSize: '2rem', fontWeight: '800', marginTop: '4px' }}>{totalStudents}</h2>
          </div>
        </div>

        {/* Nilai Rata-rata Kelas */}
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

      {/* GAUGE PERSENTASE KETUNTASAN */}
      <div className="glass-card" style={{ marginBottom: '32px' }}>
        <h3 style={{ fontSize: '1.1rem', marginBottom: '24px', color: '#f8fafc' }}>Tingkat Ketuntasan Belajar Kelas (% Siswa Tuntas)</h3>
        <div className="gauge-container">
          <div className="gauge-item">
            <div className="gauge-circle" style={{ '--percentage': `${pctTuntasBIndo * 3.6}deg`, '--accent-color': '#00b4d8' }}>
              <span className="gauge-value">{pctTuntasBIndo}%</span>
            </div>
            <span style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: '500' }}>B. Indonesia</span>
          </div>

          <div className="gauge-item">
            <div className="gauge-circle" style={{ '--percentage': `${pctTuntasMtk * 3.6}deg`, '--accent-color': '#00f5d4' }}>
              <span className="gauge-value">{pctTuntasMtk}%</span>
            </div>
            <span style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: '500' }}>Matematika</span>
          </div>

          <div className="gauge-item">
            <div className="gauge-circle" style={{ '--percentage': `${pctTuntasIpa * 3.6}deg`, '--accent-color': '#10b981' }}>
              <span className="gauge-value">{pctTuntasIpa}%</span>
            </div>
            <span style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: '500' }}>IPA</span>
          </div>

          <div className="gauge-item">
            <div className="gauge-circle" style={{ '--percentage': `${pctTuntasTahfidz * 3.6}deg`, '--accent-color': '#f59e0b' }}>
              <span className="gauge-value">{pctTuntasTahfidz}%</span>
            </div>
            <span style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: '500' }}>Tahfidz Qur'an</span>
          </div>

          <div className="gauge-item">
            <div className="gauge-circle" style={{ '--percentage': `${pctTuntasTahsin * 3.6}deg`, '--accent-color': '#a855f7' }}>
              <span className="gauge-value">{pctTuntasTahsin}%</span>
            </div>
            <span style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: '500' }}>Tahsin Qur'an</span>
          </div>
        </div>
      </div>

      {/* EARLY WARNING SYSTEM PANEL */}
      <div className="glass-card" style={{ marginBottom: '32px', borderLeft: '4px solid var(--danger)' }}>
        <h3 style={{ fontSize: '1.1rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', color: '#ef4444' }}>
          <AlertTriangle size={20} /> Sistem Peringatan Dini (Siswa Perlu Pendampingan Khusus)
        </h3>
        {warnings.length === 0 ? (
          <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Seluruh siswa telah mencapai target bulan ini. Pertahankan!</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
            {warnings.map(w => (
              <div key={w.nis} style={{ background: 'rgba(239, 68, 68, 0.03)', border: '1px solid rgba(239, 68, 68, 0.15)', borderRadius: '10px', padding: '14px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <strong style={{ fontSize: '0.95rem', color: '#f8fafc' }}>{w.nama}</strong>
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

      {/* COMPARISON CHARTS */}
      <div className="grid-cols-2">
        {/* Akademik Comparison Chart */}
        <div className="glass-card">
          <h3 style={{ fontSize: '1.1rem', marginBottom: '20px' }}>Grafik Hasil Belajar Akademik Kelas</h3>
          <div style={{ width: '100%', height: 320 }}>
            <ResponsiveContainer>
              <LineChart data={sortedMonthlyData} margin={{ top: 10, right: 30, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="nama_siswa" stroke="#94a3b8" tick={{ fontSize: 10, angle: -30, textAnchor: 'end' }} />
                <YAxis domain={[60, 100]} stroke="#94a3b8" />
                <Tooltip contentStyle={{ backgroundColor: '#1c2541', border: '1px solid rgba(255,255,255,0.1)' }} />
                <Legend />
                <ReferenceLine y={90} stroke="#ef4444" strokeDasharray="5 5" label={{ value: 'Target 90', fill: '#ef4444', position: 'insideTopLeft' }} />
                <Line type="monotone" dataKey="rata_mtk" name="Matematika" stroke="#00b4d8" strokeWidth={2} />
                <Line type="monotone" dataKey="rata_ipa" name="IPA" stroke="#00f5d4" strokeWidth={2} />
                <Line type="monotone" dataKey="rata_b_indo" name="B. Indonesia" stroke="#10b981" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Tahfidz & Tahsin Comparison */}
        <div className="glass-card">
          <h3 style={{ fontSize: '1.1rem', marginBottom: '20px' }}>Grafik Capaian Tahfidz Siswa</h3>
          <div style={{ width: '100%', height: 320 }}>
            <ResponsiveContainer>
              <BarChart data={sortedMonthlyData} margin={{ top: 10, right: 30, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="nama_siswa" stroke="#94a3b8" tick={{ fontSize: 10, angle: -30, textAnchor: 'end' }} />
                <YAxis domain={[0, 50]} stroke="#94a3b8" />
                <Tooltip content={<QuranTooltip />} />
                <Legend />
                <Bar dataKey="capaian_tahfidz" name="Capaian Tahfidz" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                <Bar dataKey="target_tahfidz" name="Target Kelas" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* STUDENT DIRECTORY TABLE */}
      <div className="glass-card" style={{ marginTop: '24px' }}>
        <h3 style={{ fontSize: '1.2rem', marginBottom: '20px' }}>Daftar Perkembangan Siswa</h3>
        <div className="table-wrapper">
          <table className="premium-table">
            <thead>
              <tr>
                <th>No</th>
                <th>Nama Siswa</th>
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
              {sortedMonthlyData.map((student, idx) => {
                const isWarning = warnings.some(w => w.nis === student.nis);
                
                return (
                  <tr key={student.nis} style={isWarning ? { backgroundColor: 'rgba(239, 68, 68, 0.02)' } : undefined}>
                    <td>{idx + 1}</td>
                    <td>
                      <strong style={{ color: '#f8fafc' }}>{student.nama_lengkap}</strong>
                      {isWarning && (
                        <span className="badge badge-danger" style={{ fontSize: '0.65rem', padding: '2px 6px', marginLeft: '8px' }}>
                          Perhatian
                        </span>
                      )}
                    </td>
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
                        Detail
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* DRILL-DOWN MODAL OVERLAY */}
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
                <span className="badge badge-success" style={{ marginBottom: '6px' }}>Drill-down Siswa</span>
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
