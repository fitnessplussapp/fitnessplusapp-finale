// src/components/MobileBottomNav/MobileBottomNav.tsx

import React from 'react';
// YENİ: useNavigate ve NavLink (NavLink zaten vardı ama netlik için)
import { NavLink, useNavigate } from 'react-router-dom';
import styles from './MobileBottomNav.module.css';
import {
  LayoutDashboard,
  Users,
  CheckSquare,
  Settings,
  Calendar,
  LogOut // YENİ: Çıkış ikonu eklendi
} from 'lucide-react';
// YENİ: AuthContext hook'u eklendi
import { useAuth } from '../../context/AuthContext'; 

interface MobileBottomNavProps {
  userRole: 'admin' | 'coach';
}

const MobileBottomNav: React.FC<MobileBottomNavProps> = ({ userRole }) => {
  // YENİ: Hook'lar çağırıldı
  const { logout } = useAuth();
  const navigate = useNavigate();

  const basePath = userRole === 'admin' ? '/admin' : '/coach';

  const getNavLinkClass = ({ isActive }: { isActive: boolean }) => {
    return isActive ? `${styles.navLink} ${styles.active}` : styles.navLink;
  };

  // YENİ: Çıkış yapma fonksiyonu (Navbar.tsx'ten alındı)
  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <nav className={styles.bottomNav}>
      
      <NavLink to={basePath} className={getNavLinkClass} end>
        {({ isActive }) => (
          <>
            <LayoutDashboard size={22} className={styles.icon} />
            <span className={styles.label}>Dashboard</span>
          </>
        )}
      </NavLink>

      {/* 2. Admin Linkleri */}
      {userRole === 'admin' && (
        <>
          <NavLink to="/admin/coaches" className={getNavLinkClass}>
            {({ isActive }) => (
              <>
                <Users size={22} className={styles.icon} />
                <span className={styles.label}>Koçlar</span>
              </>
            )}
          </NavLink>
          <NavLink to="/admin/approvals" className={getNavLinkClass}>
            {({ isActive }) => (
              <>
                <CheckSquare size={22} className={styles.icon} />
                <span className={styles.label}>Onaylar</span>
              </>
            )}
          </NavLink>
          <NavLink to="/admin/settings" className={getNavLinkClass}>
            {({ isActive }) => (
              <>
                <Settings size={22} className={styles.icon} />
                <span className={styles.label}>Ayarlar</span>
              </>
            )}
          </NavLink>
        </>
      )}

      {/* 3. Koç Linkleri */}
      {userRole === 'coach' && (
        <>
          <NavLink to={`${basePath}/members`} className={getNavLinkClass}>
            {({ isActive }) => (
              <>
                <Users size={22} className={styles.icon} />
                <span className={styles.label}>Üyeler</span>
              </>
            )}
          </NavLink>
          <NavLink to={`${basePath}/schedule`} className={getNavLinkClass}>
            {({ isActive }) => (
              <>
                <Calendar size={22} className={styles.icon} />
                <span className={styles.label}>Program</span>
              </>
            )}
          </NavLink>
        </>
      )}

      {/* 4. YENİ: ÇIKIŞ BUTONU */}
      {/* Bu bir NavLink değil, basit bir butondur.
        Diğer linklerle aynı temel stile (.navLink) sahip olması için 
        ve özel hover rengi (kırmızı) için .logoutButtonMobile sınıfını verdik.
      */}
      <button 
        className={`${styles.navLink} ${styles.logoutButtonMobile}`} 
        onClick={handleLogout} 
        title="Çıkış Yap"
      >
        <LogOut size={22} className={styles.icon} />
        {/* .label sınıfı CSS tarafından zaten gizleniyor 
          (sadece active olunca görünüyor).
          Bu buton "active" olamayacağı için etiket görünmeyecek,
          bu da istediğimiz ikon-temelli buton görünümünü sağlıyor.
        */}
        <span className={styles.label}>Çıkış</span>
      </button>

    </nav>
  );
};

export default MobileBottomNav;