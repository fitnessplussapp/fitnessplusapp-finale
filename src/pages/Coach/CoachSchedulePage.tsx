// src/pages/Coach/CoachSchedulePage.tsx

import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { 
  ArrowLeft, Loader2, ChevronLeft, ChevronRight, Calendar, 
  Users, Clock, Trash2, X, Plus, AlertTriangle, CheckCircle, Ban, ChevronDown
} from 'lucide-react';

import styles from './CoachSchedulePage.module.css';
import Modal from '../../components/Modal/Modal';
import { useAuth } from '../../context/AuthContext';

// Firebase Servisleri
import { 
  getCoachMembers, 
  getCoachEventsForDay,
  createCoachEvent,
  updateCoachEvent,
  deleteCoachEvent,
  updateDocWithCount
} from '../../firebase/firestoreService';
import type { CoachEvent, EventParticipant } from '../../firebase/firestoreService';

import { db } from '../../firebase/firebaseConfig';
import { doc, increment } from 'firebase/firestore';

// --- TİPLER ---
interface CoachMember {
  id: string;
  name: string;
  currentSessionCount: number;
  packageEndDate: Date | null;
}

interface RemovalState {
  isOpen: boolean;
  target: 'participant' | 'event' | null;
  participantId?: string;
  isGuest?: boolean;
}

// --- YARDIMCI FONKSİYONLAR ---
const getLocalDateString = (date: Date): string => {
  return date.toLocaleDateString('en-CA'); // YYYY-MM-DD
};

const getWeekDays = (baseDate: Date) => {
  const current = new Date(baseDate);
  const day = current.getDay();
  const diff = current.getDate() - day + (day === 0 ? -6 : 1); // Pazartesiye git
  
  const monday = new Date(current.setDate(diff));
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    days.push(d);
  }
  return days;
};

// 07:00 - 22:00 arası slotlar
const WORK_HOURS = Array.from({ length: 16 }, (_, i) => {
  const h = i + 7; 
  return `${h.toString().padStart(2, '0')}:00`;
});

