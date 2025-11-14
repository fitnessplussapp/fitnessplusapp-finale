// src/pages/Admin/CoachManagement/members/AddNewMemberModal.tsx

import React, { useState, useEffect, useMemo } from 'react';
import { Loader2, Calendar, DollarSign, User, Check, BarChart, Hash, TrendingUp, Eye, EyeOff } from 'lucide-react';
import Modal from '../../../../components/Modal/Modal';
import formStyles from '../../../../components/Form/Form.module.css';

import { setDocWithCount, getDocWithCount, updateDocWithCount } from '../../../../firebase/firestoreService';
import { db } from '../../../../firebase/firebaseConfig';
import { doc, collection, addDoc, serverTimestamp, increment } from 'firebase/firestore'; 

// --- Tipler ---
interface CoachShare {
  value: number;
  type: 'TL' | '%';
}
interface ModalProps {
  isOpen: boolean;
  coachId: string;
  onClose: () => void;
  onSuccess: () => void;
}
// -----------------

// --- Yardımcı Fonksiyonlar (GÜNCELLENDİ) ---
const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(value);
};

/**
 * GÜNCELLENDİ: Artık 'sessionCount' (seans sayısı) parametresini alıyor.
 */
const calculateFinancials = (
  price: number, 
  coachShare: CoachShare | null,
  sessionCount: number // YENİ PARAMETRE
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
      // ESKİ MANTIK: Şirket payı = Toplam Fiyat * Yüzde
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


const AddNewMemberModal: React.FC<ModalProps> = ({ 
    isOpen, coachId, onClose, onSuccess 
}) => {
    
    // State'ler
    const [name, setName] = useState(''); 
    const [price, setPrice] = useState(0);
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [duration, setDuration] = useState(30);
    const [sessionCount, setSessionCount] = useState(12); // Bu state kullanılacak
    const [dietitianSupport, setDietitianSupport] = useState(true);
    const [paymentStatus, setPaymentStatus] = useState<'Paid' | 'Pending'>('Paid');
    const [shareValue, setShareValue] = useState(0);
    const [shareType, setShareType] = useState<'TL' | '%'>('TL');
    
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const title = 'Yeni Üye ve İlk Paket Kaydı';

    // useMemo (Finansal) (GÜNCELLENDİ)
    // Artık 'sessionCount' state'ini de dinliyor ve fonksiyona yolluyor.
    const financials = useMemo(() => {
        const currentShare: CoachShare = { value: shareValue, type: shareType };
        // GÜNCELLENDİ: 'sessionCount' eklendi
        return calculateFinancials(price, currentShare, sessionCount); 
    }, [price, shareValue, shareType, sessionCount]); // GÜNCELLENDİ

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

    // useEffect (Form Reset) (Değişiklik yok)
    useEffect(() => {
        if (isOpen) {
            setName('');
            setPrice(0); 
            setStartDate(new Date().toISOString().split('T')[0]);
            setDuration(30);
            setSessionCount(12);
            setPaymentStatus('Paid');
            setDietitianSupport(true);
            setShareValue(0); 
            setShareType('TL'); 
            setError(null);
        }
    }, [isOpen]);
    // -----------------------------

    // === handleSubmit (Admin Mantığı) (Değişiklik yok) ===
    // (Kod değişmedi çünkü 'financials.companyCut' zaten güncel 'useMemo'dan geliyor)
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        
        // Validasyonlar
        if (!coachId) {
            setError("Koç ID'si bulunamadı. Sayfayı yenileyin.");
            return;
        }
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

            // 1. ÜYE PAYLOAD
            const memberPayload = {
                name: name.trim(),
                packageStartDate: parsedStartDate,
                packageEndDate: calculatedEndDate,
                totalPackages: 1, 
                currentSessionCount: sessionCount,
                createdAt: serverTimestamp(),
            };
            
            // 2. PAKET PAYLOAD
            const packagePayload = {
                price: price,
                createdAt: parsedStartDate, 
                duration: duration,
                sessionCount: sessionCount,
                paymentStatus: paymentStatus,
                dietitianSupport: dietitianSupport, 
                approvalStatus: 'Approved', 
                packageNumber: 1, 
                lastUpdated: serverTimestamp(),
                share: {
                    value: shareValue,
                    type: shareType
                } as CoachShare
            };

            // 3. DB İşlemleri
            await setDocWithCount(newMemberRef, memberPayload);
            await addDoc(collection(newMemberRef, 'packages'), packagePayload);
            
            // 4. KOÇ GÜNCELLEMESİ
            // (financials.companyCut zaten 'useMemo'dan doğru hesaplanıyor)
            const coachDocRef = doc(db, 'coaches', coachId);
            await updateDocWithCount(coachDocRef, {
                totalMembers: increment(1),
                companyCut: increment(financials.companyCut)
            });
            
            onSuccess();
        } catch (err: any) {
            console.error("Yeni üye kaydı sırasında hata:", err);
            setError(`İşlem başarısız oldu: ${err.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    // --- JSX (RENDER) BÖLÜMÜ ---
    return (
        <Modal isOpen={isOpen} onClose={onClose} title={title}>
            
            {error && <div className={formStyles.error}>{error}</div>}
            
            <form onSubmit={handleSubmit} className={formStyles.form}>
                
                {/* Üye Adı */}
                <div className={formStyles.inputGroup}>
                   <label htmlFor="name">Üye Adı Soyadı</label>
                   <div className={formStyles.inputWrapper}>
                       <User size={20} className={formStyles.inputIcon} />
                       <input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Üye adı soyadı" className={formStyles.input} required />
                   </div>
                </div>
                
                {/* Paket Fiyatı */}
                <div className={formStyles.inputGroup}>
                    <label htmlFor="price">Paket Fiyatı (TL)</label>
                    <div className={formStyles.inputWrapper}>
                        <DollarSign size={20} className={formStyles.inputIcon} />
                        <input id="price" type="number" value={price === 0 ? '' : price} onChange={(e) => setPrice(Number(e.target.value) || 0)} placeholder="0" className={formStyles.input} min="0" required />
                    </div>
                </div>

                {/* Şirket Payı (GÜNCELLENDİ: Label değişti) */}
                <div className={formStyles.inputGroup}>
                  <label htmlFor="shareValue">Şirketin Alacağı Pay (TL ise Seans Başı, % ise Toplamdan)</label>
                  <div className={formStyles.compoundInputWrapper}>
                    <TrendingUp size={18} className={formStyles.inputIcon} />
                    <input
                      id="shareValue"
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
                        <label htmlFor="duration">Süre (Gün)</label>
                        <div className={formStyles.inputWrapper}>
                            <BarChart size={20} className={formStyles.inputIcon} />
                            <input id="duration" type="number" value={duration === 0 ? '' : duration} onChange={(e) => setDuration(Number(e.target.value) || 0)} placeholder="30" className={formStyles.input} min="1" required />
                        </div>
                    </div>
                    <div className={formStyles.inputGroup}>
                        <label htmlFor="sessionCount">Seans Sayısı</label>
                        <div className={formStyles.inputWrapper}>
                            <Hash size={20} className={formStyles.inputIcon} />
                            {/* Değişiklik: onChange'de 'setSessionCount' kullanılıyor */}
                            <input id="sessionCount" type="number" value={sessionCount === 0 ? '' : sessionCount} onChange={(e) => setSessionCount(Number(e.target.value) || 0)} placeholder="12" className={formStyles.input} min="1" required />
                        </div>
                    </div>
                </div>

                {/* Finansal Özet (Artık 'sessionCount'a göre de güncelleniyor) */}
                 <div className={formStyles.formSummaryBox}>
                     <div className={formStyles.summaryItem}><span>Şirket Payı:</span><strong>{formatCurrency(financials.companyCut)}</strong></div>
                     <div className={`${formStyles.summaryItem} ${formStyles.positive}`}><span>Koça Kalan:</span><strong>{formatCurrency(financials.coachCut)}</strong></div>
                 </div>

                {/* Başlangıç Tarihi */}
                <div className={formStyles.inputGroup}>
                    <label htmlFor="startDate">Paket Başlangıç Tarihi</label>
                    <div className={formStyles.inputWrapper}>
                        <Calendar size={20} className={formStyles.inputIcon} />
                        <input id="startDate" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={formStyles.input} required />
                    </div>
                </div>

                {/* Bitiş Tarihi */}
                <div className={formStyles.inputGroup}>
                    <label>Hesaplanan Bitiş Tarihi</label>
                    <input type="text" readOnly disabled className={formStyles.input} value={calculatedEndDate ? `${formatDate(calculatedEndDate)} (${duration} gün sonra)` : 'Hatalı Tarih'} style={{ paddingLeft: '1rem' }} />
                </div>

                {/* Ödeme Durumu */}
                <div className={formStyles.inputGroup}>
                    <label htmlFor="paymentStatus">Ödeme Durumu</label>
                    <div className={formStyles.inputWrapper}>
                        <Check size={20} className={formStyles.inputIcon} />
                        <select id="paymentStatus" value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value as 'Paid' | 'Pending')} className={formStyles.input}>
                            <option value="Paid">Ödendi</option>
                            <option value="Pending">Beklemede</option>
                        </select>
                    </div>
                </div>

                {/* Diyetisyen Desteği */}
                <div className={formStyles.inputGroup}>
                    <label className={formStyles.checkboxLabel}>
                        <input type="checkbox" checked={dietitianSupport} onChange={(e) => setDietitianSupport(e.target.checked)} />
                        Diyetisyen Desteği Dahil
                    </label>
                </div>

                {/* Form Butonları */}
                <div className={formStyles.formActions}>
                    <button type="button" onClick={onClose} className={`${formStyles.submitButton} ${formStyles.secondary}`} disabled={isLoading}>İptal</button>
                    <button type="submit" className={`${formStyles.submitButton} ${formStyles.primary}`} disabled={isLoading}>
                        {isLoading ? <Loader2 size={18} className={formStyles.spinner} /> : 'Üyeyi ve İlk Paketi Kaydet'}
                    </button>
                </div>
            </form>
        </Modal>
    );
};

export default AddNewMemberModal;