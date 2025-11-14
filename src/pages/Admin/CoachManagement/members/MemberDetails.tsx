// src/pages/Admin/CoachManagement/members/MemberDetails.tsx

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Info, CheckCircle, XCircle, Package, Plus, Edit, Trash2, Hash } from 'lucide-react';
import styles from './MemberDetails.module.css';
import coachStyles from '../../CoachManagement/CoachManagement.module.css';
import formStyles from '../../../../components/Form/Form.module.css';
import Modal from '../../../../components/Modal/Modal';

import ManagePackageModal from './ManagePackageModal';

import { getDocWithCount, getDocsWithCount, deleteDocWithCount, updateDocWithCount } from '../../../../firebase/firestoreService';
import { db } from '../../../../firebase/firebaseConfig';
import { doc, collection, query, orderBy, Timestamp, updateDoc, increment } from 'firebase/firestore';

// --- Veri Tipleri ---
interface CoachShare {
  value: number;
  type: 'TL' | '%';
}
interface MemberDetailsData {
  id: string;
  name: string;
  packageStartDate: Date | null;
  packageEndDate: Date | null;
}
interface PackageData {
  id: string;
  createdAt: Date;
  price: number;
  duration: number;
  sessionCount: number; 
  paymentStatus: 'Paid' | 'Pending';
  dietitianSupport: boolean; 
  packageNumber: number;
  share: CoachShare | null;
}
interface PackageStatus {
  startDate: Date | null,
  endDate: Date | null,
  remainingDays: number,
  progress: number,
  isExpired: boolean,
  statusText: string
}
interface InfoModalState {
  isOpen: boolean;
  message: string;
  navigateBack: boolean;
}
// -----------------------------


// --- Yardımcı Fonksiyonlar (GÜNCELLENDİ) ---
const formatDate = (date: Date): string => {
  return new Intl.DateTimeFormat('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
};
const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(value);
};

const calculatePackageStatus = (pkg: PackageData | null, memberData?: MemberDetailsData | null): PackageStatus => {
  if (!pkg && memberData) {
      pkg = {
          id: 'fallback',
          createdAt: memberData.packageStartDate || new Date(),
          duration: 30, 
          sessionCount: 0,
          price: 0,
          paymentStatus: 'Paid',
          dietitianSupport: false,
          packageNumber: 0,
          share: null
      };
      if (!memberData.packageStartDate || !memberData.packageEndDate) {
           return { startDate: null, endDate: null, remainingDays: 0, progress: 0, isExpired: true, statusText: "Aktif Paket Yok" };
      }
  } else if (!pkg) {
      return { startDate: null, endDate: null, remainingDays: 0, progress: 0, isExpired: true, statusText: "Aktif Paket Yok" };
  }
  const startDate = pkg.createdAt;
  const endDate = new Date(startDate.getTime());
  endDate.setDate(startDate.getDate() + pkg.duration - 1); 
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffTime = endDate.getTime() - todayStart.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)); 
  if (diffDays < 0) {
    return { startDate, endDate, remainingDays: 0, progress: 100, isExpired: true, statusText: "Paket Süresi Doldu" };
  }
  const totalDurationTime = endDate.getTime() - startDate.getTime();
  const elapsedTime = now.getTime() - startDate.getTime();
  let progress = (elapsedTime / totalDurationTime) * 100;
  if (progress < 0) progress = 0;
  if (progress > 100) progress = 100;
  const remainingDaysText = diffDays === 0 ? "Bugün Son Gün" : `${diffDays} gün kaldı`;
  return {
    startDate,
    endDate,
    remainingDays: diffDays,
    progress: progress,
    isExpired: false,
    statusText: remainingDaysText
  };
};

const calculateFinancials = (
  price: number, 
  coachShare: CoachShare | null, 
  duration: number,
  sessionCount: number 
): {
  companyCut: number,
  coachCut: number,
  unitPrice: number
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
  const unitPrice = duration > 0 ? (coachCut / duration) : 0;
  return { companyCut, coachCut, unitPrice };
};
// -----------------------------


