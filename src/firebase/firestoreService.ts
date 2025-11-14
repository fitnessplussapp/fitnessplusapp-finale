// src/firebase/firestoreService.ts

import { db } from './firebaseConfig';

import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  increment,
  getDocs,
  query,
  collection,
  collectionGroup,
  where,
  Timestamp, // Timestamp import edildi
  addDoc, 
  serverTimestamp,
  orderBy,
  Timestamp as FirebaseTimestamp,
  where as firebaseWhere,
  writeBatch
} from 'firebase/firestore';

// 2. SADECE TypeScript TÜRLERİ
import type { 
  Query,
  DocumentReference, 
  DocumentData,
  SetOptions,
  UpdateData,
  Timestamp as TimestampType
} from 'firebase/firestore';


// ================================================================
// === YARDIMCI TİPLER VE FONKSİYONLAR ===
// ================================================================

// Koç payı tipini tanımla
interface CoachShare {
  value: number;
  type: 'TL' | '%';
}

/**
 * 'sessionCount' parametresi eklendi
 */
const calculateFinancials = (
  price: number, 
  coachShare: CoachShare | null,
  sessionCount: number 
): {
  companyCut: number,
  coachCut: number,
} => {
  let companyCut = 0;
  let coachCut = price;
  
  if (coachShare && coachShare.value > 0) {
    const shareValue = coachShare.value;
    if (coachShare.type === 'TL') {
      companyCut = shareValue * sessionCount; 
      coachCut = Math.max(0, price - companyCut);
    } else {
      companyCut = price * (shareValue / 100); 
      coachCut = price - companyCut;
    }
  }
  return { companyCut, coachCut };
};


// ================================================================
// MEVCUT SAYAÇ KODLARI (Değişiklik yok)
// ================================================================

const getTodaysDateString = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const incrementUsage = async (
  type: 'reads' | 'writes' | 'deletes',
  count: number = 1
) => {
  if (count === 0) return; 
  const today = getTodaysDateString();
  const usageDocRef = doc(db, 'usage', today);
  try {
    await setDoc(usageDocRef, {
      [type]: increment(count),
      lastUpdated: new Date()
    }, { merge: true });
  } catch (error) {
    console.error("Sayaç güncellenemedi:", error);
  }
};

export const setDocWithCount = async (
  reference: DocumentReference<DocumentData>, 
  data: DocumentData, 
  options?: SetOptions
) => {
  incrementUsage('writes');
  return options ? setDoc(reference, data, options) : setDoc(reference, data);
};

export const updateDocWithCount = async (
  reference: DocumentReference<DocumentData>, 
  data: UpdateData<DocumentData>
) => {
  incrementUsage('writes');
  return updateDoc(reference, data);
};

export const deleteDocWithCount = async (
  reference: DocumentReference<DocumentData>
) => {
  incrementUsage('deletes');
  return deleteDoc(reference);
};

export const getDocWithCount = async (
  reference: DocumentReference<DocumentData>
) => {
  incrementUsage('reads', 1); 
  return getDoc(reference);
};

export const getDocsWithCount = async (
  q: Query<DocumentData>
) => {
  const querySnapshot = await getDocs(q);
  const readCount = querySnapshot.empty ? 1 : querySnapshot.size;
  incrementUsage('reads', readCount); 
  return querySnapshot;
};

export const getTodaysUsage = async (): Promise<{ reads: number, writes: number, deletes: number }> => {
  const today = getTodaysDateString();
  const usageDocRef = doc(db, 'usage', today);
  try {
    const docSnap = await getDoc(usageDocRef); 
    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        reads: data.reads || 0,
        writes: data.writes || 0,
        deletes: data.deletes || 0,
      };
    }
  } catch (error) {
    console.error("Kullanım verisi çekilemedi:", error);
  }
  return { reads: 0, writes: 0, deletes: 0 };
};

// ================================================================
// YENİ FONKSİYON: TÜM KOÇLARI GETİR (Dropdown için)
// ================================================================

export interface CoachBasicInfo {
  id: string;
  username: string;
}

/**
 * Filtre dropdown'ı için tüm koçların ID ve kullanıcı adlarını çeker
 */
export const getAllCoaches = async (): Promise<CoachBasicInfo[]> => {
  try {
    const q = query(collection(db, 'coaches'), orderBy('username', 'asc'));
    const snapshot = await getDocsWithCount(q);
    
    if (snapshot.empty) {
      return [];
    }
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      username: doc.data().username || 'İsimsiz Koç'
    }));
    
  } catch (error) {
    console.error("Tüm koçlar çekilemedi:", error);
    throw error;
  }
};


