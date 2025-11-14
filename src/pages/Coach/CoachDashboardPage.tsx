// src/pages/Coach/CoachDashboardPage.tsx

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebase/firebaseConfig';
import { 
  doc, 
  collection, 
  query, 
  getDoc, 
  getDocs, 
  where,
  Timestamp 
} from 'firebase/firestore';

import { 
  Loader2, 
  Users, 
  CheckCheck, 
  DollarSign, 
  Plus, 
  Calendar, 
  ChevronRight,
  AlertTriangle,
  Wallet, // Net kazanç ikonu
  Hash // Seans ikonu
} from 'lucide-react';

// STİL DOSYALARI
import dashStyles from '../Admin/Dashboard/Dashboard.module.css';
import listStyles from '../Admin/CoachManagement/CoachManagement.module.css';
import formStyles from '../../components/Form/Form.module.css';

// === YENİ İMPORTLAR ===
import { getCoachScheduleForWeek } from '../../firebase/firestoreService';
import type { DailyScheduleSummary } from '../../firebase/firestoreService';
// ======================

// --- Veri Tipleri (GÜNCELLENDİ) ---
interface CoachShare {
  value: number;
  type: 'TL' | '%';
}
interface CoachStats {
  activeMembers: number;
  pendingApprovals: number;
  totalGrossEarnings: number; // Brüt Kazanç (Fiyat toplamı)
  totalNetEarnings: number;   // Net Kazanç (Koça kalan)
}
interface MemberData {
  id: string;
  name: string;
  packageStartDate: Date | null; 
  packageEndDate: Date | null; 
  isExpired: boolean;
  remainingDaysText: string;
  progressPercent: number;
  currentSessionCount: number; // YENİ: Seans sayısı
}
// ----------------------