const MemberDetails: React.FC = () => {
  const { id: coachId, memberId } = useParams<{ id: string, memberId: string }>();
  const navigate = useNavigate();

  const isNewMemberFlow = memberId?.startsWith('new-');

  // State'ler
  const [member, setMember] = useState<MemberDetailsData | null>(null);
  const [remainingSessions, setRemainingSessions] = useState<number>(0);
  const [packages, setPackages] = useState<PackageData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isManagePackageOpen, setIsManagePackageOpen] = useState(false);
  const [managePackageMode, setManagePackageMode] = useState<'add-package' | 'edit-package'>('add-package');
  const [editingPackage, setEditingPackage] = useState<PackageData | null>(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [deletingPackage, setDeletingPackage] = useState<PackageData | null>(null);
  const [infoModal, setInfoModal] = useState<InfoModalState>({ isOpen: false, message: '', navigateBack: false });
  

  // fetchMemberData (Değişiklik yok)
  const fetchMemberData = useCallback(async () => {
    if (isNewMemberFlow) {
        setError("Geçersiz üye ID'si. Yeni üye eklemek için lütfen koç listesindeki 'Yeni Üye Ekle' butonunu kullanın.");
        setIsLoading(false);
        setMember(null);
        return;
    }
    if (!coachId || !memberId) {
      setError("Koç veya Üye ID'si eksik.");
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const memberDocRef = doc(db, 'coaches', coachId, 'members', memberId);
      const memberSnap = await getDocWithCount(memberDocRef);
      if (memberSnap.exists()) {
        const data = memberSnap.data();
        setMember({
          id: memberSnap.id,
          name: data.name || "İsimsiz Üye",
          packageStartDate: data.packageStartDate instanceof Timestamp ? data.packageStartDate.toDate() : null,
          packageEndDate: data.packageEndDate instanceof Timestamp ? data.packageEndDate.toDate() : null,
        });
        setRemainingSessions(data.currentSessionCount || 0);
      } else {
        setMember(null);
        setError("Üye detayları bulunamadı.");
        setPackages([]);
        setIsLoading(false);
        return;
      }

      const packagesColRef = collection(memberDocRef, 'packages');
      const q = query(packagesColRef, orderBy('createdAt', 'desc')); 
      const packagesSnapshot = await getDocsWithCount(q);
      const fetchedPackages: PackageData[] = [];
      packagesSnapshot.forEach(docSnap => {
        const data = docSnap.data();
        fetchedPackages.push({
          id: docSnap.id,
          createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(),
          price: data.price || 0,
          duration: data.duration || 30,
          sessionCount: data.sessionCount || 0,
          paymentStatus: data.paymentStatus === 'Pending' ? 'Pending' : 'Paid',
          dietitianSupport: !!data.dietitianSupport,
          packageNumber: data.packageNumber || 0,
          share: data.share || null 
        });
      });
      
      if (fetchedPackages.length > 0) {
          const latestPackage = fetchedPackages[0];
          const calculatedStatus = calculatePackageStatus(latestPackage); 
          const memberData = memberSnap.data();
          let firestoreEndDate: Date | null = memberData.packageEndDate instanceof Timestamp ? memberData.packageEndDate.toDate() : null;
          let firestoreStartDate: Date | null = memberData.packageStartDate instanceof Timestamp ? memberData.packageStartDate.toDate() : null;
          if (firestoreEndDate?.getTime() !== calculatedStatus.endDate?.getTime() || 
              firestoreStartDate?.getTime() !== calculatedStatus.startDate?.getTime()) {
             await updateDoc(memberDocRef, { 
                 packageEndDate: calculatedStatus.endDate || null,
                 packageStartDate: calculatedStatus.startDate || null
             });
             setMember(prev => prev ? ({
                 ...prev,
                 packageEndDate: calculatedStatus.endDate || null,
                 packageStartDate: calculatedStatus.startDate || null
             }) : null);
          }
      } else if (memberSnap.exists()) {
          await updateDoc(memberDocRef, { 
            packageEndDate: null, 
            packageStartDate: null,
            currentSessionCount: 0 
          });
      }
      setPackages(fetchedPackages);
    } catch (err) {
      console.error("Veri çekilirken bir hata oluştu:", err);
      setError("Üye veya paket verisi çekilemedi."); 
    } finally {
      setIsLoading(false);
    }
  }, [coachId, memberId, isNewMemberFlow]);

  useEffect(() => {
    fetchMemberData();
  }, [fetchMemberData]);

  // --- Hesaplamalar ---
  const currentPackage = packages.length > 0 ? packages[0] : null;
  const status = calculatePackageStatus(currentPackage, member);
  const isActiveMember = !status.isExpired;

  // --- Aksiyon Fonksiyonları ---
  const handleAddPackage = () => {
      setManagePackageMode('add-package');
      setEditingPackage(null);
      setIsManagePackageOpen(true);
  };
  const handleEditPackage = (pkg: PackageData) => {
    setEditingPackage(pkg);
    setManagePackageMode('edit-package');
    setIsManagePackageOpen(true);
  };
  const handleOpenDeleteConfirm = (pkg: PackageData) => {
    setDeletingPackage(pkg);
    setIsDeleteConfirmOpen(true);
  };
  
  // Paket Silme (GÜNCELLENDİ)
  const handleDeletePackage = async () => {
    if (!deletingPackage || !coachId || !memberId) return;
    const pkgToDelete = deletingPackage;
    setIsLoading(true);
    setIsDeleteConfirmOpen(false);
    setError(null);
    try {
      const memberDocRef = doc(db, 'coaches', coachId, 'members', memberId);
      const packageDocRef = doc(memberDocRef, 'packages', pkgToDelete.id);
      
      // YENİ: 1. Silinecek paketin companyCut değerini hesapla
      const pkgShare = pkgToDelete.share || { type: '%', value: 0 };
      const { companyCut: cutToDecrement } = calculateFinancials(
          pkgToDelete.price,
          pkgShare,
          pkgToDelete.duration,
          pkgToDelete.sessionCount
      );

      // 2. Paketi sil
      await deleteDocWithCount(packageDocRef);
      
      const remainingPackages = packages.filter(p => p.id !== pkgToDelete.id);
      const coachDocRef = doc(db, 'coaches', coachId);

      if (remainingPackages.length === 0) {
        // Üye de silinecek
        await deleteDocWithCount(memberDocRef);
        
        // 3. Koçu güncelle (Hem üye sayısını hem de kazancı DÜŞÜR)
        await updateDocWithCount(coachDocRef, { 
            totalMembers: increment(-1),
            companyCut: increment(-cutToDecrement) // Düşür
        });
        
        setInfoModal({ 
            isOpen: true, 
            message: `Üye ${member?.name} ve son paketi başarıyla silindi. Koç listesine yönlendiriliyorsunuz.`, 
            navigateBack: true 
        });

      } else {
        // Üye kalacak, sadece paket silinecek
        const newLatestPackage = remainingPackages[0];
        const newStatus = calculatePackageStatus(newLatestPackage); 
        
        await updateDoc(memberDocRef, {
            packageEndDate: newStatus.endDate,
            packageStartDate: newStatus.startDate,
            currentSessionCount: newLatestPackage.sessionCount || 0, 
            totalPackages: increment(-1) 
        });
        
        // 3. Koçu güncelle (Sadece kazancı DÜŞÜR)
        await updateDocWithCount(coachDocRef, {
            companyCut: increment(-cutToDecrement) // Düşür
        });

        setInfoModal({ 
            isOpen: true, 
            message: 'Paket başarıyla silindi. Üye durumu güncellendi.', 
            navigateBack: false 
        });
      }
      setDeletingPackage(null);

    } catch (err: any) {
      console.error("Paket silinirken hata oluştu:", err);
      setInfoModal({ 
          isOpen: true, 
          message: `Bir hata oluştu: ${err.message}`, 
          navigateBack: false 
      });
      setIsLoading(false);
    }
  };

  const handleCloseInfoModal = () => {
    const navigateBack = infoModal.navigateBack;
    setInfoModal({ isOpen: false, message: '', navigateBack: false });
    setIsLoading(false); 
    if (navigateBack) {
      navigate(`/admin/coaches/${coachId}`);
    } else {
      fetchMemberData(); // Veriyi yenile
    }
  };

  const handlePackageActionSuccess = () => {
    setIsManagePackageOpen(false);
    fetchMemberData();
  }


  if (isLoading && !isNewMemberFlow && !infoModal.isOpen) { 
    return (
      <div className={coachStyles.coachPage} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <Loader2 size={32} className={formStyles.spinner} />
      </div>
    );
  }
  
  return (
    <>
      <div className={styles.pageContainer}>
        
        <header className={coachStyles.header}>
          <div>
            <h1 className={coachStyles.pageTitle}>{member?.name || (isNewMemberFlow ? 'Geçersiz Üye' : 'Yükleniyor...')}</h1>
            <p className={coachStyles.pageSubtitle}>
              Koç: {coachId} / Üye ID: {memberId} | Durum: 
              {isNewMemberFlow ? (
                <strong style={{ color: '#ef4444' }}> GEÇERSİZ</strong>
              ) : (
                <strong style={{ color: isActiveMember ? '#22c55e' : '#ef4444' }}>
                   {isActiveMember ? ' AKTİF' : ' PASİF'}
                </strong>
              )}
            </p>
          </div>
          <Link to={`/admin/coaches/${coachId}`} className={coachStyles.addButton}>
            <ArrowLeft size={18} />
            <span>Koç Üyelerine Geri Dön</span>
          </Link>
        </header>

        {error && <div className={formStyles.error} style={{ margin: '1rem' }}>{error}</div>}

        {!isNewMemberFlow && member && (
          <div className={styles.statusGrid}>
            <div className={styles.statusCard}>
              <div className={styles.cardHeader}>
                <Package size={18} />
                <span>Mevcut Paket Durumu</span>
              </div>
              <div className={styles.cardBody}>
                <div className={styles.progressInfo}>
                  <span className={styles.progressText}>{status.statusText}</span>
                  <span className={styles.progressEndDate}>
                    {status.endDate ? `Bitiş: ${formatDate(status.endDate)}` : '---'}
                  </span>
                </div>
                <div className={styles.progressBarContainer}>
                  <div 
                    className={styles.progressBarFill}
                    style={{ width: `${status.progress}%`, 
                             backgroundColor: status.isExpired ? '#444' : undefined 
                    }}
                  />
                </div>
              </div>
            </div>
            <div className={styles.statusCard}>
              <div className={styles.cardHeader}>
                <Info size={18} />
                <span>Diyetisyen Desteği</span>
              </div>
              <div className={styles.cardBody}>
                {currentPackage && !status.isExpired && currentPackage.dietitianSupport ? (
                  <span className={`${styles.dietitianStatus} ${styles.positive}`}>
                    <CheckCircle size={20} /> Aktif Pakette Dahil
                  </span>
                ) : (
                  <span className={`${styles.dietitianStatus} ${styles.negative}`}>
                    <XCircle size={20} /> Aktif Pakette Yok
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Paket Listesi (GÜNCELLENDİ) */}
        {!isNewMemberFlow && (
          <div className={coachStyles.listContainer}>
            <div className={coachStyles.listHeader}>
              <h2 className={coachStyles.listTitle}>
                  {`Paket Geçmişi`} 
              </h2>
              <button 
                className={coachStyles.addButton} 
                onClick={handleAddPackage}
              >
                <Plus size={18} />
                <span>Yeni Paket Ekle</span>
              </button>
            </div>
            <div className={styles.packageList}>
              {packages.length === 0 && member ? (
                <p className={styles.emptyList}>Bu üyeye ait paket bulunamadı.</p>
              ) : (
                packages.map((pkg, index) => {
                  
                  // 'calculateFinancials' çağrısı (sessionCount eklendi)
                  const financials = calculateFinancials(
                    pkg.price, 
                    pkg.share || null, 
                    pkg.duration,
                    pkg.sessionCount || 0 // YENİ
                  ); 
                  
                  const pkgStatus = calculatePackageStatus(pkg);
                  const isCurrent = index === 0 && !pkgStatus.isExpired;
                  const packageDisplayName = pkg.packageNumber ? `Paket #${pkg.packageNumber}` : 'Eski Paket';
                  
                  return (
                    <div key={pkg.id} className={`${styles.packageItem} ${isCurrent ? styles.currentPackage : ''}`}>
                      <div className={styles.packageInfo}>
                        <span className={styles.packageName}>
                          {isCurrent ? "Mevcut Paket" : packageDisplayName} 
                          {pkgStatus.isExpired && <span style={{marginLeft: '0.5rem', color: '#ef4444', fontSize: '0.85rem'}}>(Süresi Doldu)</span>}
                        </span>
                        <span className={styles.packageDate}>
                          {formatDate(pkg.createdAt)} - {pkgStatus.endDate ? formatDate(pkgStatus.endDate) : '---'} ({pkg.duration} Gün)
                        </span>
                        
                        <span style={{ fontSize: '0.85rem', color: '#AAA', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Hash size={14} /> 
                            {isCurrent ? 
                               (<strong>Kalan: {remainingSessions}</strong>) :
                               (<span>Toplam: {pkg.sessionCount} Seans</span>)
                            }
                        </span>

                        <span className={styles.packagePrice}>
                          {formatCurrency(pkg.price)} - <span style={{color: pkg.paymentStatus === 'Pending' ? '#f59e0b' : '#10b981', fontWeight: 700}}>{pkg.paymentStatus === 'Pending' ? 'Beklemede' : 'Ödendi'}</span>
                        </span>
                        <span style={{ fontSize: '0.85rem', color: pkg.dietitianSupport ? '#22c55e' : '#888', marginTop: '4px' }}>
                            {pkg.dietitianSupport ? 'Diyetisyen Desteği Dahil' : 'Diyetisyen Desteği Yok'}
                        </span>
                      </div>
                      
                      <div className={styles.packageFinancials}>
                        <div className={styles.financialItem}><span>Şirket Payı</span><strong>{formatCurrency(financials.companyCut)}</strong></div>
                        <div className={styles.financialItem}><span>Koça Kalan</span><strong>{formatCurrency(financials.coachCut)}</strong></div>
                        <div className={styles.financialItem}><span>Birim Fiyat (Günlük)</span><strong>{formatCurrency(financials.unitPrice)}</strong></div>
                      </div>
                      
                      <div className={styles.packageActions}>
                        <button className={`${styles.actionButton} ${styles.editButton}`} onClick={() => handleEditPackage(pkg)}><Edit size={16} /></button>
                        <button className={`${styles.actionButton} ${styles.deleteButton}`} onClick={() => handleOpenDeleteConfirm(pkg)}><Trash2 size={16} /></button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* --- MODALLAR (Değişiklik yok) --- */}
      
      <ManagePackageModal
        isOpen={isManagePackageOpen}
        mode={managePackageMode}
        coachId={coachId!}
        memberId={memberId!}
        packageData={editingPackage || undefined}
        onClose={() => setIsManagePackageOpen(false)}
        onSuccess={handlePackageActionSuccess}
      />
      
      <Modal 
          isOpen={isDeleteConfirmOpen} 
          onClose={() => setIsDeleteConfirmOpen(false)} 
          title="Paket Silme Onayı"
      >
          <div className={coachStyles.confirmModalBody}>
              <p style={{color: '#E0E0E0', marginBottom: '1.5rem', lineHeight: '1.6'}}>
                  **{deletingPackage?.id.substring(0, 8)}...** ID'li paketi silmek istediğinizden emin misiniz? 
                  <br/><br/>
                  {packages.length === 1 && packages[0].id === deletingPackage?.id ? (
                    <strong style={{color: '#ef4444'}}>
                        DİKKAT: Bu üyenin son paketidir. Silinirse, üye ({member?.name}) tamamen silinecektir.
                    </strong>
                  ) : (
                    <strong style={{color: '#f59e0b'}}>
                        Paket geçmişten silinecektir. Üyenin ana kaydı, kalan en son pakete göre güncellenecektir.
                    </strong>
                  )}
              </p>
              <div className={formStyles.formActions}> 
                  <button type="button" onClick={() => setIsDeleteConfirmOpen(false)} className={`${formStyles.submitButton} ${formStyles.secondary}`}>Vazgeç</button>
                  <button type="button" onClick={handleDeletePackage} className={`${formStyles.submitButton} ${formStyles.danger}`}>Evet, Sil</button>
              </div>
          </div>
      </Modal>

      <Modal
        isOpen={infoModal.isOpen}
        onClose={handleCloseInfoModal}
        title="Bilgi"
      >
         <div className={coachStyles.confirmModalBody}>
            <CheckCircle size={48} style={{ color: '#22c55e' }} />
            <p style={{color: '#E0E0E0', marginTop: '1rem', lineHeight: '1.6'}}>
                {infoModal.message}
            </p>
            <div className={formStyles.formActions} style={{ justifyContent: 'center' }}>
                <button 
                    type="button" 
                    onClick={handleCloseInfoModal} 
                    className={`${formStyles.submitButton} ${formStyles.primary}`}
                    style={{ flexGrow: 0, padding: '0.8rem 2rem' }} 
                >
                    Tamam
                </button>
            </div>
         </div>
      </Modal>
    </>
  );
};

export default MemberDetails;