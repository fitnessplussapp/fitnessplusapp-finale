// src/pages/Coach/components/CoachPeriodStats.tsx

import React from 'react';
import { DollarSign, Users, Wallet, AlertTriangle, BarChart3 } from 'lucide-react';
import styles from '../../Admin/Dashboard/Dashboard.module.css'; // Admin stillerini kullanıyoruz

interface CoachPeriodStatsProps {
  stats: {
    activeMembers: number;
    pendingApprovals: number;
    totalGrossEarnings: number;
    totalNetEarnings: number;
  };
  loading: boolean;
  dateRange: { start: Date; end: Date };
}

const CoachPeriodStats: React.FC<CoachPeriodStatsProps> = ({ stats, loading, dateRange }) => {
  const fmt = (num: number) => `₺${num.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  return (
    <>
      <div className={styles.sectionHeaderRow}>
         <BarChart3 size={20} color="#888" />
         <h3>Performans Özeti ({dateRange.start.toLocaleDateString()} - {dateRange.end.toLocaleDateString()})</h3>
      </div>

      <div className={styles.statsGrid}>
        
        {/* 1. NET KAZANÇ */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
             <div className={styles.iconBox} style={{background: 'rgba(16, 185, 129, 0.2)', color: '#10b981'}}>
                <Wallet size={24} />
             </div>
             <div className={styles.trendBadge} style={{background:'#333', color:'#ccc'}}>Hakediş</div>
          </div>
          <div className={styles.cardBody}>
             <span className={styles.cardLabel}>Toplam Net Kazancınız</span>
             <span className={styles.cardValue} style={{color: '#10b981'}}>
                {loading ? "..." : fmt(stats.totalNetEarnings)}
             </span>
             <span className={styles.cardSubtext}>Onaylanan paketlerden payınıza düşen</span>
          </div>
        </div>

        {/* 2. BRÜT ÜRETİM */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
             <div className={styles.iconBox} style={{background: 'rgba(168, 85, 247, 0.2)', color: '#a855f7'}}>
                <DollarSign size={24} />
             </div>
          </div>
          <div className={styles.cardBody}>
             <span className={styles.cardLabel}>Toplam Ciro (Brüt)</span>
             <span className={styles.cardValue}>
                {loading ? "..." : fmt(stats.totalGrossEarnings)}
             </span>
             <span className={styles.cardSubtext}>Satışını gerçekleştirdiğiniz paket değeri</span>
          </div>
        </div>

        {/* 3. AKTİF ÖĞRENCİ */}
        <div className={styles.card}>
           <div className={styles.cardHeader}>
             <div className={styles.iconBox} style={{background: 'rgba(59, 130, 246, 0.2)', color: '#3b82f6'}}>
                <Users size={24} />
             </div>
           </div>
           <div className={styles.cardBody}>
             <span className={styles.cardLabel}>Aktif Öğrenci Sayısı</span>
             <span className={styles.cardValue}>{loading ? "..." : stats.activeMembers}</span>
             <span className={styles.cardSubtext}>Paketi devam eden üyeler</span>
           </div>
        </div>

        {/* 4. ONAY BEKLEYEN */}
        <div className={styles.card} style={stats.pendingApprovals > 0 ? {borderColor: 'rgba(239, 68, 68, 0.5)'} : {}}>
           <div className={styles.cardHeader}>
             <div className={styles.iconBox} style={{background: 'rgba(249, 115, 22, 0.2)', color: '#f97316'}}>
                <AlertTriangle size={24} />
             </div>
             {stats.pendingApprovals > 0 && (
                <div className={`${styles.trendBadge} ${styles.trendDown}`}>İşlem Bekliyor</div>
             )}
           </div>
           <div className={styles.cardBody}>
             <span className={styles.cardLabel}>Onay Bekleyen Paket</span>
             <span className={styles.cardValue} style={{color: stats.pendingApprovals > 0 ? '#f97316' : '#fff'}}>
                {loading ? "..." : stats.pendingApprovals}
             </span>
             <span className={styles.cardSubtext}>
                {stats.pendingApprovals > 0 ? "Yönetici onayı bekleniyor" : "Tüm işlemler güncel"}
             </span>
           </div>
        </div>

      </div>
    </>
  );
};

export default CoachPeriodStats;