// src/components/Modal/Modal.tsx

import React from 'react';
import styles from './Modal.module.css';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'small' | 'large'; // Yeni Prop
}

const Modal: React.FC<ModalProps> = ({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  size = 'small' // Varsayılan: small
}) => {
  if (!isOpen) {
    return null;
  }

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // CSS sınıfını prop'a göre seç
  const sizeClass = size === 'large' ? styles.sizeLarge : styles.sizeSmall;

  return (
    <div className={styles.backdrop} onClick={handleBackdropClick}>
      <div className={`${styles.modalContent} ${sizeClass}`}>
        
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>{title}</h2>
          <button className={styles.closeButton} onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        <div className={styles.modalBody}>
          {children}
        </div>

      </div>
    </div>
  );
};

export default Modal;