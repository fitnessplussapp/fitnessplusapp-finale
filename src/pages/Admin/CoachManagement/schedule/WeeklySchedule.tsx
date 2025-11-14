// src/pages/Admin/CoachManagement/schedule/WeeklySchedule.tsx

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import styles from './WeeklySchedule.module.css';
import coachStyles from '../CoachManagement.module.css';
import formStyles from '../../../../components/Form/Form.module.css';
import Modal from '../../../../components/Modal/Modal';
import { 
  Loader2, 
  ArrowLeft, 
  ChevronLeft, 
  ChevronRight, 
  UserPlus, 
  Info,
  UserCheck,
  XCircle,
  ShieldAlert,
  HelpCircle 
} from 'lucide-react';

// === Firebase ve Servis Importları (Değişiklik yok) ===
import { 
  getCoachMembers, 
  getCoachScheduleForDay,
  setAppointment,
  deleteAppointment,
  updateDocWithCount
} from '../../../../firebase/firestoreService';
import type { DocumentData } from 'firebase/firestore';
import { Timestamp, doc, increment } from 'firebase/firestore'; 
import { db } from '../../../../firebase/firebaseConfig'; 
// ------------------------------------------


// --- Tipler ---
// GÜNCELLEME: CoachMember tipi
interface CoachMember {
  id: string;
  name: string;
  currentSessionCount: number; // Kalan seans
  packageEndDate: Date | null; // YENİ: Paket bitiş tarihi
}
interface Appointment {
  id: string;
  memberId: string;
  memberName: string;
  time: string; 
}
interface TimeSlot {
  time: string; 
  appointment: Appointment | null;
}
interface ModalState {
  isOpen: boolean;
  time: string | null; 
  appointment: Appointment | null;
}
interface DeleteModalState {
  isOpen: boolean;
  appointment: Appointment | null;
}
interface RefundModalState {
  isOpen: boolean;
  memberId: string;
  memberName: string;
}
// -----------------

// === Saat dilimleri listesi (07:00 - 21:00 arası) (Değişiklik yok) ===
const generateTimeSlots = (): string[] => {
  const slots: string[] = [];
  for (let hour = 7; hour <= 21; hour++) {
    slots.push(`${hour.toString().padStart(2, '0')}:00`);
  }
  return slots;
};
const TIME_SLOTS = generateTimeSlots();
// -----------------------------------------------------

