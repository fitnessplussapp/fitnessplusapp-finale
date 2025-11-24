// src/pages/Coach/components/CoachSelfSchedule.tsx

import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar, Loader2, RefreshCw, BarChart2, Info } from 'lucide-react';
// CSS Modülünü Admin'den ödünç alıyoruz, aynı görünüm için:
import styles from '../../Admin/Dashboard/components/CoachWeeklySchedule.module.css';
import { getCoachScheduleForWeek } from '../../../firebase/firestoreService';
import type { DailyScheduleSummary } from '../../../firebase/firestoreService';

interface CoachSelfScheduleProps {
  coachId: string; // Giriş yapan koçun ID'si
}

const CoachSelfSchedule: React.FC<CoachSelfScheduleProps> = ({ coachId }) => {
  const [selectedWeekDate, setSelectedWeekDate] = useState(new Date());
  const [schedule, setSchedule] = useState<DailyScheduleSummary[]>([]);
  const [loading, setLoading] = useState(false);

  // Programı Yükle
  const fetchSchedule = async () => {
    if (!coachId) return;
    setLoading(true);
    try {
      const data = await getCoachScheduleForWeek(coachId, selectedWeekDate);
      setSchedule(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchedule();
  }, [coachId, selectedWeekDate]);

  // Özet Hesapla
  const getWeeklySummary = () => {
      let totalSessions = 0;
      let ptCount = 0;
      let groupCount = 0;
      schedule.forEach(day => {
          totalSessions += day.appointments.length;
          day.appointments.forEach(appt => {
              if (appt.type === 'personal') ptCount++;
              else groupCount++;
          });
      });
      return { totalSessions, ptCount, groupCount };
  };
  const summary = getWeeklySummary();

  const handlePrevWeek = () => {
    const d = new Date(selectedWeekDate);
    d.setDate(d.getDate() - 7);
    setSelectedWeekDate(d);
  };

  const handleNextWeek = () => {
    const d = new Date(selectedWeekDate);
    d.setDate(d.getDate() + 7);
    setSelectedWeekDate(d);
  };

  const getWeekRangeLabel = () => {
    const d = new Date(selectedWeekDate);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff));
    const sunday = new Date(new Date(monday).setDate(monday.getDate() + 6));
    
    return `${monday.getDate()} ${monday.toLocaleDateString('tr-TR', {month:'short'})} - ${sunday.getDate()} ${sunday.toLocaleDateString('tr-TR', {month:'short'})}`;
  };

  return (
    <div className={styles.container}>
      {/* HEADER */}
      <div className={styles.header}>
        <div className={styles.headerTitle}>
            <Calendar size={20} className={styles.icon} />
            <h3>Haftalık Ders Programım</h3>
        </div>
        
        <div className={styles.controls}>
             {/* Tarih Seçici */}
             <div className={styles.weekPicker}>
                <button className={styles.navBtn} onClick={handlePrevWeek}><ChevronLeft size={18}/></button>
                <span className={styles.weekLabel}>{getWeekRangeLabel()}</span>
                <button className={styles.navBtn} onClick={handleNextWeek}><ChevronRight size={18}/></button>
             </div>

             <button className={styles.refreshBtn} onClick={fetchSchedule} title="Yenile">
                <RefreshCw size={18} className={loading ? styles.spin : ''} />
             </button>
        </div>
      </div>

      {/* SUMMARY BAR */}
      <div className={styles.summaryBar}>
          <div className={styles.summaryItem}>
              <BarChart2 size={16} color="#eab308" />
              <span>Toplam: <strong>{summary.totalSessions}</strong></span>
          </div>
          <div className={styles.verticalSep}></div>
          <div className={styles.summaryItem}>
              <span className={styles.dotPT}></span>
              <span>PT: <strong>{summary.ptCount}</strong></span>
          </div>
          <div className={styles.summaryItem}>
              <span className={styles.dotGroup}></span>
              <span>Grup: <strong>{summary.groupCount}</strong></span>
          </div>
      </div>

      {/* CONTENT Grid */}
      <div className={styles.content}>
         {loading ? (
             <div className={styles.loadingState}>
                 <Loader2 size={40} className={styles.spin} style={{color: '#a855f7'}} />
                 <p>Programınız yükleniyor...</p>
             </div>
         ) : (
             <div className={styles.gridContainer}>
                 <div className={styles.grid}>
                     {schedule.map(day => (
                         <div key={day.dayName} className={`${styles.dayCol} ${day.isToday ? styles.today : ''}`}>
                             <div className={styles.dayHeader}>
                                 <span className={styles.dayName}>{day.dayName}</span>
                                 <span className={styles.dayNum}>{day.dayNumber}</span>
                             </div>
                             <div className={styles.dayBody}>
                                 {day.appointments.length === 0 ? (
                                     <span className={styles.noData}>-</span>
                                 ) : (
                                     day.appointments.map((appt, idx) => (
                                         <div 
                                            key={idx} 
                                            className={`${styles.card} ${appt.type === 'personal' ? styles.pt : styles.group}`}
                                         >
                                             <span className={styles.time}>{appt.time}</span>
                                             <span className={styles.title}>{appt.memberName}</span>
                                         </div>
                                     ))
                                 )}
                             </div>
                         </div>
                     ))}
                 </div>
             </div>
         )}
      </div>
    </div>
  );
};

export default CoachSelfSchedule;