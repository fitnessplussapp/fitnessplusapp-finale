// src/pages/Coach/CoachMemberDetails.tsx

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebase/firebaseConfig';
import { doc, getDoc, collection, query, orderBy, getDocs, Timestamp } from 'firebase/firestore';
import type { DocumentData } from 'firebase/firestore';

// Stilleri ve Modalı import et
import styles from './CoachMemberDetails.module.css';
import formStyles from '../../components/Form/Form.module.css';
import CoachManagePackageModal from './CoachManagePackageModal'; 

// İkonlar
import { 
  Loader2, 
  ArrowLeft, 
  PackagePlus, 
  AlertTriangle,
  CheckCircle,
  ClipboardList,
  User,
  Calendar,
  Wallet,
  Check,
  Hash
} from 'lucide-react';

// --- Tipler (GÜNCELLENDİ) ---
interface MemberDetails extends DocumentData {
  id: string;
  name: string;
  packageStartDate: Timestamp | null;
  packageEndDate: Timestamp | null;
  currentSessionCount: number;
}

// Koç payı tipini tanımla
interface CoachShare { value: number; type: 'TL' | '%'; }

interface Package extends DocumentData {
  id: string;
  price: number;
  duration: number;
  sessionCount: number;
  createdAt: Timestamp;
  packageNumber: number;
  paymentStatus: 'Paid' | 'Pending';
  approvalStatus: 'Approved' | 'Pending';
  dietitianSupport: boolean;
  share: CoachShare | null; // YENİ: Paket bazlı pay
}
// -----------------

// --- Yardımcı Fonksiyonlar (GÜNCELLENDİ) ---

/**
 * GÜNCELLENDİ: 'sessionCount' parametresi eklendi
 */
const calculateCoachCut = (
  price: number, 
  coachShare: CoachShare | null,
  sessionCount: number // YENİ
): number => {
  if (!coachShare) return 0; // Eğer pakette share yoksa (eski veri) veya koçta yoksa
  
  if (coachShare.type === 'TL') {
    // YENİ MANTIK
    const companyCut = coachShare.value * sessionCount;
    return Math.max(0, price - companyCut);
  } else {
    // ESKİ MANTIK
    const companyCut = price * (coachShare.value / 100);
    return price - companyCut;
  }
};

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(value);
};
//----------------------------------


