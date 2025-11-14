// src/pages/Login/Login.tsx

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './Login.module.css';
import { User, Lock, Eye, EyeOff, Loader2, Sparkles } from 'lucide-react';

import { db } from '../../firebase/firebaseConfig';
import { doc } from 'firebase/firestore'; 
import type { DocumentData } from 'firebase/firestore';

import { getDocWithCount } from '../../firebase/firestoreService'; 
import { isValidInput } from '../../utils/securityUtils';
import { useAuth } from '../../context/AuthContext';

const Login: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  const navigate = useNavigate();
  const auth = useAuth(); 

  // Otomatik çıkış mesajı için
  useEffect(() => {
    const reason = sessionStorage.getItem('logout_reason');
    if (reason) {
      setError(reason);
      sessionStorage.removeItem('logout_reason');
    }
  }, []); //

  // findUserById (Yazım hatası düzeltildi)
  const findUserById = async (collectionName: string): Promise<DocumentData | null> => {
    try {
      const userDocRef = doc(db, collectionName, username); 
      const userDocSnap = await getDocWithCount(userDocRef);

      if (userDocSnap.exists()) {
        const userData = userDocSnap.data();

        if (userData.password === password) {
          
          if (userData.isActive === false || userData.isActive === "false") {
            throw new Error("INACTIVE_ACCOUNT");
          }
          
          return userData;
        }
      }
      return null;
    } catch (error: any) { // DÜZELTME: 'a' harfi kaldırıldı
      console.error(`Error querying ${collectionName}:`, error);
      if (error.message === "INACTIVE_ACCOUNT") {
        throw error;
      }
      throw new Error("DB_ERROR");
    }
  }; //


  // handleSubmit (Değişiklik yok)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!isValidInput(username) || !isValidInput(password)) {
      setError('Geçersiz karakterler kullanıldı. ($ { } [ ] )');
      return;
    }

    setIsLoading(true);

    try {
      let userData: DocumentData | null = null;
      userData = await findUserById("admins");

      if (!userData) {
        userData = await findUserById("coaches");
      }

      if (userData) {
        auth.login(userData); 
        
        setIsLoading(false);
        if (userData.role === 'admin') {
          navigate('/admin');
        } else if (userData.role === 'coach') {
          navigate('/coach');
        } else {
          navigate('/');
        }
        
      } else {
        setIsLoading(false);
        setError('Kullanıcı adı veya şifre hatalı.');
      }

    } catch (error: any) {
      setIsLoading(false);
      
      if (error.message === "INACTIVE_ACCOUNT") {
        setError('Hesap donduruldu. Lütfen yönetici ile iletişime geçin.');
      } else {
        console.error("Giriş hatası:", error);
        setError('Giriş yapılırken bir hata oluştu.');
      }
    }
  }; //

  // --- JSX (RENDER) KISMI (Değişiklik yok) ---
  return (
    <div className={styles.loginBox}>
      <div className={styles.logo}>
        <Sparkles size={40} className={styles.logoIcon} />
        ESPERTO-<span className={styles.logoPlus}>PT</span>
      </div>
      <h2 className={styles.title}>Yönetim Paneli Girişi</h2>
      <form className={styles.form} onSubmit={handleSubmit}>
        {error && <div className={styles.error}>{error}</div>}
        <div className={styles.inputGroup}>
          <User className={styles.inputIcon} size={20} />
          <input
            type="text"
            placeholder="Kullanıcı Adı"
            className={styles.input}
            required
            disabled={isLoading}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
        </div>
        <div className={styles.inputGroup}>
          <Lock className={styles.inputIcon} size={20} />
          <input
            type={showPassword ? 'text' : 'password'}
            placeholder="Şifre"
            className={styles.input}
            required
            disabled={isLoading}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <div 
            className={styles.passwordIcon} 
            onClick={() => setShowPassword(!showPassword)}
          >
            {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
          </div>
        </div>
        <button 
          type="submit" 
          className={styles.button}
          disabled={isLoading}
        >
          {isLoading ? (
            <span className={styles.spinner}></span>
          ) : (
            'Giriş Yap'
          )}
        </button>
      </form>
    </div>
  );
};

export default Login;