// ================================================================
// DASHBOARD FONKSİYONU (Değişiklik yok, önceki adımdaki gibi)
// ================================================================

interface DashboardStats {
  companyCut: number;
  members: number;
  coaches: number;
  approvals: number;
  activeCoaches: number;
  pendingPayments: number;
}

export const getDashboardStats = async (
  startDate: Date, 
  endDate: Date,
  coachId: string | null 
): Promise<DashboardStats> => {
  
  const startTimestamp = Timestamp.fromDate(startDate);
  const endOfDay = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 23, 59, 59);
  const endTimestamp = Timestamp.fromDate(endOfDay);
  
  const dateClauses = [
      where('createdAt', '>=', startTimestamp),
      where('createdAt', '<=', endTimestamp)
  ];

  try {
    const coachesQuery = query(collection(db, 'coaches'));
    const activeCoachesQuery = query(
      collection(db, 'coaches'), 
      where('isActive', '==', true)
    );
    
    const [coachesSnap, activeCoachesSnap] = await Promise.all([
        getDocsWithCount(coachesQuery),
        getDocsWithCount(activeCoachesQuery)
    ]);

    let totalCompanyCut = 0;
    let totalMembers = 0;
    let totalApprovals = 0;
    let totalPendingPayments = 0;


    // === SENARYO 1: KOÇ SEÇİLİ ("emin" seçildi) ===
    if (coachId) {
        
        const membersQuery = query(collection(db, 'coaches', coachId, 'members'));
        const membersSnap = await getDocsWithCount(membersQuery);
        totalMembers = membersSnap.size;

        if (membersSnap.empty) {
            return {
                coaches: coachesSnap.size,
                activeCoaches: activeCoachesSnap.size,
                members: 0,
                companyCut: 0,
                approvals: 0,
                pendingPayments: 0,
            };
        }

        const allPackageQueries: Promise<DocumentData[]>[] = [];

        for (const memberDoc of membersSnap.docs) {
            const packagesRef = collection(memberDoc.ref, 'packages');
            const approvalsQuery = query(packagesRef, where('approvalStatus', '==', 'Pending'), ...dateClauses);
            const pendingQuery = query(packagesRef, where('paymentStatus', '==', 'Pending'), ...dateClauses);
            const cutQuery = query(packagesRef, where('approvalStatus', '==', 'Approved'), ...dateClauses);

            allPackageQueries.push(
                getDocsWithCount(approvalsQuery).then(snap => snap.docs.map(d => ({...d.data(), _type: 'approval'}))),
                getDocsWithCount(pendingQuery).then(snap => snap.docs.map(d => ({...d.data(), _type: 'pending'}))),
                getDocsWithCount(cutQuery).then(snap => snap.docs.map(d => ({...d.data(), _type: 'cut'})))
            );
        }

        const resultsByMember = await Promise.all(allPackageQueries);
        const allPackages = resultsByMember.flat();

        allPackages.forEach(pkg => {
            if (pkg._type === 'approval') {
                totalApprovals++;
            }
            if (pkg._type === 'pending') {
                totalPendingPayments++;
            }
            if (pkg._type === 'cut') {
                const share = (pkg.share || null) as CoachShare | null;
                const price = pkg.price || 0;
                const sessions = pkg.sessionCount || 0;
                const { companyCut } = calculateFinancials(price, share, sessions);
                totalCompanyCut += companyCut;
            }
        });

    } 
    // === SENARYO 2: TÜM KOÇLAR ("Tüm Koçlar" seçili) ===
    else {
        // UYARI: Bu senaryo, 'packages' dökümanlarında 'coachId' alanı 
        // OLMADAN DOĞRU ÇALIŞMAYACAKTIR.
        
        const coachClause = coachId ? [where('coachId', '==', coachId)] : [];
        const basePackagesQuery = collectionGroup(db, 'packages');
        const membersQuery = query(collectionGroup(db, 'members'));
        const approvalsQuery = query(basePackagesQuery, where('approvalStatus', '==', 'Pending'), ...dateClauses, ...coachClause);
        const pendingPaymentsQuery = query(basePackagesQuery, where('paymentStatus', '==', 'Pending'), ...dateClauses, ...coachClause);
        const companyCutQuery = query(basePackagesQuery, where('approvalStatus', '==', 'Approved'), ...dateClauses, ...coachClause);

        const [
          membersSnap, 
          approvalsSnap, 
          pendingPaymentsSnap,
          companyCutSnap
        ] = await Promise.all([
          getDocsWithCount(membersQuery),
          getDocsWithCount(approvalsQuery),
          getDocsWithCount(pendingPaymentsQuery),
          getDocsWithCount(companyCutQuery)
        ]);
        
        totalMembers = membersSnap.size;
        totalApprovals = approvalsSnap.size;
        totalPendingPayments = pendingPaymentsSnap.size;
        
        totalCompanyCut = companyCutSnap.docs.reduce((sum, doc) => {
            const pkg = doc.data();
            const share = (pkg.share || null) as CoachShare | null;
            const price = pkg.price || 0;
            const sessions = pkg.sessionCount || 0;
            const { companyCut } = calculateFinancials(price, share, sessions);
            return sum + companyCut;
        }, 0);
    }
    
    // === FİNAL SONUCU DÖN ===
    return {
      coaches: coachesSnap.size,
      activeCoaches: activeCoachesSnap.size,
      members: totalMembers,
      companyCut: totalCompanyCut,
      approvals: totalApprovals,
      pendingPayments: totalPendingPayments,
    };

  } catch (error) {
    console.error("Dashboard istatistikleri çekilemedi:", error);
    throw error;
  }
};


