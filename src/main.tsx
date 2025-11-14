// src/main.tsx

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './global.css';
import { AuthProvider } from './context/AuthContext'; // <-- YENİ IMPORT

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/* AuthProvider'ı en dışa ekliyoruz */}
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>
);