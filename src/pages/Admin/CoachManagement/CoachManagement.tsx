// src/pages/Admin/CoachManagement/CoachManagement.tsx

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './CoachManagement.module.css';
import formStyles from '../../../components/Form/Form.module.css';
import { 
  Plus, 
  Edit, 
  Users,
  Loader2,
  Calendar,
  DollarSign,
  MoreHorizontal,
  Trash2,
  AlertTriangle
} from 'lucide-react';

// Firebase
import { db } from '../../../firebase/firebaseConfig';
import { collection, query, orderBy, doc, getDocs, updateDoc } from 'firebase/firestore'; 
import { getDocsWithCount, updateDocWithCount, deleteDocWithCount } from '../../../firebase/firestoreService';

// Bileşenler
import Switch from '../../../components/Switch/Switch';
import AddCoach from './AddCoach';
import EditCoach from './EditCoach';
import Modal from '../../../components/Modal/Modal'; 

// --- TİP TANIMI ---
export interface CoachData {
  id: string; 
  username: string;
  isActive: boolean;
  totalMembers: number; 
  companyCut: number; // YENİ: Şirket payı gösterimi için
  customFields?: { [key: string]: any };
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(value);
};

const CoachManagement: React.FC = () => {
  const navigate = useNavigate();
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedCoach, setSelectedCoach] = useState<CoachData | null>(null);
  const [coaches, setCoaches] = useState<CoachData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isToggling, setIsToggling] = useState<string | null>(null); 
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchCoaches = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const coachesCollection = collection(db, 'coaches');
      const q = query(coachesCollection, orderBy('username')); 
      
      const querySnapshot = await getDocsWithCount(q);
      
      const coachListPromises = querySnapshot.docs.map(async (coachDoc) => {
        const coachData = coachDoc.data();
        
        // Üye sayısını doğrula (Otomatik Onarım)
        const membersColRef = collection(db, 'coaches', coachDoc.id, 'members');
        const membersSnapshot = await getDocs(membersColRef); 
        const realMemberCount = membersSnapshot.size;
        
        if (coachData.totalMembers !== realMemberCount) {
          const coachRef = doc(db, 'coaches', coachDoc.id);
          await updateDoc(coachRef, { totalMembers: realMemberCount }); 
        }

        return {
          id: coachDoc.id,
          username: coachData.username,
          isActive: coachData.isActive,
          totalMembers: realMemberCount,
          companyCut: coachData.companyCut || 0, // Finansal veri
          customFields: coachData.customFields || {}
        } as CoachData;
      });

      const coachList = await Promise.all(coachListPromises);
      setCoaches(coachList);
    } catch (err: any) {
      console.error("Koçlar çekilemedi:", err);
      setError("Veri yüklenirken hata oluştu.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCoaches();
  }, []);

  // --- DURUM DEĞİŞTİRME (AKTİF/PASİF) ---
  const handleToggleStatus = async (coach: CoachData, newStatus: boolean) => {
    setIsToggling(coach.id); 
    try {
      const coachRef = doc(db, 'coaches', coach.id);
      await updateDocWithCount(coachRef, { isActive: newStatus });
      setCoaches(prev => prev.map(c => c.id === coach.id ? { ...c, isActive: newStatus } : c));
    } catch (err) {
      console.error(err);
      alert("Durum güncellenemedi.");
    } finally {
      setIsToggling(null); 
    }
  };

  // --- SİLME İŞLEMİ (RECURSIVE DELETE) ---
  // Bu fonksiyon EditCoach modalından tetiklenecek
  const handleCoachDelete = async (coachId: string) => {
    setIsDeleting(true);
    try {
        // 1. Koçun tüm üyelerini bul
        const membersRef = collection(db, 'coaches', coachId, 'members');
        const membersSnap = await getDocs(membersRef);

        // 2. Her üyenin paketlerini ve kendisini sil
        for (const memberDoc of membersSnap.docs) {
            const packagesRef = collection(memberDoc.ref, 'packages');
            const packagesSnap = await getDocs(packagesRef);
            
            // Paketleri sil
            const deletePackagesPromises = packagesSnap.docs.map(p => deleteDocWithCount(p.ref));
            await Promise.all(deletePackagesPromises);

            // Üyeyi sil
            await deleteDocWithCount(memberDoc.ref);
        }

        // 3. Koçun programını (schedule) sil
        const scheduleRef = collection(db, 'coaches', coachId, 'schedule');
        const scheduleSnap = await getDocs(scheduleRef);
        const deleteSchedulePromises = scheduleSnap.docs.map(s => deleteDocWithCount(s.ref));
        await Promise.all(deleteSchedulePromises);

        // 4. Koçu sil
        await deleteDocWithCount(doc(db, 'coaches', coachId));

        // UI Güncelle
        setIsEditModalOpen(false);
        fetchCoaches();

    } catch (err) {
        console.error("Silme hatası:", err);
        alert("Koç silinirken bir hata oluştu. Konsolu kontrol edin.");
    } finally {
        setIsDeleting(false);
    }
  };

  return (
    <div className={styles.coachPage}>
        
        {/* Header */}
        <header className={styles.header}>
            <div>
                <h1 className={styles.pageTitle}>Koç Yönetimi</h1>
                <p className={styles.pageSubtitle}>Sistemdeki antrenörleri ve performanslarını yönetin.</p>
            </div>
            <button className={styles.addButton} onClick={() => setIsAddModalOpen(true)}>
                <Plus size={18} />
                <span>Yeni Koç Ekle</span>
            </button>
        </header>

        {/* Content */}
        {isLoading ? (
            <div style={{ padding: '3rem', display: 'flex', justifyContent: 'center' }}>
                <Loader2 size={32} className={formStyles.spinner} />
            </div>
        ) : error ? (
            <div className={formStyles.error}>{error}</div>
        ) : coaches.length === 0 ? (
            <div style={{textAlign:'center', padding:'3rem', color:'#666', border:'1px dashed #333', borderRadius:'12px'}}>
                Henüz koç bulunmuyor.
            </div>
        ) : (
            <div className={styles.coachGrid}>
                {coaches.map(coach => (
                    <div key={coach.id} className={styles.coachCard}>
                        
                        {/* Card Header: Avatar & Info */}
                        <div className={styles.cardHeader}>
                            <div className={styles.coachIdentity}>
                                <div className={styles.avatar}>
                                    {coach.username.charAt(0).toUpperCase()}
                                </div>
                                <div className={styles.coachInfo}>
                                    <span className={styles.coachName}>{coach.username}</span>
                                    <span className={`${styles.statusBadge} ${coach.isActive ? styles.statusActive : styles.statusPassive}`}>
                                        {coach.isActive ? 'Aktif' : 'Pasif'}
                                    </span>
                                </div>
                            </div>
                            
                            {/* Switch (Toggle Status) */}
                            <Switch 
                                checked={coach.isActive}
                                onChange={(val) => handleToggleStatus(coach, val)}
                                disabled={isToggling === coach.id}
                            />
                        </div>

                        {/* Card Stats */}
                        <div className={styles.cardStats}>
                            <div className={styles.statItem}>
                                <span className={styles.statLabel}><Users size={14}/> Üye Sayısı</span>
                                <span className={styles.statValue}>{coach.totalMembers}</span>
                            </div>
                            <div className={styles.statItem}>
                                <span className={styles.statLabel}><DollarSign size={14}/> Kazanç (Şirket)</span>
                                <span className={`${styles.statValue} ${styles.highlight}`}>
                                    {formatCurrency(coach.companyCut)}
                                </span>
                            </div>
                        </div>

                        {/* Card Actions */}
                        <div className={styles.cardActions}>
                            <button className={styles.actionButton} onClick={() => navigate(`/admin/coaches/${coach.id}/schedule`)}>
                                <Calendar size={16}/> Program
                            </button>
                            <button className={styles.actionButton} onClick={() => { setSelectedCoach(coach); setIsEditModalOpen(true); }}>
                                <Edit size={16}/> Düzenle
                            </button>
                            <button className={`${styles.actionButton} ${styles.primaryBtn}`} onClick={() => navigate(`/admin/coaches/${coach.id}`)}>
                                <Users size={16}/> Üyeler
                            </button>
                        </div>

                    </div>
                ))}
            </div>
        )}

        {/* Modallar */}
        <AddCoach 
            isOpen={isAddModalOpen} 
            onClose={() => setIsAddModalOpen(false)} 
            onCoachAdded={fetchCoaches} 
        />

        <EditCoach 
            isOpen={isEditModalOpen}
            onClose={() => setIsEditModalOpen(false)}
            coach={selectedCoach}
            onCoachUpdated={fetchCoaches}
            onCoachDeleted={handleCoachDelete} // YENİ: Silme fonksiyonunu prop olarak geçiyoruz
            isDeleting={isDeleting}
        />

    </div>
  );
};

export default CoachManagement;