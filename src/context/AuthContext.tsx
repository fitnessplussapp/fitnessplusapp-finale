// src/context/AuthContext.tsx

import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import type { DocumentData } from 'firebase/firestore';

// YENİ: Gerçek zamanlı dinleyici için importlar
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig'; // db importu

// Kullanıcı verisinin tipini tanımlayalım
interface AuthUser extends DocumentData {
  username: string;
  role: 'admin' | 'coach';
}

// Context'in tipini tanımlayalım
interface AuthContextType {
  currentUser: AuthUser | null;
  loading: boolean; // YENİ: Yüklenme durumu eklendi
  login: (userData: DocumentData) => void;
  logout: () => void;
}

// 1. Context'i oluştur
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// 2. 'custom hook' (Değişiklik yok)
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth, AuthProvider içinde kullanılmalıdır');
  }
  return context;
};

// 3. Provider (Sağlayıcı) bileşeni
interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => {
    const storedUser = sessionStorage.getItem('fitness-user');
    return storedUser ? JSON.parse(storedUser) : null;
  });

  // YENİ: Yüklenme state'i (ProtectedRoute'da kullanılacak)
  // 'true' başlar, böylece ilk kontrol bitene kadar korumalı sayfalar açılmaz
  const [loading, setLoading] = useState(true);

  // Giriş yapma fonksiyonu
  const login = (userData: DocumentData) => {
    const userToStore: AuthUser = {
      username: userData.username,
      role: userData.role
    };
    sessionStorage.setItem('fitness-user', JSON.stringify(userToStore));
    setCurrentUser(userToStore);
    setLoading(false); // Giriş yapıldı, yükleme bitti
  };

  // Çıkış yapma fonksiyonu
  const logout = () => {
    sessionStorage.removeItem('fitness-user');
    setCurrentUser(null);
    setLoading(false); // Çıkış yapıldı, yükleme bitti
  };

  // === YENİ: Gerçek Zamanlı 'isActive' Kontrolü ===
  useEffect(() => {
    // Bu 'unsubscribe' fonksiyonu, dinleyiciyi kapatmak için kullanılacak
    let unsubscribe: (() => void) | undefined = undefined;

    if (currentUser) {
      // Eğer bir kullanıcı giriş yapmışsa, durumunu dinlemeye başla
      setLoading(true); // Kontrol başlarken yüklemeyi aç
      
      const collectionName = currentUser.role === 'admin' ? 'admins' : 'coaches';
      const userDocRef = doc(db, collectionName, currentUser.username);

      unsubscribe = onSnapshot(userDocRef, (docSnap) => {
        
        // 1. Kullanıcı veritabanından silindiyse VEYA
        // 2. 'isActive' durumu 'false' (Boolean) VEYA "false" (String) ise
        if (
          !docSnap.exists() || 
          docSnap.data()?.isActive === false || 
          docSnap.data()?.isActive === "false"
        ) {
          // KULLANICIYI ANINDA SİSTEMDEN AT
          
          // Login sayfasına mesaj göndermek için
          sessionStorage.setItem('logout_reason', 'Hesabınız donduruldu, çıkış yapıldı.');
          
          logout(); // Bu, currentUser'ı null yapar ve dinleyiciyi durdurur
          
        } else {
          // Kullanıcı var ve aktif, yüklemeyi bitir
          setLoading(false);
        }
      }, (error) => {
        // Dinlerken bir hata oluşursa (örn: izinler)
        console.error("Kullanıcı durumu dinlenemedi (onSnapshot):", error);
        logout();
      });

    } else {
      // Giriş yapmış bir kullanıcı yok
      setLoading(false); // Yükleme durumunu kapat
    }

    // Cleanup fonksiyonu:
    // Bu effect bittiğinde (örn: kullanıcı logout olduğunda)
    // Firestore dinleyicisini kapatır, maliyeti ve hafıza sızıntısını önler.
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [currentUser]); // Bu effect, SADECE 'currentUser' değiştiğinde (giriş/çıkış) çalışır

  const value = {
    currentUser,
    loading, // 'ProtectedRoute'un ihtiyacı var
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};