const CoachSchedulePage: React.FC = () => {
  const { currentUser } = useAuth();
  const coachId = currentUser?.username;

  // --- STATE ---
  const [currentDate, setCurrentDate] = useState(new Date());
  const [weekDays, setWeekDays] = useState<Date[]>([]);
  const [events, setEvents] = useState<CoachEvent[]>([]);
  const [members, setMembers] = useState<CoachMember[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [processLoading, setProcessLoading] = useState(false);
  
  // Modallar
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isParticipantModalOpen, setIsParticipantModalOpen] = useState(false);
  
  // Silme/İade State
  const [removalState, setRemovalState] = useState<RemovalState>({ isOpen: false, target: null });
  
  // Seçili Veriler
  const [selectedEvent, setSelectedEvent] = useState<CoachEvent | null>(null);
  
  // Form State
  const [eventType, setEventType] = useState<'personal' | 'group'>('personal');
  const [eventTitle, setEventTitle] = useState('');
  const [eventStart, setEventStart] = useState('09:00'); 
  const [eventEnd, setEventEnd] = useState('10:00');
  const [eventQuota, setEventQuota] = useState(10);
  const [selectedMemberId, setSelectedMemberId] = useState('');
  
  // Katılımcı Ekleme Formu
  const [participantType, setParticipantType] = useState<'existing' | 'guest'>('existing');
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [addMemberId, setAddMemberId] = useState('');

  // --- HAFTA HESAPLAMA ---
  useEffect(() => {
    setWeekDays(getWeekDays(currentDate));
  }, [currentDate]);

  // --- VERİ ÇEKME ---
  const fetchAllData = useCallback(async () => {
    if (!coachId) return;
    setLoading(true);
    try {
      const dateStr = getLocalDateString(currentDate);
      
      // 1. Üyeleri Çek
      const membersData = await getCoachMembers(coachId);
      setMembers(membersData.map(m => ({
        id: m.id,
        name: m.name,
        currentSessionCount: m.currentSessionCount || 0,
        packageEndDate: m.packageEndDate?.toDate() || null
      })));

      // 2. Etkinlikleri Çek
      const eventsSnap = await getCoachEventsForDay(coachId, dateStr);
      const loadedEvents = eventsSnap.docs.map(d => ({ id: d.id, ...d.data() } as CoachEvent));
      setEvents(loadedEvents);

    } catch (error) {
      console.error("Veri hatası:", error);
    } finally {
      setLoading(false);
    }
  }, [coachId, currentDate]);

  useEffect(() => { fetchAllData(); }, [fetchAllData]);

  // --- NAVİGASYON ---
  const handlePrevWeek = () => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() - 7);
    setCurrentDate(d);
  };
  const handleNextWeek = () => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() + 7);
    setCurrentDate(d);
  };
  const handleToday = () => setCurrentDate(new Date());
  const handleDaySelect = (date: Date) => setCurrentDate(date);

  // --- SLOT TIKLAMA (Yeni Etkinlik) ---
  const handleSlotClick = (time: string) => {
    setEventStart(time);
    const [h, m] = time.split(':').map(Number);
    const endH = h + 1;
    setEventEnd(`${endH.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
    
    // Form Reset
    setEventTitle('');
    setSelectedMemberId('');
    setEventType('personal');
    setEventQuota(10);
    setIsEventModalOpen(true);
  };

  // --- ETKİNLİK DETAY ---
  const handleEventClick = (evt: CoachEvent, e: React.MouseEvent) => {
    e.stopPropagation(); 
    setSelectedEvent(evt);
    setIsDetailModalOpen(true);
  };

  // --- YENİ ETKİNLİK OLUŞTURMA ---
  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!coachId) return;
    setProcessLoading(true);

    try {
      const participants: EventParticipant[] = [];
      let title = eventTitle;

      if (eventType === 'personal') {
        if (!selectedMemberId) {
          setProcessLoading(false);
          return alert("Lütfen üye seçin.");
        }
        const member = members.find(m => m.id === selectedMemberId);
        if (member) {
          title = member.name;
          participants.push({ memberId: member.id, name: member.name, isGuest: false });
          
          // Bakiyeden düş
          await updateDocWithCount(doc(db, 'coaches', coachId, 'members', member.id), {
            currentSessionCount: increment(-1)
          });
        }
      }

      const newEvent = {
        type: eventType,
        title: title || 'Yeni Etkinlik',
        date: getLocalDateString(currentDate),
        startTime: eventStart,
        endTime: eventEnd,
        quota: eventType === 'personal' ? 1 : eventQuota,
        participants: participants
      };

      await createCoachEvent(coachId, newEvent);
      setIsEventModalOpen(false);
      fetchAllData();
    } catch (err) {
      console.error(err);
      alert("Etkinlik oluşturulurken hata oluştu.");
    } finally {
      setProcessLoading(false);
    }
  };

  // --- KATILIMCI EKLEME ---
  const handleAddParticipant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEvent || !coachId) return;
    if (selectedEvent.participants.length >= selectedEvent.quota) return alert("Kontenjan dolu!");
    
    setProcessLoading(true);
    try {
      let newParticipant: EventParticipant;
      if (participantType === 'existing') {
        const member = members.find(m => m.id === addMemberId);
        if (!member) throw new Error("Üye seçilmedi.");
        if (selectedEvent.participants.some(p => p.memberId === member.id)) throw new Error("Bu üye zaten ekli.");
        
        await updateDocWithCount(doc(db, 'coaches', coachId, 'members', member.id), { currentSessionCount: increment(-1) });
        newParticipant = { memberId: member.id, name: member.name, isGuest: false };
      } else {
        newParticipant = { memberId: `guest_${Date.now()}`, name: guestName, phone: guestPhone, isGuest: true };
      }

      const updatedParticipants = [...selectedEvent.participants, newParticipant];
      await updateCoachEvent(coachId, selectedEvent.id, { participants: updatedParticipants });
      setSelectedEvent({ ...selectedEvent, participants: updatedParticipants });
      setIsParticipantModalOpen(false);
      fetchAllData();
    } catch (err: any) { 
        alert(err.message); 
    } finally { 
        setProcessLoading(false); 
    }
  };

  // --- SİLME / İADE YÖNETİMİ ---
  const initiateRemoveParticipant = (participantId: string, isGuest: boolean) => {
    setRemovalState({ isOpen: true, target: 'participant', participantId, isGuest });
  };
  const initiateDeleteEvent = () => {
    setRemovalState({ isOpen: true, target: 'event' });
  };
  
  const handleConfirmRemoval = async (shouldRefund: boolean) => {
    if (!coachId || !selectedEvent) return;
    setProcessLoading(true);
    try {
      if (removalState.target === 'participant' && removalState.participantId) {
        if (!removalState.isGuest && shouldRefund) {
          await updateDocWithCount(doc(db, 'coaches', coachId, 'members', removalState.participantId), { currentSessionCount: increment(1) });
        }
        const updatedList = selectedEvent.participants.filter(p => p.memberId !== removalState.participantId);
        await updateCoachEvent(coachId, selectedEvent.id, { participants: updatedList });
        setSelectedEvent({ ...selectedEvent, participants: updatedList });
      } 
      else if (removalState.target === 'event') {
        if (shouldRefund) {
          await Promise.all(selectedEvent.participants.map(async (p) => {
            if (!p.isGuest) await updateDocWithCount(doc(db, 'coaches', coachId, 'members', p.memberId), { currentSessionCount: increment(1) });
          }));
        }
        await deleteCoachEvent(coachId, selectedEvent.id);
        setIsDetailModalOpen(false);
        setSelectedEvent(null);
      }
      setRemovalState({ isOpen: false, target: null });
      fetchAllData();
    } catch (error) { 
        console.error(error); 
        alert("Hata oluştu."); 
    } finally { 
        setProcessLoading(false); 
    }
  };

  return (
    <div className={styles.schedulePage}>
      
      {/* HEADER */}
      <div className={styles.headerContainer}>
        <div className={styles.headerTop}>
          <div className={styles.titleGroup}>
            <h1 className={styles.pageTitle}>Ders Programım</h1>
          </div>
          <button className={styles.todayButton} onClick={handleToday}>
             <Clock size={14} /> Bugün
          </button>
        </div>

        <div className={styles.monthNav}>
            <button className={styles.navArrow} onClick={handlePrevWeek}><ChevronLeft size={20}/></button>
            <div className={styles.monthDisplay}>
                <Calendar size={18} />
                <span>
                   {currentDate.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })}
                </span>
            </div>
            <button className={styles.navArrow} onClick={handleNextWeek}><ChevronRight size={20}/></button>
        </div>
      </div>

      {/* HAFTA GÜNLERİ (GRID - ADMIN ILE AYNI) */}
      <div className={styles.weekTabsContainer}>
          {weekDays.map((day, index) => {
              const isSelected = getLocalDateString(day) === getLocalDateString(currentDate);
              const isToday = getLocalDateString(day) === getLocalDateString(new Date());
              return (
                  <button 
                      key={index} 
                      className={`${styles.dayTab} ${isSelected ? styles.dayTabActive : ''} ${isToday ? styles.dayTabToday : ''}`}
                      onClick={() => handleDaySelect(day)}
                  >
                      <span className={styles.tabDayName}>{day.toLocaleDateString('tr-TR', { weekday: 'short' }).toUpperCase()}</span>
                      <span className={styles.tabDayNumber}>{day.getDate()}</span>
                  </button>
              );
          })}
      </div>

      {/* GRID (Ders Programı) */}
      <div className={styles.gridContainer}>
        {loading ? (
           <div className={styles.loadingState}><Loader2 className={styles.spinner} size={32}/></div>
        ) : (
           WORK_HOURS.map(hour => {
             const eventsInSlot = events.filter(e => e.startTime.startsWith(hour.split(':')[0])); 
             
             return (
               <div key={hour} className={styles.timeSlot}>
                 <div className={styles.slotHeader}>
                    <span className={styles.slotTimeLabel}>{hour}</span>
                    <button 
                      className={styles.addIconBtn} 
                      onClick={() => handleSlotClick(hour)}
                      title="Ekle"
                    >
                      <Plus size={16} />
                    </button>
                 </div>

                 <div className={styles.slotEventsList}>
                    {eventsInSlot.length > 0 ? (
                      eventsInSlot.map(evt => (
                        <div 
                          key={evt.id} 
                          className={styles.miniEventCard} 
                          onClick={(e) => handleEventClick(evt, e)}
                        >
                            <div className={styles.miniCardHeader}>
                                <span className={styles.miniTitle}>{evt.title}</span>
                                <span className={`${styles.miniBadge} ${evt.type === 'personal' ? styles.badgePersonal : styles.badgeGroup}`}>
                                  {evt.type === 'personal' ? 'PT' : 'GRP'}
                                </span>
                            </div>
                            <div className={styles.miniMeta}>
                                <Users size={12} /> 
                                {evt.participants.length}/{evt.quota}
                            </div>
                        </div>
                      ))
                    ) : (
                      <div className={styles.emptyStatePlaceholder} onClick={() => handleSlotClick(hour)}>
                         <span style={{fontSize:'0.8rem'}}>Boş</span>
                      </div>
                    )}
                 </div>
               </div>
             );
           })
        )}
      </div>

      {/* --- MODALLAR --- */}
      
      <Modal isOpen={isEventModalOpen} onClose={() => setIsEventModalOpen(false)} title="Ders Planla">
        <form onSubmit={handleCreateEvent} className={styles.modalForm}>
          <div className={styles.segmentControl}>
            <button type="button" className={`${styles.segmentBtn} ${eventType === 'personal' ? styles.segmentBtnActive : ''}`} onClick={() => setEventType('personal')}>Bireysel</button>
            <button type="button" className={`${styles.segmentBtn} ${eventType === 'group' ? styles.segmentBtnActive : ''}`} onClick={() => setEventType('group')}>Grup</button>
          </div>

          <div className={styles.formGrid}>
            <div className={styles.inputGroup}>
              <label className={styles.inputLabel}>Başlangıç</label>
              <input type="time" className={styles.customInput} value={eventStart} onChange={e => setEventStart(e.target.value)} required />
            </div>
            <div className={styles.inputGroup}>
              <label className={styles.inputLabel}>Bitiş</label>
              <input type="time" className={styles.customInput} value={eventEnd} onChange={e => setEventEnd(e.target.value)} required />
            </div>
          </div>

          {eventType === 'personal' ? (
            <div className={styles.inputGroup}>
              <label className={styles.inputLabel}>Üye Seçin</label>
              <div className={styles.selectWrapper}>
                <select className={styles.customSelect} value={selectedMemberId} onChange={e => setSelectedMemberId(e.target.value)} required>
                  <option value="">-- Listeden Seçin --</option>
                  {members.map(m => (
                    <option key={m.id} value={m.id} disabled={m.currentSessionCount <= 0}>
                      {m.name} (Hak: {m.currentSessionCount})
                    </option>
                  ))}
                </select>
                <ChevronDown size={16} className={styles.selectIcon} />
              </div>
            </div>
          ) : (
            <>
              <div className={styles.inputGroup}>
                <label className={styles.inputLabel}>Ders Adı</label>
                <input type="text" className={styles.customInput} placeholder="Örn: Pilates" value={eventTitle} onChange={e => setEventTitle(e.target.value)} required />
              </div>
              <div className={styles.inputGroup}>
                <label className={styles.inputLabel}>Kişi Kotası</label>
                <input type="number" className={styles.customInput} value={eventQuota} onChange={e => setEventQuota(Number(e.target.value))} min="1" required />
              </div>
            </>
          )}

          <div className={styles.formActions}>
            <button type="button" className={`${styles.actionBtn} ${styles.btnSecondary}`} onClick={() => setIsEventModalOpen(false)}>Vazgeç</button>
            <button type="submit" className={`${styles.actionBtn} ${styles.btnPrimary}`} disabled={processLoading}>
               {processLoading ? <Loader2 className={styles.spinner} size={20}/> : 'Oluştur'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={isDetailModalOpen} onClose={() => setIsDetailModalOpen(false)} title="Ders Detayı">
        {selectedEvent && (
          <div className={styles.detailContainer}>
            <div className={styles.eventInfoBox}>
              <h3 className={styles.infoTitle}>{selectedEvent.title}</h3>
              <div className={styles.infoMeta}>
                <span><Clock size={14} style={{verticalAlign:'middle'}}/> {selectedEvent.startTime} - {selectedEvent.endTime}</span>
                <span>{selectedEvent.participants.length} / {selectedEvent.quota} Kişi</span>
              </div>
            </div>

            <div className={styles.participantsHeader}>
                <h4>Katılımcılar</h4>
                <button className={styles.miniAddBtn} onClick={() => setIsParticipantModalOpen(true)} disabled={selectedEvent.participants.length >= selectedEvent.quota}>
                    <Plus size={14}/> Ekle
                </button>
            </div>

            <div className={styles.participantList}>
              {selectedEvent.participants.length === 0 && <p className={styles.noData}>Liste boş.</p>}
              {selectedEvent.participants.map((p, idx) => (
                <div key={idx} className={styles.participantRow}>
                  <div className={styles.pInfo}>
                    <span className={styles.pName}>{p.name}</span>
                    <span className={styles.pType}>{p.isGuest ? 'Misafir' : 'Üye'}</span>
                  </div>
                  <button className={styles.removeBtn} onClick={() => initiateRemoveParticipant(p.memberId, p.isGuest)}><X size={16}/></button>
                </div>
              ))}
            </div>
            <button className={styles.deleteEventBtn} onClick={initiateDeleteEvent}><Trash2 size={16}/> Dersi İptal Et</button>
          </div>
        )}
      </Modal>

      <Modal isOpen={isParticipantModalOpen} onClose={() => setIsParticipantModalOpen(false)} title="Derse Kişi Ekle">
        <form onSubmit={handleAddParticipant} className={styles.modalForm}>
           <div className={styles.segmentControl}>
              <button type="button" className={`${styles.segmentBtn} ${participantType === 'existing' ? styles.segmentBtnActive : ''}`} onClick={() => setParticipantType('existing')}>Üye</button>
              <button type="button" className={`${styles.segmentBtn} ${participantType === 'guest' ? styles.segmentBtnActive : ''}`} onClick={() => setParticipantType('guest')}>Misafir</button>
           </div>

           {participantType === 'existing' ? (
             <div className={styles.inputGroup}>
                <label className={styles.inputLabel}>Üye Seçimi</label>
                <div className={styles.selectWrapper}>
                  <select className={styles.customSelect} value={addMemberId} onChange={e => setAddMemberId(e.target.value)} required>
                      <option value="">Seçiniz</option>
                      {members.map(m => (
                          <option key={m.id} value={m.id} disabled={m.currentSessionCount <= 0 || selectedEvent?.participants.some(p => p.memberId === m.id)}>
                              {m.name} ({m.currentSessionCount})
                          </option>
                      ))}
                  </select>
                  <ChevronDown size={16} className={styles.selectIcon} />
                </div>
             </div>
           ) : (
             <div className={styles.inputGroup}>
                <label className={styles.inputLabel}>Misafir Adı</label>
                <input className={styles.customInput} value={guestName} onChange={e => setGuestName(e.target.value)} required />
             </div>
           )}
           <div className={styles.formActions}>
             <button type="submit" className={`${styles.actionBtn} ${styles.btnPrimary}`} disabled={processLoading}>Listeye Ekle</button>
           </div>
        </form>
      </Modal>

      <Modal isOpen={removalState.isOpen} onClose={() => setRemovalState({isOpen:false, target:null})} title="İptal İşlemi">
        <div className={styles.confirmBody}>
          <div className={styles.confirmIconContainer}>
             <AlertTriangle size={36} color="#f59e0b" />
          </div>
          <p className={styles.confirmText}>
             {removalState.target === 'event' ? "Ders tamamen silinecek." : "Kişi listeden çıkarılacak."}
             <br/>
             <strong>Hakkı iade edilsin mi?</strong>
          </p>
          <div className={styles.refundActions}>
            <button className={styles.refundButton} onClick={() => handleConfirmRemoval(true)} disabled={processLoading}>
              <CheckCircle size={18} className={styles.successIcon}/> <div><span className={styles.btnTitle}>Evet, İade Et</span><span className={styles.btnDesc}>Bakiye geri yüklenir.</span></div>
            </button>
            <button className={`${styles.refundButton} ${styles.noRefund}`} onClick={() => handleConfirmRemoval(false)} disabled={processLoading}>
              <Ban size={18} className={styles.dangerIcon}/> <div><span className={styles.btnTitle}>Hayır, Yanmasına İzin Ver</span><span className={styles.btnDesc}>Bakiye değişmez.</span></div>
            </button>
          </div>
        </div>
      </Modal>

    </div>
  );
};

export default CoachSchedulePage;