// src/pages/Admin/CoachManagement/EditCoach.tsx

import React, { useState, useEffect } from 'react';
import { User, Lock, Eye, EyeOff, Loader2, Layers, Check, Trash2, AlertTriangle } from 'lucide-react'; 
import Modal from '../../../components/Modal/Modal';
import { isValidInput } from '../../../utils/securityUtils';
import formStyles from '../../../components/Form/Form.module.css';

import { db } from '../../../firebase/firebaseConfig';
import { doc } from 'firebase/firestore'; 
import type { DocumentData, UpdateData } from 'firebase/firestore';

import { updateDocWithCount, getSystemDefinitions } from '../../../firebase/firestoreService';
import type { SystemDefinition } from '../../../firebase/firestoreService';

interface CoachData {
  id: string;
  username: string;
  isActive: boolean;
  customFields?: { [key: string]: any }; 
}

interface EditCoachProps {
  isOpen: boolean;
  onClose: () => void;
  coach: CoachData | null; 
  onCoachUpdated: () => void;
  onCoachDeleted: (coachId: string) => void; // YENİ PROP
  isDeleting: boolean; // YENİ PROP
}

const EditCoach: React.FC<EditCoachProps> = ({ 
    isOpen, onClose, coach, onCoachUpdated, onCoachDeleted, isDeleting 
}) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Silme Onay Ekranı State'i
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Dinamik Alanlar
  const [definitions, setDefinitions] = useState<SystemDefinition[]>([]);
  const [dynamicValues, setDynamicValues] = useState<{ [key: string]: string[] }>({});

  useEffect(() => {
    if (isOpen && coach) {
      setPassword(''); 
      setError('');
      setShowPassword(false);
      setShowDeleteConfirm(false); // Reset
      
      const fetchDefs = async () => {
        const allDefs = await getSystemDefinitions();
        const coachDefs = allDefs.filter(d => d.targets && d.targets.includes('coach'));
        setDefinitions(coachDefs);
        
        // Mevcut değerleri formatla
        const formattedValues: { [key: string]: string[] } = {};
        if (coach.customFields) {
            Object.keys(coach.customFields).forEach(key => {
                const val = coach.customFields![key];
                if (Array.isArray(val)) {
                    formattedValues[key] = val;
                } else if (typeof val === 'string') {
                    formattedValues[key] = [val];
                }
            });
        }
        setDynamicValues(formattedValues);
      };
      fetchDefs();
    }
  }, [coach, isOpen]); 

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

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password && !isValidInput(password)) {
      setError('Şifrede geçersiz karakterler var.');
      return;
    }
    
    setIsLoading(true);
    const updates: UpdateData<DocumentData> = {};

    if (password.trim() !== '') {
      updates.password = password;
    }
    updates.customFields = dynamicValues;

    try {
      if (!coach) throw new Error("Koç verisi bulunamadı.");
      const coachRef = doc(db, 'coaches', coach.id); 
      await updateDocWithCount(coachRef, updates);
      
      setIsLoading(false);
      onCoachUpdated(); 
      onClose();

    } catch (err: any) {
      console.error("Hata:", err);
      setError('Güncelleme hatası: ' + err.message);
      setIsLoading(false);
    }
  };

  if (!coach) return null; 

  // --- SİLME ONAY EKRANI ---
  if (showDeleteConfirm) {
      return (
        <Modal isOpen={isOpen} onClose={() => setShowDeleteConfirm(false)} title="Koç Silme Onayı">
            <div style={{display:'flex', flexDirection:'column', alignItems:'center', textAlign:'center', gap:'1.5rem'}}>
                <AlertTriangle size={48} color="#ef4444" />
                <div>
                    <p style={{color:'#E0E0E0', fontSize:'1.1rem', marginBottom:'0.5rem'}}>
                        <strong>{coach.username}</strong> adlı koçu silmek üzeresiniz.
                    </p>
                    <p style={{color:'#aaa', fontSize:'0.9rem'}}>
                        Bu işlem, koça bağlı <strong>TÜM ÜYELERİ</strong>, <strong>PAKETLERİ</strong> ve <strong>PROGRAMLARI</strong> kalıcı olarak silecektir. Bu işlem geri alınamaz.
                    </p>
                </div>
                <div className={formStyles.formActions} style={{width:'100%'}}>
                    <button 
                        type="button" 
                        onClick={() => setShowDeleteConfirm(false)} 
                        className={`${formStyles.submitButton} ${formStyles.secondary}`}
                        disabled={isDeleting}
                    >
                        Vazgeç
                    </button>
                    <button 
                        type="button" 
                        onClick={() => onCoachDeleted(coach.id)} 
                        className={`${formStyles.submitButton} ${formStyles.danger}`}
                        disabled={isDeleting}
                    >
                        {isDeleting ? <Loader2 size={18} className={formStyles.spinner} /> : 'Evet, Kalıcı Olarak Sil'}
                    </button>
                </div>
            </div>
        </Modal>
      );
  }

  // --- NORMAL DÜZENLEME FORMU ---
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Koçu Düzenle: ${coach.username}`}>
      <form className={formStyles.form} onSubmit={handleFormSubmit}>
        {error && <div className={formStyles.error}>{error}</div>}

        {/* Kullanıcı Adı */}
        <div className={formStyles.inputGroup}>
          <label>Koç ID (Değiştirilemez)</label>
          <div className={formStyles.inputWrapper}>
            <User size={18} className={formStyles.inputIcon}/>
            <input type="text" className={formStyles.input} value={coach.username} disabled style={{color:'#666', cursor:'not-allowed'}} />
          </div>
        </div>

        {/* Şifre */}
        <div className={formStyles.inputGroup}>
          <label>Yeni Şifre (Opsiyonel)</label>
          <div className={formStyles.inputWrapper}>
            <Lock size={18} className={formStyles.inputIcon} />
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Değiştirmek için yazın"
              className={formStyles.input}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
            />
            <button type="button" className={formStyles.passwordIcon} onClick={() => setShowPassword(!showPassword)}>
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        {/* Çoklu Seçimli Alanlar */}
        {definitions.length > 0 && (
          <div style={{ marginTop: '1.5rem', borderTop: '1px solid #333', paddingTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <h4 style={{ color: '#D4AF37', fontSize: '0.95rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Layers size={16} /> Ek Bilgiler
            </h4>
            {definitions.map(def => (
              <div key={def.id} className={formStyles.inputGroup}>
                <label style={{marginBottom: '0.5rem', color: '#AAA', fontSize: '0.85rem'}}>{def.title}</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {def.items.map((item, idx) => {
                      const isSelected = dynamicValues[def.id]?.includes(item);
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => toggleDynamicValue(def.id, item)}
                          style={{
                            background: isSelected ? 'rgba(212, 175, 55, 0.15)' : '#1A1A1A',
                            border: isSelected ? '1px solid #D4AF37' : '1px solid #333',
                            color: isSelected ? '#D4AF37' : '#888',
                            padding: '0.4rem 0.8rem',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '0.85rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            transition: 'all 0.2s ease'
                          }}
                        >
                          {isSelected && <Check size={14} />}
                          {item}
                        </button>
                      );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
        
        <div className={formStyles.formActions} style={{marginTop: '1.5rem'}}>
            <button type="button" onClick={onClose} className={`${formStyles.submitButton} ${formStyles.secondary}`} disabled={isLoading}>İptal</button>
            <button type="submit" className={`${formStyles.submitButton} ${formStyles.primary}`} disabled={isLoading}>
                {isLoading ? <Loader2 size={18} className={formStyles.spinner} /> : 'Kaydet'}
            </button>
        </div>

        {/* --- TEHLİKELİ BÖLGE --- */}
        <div style={{marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px dashed #444'}}>
            <h4 style={{color:'#ef4444', fontSize:'0.9rem', marginBottom:'0.5rem', display:'flex', alignItems:'center', gap:'0.5rem'}}>
                <AlertTriangle size={16}/> Tehlikeli Bölge
            </h4>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', background:'rgba(239, 68, 68, 0.05)', padding:'1rem', borderRadius:'8px', border:'1px solid rgba(239, 68, 68, 0.2)'}}>
                <div>
                    <p style={{color:'#ccc', fontSize:'0.85rem', margin:0}}>Koçu ve tüm verilerini sil</p>
                    <p style={{color:'#666', fontSize:'0.75rem', margin:0}}>Bu işlem geri alınamaz.</p>
                </div>
                <button 
                    type="button"
                    onClick={() => setShowDeleteConfirm(true)}
                    style={{
                        background: 'transparent',
                        border: '1px solid #ef4444',
                        color: '#ef4444',
                        padding: '0.5rem 1rem',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        display:'flex', alignItems:'center', gap:'0.5rem',
                        transition: 'all 0.2s'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}
                    onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                >
                    <Trash2 size={16}/> Sil
                </button>
            </div>
        </div>

      </form>
    </Modal>
  );
};

export default EditCoach;