// src/pages/Admin/CoachManagement/members/ManagePackageModal.tsx

import React, { useState, useEffect, useMemo } from 'react';
import { Loader2, Calendar, DollarSign, BarChart, Hash, TrendingUp, Layers, Check } from 'lucide-react';
import Modal from '../../../../components/Modal/Modal';
import formStyles from '../../../../components/Form/Form.module.css';

import { updateDocWithCount, getDocWithCount, getSystemDefinitions } from '../../../../firebase/firestoreService';
import type { SystemDefinition } from '../../../../firebase/firestoreService';

import { db } from '../../../../firebase/firebaseConfig';
import { doc, collection, addDoc, serverTimestamp, increment } from 'firebase/firestore'; 

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
  customFields?: { [key: string]: string[] }; // Dizi olarak tanımlandı
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

const ManagePackageModal: React.FC<ModalProps> = ({
  isOpen, mode, coachId, memberId, packageData, onClose, onSuccess
}) => {
  const isEditMode = mode === 'edit-package';

  const [price, setPrice] = useState<string>('0');
  const [startDate, setStartDate] = useState((packageData?.createdAt || new Date()).toISOString().split('T')[0]);
  const [duration, setDuration] = useState<string>('30');
  const [sessionCount, setSessionCount] = useState<string>('12');
  const [paymentStatus, setPaymentStatus] = useState<'Paid' | 'Pending'>('Paid');
  const [dietitianSupport, setDietitianSupport] = useState(false);
  const [shareValue, setShareValue] = useState<string>('0');
  const [shareType, setShareType] = useState<'TL' | '%'>('TL');
  
  // Dinamik Alanlar (Tip güvenliği için string[])
  const [definitions, setDefinitions] = useState<SystemDefinition[]>([]);
  const [dynamicValues, setDynamicValues] = useState<{ [key: string]: string[] }>({});

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const title = isEditMode
    ? `Paket Düzenle: Paket #${packageData?.packageNumber || '?'}`
    : 'Mevcut Üyeye Yeni Paket Ekle';

  const financials = useMemo(() => {
    const numPrice = Number(price) || 0;
    const numShareValue = Number(shareValue) || 0;
    const numSessionCount = Number(sessionCount) || 0;
    const currentShare: CoachShare = { value: numShareValue, type: shareType };
    return calculateFinancials(numPrice, currentShare, numSessionCount);
  }, [price, shareValue, shareType, sessionCount]);

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

  useEffect(() => {
    if (isOpen) {
      // Tanımları çek
      const fetchDefs = async () => {
        const allDefs = await getSystemDefinitions();
        const memberDefs = allDefs.filter(d => d.targets && d.targets.includes('member'));
        setDefinitions(memberDefs);
      };
      fetchDefs();

      if (isEditMode && packageData) {
        setPrice(packageData.price.toString());
        setStartDate(packageData.createdAt.toISOString().split('T')[0]);
        setPaymentStatus(packageData.paymentStatus);
        setDuration(packageData.duration.toString());
        setSessionCount((packageData.sessionCount || 12).toString());
        setDietitianSupport(!!packageData.dietitianSupport);
        setShareValue((packageData.share?.value || 0).toString());
        setShareType(packageData.share?.type || 'TL');
        
        // Mevcut dinamik alanları yükle
        const formattedValues: { [key: string]: string[] } = {};
        if (packageData.customFields) {
            Object.keys(packageData.customFields).forEach(key => {
                const val = packageData.customFields![key];
                if (Array.isArray(val)) {
                    formattedValues[key] = val;
                } else if (typeof val === 'string') {
                    formattedValues[key] = [val];
                }
            });
        }
        setDynamicValues(formattedValues);

      } else {
        setPrice('0');
        setStartDate(new Date().toISOString().split('T')[0]);
        setPaymentStatus('Paid');
        setDuration('30');
        setSessionCount('12');
        setDietitianSupport(false);
        setShareValue('0');
        setShareType('TL');
        setDynamicValues({});
      }
      setError(null);
    }
  }, [isOpen, mode, packageData]);

  // --- ÇOKLU SEÇİM MANTIĞI ---
  const toggleDynamicValue = (defId: string, itemValue: string) => {
    setDynamicValues(prev => {
      const currentList = prev[defId] || [];
      if (currentList.includes(itemValue)) {
        return { ...prev, [defId]: currentList.filter(i => i !== itemValue) };
      } else {
        return { ...prev, [defId]: [...currentList, itemValue] };
      }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    const numPrice = price === '' ? 0 : Number(price);
    const numDuration = duration === '' ? 0 : Number(duration);
    const numSessionCount = sessionCount === '' ? 0 : Number(sessionCount);
    const numShareValue = shareValue === '' ? 0 : Number(shareValue);

    if (numPrice < 0 || numDuration < 0 || numSessionCount < 0 || numShareValue < 0) {
      setError("Negatif değer girilemez.");
      return;
    }
    if (!calculatedEndDate) {
        setError("Tarih hatası.");
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
        // DÜZENLEME
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
          share: currentShare,
          customFields: dynamicValues
        };
        await updateDocWithCount(packageDocRef, packagePayload);
        
        memberUpdatePayload.currentSessionCount = newRemaining;
        await updateDocWithCount(memberDocRef, memberUpdatePayload);
        
        if (cutDifference !== 0) {
            await updateDocWithCount(coachDocRef, {
                companyCut: increment(cutDifference)
            });
        }

      } else { 
        // EKLEME
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
          share: currentShare,
          customFields: dynamicValues
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
      console.error("Hata:", err);
      setError(`İşlem başarısız oldu: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>

      {error && <div className={formStyles.error}>{error}</div>}

      <form onSubmit={handleSubmit} className={formStyles.form}>
        
        <div className={formStyles.inputGroup}>
            <label>Paket Fiyatı (TL)</label>
            <div className={formStyles.inputWrapper}>
                <DollarSign size={18} className={formStyles.inputIcon} />
                <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} className={formStyles.input} min="0" required />
            </div>
        </div>

        {/* --- DİNAMİK ALANLAR --- */}
        {definitions.length > 0 && (
          <div style={{ marginBottom: '1.5rem', borderBottom: '1px dashed var(--border-color)', paddingBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h4 style={{ color: 'var(--primary-color)', fontSize: '0.85rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Layers size={16} /> Paket Özellikleri
            </h4>
            {definitions.map(def => (
                <div key={def.id} className={formStyles.inputGroup}>
                    <label>{def.title}</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                        {def.items.map((item, idx) => {
                            const isSelected = dynamicValues[def.id]?.includes(item);
                            return (
                                <button
                                    key={idx}
                                    type="button"
                                    onClick={() => toggleDynamicValue(def.id, item)}
                                    style={{
                                        background: isSelected ? 'rgba(129, 201, 189, 0.15)' : 'var(--bg-input)',
                                        border: isSelected ? '1px solid var(--primary-color)' : '1px solid #333',
                                        color: isSelected ? 'var(--primary-color)' : 'var(--text-muted)',
                                        padding: '0.3rem 0.6rem',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                        fontSize: '0.75rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        transition: 'all 0.2s ease'
                                    }}
                                >
                                    {isSelected && <Check size={12} />}
                                    {item}
                                </button>
                            )
                        })}
                    </div>
                </div>
            ))}
          </div>
        )}
        
        <div className={formStyles.inputGroup}>
          <label>Şirketin Alacağı Pay</label>
          <div className={formStyles.compoundInputWrapper}>
            <TrendingUp size={18} className={formStyles.inputIcon} />
            <input type="number" className={formStyles.input} value={shareValue} onChange={(e) => setShareValue(e.target.value)} min="0" required />
            <div className={formStyles.typeToggleGroup}>
              <button type="button" className={`${formStyles.toggleButton} ${shareType === 'TL' ? formStyles.toggleActive : ''}`} onClick={() => setShareType('TL')}>TL</button>
              <button type="button" className={`${formStyles.toggleButton} ${shareType === '%' ? formStyles.toggleActive : ''}`} onClick={() => setShareType('%')}>%</button>
            </div>
          </div>
        </div>
        
        <div className={formStyles.gridGroup} style={{ gridTemplateColumns: '1fr 1fr' }}>
            <div className={formStyles.inputGroup}>
                <label>Süre (Gün)</label>
                <div className={formStyles.inputWrapper}>
                    <BarChart size={18} className={formStyles.inputIcon} />
                    <input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} className={formStyles.input} min="0" required />
                </div>
            </div>
            <div className={formStyles.inputGroup}>
                <label>Seans Sayısı</label>
                <div className={formStyles.inputWrapper}>
                    <Hash size={18} className={formStyles.inputIcon} />
                    <input type="number" value={sessionCount} onChange={(e) => setSessionCount(e.target.value)} className={formStyles.input} min="0" required />
                </div>
            </div>
        </div>
        
        <div className={formStyles.formSummaryBox}>
            <div className={formStyles.summaryItem}><span>Şirket Payı:</span><strong>{formatCurrency(financials.companyCut)}</strong></div>
            <div className={`${formStyles.summaryItem} ${formStyles.positive}`}><span>Koça Kalan:</span><strong>{formatCurrency(financials.coachCut)}</strong></div>
        </div>

        <div className={formStyles.inputGroup}>
          <label>Paket Başlangıç Tarihi</label>
          <div className={formStyles.inputWrapper}>
            <Calendar size={18} className={formStyles.inputIcon} />
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={formStyles.input} required />
          </div>
        </div>
        <div className={formStyles.inputGroup}>
            <label>Hesaplanan Bitiş Tarihi</label>
            <input type="text" readOnly disabled className={formStyles.input} value={calculatedEndDate ? `${formatDate(calculatedEndDate)} (${duration} gün sonra)` : 'Hatalı Tarih'} style={{ paddingLeft: '1rem' }} />
        </div>
        <div className={formStyles.inputGroup}>
          <label>Ödeme Durumu</label>
          <div className={formStyles.inputWrapper}>
            <select value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value as 'Paid' | 'Pending')} className={formStyles.input} style={{ paddingLeft: '1rem' }}>
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