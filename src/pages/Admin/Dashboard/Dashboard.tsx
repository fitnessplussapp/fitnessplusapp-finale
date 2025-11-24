// src/pages/Admin/Dashboard/Dashboard.tsx

import React, { useState, useEffect } from 'react';
import styles from './Dashboard.module.css';
import { BrainCircuit, Calendar as CalendarIcon, Filter, ChevronDown } from 'lucide-react';

import DailyPulse from './components/DailyPulse';
import PeriodStats from './components/PeriodStats';
import CoachWeeklySchedule from './components/CoachWeeklySchedule'; 
import DatePicker, { registerLocale } from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { tr } from 'date-fns/locale/tr';

import { 
  getDetailedDashboardStats, 
  getTodayRealizedStats, 
  getSystemDefinitions
} from '../../../firebase/firestoreService';
import type { DetailedStats } from '../../../firebase/firestoreService';
import { generateGymReport } from '../../../services/aiService';
import Modal from '../../../components/Modal/Modal';

registerLocale('tr', tr);

const Dashboard: React.FC = () => {
  const [dateRange, setDateRange] = useState<{start: Date, end: Date}>(() => {
    const start = new Date();
    start.setDate(1); // Ayın başı
    return { start: start, end: new Date() };
  });

  const [branches, setBranches] = useState<string[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>('Tümü');

  const [periodStats, setPeriodStats] = useState<DetailedStats | null>(null);
  const [loadingPeriod, setLoadingPeriod] = useState(true);

  const [todayData, setTodayData] = useState<any>(null);
  const [loadingToday, setLoadingToday] = useState(true);
  
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [aiReport, setAiReport] = useState<string | null>(null);
  const [loadingAI, setLoadingAI] = useState(false);

  // 1. Şubeleri Çek
  useEffect(() => {
    getSystemDefinitions().then(defs => {
        const branchDef = defs.find(d => d.title === 'Şubeler' || d.title === 'Branches');
        if (branchDef) setBranches(['Tümü', ...branchDef.items]);
        else setBranches(['Tümü', 'Merkez']);
    });
  }, []);

  // 2. DÖNEMLİK VERİ (Backend'den gelir)
  useEffect(() => {
    const fetchPeriod = async () => {
      setLoadingPeriod(true);
      const data = await getDetailedDashboardStats(dateRange.start, dateRange.end, selectedBranch);
      setPeriodStats(data);
      setLoadingPeriod(false);
    };
    fetchPeriod();
  }, [dateRange, selectedBranch]);

  // 3. GÜNLÜK VERİ (Client-side Hesaplama)
  useEffect(() => {
    const fetchToday = async () => {
      setLoadingToday(true);
      try {
        const result = await getTodayRealizedStats(new Date(), selectedBranch);
        
        // --- KRİTİK HESAPLAMA ALANI ---
        // Burada dersin birim fiyatı üzerinden şirketin ve koçun payını hesaplıyoruz.
        // Paket satış fiyatı DEĞİL, gerçekleşen dersin birim değeri esas alınır.
        
        const calculatedEvents = result.detailedEvents.map((evt: any) => {
            const rawPrice = evt.value || 0; // Dersin birim değeri (Örn: 500 TL)
            
            // ORAN BELİRLEME:
            // İsteğinize göre burası %50 veya sabit bir TL olabilir.
            // Örnek: PT için %30 şirket, Grup için %50 şirket gibi.
            // Burayı tamamen %50 yapmak isterseniz: const companyRatio = 0.5;
            
            let companyRatio = 0.5; // Varsayılan %50
            if (evt.type === 'personal') {
                companyRatio = 0.5; // PT Oranı (İsterseniz 0.3 yapabilirsiniz)
            } else {
                companyRatio = 0.5; // Grup Oranı
            }

            const companyCut = rawPrice * companyRatio; // Şirket Payı
            const coachCut = rawPrice - companyCut;     // Koç Payı

            return {
                ...evt,
                unitPrice: rawPrice,
                companyCut: companyCut,
                coachCut: coachCut
            };
        });

        // Toplamları al
        // Toplam Ciro (Hizmet Değeri): O gün verilen tüm derslerin toplam değeri
        const totalRevenue = calculatedEvents.reduce((acc: number, curr: any) => acc + curr.unitPrice, 0);
        
        // Şirket Net: Şirketin kasasına hak edilen (giren değil, hak edilen) para
        const totalCompanyNet = calculatedEvents.reduce((acc: number, curr: any) => acc + curr.companyCut, 0);
        
        // Koç Hakedişi
        const totalCoachNet = calculatedEvents.reduce((acc: number, curr: any) => acc + curr.coachCut, 0);

        setTodayData({
            totalRevenue,      
            totalCompanyNet,   
            totalCoachNet,     
            ptCount: result.totalPT,
            groupCount: result.totalGroup,
            events: calculatedEvents
        });

      } catch (e) { console.error(e); } finally { setLoadingToday(false); }
    };
    fetchToday();
  }, [selectedBranch]); 

  // AI RAPOR
  const handleAI = async () => {
    setIsAIModalOpen(true);
    if (aiReport) return;
    setLoadingAI(true);
    try {
        const report = await generateGymReport({
            startDate: dateRange.start.toLocaleDateString(),
            endDate: dateRange.end.toLocaleDateString(),
            financials: periodStats?.financials || {totalTurnover:0, companyNet:0},
            operations: periodStats?.operations || {totalPTSessions:0, totalGroupClasses:0},
            coachPerformance: [] 
        });
        setAiReport(report);
    } catch (e) { setAiReport("Rapor oluşturulamadı."); } finally { setLoadingAI(false); }
  };

  return (
    <div className={styles.dashboard}>
      
      {/* ÜST BAR */}
      <div className={styles.topBar}>
        <div className={styles.filterGroup}>
            
            {/* ŞUBE SEÇİMİ */}
            <div className={styles.filterItem}>
                <span className={styles.inputLabel}>Şube</span>
                <div className={styles.selectWrapper}>
                    <Filter size={16} color="#888" className={styles.filterIcon} />
                    <select 
                        value={selectedBranch} 
                        onChange={e => setSelectedBranch(e.target.value)}
                        className={styles.branchSelect}
                    >
                        {branches.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                    <ChevronDown size={14} color="#666" className={styles.chevronIcon} />
                </div>
            </div>

            {/* TARİH ARALIĞI */}
            <div className={styles.filterItem}>
                 <span className={styles.inputLabel}>Tarih Aralığı</span>
                 <div className={styles.dateWrapper}>
                    <CalendarIcon size={16} color="#888" style={{marginRight:'8px'}}/>
                    <DatePicker 
                        selected={dateRange.start} 
                        onChange={(date) => date && setDateRange(prev => ({...prev, start: date}))} 
                        className={styles.dateInput} 
                        dateFormat="dd.MM.yyyy" 
                        locale="tr"
                        placeholderText="Başlangıç"
                    />
                    <span style={{color:'#666', margin:'0 4px'}}>-</span>
                    <DatePicker 
                        selected={dateRange.end} 
                        onChange={(date) => date && setDateRange(prev => ({...prev, end: date}))} 
                        className={styles.dateInput} 
                        dateFormat="dd.MM.yyyy" 
                        minDate={dateRange.start} 
                        locale="tr"
                        placeholderText="Bitiş"
                    />
                 </div>
            </div>
        </div>

        <button className={styles.aiButton} onClick={handleAI}>
          <BrainCircuit size={18} />
          <span>Analiz Et</span>
        </button>
      </div>

      <DailyPulse data={todayData} loading={loadingToday} />

      <PeriodStats stats={periodStats} loading={loadingPeriod} dateRange={dateRange} />

      <CoachWeeklySchedule selectedBranch={selectedBranch} />

      <Modal isOpen={isAIModalOpen} onClose={() => setIsAIModalOpen(false)} title="Yapay Zeka İşletme Raporu">
        <div style={{padding:'1rem', lineHeight:'1.6', color:'#ddd', minHeight:'300px'}}>
            {loadingAI ? (
                <div style={{display:'flex', flexDirection:'column', alignItems:'center', gap:'1rem', marginTop:'3rem'}}>
                    <BrainCircuit size={48} className={styles.spin} color="#a855f7"/>
                    <p>Verileriniz analiz ediliyor, lütfen bekleyin...</p>
                </div>
            ) : (
                <div dangerouslySetInnerHTML={{__html: aiReport || ''}} />
            )}
        </div>
      </Modal>

    </div>
  );
};

export default Dashboard;