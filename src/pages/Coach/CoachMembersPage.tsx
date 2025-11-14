// src/pages/Coach/CoachMembersPage.tsx

import React, { useEffect, useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ChevronRight, 
  Loader2, 
  Plus, 
  Users, 
  CreditCard, 
  CheckCircle, 
  XCircle, 
  Hash,
  AlertTriangle // Onay ikonu için eklendi
} from 'lucide-react';

// Admin stillerini yeniden kullanıyoruz
import styles from '../Admin/CoachManagement/CoachManagement.module.css'; 
import formStyles from '../../components/Form/Form.module.css'; 

// Koç'un AuthContext'i
import { useAuth } from '../../context/AuthContext'; 
import { getDocsWithCount } from '../../firebase/firestoreService';
import { db } from '../../firebase/firebaseConfig';
// GÜNCELLEME: 'orderBy' ve 'query' eklendi
import { collection, query, Timestamp, getDocs, orderBy } from 'firebase/firestore'; 

import CoachAddNewMemberModal from './CoachAddNewMemberModal'; 
import Modal from '../../components/Modal/Modal'; 

// --- Veri Tipleri ---
type PaymentStatusSummary = 'Paid' | 'Partial Payment' | 'Unpaid' | 'No Packages';

// GÜNCELLEME: MemberData tipi
interface MemberData {
  id: string;
  name: string;
  packageStartDate: Date | null; 
  packageEndDate: Date | null; 
  totalPackages: number;
  currentSessionCount: number;
  paymentStatusSummary: PaymentStatusSummary;
  latestApprovalStatus: 'Pending' | 'Approved' | null; // YENİ: Onay durumu
}
interface PackageData {
  id: string;
  paymentStatus: 'Paid' | 'Pending';
  approvalStatus?: 'Pending' | 'Approved'; // YENİ
  packageNumber?: number; // YENİ
}
// -----------------------------

// --- Yardımcı Fonksiyonlar (Değişiklik yok) ---
const formatDate = (date: Date | null): string => {
  if (!date) return '---';
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: '2-digit',
  }).format(date);
};

