// src/components/common/OnboardingModal.tsx
import React, { useState } from 'react';

interface OnboardingModalProps {
  onClose: () => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({ onClose }) => {
  const [step, setStep] = useState<number>(1);

  const handleNext = () => {
    if (step < 4) {
      setStep(step + 1);
    } else {
      localStorage.setItem('evolution_onboarded_v1', 'true');
      onClose();
    }
  };

  const stepsData = [
    {
      title: 'BIENVENIDO A EVOLUTION LAB',
      emoji: '🧬',
      description: 'Tu nuevo sistema de entrenamiento de precisión científica. Aquí no entrenamos por instinto o motivación temporal; entrenamos con estructura, control de variables y progresión matemática.',
      accent: '#00d4ff'
    },
    {
      title: '🧠 SMART COACH',
      emoji: '🧠',
      description: 'Nuestro motor inteligente basado en autorregulación (RIR) y RPE analiza tu volumen de entrenamiento, fatiga acumulada y constancia para sugerirte incrementos de carga precisos y disipar el estancamiento.',
      accent: '#7b2ff7'
    },
    {
      title: '🎮 GAMIFICACIÓN Y LOGROS',
      emoji: '🏆',
      description: 'Acumula puntos de experiencia (XP) por cada serie y sesión completada. Sube de nivel y desbloquea insignias de rendimiento, además de los logros personalizados que tu propio entrenador diseñe para ti.',
      accent: '#fda4af'
    },
    {
      title: '🔌 MODO OFFLINE (PWA)',
      emoji: '⚡',
      description: '¿Sin señal en el gimnasio? No hay problema. Evolution Lab almacena de forma segura tu plan y tus entrenamientos localmente en tu dispositivo. Al volver a tener red, se sincronizarán automáticamente con la nube.',
      accent: '#10b981'
    }
  ];

  const currentData = stepsData[step - 1];

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(5, 8, 16, 0.95)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      zIndex: 99999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div style={{
        background: 'rgba(15, 23, 42, 0.85)',
        border: `1px solid ${currentData.accent}33`,
        borderRadius: '24px',
        maxWidth: '500px',
        width: '100%',
        padding: '35px 28px',
        textAlign: 'center',
        boxShadow: `0 20px 50px ${currentData.accent}12`,
        position: 'relative',
        overflow: 'hidden',
        transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
      }}>
        {/* Decorative corner brackets */}
        <div style={{ position: 'absolute', top: '15px', left: '15px', width: '10px', height: '10px', borderTop: `2px solid ${currentData.accent}`, borderLeft: `2px solid ${currentData.accent}`, opacity: 0.5 }}></div>
        <div style={{ position: 'absolute', top: '15px', right: '15px', width: '10px', height: '10px', borderTop: `2px solid ${currentData.accent}`, borderRight: `2px solid ${currentData.accent}`, opacity: 0.5 }}></div>
        <div style={{ position: 'absolute', bottom: '15px', left: '15px', width: '10px', height: '10px', borderBottom: `2px solid ${currentData.accent}`, borderLeft: `2px solid ${currentData.accent}`, opacity: 0.5 }}></div>
        <div style={{ position: 'absolute', bottom: '15px', right: '15px', width: '10px', height: '10px', borderBottom: `2px solid ${currentData.accent}`, borderRight: `2px solid ${currentData.accent}`, opacity: 0.5 }}></div>

        {/* Floating background orb */}
        <div style={{
          position: 'absolute',
          top: '-50px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '180px',
          height: '180px',
          background: currentData.accent,
          filter: 'blur(70px)',
          opacity: 0.12,
          pointerEvents: 'none',
          borderRadius: '50%',
          transition: 'background 0.4s ease'
        }}></div>

        {/* Steps indicator */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '8px',
          marginBottom: '28px'
        }}>
          {[1, 2, 3, 4].map((s) => (
            <div
              key={s}
              style={{
                width: s === step ? '24px' : '8px',
                height: '8px',
                borderRadius: '4px',
                background: s === step ? currentData.accent : 'rgba(255,255,255,0.1)',
                transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
              }}
            ></div>
          ))}
        </div>

        {/* Icon container */}
        <div style={{
          width: '72px',
          height: '72px',
          borderRadius: '20px',
          background: `${currentData.accent}12`,
          border: `1px solid ${currentData.accent}25`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '32px',
          margin: '0 auto 24px auto',
          boxShadow: `0 8px 20px ${currentData.accent}10`,
          transition: 'all 0.3s ease'
        }}>
          {currentData.emoji}
        </div>

        {/* Title */}
        <h2 style={{
          fontFamily: "'Orbitron', sans-serif",
          fontSize: '18px',
          fontWeight: 800,
          color: 'white',
          letterSpacing: '1.5px',
          marginBottom: '16px',
          textTransform: 'uppercase'
        }}>
          {currentData.title}
        </h2>

        {/* Description */}
        <p style={{
          fontSize: '13.5px',
          color: 'rgba(255,255,255,0.65)',
          lineHeight: 1.6,
          marginBottom: '32px',
          minHeight: '80px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          {currentData.description}
        </p>

        {/* CTA Button */}
        <button
          onClick={handleNext}
          style={{
            width: '100%',
            background: `linear-gradient(135deg, ${currentData.accent}, ${currentData.accent}dd)`,
            color: 'white',
            border: 'none',
            borderRadius: '12px',
            padding: '14px',
            fontSize: '12px',
            fontFamily: "'Orbitron', sans-serif",
            fontWeight: 700,
            letterSpacing: '1px',
            cursor: 'pointer',
            boxShadow: `0 4px 15px ${currentData.accent}30`,
            transition: 'all 0.2s'
          }}
        >
          {step === 4 ? 'COMENZAR' : 'SIGUIENTE'}
        </button>
      </div>
    </div>
  );
};

export default OnboardingModal;
