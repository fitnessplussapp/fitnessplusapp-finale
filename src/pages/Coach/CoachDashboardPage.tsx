// src/pages/Coach/CoachDashboardPage.tsx

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebase/firebaseConfig';
import { collection, getDocs, Timestamp } from 'firebase/firestore';

// İkonlar ve Stiller
import { Calendar as CalendarIcon, Users, ArrowRight } from 'lucide-react';
import styles from '../Admin/Dashboard/Dashboard.module.css'; // Admin stil dosyasını kullanıyoruz
import DatePicker, { registerLocale } from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { tr } from 'date-fns/locale/tr';

// Bileşenler
import CoachPeriodStats from './components/CoachPeriodStats'; // Önceki adımda oluşturduğumuz
import CoachSelfSchedule from './components/CoachSelfSchedule'; // Önceki adımda oluşturduğumuz

registerLocale('tr', tr);

// --- TİPLER ---
interface CoachShare { value: number; type: 'TL' | '%'; }
interface CoachStats {
  activeMembers: number;
  pendingApprovals: number;
  totalGrossEarnings: number;
  totalNetEarnings: number;
}
interface MemberData {
  id: string;
  name: string;
  packageEndDate: Date | null; 
  isExpired: boolean;
  currentSessionCount: number;
}

// --- YARDIMCI HESAPLAMALAR ---
const calculateFinancials = (price: number, coachShare: CoachShare | null, sessionCount: number) => {
  let companyCut = 0;
  let coachCut = price;
  if (coachShare && coachShare.value > 0) {
    const shareValue = coachShare.value;
    if (coachShare.type === 'TL') {
      companyCut = shareValue * sessionCount; 
      coachCut = Math.max(0, price - companyCut);
    } else {
      companyCut = price * (shareValue / 100); 
      coachCut = price - companyCut;
    }
  }
  return { companyCut, coachCut };
};

const calculatePackageStatus = (endDate: Date | null) => {
  if (!endDate) return { isExpired: true };
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endDateStart = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
  return { isExpired: endDateStart < todayStart };
};

