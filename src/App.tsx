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

// YENİ: Maaş Hesaplama Sayfası Importu
import CoachPayments from './pages/Admin/CoachManagement/Payments/CoachPayments';

// === KOÇ SAYFALARI ===
import CoachDashboardPage from './pages/Coach/CoachDashboardPage';
import CoachMembersPage from './pages/Coach/CoachMembersPage';
import CoachSchedulePage from './pages/Coach/CoachSchedulePage';
import CoachMemberDetails from './pages/Coach/CoachMemberDetails'; 


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
          
          {/* YENİ: Maaş Hesaplama Rotası */}
          <Route path="/admin/payments" element={<CoachPayments />} />
          
          <Route path="/admin/approvals" element={<Approvals />} />
          <Route path="/admin/settings" element={<Settings />} />

          {/* == KOÇ ROTALARI == */}
          <Route 
            path="/coach" 
            element={<CoachDashboardPage />} 
          />
          <Route 
            path="/coach/members" 
            element={<CoachMembersPage />} 
          />
          <Route 
            path="/coach/members/:memberId" 
            element={<CoachMemberDetails />} 
          />
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