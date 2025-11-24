// src/firebase/firestoreService.ts

import { db } from './firebaseConfig';

// 1. RUNTIME FONKSİYONLARI (Değerler)
// Bunlar çalışan JavaScript kodlarıdır.
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
  Timestamp, 
  addDoc, 
  serverTimestamp,
  orderBy,
  writeBatch,
  arrayUnion,   
  arrayRemove,
  limit
} from 'firebase/firestore';

// 2. TYPESCRIPT TİPLERİ (Sadece "type" olarak import edilmeli)
// Bunlar derleme sırasında kullanılır, çalışırken koddan silinir.
import type { 
  Query,
  DocumentReference, 
  DocumentData,
  SetOptions,
  UpdateData
} from 'firebase/firestore';


// ================================================================
// === YARDIMCI TİPLER VE FONKSİYONLAR ===
// ================================================================

interface CoachShare {
  value: number;
  type: 'TL' | '%';
}

/**
 * Şirket ve Koç payını hesaplar.
 * @param price Paket satış fiyatı
 * @param coachShare Koçun pay bilgisi (Oran veya TL)
 * @param sessionCount Paketteki toplam ders sayısı
 */
const calculateFinancials = (
  price: number, 
  coachShare: CoachShare | null,
  sessionCount: number 
): { companyCut: number, coachCut: number } => {
  let companyCut = 0;
  let coachCut = price;
  
  // Güvenlik: Fiyat negatifse 0 kabul et
  const safePrice = Math.max(0, price);
  
  if (coachShare && coachShare.value > 0) {
    const shareValue = coachShare.value;
    
    if (coachShare.type === 'TL') {
      // TL bazlı anlaşma (Örn: Ders başı 100 TL)
      const totalCoachClaim = shareValue * (sessionCount > 0 ? sessionCount : 1);
      
      if (totalCoachClaim >= safePrice) {
        coachCut = safePrice;
        companyCut = 0;
      } else {
        companyCut = safePrice - totalCoachClaim;
        coachCut = totalCoachClaim;
      }
    } else {
      // Yüzde bazlı anlaşma (Örn: %30 Şirket Payı)
      // Varsayım: Girilen değer ŞİRKET PAYI yüzdesidir.
      companyCut = safePrice * (shareValue / 100); 
      coachCut = safePrice - companyCut;
    }
  }
  
  return { 
    companyCut: Math.max(0, companyCut), 
    coachCut: Math.max(0, coachCut) 
  };
};

// ================================================================
// MEVCUT SAYAÇ KODLARI (KULLANIM TAKİBİ)
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

// CRUD WRAPPERS (Sayaçlı)
export const setDocWithCount = async (reference: DocumentReference<DocumentData>, data: DocumentData, options?: SetOptions) => {
  incrementUsage('writes');
  return options ? setDoc(reference, data, options) : setDoc(reference, data);
};

export const updateDocWithCount = async (reference: DocumentReference<DocumentData>, data: UpdateData<DocumentData>) => {
  incrementUsage('writes');
  return updateDoc(reference, data);
};

export const deleteDocWithCount = async (reference: DocumentReference<DocumentData>) => {
  incrementUsage('deletes');
  return deleteDoc(reference);
};

export const getDocWithCount = async (reference: DocumentReference<DocumentData>) => {
  incrementUsage('reads', 1); 
  return getDoc(reference);
};

export const getDocsWithCount = async (q: Query<DocumentData>) => {
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
      return { reads: data.reads || 0, writes: data.writes || 0, deletes: data.deletes || 0 };
    }
  } catch (error) { console.error(error); }
  return { reads: 0, writes: 0, deletes: 0 };
};


// ================================================================
// === SİSTEM TANIMLAMALARI ===
// ================================================================

export interface SystemDefinition {
  id: string;
  title: string; 
  items: string[]; 
  targets: string[]; 
}

