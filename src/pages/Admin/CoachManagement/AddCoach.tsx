// src/pages/Admin/CoachManagement/AddCoach.tsx

import React, { useState, useEffect } from 'react';
import { User, Lock, Eye, EyeOff, Loader2, Layers, Check } from 'lucide-react'; 
import Modal from '../../../components/Modal/Modal';
import { isValidInput } from '../../../utils/securityUtils';
import formStyles from '../../../components/Form/Form.module.css';

import { db } from '../../../firebase/firebaseConfig';
import { doc } from 'firebase/firestore';

// Fonksiyonlar normal import
import { setDocWithCount, getDocWithCount, getSystemDefinitions } from '../../../firebase/firestoreService';
// Type'lar "import type" ile
import type { SystemDefinition } from '../../../firebase/firestoreService';

interface AddCoachProps {
  isOpen: boolean;
  onClose: () => void;
  onCoachAdded: () => void; 
}

const AddCoach: React.FC<AddCoachProps> = ({ isOpen, onClose, onCoachAdded }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Dinamik Alanlar State'i (Artık Array tutuyor)
  const [definitions, setDefinitions] = useState<SystemDefinition[]>([]);
  const [dynamicValues, setDynamicValues] = useState<{ [key: string]: string[] }>({});

  // Modal açıldığında tanımları çek
  useEffect(() => {
    if (isOpen) {
      const fetchDefs = async () => {
        try {
          const allDefs = await getSystemDefinitions();
          // Sadece hedefinde 'coach' olanları filtrele
          const coachDefs = allDefs.filter(d => d.targets && d.targets.includes('coach'));
          setDefinitions(coachDefs);
        } catch (err) {
          console.error("Sistem tanımları çekilemedi:", err);
        }
      };
      fetchDefs();
    }
  }, [isOpen]);

  const handleClose = () => {
    setUsername('');
    setPassword('');
    setDynamicValues({}); // Reset
    setError('');
    setShowPassword(false);
    onClose();
  };

  // --- ÇOKLU SEÇİM MANTIĞI ---
  const toggleDynamicValue = (defId: string, itemValue: string) => {
    setDynamicValues(prev => {
      const currentList = prev[defId] || [];
      if (currentList.includes(itemValue)) {
        // Varsa çıkar
        return { ...prev, [defId]: currentList.filter(i => i !== itemValue) };
      } else {
        // Yoksa ekle
        return { ...prev, [defId]: [...currentList, itemValue] };
      }
    });
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!isValidInput(username) || !isValidInput(password)) {
      setError('Geçersiz karakterler kullanıldı. ($ { } [ ] )');
      return;
    }

    setIsLoading(true);
    const coachId = username.toLowerCase();

    try {
      const coachRef = doc(db, 'coaches', coachId);
      const docSnap = await getDocWithCount(coachRef);

      if (docSnap.exists()) {
        setError('Bu kullanıcı adı (ID) zaten alınmış. Lütfen başka bir ID deneyin.');
        setIsLoading(false);
        return;
      }

      const newCoachData = {
        username: coachId,
        password: password, 
        isActive: true,
        totalEarnings: 0,
        companyCut: 0,
        totalMembers: 0,
        role: 'coach',
        // Dinamik alanları kaydet (Array olarak kaydedilecek)
        customFields: dynamicValues 
      };

      await setDocWithCount(coachRef, newCoachData);
      
      setIsLoading(false);
      onCoachAdded(); 
      handleClose();  

    } catch (err: any) {
      console.error("Koç oluşturulamadı:", err);
      if (err.code === 'permission-denied') {
          setError('Koç ekleme yetkiniz yok. (Firestore Kural Hatası)');
      } else {
          setError('Koç oluşturulurken bir hata oluştu: ' + err.message);
      }
      setIsLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Yeni Koç Ekle">
      <form className={formStyles.form} onSubmit={handleFormSubmit}>
        {error && <div className={formStyles.error}>{error}</div>}

        {/* Kullanıcı Adı */}
        <div className={formStyles.inputGroup}>
          <label htmlFor="username">Koç Kullanıcı Adı (Giriş ID)</label>
          <div className={formStyles.inputWrapper}>
            <User size={18} className={formStyles.inputIcon} />
            <input
              id="username"
              type="text"
              placeholder="Örn: ozgur (Bu ID değiştirilemez)"
              className={formStyles.input}
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase())} 
              disabled={isLoading}
              required
            />
          </div>
        </div>

        {/* Şifre */}
        <div className={formStyles.inputGroup}>
          <label htmlFor="password">Şifre</label>
          <div className={formStyles.inputWrapper}>
            <Lock size={18} className={formStyles.inputIcon} />
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Koç için bir şifre belirleyin"
              className={formStyles.input}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              required
            />
            <button
              type="button"
              className={formStyles.passwordIcon}
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        {/* --- YENİ: ÇOKLU SEÇİMLİ DİNAMİK ALANLAR --- */}
        {definitions.length > 0 && (
          <div style={{ marginTop: '1.5rem', borderTop: '1px solid #333', paddingTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <h4 style={{ color: '#D4AF37', fontSize: '0.95rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Layers size={16} /> Ek Bilgiler (Çoklu Seçim)
            </h4>
            
            {definitions.map(def => (
              <div key={def.id} className={formStyles.inputGroup}>
                <label style={{marginBottom: '0.5rem', color: '#AAA', fontSize: '0.85rem'}}>{def.title}</label>
                
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {def.items.length > 0 ? (
                    def.items.map((item, idx) => {
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
                      )
                    })
                  ) : (
                    <span style={{fontSize: '0.8rem', color: '#555', fontStyle: 'italic'}}>Seçenek yok.</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        {/* ----------------------------- */}
        
        <button 
          type="submit" 
          className={formStyles.submitButton}
          disabled={isLoading}
          style={{marginTop: '1.5rem'}}
        >
          {isLoading ? (
            <Loader2 size={20} className={formStyles.spinner} />
          ) : (
            'Koçu Oluştur'
          )}
        </button>
      </form>
    </Modal>
  );
};

export default AddCoach;