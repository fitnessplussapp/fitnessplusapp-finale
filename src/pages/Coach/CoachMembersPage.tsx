// src/pages/Coach/CoachMembersPage.tsx

import React, { useEffect, useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ChevronRight, 
  Loader2, 
  Plus, 
  Users, 
  Hash,
  AlertTriangle,
  Search,
  Calendar
} from 'lucide-react';

// Admin stillerini yeniden kullanıyoruz (Tutarlılık için)
import styles from '../Admin/CoachManagement/CoachManagement.module.css'; 
import formStyles from '../../components/Form/Form.module.css'; 

import { useAuth } from '../../context/AuthContext'; 
import { db } from '../../firebase/firebaseConfig';
import { collection, query, Timestamp, getDocs, orderBy } from 'firebase/firestore'; 

import CoachAddNewMemberModal from './CoachAddNewMemberModal'; 

// --- Tipler ---
type PaymentStatusSummary = 'Paid' | 'Partial Payment' | 'Unpaid' | 'No Packages';

interface MemberData {
  id: string;
  name: string;
  packageStartDate: Date | null; 
  packageEndDate: Date | null; 
  totalPackages: number;
  currentSessionCount: number;
  paymentStatusSummary: PaymentStatusSummary;
  latestApprovalStatus: 'Pending' | 'Approved' | null;
}
interface PackageData {
  id: string;
  paymentStatus: 'Paid' | 'Pending';
  approvalStatus?: 'Pending' | 'Approved'; 
  packageNumber?: number;
}

// --- Yardımcı Fonksiyonlar ---
const calculateRemainingDays = (endDate: Date | null): { text: string; isExpired: boolean } => {
  if (!endDate) return { text: 'Paket Yok', isExpired: true };
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endDateStart = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
  
  const diffTime = endDateStart.getTime() - todayStart.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return { text: 'Süresi Doldu', isExpired: true };
  if (diffDays === 0) return { text: 'Bugün Son Gün', isExpired: false };
  return { text: `${diffDays} gün kaldı`, isExpired: false };
};

// YENİ EKLENDİ: Rozet renkleri için yardımcı fonksiyon
const getPaymentStatusBadge = (status: PaymentStatusSummary) => {
    switch (status) {
      case 'Paid': return { text: 'Ödendi', color: '#22c55e', bg: 'rgba(34, 197, 94, 0.1)' };
      case 'Partial Payment': return { text: 'Eksik', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)' };
      case 'Unpaid': return { text: 'Ödenmedi', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)' };
      default: return { text: 'Paket Yok', color: '#666', bg: 'rgba(255,255,255,0.05)' };
    }
};

