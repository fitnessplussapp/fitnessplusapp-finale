// src/pages/Admin/Approvals/Approvals.tsx

import React, { useState, useEffect } from 'react';
import styles from './Approvals.module.css';
import { 
  getPendingApprovals, 
  getMemberPackageHistory,
  deleteDocWithCount,
  updateDocWithCount,
  getDocWithCount
} from '../../../firebase/firestoreService';
import type { PendingApproval } from '../../../firebase/firestoreService';
import Modal from '../../../components/Modal/Modal';
import { 
  Loader2, Check, X, Info, ShieldAlert, 
  User, Calendar, Sparkles, UserPlus, History,
  PackageCheck, Package, DollarSign, Hash
} from 'lucide-react';
import type { Timestamp as TimestampType, DocumentData } from 'firebase/firestore';
import { doc, increment, Timestamp, writeBatch } from 'firebase/firestore'; 
import { db } from '../../../firebase/firebaseConfig'; 

// --- Paket Tipi ---
interface PackageData {
  id: string;
  createdAt: TimestampType;
  price: number;
  duration: number;
  sessionCount: number;
  paymentStatus: 'Paid' | 'Pending';
  dietitianSupport: boolean;
  packageNumber: number;
  share?: CoachShare; // YENİ: Pay bilgisi eklendi
}
// -------------------------------------------------------------------

// ================================================================
// === YARDIMCI TİPLER VE FONKSİYONLAR (GÜNCELLENDİ) ===
// ================================================================

// Koç payı tipini tanımla
interface CoachShare {
  value: number;
  type: 'TL' | '%';
}

/**
 * GÜNCELLENDİ: 'sessionCount' parametresi eklendi
 * Fiyata ve koç payına göre finansalları hesaplar.
 */
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
      // YENİ MANTIK: Şirket payı = (Seans Başı TL) * (Toplam Seans)
      companyCut = shareValue * sessionCount; 
      coachCut = Math.max(0, price - companyCut);
    } else {
      // ESKİ MANTIK
      companyCut = price * (shareValue / 100); 
      coachCut = price - companyCut;
    }
  }
  return { companyCut, coachCut };
};
// ================================================================


