// src/pages/Admin/CoachManagement/members/MemberDetails.tsx

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Loader2, Phone, Mail, Calendar, MapPin, 
  Package, TrendingUp, DollarSign, Hash, Clock, 
  Edit, Trash2, CheckCircle, XCircle, Plus, ExternalLink,
  User, Layers, Tag, Info
} from 'lucide-react';

// Stiller
import styles from './MemberDetails.module.css';
import coachStyles from '../../CoachManagement/CoachManagement.module.css'; // Butonlar için
import formStyles from '../../../../components/Form/Form.module.css';

// Modallar
import Modal from '../../../../components/Modal/Modal';
import ManagePackageModal from './ManagePackageModal';

// Firestore Servisleri
import { 
  getDocWithCount, 
  getDocsWithCount, 
  deleteDocWithCount, 
  updateDocWithCount, 
  getSystemDefinitions 
} from '../../../../firebase/firestoreService';
import type { SystemDefinition } from '../../../../firebase/firestoreService';

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
  phoneNumber?: string; 
  email?: string;       
  packageStartDate: Date | null;
  packageEndDate: Date | null;
  createdAt?: Date;
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
  customFields?: { [key: string]: any }; // Pakete özel dinamik alanlar
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

// --- Yardımcı Fonksiyonlar ---
const formatDate = (date: Date | undefined | null): string => {
  if (!date) return '-';
  return new Intl.DateTimeFormat('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
};

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(value);
};

const calculatePackageStatus = (pkg: PackageData | null, memberData?: MemberDetailsData | null): PackageStatus => {
  if (!pkg) {
      return { startDate: null, endDate: null, remainingDays: 0, progress: 0, isExpired: true, statusText: "Aktif Paket Yok" };
  }

  const startDate = pkg.createdAt;
  const endDate = new Date(startDate.getTime());
  endDate.setDate(startDate.getDate() + pkg.duration - 1); 
  
  // Gün başlangıcına göre hesapla
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endDateStart = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
  
  const diffTime = endDateStart.getTime() - todayStart.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)); 

  if (diffDays < 0) {
    return { startDate, endDate, remainingDays: 0, progress: 100, isExpired: true, statusText: "Süresi Doldu" };
  }

  const totalDurationTime = endDateStart.getTime() - startDate.getTime();
  const elapsedTime = todayStart.getTime() - startDate.getTime();
  
  let progress = 0;
  if (totalDurationTime > 0) {
      progress = (elapsedTime / totalDurationTime) * 100;
  }
  
  return {
    startDate,
    endDate,
    remainingDays: diffDays,
    progress: Math.min(100, Math.max(0, progress)),
    isExpired: false,
    statusText: diffDays === 0 ? "Bugün Son Gün" : `${diffDays} gün kaldı`
  };
};

const calculateFinancials = (price: number, share: CoachShare | null, sessions: number) => {
  let companyCut = 0;
  let coachCut = price;
  if (share && share.value > 0) {
    if (share.type === 'TL') {
      companyCut = share.value * sessions;
      coachCut = Math.max(0, price - companyCut);
    } else {
      companyCut = price * (share.value / 100);
      coachCut = price - companyCut;
    }
  }
  return { companyCut, coachCut };
};


