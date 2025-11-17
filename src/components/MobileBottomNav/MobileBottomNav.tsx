// src/components/MobileBottomNav/MobileBottomNav.tsx

import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import styles from './MobileBottomNav.module.css';
import {
  LayoutDashboard,
  Users,
  CheckSquare,
  Settings,
  Calendar,
  LogOut,
  Calculator // YENİ: İkon
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext'; 

interface MobileBottomNavProps {
  userRole: 'admin' | 'coach';
}

const MobileBottomNav: React.FC<MobileBottomNavProps> = ({ userRole }) => {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const basePath = userRole === 'admin' ? '/admin' : '/coach';

  const getNavLinkClass = ({ isActive }: { isActive: boolean }) => {
    return isActive ? `${styles.navLink} ${styles.active}` : styles.navLink;
  };

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

          {/* YENİ: Maaş Hesapla Linki (Mobilde "Maaş" kısa tutulabilir ama sığar) */}
          <NavLink to="/admin/payments" className={getNavLinkClass}>
            {({ isActive }) => (
              <>
                <Calculator size={22} className={styles.icon} />
                <span className={styles.label}>Maaş Hesapla</span>
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

      {/* 4. ÇIKIŞ BUTONU */}
      <button 
        className={`${styles.navLink} ${styles.logoutButtonMobile}`} 
        onClick={handleLogout} 
        title="Çıkış Yap"
      >
        <LogOut size={22} className={styles.icon} />
        <span className={styles.label}>Çıkış</span>
      </button>

    </nav>
  );
};

export default MobileBottomNav;