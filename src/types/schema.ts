import { Timestamp } from 'firebase/firestore';

// ==========================================
// 1. ENUM VE SABİTLER (Strict Typing)
// ==========================================

export type UserRole = 'admin' | 'coach' | 'member';
export type TransactionType = 'SALE' | 'USAGE' | 'REFUND' | 'ADJUSTMENT' | 'PAYOUT';
export type WalletSource = 'CASH' | 'CREDIT_CARD' | 'BANK_TRANSFER';
export type ProductType = 'PT_PACK' | 'MEMBERSHIP' | 'GROUP_CLASS';

// ==========================================
// 2. KULLANICILAR VE PROFİLLER
// ==========================================

// Global Kullanıcı Koleksiyonu (users/{userId})
// Auth ve Profil verisi burada. Rolüne göre detaylar alt koleksiyonlarda değil,
// 'profiles' alanında veya ayrı 'coaches'/'members' koleksiyonlarında tutulabilir.
// Profesyonel yönetimde 'coaches' ve 'members' ayrı kök koleksiyonlar olması
// sorgulama performansını artırır.

export interface CoachProfile {
  id: string; // Auth UID
  email: string;
  fullName: string;
  specialties: string[];
  branchId: string;
  
  // Finansal Ayarlar
  commissionRate: number; // Örn: 0.40 (%40) veya sabit tutar
  commissionModel: 'PERCENTAGE' | 'FIXED_PER_SESSION';
  
  // Özet İstatistikler (Read-Optimized)
  metrics: {
    activeClients: number;
    monthlyRetention: number; // %
    totalSessionsDelivered: number;
    walletBalance: number; // Kesinleşmiş, ödenmeyi bekleyen bakiye
  };
  
  createdAt: Timestamp;
}

export interface MemberProfile {
  id: string; // Auth UID veya Auto-ID
  coachId: string; // Bağlı olduğu koç (CRM mantığı)
  fullName: string;
  phone: string;
  email?: string;
  
  // Üyelik Durumu
  status: 'ACTIVE' | 'PASSIVE' | 'ARCHIVED' | 'LEAD';
  tags: string[]; // 'VIP', 'Sakatlık Var', 'Yeni Başlayan'
  
  // KREDİ CÜZDANI (En Kritik Kısım)
  // Üyenin satın aldığı paketler buraya "Kredi" olarak işlenir.
  creditBalance: {
    pt_sessions: number; // Kalan PT hakkı
    group_classes: number; // Kalan Grup dersi hakkı
    expirationDate: Timestamp | null; // En yakın son kullanma tarihi
  };
  
  metrics: {
    lastVisitDate: Timestamp | null;
    totalSpent: number; // LTV (Lifetime Value)
    attendanceRate: number; // %
  };
  
  createdAt: Timestamp;
}

// ==========================================
// 3. FİNANSAL HAREKETLER (Ledger)
// ==========================================
// Koleksiyon: `ledger`
// Burası sistemin kara kutusudur. Her kuruş ve her seans burada kayıtlıdır.
// Asla silinmez, sadece yeni kayıt eklenir.

export interface LedgerEntry {
  id: string;
  type: TransactionType;
  
  // Kiminle ilgili?
  coachId: string;
  memberId: string;
  
  // Ne oldu?
  productId?: string; // Satılan paket ID'si
  sessionId?: string; // Yapılan ders ID'si
  
  // Finansal Etki
  amount: number; // Para değeri (TL)
  credits: number; // Kredi değeri (Seans) - Satışta (+), Derste (-)
  
  // Detaylar
  description: string; // "10'lu PT Paketi Satışı" veya "Ders Katılımı: Pilates"
  timestamp: Timestamp;
  
  // Denetim
  performedBy: string; // İşlemi yapan Admin/Koç ID
}

// ==========================================
// 4. ÜRÜNLER VE PAKETLER
// ==========================================
// Koleksiyon: `products` (Şablonlar)

export interface ProductTemplate {
  id: string;
  name: string; // "12 Seans PT"
  type: ProductType;
  price: number;
  credits: number; // 12
  validityDays: number; // 90 gün geçerli
  description: string;
}

// ==========================================
// 5. OPERASYON (Zamanlama)
// ==========================================
// Koleksiyon: `sessions`

export interface Session {
  id: string;
  coachId: string;
  
  title: string;
  type: 'ONE_ON_ONE' | 'GROUP';
  
  // Zaman
  startAt: Timestamp;
  endAt: Timestamp;
  durationMinutes: number;
  
  // Katılımcılar
  participants: {
    memberId: string;
    memberName: string;
    status: 'BOOKED' | 'CHECKED_IN' | 'NO_SHOW' | 'CANCELED';
    chargedCredits: number; // Bu derste kaç kredi düştü? (Genelde 1)
  }[];
  
  // Durum
  isCompleted: boolean; // Tamamlandı mı? (Hakedişi tetikler)
  notes?: string;
}