// src/pages/Admin/CoachManagement/CoachMembers.tsx

import React, { useEffect, useCallback, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, ChevronRight, Loader2, Plus, Trash2, AlertTriangle,
  Users, CreditCard, CheckCircle, XCircle, Hash, MapPin, Calendar, User
} from 'lucide-react';

// CSS Module - Reusing the main CoachManagement styles for consistency
import styles from '../CoachManagement.module.css'; 
import formStyles from '../../../../components/Form/Form.module.css'; 

// Firebase services
import { 
  getDocsWithCount, 
  deleteDocWithCount, 
  updateDocWithCount,
  getDocWithCount,
  getSystemDefinitions
} from '../../../../firebase/firestoreService';
import type { SystemDefinition } from '../../../../firebase/firestoreService';

import { db } from '../../../../firebase/firebaseConfig';
import { collection, query, Timestamp, doc, increment, getDocs } from 'firebase/firestore'; 

import AddNewMemberModal from '../members/AddNewMemberModal'; 
import Modal from '../../../../components/Modal/Modal'; 

// --- Data Types ---
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
interface CoachShare {
  value: number;
  type: 'TL' | '%';
}

interface CoachDetailsData {
  username: string;
  customFields?: { [key: string]: any };
}
// -----------------------------

// Helper Functions
const calculateRemainingDays = (endDate: Date | null): { text: string; isExpired: boolean; days: number } => {
  if (!endDate) { 
    return { text: 'Paket Yok', isExpired: true, days: -1 };
  }
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endDateStart = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
  
  const diffTime = endDateStart.getTime() - todayStart.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) {
    return { text: 'Süresi Doldu', isExpired: true, days: diffDays };
  }
  if (diffDays === 0) {
    return { text: 'Bugün Son Gün', isExpired: false, days: 0 };
  }
  return { text: `${diffDays} gün kaldı`, isExpired: false, days: diffDays };
};

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