const calculateRemainingDays = (endDate: Date | null): { text: string; isExpired: boolean } => {
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
// -----------------------------


const CoachMembersPage: React.FC = () => {
  const { currentUser } = useAuth();
  const coachId = currentUser?.username;
  
  const navigate = useNavigate();

  const [members, setMembers] = React.useState<MemberData[]>([]); 
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [isAddNewMemberOpen, setIsAddNewMemberOpen] = useState(false);
  const [tempMemberId, setTempMemberId] = useState('');
  
  
  // === GÜNCELLEME: fetchCoachMembers (Onay Durumunu Kontrol Eder) ===
  const fetchCoachMembers = useCallback(async () => {
    if (!coachId) {
      setError("Koç ID'si bulunamadı.");
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    
    try {
      const membersCollectionRef = collection(db, 'coaches', coachId, 'members');
      const q = query(membersCollectionRef);
      const querySnapshot = await getDocs(q); 

      if (querySnapshot.empty) {
        setMembers([]);
        setIsLoading(false);
        return;
      }
      
      const memberDataPromises = querySnapshot.docs.map(async (memberDoc) => {
        const member = memberDoc.data();
        
        // GÜNCELLEME: Paketleri 'packageNumber'a göre sırala
        const packagesColRef = collection(memberDoc.ref, 'packages'); 
        const pkgQuery = query(packagesColRef, orderBy('packageNumber', 'desc'));
        const packagesSnapshot = await getDocs(pkgQuery);
        
        let paymentStatusSummary: PaymentStatusSummary = 'No Packages';
        let latestApprovalStatus: 'Pending' | 'Approved' | null = null;
        
        const memberPackages: PackageData[] = packagesSnapshot.docs.map(pkgDoc => ({
          id: pkgDoc.id,
          paymentStatus: pkgDoc.data().paymentStatus || 'Pending',
          approvalStatus: pkgDoc.data().approvalStatus,
          packageNumber: pkgDoc.data().packageNumber
        }));

        if (memberPackages.length > 0) {
          // 1. En son paketin onay durumunu al
          latestApprovalStatus = memberPackages[0].approvalStatus || 'Approved'; // Eskiler için 'Approved' varsay

          // 2. Ödeme durumunu hesapla (Değişiklik yok)
          const unpaidPackages = memberPackages.filter(p => p.paymentStatus === 'Pending');
          if (unpaidPackages.length === 0) {
            paymentStatusSummary = 'Paid'; 
          } else if (unpaidPackages.length === memberPackages.length) {
            paymentStatusSummary = 'Unpaid';
          } else {
            paymentStatusSummary = 'Partial Payment';
          }
        }
        
        let packageStartDate: Date | null = member.packageStartDate instanceof Timestamp ? member.packageStartDate.toDate() : null;
        let packageEndDate: Date | null = member.packageEndDate instanceof Timestamp ? member.packageEndDate.toDate() : null;
        
        return {
          id: memberDoc.id,
          name: member.name || "İsimsiz Üye",
          packageStartDate: packageStartDate,
          packageEndDate: packageEndDate,
          totalPackages: member.totalPackages || memberPackages.length,
          currentSessionCount: member.currentSessionCount || 0,
          paymentStatusSummary: paymentStatusSummary,
          latestApprovalStatus: latestApprovalStatus // YENİ
        } as MemberData;
      });

      const resolvedMembers = await Promise.all(memberDataPromises);
      
      // Listeyi sırala (Değişiklik yok)
      resolvedMembers.sort((a, b) => {
          // YENİ: Onay bekleyenler en üste gelsin
          if (a.latestApprovalStatus === 'Pending' && b.latestApprovalStatus !== 'Pending') return -1;
          if (a.latestApprovalStatus !== 'Pending' && b.latestApprovalStatus === 'Pending') return 1;

          // Sonra aktif olanlar
          const aActive = a.packageEndDate && a.packageEndDate.getTime() > Date.now();
          const bActive = b.packageEndDate && b.packageEndDate.getTime() > Date.now();
          if (aActive && !bActive) return -1;
          if (!aActive && bActive) return 1;
          if (aActive && bActive) {
              return (a.packageEndDate?.getTime() || 0) - (b.packageEndDate?.getTime() || 0);
          }
          return (b.packageEndDate?.getTime() || 0) - (a.packageEndDate?.getTime() || 0);
      });
      
      setMembers(resolvedMembers);
      
    } catch (err: any) {
      console.error("Üyeler çekilirken bir hata oluştu:", err);
      setError("Üyeler listesi çekilemedi: " + err.message);
    } finally {
      setIsLoading(false);
    }
  }, [coachId]);
  
  useEffect(() => {
    fetchCoachMembers();
  }, [fetchCoachMembers]);

  // handleMemberClick (Değişiklik yok)
  const handleMemberClick = (memberId: string) => {
    navigate(`/coach/members/${memberId}`);
  };

  // Yeni üye modalı (Değişiklik yok)
  const handleAddNewMember = () => {
    const newId = `new-${Date.now()}`; 
    setTempMemberId(newId);
    setIsAddNewMemberOpen(true);
  };
  const handleModalSuccess = () => {
    setIsAddNewMemberOpen(false);
    fetchCoachMembers(); 
  };
  const handleModalClose = () => {
    setIsAddNewMemberOpen(false);
    setTempMemberId('');
  };

  // renderPaymentStatus (Değişiklik yok)
  const renderPaymentStatus = (status: PaymentStatusSummary) => {
    switch (status) {
      case 'Paid':
        return <span className={`${styles.paymentStatus} ${styles.paid}`}><CheckCircle size={14} /> Tümü Ödendi</span>;
      case 'Partial Payment':
        return <span className={`${styles.paymentStatus} ${styles.partial}`}><AlertTriangle size={14} /> Eksik Ödeme</span>;
      case 'Unpaid':
        return <span className={`${styles.paymentStatus} ${styles.unpaid}`}><XCircle size={14} /> Ödenmedi</span>;
      case 'No Packages':
        return <span className={`${styles.paymentStatus} ${styles.noPackage}`}><CreditCard size={14} /> Paket Yok</span>;
      default:
        return null;
    }
  };


  return (
    <>
      <div className={styles.coachPage}>
        
        <h1 className={formStyles.pageTitle}>Üyelerim</h1>
        
        <div className={styles.listContainer} style={{marginTop: '1.5rem'}}>
          
          <div className={styles.listHeader}>
            <h2 className={styles.listTitle}>Tüm Üyeler ({members.length})</h2>
            <button className={styles.addButton} onClick={handleAddNewMember}>
              <Plus size={18} />
              <span>Yeni Üye Ekle</span>
            </button>
          </div>

          <div className={styles.listContent}>
            
            {/* Yükleme, Hata, Boş durumları (Değişiklik yok) */}
            {isLoading && (
              <div style={{ padding: '2rem', display: 'flex', justifyContent: 'center' }}>
                <Loader2 size={24} className={formStyles.spinner} />
              </div>
            )}
            {error && (
              <div className={formStyles.error} style={{ margin: '1rem' }}>{error}</div>
            )}
            {!isLoading && !error && members.length === 0 && (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#888' }}>
                Henüz hiç üyeniz bulunmuyor. "Yeni Üye Ekle" butonu ile başlayın.
              </div>
            )}

            {/* === GÜNCELLEME: JSX (Liste) === */}
            {!isLoading && !error && members.map((member) => {
              const packageStatus = calculateRemainingDays(member.packageEndDate);
              const progressPercent = calculateProgressPercentage(
                member.packageStartDate, 
                member.packageEndDate
              );
              
              // Onay bekleyenler için özel sınıf
              const isPending = member.latestApprovalStatus === 'Pending';

              return (
                <div 
                  key={member.id} 
                  className={`
                    ${styles.coachItem} 
                    ${styles.memberItemClickable}
                    ${packageStatus.isExpired && !isPending ? styles.isExpiredMember : ''}
                    ${isPending ? styles.isPendingMember : ''} {/* YENİ: Onay bekleyenleri vurgula */}
                  `} 
                  onClick={() => handleMemberClick(member.id)}
                >
                  
                  <div className={styles.coachInfo}>
                    <div className={styles.coachDetails}>
                      <span className={styles.coachName}>{member.name}</span>
                      
                      {/* GÜNCELLEME: coachStats (Onay durumuna göre) */}
                      <div className={styles.coachStats}>
                        {isPending ? (
                          // 1. Onay Bekliyorsa
                          <span className={`${styles.paymentStatus} ${styles.partial}`}>
                            <AlertTriangle size={14} /> Admin Onayı Bekleniyor
                          </span>
                        ) : (
                          // 2. Onaylanmışsa (Normal görünüm)
                          <>
                            <span>
                              <Users size={14} />
                              {member.totalPackages || 0} Paket
                            </span>
                            <span>
                              <Hash size={14} />
                              {member.currentSessionCount} Seans Kaldı
                            </span>
                            {renderPaymentStatus(member.paymentStatusSummary)}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* GÜNCELLEME: Sağ Taraf (Onay durumuna göre) */}
                  <div className={styles.coachActions}>
                    {isPending ? (
                      // 1. Onay Bekliyorsa (Progress bar yerine metin)
                      <span className={styles.remainingDays} style={{color: '#f59e0b'}}> 
                        Onayda
                      </span>
                    ) : (
                      // 2. Onaylanmışsa (Normal progress bar)
                      <div className={styles.memberPackageProgress}>
                        <div className={styles.progressBarContainer}>
                          <div 
                            className={styles.progressBarFill}
                            style={{ width: `${progressPercent}%`, 
                                     backgroundColor: packageStatus.isExpired ? '#444' : undefined 
                                  }}
                          />
                        </div>
                        <span className={styles.remainingDays}>
                          {packageStatus.text}
                        </span>
                      </div>
                    )}

                    <ChevronRight size={20} className={styles.chevronIcon} />
                  </div>

                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* --- MODALLAR (Değişiklik yok) --- */}
      
      <CoachAddNewMemberModal 
        isOpen={isAddNewMemberOpen}
        memberId={tempMemberId}
        onClose={handleModalClose}
        onSuccess={handleModalSuccess}
      /> 
      
    </>
  );
};

export default CoachMembersPage;