const CoachMemberDetails: React.FC = () => {
  const { memberId } = useParams<{ memberId: string }>();
  const { currentUser } = useAuth();
  const coachId = currentUser?.username;

  // State'ler (GÜNCELLENDİ)
  const [member, setMember] = useState<MemberDetails | null>(null);
  // const [coachShare, setCoachShare] = useState<CoachShare | null>(null); // KALDIRILDI
  
  const [pendingPackages, setPendingPackages] = useState<Package[]>([]);
  const [currentPackage, setCurrentPackage] = useState<Package | null>(null);
  const [packageHistory, setPackageHistory] = useState<Package[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [isModalOpen, setIsModalOpen] = useState(false);

  // === Veri Çekme Fonksiyonu (GÜNCELLENDİ) ===
  const fetchMemberData = useCallback(async () => {
    if (!coachId || !memberId) {
      setError("Koç veya üye bilgisi bulunamadı.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      // 1. Koçun payını (share) çek (KALDIRILDI)
      // (Artık paket bazlı okunacak)
      // const coachRef = doc(db, 'coaches', coachId);
      // ...
      // setCoachShare(coachSnap.data().share as CoachShare);
      

      // 2. Üye detayını çek (Ana profil)
      const memberRef = doc(db, 'coaches', coachId, 'members', memberId);
      const memberSnap = await getDoc(memberRef);
      if (!memberSnap.exists()) {
        throw new Error("Üye bulunamadı.");
      }
      setMember({ id: memberSnap.id, ...memberSnap.data() } as MemberDetails);

      // 3. Paketleri Çek ve Ayır (GÜNCELLENDİ)
      const packagesRef = collection(memberRef, 'packages');
      const q = query(packagesRef, orderBy('createdAt', 'desc')); // En yeniden eskiye
      const packagesSnap = await getDocs(q);

      const allPackages: Package[] = packagesSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        share: doc.data().share || null // YENİ: Paketten 'share' oku
      } as Package));

      // 4. Paketleri 'Pending' (Bekleyen) ve 'Approved' (Onaylanmış) olarak ayır
      const pending: Package[] = [];
      const approved: Package[] = [];

      allPackages.forEach(pkg => {
        if (pkg.approvalStatus === 'Pending') {
          pending.push(pkg);
        } else {
          approved.push(pkg); // 'Approved' veya 'undefined' (eski veriler)
        }
      });
      
      // 5. State'leri ayarlanmış verilerle güncelle
      setPendingPackages(pending);
      setCurrentPackage(approved[0] || null);
      setPackageHistory(approved.slice(1));

    } catch (err: any) {
      console.error(err);
      setError("Üye verileri yüklenirken bir hata oluştu.");
    } finally {
      setLoading(false);
    }
  }, [coachId, memberId]);

  useEffect(() => {
    fetchMemberData();
  }, [fetchMemberData]);

  // Modal'ı yöneten fonksiyonlar (Değişiklik yok)
  const handleOpenModal = () => setIsModalOpen(true);
  const handleCloseModal = () => setIsModalOpen(false);
  const handleSuccess = () => {
    handleCloseModal();
    fetchMemberData();
  };

  // === Yardımcı JSX Fonksiyonları (Değişiklik yok) ===
  const getStatusInfo = (): { text: string; className: string } => {
    if (!member || !member.packageEndDate) {
      if (pendingPackages.length > 0) {
        return { text: 'ONAY BEKLİYOR', className: styles.statusPending };
      }
      return { text: 'PASİF', className: styles.statusPassive };
    }
    const endDate = member.packageEndDate.toDate();
    const now = new Date();
    if (endDate < now) {
      return { text: 'PASİF', className: styles.statusPassive };
    }
    return { text: 'AKTİF', className: styles.statusActive };
  };

  const getRemainingDays = (): string => {
    if (!member || !member.packageEndDate) {
       if (pendingPackages.length > 0) return 'Onay Bekleniyor';
       return 'Paket Yok';
    }
    
    const endDate = member.packageEndDate.toDate();
    const now = new Date();
    const endOfDay = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 23, 59, 59);
    const diffTime = endOfDay.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays <= 0) return 'Süre Doldu';
    return `${diffDays} gün kaldı`;
  };
  // -----------------------------------------------------------

  // Yükleme ve Hata Durumları (Değişiklik yok)
  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <Loader2 size={32} className={styles.spinner} />
        <p>Üye verileri yükleniyor...</p>
      </div>
    );
  }
  if (error) {
    return <div className={styles.errorContainer}>{error}</div>;
  }
  if (!member) {
    return <div className={styles.errorContainer}>Üye bulunamadı.</div>;
  }

  // === RENDER KISMI (JSX) (GÜNCELLENDİ) ===
  const status = getStatusInfo();
  
  return (
    <>
      <div className={styles.detailPage}>
        
        {/* 1. Başlık ve Geri Butonu */}
        <div className={styles.header}>
          <div>
            <h1 className={styles.memberName}>{member.name}</h1>
            <span className={styles.memberMeta}>
              Üye ID: {member.id} | Durum: <span className={status.className}>{status.text}</span>
            </span>
          </div>
          <Link to="/coach/members" className={styles.backButton}>
            <ArrowLeft size={16} /> Tüm Üyelere Geri Dön
          </Link>
        </div>

        {/* 2. Üst Kartlar */}
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <h3 className={styles.statTitle}>Mevcut Paket Durumu</h3>
            <p className={styles.statValue}>{getRemainingDays()}</p>
            <div className={styles.progressBar}>
              {/* İlerleme çubuğu mantığı buraya eklenebilir */}
            </div>
            <span className={styles.statFooter}>
              Bitiş: {member.packageEndDate ? member.packageEndDate.toDate().toLocaleDateString('tr-TR') : (pendingPackages.length > 0 ? 'Onay Bekleniyor' : '-')}
            </span>
          </div>
          
          <div className={styles.statCard}>
            <h3 className={styles.statTitle}>Diyetisyen Desteği</h3>
            {currentPackage?.dietitianSupport ? (
              <div className={styles.dietitianStatus} style={{ color: '#2ecc71' }}>
                <Check size={18} /> Aktif Pakette Dahil
              </div>
            ) : (
              <div className={styles.dietitianStatus} style={{ color: '#95a5a6' }}>
                <User size={18} /> Aktif Pakette Yok
              </div>
            )}
          </div>
        </div>

        {/* 3. Paket Geçmişi Bölümü */}
        <div className={styles.packageSection}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>
              <ClipboardList size={22} /> Paket Geçmişi
            </h2>
            <button 
              className={formStyles.submitButton}
              onClick={handleOpenModal}
            >
              <PackagePlus size={16} /> Yeni Paket Ekle
            </button>
          </div>

          <div className={styles.packageList}>
            
            {/* 4. ONAY BEKLEYEN PAKETLER (GÜNCELLENDİ) */}
            {pendingPackages.map(pkg => (
              <div key={pkg.id} className={`${styles.packageCard} ${styles.pendingCard}`}>
                <div className={styles.pendingBadge}>
                  <AlertTriangle size={16} />
                  ADMİN ONAYI BEKLENİYOR
                </div>
                <div className={styles.packageHeader}>
                  <span className={styles.packageTitle}>Paket #{pkg.packageNumber || '?'} (Beklemede)</span>
                  <span className={styles.packageDate}>
                    {pkg.createdAt.toDate().toLocaleDateString('tr-TR')} (Süre: {pkg.duration} Gün)
                  </span>
                </div>
                <div className={styles.packageBody}>
                  <div className={styles.packagePrice}>
                    {formatCurrency(pkg.price)} - <span className={pkg.paymentStatus === 'Paid' ? styles.paid : styles.pending}>{pkg.paymentStatus === 'Paid' ? 'Ödendi' : 'Beklemede'}</span>
                  </div>
                  <div className={styles.coachEarning}>
                    <Wallet size={14} /> Kazancınız: {formatCurrency(
                        // GÜNCELLENDİ: 'pkg.share' ve 'pkg.sessionCount' kullanılıyor
                        calculateCoachCut(pkg.price, pkg.share, pkg.sessionCount)
                    )}
                  </div>
                </div>
                {pkg.dietitianSupport && (
                  <div className={styles.packageFooter}>
                    <Check size={16} /> Diyetisyen Desteği Dahil
                  </div>
                )}
              </div>
            ))}
            
            {/* 5. MEVCUT (AKTİF) PAKET (GÜNCELLENDİ) */}
            {currentPackage && (
              <div className={`${styles.packageCard} ${styles.currentPackageCard}`}>
                <div className={styles.packageHeader}>
                  <span className={styles.packageTitle}>Mevcut Paket (Paket #{currentPackage.packageNumber || '?'})</span>
                  <span className={styles.packageDate}>
                    {currentPackage.createdAt.toDate().toLocaleDateString('tr-TR')} (Süre: {currentPackage.duration} Gün)
                  </span>
                </div>
                <div className={styles.packageBody}>
                  <div className={styles.packagePrice}>
                    {formatCurrency(currentPackage.price)} - <span className={currentPackage.paymentStatus === 'Paid' ? styles.paid : styles.pending}>{currentPackage.paymentStatus === 'Paid' ? 'Ödendi' : 'Beklemede'}</span>
                  </div>
                  <div className={styles.coachEarning}>
                    <Wallet size={14} /> Kazancınız: {formatCurrency(
                        // GÜNCELLENDİ: 'currentPackage.share' ve 'currentPackage.sessionCount' kullanılıyor
                        calculateCoachCut(currentPackage.price, currentPackage.share, currentPackage.sessionCount)
                    )}
                  </div>
                </div>
                <div className={styles.packageSession}>
                  Kalan Seans: <strong>{member.currentSessionCount || 0}</strong> / {currentPackage.sessionCount}
                </div>
                {currentPackage.dietitianSupport && (
                  <div className={styles.packageFooter}>
                    <Check size={16} /> Diyetisyen Desteği Dahil
                  </div>
                )}
              </div>
            )}
            
            {/* 6. GEÇMİŞ PAKETLER (GÜNCELLENDİ) */}
            {packageHistory.map(pkg => (
              <div key={pkg.id} className={styles.packageCard}>
                <div className={styles.packageHeader}>
                  <span className={styles.packageTitle}>Paket #{pkg.packageNumber || '?'}</span>
                  <span className={styles.packageDate}>
                    {pkg.createdAt.toDate().toLocaleDateString('tr-TR')} (Süre: {pkg.duration} Gün)
                  </span>
                </div>
                <div className={styles.packageBody}>
                  <div className={styles.packagePrice}>
                    {formatCurrency(pkg.price)} - <span className={pkg.paymentStatus === 'Paid' ? styles.paid : styles.pending}>{pkg.paymentStatus === 'Paid' ? 'Ödendi' : 'Beklemede'}</span>
                  </div>
                  <div className={styles.coachEarning}>
                    <Wallet size={14} /> Kazancınız: {formatCurrency(
                        // GÜNCELLENDİ: 'pkg.share' ve 'pkg.sessionCount' kullanılıyor
                        calculateCoachCut(pkg.price, pkg.share, pkg.sessionCount)
                    )}
                  </div>
                </div>
                 {pkg.dietitianSupport && (
                  <div className={styles.packageFooter}>
                    <Check size={16} /> Diyetisyen Desteği Dahil
                  </div>
                )}
              </div>
            ))}

            {/* Hiç paket yoksa */}
            {pendingPackages.length === 0 && !currentPackage && packageHistory.length === 0 && (
              <p className={styles.noPackages}>Bu üye için henüz hiç paket kaydı bulunmuyor.</p>
            )}

          </div>
        </div>

      </div>

      {/* 7. Modal Bağlantısı */}
      <CoachManagePackageModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSuccess={handleSuccess}
        memberId={memberId || ''}
      />
    </>
  );
};

export default CoachMemberDetails;