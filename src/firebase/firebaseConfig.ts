// src/firebase/firebaseConfig.ts

import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// .env.local dosyasından VITE_ önekli değişkenleri oku
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Hata kontrolü
if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  console.error(
    'Firebase yapılandırma anahtarları eksik! .env.local dosyanızı kontrol edin.'
  );
}

const app = initializeApp(firebaseConfig);

// Firestore veritabanı hizmetini başlat ve export et
export const db = getFirestore(app);

export default app;