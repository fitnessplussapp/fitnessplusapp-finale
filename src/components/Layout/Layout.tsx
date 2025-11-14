import React from 'react';
import { Outlet } from 'react-router-dom';
import styles from './Layout.module.css';

// Her iki Navigasyon bileşenini de import et
import Navbar from '../Navbar/Navbar'; 
import MobileBottomNav from '../MobileBottomNav/MobileBottomNav';

interface LayoutProps {
  userRole: 'admin' | 'coach';
}

const Layout: React.FC<LayoutProps> = ({ userRole }) => {
  return (
    <div className={styles.layoutContainer}>
      
      {/* 1. Desktop (Üst) Navigasyon:
          CSS dosyası bunu mobilde otomatik olarak gizleyecek. */}
      <Navbar userRole={userRole} />

      {/* 2. Ana İçerik Alanı (Outlet) */}
      <main className={styles.mainContent}>
        <Outlet />
      </main>

      {/* 3. Mobil (Alt) Navigasyon:
          CSS dosyası bunu desktop'ta otomatik olarak gizleyecek. */}
      <MobileBottomNav userRole={userRole} />

    </div>
  );
};

export default Layout;