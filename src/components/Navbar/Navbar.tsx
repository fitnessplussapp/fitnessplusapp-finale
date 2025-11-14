// src/components/Navbar/Navbar.tsx

import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import styles from './Navbar.module.css';
import {
  Sparkles,
  LayoutDashboard,
  Users, // "Üyeler" için bu ikonu kullanacağız
  CheckSquare,
  Settings,
  UserCircle,
  LogOut,
  Calendar 
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface NavbarProps {
  userRole: 'admin' | 'coach';
}

const Navbar: React.FC<NavbarProps> = ({ userRole }) => {
  const { currentUser, logout } = useAuth();
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
    <nav className={styles.navbar}>
      <div className={styles.navbarContent}>
        
        <div className={styles.logo}>
          <Sparkles size={32} className={styles.logoIcon} />
          ESPERTO-<span className={styles.logoPlus}>PT</span>
        </div>

        {/* 2. Desktop Navigasyon Linkleri (GÜNCELLENDİ) */}
        <div className={styles.navLinks}>
          
          <NavLink to={basePath} className={getNavLinkClass} end>
            <LayoutDashboard size={20} />
            <span>Dashboard</span>
          </NavLink>

          {/* Admin'e Özel Linkler */}
          {userRole === 'admin' && (
            <>
              <NavLink to="/admin/coaches" className={getNavLinkClass}>
                <Users size={20} />
                <span>Koç Yönetimi</span>
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

          {/* Koç'a Özel Linkler (GÜNCELLENDİ) */}
          {userRole === 'coach' && (
            <>
              {/* YENİ: Üyeler Linki */}
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

        {/* 3. Kullanıcı Profili Alanı */}
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