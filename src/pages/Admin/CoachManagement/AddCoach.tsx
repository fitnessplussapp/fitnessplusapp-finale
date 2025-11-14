// src/pages/Admin/CoachManagement/AddCoach.tsx

import React, { useState } from 'react';
import { User, Lock, Eye, EyeOff, Loader2 } from 'lucide-react'; // TrendingUp ikonu kaldırıldı
import Modal from '../../../components/Modal/Modal';
import { isValidInput } from '../../../utils/securityUtils';
import formStyles from '../../../components/Form/Form.module.css';

import { db } from '../../../firebase/firebaseConfig';
import { doc } from 'firebase/firestore';
import { setDocWithCount, getDocWithCount } from '../../../firebase/firestoreService';

interface AddCoachProps {
  isOpen: boolean;
  onClose: () => void;
  onCoachAdded: () => void; 
}

const AddCoach: React.FC<AddCoachProps> = ({ isOpen, onClose, onCoachAdded }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  
  // GÜNCELLEME: Pay state'leri kaldırıldı
  // const [shareValue, setShareValue] = useState('');
  // const [shareType, setShareType] = useState<'TL' | '%'>('TL'); 
  
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleClose = () => {
    setUsername('');
    setPassword('');
    // GÜNCELLEME: Pay reset'leri kaldırıldı
    // setShareValue('');
    // setShareType('TL');
    setError('');
    setShowPassword(false);
    onClose();
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // GÜNCELLEME: Pay validasyonu kaldırıldı
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

      // GÜNCELLEME: shareData kaldırıldı
      // const shareData = { ... };

      // newCoachData GÜNCELLENDİ (share kaldırıldı)
      const newCoachData = {
        username: coachId,
        password: password, 
        // share: shareData, // KALDIRILDI
        isActive: true,
        totalEarnings: 0,
        companyCut: 0,
        totalMembers: 0,
        role: 'coach'
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

        {/* GÜNCELLEME: Şirket Payı Input Alanı KALDIRILDI */}
        
        <button 
          type="submit" 
          className={formStyles.submitButton}
          disabled={isLoading}
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