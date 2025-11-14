// src/pages/Admin/Dashboard/Dashboard.tsx

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import styles from './Dashboard.module.css';

// --- Datepicker Importları ---
import DatePicker, { registerLocale } from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { tr } from 'date-fns/locale/tr';
// --- Importlar Sonu ---

import { 
  Users, 
  BarChart3, 
  Activity, 
  DollarSign, 
  Loader2,
  Users2,
  CheckCheck,
  Settings,
  UserCheck,
  CreditCard,
  Calendar
} from 'lucide-react';
// YENİ: getCoachScheduleForWeek import edildi
import { 
  getDashboardStats, 
  getAllCoaches,
  getCoachScheduleForWeek 
} from '../../../firebase/firestoreService';
// === GÜNCELLEME: Haftalık özet tipi import edildi ===
import type { DailyScheduleSummary } from '../../../firebase/firestoreService';


// --- Datepicker'ı Türkçeye çevir ---
registerLocale('tr', tr);
// --- BİTTİ ---

interface CoachBasicInfo {
  id: string;
  username: string;
}

interface DashboardStats {
  companyCut: number;
  members: number;
  coaches: number;
  approvals: number;
  activeCoaches: number;
  pendingPayments: number;
}

// Başlangıç tarihini 00:00:00'a ayarla
const getStartOfDay = (date: Date): Date => {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
};

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats>({
    companyCut: 0,
    members: 0,
    coaches: 0,
    approvals: 0,
    activeCoaches: 0,
    pendingPayments: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtre State'leri
  const [activePreset, setActivePreset] = useState<'30days' | '7days' | 'month' | 'custom'>('30days');
  const [startDate, setStartDate] = useState(() => {
    const today = new Date();
    today.setDate(today.getDate() - 29); 
    return getStartOfDay(today);
  });
  const [endDate, setEndDate] = useState(new Date()); 
  
  // Koç Filtresi State'leri
  const [coachesList, setCoachesList] = useState<CoachBasicInfo[]>([]);
  const [selectedCoach, setSelectedCoach] = useState<string>(''); // "" = Tüm Koçlar
  const [loadingCoaches, setLoadingCoaches] = useState(true);

  // === GÜNCELLEME: Haftalık Program State'i ===
  const [weekSchedule, setWeekSchedule] = useState<DailyScheduleSummary[]>([]);
  const [loadingSchedule, setLoadingSchedule] = useState(false);
  // =====================================

  // Dinamik Arayüz için Değişkenler
  const isCoachSelected = selectedCoach !== '';
  const selectedCoachUsername = 
    coachesList.find(c => c.id === selectedCoach)?.username || '';
  
  // Koç listesini çek
  useEffect(() => {
    const fetchCoaches = async () => {
      try {
        setLoadingCoaches(true);
        const coaches = await getAllCoaches();
        setCoachesList(coaches);
      } catch (err) {
        console.error("Koç listesi yüklenemedi", err);
        setError("Koç listesi yüklenemedi.");
      } finally {
        setLoadingCoaches(false);
      }
    };
    fetchCoaches();
  }, []); 

  // Ana useEffect (İstatistikleri VE Haftalık Programı çek)
  useEffect(() => {
    const fetchAllData = async () => {
      setLoading(true);
      setLoadingSchedule(true);
      setError(null);
      
      if (!startDate || !endDate || startDate > endDate) {
        setError("Geçersiz tarih aralığı.");
        setLoading(false);
        setLoadingSchedule(false);
        return;
      }
      
      const coachIdToFilter = selectedCoach || null;
      
      // 1. İstatistikleri çekmek için Promise
      const statsPromise = getDashboardStats(startDate, endDate, coachIdToFilter);
      
      // 2. Haftalık programı çekmek için Promise (sadece koç seçiliyse)
      const schedulePromise = coachIdToFilter 
        ? getCoachScheduleForWeek(coachIdToFilter, new Date())
        : Promise.resolve([]); // Koç seçili değilse boş dizi dön

      try {
        // Her iki işlemi paralel olarak çalıştır
        const [statsData, scheduleData] = await Promise.all([
          statsPromise, 
          schedulePromise
        ]);
        
        setStats(statsData);
        setWeekSchedule(scheduleData);
        
      } catch (err) {
        console.error(err);
        setError('Dashboard verileri yüklenemedi.');
      } finally {
        setLoading(false);
        setLoadingSchedule(false);
      }
    };
    
    if (!loadingCoaches) {
      fetchAllData();
    }
  }, [startDate, endDate, selectedCoach, loadingCoaches]); // Ana tetikleyiciler
  
  // Hızlı filtre butonları
  const handleDatePreset = (preset: '7days' | '30days' | 'month') => {
    setActivePreset(preset);
    const today = new Date();
    let newStartDate = new Date();
    
    if (preset === '7days') {
      newStartDate.setDate(today.getDate() - 6); 
    } else if (preset === '30days') {
      newStartDate.setDate(today.getDate() - 29);
    } else if (preset === 'month') {
      newStartDate = new Date(today.getFullYear(), today.getMonth(), 1); 
    }
    
    setStartDate(getStartOfDay(newStartDate));
    setEndDate(new Date()); 
  };

  const LoadingSpinner: React.FC = () => (
    <Loader2 size={24} className={styles.spinner} />
  );

  return (
    <>
      <div className={styles.dashboard}>

        {error && (
          <div className={styles.errorBox}>
            {error}
          </div>
        )}

        {/* TARİH FİLTRESİ BÖLÜMÜ */}
        <div className={styles.section} style={{marginTop: 0}}>
          <h2 className={styles.sectionTitle}>
            {isCoachSelected ? `Filtre: ${selectedCoachUsername}` : 'Filtreler'}
          </h2>
          <div className={styles.filterContainer}>
            
            <div className={styles.presetButtonContainer}>
              <button 
                className={`${styles.presetButton} ${activePreset === '7days' ? styles.active : ''}`}
                onClick={() => handleDatePreset('7days')}
                disabled={loading}
              >
                Son 7 Gün
              </button>
              <button 
                className={`${styles.presetButton} ${activePreset === '30days' ? styles.active : ''}`}
                onClick={() => handleDatePreset('30days')}
                disabled={loading}
              >
                Son 30 Gün
              </button>
              <button 
                className={`${styles.presetButton} ${activePreset === 'month' ? styles.active : ''}`}
                onClick={() => handleDatePreset('month')}
                disabled={loading}
              >
                Bu Ay
              </button>
            </div>
            
            <div className={styles.filterInputs}>
              
              {/* Başlangıç Tarihi (react-datepicker) */}
              <div className={styles.filterGroup}>
                <label htmlFor="startDate">Başlangıç Tarihi</label>
                <div className={styles.dateInputWrapper}>
                  <Calendar size={16} className={styles.dateInputIcon} />
                  <DatePicker
                    id="startDate"
                    selected={startDate}
                    onChange={(date: Date | null) => {
                      setStartDate(date ? getStartOfDay(date) : null);
                      setActivePreset('custom'); 
                    }}
                    selectsStart
                    startDate={startDate}
                    endDate={endDate}
                    locale="tr" 
                    dateFormat="dd.MM.yyyy" 
                    className={styles.dateInput} 
                    disabled={loading}
                    autoComplete="off"
                  />
                </div>
              </div>

              {/* Bitiş Tarihi (react-datepicker) */}
              <div className={styles.filterGroup}>
                <label htmlFor="endDate">Bitiş Tarihi</label>
                <div className={styles.dateInputWrapper}>
                  <Calendar size={16} className={styles.dateInputIcon} />
                  <DatePicker
                    id="endDate"
                    selected={endDate}
                    onChange={(date: Date | null) => {
                      setEndDate(date ? getStartOfDay(date) : null);
                      setActivePreset('custom');
                    }}
                    selectsEnd
                    startDate={startDate}
                    endDate={endDate}
                    minDate={startDate} 
                    locale="tr"
                    dateFormat="dd.MM.yyyy"
                    className={styles.dateInput}
                    disabled={loading}
                    autoComplete="off"
                  />
                </div>
              </div>
              
              {/* Koç Filtresi */}
              <div className={styles.filterGroup}>
                <label htmlFor="coachFilter">Koç Filtresi</label>
                <div className={styles.selectInputWrapper}>
                  <Users size={16} className={styles.selectInputIcon} />
                  <select 
                    id="coachFilter"
                    className={styles.selectInput}
                    value={selectedCoach}
                    onChange={(e) => setSelectedCoach(e.target.value)}
                    disabled={loading || loadingCoaches}
                  >
                    <option value="">Tüm Koçlar</option>
                    {coachesList.map(coach => (
                      <option key={coach.id} value={coach.id}>
                        {coach.username}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              
            </div>
            
          </div>
        </div>
        
        {/* 1. İSTATİSTİK KARTLARI (Dinamik Etiketli) */}
        <div className={styles.statsGrid}>
          
          <div className={styles.heroCard}>
            <div className={styles.heroIconWrapper}>
              <DollarSign size={28} className={styles.heroIcon} />
            </div>
            <div className={styles.heroText}>
              <span className={styles.heroLabel}>
                {isCoachSelected ? `${selectedCoachUsername} Kazancı (Filtreli)` : 'Toplam Şirket Kazancı (Filtreli)'}
              </span>
              <span className={styles.heroValue}>
                {loading ? <LoadingSpinner /> : `₺${stats.companyCut.toLocaleString('tr-TR')}`}
              </span>
            </div>
          </div>

          <div className={styles.secondaryGrid}>
            <div className={styles.statCard}>
              <div className={styles.cardHeader}>
                <div className={styles.iconWrapper}>
                  <Users size={18} className={styles.cardIcon} />
                </div>
              </div>
              <span className={styles.cardLabel}>
                {isCoachSelected ? 'Koçun Üyeleri' : 'Toplam Üye (Tümü)'}
              </span>
              <span className={styles.cardValue}>
                {loading ? <LoadingSpinner /> : stats.members}
              </span>
            </div>

            <div className={`${styles.statCard} ${!loading && stats.approvals > 0 ? styles.glowingCard : ''}`}>
              <div className={styles.cardHeader}>
                <div className={styles.iconWrapper}>
                  <Activity size={18} className={styles.cardIcon} />
                </div>
              </div>
              <span className={styles.cardLabel}>Onaylar (Filtreli)</span>
              <span className={styles.cardValue}>
                {loading ? <LoadingSpinner /> : stats.approvals}
              </span>
            </div>
            
            <div className={styles.statCard}>
              <div className={styles.cardHeader}> 
                <div className={styles.iconWrapper} style={{backgroundColor: 'rgba(239, 68, 68, 0.1)', borderColor: '#8c2b2b'}}>
                  <CreditCard size={18} className={styles.cardIcon} style={{color: '#ef4444'}} />
                </div>
              </div>
              <span className={styles.cardLabel}>Ödeme Bekleyenler (Filtreli)</span>
              <span className={styles.cardValue}>
                {loading ? <LoadingSpinner /> : stats.pendingPayments}
              </span>
            </div>
          </div>
          
        </div>

        {/* 2. PLATFORMA GENEL BAKIŞ / HAFTALIK PROGRAM */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>
            {isCoachSelected ? `${selectedCoachUsername} - Bu Hafta Programı` : 'Platforma Genel Bakış'}
          </h2>

          {isCoachSelected ? (
            // --- Koç Seçiliyken: Haftalık Program Özeti (GÜNCELLENDİ) ---
            <div className={styles.scheduleSummaryContainer}>
              {loadingSchedule ? (
                <div style={{display: 'flex', justifyContent: 'center', padding: '2rem', gridColumn: '1 / -1'}}>
                  <Loader2 size={24} className={styles.spinner} /> 
                </div>
              ) : (
                weekSchedule.map(day => (
                  <div 
                    key={day.dayName} 
                    className={`${styles.scheduleDay} ${day.isToday ? styles.scheduleToday : ''}`}
                  >
                    <div className={styles.scheduleDayHeader}>
                      <span className={styles.scheduleDayName}>{day.dayName}</span>
                      <span className={styles.scheduleDayNumber}>{day.dayNumber}</span>
                    </div>
                    
                    {/* YENİ: Randevu Saatleri Listesi */}
                    <div className={styles.appointmentList}>
                      {day.appointments.length > 0 ? (
                        day.appointments.map(app => (
                          <div key={app.time} className={styles.appointmentEntry}>
                            <span className={styles.appointmentTime}>{app.time}</span>
                            <span className={styles.appointmentMember}>{app.memberName}</span>
                          </div>
                        ))
                      ) : (
                        <span className={styles.noAppointments}>Boş</span>
                      )}
                    </div>
                    {/* BİTTİ */}
                    
                  </div>
                ))
              )}
            </div>
            
          ) : (
            
            // --- "Tüm Koçlar" Seçiliyken: Platform Geneli Kartlar ---
            <div className={styles.overviewGrid}>
              
              <div className={styles.overviewCard}>
                <div className={styles.overviewIconWrapper}>
                  <BarChart3 size={20} />
                </div>
                <div className={styles.overviewText}>
                  <span className={styles.overviewLabel}>Toplam Koç (Tümü)</span>
                  <span className={styles.overviewValue}>
                    {loading ? <LoadingSpinner /> : stats.coaches}
                  </span>
                </div>
              </div>

              <div className={styles.overviewCard}>
                <div className={styles.overviewIconWrapper}>
                  <UserCheck size={20} />
                </div>
                <div className={styles.overviewText}>
                  <span className={styles.overviewLabel}>Aktif Koç Oranı (Anlık)</span>
                  <span className={styles.overviewValue}>
                    {loading ? <LoadingSpinner /> : (
                      <>
                        {stats.activeCoaches}
                        <span className={styles.overviewTotal}> / {stats.coaches}</span>
                      </>
                    )}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>


        {/* 3. YÖNETİM PANELİ (Değişiklik yok) */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Yönetim Paneli</h2>
          <div className={styles.quickActionsGrid}>
            <Link to="/admin/coaches" className={styles.actionCard}>
              <div className={styles.actionIconWrapper}>
                <Users2 size={24} />
              </div>
              <div className={styles.actionText}>
                <strong>Koçları Yönet</strong>
                <span>Yeni koç ekle, mevcut koçları ve üyelerini görüntüle.</span>
              </div>
            </Link>
            <Link to="/admin/approvals" className={styles.actionCard}>
              <div className={styles.actionIconWrapper}>
                <CheckCheck size={24} />
              </div>
              <div className={styles.actionText}>
                <strong>Onay Merkezi</strong>
                <span>Yeni üye ve paket onaylarını tek yerden yönet.</span>
              </div>
            </Link>
            <Link to="/admin/settings" className={styles.actionCard}>
              <div className={styles.actionIconWrapper}>
                <Settings size={24} />
              </div>
              <div className={styles.actionText}>
                <strong>Ayarlar</strong>
                <span>Uygulama ayarlarını ve API kullanımını yönet.</span>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </>
  );
};

export default Dashboard;