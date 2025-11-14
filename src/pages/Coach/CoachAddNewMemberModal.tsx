// src/pages/Coach/CoachAddNewMemberModal.tsx

import React, { useState, useEffect, useMemo } from 'react';
import { Loader2, Calendar, DollarSign, User, Check, BarChart, Hash, TrendingUp } from 'lucide-react'; // TrendingUp eklendi
import Modal from '../../components/Modal/Modal';
import formStyles from '../../components/Form/Form.module.css';

import { useAuth } from '../../context/AuthContext'; 
import { setDocWithCount, getDocWithCount, updateDocWithCount } from '../../firebase/firestoreService';
import { db } from '../../firebase/firebaseConfig';
import { doc, collection, addDoc, serverTimestamp, increment } from 'firebase/firestore'; 

// --- Tipler ---
interface CoachShare {
  value: number;
  type: 'TL' | '%';
}
interface ModalProps {
  isOpen: boolean;
  // GÜNCELLEME: 'memberId' kaldırıldı, yeni üyede buna gerek yok.
  // memberId: string; 
  onClose: () => void;
  onSuccess: () => void;
}
// -----------------

// --- Yardımcı Fonksiyonlar (GÜNCELLENDİ) ---
const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(value);
};

/**
 * GÜNCELLENDİ: 'sessionCount' parametresi eklendi
 */
const calculateFinancials = (
  price: number, 
  coachShare: CoachShare | null,
  sessionCount: number // YENİ
): {
  companyCut: number,
  coachCut: number,
} => {
  let companyCut = 0;
  let coachCut = price;
  
  if (coachShare && coachShare.value > 0) {
    const shareValue = coachShare.value;
    
    if (coachShare.type === 'TL') {
      // YENİ MANTIK: Şirket payı = (Seans Başı TL) * (Toplam Seans)
      companyCut = shareValue * sessionCount; 
      coachCut = Math.max(0, price - companyCut);
    } else {
      // ESKİ MANTIK
      companyCut = price * (shareValue / 100); 
      coachCut = price - companyCut;
    }
  }
  return { companyCut, coachCut };
};