// --- Yardımcı Fonksiyonlar (GÜNCELLENDİ) ---
const calculateFinancials = (
  price: number, 
  coachShare: CoachShare | null,
  sessionCount: number // YENİ
): {
  companyCut: number,
  coachCut: number,
} => {
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

// calculatePackageStatus (Değişiklik yok)
const calculatePackageStatus = (endDate: Date | null): { text: string; isExpired: boolean } => {
  if (!endDate) { 
    return { text: 'Paket Yok', isExpired: true };
  }
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endDateStart = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
  const diffTime = endDateStart.getTime() - todayStart.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  if (diffDays < 0) {
    return { text: 'Süresi Doldu', isExpired: true };
  }
  if (diffDays === 0) {
    return { text: 'Bugün Son Gün', isExpired: false };
  }
  return { text: `${diffDays} gün kaldı`, isExpired: false };
};

// calculateProgressPercentage (Değişiklik yok)
const calculateProgressPercentage = (startDate: Date | null, endDate: Date | null): number => {
  if (!startDate || !endDate) return 0;
  const now = new Date();
  const start = startDate.getTime();
  const end = endDate.getTime();
  const today = now.getTime();
  if (today < start) return 0;
  if (today >= end) return 100; 
  const totalDuration = end - start;
  const elapsedTime = today - start;
  if (totalDuration <= 0) return 100;
  const progress = (elapsedTime / totalDuration) * 100;
  return Math.min(100, Math.max(0, progress));
};
// ----------------------------------------------------


const CoachDashboardPage: React.FC = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate(); 

  const [stats, setStats] = useState<CoachStats>({
    activeMembers: 0,
    pendingApprovals: 0,
    totalGrossEarnings: 0,
    totalNetEarnings: 0,
  });
  const [members, setMembers] = useState<MemberData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // === YENİ: Haftalık Program State'leri ===
  const [weekSchedule, setWeekSchedule] = useState<DailyScheduleSummary[]>([]);
  const [loadingSchedule, setLoadingSchedule] = useState(true);
  // =====================================

  // === GÜNCELLEME: Veri Çekme Fonksiyonu (Paket bazlı kazanç + Seans Sayısı) ===
  const fetchCoachData = useCallback(async (coachId: string) => {
    // Bu fonksiyon artık Promise.all içinde kullanılacak, 
    // bu yüzden kendi loading state'ini yönetmemeli.
    
    try {
      // 1. Üyeleri al
      const membersRef = collection(db, 'coaches', coachId, 'members');
      const membersSnap = await getDocs(membersRef);

      let activeMembersCount = 0;
      let pendingApprovalsCount = 0;
      let calculatedTotalGross = 0; 
      let calculatedTotalNet = 0; 

      const processedMembers: MemberData[] = [];

      // 2. Her üye için paketleri tara
      for (const memberDoc of membersSnap.docs) {
        const memberData = memberDoc.data();
        
        const startDate = memberData.packageStartDate instanceof Timestamp 
          ? memberData.packageStartDate.toDate() : null;
        const endDate = memberData.packageEndDate instanceof Timestamp 
          ? memberData.packageEndDate.toDate() : null;
          
        const currentSessionCount = memberData.currentSessionCount || 0;

        // 2a. Aktif üye sayısını hesapla
        const status = calculatePackageStatus(endDate);
        if (!status.isExpired) {
          activeMembersCount++;
        }

        // 2b. Paketleri tara (Onay ve Kazanç için)
        const packagesRef = collection(memberDoc.ref, 'packages');
        const packagesSnap = await getDocs(packagesRef); 
        
        for (const pkgDoc of packagesSnap.docs) {
            const pkg = pkgDoc.data();
            
            if (pkg.approvalStatus === 'Pending') {
                pendingApprovalsCount++;
            }

            if (pkg.approvalStatus === 'Approved' && pkg.paymentStatus === 'Paid') {
                const pkgShare = (pkg.share || null) as CoachShare | null;
                const pkgSessions = pkg.sessionCount || 0;
                const pkgPrice = pkg.price || 0;

                const { coachCut } = calculateFinancials(pkgPrice, pkgShare, pkgSessions);
                
                calculatedTotalGross += pkgPrice; 
                calculatedTotalNet += coachCut; 
            }
        }

        // 2c. Üye listesi için veri hazırla
        processedMembers.push({
          id: memberDoc.id,
          name: memberData.name || "İsimsiz Üye",
          packageStartDate: startDate,
          packageEndDate: endDate,
          isExpired: status.isExpired,
          remainingDaysText: status.text,
          progressPercent: calculateProgressPercentage(startDate, endDate),
          currentSessionCount: currentSessionCount 
        });
      }

      // 3. Üyeleri sırala (İletişim listesi için)
      processedMembers.sort((a, b) => {
        const aNeedsContact = a.isExpired || a.currentSessionCount === 0;
        const bNeedsContact = b.isExpired || b.currentSessionCount === 0;

        if (aNeedsContact && !bNeedsContact) return -1;
        if (!aNeedsContact && bNeedsContact) return 1;
        
        if (!aNeedsContact && !bNeedsContact) {
           return (a.packageEndDate?.getTime() || 0) - (b.packageEndDate?.getTime() || 0);
        }
        
        return (b.packageEndDate?.getTime() || 0) - (a.packageEndDate?.getTime() || 0);
      });
      
      // 4. State'i güncelle (GÜNCELLEME: Artık state'leri return ediyoruz)
      const statsData: CoachStats = {
        activeMembers: activeMembersCount,
        pendingApprovals: pendingApprovalsCount,
        totalGrossEarnings: calculatedTotalGross,
        totalNetEarnings: calculatedTotalNet,
      };
      
      return { statsData, membersData: processedMembers };

    } catch (err: any) {
      console.error("Koç dashboard verisi çekilemedi:", err);
      // Hatayı fırlat ki Promise.all yakalasın
      throw new Error("Dashboard istatistikleri yüklenirken bir hata oluştu.");
    }
  }, []);
  // ----------------------------------------------------

  // === GÜNCELLEME: Ana Veri Çekme useEffect ===
  useEffect(() => {
    if (currentUser?.username) {
      const coachId = currentUser.username;
      setLoading(true);
      setLoadingSchedule(true);
      setError(null);

      // 1. İstatistikleri ve Üye Listesini çeken Promise
      const dataPromise = fetchCoachData(coachId);
      
      // 2. Haftalık Programı çeken Promise
      const schedulePromise = getCoachScheduleForWeek(coachId, new Date());

      // Hepsini paralel olarak çalıştır
      Promise.all([dataPromise, schedulePromise])
        .then(([dataResult, scheduleData]) => {
          setStats(dataResult.statsData);
          setMembers(dataResult.membersData);
          setWeekSchedule(scheduleData);
        })
        .catch((err) => {
          console.error("Koç dashboard verileri çekilemedi:", err);
          setError(err.message || "Veriler yüklenirken bir hata oluştu.");
        })
        .finally(() => {
          setLoading(false);
          setLoadingSchedule(false);
        });

    } else {
      setLoading(false);
      setError("Giriş yapan kullanıcı bilgisi alınamadı.");
    }
  }, [currentUser, fetchCoachData]);


  // === YENİ: "Major Update" için filtrelenmiş üye listesi ===
  const membersToContact = members.filter(m => m.isExpired || m.currentSessionCount <= 0);
  // ========================================================

  // Yükleme Göstergesi
  const LoadingSpinner: React.FC = () => (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '3rem', gap: '1rem', color: '#A0A0A0' }}>
      <Loader2 size={32} className={formStyles.spinner} />
      <span>Dashboard verileri yükleniyor...</span>
    </div>
  );
  
  // Sadece istatistikler için küçük spinner
  const SmallSpinner: React.FC = () => <Loader2 size={24} className={dashStyles.spinner} />;

  return (
    <>
      <div className={dashStyles.dashboard}>

        {error && (
          <div className={dashStyles.errorBox}>
            {error}
          </div>
        )}

        {/* 1. İSTATİSTİK KARTLARI (4'lü Grid) */}
        <div className={dashStyles.statsGrid}>
          <div className={dashStyles.secondaryGrid} style={{gridTemplateColumns: 'repeat(2, 1fr)'}}>
            
            <div className={dashStyles.statCard}>
              <div className={dashStyles.cardHeader}>
                <div className={dashStyles.iconWrapper}>
                  <Users size={18} className={dashStyles.cardIcon} />
                </div>
              </div>
              <span className={dashStyles.cardLabel}>Aktif Üyeler</span>
              <span className={dashStyles.cardValue}>
                {loading ? <SmallSpinner /> : stats.activeMembers}
              </span>
            </div>

            <div className={`${dashStyles.statCard} ${!loading && stats.pendingApprovals > 0 ? dashStyles.glowingCard : ''}`}>
              <div className={dashStyles.cardHeader}>
                <div className={dashStyles.iconWrapper}>
                  <AlertTriangle size={18} className={dashStyles.cardIcon} />
                </div>
              </div>
              <span className={dashStyles.cardLabel}>Onay Bekleyen</span>
              <span className={dashStyles.cardValue}>
                {loading ? <SmallSpinner /> : stats.pendingApprovals}
              </span>
            </div>

            <div className={dashStyles.statCard}>
              <div className={dashStyles.cardHeader}>
                <div className={dashStyles.iconWrapper}>
                  <DollarSign size={18} className={dashStyles.cardIcon} />
                </div>
              </div>
              <span className={dashStyles.cardLabel}>Toplam Brüt Kazanç</span>
              <span className={dashStyles.cardValue}>
                {loading ? <SmallSpinner /> : `₺${stats.totalGrossEarnings.toLocaleString('tr-TR')}`}
              </span>
            </div>
            
            <div className={dashStyles.statCard}>
              <div className={dashStyles.cardHeader}>
                <div className={dashStyles.iconWrapper}>
                  <Wallet size={18} className={dashStyles.cardIcon} />
                </div>
              </div>
              <span className={dashStyles.cardLabel}>Net Kazancınız</span>
              <span className={dashStyles.cardValue}>
                {loading ? <SmallSpinner /> : `₺${stats.totalNetEarnings.toLocaleString('tr-TR')}`}
              </span>
            </div>

          </div>
        </div>

        {/* ======================================= */}
        {/* === BÖLÜM SIRASI DEĞİŞTİ (1. GÜNCELLEME) === */}
        {/* ======================================= */}

        {/* 2. BÖLÜM: Haftalık Program Özeti */}
        <div className={dashStyles.section}>
          <h2 className={dashStyles.sectionTitle}>Bu Hafta Programı</h2>
          
          <div className={dashStyles.scheduleSummaryContainer}>
            {loadingSchedule ? (
              <div style={{display: 'flex', justifyContent: 'center', padding: '2rem', gridColumn: '1 / -1'}}>
                <Loader2 size={24} className={dashStyles.spinner} /> 
              </div>
            ) : weekSchedule.length > 0 ? (
              weekSchedule.map(day => (
                <div 
                  key={day.dayName} 
                  className={`${dashStyles.scheduleDay} ${day.isToday ? dashStyles.scheduleToday : ''}`}
                >
                  <div className={dashStyles.scheduleDayHeader}>
                    <span className={dashStyles.scheduleDayName}>{day.dayName}</span>
                    <span className={dashStyles.scheduleDayNumber}>{day.dayNumber}</span>
                  </div>
                  
                  <div className={dashStyles.appointmentList}>
                    {day.appointments.length > 0 ? (
                      day.appointments.map(app => (
                        <div key={app.time} className={dashStyles.appointmentEntry}>
                          <span className={dashStyles.appointmentTime}>{app.time}</span>
                          <span className={dashStyles.appointmentMember}>{app.memberName}</span>
                        </div>
                      ))
                    ) : (
                      <span className={dashStyles.noAppointments}>Boş</span>
                    )}
                  </div>
                </div>
              ))
            ) : (
               <div style={{ padding: '1rem', textAlign: 'center', color: '#888', gridColumn: '1 / -1' }}>
                  Bu hafta için programınız boş görünüyor.
                </div>
            )}
          </div>
        </div>

        {/* 3. BÖLÜM: Hızlı Eylemler */}
        <div className={dashStyles.section}>
          <h2 className={dashStyles.sectionTitle}>Hızlı Eylemler</h2>
          <div className={dashStyles.quickActionsGrid}>
            <Link 
              to="/coach/members" 
              className={dashStyles.actionCard} 
            >
              <div className={dashStyles.actionIconWrapper}>
                <Users size={24} />
              </div>
              <div className={dashStyles.actionText}>
                <strong>Üyeleri Yönet</strong>
                <span>Yeni üye ekleyin veya mevcut üyeleri görüntüleyin.</span>
              </div>
            </Link>
            <Link to="/coach/schedule" className={dashStyles.actionCard}>
              <div className={dashStyles.actionIconWrapper}>
                <Calendar size={24} />
              </div>
              <div className={dashStyles.actionText}>
                <strong>Programım</strong>
                <span>Haftalık ders programınızı görüntüleyin ve düzenleyin.</span>
              </div>
            </Link>
          </div>
        </div>

        {/* 4. BÖLÜM: İletişim Gereken Üyeler */}
        <div className={dashStyles.section}>
          <h2 className={dashStyles.sectionTitle}>İletişim Gereken Üyeler ({membersToContact.length})</h2>
          <div className={listStyles.listContainer}>
            <div className={listStyles.listContent}>
              {loading ? (
                <div style={{ padding: '2rem', display: 'flex', justifyContent: 'center' }}>
                  <Loader2 size={24} className={formStyles.spinner} />
                </div>
              ) : membersToContact.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#888' }}>
                  Paket süresi dolan veya seansı biten üyeniz bulunmuyor. Harika iş!
                </div>
              ) : (
                membersToContact.map((member) => (
                  <div 
                    key={member.id} 
                    className={`
                      ${listStyles.coachItem} 
                      ${listStyles.memberItemClickable}
                      ${member.isExpired ? listStyles.isExpiredMember : ''}
                    `} 
                    onClick={() => navigate(`/coach/members/${member.id}`)}
                  >
                    <div className={listStyles.coachInfo}>
                      <div className={listStyles.coachDetails}>
                        <span className={listStyles.coachName}>{member.name}</span>
                        
                        <div className={listStyles.coachStats}>
                           <span 
                             className={listStyles.coachPackageDates} 
                             style={member.isExpired ? {borderColor: '#f44336', color: '#f87171'} : {}}
                           >
                             {member.remainingDaysText}
                           </span>
                           <span 
                            style={member.currentSessionCount <= 0 ? {color: '#f87171'} : {}}
                           >
                              <Hash size={14} /> 
                              {member.currentSessionCount} Seans Kaldı
                           </span>
                        </div>
                        
                      </div>
                    </div>
                    
                    <div className={listStyles.coachActions} style={{pointerEvents: 'none'}}>
                      <div className={listStyles.memberPackageProgress}>
                        <div className={listStyles.progressBarContainer}>
                          <div 
                            className={listStyles.progressBarFill}
                            style={{ width: `${member.progressPercent}%` }}
                          />
                        </div>
                      </div>
                      <ChevronRight size={20} className={listStyles.chevronIcon} />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

      </div>
    </>
  );
};

export default CoachDashboardPage;