export const getSystemDefinitions = async (): Promise<SystemDefinition[]> => {
  try {
    const q = query(collection(db, 'system_definitions'), orderBy('title', 'asc'));
    const snapshot = await getDocsWithCount(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      title: doc.data().title,
      items: doc.data().items || [],
      targets: doc.data().targets || []
    })) as SystemDefinition[];
  } catch (error) {
    console.error("Sistem tanımları çekilemedi:", error);
    throw error;
  }
};

export const addSystemDefinition = async (title: string, initialTargets: string[] = []) => {
  const cleanId = title.trim(); 
  const docRef = doc(db, 'system_definitions', cleanId);
  const data = { title: cleanId, items: [], targets: initialTargets, createdAt: serverTimestamp() };
  incrementUsage('writes'); 
  return setDoc(docRef, data);
};

export const deleteSystemDefinition = async (id: string) => {
  const docRef = doc(db, 'system_definitions', id);
  return deleteDocWithCount(docRef);
};

export const addItemToDefinition = async (definitionId: string, item: string) => {
  const docRef = doc(db, 'system_definitions', definitionId);
  return updateDocWithCount(docRef, { items: arrayUnion(item) });
};

export const removeItemFromDefinition = async (definitionId: string, item: string) => {
  const docRef = doc(db, 'system_definitions', definitionId);
  return updateDocWithCount(docRef, { items: arrayRemove(item) });
};

export const addTargetToDefinition = async (definitionId: string, target: string) => {
  const docRef = doc(db, 'system_definitions', definitionId);
  return updateDocWithCount(docRef, { targets: arrayUnion(target) });
};

export const removeTargetFromDefinition = async (definitionId: string, target: string) => {
  const docRef = doc(db, 'system_definitions', definitionId);
  return updateDocWithCount(docRef, { targets: arrayRemove(target) });
};


// ================================================================
// KOÇ / ÜYE LİSTELEME VE ŞUBE MANTIĞI
// ================================================================

export interface CoachBasicInfo {
  id: string;
  username: string;
  branch?: string; 
}

/**
 * Veritabanından şube bilgisini güvenli bir şekilde çeker.
 */
const extractBranch = (data: DocumentData): string => {
  let branch = 'Merkez';
  if (data.branch) {
    branch = data.branch;
  } else if (data.customFields && typeof data.customFields === 'object') {
    const cf = data.customFields;
    // Farklı yazım şekillerini kontrol et
    const possibleKeys = ['Şubeler', 'Subeler', 'Sube', 'Branch', 'Branches', 'Şube'];
    for (const key of possibleKeys) {
       // Key'in kendisi veya lowercase hali
       const keyVariations = [key, key.toLowerCase(), key.toUpperCase()];
       
       for(const vKey of Object.keys(cf)) {
          if (keyVariations.some(k => vKey.toLowerCase().includes(k.toLowerCase()))) {
             const val = cf[vKey];
             if (Array.isArray(val) && val.length > 0) return String(val[0]);
             if (typeof val === 'string' && val.trim() !== '') return val;
          }
       }
    }
  }
  return branch;
};

export const getAllCoaches = async (): Promise<CoachBasicInfo[]> => {
  try {
    const q = query(collection(db, 'coaches'), orderBy('username', 'asc'));
    const snapshot = await getDocs(q); // Dashboard sık çağırdığı için sayaçsız
    if (snapshot.empty) return [];
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      username: doc.data().username || 'İsimsiz Koç',
      branch: extractBranch(doc.data())
    }));
  } catch (error) {
    console.error("Tüm koçlar çekilemedi:", error);
    throw error;
  }
};