const formatDate = (date: Date): string => {
    return new Intl.DateTimeFormat('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
};
// -----------------------------


const CoachAddNewMemberModal: React.FC<ModalProps> = ({ 
    isOpen, onClose, onSuccess 
}) => {
    
    const { currentUser } = useAuth();
    const coachId = currentUser?.username;

    // State'ler (GÜNCELLENDİ)
    const [name, setName] = useState(''); 
    const [price, setPrice] = useState(0);
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [duration, setDuration] = useState(30);
    const [sessionCount, setSessionCount] = useState(12);
    const [dietitianSupport, setDietitianSupport] = useState(true);
    const [paymentStatus, setPaymentStatus] = useState<'Paid' | 'Pending'>('Paid');
    
    // YENİ: Paket bazlı pay state'leri
    const [shareValue, setShareValue] = useState(0);
    const [shareType, setShareType] = useState<'TL' | '%'>('TL');

    // const [coachShare, setCoachShare] = useState<CoachShare | null>(null); // KALDIRILDI
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const title = 'Yeni Üye ve İlk Paket Kaydı';

    // useEffect (Koç Payı) (KALDIRILDI)
    // (Artık koçun profilinden pay çekmiyoruz)
    // useEffect(() => { ... fetchCoachShare ... }, [isOpen, coachId]);

    // useMemo (Finansal) (GÜNCELLENDİ)
    const financials = useMemo(() => {
        // Yerel state'leri kullan
        const currentShare: CoachShare = { value: shareValue, type: shareType };
        // 'sessionCount'u fonksiyona yolla
        return calculateFinancials(price, currentShare, sessionCount);
    }, [price, shareValue, shareType, sessionCount]); // 'sessionCount' eklendi

    // useMemo (Bitiş Tarihi) (Değişiklik yok)
    const calculatedEndDate = useMemo(() => {
        try {
            const start = new Date(startDate);
            if (isNaN(start.getTime())) return null;
            const end = new Date(start.getTime());
            end.setDate(start.getDate() + duration - 1); 
            return end;
        } catch {
            return null;
        }
    }, [startDate, duration]);

    // useEffect (Form Reset) (GÜNCELLENDİ)
    useEffect(() => {
        if (isOpen) {
            setName('');
            setPrice(0); 
            setStartDate(new Date().toISOString().split('T')[0]);
            setDuration(30);
            setSessionCount(12);
            setPaymentStatus('Paid');
            setDietitianSupport(true);
            // YENİ: Pay state'lerini resetle
            setShareValue(0);
            setShareType('TL');
            setError(null);
        }
    }, [isOpen]);
    // -----------------------------

    // === handleSubmit (GÜNCELLENDİ) ===
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        
        if (!coachId) {
            setError("Koç bilgisi bulunamadı. Lütfen tekrar giriş yapın.");
            return;
        }
        
        // YENİ: 'shareValue' validasyonu eklendi
        if (price <= 0 || duration <= 0 || sessionCount <= 0 || shareValue < 0) {
            setError("Fiyat, süre, seans sayısı ve şirket payı 0 veya daha büyük olmalıdır.");
            return;
        }
        if (!name.trim()) {
            setError("Yeni üye için isim alanı boş bırakılamaz.");
            return;
        }
        if (!calculatedEndDate) {
            setError("Geçerli bir başlangıç tarihi seçin.");
            return;
        }
        
        setIsLoading(true);

        try {
            const parsedStartDate = new Date(startDate);
            const newMemberRef = doc(collection(db, 'coaches', coachId, 'members'));

            // 1. ÜYE PAYLOAD (Değişiklik yok)
            const memberPayload = {
                name: name.trim(),
                packageStartDate: null, // Onay bekleniyor
                packageEndDate: null,   // Onay bekleniyor
                totalPackages: 1, 
                currentSessionCount: 0,
                createdAt: serverTimestamp(),
            };
            
            // 2. PAKET PAYLOAD (GÜNCELLENDİ)
            const packagePayload = {
                price: price,
                createdAt: parsedStartDate,
                duration: duration,
                sessionCount: sessionCount,
                paymentStatus: paymentStatus,
                dietitianSupport: dietitianSupport, 
                approvalStatus: 'Pending', // Admin onayına düşer
                packageNumber: 1, 
                lastUpdated: serverTimestamp(),
                // YENİ: Paket bazlı pay onaya gönderiliyor
                share: {
                    value: shareValue,
                    type: shareType
                } as CoachShare
            };

            // 3. DB İşlemleri
            await setDocWithCount(newMemberRef, memberPayload);
            await addDoc(collection(newMemberRef, 'packages'), packagePayload);
            
            // 4. KOÇ'un üye sayısını güncelle
            const coachDocRef = doc(db, 'coaches', coachId);
            await updateDocWithCount(coachDocRef, {
                totalMembers: increment(1)
            });
            
            onSuccess();
        } catch (err: any) {
            console.error("Yeni üye kaydı sırasında hata:", err);
            setError(`İşlem başarısız oldu: ${err.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    // --- JSX (RENDER) KISMI (GÜNCELLENDİ) ---
    return (
        <Modal isOpen={isOpen} onClose={onClose} title={title}>
            
            {error && <div className={formStyles.error}>{error}</div>}
            
            <form onSubmit={handleSubmit} className={formStyles.form}>
                
                {/* Üye Adı */}
                <div className={formStyles.inputGroup}>
                   <label htmlFor="coach-name">Üye Adı Soyadı</label>
                   <div className={formStyles.inputWrapper}>
                       <User size={20} className={formStyles.inputIcon} />
                       <input 
                         id="coach-name" 
                         type="text" 
                         value={name} 
                         onChange={(e) => setName(e.target.value)}
                         placeholder="Üye adı soyadı" 
                         className={formStyles.input} 
                         required 
                       />
                   </div>
                </div>
                
                {/* Paket Fiyatı */}
                <div className={formStyles.inputGroup}>
                    <label htmlFor="coach-price">Paket Fiyatı (TL)</label>
                    <div className={formStyles.inputWrapper}>
                        <DollarSign size={20} className={formStyles.inputIcon} />
                        <input id="coach-price" type="number" value={price === 0 ? '' : price} onChange={(e) => setPrice(Number(e.target.value) || 0)} placeholder="0" className={formStyles.input} min="1" required />
                    </div>
                </div>
                
                {/* YENİ: Şirket Payı Alanı Eklendi */}
                <div className={formStyles.inputGroup}>
                  <label htmlFor="coach-shareValue">Şirketin Alacağı Pay (TL ise Seans Başı, % ise Toplamdan)</label>
                  <div className={formStyles.compoundInputWrapper}>
                    <TrendingUp size={18} className={formStyles.inputIcon} />
                    <input
                      id="coach-shareValue"
                      type="number"
                      step="any" 
                      placeholder="Değer girin (Örn: 20)"
                      className={formStyles.input}
                      value={shareValue === 0 ? '' : shareValue}
                      onChange={(e) => setShareValue(Number(e.target.value) || 0)}
                      disabled={isLoading}
                      min="0"
                      required
                    />
                    <div className={formStyles.typeToggleGroup}>
                      <button 
                        type="button"
                        className={`${formStyles.toggleButton} ${shareType === 'TL' ? formStyles.toggleActive : ''}`}
                        onClick={() => setShareType('TL')}
                        disabled={isLoading}
                      >
                        TL
                      </button>
                      <button 
                        type="button"
                        className={`${formStyles.toggleButton} ${shareType === '%' ? formStyles.toggleActive : ''}`}
                        onClick={() => setShareType('%')}
                        disabled={isLoading}
                      >
                        %
                      </button>
                    </div>
                  </div>
                </div>
                {/* ----------------------------- */}

                {/* Süre / Seans */}
                <div className={formStyles.gridGroup} style={{ gridTemplateColumns: '1fr 1fr' }}>
                    <div className={formStyles.inputGroup}>
                        <label htmlFor="coach-duration">Süre (Gün)</label>
                        <div className={formStyles.inputWrapper}>
                            <BarChart size={20} className={formStyles.inputIcon} />
                            <input id="coach-duration" type="number" value={duration === 0 ? '' : duration} onChange={(e) => setDuration(Number(e.target.value) || 0)} placeholder="30" className={formStyles.input} min="1" required />
                        </div>
                    </div>
                    <div className={formStyles.inputGroup}>
                        <label htmlFor="coach-sessionCount">Seans Sayısı</label>
                        <div className={formStyles.inputWrapper}>
                            <Hash size={20} className={formStyles.inputIcon} />
                            <input id="coach-sessionCount" type="number" value={sessionCount === 0 ? '' : sessionCount} onChange={(e) => setSessionCount(Number(e.target.value) || 0)} placeholder="12" className={formStyles.input} min="1" required />
                        </div>
                    </div>
                </div>

                {/* Finansal Özet (Artık yerel state'e bağlı) */}
                 <div className={formStyles.formSummaryBox}>
                     <div className={formStyles.summaryItem}><span>Şirket Payı:</span><strong>{formatCurrency(financials.companyCut)}</strong></div>
                     <div className={`${formStyles.summaryItem} ${formStyles.positive}`}><span>Koça Kalan:</span><strong>{formatCurrency(financials.coachCut)}</strong></div>
                 </div>

                {/* Diğer Form Elemanları */}
                <div className={formStyles.inputGroup}>
                    <label htmlFor="coach-startDate">Paket Başlangıç Tarihi</label>
                    <div className={formStyles.inputWrapper}>
                        <Calendar size={20} className={formStyles.inputIcon} />
                        <input id="coach-startDate" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={formStyles.input} required />
                    </div>
                </div>
                <div className={formStyles.inputGroup}>
                    <label>Hesaplanan Bitiş Tarihi</label>
                    <input type="text" readOnly disabled className={formStyles.input} value={calculatedEndDate ? `${formatDate(calculatedEndDate)} (${duration} gün sonra)` : 'Hatalı Tarih'} style={{ paddingLeft: '1rem' }} />
                </div>
                <div className={formStyles.inputGroup}>
                    <label htmlFor="coach-paymentStatus">Ödeme Durumu</label>
                    <div className={formStyles.inputWrapper}>
                        <Check size={20} className={formStyles.inputIcon} />
                        <select id="coach-paymentStatus" value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value as 'Paid' | 'Pending')} className={formStyles.input}>
                            <option value="Paid">Ödendi</option>
                            <option value="Pending">Beklemede</option>
                        </select>
                    </div>
                </div>
                <div className={formStyles.inputGroup}>
                    <label className={formStyles.checkboxLabel}>
                        <input type="checkbox" checked={dietitianSupport} onChange={(e) => setDietitianSupport(e.target.checked)} />
                        Diyetisyen Desteği Dahil
                    </label>
                </div>

                {/* Butonlar */}
                <div className={formStyles.formActions}>
                    <button type="button" onClick={onClose} className={`${formStyles.submitButton} ${formStyles.secondary}`} disabled={isLoading}>İptal</button>
                    <button type="submit" className={`${formStyles.submitButton} ${formStyles.primary}`} disabled={isLoading}>
                        {isLoading ? <Loader2 size={18} className={formStyles.spinner} /> : 'Onaya Gönder'}
                    </button>
                </div>
            </form>
        </Modal>
    );
};

export default CoachAddNewMemberModal;