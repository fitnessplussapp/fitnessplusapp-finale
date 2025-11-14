import React, { useState, useEffect } from 'react';
import styles from './Settings.module.css';
import { 
  BarChart, 
  DatabaseZap, 
  Download, 
  FileJson, 
  AlertTriangle,
  Loader2
} from 'lucide-react';
import { getTodaysUsage } from '../../../firebase/firestoreService';

// Sabit (statik) limitler
const DAILY_LIMITS = {
  reads: 50000,
  writes: 20000,
  deletes: 20000,
};

// Progress bar için yardımcı bileşen
const LimitProgressBar: React.FC<{ label: string, current: number, max: number, barColorClass: string }> = ({
  label, current, max, barColorClass
}) => {
  const percentage = max > 0 ? (current / max) * 100 : 0;
  
  return (
    <div className={styles.progressItem}>
      <div className={styles.progressHeader}>
        <span className={styles.progressLabel}>{label}</span>
        <span className={styles.progressValue}>
          {current.toLocaleString()} / {max.toLocaleString()}
        </span>
      </div>
      <div className={styles.progressBarBg}>
        <div 
          className={`${styles.progressBarFill} ${barColorClass}`} 
          style={{ width: `${percentage > 100 ? 100 : percentage}%` }}
        ></div>
      </div>
    </div>
  );
};


const Settings: React.FC = () => {
  const [usage, setUsage] = useState({ reads: 0, writes: 0, deletes: 0 });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchUsage = async () => {
      setIsLoading(true);
      const data = await getTodaysUsage(); 
      setUsage(data);
      setIsLoading(false);
    };
    fetchUsage();
  }, []);

  // Sayaçlar için renk belirleme
  const getBarColor = (current: number, max: number) => {
    const percentage = max > 0 ? (current / max) * 100 : 0;
    if (percentage > 90) return styles.barRed;
    if (percentage > 70) return styles.barOrange;
    return styles.barGold;
  };
  
  // YAZMA LİMİTİ HESAPLAMASI (Kritik)
  // Toplam Yazma Limiti Kullanımı = (Sayılan Okumalar) + (Sayılan Yazmalar)
  const totalWriteUsage = usage.reads + usage.writes;
  const totalWriteColor = getBarColor(totalWriteUsage, DAILY_LIMITS.writes);

  return (
    <div className={styles.settingsPage}>
      
      {/* 1. BÖLÜM: GÜNLÜK KULLANIM LİMİTLERİ (DİNAMİK) */}
      <h2 className={styles.sectionTitle}>
        <BarChart size={20} />
        Günlük Kullanım Kotaları (Spark Plan)
      </h2>
      
      {/*{/* KRİTİK UYARI BİLGİ KUTUSU }
      <div className={styles.infoBox}>
        <AlertTriangle size={18} />
        <strong>Kritik Limit: Yazma (20K/Gün)</strong>
        <p>
          "Tam Sayma" mimarisi aktiftir. Her <strong>Okuma</strong> (Login, veri çekme)
          işlemi, sayacı güncellemek için <strong>1 Yazma</strong> işlemine mal olur.
          Gerçek <strong>Yazma</strong> limitiniz (20K), okuma (50K) limitinizden 
          çok daha hızlı dolacaktır.
        </p>
      </div>
      */}
      {isLoading ? (
        <div className={styles.loaderContainer}>
          <Loader2 className={styles.loader} size={24} />
          <span>Kullanım verileri yükleniyor...</span>
        </div>
      ) : (
        <div className={styles.limitGrid}>
          
          {/* 1. Toplam Yazma Limiti (En Önemlisi) */}
          <LimitProgressBar
            label="Toplam Limit Kullanımı"
            current={totalWriteUsage}
            max={DAILY_LIMITS.writes + "+" + DAILY_LIMITS.reads}
            barColorClass={totalWriteColor}
          />
          
          {/* 2. Okuma (Sayılan) */}
          <LimitProgressBar
            label="-> Okuma İşlemleri (Sayılan)"
            current={usage.reads}
            max={DAILY_LIMITS.reads} // Max'ı 50K (Okuma)
            barColorClass={styles.barBlue}
          />

          {/* 3. Yazma (Sayılan) */}
          <LimitProgressBar
            label="-> Yazma İşlemleri (Sayılan)"
            current={usage.writes}
            max={DAILY_LIMITS.writes} // Max'ı 20K (Yazma)
            barColorClass={styles.barGold}
          />

          {/* 4. Silme (Ayrı Limit) */}
          <LimitProgressBar
            label="Silme İşlemleri (Ayrı Limit)"
            current={usage.deletes}
            max={DAILY_LIMITS.deletes}
            barColorClass={getBarColor(usage.deletes, DAILY_LIMITS.deletes)}
          />
        </div>
      )}

      {/* 2. BÖLÜM: TAM YEDEKLEME (Kilitlendi) */}
      <h2 className={styles.sectionTitle}>
        <DatabaseZap size={20} />
        Tam Veritabanı Yedekleme
      </h2>
      <p className={styles.sectionSubtitle}>
        Tüm veritabanı yedeği, geliştirici tarafından sağlanan harici bir Python
        aracı (.exe) ile alınmalıdır. (Bu özellik proje sonunda eklenecektir).
      </p>
      <a 
        href="/tools/FitnessPlusBackup.exe"
        className={styles.downloadButton}
        download
        onClick={(e) => { 
          e.preventDefault(); 
          alert("Yedekleme aracı proje sonunda eklenecek."); 
        }}
      >
        <Download size={18} />
        Backup Aracı İndir (.exe)
      </a>

      {/* 3. BÖLÜM: SINIRLI YEDEKLEME (Kilitlendi) */}
      <h2 className={styles.sectionTitle}>
        <FileJson size={20} />
        Sınırlı Veri Çıktısı
      </h2>
      <div className={styles.alertBox}>
        <AlertTriangle size={18} />
        <strong>Uyarı:</strong> Bu işlemler, "Okuma" limitinizi (50K) etkiler
        ve "Yazma" limitinizi (20K) tüketir. Çok sık kullanmayınız.
      </div>
      <div className={styles.limitedGrid}>
        <button 
          className={styles.limitedButton} 
          onClick={() => alert("Yakında...")}
        >
          Koç Listesini İndir (JSON)
        </button>
        <button 
          className={styles.limitedButton} 
          onClick={() => alert("Yakında...")}
        >
          Aktif Üye Listesini İndir (JSON)
        </button>
      </div>

    </div>
  );
};

export default Settings;