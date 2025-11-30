import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { onSnapshot, doc } from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig';
import type { CoachData } from '../types/db'; // YENİ TİP

// Admin tipi şimdilik basit kalsın, ileride db.ts'e ekleyebiliriz
interface AdminData {
  username: string;
  role: 'admin';
}

type AuthUser = CoachData | AdminData;

interface AuthContextType {
  currentUser: AuthUser | null;
  loading: boolean;
  login: (userData: AuthUser) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => {
    const stored = sessionStorage.getItem('fitness-user');
    return stored ? JSON.parse(stored) : null;
  });
  const [loading, setLoading] = useState(false); // Başlangıçta false, user varsa true olur

  const login = (userData: AuthUser) => {
    sessionStorage.setItem('fitness-user', JSON.stringify(userData));
    setCurrentUser(userData);
  };

  const logout = () => {
    sessionStorage.removeItem('fitness-user');
    setCurrentUser(null);
  };

  // GERÇEK ZAMANLI DİNLEME (Listener)
  useEffect(() => {
    if (!currentUser) return;

    setLoading(true);
    const collectionName = currentUser.role === 'admin' ? 'admins' : 'coaches';
    // DİKKAT: CoachData id'si username veya auth uid olabilir. Yapınıza göre ayarlayın.
    // Şimdilik username varsayıyoruz.
    const userRef = doc(db, collectionName, (currentUser as any).username || currentUser.id);

    const unsub = onSnapshot(userRef, (docSnap) => {
      setLoading(false);
      if (!docSnap.exists()) {
        logout(); // Kullanıcı silindiyse at
      } else {
        const data = docSnap.data();
        // Aktiflik kontrolü
        if (data?.isActive === false) {
          alert("Hesabınız pasif duruma alındı.");
          logout();
        } else {
          // Veri güncellendiyse (örn: bakiye değişti) state'i güncelle
          // Sonsuz döngüyü engellemek için sadece veri değiştiyse set et
          // (Burada basitlik için direkt set ediyoruz, production'da deep compare önerilir)
          setCurrentUser(prev => ({ ...prev, ...data } as AuthUser));
        }
      }
    }, (err) => {
      console.error("Auth Listener Error:", err);
      setLoading(false);
    });

    return () => unsub();
  }, [currentUser?.role, (currentUser as any)?.username]); // Sadece user kimliği değişince çalış

  return (
    <AuthContext.Provider value={{ currentUser, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};