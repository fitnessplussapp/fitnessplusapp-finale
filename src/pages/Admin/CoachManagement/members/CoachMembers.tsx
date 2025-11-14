// src/pages/Admin/CoachManagement/CoachMembers.tsx

import React, { useEffect, useCallback, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, ChevronRight, Loader2, Plus, Trash2, AlertTriangle,
  Users, CreditCard, CheckCircle, XCircle, 
  Hash 
} from 'lucide-react';
import styles from '../../CoachManagement/CoachManagement.module.css'; 
import formStyles from '../../../../components/Form/Form.module.css'; 

// Gerçek Firebase servisleri
import { 
  getDocsWithCount, 
  deleteDocWithCount, 
  updateDocWithCount,
  getDocWithCount
} from '../../../../firebase/firestoreService';
import { db } from '../../../../firebase/firebaseConfig';
import { collection, query, Timestamp, doc, increment, getDocs } from 'firebase/firestore'; 

import AddNewMemberModal from '../members/AddNewMemberModal'; 
import Modal from '../../../../components/Modal/Modal'; 

// --- Veri Tipleri ---
type PaymentStatusSummary = 'Paid' | 'Partial Payment' | 'Unpaid' | 'No Packages';

interface MemberData {
  id: string;
  name: string;
  packageStartDate: Date | null; 
  packageEndDate: Date | null; 
  totalPackages: number;
  currentSessionCount: number;
  paymentStatusSummary: PaymentStatusSummary;
}
interface PackageData {
  id: string;
  paymentStatus: 'Paid' | 'Pending';
}
interface DeleteModalState {
  isOpen: boolean;
  member: MemberData | null;
}

// YENİ: CoachShare Tipi (Silme işlemi için gerekli)
interface CoachShare {
  value: number;
  type: 'TL' | '%';
}
// -----------------------------

// --- Yardımcı Fonksiyonlar ---
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

