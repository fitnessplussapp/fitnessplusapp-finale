// src/components/ProtectedRoute/ProtectedRoute.tsx

import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { Navigate, Outlet } from 'react-router-dom';
import Layout from '../Layout/Layout';
import { Loader2 } from 'lucide-react'; // Yükleme ikonu

// Yükleme stilleri (Eğer /Layout/Layout.module.css içindeyse oradan alınabilir)
// Ayrı bir dosya varsayıyoruz:
import styles from './ProtectedRoute.module.css'; 

const ProtectedRoute: React.FC = () => {
  // GÜNCELLEME: 'loading' state'i AuthContext'ten alındı
  const { currentUser, loading } = useAuth();

  // 1. KONTROL: AuthContext hâlâ yükleniyorsa veya DB kontrolü yapıyorsa
  // Bu, 'isActive' durumu doğrulanana kadar kullanıcıyı bekletir.
  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <Loader2 size={48} className={styles.spinner} />
        <span>Oturum kontrol ediliyor...</span>
      </div>
    );
  }

  // 2. KONTROL: Yükleme bittikten sonra kullanıcı yoksa (giriş yapmamış veya logout olmuşsa)
  if (!currentUser) {
    // 'replace' prop'u tarayıcı geçmişini temizler
    return <Navigate to="/" replace />;
  }

  // 3. KONTROL: Kullanıcı varsa ve aktifse
  // (Layout component'inizin Navbar'ı içerdiğini varsayıyoruz)
  return (
    <Layout userRole={currentUser.role}>
      <Outlet />
    </Layout>
  );
};

export default ProtectedRoute;