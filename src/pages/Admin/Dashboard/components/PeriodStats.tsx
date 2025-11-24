// src/pages/Admin/Dashboard/components/PeriodStats.tsx

import React from 'react';
import { DollarSign, Activity, Users, TrendingUp, BarChart3, CreditCard, Wallet } from 'lucide-react';
import styles from '../Dashboard.module.css';
import type { DetailedStats } from '../../../../firebase/firestoreService';

interface PeriodStatsProps {
  stats: DetailedStats | null;
  loading: boolean;
  dateRange: { start: Date; end: Date };
}

const PeriodStats: React.FC<PeriodStatsProps> = ({ stats, loading, dateRange }) => {
  const fmt = (num: number) => `₺${num.toLocaleString('tr-TR', {maximumFractionDigits: 0})}`;

  // Burn Rate: Stok Eritme Hızı.
  const burnRate = stats ? (stats.financials.companyNet / (stats.financials.totalTurnover || 1)) * 100 : 0;

  return (
    <>
      <div className={styles.sectionHeaderRow}>
         <BarChart3 size={20} color="#888" />
         <h3>Dönem Performansı ({dateRange.start.toLocaleDateString()} - {dateRange.end.toLocaleDateString()})</h3>
      </div>

      <div className={styles.statsGrid}>
        
        {/* 1. KART: GERÇEKLEŞEN ŞİRKET GELİRİ (NET HAKEDİŞ) */}
        {/* DÜZELTME: Burası artık Kasa Girişi değil, verilen hizmetten şirkete kalan paydır */}
        <div className={`${styles.card} ${styles.highlightCard}`}>
          <div className={styles.cardHeader}>
             <div className={styles.iconBox} style={{background: 'rgba(16, 185, 129, 0.2)', color: '#10b981'}}>
                <DollarSign size={24} />
             </div>
             <div className={styles.trendBadge} style={{background:'#333', color:'#ccc'}}>Net Kazanç</div>
          </div>
          <div className={styles.cardBody}>
             <span className={styles.cardLabel}>Gerçekleşen Şirket Geliri</span>
             {/* stats.financials.companyNet: Backend'in seans bazlı hesapladığı şirket payı */}
             <span className={styles.cardValue} style={{color:'#10b981'}}>
                {loading ? "..." : fmt(stats?.financials.companyNet || 0)}
             </span>
             <span className={styles.cardSubtext}>Verilen hizmetlerden şirkete kalan % pay</span>
          </div>
        </div>

        {/* 2. KART: TOPLAM KASA GİRİŞİ (SATIŞ CİROSU) */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
             <div className={styles.iconBox} style={{background: 'rgba(168, 85, 247, 0.2)', color: '#a855f7'}}>
                <CreditCard size={24} />
             </div>
          </div>
          <div className={styles.cardBody}>
             <span className={styles.cardLabel}>Toplam Paket Girişi (Paket Satış)</span>
             <span className={styles.cardValue}>{loading ? "..." : fmt(stats?.financials.totalTurnover || 0)}</span>
             <span className={styles.cardSubtext}>Bu dönem satılan paket toplamı (Cash Flow)</span>
          </div>
        </div>

        {/* 3. AKTİF ÜYE SAYISI */}
        <div className={styles.card}>
           <div className={styles.cardHeader}>
             <div className={styles.iconBox} style={{background: 'rgba(59, 130, 246, 0.2)', color: '#3b82f6'}}>
                <Users size={24} />
             </div>
           </div>
           <div className={styles.cardBody}>
             <span className={styles.cardLabel}>Aktif Üye Sayısı</span>
             <span className={styles.cardValue}>{loading ? "..." : stats?.operations.activeMembersCount}</span>
             <span className={styles.cardSubtext}>Dönem içinde işlem gören üyeler</span>
           </div>
        </div>

        {/* 4. STOK ERİTME HIZI */}
        <div className={styles.card}>
           <div className={styles.cardHeader}>
             <div className={styles.iconBox} style={{background: 'rgba(255, 255, 255, 0.1)', color: '#fff'}}>
                <Activity size={24} />
             </div>
           </div>
           <div className={styles.cardBody}>
             <span className={styles.cardLabel}>Servis Karşılama Oranı</span>
             <span className={styles.cardValue}>{loading ? "..." : `%${burnRate.toFixed(1)}`}</span>
             <span className={styles.cardSubtext}>
                Satışların hizmete dönüşme oranı
             </span>
             <div className={styles.progressContainer}>
                 <div className={styles.progressBar} style={{width: `${Math.min(burnRate, 100)}%`, background: burnRate > 100 ? '#ef4444' : '#3b82f6'}}></div>
             </div>
           </div>
        </div>

      </div>

      {/* EN İYİ KOÇLAR TABLOSU */}
      {stats?.coachPerformance && stats.coachPerformance.length > 0 && (
         <div className={styles.card} style={{marginTop:'1rem', flexDirection:'column', height:'auto'}}>
            <h4 style={{margin:'0 0 1rem 0', color:'#fff'}}>Koç Bazlı Üretim (Hakediş Sıralaması)</h4>
            <div className={styles.tableContainer} style={{border:'none', borderRadius:0, overflowX:'auto'}}>
                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th>Sıra</th>
                            <th>Koç Adı</th>
                            <th>Ders Dağılımı</th>
                            <th style={{textAlign:'right'}}>Üretilen Değer</th>
                        </tr>
                    </thead>
                    <tbody>
                        {stats.coachPerformance
                            .sort((a,b) => b.generatedTurnover - a.generatedTurnover)
                            .slice(0, 5) // İlk 5 Koç
                            .map((coach, idx) => (
                            <tr key={coach.coachId}>
                                <td style={{width:'40px', textAlign:'center', fontWeight:'bold', color:'#666'}}>#{idx+1}</td>
                                <td style={{fontWeight:600, color:'#fff'}}>{coach.username}</td>
                                <td>{coach.ptCount} PT / {coach.groupCount} Grup</td>
                                <td style={{textAlign:'right', fontWeight:'bold', color: idx===0 ? '#eab308' : '#ccc'}}>
                                    {fmt(coach.generatedTurnover)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
         </div>
      )}
    </>
  );
};

export default PeriodStats;