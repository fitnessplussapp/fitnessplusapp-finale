// src/pages/Admin/CoachManagement/Payments/CoachPayments.tsx

import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import styles from './CoachPayments.module.css';
import coachStyles from '../CoachManagement.module.css'; // Ana başlık stilleri için

// Datepicker
import DatePicker, { registerLocale } from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { tr } from 'date-fns/locale/tr';

// Icons
import { 
  ArrowLeft, Calculator, Calendar, Users, 
  Loader2, AlertCircle, Wallet
} from 'lucide-react';

// Firebase
import { db } from '../../../../firebase/firebaseConfig';
import { getAllCoaches } from '../../../../firebase/firestoreService';
import { collection, getDocs, query, where, Timestamp } from 'firebase/firestore';

registerLocale('tr', tr);

// --- Tipler ---
interface CoachBasicInfo {
  id: string;
  username: string;
}

interface PackageTransaction {
  id: string;
  memberName: string;
  createdAt: Date;
  price: number;
  sessionCount: number;
  duration: number;
  shareType: 'TL' | '%';
  shareValue: number;
  companyCutAmount: number; // Hesaplanan Tutar
}

const CoachPayments: React.FC = () => {
  // Filtre State'leri
  const [coaches, setCoaches] = useState<CoachBasicInfo[]>([]);
  const [selectedCoach, setSelectedCoach] = useState<string>('');
  const [startDate, setStartDate] = useState<Date>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d;
  });
  const [endDate, setEndDate] = useState<Date>(new Date());
  
  // Veri State'leri
  const [transactions, setTransactions] = useState<PackageTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [coachesLoading, setCoachesLoading] = useState(true);
  const [salaryInput, setSalaryInput] = useState<number>(0);
  
  // --- 1. Koç Listesini Getir ---
  useEffect(() => {
    const fetchCoaches = async () => {
      try {
        const data = await getAllCoaches();
        setCoaches(data);
      } catch (error) {
        console.error("Koçlar yüklenemedi", error);
      } finally {
        setCoachesLoading(false);
      }
    };
    fetchCoaches();
  }, []);

  // --- 2. Seçili Koç ve Tarih Aralığına Göre Paketleri Getir ve Hesapla ---
  useEffect(() => {
    if (!selectedCoach) {
      setTransactions([]);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      setTransactions([]);
      
      try {
        // A. Üyeleri Çek
        const membersRef = collection(db, 'coaches', selectedCoach, 'members');
        const membersSnap = await getDocs(membersRef);
        
        let allTransactions: PackageTransaction[] = [];

        // B. Her üye için paketleri çek (Paralel İşlem)
        const promises = membersSnap.docs.map(async (memberDoc) => {
          const memberData = memberDoc.data();
          const memberName = memberData.name || 'İsimsiz Üye';

          // === ÖNEMLİ: "Esperto" İsimli Üyeleri Yok Say ===
          if (memberName.toLowerCase().includes('esperto')) {
            return; // Bu üyeyi atla
          }
          // ================================================

          const packagesRef = collection(memberDoc.ref, 'packages');
          
          // Tarih Filtresi (Basit Query)
          const startTimestamp = Timestamp.fromDate(new Date(startDate.setHours(0,0,0,0)));
          const endTimestamp = Timestamp.fromDate(new Date(endDate.setHours(23,59,59,999)));

          const q = query(
            packagesRef, 
            where('createdAt', '>=', startTimestamp),
            where('createdAt', '<=', endTimestamp)
          );
          
          const pkgSnap = await getDocs(q);
          
          pkgSnap.forEach((pkgDoc) => {
            const pkg = pkgDoc.data();
            
            // --- HESAPLAMA MANTIĞI ---
            const price = Number(pkg.price) || 0;
            const sessionCount = Number(pkg.sessionCount) || 0;
            const share = pkg.share || { type: '%', value: 0 }; // Varsayılan
            
            let cut = 0;
            if (share.type === 'TL') {
              // Seans Başına TL
              cut = share.value * sessionCount;
            } else {
              // Yüzdelik (%)
              cut = price * (share.value / 100);
            }

            allTransactions.push({
              id: pkgDoc.id,
              memberName: memberName,
              createdAt: (pkg.createdAt as Timestamp).toDate(),
              price: price,
              sessionCount: sessionCount,
              duration: Number(pkg.duration) || 0,
              shareType: share.type,
              shareValue: share.value,
              companyCutAmount: cut
            });
          });
        });

        await Promise.all(promises);
        
        // Tarihe göre sırala (Yeniden eskiye)
        allTransactions.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        setTransactions(allTransactions);

      } catch (error) {
        console.error("Veri çekme hatası:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [selectedCoach, startDate, endDate]);


  // --- TOPLAM HESAPLAMALAR ---
  const totalCompanyReceivable = useMemo(() => {
    return transactions.reduce((sum, item) => sum + item.companyCutAmount, 0);
  }, [transactions]);

  const balance = totalCompanyReceivable - salaryInput;
  
  // Durum Metni ve Rengi
  const getResultStatus = () => {
    if (balance > 0) {
      return { 
        text: 'KOÇ ŞİRKETE ÖDEMELİ', 
        color: '#22c55e', // Yeşil
        amount: balance
      };
    } else if (balance < 0) {
      return {
        text: 'ŞİRKET KOÇA ÖDEMELİ',
        color: '#ef4444', // Kırmızı
        amount: Math.abs(balance)
      };
    } else {
      return {
        text: 'HESAP DENK',
        color: '#A0A0A0',
        amount: 0
      };
    }
  };

  const resultStatus = getResultStatus();
  const selectedCoachName = coaches.find(c => c.id === selectedCoach)?.username || 'Koç';


  // Yardımcılar
  const handlePreset = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - days);
    setEndDate(end);
    setStartDate(start);
  };

  const handleThisMonth = () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date();
    setStartDate(start);
    setEndDate(end);
  };


  return (
    <div className={styles.pageContainer}>
      
      {/* HEADER */}
      <header className={coachStyles.header}>
        <div>
          <h1 className={coachStyles.pageTitle}>Maaş ve Ödeme Hesaplayıcı</h1>
          <p className={coachStyles.pageSubtitle}>
            Koçların hakedişlerini ve şirkete ödeyecekleri payı hesaplayın.
          </p>
        </div>
        <Link to="/admin" className={coachStyles.backButton}>
          <ArrowLeft size={18} />
          <span>Panele Dön</span>
        </Link>
      </header>

      {/* FİLTRE ALANI */}
      <div className={styles.filterSection}>
        <div className={styles.filterHeader}>
          <div className={styles.filterTitle}>
            <Calculator size={20} color="#D4AF37" />
            Hesaplama Kriterleri
          </div>
          <div className={styles.presetContainer}>
             <button onClick={() => handlePreset(7)} className={styles.presetButton}>7 Gün</button>
             <button onClick={() => handlePreset(30)} className={styles.presetButton}>30 Gün</button>
             <button onClick={handleThisMonth} className={styles.presetButton}>Bu Ay</button>
          </div>
        </div>

        <div className={styles.filterControls}>
            {/* 1. Koç Seçimi */}
            <div className={styles.inputGroup}>
                <label>Koç Seçin</label>
                <div className={styles.inputWrapper}>
                    <Users size={18} className={styles.inputIcon} />
                    <select 
                        className={styles.selectInput}
                        value={selectedCoach}
                        onChange={(e) => setSelectedCoach(e.target.value)}
                        disabled={coachesLoading}
                    >
                        <option value="">-- Seçiniz --</option>
                        {coaches.map(c => (
                            <option key={c.id} value={c.id}>{c.username}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* 2. Başlangıç Tarihi */}
            <div className={styles.inputGroup}>
                <label>Başlangıç Tarihi</label>
                <div className={styles.inputWrapper}>
                    <Calendar size={18} className={styles.inputIcon} />
                    <DatePicker
                        selected={startDate}
                        onChange={(date) => date && setStartDate(date)}
                        selectsStart
                        startDate={startDate}
                        endDate={endDate}
                        locale="tr"
                        dateFormat="dd.MM.yyyy"
                        className={styles.dateInput}
                    />
                </div>
            </div>

            {/* 3. Bitiş Tarihi */}
            <div className={styles.inputGroup}>
                <label>Bitiş Tarihi</label>
                <div className={styles.inputWrapper}>
                    <Calendar size={18} className={styles.inputIcon} />
                    <DatePicker
                        selected={endDate}
                        onChange={(date) => date && setEndDate(date)}
                        selectsEnd
                        startDate={startDate}
                        endDate={endDate}
                        minDate={startDate}
                        locale="tr"
                        dateFormat="dd.MM.yyyy"
                        className={styles.dateInput}
                    />
                </div>
            </div>
        </div>
      </div>

      {/* YÜKLENİYOR */}
      {loading && (
          <div className={styles.loadingContainer}>
              <Loader2 size={40} className={styles.spinner} />
              <p>Veriler hesaplanıyor...</p>
          </div>
      )}

      {/* SONUÇLAR (Sadece koç seçili ve yükleme bitmişse) */}
      {!loading && selectedCoach && (
          <div className={styles.summarySection}>
              
              {/* SOL: DETAYLI TABLO */}
              <div className={styles.tableCard}>
                  <div className={styles.tableHeader}>
                      <AlertCircle size={18} color="#D4AF37" />
                      Paket ve Pay Detayları ({transactions.length})
                  </div>
                  
                  {transactions.length === 0 ? (
                      <p style={{color: '#777', textAlign: 'center', padding: '2rem'}}>
                          Bu tarih aralığında herhangi bir paket satışı bulunamadı.
                      </p>
                  ) : (
                      <table className={styles.transactionsTable}>
                          <thead>
                              <tr>
                                  <th>Tarih</th>
                                  <th>Üye Adı</th>
                                  <th>Paket Tutarı</th>
                                  <th>Anlaşma</th>
                                  <th>Şirket Payı</th>
                              </tr>
                          </thead>
                          <tbody>
                              {transactions.map(t => (
                                  <tr key={t.id}>
                                      <td>{t.createdAt.toLocaleDateString('tr-TR')}</td>
                                      <td>{t.memberName}</td>
                                      <td>{t.price.toLocaleString('tr-TR')} TL</td>
                                      <td>
                                          <span className={styles.shareBadge}>
                                              {t.shareType === 'TL' 
                                                  ? `${t.shareValue} TL x ${t.sessionCount} Seans` 
                                                  : `%${t.shareValue} Kesinti`
                                              }
                                          </span>
                                      </td>
                                      <td style={{color: '#D4AF37', fontWeight: '600'}}>
                                          {t.companyCutAmount.toLocaleString('tr-TR')} TL
                                      </td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                  )}
              </div>

              {/* SAĞ: HESAP MAKİNESİ */}
              <div className={styles.calculatorCard}>
                  <div style={{borderBottom: '1px solid #333', paddingBottom: '1rem', marginBottom: '0.5rem'}}>
                      <h3 style={{color: '#FFF', margin: 0, fontSize: '1.2rem'}}>Ödeme Özeti</h3>
                      <span style={{color: '#777', fontSize: '0.9rem'}}>{selectedCoachName}</span>
                  </div>

                  <div className={styles.calcRow}>
                      <span className={styles.calcLabel}>Toplam Şirket Payı</span>
                      <span className={`${styles.calcValue} positive`}>
                          + {totalCompanyReceivable.toLocaleString('tr-TR')} TL
                      </span>
                  </div>

                  <div className={styles.calcRow}>
                      <span className={styles.calcLabel}>Koç Maaş Ödemesi</span>
                      <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
                        <span style={{color: '#ef4444', fontWeight: 'bold'}}>-</span>
                        <input 
                            type="number" 
                            className={styles.salaryInput}
                            value={salaryInput === 0 ? '' : salaryInput}
                            onChange={(e) => setSalaryInput(Number(e.target.value))}
                            placeholder="0"
                        />
                      </div>
                  </div>

                  <div className={styles.resultBox} style={{
                      borderColor: resultStatus.color,
                      backgroundColor: `${resultStatus.color}15` // %10 opacity
                  }}>
                      <span className={styles.resultLabel} style={{color: resultStatus.color}}>
                          {resultStatus.text}
                      </span>
                      <span className={styles.resultAmount}>
                          {resultStatus.amount.toLocaleString('tr-TR')} TL
                      </span>
                  </div>
                  
                  <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: 'auto', color: '#666', fontSize: '0.8rem'}}>
                      <Wallet size={16} />
                      <span>Bu işlem sadece hesaplama amaçlıdır. Veritabanına kaydedilmez.</span>
                  </div>
              </div>

          </div>
      )}

      {!selectedCoach && !loading && (
           <div style={{
               textAlign: 'center', 
               padding: '4rem', 
               color: '#555', 
               border: '2px dashed #333', 
               borderRadius: '12px',
               marginTop: '2rem'
           }}>
               <Users size={48} style={{marginBottom: '1rem', opacity: 0.5}} />
               <p>Hesaplama yapmak için lütfen yukarıdan bir <strong>Koç</strong> seçiniz.</p>
           </div>
      )}

    </div>
  );
};

export default CoachPayments;