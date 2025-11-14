// src/App.tsx

import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

// Korumalı Yol Bileşeni
import ProtectedRoute from './components/ProtectedRoute/ProtectedRoute';

// === ADMIN SAYFALARI ===
import Login from './pages/Login/Login';
import AdminDashboard from './pages/Admin/Dashboard/Dashboard';
import CoachManagement from './pages/Admin/CoachManagement/CoachManagement';
import CoachDetails from './pages/Admin/CoachManagement/members/CoachMembers';
import MemberDetails from './pages/Admin/CoachManagement/members/MemberDetails';
import Settings from './pages/Admin/Settings/Settings';
import Approvals from './pages/Admin/Approvals/Approvals';
import WeeklySchedule from './pages/Admin/CoachManagement/schedule/WeeklySchedule';

// === KOÇ SAYFALARI ===
import CoachDashboardPage from './pages/Coach/CoachDashboardPage';
import CoachMembersPage from './pages/Coach/CoachMembersPage';
import CoachSchedulePage from './pages/Coach/CoachSchedulePage';

// === GÜNCELLEME: Koç'un üye detay sayfası import edildi ===
import CoachMemberDetails from './pages/Coach/CoachMemberDetails'; 
// (Bu dosyanın adının 'CoachMemberDetails.tsx' olduğunu varsayıyorum)
// ----------------------------------------------------


const App: React.FC = () => {

  return (
    <BrowserRouter>
      <Routes>

        {/* 1. GİRİŞ YOLU (Genel/Public) */}
        <Route path="/" element={<Login />} />


        {/* 2. KORUMALI YOLLAR (ADMIN VE KOÇ) */}
        <Route element={<ProtectedRoute />}>
          
          {/* == ADMIN ROTALARI == */}
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/coaches" element={<CoachManagement />} />
          <Route path="/admin/coaches/:id" element={<CoachDetails />} />
          <Route
            path="/admin/coaches/:id/members/:memberId" 
            element={<MemberDetails />}
          />
          <Route 
            path="/admin/coaches/:id/schedule" 
            element={<WeeklySchedule />}
          />
          <Route path="/admin/approvals" element={<Approvals />} />
          <Route path="/admin/settings" element={<Settings />} />

          {/* == KOÇ ROTALARI (GÜNCELLENDİ) == */}
          <Route 
            path="/coach" 
            element={<CoachDashboardPage />} 
          />
          <Route 
            path="/coach/members" 
            element={<CoachMembersPage />} // Üye Listesi
          />
          
          {/* === GÜNCELLEME: Koç'un üye detay sayfası rotası eklendi === */}
          <Route 
            path="/coach/members/:memberId" 
            element={<CoachMemberDetails />} // Üye Detay Sayfası
          />
          {/* -------------------------------------------------- */}
          
          <Route 
            path="/coach/schedule" 
            element={<CoachSchedulePage />} 
          />
          
        </Route>

      </Routes>
    </BrowserRouter>
  );
};

export default App;