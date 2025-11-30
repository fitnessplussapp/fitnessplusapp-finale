// src/pages/Maintenance/Maintenance.tsx

import React from 'react';
import styles from './Maintenance.module.css';
import { 
  Server, 
  Database, 
  ShieldCheck, 
  Loader2, 
  CheckCircle2, 
  AlertTriangle
} from 'lucide-react';

// Logo importu - Dosya yolu: src/assets/logo.png
import appLogo from '../../assets/logo.png'; 

// === GÖREV LİSTESİ ===
// Veritabanı üzerinde çalışırken burayı güncelleyerek
// kullanıcılara hangi aşamada olduğunuzu gösterebilirsiniz.
const MAINTENANCE_TASKS = [
  { 
    id: 1, 
    label: "Sistem ve Veritabanı Düzenlemesi", 
    status: "completed" as const // 'completed' | 'in-progress' | 'pending'
  },
  { 
    id: 2, 
    label: "Firestore Veri Yapısının Dönüştürülmesi", 
    status: "in-progress" as const 
  },
  { 
    id: 3, 
    label: "Yeni Güvenlik Kurallarının Tanımlanması", 
    status: "pending" as const 
  },
  { 
    id: 4, 
    label: "Performans Testleri ve Sistem Kontrolü", 
    status: "pending" as const 
  }
];

const MaintenancePage: React.FC = () => {
  return (
    <div className={styles.container}>
      
      <div className={styles.contentWrapper}>
        
        {/* HEADER */}
        <div className={styles.header}>
          <img src={appLogo} alt="Logo" className={styles.logoIcon} />
          <h1 className={styles.title}>Sistem Bakımda</h1>
          <p className={styles.description}>
            ESPERTO PT deneyimini iyileştirmek için altyapımızda büyük bir güncelleme yapıyoruz. 
            Lütfen kısa bir süre sonra tekrar deneyin.
          </p>
        </div>

        {/* CANLI DURUM KARTI */}
        <div className={styles.statusCard}>
          <div className={styles.cardHeader}>
            <div className={styles.cardTitle}>
              <div className={styles.pulse}></div>
              <span>CANLI SİSTEM DURUMU</span>
            </div>
            <span style={{ fontSize: '0.8rem', color: '#666', fontFamily: 'monospace' }}>
              v2.0_MIGRATION
            </span>
          </div>

          <div className={styles.taskList}>
            {MAINTENANCE_TASKS.map((task) => (
              <div 
                key={task.id} 
                className={`${styles.taskItem} ${task.status === 'in-progress' ? styles.active : ''}`}
              >
                <div className={styles.taskName}>
                  {/* İkon Seçimi */}
                  {task.id === 1 && <Database size={16} />}
                  {task.id === 2 && <Server size={16} />}
                  {task.id === 3 && <ShieldCheck size={16} />}
                  {task.id === 4 && <CheckCircle2 size={16} />}
                  <span>{task.label}</span>
                </div>

                {/* Durum Rozeti */}
                {task.status === 'completed' && (
                  <span className={`${styles.statusBadge} ${styles.statusCompleted}`}>
                    TAMAMLANDI
                  </span>
                )}
                {task.status === 'in-progress' && (
                  <span className={`${styles.statusBadge} ${styles.statusProgress}`}>
                    <Loader2 size={12} className={styles.spinner} />
                    İŞLENİYOR
                  </span>
                )}
                {task.status === 'pending' && (
                  <span className={`${styles.statusBadge} ${styles.statusPending}`}>
                    BEKLİYOR
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Tahmini Süre Uyarısı */}
          <div style={{ 
            marginTop: '1rem', 
            padding: '0.8rem', 
            backgroundColor: 'rgba(234, 179, 8, 0.1)', 
            border: '1px solid rgba(234, 179, 8, 0.2)', 
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '0.8rem',
            color: '#fbbf24',
            fontSize: '0.85rem'
          }}>
            <AlertTriangle size={20} />
            <span>
              <strong>Tahmini Bitiş:</strong> İşlemlerin yaklaşık 1-2 saat sürmesi beklenmektedir...
            </span>
          </div>

        </div>

      </div>

      <div className={styles.footer}>
        &copy; {new Date().getFullYear()} Esperto PT 
      </div>

    </div>
  );
};

export default MaintenancePage;