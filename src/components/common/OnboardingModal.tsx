// src/components/common/OnboardingModal.tsx
import React, { useState } from 'react';

interface OnboardingModalProps {
  onClose: () => void;
  rol: 'entrenador' | 'cliente_guiado' | 'cliente_autonomo';
  suscripcionPlan?: string;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({ 
  onClose,
  rol,
  suscripcionPlan = 'free'
}) => {
  const [step, setStep] = useState<number>(1);

  const handleNext = () => {
    if (step < 4) {
      setStep(step + 1);
    } else {
      if (rol === 'entrenador') {
        localStorage.setItem('evolution_trainer_onboarded_v1', 'true');
      } else {
        localStorage.setItem('evolution_onboarded_v1', 'true');
      }
      onClose();
    }
  };

  const stepsData = (() => {
    if (rol === 'entrenador') {
      return [
        {
          title: 'BIENVENIDO A EVOLUTION LAB COACH',
          emoji: '🧬',
          description: 'Tu plataforma de gestión y planificación de precisión científica. Diseña rutinas estructuradas, visualiza el progreso y define las reglas de sobrecarga de tus atletas de manera profesional.',
          accent: '#00d4ff'
        },
        {
          title: '👥 GESTIÓN DE ATLETAS',
          emoji: '👥',
          description: 'Controla el volumen de entrenamiento, marcas históricas y vigencias de tus alumnos. Todo consolidado en un panel interactivo y veloz.',
          accent: '#7b2ff7'
        },
        {
          title: '⚙️ MOTOR DE SOBRECARGA',
          emoji: '⚙️',
          description: 'Personaliza de forma individualizada cómo debe actuar el motor ante estancamientos, progresiones lineales, ondulantes o descargas para cada ejercicio y atleta.',
          accent: '#fda4af'
        },
        {
          title: '🔔 AUDITORÍA Y ALERTAS PUSH',
          emoji: '🔔',
          description: 'Mantente al tanto de la fatiga, racha e incrementos de carga de tus atletas. Activa las notificaciones push para recibir alertas al instante.',
          accent: '#10b981'
        }
      ];
    } else if (rol === 'cliente_guiado') {
      return [
        {
          title: 'BIENVENIDO A EVOLUTION LAB',
          emoji: '🧬',
          description: 'Tu coach ha preparado tu plan de entrenamiento personalizado. Aquí registrarás tus marcas y cada serie con precisión científica.',
          accent: '#00d4ff'
        },
        {
          title: '🧠 SMART COACH',
          emoji: '🧠',
          description: 'Sugerencias de cargas y repeticiones en tiempo real basadas en tu rendimiento real y la configuración de sobrecarga definida por tu entrenador.',
          accent: '#7b2ff7'
        },
        {
          title: '🔥 TU PROGRESO Y LOGROS',
          emoji: '🏆',
          description: 'Gana puntos de experiencia (XP), sube de nivel y desbloquea insignias a medida que cumples tus entrenamientos y superas tus marcas.',
          accent: '#fda4af'
        },
        {
          title: '🔌 ENTRENAMIENTO OFFLINE',
          emoji: '⚡',
          description: '¿Sin señal en el gimnasio? La PWA guarda tus registros de manera local y los sincroniza automáticamente en la nube cuando recuperes internet.',
          accent: '#10b981'
        }
      ];
    } else { // cliente_autonomo
      const isPremium = suscripcionPlan === 'premium';
      return [
        {
          title: isPremium ? 'EVOLUTION LAB SOLO PRO ⚡' : 'EVOLUTION LAB SOLO FREE 🧬',
          emoji: '🧬',
          description: isPremium
            ? 'Tienes acceso ILIMITADO y completo a todas las funciones profesionales de entrenamiento autónomo. ¡Lera tu físico al límite!'
            : 'Tu cuenta gratuita para entrenar de forma autónoma. Planifica, registra tus rutinas y visualiza tus marcas en cualquier momento.',
          accent: '#00d4ff'
        },
        {
          title: '🧠 SMART COACH',
          emoji: '🧠',
          description: isPremium
            ? '¡Desbloqueado! El Smart Coach analiza tu rendimiento histórico y te da sugerencias en tiempo real de pesos y repeticiones para cada serie.'
            : '🔒 Bloqueado en Plan Free. Smart Coach te daría sugerencias automáticas de carga y repeticiones. Puedes actualizar a Pro para activarlo.',
          accent: '#7b2ff7'
        },
        {
          title: '⚙️ CONFIGURACIÓN DEL MOTOR',
          emoji: '⚙️',
          description: isPremium
            ? '¡Desbloqueado! Personaliza de forma avanzada tus propias reglas de sobrecarga (lineal, ondulante, descarga) por ejercicio de manera individual.'
            : '🔒 Bloqueado en Plan Free. Solo los usuarios Pro pueden guardar reglas de progresión personalizadas para automatizar las sugerencias del motor.',
          accent: '#fda4af'
        },
        {
          title: '🏆 EXPERIENCIA Y OFFLINE',
          emoji: '⚡',
          description: 'Disfruta de la calculadora 1RM, historial de PRs, sube de nivel ganando XP y registra tus entrenamientos sin conexión con la PWA.',
          accent: '#10b981'
        }
      ];
    }
  })();

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
