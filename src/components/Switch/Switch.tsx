// src/components/Switch/Switch.tsx

import React from 'react';
import styles from './Switch.module.css';

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
}

const Switch: React.FC<SwitchProps> = ({ checked, onChange }) => {
  return (
    <label className={styles.switch}>
      <input 
        type="checkbox" 
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className={styles.slider}></span>
    </label>
  );
};

export default Switch;