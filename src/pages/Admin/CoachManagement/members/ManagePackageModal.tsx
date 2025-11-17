// src/pages/Admin/CoachManagement/members/ManagePackageModal.tsx

import React, { useState, useEffect, useMemo } from 'react';
import { Loader2, Calendar, DollarSign, BarChart, Hash, TrendingUp } from 'lucide-react';
import Modal from '../../../../components/Modal/Modal';
import formStyles from '../../../../components/Form/Form.module.css';
import { updateDocWithCount, getDocWithCount} from '../../../../firebase/firestoreService';
import { db } from '../../../../firebase/firebaseConfig';
import { doc, collection, addDoc, serverTimestamp, increment } from 'firebase/firestore'; 

// --- Tipler ---
interface CoachShare {
  value: number;
  type: 'TL' | '%';
}
interface PackageData {
  id: string;
  createdAt: Date;
  price: number;
  duration: number;
  sessionCount: number;
  paymentStatus: 'Paid' | 'Pending';
  dietitianSupport?: boolean;
  packageNumber?: number;
  share?: CoachShare;
}
interface ModalProps {
  isOpen: boolean;
  mode: 'add-package' | 'edit-package';
  coachId: string;
  memberId: string;
  packageData?: PackageData;
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
      companyCut = shareValue * sessionCount; 
      coachCut = Math.max(0, price - companyCut);
    } else {
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

const ManagePackageModal: React.FC<ModalProps> = ({
  isOpen, mode, coachId, memberId, packageData, onClose, onSuccess
}) => {
  const isEditMode = mode === 'edit-package';

  // State'ler (String olarak başlatıyoruz)
  const [price, setPrice] = useState<string>('0');
  const [startDate, setStartDate] = useState(
    (packageData?.createdAt || new Date()).toISOString().split('T')[0]
  );
  const [duration, setDuration] = useState<string>('30');
  const [sessionCount, setSessionCount] = useState<string>('12');
  const [paymentStatus, setPaymentStatus] = useState<'Paid' | 'Pending'>('Paid');
  const [dietitianSupport, setDietitianSupport] = useState(false);
  const [shareValue, setShareValue] = useState<string>('0');
  const [shareType, setShareType] = useState<'TL' | '%'>('TL');
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const title = isEditMode
    ? `Paket Düzenle: Paket #${packageData?.packageNumber || '?'}`
    : 'Mevcut Üyeye Yeni Paket Ekle';

  // useMemo (Finansal)
  const financials = useMemo(() => {
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
      end.setDate(start.getDate() + Math.max(0, numDuration - 1));
      return end;
    } catch {
      return null;
    }
  }, [startDate, duration]);

  // useEffect (Form Reset ve Veri Yükleme)
  useEffect(() => {
    if (isOpen) {
      if (isEditMode && packageData) {
        // Gelen sayısal verileri string'e çevirip state'e atıyoruz
        setPrice(packageData.price.toString());
        setStartDate(packageData.createdAt.toISOString().split('T')[0]);
        setPaymentStatus(packageData.paymentStatus);
        setDuration(packageData.duration.toString());
        setSessionCount((packageData.sessionCount || 12).toString());
        setDietitianSupport(!!packageData.dietitianSupport);
        setShareValue((packageData.share?.value || 0).toString());
        setShareType(packageData.share?.type || 'TL');
      } else {
        // Yeni kayıt için varsayılan değerler
        setPrice('0');
        setStartDate(new Date().toISOString().split('T')[0]);
        setPaymentStatus('Paid');
        setDuration('30');
        setSessionCount('12');
        setDietitianSupport(false);
        setShareValue('0');
        setShareType('TL');
      }
      setError(null);
    }
  }, [isOpen, mode, packageData]);


  // === handleSubmit ===
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    // Sayıya çevir
    const numPrice = price === '' ? 0 : Number(price);
    const numDuration = duration === '' ? 0 : Number(duration);
    const numSessionCount = sessionCount === '' ? 0 : Number(sessionCount);
    const numShareValue = shareValue === '' ? 0 : Number(shareValue);

    // Negatif kontrolü
    if (numPrice < 0 || numDuration < 0 || numSessionCount < 0 || numShareValue < 0) {
      setError("Fiyat, süre, seans sayısı ve şirket payı negatif olamaz.");
      return;
    }
    if (!calculatedEndDate) {
        setError("Geçerli bir başlangıç tarihi seçin.");
        return;
    }
    setIsLoading(true);

    try {
      const parsedStartDate = new Date(startDate);
      const memberDocRef = doc(db, 'coaches', coachId, 'members', memberId);
      const coachDocRef = doc(db, 'coaches', coachId);
      const currentShare: CoachShare = { value: numShareValue, type: shareType };
      const memberUpdatePayload: any = {
          packageEndDate: calculatedEndDate,
          packageStartDate: parsedStartDate,
      };

      if (isEditMode) {
        // --- DÜZENLEME MODU ---
        
        const oldShare = packageData?.share || { type: '%', value: 0 };
        const oldSessions = packageData?.sessionCount || 0;
        const oldPrice = packageData?.price || 0;
        const { companyCut: oldCompanyCut } = calculateFinancials(oldPrice, oldShare, oldSessions);

        const newCompanyCut = financials.companyCut;
        const cutDifference = newCompanyCut - oldCompanyCut;
        
        const packageDocRef = doc(memberDocRef, 'packages', packageData!.id);
        const memberSnap = await getDocWithCount(memberDocRef);
        const currentRemaining = memberSnap.data()?.currentSessionCount || 0;
        const oldTotal = packageData?.sessionCount || 0;
        const sessionsUsed = Math.max(0, oldTotal - currentRemaining);
        
        const newTotal = numSessionCount;
        const newRemaining = Math.max(0, newTotal - sessionsUsed);
        
        const packagePayload: any = {
          price: numPrice,
          createdAt: parsedStartDate,
          duration: numDuration,
          sessionCount: newTotal,
          paymentStatus: paymentStatus,
          dietitianSupport: dietitianSupport,
          lastUpdated: serverTimestamp(),
          share: currentShare
        };
        await updateDocWithCount(packageDocRef, packagePayload);
        
        // Üye güncelle
        memberUpdatePayload.currentSessionCount = newRemaining;
        await updateDocWithCount(memberDocRef, memberUpdatePayload);
        
        // Koç kazancı güncelle
        if (cutDifference !== 0) {
            await updateDocWithCount(coachDocRef, {
                companyCut: increment(cutDifference)
            });
        }

      } else { 
        // --- YENİ PAKET EKLEME MODU ---
        
        const memberSnap = await getDocWithCount(memberDocRef);
        const currentTotal = memberSnap.data()?.totalPackages || 0;
        const newPackageNumber = currentTotal + 1;

        const packagePayload = {
          price: numPrice,
          createdAt: parsedStartDate,
          duration: numDuration,
          sessionCount: numSessionCount,
          paymentStatus: paymentStatus,
          dietitianSupport: dietitianSupport,
          approvalStatus: 'Approved',
          packageNumber: newPackageNumber,
          lastUpdated: serverTimestamp(),
          share: currentShare
        };
        await addDoc(collection(memberDocRef, 'packages'), packagePayload);
        
        memberUpdatePayload.currentSessionCount = numSessionCount;
        memberUpdatePayload.totalPackages = increment(1);
        await updateDocWithCount(memberDocRef, memberUpdatePayload);

        await updateDocWithCount(coachDocRef, {
            companyCut: increment(financials.companyCut)
        });
      }
      onSuccess();
    } catch (err: any) {
      console.error("Form işlemi sırasında hata oluştu:", err);
      setError(`İşlem başarısız oldu: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>

      {error && <div className={formStyles.error}>{error}</div>}

      <form onSubmit={handleSubmit} className={formStyles.form}>
        
        {/* Paket Fiyatı */}
        <div className={formStyles.inputGroup}>
            <label htmlFor="m-price">Paket Fiyatı (TL)</label>
            <div className={formStyles.inputWrapper}>
                <DollarSign size={20} className={formStyles.inputIcon} />
                <input 
                  id="m-price" 
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
          <label htmlFor="m-shareValue">Şirketin Alacağı Pay (TL ise Seans Başı, % ise Toplamdan)</label>
          <div className={formStyles.compoundInputWrapper}>
            <TrendingUp size={18} className={formStyles.inputIcon} />
            <input
              id="m-shareValue"
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
                <label htmlFor="m-duration">Süre (Gün)</label>
                <div className={formStyles.inputWrapper}>
                    <BarChart size={20} className={formStyles.inputIcon} />
                    <input 
                      id="m-duration" 
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
                <label htmlFor="m-sessionCount">Seans Sayısı</label>
                <div className={formStyles.inputWrapper}>
                    <Hash size={20} className={formStyles.inputIcon} />
                    <input 
                      id="m-sessionCount" 
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

        {/* Diğer form elemanları */}
        <div className={formStyles.inputGroup}>
          <label htmlFor="m-startDate">Paket Başlangıç Tarihi</label>
          <div className={formStyles.inputWrapper}>
            <Calendar size={20} className={formStyles.inputIcon} />
            <input id="m-startDate" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={formStyles.input} required />
          </div>
        </div>
        <div className={formStyles.inputGroup}>
            <label>Hesaplanan Bitiş Tarihi</label>
            <input type="text" readOnly disabled className={formStyles.input} value={calculatedEndDate ? `${formatDate(calculatedEndDate)} (${duration} gün sonra)` : 'Hatalı Tarih'} style={{ paddingLeft: '1rem' }} />
        </div>
        <div className={formStyles.inputGroup}>
          <label htmlFor="m-paymentStatus">Ödeme Durumu</label>
          <div className={formStyles.inputWrapper}>
            <select id="m-paymentStatus" value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value as 'Paid' | 'Pending')} className={formStyles.input} style={{ paddingLeft: '1rem' }}>
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

        {/* Form Butonları */}
        <div className={formStyles.formActions}>
          <button type="button" onClick={onClose} className={`${formStyles.submitButton} ${formStyles.secondary}`} disabled={isLoading}>İptal</button>
          <button type="submit" className={`${formStyles.submitButton} ${formStyles.primary}`} disabled={isLoading}>
            {isLoading ? <Loader2 size={18} className={formStyles.spinner} /> : (isEditMode ? 'Paketi Güncelle' : 'Yeni Paket Ekle')}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default ManagePackageModal;