// === Tarih Yardımcı Fonksiyonları (Değişiklik yok) ===
const getLocalDateString = (date: Date): string => {
  return date.toLocaleDateString('en-CA'); 
};
const getWeekDays = (baseDate: Date) => {
  const days: Date[] = [];
  const todayIndex = baseDate.getDay();
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


const WeeklySchedule: React.FC = () => {
  const { id: coachId } = useParams<{ id: string }>();
  
  // State'ler (Değişiklik yok)
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date>(new Date());
  const [coachMembers, setCoachMembers] = useState<CoachMember[]>([]);
  
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  
  const [modal, setModal] = useState<ModalState>({ isOpen: false, time: null, appointment: null });
  const [deleteConfirmModal, setDeleteConfirmModal] = useState<DeleteModalState>({ isOpen: false, appointment: null });
  const [refundModal, setRefundModal] = useState<RefundModalState>({ isOpen: false, memberId: '', memberName: '' });
  
  const [isDeleting, setIsDeleting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingSchedule, setLoadingSchedule] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const weekDays = useMemo(() => getWeekDays(currentDate), [currentDate]);
  const todayString = getLocalDateString(new Date());

  // === GÜNCELLEME: Koçun tüm üyeleri (seans ve paket tarihiyle) ===
  const fetchAllCoachMembers = useCallback(async () => {
    if (!coachId) return;
    try {
      const membersData = await getCoachMembers(coachId);
      // GÜNCELLEME: Sadece currentSessionCount'u al
      setCoachMembers(membersData.map(m => {
        // YENİ: packageEndDate'i al ve Date'e çevir
        const endDate = m.packageEndDate instanceof Timestamp 
                        ? m.packageEndDate.toDate() 
                        : null;
        return { 
          id: m.id, 
          name: m.name,
          currentSessionCount: m.currentSessionCount || 0,
          packageEndDate: endDate // YENİ
        };
      }));
    } catch (err: any) {
      setError("Koçun üyeleri çekilemedi: " + err.message);
    }
  }, [coachId]);

  // === Veri Çekme: Seçili GÜN'ün programı (Değişiklik yok) ===
  const fetchScheduleForDay = useCallback(async (day: Date) => {
    if (!coachId) return;
    setLoadingSchedule(true);
    setError(null);
    try {
      const dayString = getLocalDateString(day);
      const snapshot = await getCoachScheduleForDay(coachId, dayString);
      const dayAppointments = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Appointment));
      setAppointments(dayAppointments);
    } catch (err: any) {
      setError("Program verisi çekilemedi: " + err.message);
    } finally {
      setLoadingSchedule(false);
    }
  }, [coachId]);

  // İlk Yükleme (Değişiklik yok)
  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchAllCoachMembers(),
      fetchScheduleForDay(selectedDay)
    ]).finally(() => setLoading(false));
  }, [fetchAllCoachMembers, fetchScheduleForDay, selectedDay]);


  // === HAFTALIK PROGRAM LOGIC (GÜNCELLEME) ===
  // 'availableMembers' artık o gün randevusu olmayan TÜM üyeleri getirir.
  // Filtreleme (disabled) işlemi JSX içinde yapılacak.
  const availableMembers = useMemo(() => {
    const scheduledMemberIds = new Set(appointments.map(a => a.memberId));
    if (modal.appointment) {
      scheduledMemberIds.delete(modal.appointment.memberId);
    }
    return coachMembers.filter(m => !scheduledMemberIds.has(m.id));
  }, [coachMembers, appointments, modal.appointment]);

  const timeSlots: TimeSlot[] = useMemo(() => {
    return TIME_SLOTS.map(time => {
      const appointment = appointments.find(a => a.time === time) || null;
      return { time, appointment };
    });
  }, [appointments]);


  // === EYLEMLER (Değişiklik yok) ===
  const handleSelectDay = (day: Date) => {
    setSelectedDay(day);
    fetchScheduleForDay(day);
  };
  const changeWeek = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    newDate.setDate(currentDate.getDate() + (direction === 'prev' ? -7 : 7));
    setCurrentDate(newDate);
  };
  const openModal = (time: string, appointment: Appointment | null) => {
    setModal({ isOpen: true, time, appointment });
  };
  const closeModal = () => {
    setModal({ isOpen: false, time: null, appointment: null });
  };
  const openDeleteConfirmModal = (appointment: Appointment) => {
    closeModal();
    setDeleteConfirmModal({ isOpen: true, appointment });
  };
  const closeDeleteConfirmModal = () => {
    setDeleteConfirmModal({ isOpen: false, appointment: null });
  };

  // === Seans İade Modalı Fonksiyonları (Değişiklik yok) ===
  const handleRefundModalClose = () => {
    setRefundModal({ isOpen: false, memberId: '', memberName: '' });
    fetchScheduleForDay(selectedDay);
    fetchAllCoachMembers();
  };

  const handleConfirmRefund = async (refund: boolean) => {
    setIsDeleting(true); 
    setError(null);
    try {
      if (refund) {
        const memberDocRef = doc(db, 'coaches', coachId!, 'members', refundModal.memberId);
        await updateDocWithCount(memberDocRef, { 
          currentSessionCount: increment(1) 
        });
      }
    } catch (err: any) {
      setError("Seans iade işlemi başarısız oldu: " + err.message);
    } finally {
      setIsDeleting(false);
      handleRefundModalClose();
    }
  };
  // ------------------------------------------

  // === GÜNCELLEME: Randevu Ekleme/Güncelleme (Paket/Seans Kontrollü) ===
  const handleSaveAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!coachId || !modal.time) return;

    const formData = new FormData(e.target as HTMLFormElement);
    const memberSelection = formData.get('memberId') as string;
    
    if (!memberSelection) {
      setError("Lütfen bir üye seçin.");
      return;
    }

    const [memberId, memberName] = memberSelection.split('|');
    const selectedMember = coachMembers.find(m => m.id === memberId);
    
    if (!selectedMember) {
        setError("Seçilen üye verisi bulunamadı.");
        return;
    }

    // YENİ: Kaydetme anında çift kontrol
    const isEditingThisMember = (modal.appointment && modal.appointment.memberId === memberId);

    // Eğer bu üyeyi düzenlemiyorsak (yani yeni atama veya üye değişikliği ise)
    if (!isEditingThisMember) {
        // Seans kontrolü
        if (selectedMember.currentSessionCount <= 0) {
            setError("Bu üyenin (0) seansı kalmamıştır.");
            setLoadingSchedule(false); // Yüklemeyi durdur
            return;
        }

        // YENİ: Paket Süresi Kontrolü
        const today = new Date();
        today.setHours(0, 0, 0, 0); 
        const isPackageActive = selectedMember.packageEndDate ? selectedMember.packageEndDate.getTime() >= today.getTime() : false;
        
        if (!isPackageActive) {
            setError("Bu üyenin aktif paket süresi dolmuştur.");
            setLoadingSchedule(false); // Yüklemeyi durdur
            return;
        }
    }


    const dayString = getLocalDateString(selectedDay);
    const timeString = modal.time.replace(':', '');
    const scheduleId = `${dayString}-${timeString}`;

    const appointmentData = {
      coachId: coachId,
      memberId: memberId,
      memberName: memberName,
      day: dayString,
      time: modal.time,
      timestamp: Timestamp.fromDate(
        new Date(`${dayString}T${modal.time}:00`)
      )
    };
    
    setLoadingSchedule(true);
    const oldAppointment = modal.appointment; 
    closeModal();
    
    try {
      const memberDocRef = doc(db, 'coaches', coachId, 'members', memberId);

      if (oldAppointment) {
        // --- GÜNCELLEME SENARYOSU ---
        if (oldAppointment.memberId !== memberId) {
          // ÜYE DEĞİŞTİ
          await updateDocWithCount(memberDocRef, { currentSessionCount: increment(-1) });
          await setAppointment(coachId, scheduleId, appointmentData);
          setRefundModal({ 
            isOpen: true, 
            memberId: oldAppointment.memberId, 
            memberName: oldAppointment.memberName 
          });
        } else {
          // ÜYE AYNI KALDI
          await setAppointment(coachId, scheduleId, appointmentData);
          await fetchScheduleForDay(selectedDay); 
        }
      } else {
        // --- YENİ KAYIT SENARYOSU ---
        await updateDocWithCount(memberDocRef, { currentSessionCount: increment(-1) });
        await setAppointment(coachId, scheduleId, appointmentData);
        await fetchScheduleForDay(selectedDay);
        await fetchAllCoachMembers();
      }
    } catch (err: any) {
      setError("Randevu kaydedilemedi: " + err.message);
      setLoadingSchedule(false);
    }
  };

  // === Randevu Silme (Değişiklik yok) ===
  const handleDeleteAppointment = async () => {
    if (!coachId || !deleteConfirmModal.appointment) return;
    
    setIsDeleting(true);
    setLoadingSchedule(true);
    const deletedApp = deleteConfirmModal.appointment; 
    
    try {
      await deleteAppointment(coachId, deletedApp.id);
      closeDeleteConfirmModal(); 
      setRefundModal({ 
        isOpen: true, 
        memberId: deletedApp.memberId, 
        memberName: deletedApp.memberName 
      });
    } catch (err: any) {
      setError("Randevu silinemedi: " + err.message);
    } finally {
      setIsDeleting(false);
      setLoadingSchedule(false); 
    }
  };

  
  if (loading) {
    return (
      <div className={styles.schedulePage} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <Loader2 size={32} className={formStyles.spinner} />
      </div>
    );
  }

  return (
    <>
      <div className={styles.schedulePage}>
        
        {/* Header (Değişiklik yok) */}
        <header className={coachStyles.header}>
          <div>
            <h1 className={coachStyles.pageTitle}>Haftalık Program</h1>
            <p className={coachStyles.pageSubtitle}>
              Koç: {coachId}
            </p>
          </div>
          <Link to={`/admin/coaches`} className={coachStyles.backButton}>
            <ArrowLeft size={18} />
            <span className={coachStyles.buttonText}>Koç Listesine Geri Dön</span>
          </Link>
        </header>

        {/* Hafta Navigasyonu (Değişiklik yok) */}
        <div className={styles.weekNavigator}>
          <button onClick={() => changeWeek('prev')} className={styles.navButton}>
            <ChevronLeft size={24} />
          </button>
          <div className={styles.weekDaysContainer}>
            {weekDays.map(day => {
              const dayStr = getLocalDateString(day);
              const isSelected = dayStr === getLocalDateString(selectedDay);
              const isToday = dayStr === todayString;
              
              return (
                <button 
                  key={day.toISOString()}
                  className={`
                    ${styles.dayButton} 
                    ${isSelected ? styles.selectedDay : ''}
                    ${isToday ? styles.today : ''}
                  `}
                  onClick={() => handleSelectDay(day)}
                >
                  <span className={styles.dayName}>
                    {day.toLocaleDateString('tr-TR', { weekday: 'short' })}
                  </span>
                  <span className={styles.dayNumber}>
                    {day.getDate()}
                  </span>
                </button>
              );
            })}
          </div>
          <button onClick={() => changeWeek('next')} className={styles.navButton}>
            <ChevronRight size={24} />
          </button>
        </div>
        
        {/* Hata Mesajı (Değişiklik yok) */}
        {error && (
          <div className={formStyles.error} style={{ margin: '1rem' }}>
            {error}
          </div>
        )}

        {/* Saat Dilimleri Listesi (Değişiklik yok) */}
        <div className={styles.timeSlotList}>
          {loadingSchedule && (
            <div className={styles.listOverlay}>
              <Loader2 size={32} className={formStyles.spinner} />
            </div>
          )}
          
          {timeSlots.length === 0 && (
            <p>Saat dilimleri yüklenemedi.</p>
          )}

          {timeSlots.map(slot => (
            slot.appointment ? (
              // --- Dolu Slot ---
              <button 
                key={slot.time} 
                className={`${styles.timeSlot} ${styles.filledSlot}`}
                onClick={() => openModal(slot.time, slot.appointment)}
              >
                <div className={styles.slotTime}>
                  <UserCheck size={16} />
                  {slot.time}
                </div>
                <span className={styles.slotMemberName}>
                  {slot.appointment.memberName}
                </span>
              </button>
            ) : (
              // --- Boş Slot ---
              <button 
                key={slot.time} 
                className={styles.timeSlot}
                onClick={() => openModal(slot.time, null)}
              >
                <div className={styles.slotTime}>
                  {slot.time}
                </div>
                <span className={styles.slotAction}>
                  <UserPlus size={16} />
                  Üye Ata
                </span>
              </button>
            )
          ))}
        </div>
      </div>

      {/* --- 1. Randevu Atama/Düzenleme Modalı --- */}
      <Modal
        isOpen={modal.isOpen}
        onClose={closeModal}
        title={modal.appointment ? 'Randevu Düzenle' : 'Yeni Randevu Ata'}
      >
        <form className={formStyles.form} onSubmit={handleSaveAppointment}>
          <div className={formStyles.inputGroup}>
            <label>Tarih</label>
            <input 
              type="text" 
              className={formStyles.input} 
              disabled 
              value={`${selectedDay.toLocaleDateString('tr-TR', { dateStyle: 'full' })} - ${modal.time}`}
              style={{ paddingLeft: '1rem' }}
            />
          </div>
          
          {/* === GÜNCELLEME: Üye Seçim Listesi (Paket/Seans Kontrollü) === */}
          <div className={formStyles.inputGroup}>
            <label htmlFor="memberId">Atanacak Üye</label>
            
            {/* O gün herkesin randevusu varsa bu uyarı çıkar */}
            {availableMembers.length === 0 && !modal.appointment && (
              <div className={styles.noMemberWarning}>
                <Info size={16} />
                <span>Bu gün için atanabilecek başka üye kalmadı.</span>
              </div>
            )}

            <select 
              id="memberId" 
              name="memberId" 
              className={formStyles.input}
              style={{ paddingLeft: '1rem' }}
              defaultValue={
                modal.appointment 
                ? `${modal.appointment.memberId}|${modal.appointment.memberName}` 
                : ""
              }
              required
            >
              <option value="" disabled>-- Üye Seçin --</option>
              
              {/* Mevcut üyeyi düzenleme sırasında listele */}
              {modal.appointment && 
                coachMembers.find(m => m.id === modal.appointment?.memberId) &&
                (() => {
                  const member = coachMembers.find(m => m.id === modal.appointment!.memberId)!;
                  const today = new Date();
                  today.setHours(0, 0, 0, 0); 
                  const isPackageActive = member.packageEndDate ? member.packageEndDate.getTime() >= today.getTime() : false;
                  
                  let label = ` (Mevcut: ${member.currentSessionCount})`;
                  if (!isPackageActive) {
                    label = ` (Mevcut, Paket Dolmuş: ${member.currentSessionCount})`;
                  }

                  return (
                    <option 
                      key={member.id} 
                      value={`${member.id}|${member.name}`}
                      // Mevcut üye her zaman seçilebilir olmalı
                    >
                      {member.name} {label}
                    </option>
                  );
                })()
              }
              
              {/* Diğer uygun üyeleri listele */}
              {availableMembers
                .filter(m => m.id !== modal.appointment?.memberId) // Mevcut üyeyi tekrar listeleme
                .map(member => {
                  
                  // YENİ: Kontroller
                  const today = new Date();
                  today.setHours(0, 0, 0, 0); 
                  const isPackageActive = member.packageEndDate ? member.packageEndDate.getTime() >= today.getTime() : false;
                  const hasSessions = member.currentSessionCount > 0;
                  const isSelectable = isPackageActive && hasSessions;

                  // YENİ: Etiket
                  let label = ` (Kalan: ${member.currentSessionCount})`;
                  if (!isPackageActive) {
                    label = " (Paket Süresi Dolmuş)";
                  } else if (!hasSessions) {
                    label = " (Seans Kalmadı)";
                  }

                  return (
                    <option 
                      key={member.id} 
                      value={`${member.id}|${member.name}`}
                      disabled={!isSelectable} // YENİ: Seçilemez yap
                    >
                      {member.name} {label}
                    </option>
                  );
                })}
            </select>
            
          </div>

          {/* Form Butonları (Değişiklik yok) */}
          <div className={formStyles.formActions}>
            <button 
              type="button" 
              onClick={closeModal} 
              className={`${formStyles.submitButton} ${formStyles.secondary}`} 
              disabled={isDeleting}
            >
              İptal
            </button>
            
            {modal.appointment && (
              <button 
                type="button" 
                onClick={() => openDeleteConfirmModal(modal.appointment!)} 
                className={`${formStyles.submitButton} ${formStyles.danger}`} 
                disabled={isDeleting}
              >
                Randevuyu Sil
              </button>
            )}

            <button 
              type="submit" 
              className={`${formStyles.submitButton} ${formStyles.primary}`} 
              disabled={isDeleting}
            >
              {modal.appointment ? 'Güncelle' : 'Kaydet'}
            </button>
          </div>
        </form>
      </Modal>

      {/* --- 2. Randevu Silme Onay Modalı (Değişiklik yok) --- */}
      <Modal
        isOpen={deleteConfirmModal.isOpen}
        onClose={closeDeleteConfirmModal}
        title="Randevu Silme Onayı"
      >
        {deleteConfirmModal.appointment && (
          <div className={styles.modalBody}>
            <ShieldAlert size={40} className={styles.iconReject} />
            <p>
              <strong>{deleteConfirmModal.appointment.memberName}</strong> adlı üyenin
              <br />
              {selectedDay.toLocaleDateString('tr-TR', { dateStyle: 'full' })} - <strong>{deleteConfirmModal.appointment.time}</strong>
              <br />
              randevusunu silmek istediğinizden emin misiniz?
            </p>
            <small>Bu işlem sonrası seans iadesi sorulacaktır.</small>

            {error && <p className={styles.modalError}>{error}</p>}

            <div className={formStyles.formActions}>
              <button
                type="button"
                onClick={closeDeleteConfirmModal}
                className={`${formStyles.submitButton} ${formStyles.secondary}`}
                disabled={isDeleting}
              >
                İptal
              </button>
              <button
                type="button"
                onClick={handleDeleteAppointment}
                className={`${formStyles.submitButton} ${formStyles.danger}`}
                disabled={isDeleting}
              >
                {isDeleting ? <Loader2 size={18} className={formStyles.spinner} /> : 'Evet, Sil'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* --- 3. Seans İade Modalı (Değişiklik yok) --- */}
      <Modal
        isOpen={refundModal.isOpen}
        onClose={handleRefundModalClose}
        title="Seans İadesi Onayı"
      >
        <div className={styles.modalBody}>
          <HelpCircle size={40} className={styles.iconRefund} />
          <p>
            <strong>{refundModal.memberName}</strong> adlı üyenin 
            bu randevu için kullanılan 1 seansı boşa çıktı.
            <br/><br/>
            Bu 1 seansı üyeye <strong>geri iade etmek</strong> istiyor musunuz?
          </p>
          <small>
            'Evet' derseniz üyenin seans hakkı 1 artar. 'Hayır' derseniz seans hakkı kullanılmış olarak kalır.
          </small>

          {error && <p className={styles.modalError}>{error}</p>}

          <div className={formStyles.formActions}>
            <button
              type="button"
              onClick={() => handleConfirmRefund(false)} // Hayır
              className={`${formStyles.submitButton} ${formStyles.secondary}`}
              disabled={isDeleting}
            >
              {isDeleting ? <Loader2 size={18} className={formStyles.spinner} /> : 'Hayır (İade Etme)'}
            </button>
            <button
              type="button"
              onClick={() => handleConfirmRefund(true)} // Evet
              className={`${formStyles.submitButton} ${formStyles.primary}`}
              disabled={isDeleting}
            >
              {isDeleting ? <Loader2 size={18} className={formStyles.spinner} /> : 'Evet, Seansı İade Et'}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
};

export default WeeklySchedule;