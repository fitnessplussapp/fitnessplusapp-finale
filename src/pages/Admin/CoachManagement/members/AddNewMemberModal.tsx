// src/pages/Admin/CoachManagement/members/AddNewMemberModal.tsx

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Loader2, Calendar, DollarSign, User, Check, BarChart, 
  Hash, TrendingUp, Layers, Phone, Mail
} from 'lucide-react';
import Modal from '../../../../components/Modal/Modal';
import formStyles from '../../../../components/Form/Form.module.css';

import { setDocWithCount, updateDocWithCount, getSystemDefinitions } from '../../../../firebase/firestoreService';
import type { SystemDefinition } from '../../../../firebase/firestoreService';

import { db } from '../../../../firebase/firebaseConfig';
import { doc, collection, addDoc, serverTimestamp, increment } from 'firebase/firestore'; 

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

const AddNewMemberModal: React.FC<ModalProps> = ({ 
    isOpen, coachId, onClose, onSuccess 
}) => {
    
    const [name, setName] = useState(''); 
    const [phoneNumber, setPhoneNumber] = useState('');
    const [email, setEmail] = useState('');

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
    
    // Dinamik Alanlar (Array)
    const [definitions, setDefinitions] = useState<SystemDefinition[]>([]);
    const [dynamicValues, setDynamicValues] = useState<{ [key: string]: string[] }>({});

    const title = 'Yeni Üye ve İlk Paket Kaydı';

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
            setName('');
            setPhoneNumber(''); 
            setEmail('');       
            setPrice('0'); 
            setStartDate(new Date().toISOString().split('T')[0]);
            setDuration('30');
            setSessionCount('12');
            setPaymentStatus('Paid');
            setDietitianSupport(true);
            setShareValue('0'); 
            setShareType('TL'); 
            setDynamicValues({}); 
            setError(null);

            const fetchDefs = async () => {
                const allDefs = await getSystemDefinitions();
                const memberDefs = allDefs.filter(d => d.targets && d.targets.includes('member'));
                setDefinitions(memberDefs);
            };
            fetchDefs();
        }
    }, [isOpen]);

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

        if (!coachId) {
            setError("Koç ID'si bulunamadı.");
            return;
        }
        if (!name.trim()) {
            setError("İsim boş olamaz.");
            return;
        }
        if (!phoneNumber.trim()) {
            setError("Telefon numarası zorunludur.");
            return;
        }
        if (!calculatedEndDate) {
            setError("Tarih hesaplanamadı.");
            return;
        }
        
        setIsLoading(true);

        try {
            const parsedStartDate = new Date(startDate);
            const newMemberRef = doc(collection(db, 'coaches', coachId, 'members'));

            // 1. ÜYE PAYLOAD 
            const memberPayload = {
                name: name.trim(),
                phoneNumber: phoneNumber.trim(),
                email: email.trim(),
                packageStartDate: parsedStartDate,
                packageEndDate: calculatedEndDate,
                totalPackages: 1, 
                currentSessionCount: numSessionCount,
                createdAt: serverTimestamp()
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
                } as CoachShare,
                customFields: dynamicValues
            };

            await setDocWithCount(newMemberRef, memberPayload);
            await addDoc(collection(newMemberRef, 'packages'), packagePayload);
            await updateDocWithCount(doc(db, 'coaches', coachId), {
                totalMembers: increment(1),
                companyCut: increment(financials.companyCut)
            });
            
            onSuccess();
        } catch (err: any) {
            console.error("Hata:", err);
            setError(`Hata: ${err.message}`);
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
                   <label>Üye Adı Soyadı *</label>
                   <div className={formStyles.inputWrapper}>
                       <User size={18} className={formStyles.inputIcon} />
                       <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={formStyles.input} required placeholder="Ad Soyad" />
                   </div>
                </div>

                {/* İletişim */}
                <div className={formStyles.gridGroup} style={{ gridTemplateColumns: '1fr 1fr' }}>
                    <div className={formStyles.inputGroup}>
                        <label>Telefon *</label>
                        <div className={formStyles.inputWrapper}>
                            <Phone size={18} className={formStyles.inputIcon} />
                            <input type="tel" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} className={formStyles.input} required placeholder="0555..." />
                        </div>
                    </div>
                    <div className={formStyles.inputGroup}>
                        <label>E-posta</label>
                        <div className={formStyles.inputWrapper}>
                            <Mail size={18} className={formStyles.inputIcon} />
                            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={formStyles.input} placeholder="Opsiyonel" />
                        </div>
                    </div>
                </div>

                {/* Dinamik Alanlar */}
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
                    <label>Paket Fiyatı (TL)</label>
                    <div className={formStyles.inputWrapper}>
                        <DollarSign size={18} className={formStyles.inputIcon} />
                        <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} className={formStyles.input} min="0" required />
                    </div>
                </div>

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
                    <label>Ödeme Durumu</label>
                    <div className={formStyles.inputWrapper}>
                        <Check size={18} className={formStyles.inputIcon} />
                        <select value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value as 'Paid' | 'Pending')} className={formStyles.input}>
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
                        {isLoading ? <Loader2 size={18} className={formStyles.spinner} /> : 'Üyeyi ve İlk Paketi Kaydet'}
                    </button>
                </div>
            </form>
        </Modal>
    );
};

export default AddNewMemberModal;