// ================================================================
// ONAYLAR FONKSİYONLARI (Değişiklik yok)
// ================================================================

export interface PendingApproval {
  id: string; // packageId
  coachId: string;
  memberId: string;
  coachName: string;
  memberName: string;
  packageData: DocumentData; 
}

export const getPendingApprovals = async (): Promise<PendingApproval[]> => {
  const q = query(
    collectionGroup(db, 'packages'), 
    where('approvalStatus', '==', 'Pending')
  );
  const snapshot = await getDocsWithCount(q);
  if (snapshot.empty) {
    return [];
  }
  const approvals: PendingApproval[] = await Promise.all(
    snapshot.docs.map(async (packageDoc): Promise<PendingApproval> => {
      const packageData = packageDoc.data();
      const pathParts = packageDoc.ref.path.split('/');
      const coachId = packageData.coachId || pathParts[1]; 
      const memberId = pathParts[3];
      const memberRef = doc(db, 'coaches', coachId, 'members', memberId);
      const coachRef = doc(db, 'coaches', coachId);
      
      const [memberSnap, coachSnap] = await Promise.all([
        getDocWithCount(memberRef),
        getDocWithCount(coachRef)
      ]);
      
      return {
        id: packageDoc.id,
        coachId: coachId,
        memberId: memberId,
        packageData: packageData,
        memberName: memberSnap.data()?.name || 'Bilinmeyen Üye',
        coachName: coachSnap.data()?.username || 'Bilinmeyen Koç',
      };
    })
  );
  return approvals;
};

export const approvePackageAndUpdateRefs = async (
  approval: PendingApproval
) => {
  const { coachId, memberId, id: packageId, packageData } = approval;
  const startDate = (packageData.createdAt as Timestamp).toDate();
  const duration = packageData.duration as number;
  const sessionCount = packageData.sessionCount as number;
  const price = packageData.price as number;
  const packageShare = (packageData.share as CoachShare) || { type: '%', value: 0 };
  const endDate = new Date(startDate.getTime());
  endDate.setDate(startDate.getDate() + duration - 1); 
  const packageRef = doc(db, 'coaches', coachId, 'members', memberId, 'packages', packageId);
  const memberRef = doc(db, 'coaches', coachId, 'members', memberId);
  const coachRef = doc(db, 'coaches', coachId); 
  const { companyCut } = calculateFinancials(price, packageShare, sessionCount);
  const batch = writeBatch(db);
  
  batch.update(packageRef, {
    approvalStatus: 'Approved',
    lastUpdated: serverTimestamp(),
    coachId: coachId 
  });
  
  batch.update(memberRef, {
    currentSessionCount: sessionCount,
    packageStartDate: startDate,
    packageEndDate: endDate
  });
  
  batch.update(coachRef, {
    companyCut: increment(companyCut)
  });
  
  incrementUsage('writes', 3);
  return batch.commit();
};


// ================================================================
// MEVCUT DİĞER FONKSİYONLAR (Değişiklik yok)
// ================================================================

export const getMemberPackageHistory = async (coachId: string, memberId: string) => {
  const packagesColRef = collection(db, 'coaches', coachId, 'members', memberId, 'packages');
  const q = query(packagesColRef, orderBy('createdAt', 'desc'));
  return getDocsWithCount(q);
};