// YENİ: calculateFinancials (Silme işlemi için gerekli)
const calculateFinancials = (
  price: number, 
  coachShare: CoachShare | null,
  sessionCount: number 
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
// -----------------------------


const CoachDetails: React.FC = () => {
  const { id: coachId } = useParams<{ id: string }>(); 
  const navigate = useNavigate();

  const [coachName, setCoachName] = useState<string>(coachId || '...');
  const [members, setMembers] = React.useState<MemberData[]>([]); 
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Modal state'leri
  const [isAddNewMemberOpen, setIsAddNewMemberOpen] = useState(false);
  const [deleteModal, setDeleteModal] = useState<DeleteModalState>({ isOpen: false, member: null });
  const [isDeleting, setIsDeleting] = useState(false); 

  
  // fetchCoachMembers (Değişiklik yok)
  const fetchCoachMembers = useCallback(async () => {
    if (!coachId) {
      setError("Koç ID'si bulunamadı.");
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    
    try {
      const coachDocRef = doc(db, 'coaches', coachId);
      const coachSnap = await getDocWithCount(coachDocRef); 
      if (coachSnap.exists()) {
        setCoachName(coachSnap.data().username || coachId);
      }

      const membersCollectionRef = collection(db, 'coaches', coachId, 'members');
      const q = query(membersCollectionRef);
      const querySnapshot = await getDocsWithCount(q);

      if (querySnapshot.empty) {
        setMembers([]);
        setIsLoading(false);
        return;
      }
      
      const memberDataPromises = querySnapshot.docs.map(async (memberDoc) => {
        const member = memberDoc.data();
        
        const packagesColRef = collection(memberDoc.ref, 'packages'); 
        const packagesSnapshot = await getDocs(packagesColRef); // Sayaçsız (getDocs)
        
        const memberPackages: PackageData[] = packagesSnapshot.docs.map(pkgDoc => ({
          id: pkgDoc.id,
          paymentStatus: pkgDoc.data().paymentStatus || 'Pending'
        }));

        let paymentStatusSummary: PaymentStatusSummary = 'No Packages';
        if (memberPackages.length > 0) {
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
          paymentStatusSummary: paymentStatusSummary
        } as MemberData;
      });

      const resolvedMembers = await Promise.all(memberDataPromises);
      
      resolvedMembers.sort((a, b) => {
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

  // handle... fonksiyonları (Değişiklik yok)
  const handleMemberClick = (memberId: string) => {
    navigate(`/admin/coaches/${coachId}/members/${memberId}`);
  };
  const handleAddNewMember = () => {
    setIsAddNewMemberOpen(true);
  };
  const handleModalSuccess = () => {
    setIsAddNewMemberOpen(false);
    fetchCoachMembers(); 
  };
  const handleModalClose = () => {
    setIsAddNewMemberOpen(false);
  };

  // --- Üye Silme Fonksiyonları (GÜNCELLENDİ) ---
  const handleOpenMemberDeleteConfirm = (member: MemberData) => {
    setDeleteModal({ isOpen: true, member: member });
  };
  const handleCloseMemberDeleteConfirm = () => {
    setDeleteModal({ isOpen: false, member: null });
  };
  
  const handleConfirmMemberDelete = async () => {
    const memberToDelete = deleteModal.member;
    if (!memberToDelete || !coachId) return;

    setIsDeleting(true);
    setError(null);

    try {
      const memberDocRef = doc(db, 'coaches', coachId, 'members', memberToDelete.id);
      
      // YENİ: 1. Silmeden önce tüm paketleri oku ve toplam 'cut'ı hesapla
      const packagesColRef = collection(memberDocRef, 'packages');
      const packagesSnapshot = await getDocs(packagesColRef); 
      
      let totalCutToDecrement = 0;

      for (const pkgDoc of packagesSnapshot.docs) {
        const pkgData = pkgDoc.data();
        
        // Bu paketin 'companyCut'ını hesapla
        const pkgShare = (pkgData.share as CoachShare) || { type: '%', value: 0 };
        const pkgPrice = pkgData.price || 0;
        const pkgSessions = pkgData.sessionCount || 0;
        
        const { companyCut } = calculateFinancials(pkgPrice, pkgShare, pkgSessions);
        totalCutToDecrement += companyCut;

        // Paketi sil
        await deleteDocWithCount(pkgDoc.ref);
      }
      
      // 2. Üyeyi sil
      await deleteDocWithCount(memberDocRef);

      // 3. Koçu güncelle (Hem üye sayısını hem de toplam kazancı DÜŞÜR)
      const coachDocRef = doc(db, 'coaches', coachId);
      await updateDocWithCount(coachDocRef, {
          totalMembers: increment(-1),
          companyCut: increment(-totalCutToDecrement) // Düşür
      });
      
      handleCloseMemberDeleteConfirm();
      fetchCoachMembers(); 
      
    } catch (err: any) {
      console.error("Üye silinirken hata oluştu:", err);
      setError("Üye silinirken bir hata oluştu: " + err.message);
    } finally {
      setIsDeleting(false);
    }
  };
  // ------------------------------------------

  // Ödeme durumu için ikon ve metin (Değişiklik yok)
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
        
        {/* Header */}
        <header className={styles.header}>
          <div>
            <h1 className={styles.pageTitle}>{coachName}</h1>
            <p className={styles.pageSubtitle}>
              Bu koça ait üyeler aşağıda listelenmiştir.
            </p>
          </div>
          <Link to="/admin/coaches" className={styles.backButton}>
            <ArrowLeft size={18} />
            <span className={styles.buttonText}>Tüm Koçlara Geri Dön</span>
          </Link>
        </header>
        
        {/* Üye Listesi Alanı */}
        <div className={styles.listContainer}>
          
          <div className={styles.listHeader}>
            <h2 className={styles.listTitle}>Üyeler ({members.length})</h2>
            <button className={styles.addButton} onClick={handleAddNewMember}>
              <Plus size={18} />
              <span>Yeni Üye Ekle</span>
            </button>
          </div>

          <div className={styles.listContent}>
            
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
                Bu koça ait üye bulunamadı. Lütfen "Yeni Üye Ekle" butonunu kullanın.
              </div>
            )}

            {/* Üye Listesi (Değişiklik yok) */}
            {!isLoading && !error && members.map((member) => {
              const packageStatus = calculateRemainingDays(member.packageEndDate);
              const progressPercent = calculateProgressPercentage(
                member.packageStartDate, 
                member.packageEndDate
              );
              
              return (
                <div 
                  key={member.id} 
                  className={`
                    ${styles.coachItem} 
                    ${styles.memberItemClickable}
                    ${packageStatus.isExpired ? styles.isExpiredMember : ''}
                  `} 
                  onClick={() => handleMemberClick(member.id)}
                >
                  
                  <div className={styles.coachInfo}>
                    <div className={styles.coachDetails}>
                      <span className={styles.coachName}>{member.name}</span>
                      <div className={styles.coachStats}>
                        <span>
                          <Users size={14} />
                          {member.totalPackages || 0} Paket
                        </span>
                        <span>
                          <Hash size={14} />
                          {member.currentSessionCount} Seans Kaldı
                        </span>
                        {renderPaymentStatus(member.paymentStatusSummary)}
                      </div>
                    </div>
                  </div>
                  
                  <div className={styles.coachActions}>
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

                    <button 
                      className={styles.memberDeleteButton}
                      title={`${member.name} üyesini kalıcı olarak sil`}
                      onClick={(e) => {
                        e.stopPropagation(); 
                        handleOpenMemberDeleteConfirm(member);
                      }}
                    >
                      <Trash2 size={16} />
                    </button>

                    <ChevronRight size={20} className={styles.chevronIcon} />
                  </div>

                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* --- MODALLAR --- */}
      
      <AddNewMemberModal 
        isOpen={isAddNewMemberOpen}
        coachId={coachId!} 
        onClose={handleModalClose}
        onSuccess={handleModalSuccess}
      />

      <Modal 
        isOpen={deleteModal.isOpen} 
        onClose={handleCloseMemberDeleteConfirm} 
        title="Üye Silme Onayı"
      >
        <div className={styles.confirmModalBody}>
          <AlertTriangle size={48} className={styles.confirmIcon} />
          <p>
            <strong>{deleteModal.member?.name}</strong> isimli üyeyi kalıcı olarak silmek istediğinizden emin misiniz?
            <br/><br/>
            <strong style={{color: '#ef4444'}}>
              Bu işlem, üyeye ait TÜM PAKET GEÇMİŞİNİ geri alınamaz şekilde silecektir!
            </strong>
          </p>
          <div className={formStyles.formActions}> 
              <button 
                  type="button" 
                  onClick={handleCloseMemberDeleteConfirm} 
                  className={`${formStyles.submitButton} ${formStyles.secondary}`}
                  disabled={isDeleting}
              >
                  Vazgeç
              </button>
              <button 
                  type="button" 
                  onClick={handleConfirmMemberDelete} 
                  className={`${formStyles.submitButton} ${formStyles.danger}`}
                  disabled={isDeleting}
              >
                  {isDeleting ? <Loader2 size={18} className={formStyles.spinner} /> : 'Evet, Üyeyi Sil'}
              </button>
          </div>
        </div>
      </Modal>
    </>
  );
};

export default CoachDetails;