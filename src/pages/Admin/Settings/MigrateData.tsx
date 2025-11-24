// src/pages/Admin/Settings/MigrateData.tsx

import React, { useState } from 'react';
import { db } from '../../../firebase/firebaseConfig';
import { 
  collection, 
  getDocs, 
  addDoc, 
  query, 
  where,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { Loader2, Database, Play, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';

const MigrateData: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  // Log ekleme yardımcısı
  const addLog = (message: string) => {
    setLogs(prev => [...prev, `${new Date().toLocaleTimeString()} - ${message}`]);
  };

  // Bitiş saati hesaplayıcı (Başlangıç + 1 Saat)
  const calculateEndTime = (startTime: string): string => {
    if (!startTime || !startTime.includes(':')) return '00:00';
    const [hourStr, minuteStr] = startTime.split(':');
    const hour = parseInt(hourStr, 10);
    
    // 23:00 ise 00:00 olsun, yoksa saati 1 artır
    const endHour = (hour + 1) % 24;
    return `${endHour.toString().padStart(2, '0')}:${minuteStr}`;
  };

  const handleMigration = async () => {
    if (!window.confirm("DİKKAT: Eski 'schedule' verileri yeni 'events' yapısına kopyalanacak. Devam etmek istiyor musunuz?")) return;

    setLoading(true);
    setLogs([]); // Logları temizle
    addLog("🚀 Taşıma işlemi başlatılıyor...");

    try {
      // 1. Tüm Koçları Getir
      const coachesSnapshot = await getDocs(collection(db, 'coaches'));
      addLog(`📂 Toplam ${coachesSnapshot.size} koç bulundu.`);

      for (const coachDoc of coachesSnapshot.docs) {
        const coachId = coachDoc.id;
        const coachData = coachDoc.data();
        const coachName = coachData.username || 'Bilinmeyen Koç';

        addLog(`👤 Koç taranıyor: ${coachName} (${coachId})`);

        // 2. Bu koçun eski 'schedule' verilerini çek
        const scheduleRef = collection(db, 'coaches', coachId, 'schedule');
        const scheduleSnapshot = await getDocs(scheduleRef);

        if (scheduleSnapshot.empty) {
          addLog(`   ⚠️ Bu koçun eski program verisi yok, geçiliyor.`);
          continue;
        }

        addLog(`   Found Bulunan eski kayıt sayısı: ${scheduleSnapshot.size}`);

        let successCount = 0;
        let skipCount = 0;
        let errorCount = 0;

        // 3. Her bir eski kaydı dönüştür ve aktar
        for (const scheduleDoc of scheduleSnapshot.docs) {
          const oldData = scheduleDoc.data();

          // Gerekli verilerin kontrolü
          if (!oldData.day || !oldData.time) {
            addLog(`   ❌ Hatalı veri (Tarih/Saat yok), ID: ${scheduleDoc.id} - Atlanıyor.`);
            errorCount++;
            continue;
          }

          try {
            // A. Çift Kayıt Kontrolü (Idempotency)
            // Aynı tarih ve saatte zaten bir 'event' var mı?
            const eventsRef = collection(db, 'coaches', coachId, 'events');
            const duplicateCheckQuery = query(
              eventsRef,
              where('date', '==', oldData.day),
              where('startTime', '==', oldData.time)
            );
            const duplicateCheckSnap = await getDocs(duplicateCheckQuery);

            if (!duplicateCheckSnap.empty) {
              // Zaten var, atla
              skipCount++;
              continue;
            }

            // B. Yeni Veri Formatını Hazırla
            const newEventData = {
              type: 'personal', // Eski kayıtların hepsi bireyseldi
              title: oldData.memberName || 'Bireysel Seans', // Başlık olarak üye adı
              date: oldData.day,       // "2025-11-14"
              startTime: oldData.time, // "14:00"
              endTime: calculateEndTime(oldData.time), // "15:00" (Otomatik)
              quota: 1,
              participants: [
                {
                  isGuest: false, // Kayıtlı üyeydi
                  memberId: oldData.memberId || 'unknown_member',
                  name: oldData.memberName || 'İsimsiz Üye',
                  // phone: '' // Eski veride telefon yoktu
                }
              ],
              // Eski oluşturulma tarihini korumaya çalış, yoksa şu anı bas
              createdAt: oldData.timestamp || serverTimestamp(),
              migratedFrom: scheduleDoc.id // İzlenebilirlik için eski ID'yi not düş
            };

            // C. Yeni Koleksiyona Yaz
            await addDoc(eventsRef, newEventData);
            successCount++;

          } catch (err) {
            console.error(err);
            errorCount++;
          }
        }

        addLog(`   ✅ Tamamlandı -> Eklendi: ${successCount}, Atlandı (Zaten Var): ${skipCount}, Hata: ${errorCount}`);
      }

      addLog("🏁 TÜM İŞLEMLER BAŞARIYLA SONLANDI.");

    } catch (error: any) {
      console.error("Migration Error:", error);
      addLog(`⛔ KRİTİK HATA: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ 
      marginTop: '2rem', 
      padding: '1.5rem', 
      backgroundColor: '#1a1a1a', 
      border: '1px solid #333', 
      borderRadius: '8px' 
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1rem' }}>
        <Database color="#a855f7" size={24} />
        <h3 style={{ margin: 0, color: '#fff', fontSize: '1.1rem' }}>Veri Tabanı Taşıma Aracı (Migration)</h3>
      </div>

      <div style={{ 
        backgroundColor: 'rgba(234, 179, 8, 0.1)', 
        border: '1px solid rgba(234, 179, 8, 0.2)', 
        padding: '1rem', 
        borderRadius: '6px',
        marginBottom: '1.5rem',
        color: '#eab308',
        fontSize: '0.9rem',
        display: 'flex',
        gap: '10px'
      }}>
        <AlertTriangle size={20} style={{ flexShrink: 0 }} />
        <div>
          <strong style={{ display: 'block', marginBottom: '0.5rem' }}>Önemli Bilgi:</strong>
          Bu araç, eski sistemdeki <code>schedule</code> (seanslar) verilerini, yeni sistemdeki <code>events</code> yapısına dönüştürerek kopyalar.
          <ul style={{ margin: '0.5rem 0 0 1.2rem', padding: 0 }}>
            <li>Eski veriler <strong>silinmez</strong>, sadece kopyalanır.</li>
            <li>Aynı tarih ve saatteki veriler tekrar eklenmez (Duplicate koruması vardır).</li>
            <li>Bitiş saati otomatik olarak başlangıç saatine +1 saat eklenerek hesaplanır.</li>
          </ul>
        </div>
      </div>

      <button
        onClick={handleMigration}
        disabled={loading}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          backgroundColor: loading ? '#555' : '#2563eb',
          color: '#fff',
          border: 'none',
          padding: '0.75rem 1.5rem',
          borderRadius: '6px',
          cursor: loading ? 'not-allowed' : 'pointer',
          fontWeight: 600,
          fontSize: '0.95rem',
          transition: 'background 0.2s'
        }}
      >
        {loading ? <Loader2 className="animate-spin" size={18} /> : <Play size={18} />}
        {loading ? 'Veriler Taşınıyor...' : 'Taşıma İşlemini Başlat'}
      </button>

      {/* LOG PENCERESİ */}
      <div style={{
        marginTop: '1.5rem',
        backgroundColor: '#000',
        border: '1px solid #333',
        borderRadius: '6px',
        height: '300px',
        overflowY: 'auto',
        padding: '1rem',
        fontFamily: 'monospace',
        fontSize: '0.85rem',
        color: '#ccc'
      }}>
        {logs.length === 0 ? (
          <div style={{ color: '#555', textAlign: 'center', marginTop: '2rem' }}>
            İşlem kayıtları burada görünecektir...
          </div>
        ) : (
          logs.map((log, index) => (
            <div key={index} style={{ 
              marginBottom: '4px', 
              borderBottom: '1px solid #111', 
              paddingBottom: '2px',
              color: log.includes('HATA') || log.includes('❌') ? '#ef4444' : 
                     log.includes('✅') ? '#10b981' : 
                     log.includes('⚠️') ? '#fbbf24' : '#ccc'
            }}>
              {log}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default MigrateData;