// src/pages/Admin/Dashboard/components/DailyPulse.tsx

import React, { useState } from 'react';
import { Zap, DollarSign, Wallet, ArrowUpRight, CheckCircle2 } from 'lucide-react';
import styles from '../Dashboard.module.css';
import Modal from '../../../../components/Modal/Modal';

interface DailyPulseProps {
  data: any; 
  loading: boolean;
}

const DailyPulse: React.FC<DailyPulseProps> = ({ data, loading }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const fmt = (num: number) => `₺${num.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  
  // İlerleme Hesabı
  let totalEvents = 0;
  let completedEvents = 0;
  
  if (data?.events) {
      const now = new Date();
      const currentHour = now.getHours();
      data.events.forEach((evt: any) => {
          totalEvents++;
          const evtHour = parseInt(evt.time.split(':')[0], 10);
          if (evtHour < currentHour) {
              completedEvents++;
          }
      });
  }
  
  const progressPercent = totalEvents > 0 ? Math.round((completedEvents / totalEvents) * 100) : 0;
  const remainingEvents = totalEvents - completedEvents;

  const openModal = () => {
      setIsModalOpen(true);
  };

  return (
    <>
      <div className={styles.sectionHeaderRow}>
         <div className={styles.pulseDot}></div>
         <h3>Bugünün Canlı Akışı</h3>
      </div>

      <div className={styles.statsGrid}>
        
        {/* 1. KART: TOPLAM HİZMET */}
        <div className={`${styles.card} ${styles.clickable} ${styles.highlightCard}`} onClick={openModal}>
          <div className={styles.cardHeader}>
             <div className={styles.iconBox} style={{background: 'rgba(234, 179, 8, 0.2)', color: '#eab308'}}>
                <Zap size={24} />
             </div>
             <div className={`${styles.trendBadge} ${styles.trendUp}`}>
                <ArrowUpRight size={14}/> Canlı İzleme
             </div>
          </div>
          <div className={styles.cardBody}>
             <span className={styles.cardLabel}>Toplam Hizmet Üretimi</span>
             <span className={styles.cardValue}>{loading ? "..." : fmt(data?.totalRevenue || 0)}</span>
             <span className={styles.cardSubtext}>Bugün verilen/verilecek tüm dersler</span>
          </div>
        </div>

        {/* 2. KART: ŞİRKET PAYI */}
        <div className={`${styles.card} ${styles.clickable}`} onClick={openModal}>
           <div className={styles.cardHeader}>
             <div className={styles.iconBox} style={{background: 'rgba(16, 185, 129, 0.2)', color: '#10b981'}}>
                <DollarSign size={24} />
             </div>
           </div>
           <div className={styles.cardBody}>
             <span className={styles.cardLabel}>Şirket Net (Gerçekleşen)</span>
             <span className={styles.cardValue} style={{color:'#10b981'}}>
                {loading ? "..." : fmt(data?.totalCompanyNet || 0)}
             </span>
             <span className={styles.cardSubtext}>Salonun net kazancı</span>
           </div>
        </div>

        {/* 3. KART: KOÇ ÖDEMELERİ */}
        <div className={`${styles.card} ${styles.clickable}`} onClick={openModal}>
           <div className={styles.cardHeader}>
             <div className={styles.iconBox} style={{background: 'rgba(249, 115, 22, 0.2)', color: '#f97316'}}>
                <Wallet size={24} />
             </div>
           </div>
           <div className={styles.cardBody}>
             <span className={styles.cardLabel}>Koç Hakedişleri</span>
             <span className={styles.cardValue} style={{color:'#f97316'}}>
                {loading ? "..." : fmt(data?.totalCoachNet || 0)}
             </span>
             <span className={styles.cardSubtext}>Bugün ödenecek prim tutarı</span>
           </div>
        </div>

        {/* 4. KART: GÜNLÜK İLERLEME */}
        <div className={`${styles.card} ${styles.clickable}`} onClick={openModal}>
           <div className={styles.cardHeader}>
             <div className={styles.iconBox} style={{background: 'rgba(59, 130, 246, 0.2)', color: '#3b82f6'}}>
                <CheckCircle2 size={24} />
             </div>
             <div className={`${styles.trendBadge} ${styles.trendNeutral}`}>
                {remainingEvents} Ders Kaldı
             </div>
           </div>
           <div className={styles.cardBody}>
             <span className={styles.cardLabel}>Günlük İlerleme</span>
             <div style={{display:'flex', alignItems:'baseline', gap:'0.5rem'}}>
                <span className={styles.cardValue} style={{fontSize:'1.6rem'}}>
                    {loading ? "..." : `${completedEvents}/${totalEvents}`}
                </span>
                <span style={{color:'#666', fontSize:'0.9rem'}}>Ders Tamamlandı</span>
             </div>
             <div className={styles.progressContainer}>
                <div className={styles.progressBar} style={{width: `${progressPercent}%`}}></div>
             </div>
           </div>
        </div>

      </div>

      {/* DETAY MODALI */}
      {/* ÖNEMLİ: size="large" prop'u eklendi */}
      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title="Canlı Akış & Finansal Detaylar"
        size="large" 
      >
         <div className={styles.tableContainer}> 
            <table className={styles.table}>
                <thead>
                    <tr>
                        <th style={{width:'80px'}}>Saat</th>
                        <th>Ders / Üye</th>
                        <th>Koç</th>
                        <th style={{textAlign:'right'}}>Birim Değer</th>
                        <th style={{textAlign:'right'}}>Şirket</th>
                        <th style={{textAlign:'right'}}>Koç</th>
                    </tr>
                </thead>
                <tbody>
                    {data?.events && data.events.length > 0 ? (
                        data.events.map((evt: any) => (
                            <tr key={evt.id}>
                                <td style={{color:'#fff', fontWeight:'bold', fontFamily:'monospace', fontSize:'1rem'}}>
                                    {evt.time}
                                </td>
                                <td>
                                    <div style={{display:'flex', flexDirection:'column', gap:'4px'}}>
                                        <span style={{color:'#fff', fontWeight:600, fontSize:'0.95rem'}}>{evt.title}</span>
                                        <div style={{display:'flex', gap:'6px', alignItems:'center'}}>
                                            <span className={evt.type === 'personal' ? styles.badgePT : styles.badgeGroup}>
                                                {evt.type === 'personal' ? 'PT' : 'GRP'}
                                            </span>
                                            <span style={{fontSize:'0.8rem', color:'#888'}}>
                                                {evt.packageName || 'Paket Yok'}
                                            </span>
                                        </div>
                                    </div>
                                </td>
                                <td style={{color:'#ccc'}}>{evt.coachName}</td>
                                
                                <td style={{textAlign:'right'}}>
                                    <div style={{display:'flex', flexDirection:'column', alignItems:'flex-end'}}>
                                        <span style={{color:'#fff', fontSize:'1rem', fontWeight:'600'}}>{fmt(evt.unitPrice)}</span>
                                    </div>
                                </td>
                                <td style={{textAlign:'right', color:'#10b981', fontWeight:'bold', fontSize:'0.95rem'}}>
                                    +{fmt(evt.companyCut)}
                                </td>
                                <td style={{textAlign:'right', color:'#f97316', fontWeight:'bold', fontSize:'0.95rem'}}>
                                    +{fmt(evt.coachCut)}
                                </td>
                            </tr>
                        ))
                    ) : (
                        <tr><td colSpan={6} style={{textAlign:'center', padding:'3rem', color:'#888'}}>Bugün için henüz kayıt bulunmuyor.</td></tr>
                    )}
                </tbody>
            </table>
         </div>
      </Modal>
    </>
  );
};

export default DailyPulse;