// src/pages/Admin/Settings/Settings.tsx

import React, { useState, useEffect } from 'react';
import styles from './Settings.module.css';
import { 
  Settings as SettingsIcon, 
  Plus, 
  Trash2, 
  FolderPlus, 
  Layers, 
  Loader2,
  X,
  CheckSquare,
  RefreshCw
} from 'lucide-react';

import { 
  getSystemDefinitions, 
  addSystemDefinition, 
  deleteSystemDefinition, 
  addItemToDefinition, 
  removeItemFromDefinition,
  addTargetToDefinition,
  removeTargetFromDefinition
} from '../../../firebase/firestoreService';

import type { SystemDefinition } from '../../../firebase/firestoreService';
import MigrateData from './MigrateData'; // <--- IMPORT EKLE

// ========================================================
// === SİSTEMDEKİ MEVCUT VARLIKLAR (ENTITIES) ===
// ========================================================
const AVAILABLE_ENTITIES = [
  { key: 'coach', label: 'Koç Formunda Göster' },
  { key: 'member', label: 'Üye Formunda Göster' },
];

const Settings: React.FC = () => {
  // --- STATE YÖNETİMİ ---
  const [definitions, setDefinitions] = useState<SystemDefinition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false); 

  // Yeni Grup Input State'i
  const [newGroupTitle, setNewGroupTitle] = useState('');

  // Her kart için ayrı item input state'i (Map yapısı)
  const [newItemInputs, setNewItemInputs] = useState<{ [key: string]: string }>({});

  // --- VERİ ÇEKME ---
  const fetchDefinitions = async () => {
    try {
      const data = await getSystemDefinitions();
      setDefinitions(data);
    } catch (error) {
      console.error("Veriler yüklenemedi:", error);
      alert("Veriler yüklenirken bir hata oluştu.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDefinitions();
  }, []);

  const handleManualRefresh = () => {
    setIsLoading(true);
    fetchDefinitions();
  };

  // --- 1. GRUP İŞLEMLERİ ---

  const handleAddGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTitle = newGroupTitle.trim();
    if (!cleanTitle) return;

    setIsSubmitting(true);
    try {
      await addSystemDefinition(cleanTitle, []); 
      setNewGroupTitle('');
      await fetchDefinitions(); 
    } catch (error) {
      console.error(error);
      alert("Grup eklenirken bir hata oluştu.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteGroup = async (id: string, title: string) => {
    const confirmMsg = `DİKKAT: "${title}" grubunu silmek üzeresiniz!\n\nBu grubu silerseniz, içindeki tüm seçenekler de silinecektir. Bu işlem geri alınamaz.\n\nDevam etmek istiyor musunuz?`;
    
    if (!window.confirm(confirmMsg)) return;

    const originalDefinitions = [...definitions];
    setDefinitions(prev => prev.filter(def => def.id !== id));

    try {
      await deleteSystemDefinition(id);
    } catch (error) {
      console.error(error);
      alert("Silme işlemi başarısız oldu, liste yenileniyor.");
      setDefinitions(originalDefinitions); 
    }
  };

  // --- 2. TARGET (FLAG) TOGGLE İŞLEMİ ---

  const handleToggleTarget = async (defId: string, targetKey: string) => {
    const targetDef = definitions.find(d => d.id === defId);
    if (!targetDef) return;

    const currentTargets = targetDef.targets || []; 
    const exists = currentTargets.includes(targetKey);

    setDefinitions(prev => prev.map(def => {
      if (def.id === defId) {
        const oldTargets = def.targets || [];
        return {
          ...def,
          targets: exists 
            ? oldTargets.filter(t => t !== targetKey) 
            : [...oldTargets, targetKey]              
        };
      }
      return def;
    }));

    try {
      if (exists) {
        await removeTargetFromDefinition(defId, targetKey);
      } else {
        await addTargetToDefinition(defId, targetKey);
      }
    } catch (error) {
      console.error("Görünürlük ayarı güncellenemedi:", error);
      fetchDefinitions();
    }
  };

  // --- 3. VERİ (ITEM) İŞLEMLERİ ---

  const handleItemInputChange = (defId: string, value: string) => {
    setNewItemInputs(prev => ({ ...prev, [defId]: value }));
  };

  const handleAddItem = async (defId: string) => {
    const val = newItemInputs[defId]?.trim();
    if (!val) return;

    try {
      await addItemToDefinition(defId, val);
      
      setDefinitions(prev => prev.map(def => {
        if (def.id === defId) {
          return { 
            ...def, 
            items: [...(def.items || []), val] 
          };
        }
        return def;
      }));

      setNewItemInputs(prev => ({ ...prev, [defId]: '' }));

    } catch (error) {
      console.error("Veri eklenemedi:", error);
      alert("Veri eklenirken hata oluştu.");
      fetchDefinitions(); 
    }
  };

  const handleDeleteItem = async (defId: string, item: string) => {
    if (!window.confirm(`"${item}" seçeneğini silmek istiyor musunuz?`)) return;

    setDefinitions(prev => prev.map(def => {
      if (def.id === defId) {
        return { 
          ...def, 
          items: (def.items || []).filter(i => i !== item) 
        };
      }
      return def;
    }));

    try {
      await removeItemFromDefinition(defId, item);
    } catch (error) {
      console.error("Veri silinemedi:", error);
      alert("Silme işlemi başarısız.");
      fetchDefinitions(); 
    }
  };

  // --- RENDER ---

  return (
    <div className={styles.settingsPage}>
      
      {/* HEADER */}
      <div className={styles.header}>
        <div className={styles.headerContent}>
          <h2 className={styles.pageTitle}>
            <SettingsIcon size={28} color="#D4AF37" />
            Sistem Tanımlamaları
          </h2>
          <p className={styles.pageSubtitle}>
            Aşağıdaki gruplar, formlardaki (Select/Dropdown) seçenekleri yönetir. 
            Hangi grubun nerede görüneceğini "Görünürlük Ayarları"ndan seçebilirsiniz.
          </p>
        </div>
        <button onClick={handleManualRefresh} className={styles.refreshButton} title="Listeyi Yenile">
            <RefreshCw size={20} />
        </button>
      </div>

      {/* YENİ GRUP EKLEME ALANI */}
      <div className={styles.addGroupContainer}>
        <h3 className={styles.addGroupTitle}>
          <FolderPlus size={18} style={{ display: 'inline', marginBottom: -3, marginRight: 5 }} />
          Yeni Veri Grubu Ekle
        </h3>
        <form className={styles.inputGroup} onSubmit={handleAddGroup}>
          <input 
            type="text" 
            className={styles.input} 
            placeholder="Örn: Branşlar, Şehirler, Kan Grupları..." 
            value={newGroupTitle}
            onChange={(e) => setNewGroupTitle(e.target.value)}
            disabled={isSubmitting}
          />
          <button type="submit" className={styles.addButton} disabled={isSubmitting || !newGroupTitle.trim()}>
            {isSubmitting ? <Loader2 size={18} className={styles.spin} /> : <Plus size={18} />}
            <span>Oluştur</span>
          </button>
        </form>
      </div>

      {/* DEFINITION CARDS GRID */}
      {isLoading ? (
        <div className={styles.loaderContainer}>
          <Loader2 size={32} className={styles.spin} />
          <p>Veriler Yükleniyor...</p>
        </div>
      ) : definitions.length === 0 ? (
        <div className={styles.emptyState}>
          <FolderPlus size={48} color="#444" />
          <p>Sistemde henüz tanımlı bir veri grubu yok.</p>
          <p>Yukarıdaki kutudan ilk grubunuzu oluşturabilirsiniz.</p>
        </div>
      ) : (
        <div className={styles.gridContainer}>
          {definitions.map((def) => (
            <div key={def.id} className={styles.card}>
              
              {/* KART BAŞLIĞI */}
              <div className={styles.cardHeader}>
                <div className={styles.cardTitleWrapper}>
                  <Layers size={16} color="#D4AF37" />
                  <span className={styles.cardTitle}>{def.title}</span>
                </div>

                <button 
                  className={styles.deleteGroupButton} 
                  onClick={() => handleDeleteGroup(def.id, def.title)}
                  title="Bu grubu ve içindekileri tamamen sil"
                >
                  <Trash2 size={16} />
                </button>
              </div>

              <div className={styles.cardContent}>
                
                {/* 1. GÖRÜNÜRLÜK (FLAGS) */}
                <div className={styles.targetSection}>
                  <div className={styles.targetHeader}>
                    <CheckSquare size={14} />
                    Görünürlük:
                  </div>
                  
                  <div className={styles.targetOptionsGrid}>
                    {AVAILABLE_ENTITIES.map((entity) => {
                        const isChecked = (def.targets || []).includes(entity.key);
                        return (
                            <label key={entity.key} className={styles.checkboxLabel}>
                                <input 
                                    type="checkbox" 
                                    className={styles.customCheckbox}
                                    checked={isChecked}
                                    onChange={() => handleToggleTarget(def.id, entity.key)}
                                />
                                {entity.label}
                            </label>
                        );
                    })}
                  </div>
                </div>
                
                <div className={styles.separator}></div>

                {/* 2. VERİ EKLEME INPUTU */}
                <div className={styles.addItemRow}>
                  <input 
                    type="text" 
                    className={styles.miniInput}
                    placeholder="Seçenek ekle..."
                    value={newItemInputs[def.id] || ''}
                    onChange={(e) => handleItemInputChange(def.id, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAddItem(def.id);
                    }}
                  />
                  <button 
                    className={styles.miniAddButton}
                    onClick={() => handleAddItem(def.id)}
                    disabled={!newItemInputs[def.id]?.trim()}
                    title="Ekle"
                  >
                    <Plus size={16} />
                  </button>
                </div>

                {/* 3. VERİ LİSTESİ */}
                <div className={styles.itemsList}>
                  {(def.items && def.items.length > 0) ? (
                    def.items.map((item, index) => (
                      <div key={`${def.id}-${index}`} className={styles.itemRow}>
                        <span className={styles.itemText}>{item}</span>
                        <button 
                          className={styles.deleteItemButton}
                          onClick={() => handleDeleteItem(def.id, item)}
                          title="Sil"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className={styles.noItems}>
                      <span>Bu gruba henüz seçenek eklenmemiş.</span>
                    </div>
                  )}
                </div>

              </div>
            </div>
          ))}
        </div>
      )}

      {/* --- VERİ GÖÇÜ ARACI --- */}
      <div style={{ marginTop: '4rem', borderTop: '1px solid #333', paddingTop: '2rem' }}>
          <MigrateData />
      </div>

    </div>
  );
};

export default Settings;