export const getCoachMembers = async (coachId: string): Promise<DocumentData[]> => {
  const membersColRef = collection(db, 'coaches', coachId, 'members');
  const q = query(membersColRef, orderBy('name', 'asc'));
  const snapshot = await getDocsWithCount(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const getCoachScheduleForDay = async (coachId: string, day: string) => {
  const scheduleColRef = collection(db, 'coaches', coachId, 'schedule');
  const q = query(
    scheduleColRef, 
    where('day', '==', day)
  );
  return getDocsWithCount(q);
}; 

export const setAppointment = async (
  coachId: string, 
  scheduleId: string, 
  data: DocumentData
) => {
  const appointmentRef = doc(db, 'coaches', coachId, 'schedule', scheduleId);
  return setDocWithCount(appointmentRef, data);
};

export const deleteAppointment = async (coachId: string, scheduleId: string) => {
  const appointmentRef = doc(db, 'coaches', coachId, 'schedule', scheduleId);
  return deleteDocWithCount(appointmentRef);
};


// ================================================================
// === GÜNCELLEME: HAFTALIK PROGRAM ÖZETİ FONKSİYONU ===
// ================================================================

// Tarih Yardımcı Fonksiyonları (WeeklySchedule.tsx'ten kopyalandı)
const getLocalDateString = (date: Date): string => {
  return date.toLocaleDateString('en-CA'); // YYYY-MM-DD formatı
};

const getWeekDays = (baseDate: Date) => {
  const days: Date[] = [];
  const todayIndex = baseDate.getDay();
  // Pazartesi'yi haftanın başı olarak ayarla (Pazar = 0)
  const diffToMonday = todayIndex === 0 ? -6 : 1 - todayIndex;
  const monday = new Date(baseDate);
  monday.setDate(baseDate.getDate() + diffToMonday);
  for (let i = 0; i < 7; i++) {
    const day = new Date(monday);
    day.setDate(monday.getDate() + i);
    days.push(day);
  }
  return days;
};
// -----------------------------------

// === GÜNCELLEME: Dashboard'un kullanacağı özet tipi ===
// Randevu detayı
export interface ScheduleAppointmentDetail {
  time: string;
  memberName: string;
}
// Günlük özet
export interface DailyScheduleSummary {
  dayName: string;      // "Pzt"
  dayNumber: number;    // 11
  isToday: boolean;     // Bugün mü?
  appointments: ScheduleAppointmentDetail[]; // YENİ: [{time: "11:00", memberName: "Test1"}]
}

/**
 * Belirli bir koç için mevcut haftanın 7 günlük randevu özetini çeker.
 * GÜNCELLENDİ: Artık randevu saatlerini VE isimlerini döndürür.
 */
export const getCoachScheduleForWeek = async (
  coachId: string, 
  baseDate: Date
): Promise<DailyScheduleSummary[]> => {
  
  try {
    const weekDates = getWeekDays(baseDate); // [Date, Date, ...] (7 adet)
    const todayStr = getLocalDateString(new Date());
    
    // 1. Sorgu için 7 günlük string dizisi oluştur (örn: ['2025-11-10', ...])
    const weekDayStrings = weekDates.map(getLocalDateString);

    // 2. TEK BİR SORGULA 7 GÜNÜN TÜM RANDEVULARINI ÇEK
    const scheduleQuery = query(
      collection(db, 'coaches', coachId, 'schedule'),
      where('day', 'in', weekDayStrings)
    );
    
    const snapshot = await getDocsWithCount(scheduleQuery);
    
    // 3. Randevuları günlerine göre SAATLERİ ve İSİMLERİ ile haritala
    // (örn: {'2025-11-12': [{time: "11:00", memberName: "Test1"}], ...})
    const appointmentsByDay = new Map<string, ScheduleAppointmentDetail[]>();
    snapshot.docs.forEach(doc => {
      const day = doc.data().day; // '2025-11-12'
      const time = doc.data().time; // '11:00'
      const memberName = doc.data().memberName || 'Bilinmeyen'; // Üye adını al
      
      if (day && time) {
        const dayAppointments = appointmentsByDay.get(day) || [];
        dayAppointments.push({ time, memberName }); // Obje olarak ekle
        appointmentsByDay.set(day, dayAppointments);
      }
    });

    // 4. Dashboard'a göndermek için son özet dizisini oluştur
    const summary: DailyScheduleSummary[] = weekDates.map(dateObj => {
      const dayStr = getLocalDateString(dateObj);
      const appointments = appointmentsByDay.get(dayStr) || [];
      // Saatleri kronolojik olarak sırala
      appointments.sort((a, b) => a.time.localeCompare(b.time)); 
      
      return {
        dayName: dateObj.toLocaleDateString('tr-TR', { weekday: 'short' }),
        dayNumber: dateObj.getDate(),
        appointments: appointments, // Obje dizisini döndür
        isToday: dayStr === todayStr,
      };
    });
    
    return summary;

  } catch (error) {
    console.error("Haftalık program özeti çekilemedi:", error);
    throw error;
  }
};