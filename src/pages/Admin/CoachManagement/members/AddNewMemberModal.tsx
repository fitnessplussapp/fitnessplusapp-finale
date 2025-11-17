// src/pages/Admin/CoachManagement/members/AddNewMemberModal.tsx

import React, { useState, useEffect, useMemo } from 'react';
import { Loader2, Calendar, DollarSign, User, Check, BarChart, Hash, TrendingUp } from 'lucide-react';
import Modal from '../../../../components/Modal/Modal';
import formStyles from '../../../../components/Form/Form.module.css';

import { setDocWithCount, updateDocWithCount } from '../../../../firebase/firestoreService';
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

// --- Yardımcı Fonksiyonlar ---
const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(value);
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
      // Şirket payı = (Seans Başı TL) * (Toplam Seans)
      companyCut = shareValue * sessionCount; 
      coachCut = Math.max(0, price - companyCut);
    } else {
      // Şirket payı = Toplam Fiyat * Yüzde
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
    
    // State'ler (Inputlar için String kullanıyoruz ki silinebilsin)
    const [name, setName] = useState(''); 
    const [price, setPrice] = useState<string>('0');
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [duration, setDuration] = useState<string>('30');
    const [sessionCount, setSessionCount] = useState<string>('12');
    const [dietitianSupport, setDietitianSupport] = useState(true);
    const [paymentStatus, setPaymentStatus] = useState<'Paid' | 'Pending'>('Paid');
    const [shareValue, setShareValue] = useState<string>('0');
    const [shareType, setShareType] = useState<'TL' | '%'>('TL');
    
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const title = 'Yeni Üye ve İlk Paket Kaydı';

    // useMemo (Finansal Hesaplama)
    const financials = useMemo(() => {
        // String değerleri hesaplama için sayıya çeviriyoruz
        const numPrice = Number(price) || 0;
        const numShareValue = Number(shareValue) || 0;
        const numSessionCount = Number(sessionCount) || 0;

        const currentShare: CoachShare = { value: numShareValue, type: shareType };
        return calculateFinancials(numPrice, currentShare, numSessionCount); 
    }, [price, shareValue, shareType, sessionCount]);

    // useMemo (Bitiş Tarihi)
    const calculatedEndDate = useMemo(() => {
        try {
            const start = new Date(startDate);
            const numDuration = Number(duration) || 0;

            if (isNaN(start.getTime())) return null;
            const end = new Date(start.getTime());
            // Duration 0 ise bitiş tarihi başlangıç tarihiyle aynı olabilir
            end.setDate(start.getDate() + Math.max(0, numDuration - 1)); 
            return end;
        } catch {
            return null;
        }
    }, [startDate, duration]);

    // useEffect (Form Reset)
    useEffect(() => {
        if (isOpen) {
            setName('');
            setPrice('0'); 
            setStartDate(new Date().toISOString().split('T')[0]);
            setDuration('30');
            setSessionCount('12');
            setPaymentStatus('Paid');
            setDietitianSupport(true);
            setShareValue('0'); 
            setShareType('TL'); 
            setError(null);
        }
    }, [isOpen]);

    // === handleSubmit ===
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        
        // String değerleri sayıya çevirerek işlem yap
        const numPrice = price === '' ? 0 : Number(price);
        const numDuration = duration === '' ? 0 : Number(duration);
        const numSessionCount = sessionCount === '' ? 0 : Number(sessionCount);
        const numShareValue = shareValue === '' ? 0 : Number(shareValue);

        if (!coachId) {
            setError("Koç ID'si bulunamadı. Sayfayı yenileyin.");
            return;
        }
        // Sadece NEGATİF değerleri engelle (0 serbest)
        if (numPrice < 0 || numDuration < 0 || numSessionCount < 0 || numShareValue < 0) {
            setError("Fiyat, süre, seans sayısı ve şirket payı negatif olamaz.");
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
                currentSessionCount: numSessionCount,
                createdAt: serverTimestamp(),
            };
            
            // 2. PAKET PAYLOAD
            const packagePayload = {
                price: numPrice,
                createdAt: parsedStartDate, 
                duration: numDuration,
                sessionCount: numSessionCount,
                paymentStatus: paymentStatus,
                dietitianSupport: dietitianSupport, 
                approvalStatus: 'Approved', 
                packageNumber: 1, 
                lastUpdated: serverTimestamp(),
                share: {
                    value: numShareValue,
                    type: shareType
                } as CoachShare
            };

            // 3. DB İşlemleri
            await setDocWithCount(newMemberRef, memberPayload);
            await addDoc(collection(newMemberRef, 'packages'), packagePayload);
            
            // 4. KOÇ GÜNCELLEMESİ
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

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={title}>
            
            {error && <div className={formStyles.error}>{error}</div>}
            
            <form onSubmit={handleSubmit} className={formStyles.form}>
                
                {/* Üye Adı */}
                <div className={formStyles.inputGroup}>
                   <label htmlFor="name">Üye Adı Soyadı</label>
                   <div className={formStyles.inputWrapper}>
                       <User size={20} className={formStyles.inputIcon} />
                       <input 
                           id="name" 
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
                    <label htmlFor="price">Paket Fiyatı (TL)</label>
                    <div className={formStyles.inputWrapper}>
                        <DollarSign size={20} className={formStyles.inputIcon} />
                        {/* type="number" kalsa da onChange string alacak */}
                        <input 
                          id="price" 
                          type="number" 
                          value={price} 
                          onChange={(e) => setPrice(e.target.value)} 
                          placeholder="0" 
                          className={formStyles.input} 
                          min="0" 
                          required 
                        />
                    </div>
                </div>

                {/* Şirket Payı */}
                <div className={formStyles.inputGroup}>
                  <label htmlFor="shareValue">Şirketin Alacağı Pay (TL ise Seans Başı, % ise Toplamdan)</label>
                  <div className={formStyles.compoundInputWrapper}>
                    <TrendingUp size={18} className={formStyles.inputIcon} />
                    <input
                      id="shareValue"
                      type="number"
                      step="any" 
                      placeholder="0"
                      className={formStyles.input}
                      value={shareValue}
                      onChange={(e) => setShareValue(e.target.value)}
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
                
                {/* Süre / Seans */}
                <div className={formStyles.gridGroup} style={{ gridTemplateColumns: '1fr 1fr' }}>
                    <div className={formStyles.inputGroup}>
                        <label htmlFor="duration">Süre (Gün)</label>
                        <div className={formStyles.inputWrapper}>
                            <BarChart size={20} className={formStyles.inputIcon} />
                            <input 
                              id="duration" 
                              type="number" 
                              value={duration} 
                              onChange={(e) => setDuration(e.target.value)} 
                              placeholder="30" 
                              className={formStyles.input} 
                              min="0" 
                              required 
                            />
                        </div>
                    </div>
                    <div className={formStyles.inputGroup}>
                        <label htmlFor="sessionCount">Seans Sayısı</label>
                        <div className={formStyles.inputWrapper}>
                            <Hash size={20} className={formStyles.inputIcon} />
                            <input 
                              id="sessionCount" 
                              type="number" 
                              value={sessionCount} 
                              onChange={(e) => setSessionCount(e.target.value)} 
                              placeholder="12" 
                              className={formStyles.input} 
                              min="0" 
                              required 
                            />
                        </div>
                    </div>
                </div>

                {/* Finansal Özet */}
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