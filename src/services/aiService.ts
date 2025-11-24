// src/services/aiService.ts

import aiPrompt from '../constants/aiPrompt.json';

// ============================================================================
// MODEL SEÇİMİ
// ============================================================================
const MODEL_NAME = "gemini-2.0-flash-lite-preview-02-05"; 
const API_VERSION = "v1beta";

const BASE_URL = `https://generativelanguage.googleapis.com/${API_VERSION}/models/${MODEL_NAME}:generateContent`;

interface AnalysisData {
  startDate: string;
  endDate: string;
  financials: {
    totalTurnover: number;
    companyNet: number;
    avgPackagePrice: number; // Bunu da ekledik, promptta işe yarar
  };
  operations: {
    totalPTSessions: number;
    totalGroupClasses: number;
    activeMembersCount: number;
  };
  coachPerformance: any[];
}

export const generateGymReport = async (data: AnalysisData): Promise<string> => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

  if (!apiKey) {
    console.error("API Key Eksik!");
    throw new Error("API Key bulunamadı.");
  }

  // Tarih bağlamını belirle
  const isDaily = data.startDate === data.endDate;
  const contextNote = isDaily 
    ? "Bu rapor SADECE BUGÜNÜN (Günlük) performans analizidir." 
    : `Bu rapor ${data.startDate} ile ${data.endDate} tarihleri arasındaki DÖNEMLİK analizdir.`;

  // Veriyi daha anlaşılır hale getirmek için özet metin ekliyoruz
  // AI bazen ham JSON'daki sayıları bağlamdan kopuk yorumlayabilir.
  // Ona biraz "tüyo" veriyoruz:
  const financialSummary = `
    Toplam Ciro: ${data.financials.totalTurnover} TL
    Şirket Net Kârı: ${data.financials.companyNet} TL
    Ortalama Paket Fiyatı: ${data.financials.avgPackagePrice || 0} TL
    Toplam PT: ${data.operations.totalPTSessions}
    Toplam Grup: ${data.operations.totalGroupClasses}
  `;

  const promptText = `
    ${aiPrompt.persona}
    ${aiPrompt.instructions.join('\n')}
    
    BAĞLAM: ${contextNote}
    
    ÖNEMLİ METRİKLER:
    ${financialSummary}

    DETAYLI JSON VERİSİ (Koç detayları burada):
    ${JSON.stringify(data, null, 2)}
  `;

  // İstek Gövdesi
  const requestBody = {
    contents: [{
      parts: [{ text: promptText }]
    }],
    generationConfig: {
      temperature: 0.7,       // 0.4'ten 0.7'ye çektik. Daha yaratıcı ve yorumcu olacak.
      maxOutputTokens: 600,   // Kelime sınırını biraz artırdık, detaylı yorum yapabilsin.
      topP: 0.9,
      topK: 40
    }
  };

  try {
    const finalUrl = `${BASE_URL}?key=${apiKey}`;

    const response = await fetch(finalUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      if (response.status === 429) throw new Error("Çok fazla istek. Lütfen bekleyin.");
      throw new Error(`AI Servis Hatası: ${response.status}`);
    }

    const result = await response.json();
    const generatedText = result.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!generatedText) throw new Error("AI yanıt oluşturamadı.");

    return generatedText;

  } catch (error: any) {
    console.error("AI Hata:", error);
    throw new Error(error.message || "Rapor oluşturulamadı.");
  }
};