export const getCoachMembers = async (coachId: string): Promise<DocumentData[]> => {
  const membersColRef = collection(db, 'coaches', coachId, 'members');
  const q = query(membersColRef, orderBy('name', 'asc'));
  const snapshot = await getDocsWithCount(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};


// ================================================================
// DASHBOARD 1: GERÇEKLEŞEN CİRO (BUGÜN)
// OPTİMİZE EDİLDİ: Promise.all ile paralel sorgu
// ================================================================

export const getTodayRealizedStats = async (date: Date, selectedBranch: string | null) => {
    const dateStr = date.toLocaleDateString('en-CA'); // YYYY-MM-DD
    
    // 1. Koçları ve Şubelerini Çek
    const coaches = await getAllCoaches();
    const coachMap = new Map<string, {name: string, branch: string}>();
    coaches.forEach(c => coachMap.set(c.id, { name: c.username, branch: c.branch || 'Merkez' }));

    // 2. Eventleri Çek
    const eventsQuery = query(collectionGroup(db, 'events'), where('date', '==', dateStr));
    const eventsSnap = await getDocs(eventsQuery);
    
    let totalRealizedRevenue = 0;
    let totalPT = 0;
    let totalGroup = 0;
    
    // Filtered events
    const filteredEvents: any[] = [];

    // Şube filtresini baştan uygula
    for (const docSnap of eventsSnap.docs) {
       const pathParts = docSnap.ref.path.split('/');
       const coachId = pathParts[1];
       const coachInfo = coachMap.get(coachId);
       const coachBranch = coachInfo?.branch || 'Merkez';

       if (selectedBranch && selectedBranch !== 'Tümü' && coachBranch !== selectedBranch) {
           continue;
       }
       filteredEvents.push({ docSnap, coachId, coachName: coachInfo?.name || 'Bilinmeyen Koç' });
    }

    // 3. Paralel olarak paket detaylarını çek (Performans için kritik)
    const detailedEvents = await Promise.all(filteredEvents.map(async ({ docSnap, coachId, coachName }) => {
        const evt = docSnap.data();
        let eventValue = 0;
        let packageName = "Paket Bulunamadı";
        
        // Paket Fiyat Hesaplama
        if (evt.participants && evt.participants.length > 0) {
            const firstParticipant = evt.participants[0];
            const memberId = firstParticipant.memberId;

            if (memberId && !firstParticipant.isGuest) {
                try {
                    const pkgRef = collection(db, 'coaches', coachId, 'members', memberId, 'packages');
                    const pkgQuery = query(
                        pkgRef, 
                        where('approvalStatus', '==', 'Approved'), 
                        orderBy('createdAt', 'desc'), 
                        limit(1)
                    );
                    const pkgSnap = await getDocs(pkgQuery);
                    
                    if (!pkgSnap.empty) {
                        const pkgData = pkgSnap.docs[0].data();
                        const price = Number(pkgData.price) || 0;
                        const sessionCount = Number(pkgData.sessionCount) || 1;
                        
                        // Division by Zero koruması
                        if (sessionCount > 0) {
                            eventValue = price / sessionCount;
                        } else {
                            eventValue = 0; 
                        }
                        
                        packageName = pkgData.packageName || `${pkgData.packageNumber || '?'}. Paket`;
                    } else {
                        packageName = "Aktif Paket Yok";
                    }
                } catch (err) { 
                    console.error("Paket detay hatası:", err); 
                    packageName = "Veri Hatası";
                }
            } else {
                packageName = "Misafir / Demo";
            }
        } else {
            packageName = "Katılımcı Yok";
        }

        return {
            id: docSnap.id,
            title: evt.title,
            time: evt.startTime,
            coachId,
            coachName,
            type: evt.type,
            value: Math.round(eventValue),
            packageName,
            participants: evt.participants || []
        };
    }));

    // İstatistikleri topla
    detailedEvents.forEach(evt => {
        totalRealizedRevenue += evt.value;
        if (evt.type === 'personal') totalPT++; else totalGroup++;
    });

    // Saate göre sırala
    detailedEvents.sort((a, b) => a.time.localeCompare(b.time));

    return { totalRealizedRevenue, totalPT, totalGroup, detailedEvents };
};


// ================================================================
// DASHBOARD 2: SATIŞ CİROSU (DÖNEMLİK - KASA GİRİŞİ)
// ================================================================

export interface DetailedStats {
  financials: {
    totalTurnover: number;
    companyNet: number;
    coachNet: number;
    avgPackagePrice: number;
  };
  operations: {
    totalPTSessions: number;
    totalGroupClasses: number;
    activeMembersCount: number;
  };
  coachPerformance: {
    coachId: string;
    username: string;
    ptCount: number;
    groupCount: number;
    generatedTurnover: number; 
    totalStudents: number;
  }[];
}

export const getDetailedDashboardStats = async (startDate: Date, endDate: Date, selectedBranch: string = 'Tümü'): Promise<DetailedStats> => {
  const startTs = Timestamp.fromDate(startDate);
  
  // Bitiş tarihini günün sonuna ayarla
  const endOfDay = new Date(endDate);
  endOfDay.setHours(23, 59, 59, 999);
  const endTs = Timestamp.fromDate(endOfDay);
  
  const startStr = startDate.toLocaleDateString('en-CA');
  const endStr = endOfDay.toLocaleDateString('en-CA');

  try {
    // 1. Koçları Çek
    const allCoaches = await getAllCoaches();
    // Şube Filtresi Uygula
    const coaches = selectedBranch === 'Tümü' 
        ? allCoaches 
        : allCoaches.filter(c => c.branch === selectedBranch);
    
    const validCoachIds = new Set(coaches.map(c => c.id));
    const coachStatsMap = new Map<string, any>();

    coaches.forEach(c => {
      coachStatsMap.set(c.id, { 
        username: c.username, 
        ptCount: 0, groupCount: 0, generatedTurnover: 0, totalStudents: 0
      });
    });

    // 2. SATIŞ VERİLERİ (Packages)
    const packagesQuery = query(
      collectionGroup(db, 'packages'),
      where('approvalStatus', '==', 'Approved'),
      where('createdAt', '>=', startTs),
      where('createdAt', '<=', endTs)
    );
    const packagesSnap = await getDocsWithCount(packagesQuery);

    let totalTurnover = 0;
    let totalCompanyNet = 0;
    let totalCoachNet = 0;
    let packageCount = 0;
    const uniqueMemberIds = new Set<string>(); // Aktif üye sayımı için

    packagesSnap.docs.forEach(doc => {
      const data = doc.data();
      const pathSegments = doc.ref.path.split('/');
      const coachId = pathSegments[1]; 
      const memberId = pathSegments[3];

      // Eğer koç şube filtresine takıldıysa bu paketi hesaba katma
      if (!validCoachIds.has(coachId)) return;

      const price = Number(data.price) || 0;
      const share = data.share as CoachShare || null;
      const sessions = Number(data.sessionCount) || 0;
      
      const { companyCut, coachCut } = calculateFinancials(price, share, sessions);

      totalTurnover += price;
      totalCompanyNet += companyCut;
      totalCoachNet += coachCut;
      packageCount++;
      
      // Tekil üye sayımı
      if (memberId) uniqueMemberIds.add(memberId);

      if (coachStatsMap.has(coachId)) {
        const stats = coachStatsMap.get(coachId);
        stats.generatedTurnover += price;
      }
    });

    // 3. OPERASYONEL VERİLER (Events)
    const eventsQuery = query(
      collectionGroup(db, 'events'),
      where('date', '>=', startStr),
      where('date', '<=', endStr)
    );
    const eventsSnap = await getDocsWithCount(eventsQuery);

    let totalPTSessions = 0;
    let totalGroupClasses = 0;

    eventsSnap.docs.forEach(doc => {
      const data = doc.data();
      const pathSegments = doc.ref.path.split('/');
      const coachId = pathSegments[1];

      // Şube filtresi kontrolü
      if (!validCoachIds.has(coachId)) return;

      if (coachStatsMap.has(coachId)) {
        const stats = coachStatsMap.get(coachId);
        if (data.type === 'personal') {
          stats.ptCount += 1;
          totalPTSessions += 1;
        } else {
          stats.groupCount += 1;
          totalGroupClasses += 1;
        }
      }
    });

    const avgPackagePrice = packageCount > 0 ? (totalTurnover / packageCount) : 0;

    return {
      financials: { 
          totalTurnover, 
          companyNet: totalCompanyNet, 
          coachNet: totalCoachNet,
          avgPackagePrice
      },
      operations: { 
          totalPTSessions, 
          totalGroupClasses, 
          activeMembersCount: uniqueMemberIds.size
      },
      coachPerformance: Array.from(coachStatsMap.entries()).map(([id, val]) => ({ coachId: id, ...val }))
    };

  } catch (error) {
    console.error("Detaylı istatistik hatası:", error);
    throw error;
  }
};


// ================================================================
// DİĞER FONKSİYONLAR (ONAYLAR, PROGRAM, EVENT)
// ================================================================

export interface PendingApproval {
  id: string; coachId: string; memberId: string; coachName: string; memberName: string; packageData: DocumentData; 
}

export const getPendingApprovals = async (): Promise<PendingApproval[]> => {
  const q = query(collectionGroup(db, 'packages'), where('approvalStatus', '==', 'Pending'));
  const snapshot = await getDocsWithCount(q);
  if (snapshot.empty) return [];
  
  const approvals: PendingApproval[] = await Promise.all(
    snapshot.docs.map(async (packageDoc): Promise<PendingApproval> => {
      const packageData = packageDoc.data();
      const pathParts = packageDoc.ref.path.split('/');
      const coachId = packageData.coachId || pathParts[1]; 
      const memberId = pathParts[3];
      const memberRef = doc(db, 'coaches', coachId, 'members', memberId);
      const coachRef = doc(db, 'coaches', coachId);
      const [memberSnap, coachSnap] = await Promise.all([getDocWithCount(memberRef), getDocWithCount(coachRef)]);
      return {
        id: packageDoc.id,
        coachId, memberId,
        packageData,
        memberName: memberSnap.data()?.name || 'Bilinmeyen Üye',
        coachName: coachSnap.data()?.username || 'Bilinmeyen Koç',
      };
    })
  );
  return approvals;
};

export const approvePackageAndUpdateRefs = async (approval: PendingApproval) => {
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
  batch.update(packageRef, { approvalStatus: 'Approved', lastUpdated: serverTimestamp(), coachId });
  batch.update(memberRef, { currentSessionCount: sessionCount, packageStartDate: startDate, packageEndDate: endDate });
  batch.update(coachRef, { companyCut: increment(companyCut) });
  incrementUsage('writes', 3);
  return batch.commit();
};

export const getMemberPackageHistory = async (coachId: string, memberId: string) => {
  const packagesColRef = collection(db, 'coaches', coachId, 'members', memberId, 'packages');
  const q = query(packagesColRef, orderBy('createdAt', 'desc'));
  return getDocsWithCount(q);
};

export const getCoachScheduleForDay = async (coachId: string, day: string) => {
  const scheduleColRef = collection(db, 'coaches', coachId, 'schedule');
  const q = query(scheduleColRef, where('day', '==', day));
  return getDocsWithCount(q);
}; 

export const setAppointment = async (coachId: string, scheduleId: string, data: DocumentData) => {
  const appointmentRef = doc(db, 'coaches', coachId, 'schedule', scheduleId);
  return setDocWithCount(appointmentRef, data);
};

export const deleteAppointment = async (coachId: string, scheduleId: string) => {
  const appointmentRef = doc(db, 'coaches', coachId, 'schedule', scheduleId);
  return deleteDocWithCount(appointmentRef);
};

// --- EVENTS ---
export interface EventParticipant {
  memberId: string; name: string; phone?: string; isGuest: boolean;
}
export interface CoachEvent {
  id: string; type: 'personal' | 'group'; title: string; date: string; startTime: string; endTime: string; quota: number; participants: EventParticipant[];
}

export const getCoachEventsForDay = async (coachId: string, dateStr: string) => {
  const eventsRef = collection(db, 'coaches', coachId, 'events');
  const q = query(eventsRef, where('date', '==', dateStr));
  return getDocsWithCount(q);
};

export const createCoachEvent = async (coachId: string, eventData: Omit<CoachEvent, 'id'>) => {
  const eventsRef = collection(db, 'coaches', coachId, 'events');
  incrementUsage('writes');
  return addDoc(eventsRef, eventData);
};

export const updateCoachEvent = async (coachId: string, eventId: string, data: Partial<CoachEvent>) => {
  const eventRef = doc(db, 'coaches', coachId, 'events', eventId);
  return updateDocWithCount(eventRef, data);
};

export const deleteCoachEvent = async (coachId: string, eventId: string) => {
  const eventRef = doc(db, 'coaches', coachId, 'events', eventId);
  return deleteDocWithCount(eventRef);
};

// --- SCHEDULE SUMMARY (Weekly) ---
export interface ScheduleAppointmentDetail {
  time: string; memberName: string; type: 'personal' | 'group';
}
export interface DailyScheduleSummary {
  dayName: string; dayNumber: number; isToday: boolean; appointments: ScheduleAppointmentDetail[]; 
}

const getWeekDays = (baseDate: Date) => {
  const days: Date[] = [];
  const current = new Date(baseDate);
  const dayOfWeek = current.getDay(); 
  
  // Pazartesi'yi bul
  const distanceToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(current);
  monday.setDate(current.getDate() + distanceToMonday);

  for (let i = 0; i < 7; i++) {
    const day = new Date(monday);
    day.setDate(monday.getDate() + i);
    days.push(day);
  }
  return days;
};

export const getCoachScheduleForWeek = async (coachId: string, baseDate: Date): Promise<DailyScheduleSummary[]> => {
  try {
    const weekDates = getWeekDays(baseDate); 
    const todayStr = new Date().toLocaleDateString('en-CA');
    const weekDayStrings = weekDates.map(d => d.toLocaleDateString('en-CA'));

    const eventsRef = collection(db, 'coaches', coachId, 'events');
    const q = query(eventsRef, where('date', 'in', weekDayStrings));
    const snapshot = await getDocsWithCount(q);
    
    const appointmentsByDay = new Map<string, ScheduleAppointmentDetail[]>();
    
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      const day = data.date;
      const time = data.startTime;
      const participants = data.participants as EventParticipant[] || [];
      let displayName = data.title;
      
      if (data.type === 'group') {
          displayName = `${data.title} (${participants.length}/${data.quota || '?'})`;
      } else {
          // PT ise ilk üyenin ismini göster
          if (participants.length > 0) displayName = participants[0].name;
      }

      if (day && time) {
        const dayAppointments = appointmentsByDay.get(day) || [];
        dayAppointments.push({ time, memberName: displayName, type: data.type as 'personal' | 'group' });
        appointmentsByDay.set(day, dayAppointments);
      }
    });

    const summary: DailyScheduleSummary[] = weekDates.map(dateObj => {
      const dayStr = dateObj.toLocaleDateString('en-CA');
      const appointments = appointmentsByDay.get(dayStr) || [];
      // Saate göre sırala
      appointments.sort((a, b) => a.time.localeCompare(b.time)); 
      
      return {
        dayName: dateObj.toLocaleDateString('tr-TR', { weekday: 'short' }),
        dayNumber: dateObj.getDate(),
        appointments: appointments, 
        isToday: dayStr === todayStr,
      };
    });
    return summary;
  } catch (error) {
    console.error("Haftalık program özeti çekilemedi:", error);
    throw error;
  }
};