const CoachMembers: React.FC = () => {
  const { id: coachId } = useParams<{ id: string }>(); 
  const navigate = useNavigate();

  const [coachDetails, setCoachDetails] = useState<CoachDetailsData>({ username: coachId || '...' });
  const [definitions, setDefinitions] = useState<SystemDefinition[]>([]);

  const [members, setMembers] = useState<MemberData[]>([]); 
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isAddNewMemberOpen, setIsAddNewMemberOpen] = useState(false);
  const [deleteModal, setDeleteModal] = useState<DeleteModalState>({ isOpen: false, member: null });
  const [isDeleting, setIsDeleting] = useState(false); 

  
  const fetchCoachMembers = useCallback(async () => {
    if (!coachId) {
      setError("Koç ID'si bulunamadı.");
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    
    try {
      // 1. Get System Definitions
      const defs = await getSystemDefinitions();
      const coachDefs = defs.filter(d => d.targets && d.targets.includes('coach'));
      setDefinitions(coachDefs);

      // 2. Get Coach Details
      const coachDocRef = doc(db, 'coaches', coachId);
      const coachSnap = await getDocWithCount(coachDocRef); 
      if (coachSnap.exists()) {
        const data = coachSnap.data();
        setCoachDetails({
            username: data.username || coachId,
            customFields: data.customFields || {}
        });
      }

      // 3. Get Members
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
        const packagesSnapshot = await getDocs(packagesColRef); 
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
      
      // Sort: Active members first, then by expiration date
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
      console.error("Error fetching members:", err);
      setError("Üyeler listesi çekilemedi: " + err.message);
    } finally {
      setIsLoading(false);
    }
  }, [coachId]);
  
  useEffect(() => {
    fetchCoachMembers();
  }, [fetchCoachMembers]);

  // Handlers
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
      const packagesColRef = collection(memberDocRef, 'packages');
      const packagesSnapshot = await getDocs(packagesColRef); 
      
      let totalCutToDecrement = 0;
      for (const pkgDoc of packagesSnapshot.docs) {
        const pkgData = pkgDoc.data();
        const pkgShare = (pkgData.share as CoachShare) || { type: '%', value: 0 };
        const pkgPrice = pkgData.price || 0;
        const pkgSessions = pkgData.sessionCount || 0;
        const { companyCut } = calculateFinancials(pkgPrice, pkgShare, pkgSessions);
        totalCutToDecrement += companyCut;
        await deleteDocWithCount(pkgDoc.ref);
      }
      await deleteDocWithCount(memberDocRef);
      const coachDocRef = doc(db, 'coaches', coachId);
      await updateDocWithCount(coachDocRef, {
          totalMembers: increment(-1),
          companyCut: increment(-totalCutToDecrement) 
      });
      handleCloseMemberDeleteConfirm();
      fetchCoachMembers(); 
    } catch (err: any) {
      console.error("Error deleting member:", err);
      setError("Üye silinirken bir hata oluştu: " + err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const getPaymentStatusBadge = (status: PaymentStatusSummary) => {
    switch (status) {
      case 'Paid': return { text: 'Ödendi', color: '#22c55e', bg: 'rgba(34, 197, 94, 0.1)' };
      case 'Partial Payment': return { text: 'Eksik', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)' };
      case 'Unpaid': return { text: 'Ödenmedi', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)' };
      default: return { text: 'Paket Yok', color: '#666', bg: 'rgba(255,255,255,0.05)' };
    }
  };

  return (
    <>
      <div className={styles.coachPage}>
        
        {/* Header */}
        <header className={styles.header}>
          <div style={{display:'flex', flexDirection:'column', gap:'0.5rem'}}>
            <h1 className={styles.pageTitle}>{coachDetails.username}</h1>
            
            {/* Dynamic Info Chips */}
            <div style={{display:'flex', gap:'0.5rem', flexWrap:'wrap'}}>
                {definitions.map(def => {
                    const rawValue = coachDetails.customFields?.[def.id];
                    if(!rawValue || (Array.isArray(rawValue) && rawValue.length === 0)) return null;
                    const displayValue = Array.isArray(rawValue) ? rawValue.join(', ') : rawValue;

                    return (
                        <span key={def.id} style={{ 
                            fontSize: '0.75rem', 
                            color: 'var(--primary-color)', 
                            background: 'var(--primary-bg-light)', 
                            padding: '0.25rem 0.75rem', 
                            borderRadius: '6px', 
                            border: '1px solid var(--primary-border)', 
                            display:'flex', alignItems:'center', gap:'0.3rem', fontWeight: 500 
                        }}>
                            <MapPin size={12}/> {displayValue}
                        </span>
                    );
                })}
            </div>
            
            <p className={styles.pageSubtitle} style={{marginTop:0}}>
              Toplam {members.length} üye kayıtlı.
            </p>
          </div>
          <Link to="/admin/coaches" className={styles.addButton} style={{backgroundColor: '#252525', border: '1px solid #333', color: 'var(--text-muted)'}}>
            <ArrowLeft size={18} />
            <span>Geri Dön</span>
          </Link>
        </header>
        
        {/* Content Area */}
        <div className={styles.listContainer} style={{backgroundColor: 'transparent', border: 'none', padding: 0}}>
          <div className={styles.listHeader} style={{marginBottom: '1.5rem'}}>
            <h2 className={styles.listTitle} style={{fontSize: '1.25rem'}}>Üye Listesi</h2>
            <button className={styles.addButton} onClick={handleAddNewMember}>
              <Plus size={18} />
              <span>Yeni Üye Ekle</span>
            </button>
          </div>

          {isLoading ? (
            <div style={{ padding: '3rem', display: 'flex', justifyContent: 'center' }}>
              <Loader2 size={32} className={formStyles.spinner} />
            </div>
          ) : error ? (
            <div className={formStyles.error} style={{ margin: '1rem' }}>{error}</div>
          ) : members.length === 0 ? (
            <div style={{textAlign:'center', padding:'3rem', color:'#666', border:'1px dashed #333', borderRadius:'12px'}}>
              Bu koça ait üye bulunamadı.
            </div>
          ) : (
            <div className={styles.coachGrid}> 
                {/* Using coachGrid from the module to get the Grid layout for members too */}
                {members.map((member) => {
                  const packageStatus = calculateRemainingDays(member.packageEndDate);
                  const payStatus = getPaymentStatusBadge(member.paymentStatusSummary);
                  
                  return (
                    <div 
                      key={member.id} 
                      className={styles.coachCard}
                      onClick={() => handleMemberClick(member.id)}
                      style={{cursor: 'pointer'}}
                    >
                      {/* Member Card Header */}
                      <div className={styles.cardHeader} style={{marginBottom: '1rem'}}>
                        <div className={styles.coachIdentity}>
                            <div className={styles.avatar} style={{width: '42px', height: '42px', fontSize: '1rem'}}>
                                {member.name.charAt(0).toUpperCase()}
                            </div>
                            <div className={styles.coachInfo}>
                                <span className={styles.coachName} style={{fontSize: '1rem'}}>{member.name}</span>
                                <span style={{
                                    fontSize:'0.7rem', 
                                    color: payStatus.color, 
                                    background: payStatus.bg,
                                    padding: '1px 6px',
                                    borderRadius: '4px',
                                    fontWeight: 600,
                                    display: 'inline-block',
                                    width: 'fit-content'
                                }}>
                                    {payStatus.text}
                                </span>
                            </div>
                        </div>
                        
                        {/* Quick Delete Action */}
                        <button 
                            onClick={(e) => { e.stopPropagation(); handleOpenMemberDeleteConfirm(member); }}
                            style={{
                                background: 'transparent', 
                                border: 'none', 
                                color: '#555', 
                                cursor: 'pointer', 
                                padding: '0.25rem'
                            }}
                            onMouseOver={(e) => e.currentTarget.style.color = '#ef4444'}
                            onMouseOut={(e) => e.currentTarget.style.color = '#555'}
                        >
                            <Trash2 size={16} />
                        </button>
                      </div>

                      {/* Stats Row */}
                      <div className={styles.cardStats} style={{gridTemplateColumns: '1fr 1fr'}}>
                        <div className={styles.statItem}>
                            <span className={styles.statLabel}><Hash size={12}/> Kalan Seans</span>
                            <span className={styles.statValue} style={{color: member.currentSessionCount < 3 ? '#ef4444' : 'var(--text-main)'}}>
                                {member.currentSessionCount}
                            </span>
                        </div>
                        <div className={styles.statItem}>
                            <span className={styles.statLabel}><Calendar size={12}/> Süre</span>
                            <span className={styles.statValue} style={{fontSize: '0.9rem', color: packageStatus.isExpired ? '#666' : 'var(--primary-color)'}}>
                                {packageStatus.text}
                            </span>
                        </div>
                      </div>

                      {/* Footer Action */}
                      <div className={styles.cardActions} style={{marginTop: 'auto', display: 'flex', justifyContent: 'flex-end'}}>
                         <span style={{fontSize: '0.75rem', color: '#666', display: 'flex', alignItems: 'center'}}>
                            Detaylar <ChevronRight size={14} style={{marginLeft: 2}}/>
                         </span>
                      </div>

                    </div>
                  );
                })}
            </div>
          )}
        </div>
      </div>

      <AddNewMemberModal 
        isOpen={isAddNewMemberOpen}
        coachId={coachId!} 
        onClose={handleModalClose}
        onSuccess={handleModalSuccess}
      />

      <Modal isOpen={deleteModal.isOpen} onClose={handleCloseMemberDeleteConfirm} title="Üye Silme Onayı">
        <div className={styles.confirmModalBody}>
          <AlertTriangle size={48} className={styles.confirmIcon} />
          <p>
            <strong>{deleteModal.member?.name}</strong> isimli üyeyi kalıcı olarak silmek istediğinizden emin misiniz?
            <br/><br/>
            <strong style={{color: '#ef4444'}}>Bu işlem, üyeye ait TÜM PAKET GEÇMİŞİNİ geri alınamaz şekilde silecektir!</strong>
          </p>
          <div className={formStyles.formActions}> 
              <button type="button" onClick={handleCloseMemberDeleteConfirm} className={`${formStyles.submitButton} ${formStyles.secondary}`} disabled={isDeleting}>Vazgeç</button>
              <button type="button" onClick={handleConfirmMemberDelete} className={`${formStyles.submitButton} ${formStyles.danger}`} disabled={isDeleting}>
                  {isDeleting ? <Loader2 size={18} className={formStyles.spinner} /> : 'Evet, Üyeyi Sil'}
              </button>
          </div>
        </div>
      </Modal>
    </>
  );
};

export default CoachMembers;