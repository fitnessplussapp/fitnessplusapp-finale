import React, { useState } from 'react';
import { User, Layers, Percent } from 'lucide-react'; 
import Modal from '../../../components/Modal/Modal';
import formStyles from '../../../components/Form/Form.module.css';

// YENİ SERVİS VE TİPLER
import { dbService } from '../../../services/DatabaseService';
import type { CoachProfile } from '../../../types/schema';

interface AddCoachProps {
  isOpen: boolean;
  onClose: () => void;
  onCoachAdded: () => void; 
}

const AddCoach: React.FC<AddCoachProps> = ({ isOpen, onClose, onCoachAdded }) => {
  // Form State
  const [username, setUsername] = useState(''); // ID olarak kullanılacak
  const [fullName, setFullName] = useState('');
  const [branch, setBranch] = useState('Merkez');
  const [commission, setCommission] = useState<number>(40); // %40 Varsayılan
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      // v3.0 Veri Yapısına Uygun Obje
      const newCoachData: Omit<CoachProfile, 'createdAt' | 'metrics'> = {
        id: username.toLowerCase().trim(),
        email: `${username}@fitnessplus.com`, // Otomatik mail (örnek)
        fullName: fullName.trim(),
        specialties: [], // İleride eklenebilir
        branchId: branch,
        commissionRate: commission / 100, // Yüzdeyi ondalığa çevir (0.40)
        commissionModel: 'PERCENTAGE'
      };

      await dbService.createCoach(newCoachData);
      
      onCoachAdded();
      handleClose();
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Bir hata oluştu.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setUsername('');
    setFullName('');
    setCommission(40);
    setError('');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Yeni Profesyonel Koç Ekle">
      <form className={formStyles.form} onSubmit={handleSubmit}>
        {error && <div className={formStyles.error}>{error}</div>}

        <div className={formStyles.inputGroup}>
          <label>Kullanıcı ID (Giriş İçin)</label>
          <div className={formStyles.inputWrapper}>
            <User size={18} className={formStyles.inputIcon} />
            <input
              type="text"
              placeholder="ahmet.yilmaz"
              className={formStyles.input}
              value={username}
              onChange={e => setUsername(e.target.value)}
              required
            />
          </div>
        </div>

        <div className={formStyles.inputGroup}>
          <label>Ad Soyad</label>
          <div className={formStyles.inputWrapper}>
            <User size={18} className={formStyles.inputIcon} />
            <input
              type="text"
              placeholder="Ahmet Yılmaz"
              className={formStyles.input}
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              required
            />
          </div>
        </div>

        <div className={formStyles.inputGroup}>
          <label>Şube</label>
          <div className={formStyles.inputWrapper}>
            <Layers size={18} className={formStyles.inputIcon} />
            <select 
                className={formStyles.input} 
                value={branch} 
                onChange={e => setBranch(e.target.value)}
            >
                <option value="Merkez">Merkez Şube</option>
                <option value="Alsancak">Alsancak</option>
                <option value="Bostanlı">Bostanlı</option>
            </select>
          </div>
        </div>

        <div className={formStyles.inputGroup}>
          <label>Hakediş Oranı (%)</label>
          <div className={formStyles.inputWrapper}>
            <Percent size={18} className={formStyles.inputIcon} />
            <input
              type="number"
              min="0" max="100"
              className={formStyles.input}
              value={commission}
              onChange={e => setCommission(Number(e.target.value))}
              required
            />
          </div>
          <small style={{color:'#666'}}>Ders başına alacağı pay yüzdesi (Örn: %40)</small>
        </div>

        <div className={formStyles.formActions}>
            <button type="button" onClick={handleClose} className={`${formStyles.submitButton} ${formStyles.secondary}`}>İptal</button>
            <button type="submit" disabled={isLoading} className={`${formStyles.submitButton} ${formStyles.primary}`}>
                {isLoading ? <Loader2 size={18} className="spin" /> : 'Oluştur'}
            </button>
        </div>

      </form>
    </Modal>
  );
};

export default AddCoach;