const CoachDashboardPage: React.FC = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  // STATE
  const [dateRange, setDateRange] = useState<{start: Date, end: Date}>(() => {
    const start = new Date();
    start.setDate(1); // Ayın başı
    return { start, end: new Date() };
  });

  const [stats, setStats] = useState<CoachStats>({
    activeMembers: 0, pendingApprovals: 0, totalGrossEarnings: 0, totalNetEarnings: 0
  });
  
  const [membersToContact, setMembersToContact] = useState<MemberData[]>([]);
  const [loading, setLoading] = useState(true);

  // --- VERİ ÇEKME ---
  const fetchCoachData = useCallback(async (coachId: string) => {
    try {
      const membersRef = collection(db, 'coaches', coachId, 'members');
      const membersSnap = await getDocs(membersRef);

      let activeMembersCount = 0;
      let pendingApprovalsCount = 0;
      let totalGross = 0; 
      let totalNet = 0;
      const contactList: MemberData[] = [];

      for (const memberDoc of membersSnap.docs) {
        const mData = memberDoc.data();
        const endDate = mData.packageEndDate instanceof Timestamp ? mData.packageEndDate.toDate() : null;
        const status = calculatePackageStatus(endDate);
        
        if (!status.isExpired) activeMembersCount++;
        
        // İletişim listesi kontrolü (Süresi dolmuş veya seansı bitmiş)
        if (status.isExpired || (mData.currentSessionCount || 0) <= 0) {
            contactList.push({
                id: memberDoc.id,
                name: mData.name || 'İsimsiz',
                packageEndDate: endDate,
                isExpired: status.isExpired,
                currentSessionCount: mData.currentSessionCount || 0
            });
        }

        // Paket Finansalları
        const packagesRef = collection(memberDoc.ref, 'packages');
        const packagesSnap = await getDocs(packagesRef);
        for (const pkgDoc of packagesSnap.docs) {
            const pkg = pkgDoc.data();
            if (pkg.approvalStatus === 'Pending') pendingApprovalsCount++;
            if (pkg.approvalStatus === 'Approved' && pkg.paymentStatus === 'Paid') {
                const { coachCut } = calculateFinancials(pkg.price || 0, pkg.share || null, pkg.sessionCount || 0);
                totalGross += (pkg.price || 0);
                totalNet += coachCut;
            }
        }
      }

      setStats({
        activeMembers: activeMembersCount,
        pendingApprovals: pendingApprovalsCount,
        totalGrossEarnings: totalGross,
        totalNetEarnings: totalNet
      });
      setMembersToContact(contactList);

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
      if(currentUser?.username) {
          fetchCoachData(currentUser.username);
      }
  }, [currentUser, fetchCoachData]);


  return (
    <div className={styles.dashboard}>
      
      {/* --- ÜST BAR (FİLTRELER) --- */}
      <div className={styles.topBar}>
        <div className={styles.filterGroup}>
            <div className={styles.filterItem}>
                 <span className={styles.inputLabel}>Dönem Aralığı</span>
                 <div className={styles.dateWrapper}>
                    <CalendarIcon size={16} color="#888" style={{marginRight:'8px'}}/>
                    <DatePicker 
                        selected={dateRange.start} 
                        onChange={(date) => date && setDateRange(prev => ({...prev, start: date}))} 
                        className={styles.dateInput} dateFormat="dd.MM.yyyy" locale="tr"
                    />
                    <span style={{color:'#666', margin:'0 4px'}}>-</span>
                    <DatePicker 
                        selected={dateRange.end} 
                        onChange={(date) => date && setDateRange(prev => ({...prev, end: date}))} 
                        className={styles.dateInput} dateFormat="dd.MM.yyyy" minDate={dateRange.start} locale="tr"
                    />
                 </div>
            </div>
        </div>
        
        {/* Üyeleri Yönet Butonu (Hızlı Erişim) */}
        <button className={styles.aiButton} onClick={() => navigate('/coach/members')}>
           <Users size={18} />
           <span>Üyeleri Yönet</span>
        </button>
      </div>

      {/* ============================================================ */}
      {/* 1. HAFTALIK PROGRAM (EN ÜSTTE)                               */}
      {/* ============================================================ */}
      {currentUser?.username && (
        <div style={{ marginBottom: '2rem' }}>
             <CoachSelfSchedule coachId={currentUser.username} />
        </div>
      )}

      {/* ============================================================ */}
      {/* 2. İSTATİSTİKLER (PROGRAMIN ALTINDA)                         */}
      {/* ============================================================ */}
      <CoachPeriodStats stats={stats} loading={loading} dateRange={dateRange} />


      {/* ============================================================ */}
      {/* 3. AKSİYON GEREKTİRENLER (EN ALTTA)                          */}
      {/* ============================================================ */}
      {membersToContact.length > 0 && (
          <div style={{marginTop: '2rem'}}>
             <div className={styles.sectionHeaderRow}>
                <div className={styles.pulseDot} style={{background: '#ef4444', boxShadow:'none', animation:'none'}}></div>
                <h3 style={{color:'#ef4444'}}>İlgi Bekleyen Üyeler ({membersToContact.length})</h3>
             </div>
             
             <div className={styles.statsGrid}>
                {membersToContact.slice(0, 4).map(m => (
                    <div key={m.id} className={`${styles.card} ${styles.clickable}`} onClick={() => navigate(`/coach/members/${m.id}`)}>
                        <div className={styles.cardHeader} style={{marginBottom:'0.5rem'}}>
                            <span style={{fontWeight:700, color:'#fff'}}>{m.name}</span>
                            <ArrowRight size={16} color="#666"/>
                        </div>
                        <div className={styles.cardBody}>
                            <span style={{fontSize:'0.9rem', color: m.isExpired ? '#ef4444' : '#f97316'}}>
                                {m.isExpired ? 'Süresi Doldu' : `${m.currentSessionCount} Seans Kaldı`}
                            </span>
                        </div>
                    </div>
                ))}
             </div>
          </div>
      )}

    </div>
  );
};

export default CoachDashboardPage;