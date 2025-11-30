import { 
  collection, doc, getDoc, getDocs, setDoc, updateDoc, 
  query, where, orderBy, runTransaction, 
  Timestamp, increment, serverTimestamp 
} from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig';
import type { 
  CoachProfile, MemberProfile, LedgerEntry, ProductTemplate, Session 
} from '../types/schema';

class DatabaseService {

  // =================================================================
  // 1. ADMIN: KOÇ YÖNETİMİ (COACH MANAGEMENT)
  // =================================================================

  /**
   * Yeni bir Koç oluşturur.
   * v3.0 Standardı: Metrikler ve Cüzdan (Wallet) sıfır olarak başlatılır.
   */
  async createCoach(coachData: Omit<CoachProfile, 'createdAt' | 'metrics'>) {
    const coachRef = doc(db, 'coaches', coachData.id); // ID genelde Username veya Auth ID olur
    
    // Çift kayıt kontrolü
    const snap = await getDoc(coachRef);
    if (snap.exists()) throw new Error("Bu ID ile bir koç zaten mevcut.");

    const newCoach: CoachProfile = {
      ...coachData,
      createdAt: Timestamp.now(),
      // Kritik: Performans metriklerini başlangıçta sıfırla
      metrics: {
        activeClients: 0,
        monthlyRetention: 100,
        totalSessionsDelivered: 0,
        walletBalance: 0
      }
    };

    await setDoc(coachRef, newCoach);
    return newCoach;
  }

  /**
   * Tüm koçları, performans metrikleriyle beraber getirir.
   * Eski sistemdeki gibi her koç için tekrar tekrar sorgu atmaz (Read Optimized).
   */
  async getAllCoaches(): Promise<CoachProfile[]> {
    const q = query(collection(db, 'coaches'), orderBy('fullName'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data() as CoachProfile);
  }

  /**
   * Koçu siler (Güvenli Silme).
   * Eğer koçun aktif üyesi veya bakiyesi varsa silmeyi engeller.
   */
  async deleteCoachSafe(coachId: string) {
    const coachRef = doc(db, 'coaches', coachId);
    const snap = await getDoc(coachRef);
    
    if (!snap.exists()) throw new Error("Koç bulunamadı.");
    const data = snap.data() as CoachProfile;

    if (data.metrics.walletBalance > 0) {
      throw new Error(`Bu koçun ${data.metrics.walletBalance} TL alacağı var. Önce ödeme yapın.`);
    }
    if (data.metrics.activeClients > 0) {
      throw new Error(`Bu koçun ${data.metrics.activeClients} aktif öğrencisi var. Önce devredin.`);
    }

    // Güvenliyse sil (veya status='ARCHIVED' yap - Soft Delete daha iyidir)
    await updateDoc(coachRef, { status: 'ARCHIVED' }); // Schema'ya status eklenmeli, yoksa deleteDoc kullanılabilir
    // Şimdilik hard delete:
    // await deleteDoc(coachRef); 
  }

  // =================================================================
  // 2. FİNANSAL İŞLEM: PAKET SATIŞI (Sale Transaction)
  // =================================================================
  
  async sellPackage(coachId: string, memberId: string, product: ProductTemplate, performedBy: string) {
    return runTransaction(db, async (transaction) => {
      const memberRef = doc(db, 'coaches', coachId, 'members', memberId);
      const coachRef = doc(db, 'coaches', coachId);
      const ledgerRef = doc(collection(db, 'ledger'));

      // Ledger Kaydı (Muhasebe)
      const saleEntry: LedgerEntry = {
        id: ledgerRef.id,
        type: 'SALE',
        coachId,
        memberId,
        productId: product.id,
        amount: product.price,
        credits: product.credits,
        description: `Paket Satışı: ${product.name}`,
        timestamp: Timestamp.now(),
        performedBy: performedBy
      };

      // Son kullanma tarihi (Bugün + Geçerlilik Süresi)
      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + product.validityDays);

      transaction.set(ledgerRef, saleEntry);
      
      // Üyeye Kredi Yükle
      transaction.update(memberRef, {
        'creditBalance.pt_sessions': increment(product.credits),
        'creditBalance.expirationDate': Timestamp.fromDate(expirationDate),
        'metrics.totalSpent': increment(product.price),
        status: 'ACTIVE'
      });

      // Koçun "Aktif Üye" sayısını artır (Eğer yeni aktif olduysa)
      // Bu detaylı logic gerektirir, şimdilik basit tutuyoruz.
    });
  }

  // =================================================================
  // 3. OPERASYONEL İŞLEM: DERS TAMAMLAMA (Hakediş)
  // =================================================================
  
  async completeSession(sessionId: string) {
    return runTransaction(db, async (transaction) => {
      const sessionRef = doc(db, 'sessions', sessionId);
      const sessionSnap = await transaction.get(sessionRef);
      if (!sessionSnap.exists()) throw new Error("Ders bulunamadı");
      const sessionData = sessionSnap.data() as Session;

      if (sessionData.isCompleted) throw new Error("Bu ders zaten işlenmiş!");

      // Koç verisini al
      const coachRef = doc(db, 'coaches', sessionData.coachId);
      const coachSnap = await transaction.get(coachRef);
      const coachData = coachSnap.data() as CoachProfile;
      
      // Hakediş Hesabı (v3.0 - Komisyon Modeli)
      const estimatedSessionValue = 500; // *Burası dinamik olmalı*
      const earnings = estimatedSessionValue * coachData.commissionRate;

      // Katılımcıları işle
      for (const participant of sessionData.participants) {
        if (participant.status !== 'CHECKED_IN') continue;

        const memberRef = doc(db, 'coaches', sessionData.coachId, 'members', participant.memberId);
        
        // Kredi Düş
        transaction.update(memberRef, {
          'creditBalance.pt_sessions': increment(-participant.chargedCredits),
          'metrics.lastVisitDate': serverTimestamp()
        });

        // Ledger Kaydı (Hizmet Kullanımı)
        const ledgerRef = doc(collection(db, 'ledger'));
        const usageEntry: LedgerEntry = {
          id: ledgerRef.id,
          type: 'USAGE',
          coachId: sessionData.coachId,
          memberId: participant.memberId,
          sessionId: sessionId,
          amount: earnings, // Koça yansıyan (+)
          credits: -participant.chargedCredits,
          description: `Ders Tamamlandı: ${sessionData.title}`,
          timestamp: Timestamp.now(),
          performedBy: 'SYSTEM'
        };
        transaction.set(ledgerRef, usageEntry);
      }

      // Koçun Cüzdanını ve İstatistiklerini Güncelle
      transaction.update(coachRef, {
        'metrics.walletBalance': increment(earnings),
        'metrics.totalSessionsDelivered': increment(1)
      });

      // Dersi kapat
      transaction.update(sessionRef, { isCompleted: true });
    });
  }
}

export const dbService = new DatabaseService();