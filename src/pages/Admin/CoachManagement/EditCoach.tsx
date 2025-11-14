// src/pages/Admin/CoachManagement/EditCoach.tsx

import React, { useState, useEffect } from 'react';
import { User, Lock, Eye, EyeOff, Loader2 } from 'lucide-react'; // TrendingUp kaldırıldı
import Modal from '../../../components/Modal/Modal';
import { isValidInput } from '../../../utils/securityUtils';
import formStyles from '../../../components/Form/Form.module.css';

// Firebase importları
import { db } from '../../../firebase/firebaseConfig';
import { doc } from 'firebase/firestore'; 
import type { DocumentData, UpdateData } from 'firebase/firestore';
import { updateDocWithCount } from '../../../firebase/firestoreService';

// GÜNCELLEME: CoachData tipi (share kaldırıldı)
interface CoachData {
  id: string;
  username: string;
  isActive: boolean;
  // share: { ... } // KALDIRILDI
}

interface EditCoachProps {
  isOpen: boolean;
  onClose: () => void;
  coach: CoachData | null; 
  onCoachUpdated: () => void; 
}

const EditCoach: React.FC<EditCoachProps> = ({ isOpen, onClose, coach, onCoachUpdated }) => {
  const [password, setPassword] = useState('');
  
  // GÜNCELLEME: Pay state'leri kaldırıldı
  // const [shareValue, setShareValue] = useState('');
  // const [shareType, setShareType] = useState<'TL' | '%'>('TL');
  
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Modal açıldığında formu doldur (GÜNCELLENDİ)
  useEffect(() => {
    if (coach) {
      setPassword(''); 
      // GÜNCELLEME: Pay state'leri kaldırıldı
      // setShareValue(coach.share.value.toString()); 
      // setShareType(coach.share.type); 
      setError('');
      setShowPassword(false);
    }
  }, [coach, isOpen]); 

  const handleClose = () => {
    onClose();
  };

  // handleFormSubmit (GÜNCELLENDİ)
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // GÜNCELLEME: Pay validasyonu kaldırıldı
    if (!isValidInput(password)) {
      setError('Geçersiz karakterler kullanıldı. ($ { } [ ] )');
      return;
    }
    
    setIsLoading(true);
    const updates: UpdateData<DocumentData> = {};

    if (password.trim() !== '') {
      updates.password = password;
    }

    // GÜNCELLEME: Pay güncelleme mantığı kaldırıldı
    // const newShareValue = parseFloat(shareValue);
    // if (newShareValue !== coach?.share.value || shareType !== coach?.share.type) {
    //   updates.share = { ... };
    // }

    if (Object.keys(updates).length === 0) {
      setError('Herhangi bir değişiklik yapmadınız.');
      setIsLoading(false);
      return;
    }

    try {
      if (!coach) throw new Error("Koç verisi bulunamadı.");
      const coachRef = doc(db, 'coaches', coach.id); 
      await updateDocWithCount(coachRef, updates);
      
      setIsLoading(false);
      onCoachUpdated(); 
      handleClose();

    } catch (err: any) {
      console.error("Koç güncellenemedi:", err);
      if (err.code === 'permission-denied') {
          setError('Koç güncelleme yetkiniz yok. (Firestore Kural Hatası)');
      } else {
          setError('Koç güncellenirken bir hata oluştu: ' + err.message);
      }
      setIsLoading(false);
    }
  };

  if (!coach) return null; 

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={`Koçu Düzenle: ${coach.username}`}>
      <form className={formStyles.form} onSubmit={handleFormSubmit}>
        {error && <div className={formStyles.error}>{error}</div>}

        {/* Kullanıcı Adı (Değişiklik yok) */}
        <div className={formStyles.inputGroup}>
          <label htmlFor="username">Koç Kullanıcı Adı (Giriş ID)</label>
          <div className={formStyles.inputWrapper}>
            <User size={18} className={formStyles.inputIcon} />
            <input
              id="username"
              type="text"
              className={formStyles.input}
              value={coach.username}
              disabled={true} 
            />
          </div>
        </div>

        {/* Şifre (Değişiklik yok) */}
        <div className={formStyles.inputGroup}>
          <label htmlFor="password">Yeni Şifre (Boş bırakırsanız değişmez)</label>
          <div className={formStyles.inputWrapper}>
            <Lock size={18} className={formStyles.inputIcon} />
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Yeni bir şifre belirleyin"
              className={formStyles.input}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
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
        
        {/* GÜNCELLEME: Şirket Payı Alanı KALDIRILDI */}
        
        <button 
          type="submit" 
          className={formStyles.submitButton}
          disabled={isLoading}
        >
          {isLoading ? (
            <Loader2 size={20} className={formStyles.spinner} />
          ) : (
            'Değişiklikleri Kaydet'
          )}
        </button>
      </form>
    </Modal>
  );
};

export default EditCoach;