const Approvals: React.FC = () => {
  const [approvals, setApprovals] = useState<PendingApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Modal State'leri
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [selectedApproval, setSelectedApproval] = useState<PendingApproval | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Paket Geçmişi Modalı State'leri
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [historyModalData, setHistoryModalData] = useState<{ memberName: string, packages: PackageData[] } | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  // ----------------------------------------------------


  // === YARDIMCI FONKSİYON: Tarih Formatlama ===
  const formatTimestamp = (timestamp: TimestampType | undefined | Date): string => {
    if (!timestamp) return 'Tarih Yok';
    let date: Date;
    if (timestamp instanceof Timestamp) {
      date = timestamp.toDate();
    } else {
      date = new Date(timestamp as any);
    }
    
    return date.toLocaleDateString('tr-TR', {
      day: '2-digit', month: 'long',
    });
  };

  // === Veri Çekme Fonksiyonu ===
  const fetchApprovals = async () => {
    setLoading(true);
    setError(null);
    try {
      const pendingList = await getPendingApprovals();
      setApprovals(pendingList);
    } catch (err: any) {
      console.error(err);
      setError('Onay bekleyen kayıtlar çekilemedi: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApprovals();
  }, []);

  // === Onay/Red Modalı ===
  const handleActionClick = (
    approval: PendingApproval, 
    type: 'approve' | 'reject'
  ) => {
    setSelectedApproval(approval);
    setActionType(type);
    setIsConfirmModalOpen(true);
  };
  const handleCloseConfirmModal = () => {
    setIsConfirmModalOpen(false);
    setSelectedApproval(null);
    setActionType(null);
  }

  // === Detaylar Modalı Fonksiyonları ===
  const handleOpenHistoryModal = async (approval: PendingApproval) => {
    setIsHistoryModalOpen(true);
    setHistoryLoading(true);
    setHistoryModalData(null); 
    
    try {
      const snapshot = await getMemberPackageHistory(approval.coachId, approval.memberId);
      const fetchedPackages: PackageData[] = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          createdAt: data.createdAt,
          price: data.price,
          duration: data.duration,
          sessionCount: data.sessionCount,
          paymentStatus: data.paymentStatus,
          dietitianSupport: data.dietitianSupport,
          packageNumber: data.packageNumber,
          share: data.share || null // YENİ: Paketten payı oku
        } as PackageData;
      });
      
      setHistoryModalData({
        memberName: approval.memberName,
        packages: fetchedPackages
      });

    } catch (err: any) {
      setError("Paket geçmişi çekilemedi: " + err.message);
      setIsHistoryModalOpen(false);
    } finally {
      setHistoryLoading(false);
    }
  };
  const handleCloseHistoryModal = () => {
    setIsHistoryModalOpen(false);
  };
  // -----------------------------------------


  // === GÜNCELLEME: Ana Onay/Reddetme Fonksiyonu ===
  // (Artık 'companyCut'ı paket bazlı 'share'den ve 'sessionCount'a göre hesaplıyor)
  const handleConfirmAction = async () => {
    if (!selectedApproval) return;

    setIsSubmitting(true);
    setError(null);

    try {
      if (actionType === 'approve') {
        // --- ONAYLA (GÜNCELLENMİŞ MANTIK) ---
        
        const { coachId, memberId, id: packageId, packageData } = selectedApproval;

        // 1. Gerekli verileri paketten al
        const startDate = (packageData.createdAt as TimestampType).toDate();
        const duration = packageData.duration as number;
        const sessionCount = packageData.sessionCount as number;
        const price = packageData.price as number;
        
        // YENİ: Pay bilgisini paketin kendisinden al
        const packageShare = (packageData.share as CoachShare) || { type: '%', value: 0 };
        
        // 2. Bitiş tarihini DOĞRU HESAPLA (duration - 1)
        const endDate = new Date(startDate.getTime());
        endDate.setDate(startDate.getDate() + duration - 1); 

        // 3. Gerekli referanslar
        const packageRef = doc(db, 'coaches', coachId, 'members', memberId, 'packages', packageId);
        const memberRef = doc(db, 'coaches', coachId, 'members', memberId);
        const coachRef = doc(db, 'coaches', coachId); 

        // 4. YENİ: 'companyCut' hesaplaması (Paket verileriyle)
        const { companyCut } = calculateFinancials(price, packageShare, sessionCount);
        
        // 5. YENİ: Toplu Yazma (Batch) işlemi başlat
        const batch = writeBatch(db);

        // GÜNCELLEME 1: Paketi onayla
        batch.update(packageRef, {
          approvalStatus: 'Approved',
          lastUpdated: Timestamp.now()
        });
    
        // GÜNCELLEME 2: ÜYEYİ GÜNCELLE (Seans sayısı ve tarihler)
        batch.update(memberRef, {
            currentSessionCount: sessionCount,
            packageStartDate: startDate,
            packageEndDate: endDate
        });
        
        // GÜNCELLEME 3: KOÇU GÜNCELLE (companyCut)
        batch.update(coachRef, {
            companyCut: increment(companyCut) // Artık doğru 'cut' değeri
        });
        
        // 6. Tüm güncellemeleri tek seferde gönder
        await batch.commit();
        
      } else if (actionType === 'reject') {
        // --- REDDET ve SİL (GÜNCELLENDİ: Koçun kazanç düşüşü eklendi) ---
        await deletePackageAndMemberIfNeeded(selectedApproval);
      }

      // Başarılı olursa listeden kaldır
      setApprovals(prev => prev.filter(item => item.id !== selectedApproval.id));
      handleCloseConfirmModal();

    } catch (err: any) {
      console.error("İşlem başarısız oldu:", err);
      setError(`İşlem başarısız oldu: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // === Silme Mantığı Fonksiyonu (GÜNCELLENDİ) ===
  // (Reddedilen paket YENİ ÜYE kaydıysa 'companyCut' düşülmez, 
  // ancak YENİ PAKET ise ve adminden dönerse diye 'companyCut' düşüşü eklemek GEREKMEZ,
  // çünkü zaten 'Pending' olduğu için 'companyCut' HİÇ EKLENMEMİŞTİ.)
  // Bu yüzden bu fonksiyondaki tek değişiklik 'getMemberPackageHistory'nin hata vermemesi.
  const deletePackageAndMemberIfNeeded = async (approval: PendingApproval) => {
    const isFirstPackage = approval.packageData.packageNumber === 1;
    
    // 1. Paketi sil
    const packageRef = doc(db, 'coaches', approval.coachId, 'members', approval.memberId, 'packages', approval.id);
    await deleteDocWithCount(packageRef);

    // 2. Kalan paketleri kontrol et
    const remainingPackagesSnap = await getMemberPackageHistory(approval.coachId, approval.memberId);
    
    if (isFirstPackage || remainingPackagesSnap.empty) {
      // Eğer ilk paketse VEYA son paketse, üyeyi de sil
      const memberRef = doc(db, 'coaches', approval.coachId, 'members', approval.memberId);
      await deleteDocWithCount(memberRef);
      
      // Koçun toplam üye sayısını düşür
      const coachRef = doc(db, 'coaches', approval.coachId);
      await updateDocWithCount(coachRef, { totalMembers: increment(-1) });

    } else {
      // Eğer kalan paketler varsa, üye belgesini en yeni pakete göre güncelle
      // (Eğer reddedilen paket en yenisi ise)
      
      // (Mevcut mantık: Kalan paketlerin en yenisini bul ve üye belgesine yaz)
      // Bu mantık 'Pending' bir paketi silerken DOĞRU ÇALIŞIR.
      const newLatestPackageData = remainingPackagesSnap.docs[0].data() as PackageData;
      
      // Eğer kalan son paket de 'Pending' değilse (yani 'Approved' ise)
      if (newLatestPackageData.approvalStatus !== 'Pending') {
          const newStartDate = newLatestPackageData.createdAt.toDate();
          const newEndDate = new Date(newStartDate.getTime());
          newEndDate.setDate(newStartDate.getDate() + newLatestPackageData.duration - 1);
          
          const memberRef = doc(db, 'coaches', approval.coachId, 'members', approval.memberId);
          await updateDocWithCount(memberRef, { 
            packageStartDate: Timestamp.fromDate(newStartDate), 
            packageEndDate: Timestamp.fromDate(newEndDate),
            currentSessionCount: (newLatestPackageData.sessionCount || 0),
            totalPackages: increment(-1) 
          });
      } else {
         // Kalan en yeni paket de 'Pending' ise veya başka bir durum varsa,
         // üye tarihlerini null'a çek (veya mevcut mantığa dokunma)
         const memberRef = doc(db, 'coaches', approval.coachId, 'members', approval.memberId);
         await updateDocWithCount(memberRef, { 
            totalPackages: increment(-1) 
         });
      }
    }
  };
  // ------------------------------------


  // Yükleme durumu
  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <Loader2 size={48} className={styles.spinner} />
        <p>Onaylar Yükleniyor...</p>
      </div>
    );
  }

  // === JSX (Değişiklik yok) ===
  return (
    <>
      <div className={styles.approvalsPage}>
        <h1 className={styles.pageTitle}>Bekleyen Onaylar ({approvals.length})</h1>
        
        {error && <p className={styles.errorText} onClick={() => setError(null)}>{error} (Kapatmak için tıkla)</p>}

        <div className={styles.approvalList}>
          {approvals.length === 0 && !error && (
            <div className={styles.emptyState}>
              <Info size={40} />
              <p>Onay bekleyen yeni bir kayıt bulunmuyor.</p>
            </div>
          )}

          {approvals.map(item => {
            const isNewMember = item.packageData.packageNumber === 1;
            
            return (
              <div key={item.id} className={styles.card}>
                
                <div className={styles.cardInfo}>
                  <div className={styles.cardHeader}>
                    <strong className={styles.memberName}>{item.memberName}</strong>
                    <span className={styles.coachName}>
                      (Koç: {item.coachName})
                    </span>
                  </div>
                  
                  <div className={styles.cardDetails}>
                    <span>₺{item.packageData.price || 0}</span>
                    <span>•</span>
                    <span>{item.packageData.duration || 0} Gün</span>
                    <span>•</span>
                    <span>{item.packageData.sessionCount || 0} Seans</span>
                    <span>•</span>
                    <span>{formatTimestamp(item.packageData.createdAt)}</span>
                  </div>

                  <div className={styles.cardFooter}>
                    <span className={`${styles.badge} ${isNewMember ? styles.badgeNew : styles.badgeRenew}`}>
                      {isNewMember ? <UserPlus size={12} /> : <Sparkles size={12} />}
                      {isNewMember ? 'Yeni Üye Kaydı' : 'Yeni Paket Ekleme'}
                    </span>
                    {item.packageData.dietitianSupport && (
                      <span className={styles.dietitian}>Diyetisyen Var</span>
                    )}
                    <button 
                      className={styles.detailsButton} 
                      onClick={() => handleOpenHistoryModal(item)}
                    >
                      <History size={12} /> Detay
                    </button>
                  </div>
                </div>
                
                <div className={styles.cardActions}>
                  <button 
                    className={`${styles.actionButton} ${styles.reject}`}
                    onClick={() => handleActionClick(item, 'reject')}
                    disabled={isSubmitting}
                  >
                    <X size={20} />
                  </button>
                  <button 
                    className={`${styles.actionButton} ${styles.approve}`}
                    onClick={() => handleActionClick(item, 'approve')}
                    disabled={isSubmitting}
                  >
                    <Check size={20} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* --- MODALLAR --- */}

      {/* 1. Onay/Red Modalı */}
      <Modal
        isOpen={isConfirmModalOpen}
        onClose={handleCloseConfirmModal}
        title={actionType === 'approve' ? 'Paketi Onayla' : 'Paketi Reddet ve Sil'}
      >
        {selectedApproval && (
          <div className={styles.modalBody}>
            <ShieldAlert 
              size={40} 
              className={actionType === 'approve' ? styles.iconApprove : styles.iconReject} 
            />
            <p>
              <strong>{selectedApproval.memberName}</strong> isimli üyenin 
              (Koç: {selectedApproval.coachName}) 
              <strong> ₺{selectedApproval.packageData.price}</strong> değerindeki 
              paketini <strong>{actionType === 'approve' ? 'ONAYLAMAK' : 'REDDETMEK VE SİLMEK'}</strong> 
              istediğinizden emin misiniz?
            </p>
            {actionType === 'reject' && (
              <small>
                {selectedApproval.packageData.packageNumber === 1 
                  ? "Bu bir YENİ ÜYE KAYDI. Reddedilirse, hem bu paket hem de üye kaydı kalıcı olarak SİLİNECEKTİR."
                  : "Bu mevcut bir üyeye YENİ PAKET EKLEME. Reddedilirse, sadece bu paket SİLİNECEKTİR."
                }
              </small>
            )}
            {error && <p className={styles.modalError}>{error}</p>}
            <div className={styles.modalActions}>
              <button 
                className={`${styles.modalButton} ${styles.secondary}`}
                onClick={handleCloseConfirmModal}
                disabled={isSubmitting}
              >
                İptal
              </button>
              <button
                className={`${styles.modalButton} ${actionType === 'approve' ? styles.primary : styles.danger}`}
                onClick={handleConfirmAction}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <Loader2 size={18} className={styles.spinner} />
                ) : (
                  actionType === 'approve' ? 'Evet, Onayla' : 'Evet, Reddet ve Sil'
                )}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* 2. Paket Geçmişi (Detaylar) Modalı (GÜNCELLENDİ: Finansal detaylar eklendi) */}
      <Modal
        isOpen={isHistoryModalOpen}
        onClose={handleCloseHistoryModal}
        title={historyModalData ? `${historyModalData.memberName} - Paket Geçmişi` : "Yükleniyor..."}
      >
        <div className={styles.historyModalBody}>
          {historyLoading ? (
            <div className={styles.loadingContainer} style={{backgroundColor: 'transparent', padding: '2rem'}}>
              <Loader2 size={32} className={styles.spinner} />
              <p>Paket geçmişi yükleniyor...</p>
            </div>
          ) : historyModalData && (
            <div className={styles.packageList}>
              {historyModalData.packages.length === 0 ? (
                <p>Paket bulunamadı.</p>
              ) : (
                historyModalData.packages.map((pkg, index) => {
                  // YENİ: Finansalları hesapla
                  const financials = calculateFinancials(pkg.price, (pkg.share || null), pkg.sessionCount);
                  
                  return (
                    <div key={pkg.id} className={`${styles.packageItem} ${index === 0 ? styles.currentPackage : ''}`}>
                      <div className={styles.packageIcon}>
                        <PackageCheck size={24} />
                      </div>
                      <div className={styles.packageDetails}>
                        <div className={styles.packageHeader}>
                          <strong>Paket #{pkg.packageNumber || '?'}</strong>
                          {index === 0 && <span>(Aktif Paket)</span>}
                        </div>
                        <div className={styles.packageInfo}>
                          <DollarSign size={14} /> <span>{pkg.price} TL</span>
                          <Calendar size={14} /> <span>{formatTimestamp(pkg.createdAt)}</span>
                          <User size={14} /> <span>{pkg.duration} Gün</span>
                          <Hash size={14} /> <span>{pkg.sessionCount} Seans</span>
                        </div>
                        {/* YENİ: Finansal Detaylar */}
                        <div className={styles.packageInfo} style={{marginTop: '0.5rem', fontSize: '0.85rem'}}>
                            <span>Şirket Payı: <strong>{financials.companyCut} TL</strong></span>
                            <span style={{color: '#22c55e'}}>Koça Kalan: <strong>{financials.coachCut} TL</strong></span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </Modal>
    </>
  );
};

export default Approvals;