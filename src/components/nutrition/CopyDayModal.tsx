import React, { useState } from 'react';
import { DayOfWeek } from '../../types/nutrition.types';
import { DAYS_OF_WEEK } from '../../lib/nutritionEngine';

interface CopyDayModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceDayKey: string;
  sourceDayLabel: string;
  onConfirmCopy: (targetDayKeys: DayOfWeek[]) => void;
}

export const CopyDayModal: React.FC<CopyDayModalProps> = ({
  isOpen,
  onClose,
  sourceDayKey,
  sourceDayLabel,
  onConfirmCopy,
}) => {
  const [selectedDays, setSelectedDays] = useState<DayOfWeek[]>([]);

  if (!isOpen) return null;

  const availableDays = DAYS_OF_WEEK.filter((d) => d.key !== sourceDayKey);

  const toggleDay = (key: DayOfWeek) => {
    setSelectedDays((prev) =>
      prev.includes(key) ? prev.filter((d) => d !== key) : [...prev, key]
    );
  };

  const selectAll = () => {
    setSelectedDays(availableDays.map((d) => d.key));
  };

  const clearAll = () => {
    setSelectedDays([]);
  };

  const handleCopy = () => {
    if (selectedDays.length === 0) return;
    onConfirmCopy(selectedDays);
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        padding: '16px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#0d1322',
          border: '1px solid rgba(0, 212, 255, 0.3)',
          borderRadius: '12px',
          width: '100%',
          maxWidth: '440px',
          padding: '24px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6)',
          color: '#ffffff',
          fontFamily: "'Inter', sans-serif",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3
            style={{
              margin: 0,
              fontSize: '16px',
              fontFamily: "'Orbitron', sans-serif",
              color: '#00d4ff',
              letterSpacing: '1px',
            }}
          >
            📋 COPIAR DÍA
          </h3>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'rgba(255, 255, 255, 0.6)',
              fontSize: '20px',
              cursor: 'pointer',
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>

        <p style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.7)', margin: '0 0 16px' }}>
          Duplicar el menú completo de <strong>{sourceDayLabel}</strong> a los siguientes días de la semana:
        </p>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
          <button
            type="button"
            onClick={selectAll}
            style={{
              background: 'rgba(0, 212, 255, 0.1)',
              border: '1px solid rgba(0, 212, 255, 0.3)',
              color: '#00d4ff',
              borderRadius: '6px',
              padding: '6px 12px',
              fontSize: '11px',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            Seleccionar Todos
          </button>
          <button
            type="button"
            onClick={clearAll}
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: 'rgba(255, 255, 255, 0.7)',
              borderRadius: '6px',
              padding: '6px 12px',
              fontSize: '11px',
              cursor: 'pointer',
            }}
          >
            Limpiar
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
          {availableDays.map((d) => {
            const isChecked = selectedDays.includes(d.key);
            return (
              <label
                key={d.key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  background: isChecked ? 'rgba(0, 212, 255, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                  border: isChecked ? '1px solid rgba(0, 212, 255, 0.4)' : '1px solid rgba(255, 255, 255, 0.06)',
                  borderRadius: '8px',
                  padding: '10px 14px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => toggleDay(d.key)}
                  style={{ accentColor: '#00d4ff', width: '16px', height: '16px' }}
                />
                <span style={{ fontSize: '13px', fontWeight: isChecked ? 600 : 400 }}>
                  {d.label}
                </span>
              </label>
            );
          })}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: '#ffffff',
              borderRadius: '8px',
              padding: '8px 16px',
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleCopy}
            disabled={selectedDays.length === 0}
            style={{
              background: selectedDays.length > 0 ? 'var(--theme-primary, #00d4ff)' : 'rgba(255, 255, 255, 0.1)',
              border: 'none',
              color: '#000000',
              fontWeight: 800,
              fontFamily: "'Orbitron', sans-serif",
              borderRadius: '8px',
              padding: '8px 18px',
              fontSize: '12px',
              cursor: selectedDays.length > 0 ? 'pointer' : 'not-allowed',
            }}
          >
            COPIAR A {selectedDays.length} DÍA(S)
          </button>
        </div>
      </div>
    </div>
  );
};

export default CopyDayModal;