const CoachMembersPage: React.FC = () => {
  const { currentUser } = useAuth();
  const coachId = currentUser?.username;
  const navigate = useNavigate();

  const [members, setMembers] = useState<MemberData[]>([]); 
  const [filteredMembers, setFilteredMembers] = useState<MemberData[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isAddNewMemberOpen, setIsAddNewMemberOpen] = useState(false);
  
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
        setFilteredMembers([]);
        setIsLoading(false);
        return;
      }
      
      const memberDataPromises = querySnapshot.docs.map(async (memberDoc) => {
        const member = memberDoc.data();
        
        // Paketleri çek
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
          latestApprovalStatus = memberPackages[0].approvalStatus || 'Approved'; 
          const unpaidPackages = memberPackages.filter(p => p.paymentStatus === 'Pending');
          if (unpaidPackages.length === 0) paymentStatusSummary = 'Paid'; 
          else if (unpaidPackages.length === memberPackages.length) paymentStatusSummary = 'Unpaid';
          else paymentStatusSummary = 'Partial Payment';
        }
        
        return {
          id: memberDoc.id,
          name: member.name || "İsimsiz Üye",
          packageStartDate: member.packageStartDate instanceof Timestamp ? member.packageStartDate.toDate() : null,
          packageEndDate: member.packageEndDate instanceof Timestamp ? member.packageEndDate.toDate() : null,
          totalPackages: member.totalPackages || memberPackages.length,
          currentSessionCount: member.currentSessionCount || 0,
          paymentStatusSummary: paymentStatusSummary,
          latestApprovalStatus: latestApprovalStatus
        } as MemberData;
      });

      const resolvedMembers = await Promise.all(memberDataPromises);
      
      // Sıralama
      resolvedMembers.sort((a, b) => {
          if (a.latestApprovalStatus === 'Pending' && b.latestApprovalStatus !== 'Pending') return -1;
          if (a.latestApprovalStatus !== 'Pending' && b.latestApprovalStatus === 'Pending') return 1;

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
      setFilteredMembers(resolvedMembers);
      
    } catch (err: any) {
      console.error(err);
      setError("Üyeler listesi yüklenemedi.");
    } finally {
      setIsLoading(false);
    }
  }, [coachId]);
  
  useEffect(() => {
    fetchCoachMembers();
  }, [fetchCoachMembers]);

  // Arama İşlemi
  useEffect(() => {
      if(!searchTerm) {
          setFilteredMembers(members);
      } else {
          const lower = searchTerm.toLowerCase();
          setFilteredMembers(members.filter(m => m.name.toLowerCase().includes(lower)));
      }
  }, [searchTerm, members]);

  const handleMemberClick = (memberId: string) => {
    navigate(`/coach/members/${memberId}`);
  };

  const handleModalSuccess = () => {
    setIsAddNewMemberOpen(false);
    fetchCoachMembers(); 
  };

  return (
    <>
      <div className={styles.coachPage}>
        
        <h1 className={formStyles.pageTitle}>Üyelerim</h1>
        
        <div className={styles.listContainer} style={{marginTop: '1.5rem', background: 'transparent', border:'none', padding:0}}>
          
          <div className={styles.listHeader} style={{marginBottom:'1.5rem'}}>
            <div style={{display:'flex', alignItems:'center', gap:'1rem'}}>
                <h2 className={styles.listTitle}>Tüm Üyeler ({filteredMembers.length})</h2>
                
                {/* Arama Kutusu */}
                <div style={{position:'relative'}}>
                    <Search size={16} style={{position:'absolute', left:'10px', top:'50%', transform:'translateY(-50%)', color:'#666'}}/>
                    <input 
                        type="text" 
                        placeholder="Üye ara..." 
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        style={{
                            background: '#0a0a0a', border: '1px solid #333', borderRadius: '6px',
                            padding: '0.4rem 0.8rem 0.4rem 2.2rem', color: '#fff', fontSize: '0.9rem', outline: 'none', width:'200px'
                        }}
                    />
                </div>
            </div>
            
            <button className={styles.addButton} onClick={() => setIsAddNewMemberOpen(true)}>
              <Plus size={18} />
              <span>Yeni Üye Ekle</span>
            </button>
          </div>

          {/* GÜNCELLEME: styles.listContent YERİNE styles.coachGrid KULLANIYORUZ */}
          <div className={styles.coachGrid}> 
            
            {isLoading && (
              <div style={{ padding: '2rem', display: 'flex', justifyContent: 'center', gridColumn: '1/-1' }}>
                <Loader2 size={24} className={formStyles.spinner} />
              </div>
            )}
            
            {error && (
              <div className={formStyles.error} style={{ margin: '1rem', gridColumn: '1/-1' }}>{error}</div>
            )}
            
            {!isLoading && !error && members.length === 0 && (
              <div style={{ padding: '3rem', textAlign: 'center', color: '#888', gridColumn: '1/-1', border:'1px dashed #333', borderRadius:'12px' }}>
                <Users size={48} style={{marginBottom:'1rem', opacity:0.5}}/>
                <p>Henüz hiç üyeniz bulunmuyor.</p>
                <p style={{fontSize:'0.9rem'}}>Sağ üstteki buton ile ilk üyenizi ekleyebilirsiniz.</p>
              </div>
            )}

            {!isLoading && !error && filteredMembers.map((member) => {
              const packageStatus = calculateRemainingDays(member.packageEndDate);
              const isPending = member.latestApprovalStatus === 'Pending';
              const payStatus = getPaymentStatusBadge(member.paymentStatusSummary);

              return (
                <div 
                  key={member.id} 
                  // GÜNCELLEME: styles.coachItem yerine styles.coachCard kullanıyoruz (Kutu görünümü için)
                  className={styles.coachCard}
                  onClick={() => handleMemberClick(member.id)}
                  style={{cursor: 'pointer'}}
                >
                  
                  {/* 1. KART BAŞLIĞI (Header) */}
                  <div className={styles.cardHeader} style={{marginBottom: '1rem'}}>
                    <div className={styles.coachIdentity}>
                        <div className={styles.avatar} style={{width: '42px', height: '42px', fontSize: '1rem'}}>
                            {member.name.charAt(0).toUpperCase()}
                        </div>
                        <div className={styles.coachInfo}>
                            <span className={styles.coachName} style={{fontSize: '1rem'}}>{member.name}</span>
                            
                            {/* Rozet: Ödeme veya Onay Durumu */}
                            {isPending ? (
                                <span style={{
                                    fontSize:'0.7rem', color: '#f59e0b', background: 'rgba(245, 158, 11, 0.1)',
                                    padding: '1px 6px', borderRadius: '4px', fontWeight: 600, width: 'fit-content'
                                }}>
                                    Onay Bekliyor
                                </span>
                            ) : (
                                <span style={{
                                    fontSize:'0.7rem', color: payStatus.color, background: payStatus.bg,
                                    padding: '1px 6px', borderRadius: '4px', fontWeight: 600, width: 'fit-content'
                                }}>
                                    {payStatus.text}
                                </span>
                            )}
                        </div>
                    </div>
                  </div>

                  {/* 2. İSTATİSTİKLER (Stats) */}
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
                  
                  {/* 3. AKSİYON / ALT KISIM (Footer) */}
                  <div className={styles.cardActions} style={{marginTop: 'auto', display: 'flex', justifyContent: 'flex-end'}}>
                     <span style={{fontSize: '0.75rem', color: '#666', display: 'flex', alignItems: 'center'}}>
                        Detaylar <ChevronRight size={14} style={{marginLeft: 2}}/>
                     </span>
                  </div>

                </div>
              );
            })}
          </div>
        </div>
      </div>

      <CoachAddNewMemberModal 
        isOpen={isAddNewMemberOpen}
        onClose={() => setIsAddNewMemberOpen(false)}
        onSuccess={handleModalSuccess}
      /> 
    </>
  );
};

export default CoachMembersPage;