// src/components/Navbar/Navbar.tsx

import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import styles from './Navbar.module.css';
import {
  LayoutDashboard,
  Users,
  CheckSquare,
  Settings,
  UserCircle,
  LogOut,
  Calendar,
  Calculator // YENİ: Hesap Makinesi İkonu
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

// Logo importu
import appLogo from '../../assets/logo.png'; 

interface NavbarProps {
  userRole: 'admin' | 'coach';
}

const Navbar: React.FC<NavbarProps> = ({ userRole }) => {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  
  const appVersion = import.meta.env.PACKAGE_VERSION || 'v1.0.0';

  const basePath = userRole === 'admin' ? '/admin' : '/coach';

  const getNavLinkClass = ({ isActive }: { isActive: boolean }) => {
    return isActive ? `${styles.navLink} ${styles.active}` : styles.navLink;
  };

  const handleLogout = () => {
    logout();
    navigate('/'); 
  };

  return (
    <nav className={styles.navbar}>
      <div className={styles.navbarContent}>
        
        {/* SOL KISIM: LOGO VE VERSİYON */}
        <div className={styles.logoWrapper}>
          <div className={styles.logo}>
            <img 
              src={appLogo} 
              alt="Esperto PT Logo" 
              className={styles.logoImage} 
            />
            <span>ESPERTO-<span className={styles.logoPlus}>PT</span></span>
          </div>
          <div className={styles.versionBadge}>
            v{appVersion}
          </div>
        </div>

        {/* ORTA KISIM: MENÜLER (Masaüstü) */}
        <div className={styles.navLinks}>
          <NavLink to={basePath} className={getNavLinkClass} end>
            <LayoutDashboard size={20} />
            <span>Dashboard</span>
          </NavLink>

          {userRole === 'admin' && (
            <>
              <NavLink to="/admin/coaches" className={getNavLinkClass}>
                <Users size={20} />
                <span>Koç Yönetimi</span>
              </NavLink>

              {/* YENİ: Maaş Hesapla Linki */}
              <NavLink to="/admin/payments" className={getNavLinkClass}>
                <Calculator size={20} />
                <span>Maaş Hesapla</span>
              </NavLink>

              <NavLink to="/admin/approvals" className={getNavLinkClass}>
                <CheckSquare size={20} />
                <span>Onaylar</span>
              </NavLink>
              <NavLink to="/admin/settings" className={getNavLinkClass}>
                <Settings size={20} />
                <span>Ayarlar</span>
              </NavLink>
            </>
          )}

          {userRole === 'coach' && (
            <>
              <NavLink to={`${basePath}/members`} className={getNavLinkClass}>
                <Users size={20} />
                <span>Üyeler</span>
              </NavLink>
              <NavLink to={`${basePath}/schedule`} className={getNavLinkClass}>
                <Calendar size={20} />
                <span>Program</span>
              </NavLink>
            </>
          )}
        </div>

        {/* SAĞ KISIM: PROFİL */}
        <div className={styles.userProfile}>
          <span className={styles.userName}>
            {currentUser ? currentUser.username : 'Kullanıcı'}
          </span>
          <UserCircle size={32} className={styles.userAvatar} />
          <button className={styles.logoutButton} onClick={handleLogout} title="Çıkış Yap">
            <LogOut size={20} />
          </button>
        </div>

      </div>
    </nav>
  );
};

export default Navbar;