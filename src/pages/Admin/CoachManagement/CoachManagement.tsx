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
  AlertTriangle,
  Percent, // <-- Bu artık kullanılmıyor ama kalabilir
  Calendar
} from 'lucide-react';

// Firebase importları
import { db } from '../../../firebase/firebaseConfig';
import { collection, query, orderBy, doc, getDocs, updateDoc } from 'firebase/firestore'; 
import { getDocsWithCount, updateDocWithCount } from '../../../firebase/firestoreService';

// Gerekli bileşenleri import ediyoruz
import Switch from '../../../components/Switch/Switch';
import AddCoach from './AddCoach';
import EditCoach from './EditCoach';
import Modal from '../../../components/Modal/Modal'; 

// GÜNCELLEME: Koç Tipi (share kaldırıldı)
interface CoachData {
  id: string; 
  username: string;
  isActive: boolean;
  totalMembers: number; 
  // share: { ... } // KALDIRILDI
}

interface ConfirmModalState {
  isOpen: boolean;
  coach: CoachData | null;
  newStatus: boolean;
}

const CoachManagement: React.FC = () => {
  const navigate = useNavigate();
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedCoach, setSelectedCoach] = useState<CoachData | null>(null);
  const [coaches, setCoaches] = useState<CoachData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isToggling, setIsToggling] = useState<string | null>(null); 
  const [confirmModal, setConfirmModal] = useState<ConfirmModalState>({
    isOpen: false,
    coach: null,
    newStatus: false,
  });

  // fetchCoaches (Otomatik Onarım Özellikli)
  // (Bu fonksiyonda değişiklik yapmaya gerek yok, 'share' objesini okumuyordu)
  const fetchCoaches = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const coachesCollection = collection(db, 'coaches');
      const q = query(coachesCollection, orderBy('username')); 
      
      const querySnapshot = await getDocsWithCount(q);
      
      const coachListPromises = querySnapshot.docs.map(async (coachDoc) => {
        const coachData = coachDoc.data();
        
        const membersColRef = collection(db, 'coaches', coachDoc.id, 'members');
        const membersSnapshot = await getDocs(membersColRef); 
        const realMemberCount = membersSnapshot.size;
        
        if (coachData.totalMembers !== realMemberCount) {
          console.warn(`Tutarsızlık bulundu: Koç ${coachData.username} için ${coachData.totalMembers} yazıyor, ancak ${realMemberCount} olmalı. Düzeltiliyor...`);
          const coachRef = doc(db, 'coaches', coachDoc.id);
          await updateDoc(coachRef, { totalMembers: realMemberCount }); 
        }

        return {
          id: coachDoc.id,
          ...coachData,
          totalMembers: realMemberCount,
        } as CoachData;
      });

      const coachList = await Promise.all(coachListPromises);
      
      setCoaches(coachList);
    } catch (err: any) {
      console.error("Koçlar çekilemedi:", err);
      if (err.code === 'permission-denied') {
        setError("Verileri okuma yetkiniz yok. Firestore kurallarını kontrol edin.");
      } else {
        setError("Koç verileri yüklenirken bir hata oluştu.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCoaches();
  }, []);

  // handleToggleStatus (Değişiklik yok)
  const handleToggleStatus = async (coach: CoachData, newStatus: boolean) => {
    setIsToggling(coach.id); 
    setError(null);
    try {
      const coachRef = doc(db, 'coaches', coach.id);
      await updateDocWithCount(coachRef, { isActive: newStatus });
      setCoaches(currentCoaches =>
        currentCoaches.map(c =>
          c.id === coach.id ? { ...c, isActive: newStatus } : c
        )
      );
    } catch (err: any) {
      console.error("Durum güncellenemedi:", err);
      setError("Durum güncellenirken bir hata oluştu.");
    } finally {
      setIsToggling(null); 
    }
  };

  // Diğer fonksiyonlar (Değişiklik yok)
  const handleConfirmCancel = () => {
    setConfirmModal({ isOpen: false, coach: null, newStatus: false });
  };
  const handleConfirmAccept = async () => {
    const { coach, newStatus } = confirmModal;
    if (coach) {
      await handleToggleStatus(coach, newStatus);
    }
    handleConfirmCancel();
  };
  const handleOpenEditModal = (coach: CoachData) => {
    setSelectedCoach(coach);
    setIsEditModalOpen(true);
  };
  const handleViewDetails = (coachId: string) => {
    navigate(`/admin/coaches/${coachId}`);
  };
  const handleViewSchedule = (coachId: string) => {
    navigate(`/admin/coaches/${coachId}/schedule`);
  };

  const actionText = confirmModal.newStatus ? "AKTİF" : "PASİF";
  const coachName = confirmModal.coach?.username || "";

  return (
    <>
      <div className={styles.coachPage}>
        
        <div className={styles.listContainer}>
          
          <div className={styles.listHeader}>
            <h2 className={styles.listTitle}>Koç Kadrosu</h2>
            <button className={styles.addButton} onClick={() => setIsAddModalOpen(true)}>
              <Plus size={18} />
              <span>Yeni Koç Ekle</span>
            </button>
          </div>

          <div className={styles.listContent}>
            
            {/* Yükleme, Hata, Boş durumları (Değişiklik yok) */}
            {isLoading && (
              <div style={{ padding: '2rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem' }}>
                <Loader2 size={24} className={formStyles.spinner} />
                <span>Koçlar Yükleniyor...</span>
              </div>
            )}
            {error && (
              <div className={formStyles.error} style={{ margin: '1rem' }}>{error}</div>
            )}
            {!isLoading && !error && coaches.length === 0 && (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#888' }}>
                Henüz hiç koç eklenmemiş. "Yeni Koç Ekle" butonu ile başlayın.
              </div>
            )}

            {!isLoading && !error && coaches.map((coach) => (
              <div key={coach.id} className={styles.coachItem}>
                
                <div className={styles.coachInfo}>
                  <div className={styles.coachDetails}>
                    <span className={styles.coachName}>{coach.username}</span>
                    <div className={styles.coachStats}>
                        <span>
                            <Users size={14} />
                            {coach.totalMembers} Üye
                        </span>
                        
                        {/* === HATA DÜZELTMESİ (AŞAĞIDAKİ BÖLÜM KALDIRILDI) ===
                          Hatanın kaynağı buydu. 'coach.share' artık yok.
                        <span>
                            <Percent size={14} />
                            {coach.share.type === '%' ? `${coach.share.value}% Pay` : `${coach.share.value} TL Pay`}
                        </span>
                        */}
                    </div>
                  </div>
                </div>
                
                <div className={styles.coachStatus}>
                  <Switch 
                    checked={coach.isActive}
                    onChange={(newCheckedState) => {
                      setConfirmModal({
                        isOpen: true,
                        coach: coach,
                        newStatus: newCheckedState
                      });
                    }}
                    disabled={isToggling === coach.id} 
                  />
                </div>
                
                <div className={styles.coachActions}>
                  <button 
                    className={styles.actionButton}
                    onClick={() => handleOpenEditModal(coach)}
                  >
                    <Edit size={16} />
                    <span className={styles.actionButtonText}>Düzenle</span>
                  </button>
                  
                  <button 
                    className={styles.actionButton}
                    onClick={() => handleViewSchedule(coach.id)}
                  >
                    <Calendar size={16} />
                    <span className={styles.actionButtonText}>Program</span>
                  </button>
                  
                  <button 
                    className={`${styles.actionButton} ${styles.primaryActionButton}`}
                    onClick={() => handleViewDetails(coach.id)}
                  >
                    <Users size={16} />
                    <span className={styles.actionButtonText}>Üyeler</span>
                  </button>
                </div>

              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Modallar (Değişiklik yok) */}
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
      />
      
      <Modal 
        isOpen={confirmModal.isOpen} 
        onClose={handleConfirmCancel} 
        title="Durum Değişikliğini Onayla"
      >
        <div className={styles.confirmModalBody}>
          <AlertTriangle size={48} className={styles.confirmIcon} />
          <p>
            Koç <strong>{coachName}</strong> için durumu <strong>{actionText}</strong> olarak değiştirmek istediğinizden emin misiniz?
          </p>
          <div className={styles.confirmActions}>
            <button className={styles.cancelButton} onClick={handleConfirmCancel}>İptal</button>
            <button className={styles.confirmButton} onClick={handleConfirmAccept}>Evet, Değiştir</button>
          </div>
        </div>
      </Modal>
    </>
  );
};

export default CoachManagement;