const MemberDetails: React.FC = () => {
  const { id: coachId, memberId } = useParams<{ id: string, memberId: string }>();
  const navigate = useNavigate();
  
  // State
  const [member, setMember] = useState<MemberDetailsData | null>(null);
  const [remainingSessions, setRemainingSessions] = useState<number>(0);
  const [packages, setPackages] = useState<PackageData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Modallar
  const [isManagePackageOpen, setIsManagePackageOpen] = useState(false);
  const [managePackageMode, setManagePackageMode] = useState<'add-package' | 'edit-package'>('add-package');
  const [editingPackage, setEditingPackage] = useState<PackageData | null>(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [deletingPackage, setDeletingPackage] = useState<PackageData | null>(null);
  const [infoModal, setInfoModal] = useState<InfoModalState>({ isOpen: false, message: '', navigateBack: false });

  // Tanımlar (Labels)
  const [definitions, setDefinitions] = useState<SystemDefinition[]>([]);

  // Veri Çekme
  const fetchMemberData = useCallback(async () => {
    if (!coachId || !memberId) return;
    setIsLoading(true);
    setError(null);
    
    try {
      // 1. Tanımları Çek
      const defs = await getSystemDefinitions();
      setDefinitions(defs.filter(d => d.targets && d.targets.includes('member')));

      // 2. Üye Verisi
      const memberDocRef = doc(db, 'coaches', coachId, 'members', memberId);
      const memberSnap = await getDocWithCount(memberDocRef);
      
      if (!memberSnap.exists()) {
        setError("Üye bulunamadı.");
        setIsLoading(false);
        return;
      }
      
      const mData = memberSnap.data();
      setMember({
        id: memberSnap.id,
        name: mData.name || "İsimsiz",
        phoneNumber: mData.phoneNumber || "",
        email: mData.email || "",
        packageStartDate: mData.packageStartDate?.toDate() || null,
        packageEndDate: mData.packageEndDate?.toDate() || null,
        createdAt: mData.createdAt?.toDate() || null
      });
      setRemainingSessions(mData.currentSessionCount || 0);

      // 3. Paketler
      const pkgQuery = query(collection(memberDocRef, 'packages'), orderBy('createdAt', 'desc'));
      const pkgSnap = await getDocsWithCount(pkgQuery);
      
      const loadedPackages: PackageData[] = pkgSnap.docs.map(d => {
        const p = d.data();
        return {
          id: d.id,
          createdAt: p.createdAt?.toDate() || new Date(),
          price: p.price || 0,
          duration: p.duration || 30,
          sessionCount: p.sessionCount || 0,
          paymentStatus: p.paymentStatus,
          dietitianSupport: p.dietitianSupport,
          packageNumber: p.packageNumber,
          share: p.share,
          customFields: p.customFields || {}
        };
      });
      setPackages(loadedPackages);

    } catch (err) {
      console.error(err);
      setError("Veri yüklenirken hata oluştu.");
    } finally {
      setIsLoading(false);
    }
  }, [coachId, memberId]);

  useEffect(() => { fetchMemberData(); }, [fetchMemberData]);

  // --- İstatistik Hesaplamaları ---
  const activePackage = packages.length > 0 ? packages[0] : null;
  const activeStatus = calculatePackageStatus(activePackage);
  const isActive = activePackage && !activeStatus.isExpired;
  
  // LTV (Lifetime Value)
  const totalSpent = useMemo(() => {
    return packages.reduce((sum, p) => sum + (p.price || 0), 0);
  }, [packages]);

  // --- Aksiyonlar ---
  const handleDeletePackage = async () => {
    if (!deletingPackage || !coachId || !memberId) return;
    setIsLoading(true);
    try {
      const memberRef = doc(db, 'coaches', coachId, 'members', memberId);
      const pkgRef = doc(memberRef, 'packages', deletingPackage.id);
      
      // Finansal düzeltme
      const { companyCut } = calculateFinancials(deletingPackage.price, deletingPackage.share || null, deletingPackage.sessionCount);
      
      await deleteDocWithCount(pkgRef);
      
      // Son paket silindiyse üye silinir, değilse güncelle
      const remaining = packages.filter(p => p.id !== deletingPackage.id);
      const coachRef = doc(db, 'coaches', coachId);

      if (remaining.length === 0) {
        await deleteDocWithCount(memberRef);
        await updateDocWithCount(coachRef, { 
            totalMembers: increment(-1), 
            companyCut: increment(-companyCut) 
        });
        setInfoModal({ isOpen: true, message: "Üye ve tüm paketleri silindi.", navigateBack: true });
      } else {
        const nextPkg = remaining[0];
        const nextStatus = calculatePackageStatus(nextPkg);
        await updateDoc(memberRef, {
            packageEndDate: nextStatus.endDate,
            packageStartDate: nextStatus.startDate,
            currentSessionCount: nextPkg.sessionCount,
            totalPackages: increment(-1)
        });
        await updateDocWithCount(coachRef, { companyCut: increment(-companyCut) });
        setDeletingPackage(null);
        setIsDeleteConfirmOpen(false);
        fetchMemberData();
      }
    } catch (e) {
      console.error(e);
      setIsLoading(false);
    }
  };

  if (isLoading && !member) {
    return <div style={{padding:'3rem', display:'flex', justifyContent:'center'}}><Loader2 className={formStyles.spinner} /></div>;
  }

  return (
    <div className={styles.pageContainer}>
        
        {/* HEADER */}
        <div className={styles.headerWrapper}>
            <div className={styles.profileSummary}>
                <div className={styles.avatarCircle}>
                    {member?.name.charAt(0).toUpperCase()}
                </div>
                <div className={styles.memberIdentity}>
                    <h1 className={styles.memberName}>{member?.name}</h1>
                    <span className={`${styles.memberStatus} ${isActive ? styles.activeStatus : styles.passiveStatus}`}>
                        {isActive ? <CheckCircle size={16} /> : <XCircle size={16} />}
                        {isActive ? 'AKTİF ÜYE' : 'PASİF ÜYE'}
                    </span>
                </div>
            </div>
            <Link to={`/admin/coaches/${coachId}`} className={coachStyles.addButton} style={{height: 'fit-content'}}>
                <ArrowLeft size={18} /> <span>Koç Paneline Dön</span>
            </Link>
        </div>

        {/* KEY METRICS (ÜST İSTATİSTİKLER) */}
        <div className={styles.statsGrid}>
            <div className={styles.statCard}>
                <div className={styles.statHeader}><Hash size={16}/> KALAN SEANS</div>
                <div className={styles.statValue} style={{color: remainingSessions < 3 ? '#ef4444' : '#E0E0E0'}}>
                    {remainingSessions}
                </div>
                <div className={styles.statSubtext}>Toplam Kalan Hak</div>
            </div>
            <div className={styles.statCard}>
                <div className={styles.statHeader}><Clock size={16}/> ÜYELİK DURUMU</div>
                <div className={styles.statValue}>
                    {activeStatus.remainingDays} <span style={{fontSize:'1rem', fontWeight:400}}>Gün</span>
                </div>
                <div className={styles.statSubtext}>{activeStatus.statusText}</div>
            </div>
            <div className={styles.statCard}>
                <div className={styles.statHeader}><DollarSign size={16}/> TOPLAM HARCAMA (LTV)</div>
                <div className={styles.statValue} style={{color: '#D4AF37'}}>
                    {formatCurrency(totalSpent)}
                </div>
                <div className={styles.statSubtext}>{packages.length} Paket Toplamı</div>
            </div>
            <div className={styles.statCard}>
                <div className={styles.statHeader}><Calendar size={16}/> KAYIT TARİHİ</div>
                <div className={styles.statValue} style={{fontSize:'1.2rem'}}>
                    {formatDate(member?.createdAt)}
                </div>
                <div className={styles.statSubtext}>Aramıza Katıldı</div>
            </div>
        </div>

        {/* MAIN CONTENT GRID */}
        <div className={styles.mainContentGrid}>
            
            {/* SOL KOLON: İLETİŞİM VE PROFİL */}
            <div className={styles.profileCard}>
                <h3 className={styles.sectionTitle}><User size={18}/> İletişim Bilgileri</h3>
                
                {/* Telefon */}
                <div className={styles.infoRow}>
                    <div className={styles.infoIconBox}><Phone size={20}/></div>
                    <div className={styles.infoContent}>
                        <span className={styles.infoLabel}>Telefon Numarası</span>
                        <span className={styles.infoValue}>{member?.phoneNumber || '-'}</span>
                        {member?.phoneNumber && (
                            <a href={`tel:${member.phoneNumber}`} className={styles.actionLink}>
                                Hemen Ara
                            </a>
                        )}
                    </div>
                </div>

                {/* Email */}
                <div className={styles.infoRow}>
                    <div className={styles.infoIconBox}><Mail size={20}/></div>
                    <div className={styles.infoContent}>
                        <span className={styles.infoLabel}>E-Posta Adresi</span>
                        <span className={styles.infoValue}>{member?.email || '-'}</span>
                        {member?.email && (
                            <a href={`mailto:${member.email}`} className={styles.actionLink}>
                                Mail Gönder
                            </a>
                        )}
                    </div>
                </div>

                {/* Lokasyon (Opsiyonel - En son paketten çekilebilir) */}
                <div className={styles.infoRow}>
                    <div className={styles.infoIconBox}><MapPin size={20}/></div>
                    <div className={styles.infoContent}>
                        <span className={styles.infoLabel}>Son Lokasyon</span>
                        <span className={styles.infoValue}>
                            {activePackage?.customFields?.['Şubeler']?.[0] || 'Belirtilmemiş'}
                        </span>
                    </div>
                </div>
            </div>

            {/* SAĞ KOLON: PAKET GEÇMİŞİ */}
            <div className={styles.packagesSection}>
                <div className={styles.packagesHeader}>
                    <h3 className={styles.sectionTitle} style={{marginBottom:0}}><Layers size={18}/> Paket Geçmişi</h3>
                    <button className={coachStyles.addButton} onClick={() => {setEditingPackage(null); setManagePackageMode('add-package'); setIsManagePackageOpen(true)}}>
                        <Plus size={16}/> Yeni Paket
                    </button>
                </div>

                {packages.length === 0 && (
                    <div style={{textAlign:'center', padding:'3rem', color:'#666', border:'1px dashed #333', borderRadius:'12px'}}>
                        Henüz paket bulunmuyor.
                    </div>
                )}

                {packages.map((pkg, index) => {
                    const status = calculatePackageStatus(pkg);
                    const isActivePkg = index === 0 && !status.isExpired;
                    const financials = calculateFinancials(pkg.price, pkg.share || null, pkg.sessionCount);

                    return (
                        <div key={pkg.id} className={`${styles.packageCard} ${isActivePkg ? styles.activePackageBorder : ''}`}>
                            <div className={styles.packageCardHeader}>
                                <div className={styles.packageTitleGroup}>
                                    <span className={styles.packageTitle}>
                                        {pkg.packageNumber ? `Paket #${pkg.packageNumber}` : 'Eski Paket'}
                                        {isActivePkg && <span className={styles.activeBadge}>AKTİF</span>}
                                    </span>
                                    <span className={styles.packageMeta}>
                                        {formatDate(pkg.createdAt)} — {formatDate(status.endDate)}
                                    </span>
                                </div>
                                <div className={styles.cardActions}>
                                    <button className={styles.iconButton} onClick={() => {setEditingPackage(pkg); setManagePackageMode('edit-package'); setIsManagePackageOpen(true)}}><Edit size={16}/></button>
                                    <button className={`${styles.iconButton} ${styles.deleteBtn}`} onClick={() => {setDeletingPackage(pkg); setIsDeleteConfirmOpen(true)}}><Trash2 size={16}/></button>
                                </div>
                            </div>

                            <div className={styles.packageBody}>
                                {/* Dinamik Alanlar (Tags) */}
                                <div className={styles.tagsContainer}>
                                    {/* Otomatik Diyetisyen Etiketi */}
                                    {pkg.dietitianSupport && (
                                        <span className={styles.tag} style={{color:'#22c55e', borderColor:'rgba(34,197,94,0.3)', background:'rgba(34,197,94,0.1)'}}>
                                            <CheckCircle size={12}/> Diyetisyen
                                        </span>
                                    )}
                                    
                                    {/* Diğer Tanımlı Alanlar */}
                                    {definitions.map(def => {
                                        const vals = pkg.customFields?.[def.id];
                                        if(!vals || (Array.isArray(vals) && vals.length === 0)) return null;
                                        const display = Array.isArray(vals) ? vals.join(', ') : vals;
                                        return (
                                            <span key={def.id} className={styles.tag}>
                                                {/* İkon yerine sadece başlık ve değer */}
                                                {def.title}: {display}
                                            </span>
                                        )
                                    })}
                                </div>

                                {/* İlerleme */}
                                <div className={styles.progressSection}>
                                    <div className={styles.progressLabels}>
                                        <span>{status.statusText}</span>
                                        <span>{status.progress > 100 ? 100 : Math.round(status.progress)}%</span>
                                    </div>
                                    <div className={styles.progressTrack}>
                                        <div className={styles.progressFill} style={{width: `${status.progress}%`, backgroundColor: status.isExpired ? '#444' : undefined}}></div>
                                    </div>
                                </div>

                                {/* Finansal Grid */}
                                <div className={styles.packageFooter}>
                                    <div className={styles.footerItem}>
                                        <span className={styles.footerLabel}>Tutar</span>
                                        <span className={styles.footerValue}>{formatCurrency(pkg.price)}</span>
                                    </div>
                                    <div className={styles.footerItem}>
                                        <span className={styles.footerLabel}>Şirket Payı</span>
                                        <span className={styles.footerValue}>{formatCurrency(financials.companyCut)}</span>
                                    </div>
                                    <div className={styles.footerItem}>
                                        <span className={styles.footerLabel}>Koç Geliri</span>
                                        <span className={`${styles.footerValue} ${styles.income}`}>{formatCurrency(financials.coachCut)}</span>
                                    </div>
                                    <div className={styles.footerItem}>
                                        <span className={styles.footerLabel}>Seans</span>
                                        <span className={styles.footerValue}>{pkg.sessionCount} Adet</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>

        {/* MODALLAR */}
        <ManagePackageModal 
            isOpen={isManagePackageOpen}
            mode={managePackageMode}
            coachId={coachId!}
            memberId={memberId!}
            packageData={editingPackage || undefined}
            onClose={() => setIsManagePackageOpen(false)}
            onSuccess={() => { setIsManagePackageOpen(false); fetchMemberData(); }}
        />

        <Modal isOpen={isDeleteConfirmOpen} onClose={() => setIsDeleteConfirmOpen(false)} title="Paket Sil">
            <div className={coachStyles.confirmModalBody}>
                <p>Bu paketi silmek istediğinize emin misiniz? Bu işlem geri alınamaz.</p>
                <div className={formStyles.formActions}>
                    <button className={`${formStyles.submitButton} ${formStyles.secondary}`} onClick={() => setIsDeleteConfirmOpen(false)}>İptal</button>
                    <button className={`${formStyles.submitButton} ${formStyles.danger}`} onClick={handleDeletePackage}>{isLoading ? <Loader2 className={formStyles.spinner}/> : 'Sil'}</button>
                </div>
            </div>
        </Modal>

        <Modal isOpen={infoModal.isOpen} onClose={() => { setInfoModal({...infoModal, isOpen:false}); if(infoModal.navigateBack) navigate(-1); }} title="Bilgi">
            <div className={coachStyles.confirmModalBody}>
                <p>{infoModal.message}</p>
                <button className={`${formStyles.submitButton} ${formStyles.primary}`} onClick={() => { setInfoModal({...infoModal, isOpen:false}); if(infoModal.navigateBack) navigate(-1); }}>Tamam</button>
            </div>
        </Modal>

    </div>
  );
};

export default MemberDetails;