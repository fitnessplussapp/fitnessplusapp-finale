import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './CoachManagement.module.css';
import { Plus, Users, Calendar, DollarSign, Wallet, Loader2 } from 'lucide-react';

// YENİ SERVİS
import { dbService } from '../../../services/DatabaseService';
import type { CoachProfile } from '../../../types/schema';

// BİLEŞENLER
import AddCoach from './AddCoach';

const CoachManagement: React.FC = () => {
  const navigate = useNavigate();
  const [coaches, setCoaches] = useState<CoachProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Verileri çek (Tek fonksiyon, temiz kod)
  const fetchCoaches = async () => {
    setIsLoading(true);
    try {
      const data = await dbService.getAllCoaches();
      setCoaches(data);
    } catch (error) {
      console.error("Koçlar yüklenemedi:", error);
      alert("Veri çekme hatası.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCoaches();
  }, []);

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(val);

  return (
    <div className={styles.coachPage}>
      
      <header className={styles.header}>
        <div>
          <h1 className={styles.pageTitle}>Koç Yönetimi (v3.0 Enterprise)</h1>
          <p className={styles.pageSubtitle}>Profesyonel Koç ve Finans Takibi</p>
        </div>
        <button className={styles.addButton} onClick={() => setIsAddModalOpen(true)}>
          <Plus size={18} />
          <span>Yeni Koç Ekle</span>
        </button>
      </header>

      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
          <Loader2 size={32} className="spin" />
        </div>
      ) : (
        <div className={styles.coachGrid}>
          {coaches.map(coach => (
            <div key={coach.id} className={styles.coachCard}>
              
              {/* Header */}
              <div className={styles.cardHeader}>
                <div className={styles.coachIdentity}>
                  <div className={styles.avatar}>
                    {coach.fullName.charAt(0).toUpperCase()}
                  </div>
                  <div className={styles.coachInfo}>
                    <span className={styles.coachName}>{coach.fullName}</span>
                    <span className={styles.statusBadge}>
                      {coach.branchId || 'Merkez'}
                    </span>
                  </div>
                </div>
              </div>

              {/* v3.0 İstatistikler (Metrics) - HIZLI OKUMA */}
              <div className={styles.cardStats}>
                <div className={styles.statItem}>
                  <span className={styles.statLabel}><Users size={14}/> Aktif Üye</span>
                  <span className={styles.statValue}>{coach.metrics.activeClients}</span>
                </div>
                <div className={styles.statItem}>
                  <span className={styles.statLabel}><Wallet size={14}/> Bakiye (Hakediş)</span>
                  <span className={`${styles.statValue} ${styles.highlight}`}>
                    {formatCurrency(coach.metrics.walletBalance)}
                  </span>
                </div>
                <div className={styles.statItem}>
                  <span className={styles.statLabel}><Calendar size={14}/> Toplam Ders</span>
                  <span className={styles.statValue}>{coach.metrics.totalSessionsDelivered}</span>
                </div>
              </div>

              {/* Aksiyonlar */}
              <div className={styles.cardActions}>
                <button className={styles.actionButton} onClick={() => navigate(`/admin/coaches/${coach.id}/schedule`)}>
                  Program
                </button>
                <button className={`${styles.actionButton} ${styles.primaryBtn}`} onClick={() => navigate(`/admin/coaches/${coach.id}`)}>
                  Detay & Üyeler
                </button>
              </div>

            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      <AddCoach 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)} 
        onCoachAdded={fetchCoaches} 
      />

    </div>
  );
};

export default CoachManagement;