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
          title: '📋 PLANIFICADOR DE RUTINAS EN DETALLE',
          emoji: '📋',
          description: 'Al planificar una rutina para un atleta o para ti mismo, puedes estructurar: 1) Días y Ejercicios: Agrega y organiza movimientos específicos por grupo muscular. 2) Series, Repeticiones e Intensidad: Configura el RIR (Repeticiones en Reserva) u objetivo de RPE para controlar el nivel de esfuerzo real y fatiga de cada serie. 3) Regla de Juego: Asocia el plan a un esquema de progresión matemática (lineal, ondulante, descarga) adaptado a cada ejercicio individualmente. 4) Enlaces de Video y Notas: Adjunta guías de ejecución técnica para asegurar una técnica perfecta.',
          accent: '#7b2ff7'
        },
        {
          title: '⚙️ MOTOR DE SOBRECARGA INDIVIDUAL',
          emoji: '⚙️',
          description: 'Personaliza de forma individualizada cómo debe actuar el motor ante estancamientos, progresiones lineales, ondulantes o descargas para cada ejercicio y atleta. Define la cantidad exacta de peso a incrementar, el porcentaje de descarga o las variables de volumen en el panel de configuración de reglas.',
          accent: '#fda4af'
        },
        {
          title: '🔔 AUDITORÍA Y ALERTAS PUSH',
          emoji: '🔔',
          description: 'Mantente al tanto de la fatiga extrema, racha e incrementos de carga de tus atletas. Activa las notificaciones push en tu dispositivo para recibir alertas al instante en cuanto un alumno complete una sesión o requiera asistencia por estancamiento.',
          accent: '#10b981'
        },
        {
          title: '👥 GESTIÓN Y VINCULACIÓN DE ATLETAS',
          emoji: '👥',
          description: 'Controla el volumen de entrenamiento semanal, las marcas históricas, los récords personales (PRs) y las vigencias de tus alumnos de forma ágil desde un panel consolidado de alto rendimiento.',
          accent: '#eab308'
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
          title: '📝 REGISTRO DE SESIÓN: TU PASO MÁS IMPORTANTE',
          emoji: '📝',
          description: 'Al entrenar, sigue estos pasos: 1) Marca tus series completadas presionando el checkbox al finalizar cada una. 2) Ajusta Carga/Reps: Si realizaste un esfuerzo diferente al planeado, modifica el peso y repeticiones en tiempo real. 3) Registra tu RIR: Indica tus repeticiones en reserva (qué tan cerca estuviste del fallo). IMPORTANCIA VITAL: Cada registro alimenta el motor del Smart Coach para sugerir pesos precisos la próxima sesión, calcula tu 1RM estimado, actualiza tus estadísticas históricas y te otorga XP para subir de nivel.',
          accent: '#7b2ff7'
        },
        {
          title: '🧠 SMART COACH',
          emoji: '🧠',
          description: 'Obtén sugerencias automáticas de cargas y repeticiones en tiempo real en la pantalla de entrenamiento, basadas en tu rendimiento real previo y en la configuración de sobrecarga definida por tu entrenador.',
          accent: '#fda4af'
        },
        {
          title: '🏆 TU PROGRESO Y LOGROS',
          emoji: '🏆',
          description: 'Gana puntos de experiencia (XP) por cada serie completada y sube de nivel como atleta. Desbloquea insignias de constancia e intensidad y logros personalizados diseñados exclusivamente por tu entrenador.',
          accent: '#eab308'
        },
        {
          title: '🔌 ENTRENAMIENTO OFFLINE Y PWA',
          emoji: '⚡',
          description: '¿Mala señal en el gimnasio? La PWA guarda tus registros de manera local en tu dispositivo y los sincroniza automáticamente en la nube cuando recuperes internet, asegurando que nunca pierdas un entrenamiento.',
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
            ? 'Tienes acceso ILIMITADO y completo a todas las funciones profesionales de entrenamiento autónomo. ¡Leva tu físico al límite!'
            : 'Tu cuenta gratuita para entrenar de forma autónoma. Planifica, registra tus rutinas y visualiza tus marcas en cualquier momento.',
          accent: '#00d4ff'
        },
        {
          title: '📝 REGISTRO DE SESIÓN: TU PASO MÁS IMPORTANTE',
          emoji: '📝',
          description: 'Registrar tu entrenamiento es vital: 1) Marca tus series: Pulsa el checkbox de cada serie ejecutada. 2) Ajusta Carga/Reps: Modifica los valores reales levantados para que coincidan con tu esfuerzo real. 3) Indica el RIR: Registra tu nivel de esfuerzo percibido. IMPORTANCIA VITAL: Este registro calcula tu 1RM dinámico, alimenta tus gráficos históricos de volumen y constancia, le da la información necesaria al Smart Coach (Pro) para tus próximas progresiones y te otorga XP para subir de nivel.',
          accent: '#7b2ff7'
        },
        {
          title: '🧠 SMART COACH',
          emoji: '🧠',
          description: isPremium
            ? '¡Desbloqueado! El Smart Coach analiza tu rendimiento histórico y te da sugerencias en tiempo real de pesos y repeticiones para cada serie al iniciar tu sesión.'
            : '🔒 Bloqueado en Plan Free. Smart Coach te sugeriría cargas y repeticiones automáticas basadas en tu historial de RIR para evitar estancamientos de manera científica. Adquiere el plan Solo Lifter Pro para desbloquearlo.',
          accent: '#fda4af'
        },
        {
          title: '⚙️ CONFIGURACIÓN DEL MOTOR',
          emoji: '⚙️',
          description: isPremium
            ? '¡Desbloqueado! Personaliza de forma avanzada tus propias reglas de sobrecarga (lineal, ondulante, descarga) por ejercicio de manera individual y automatiza tu progresión.'
            : '🔒 Bloqueado en Plan Free. Los usuarios Pro pueden automatizar y personalizar reglas avanzadas de progresión por ejercicio de forma individual. Actualiza a Solo Lifter Pro para activarlo.',
          accent: '#eab308'
        },
        {
          title: '🏆 RENDIMIENTO Y OFFLINE',
          emoji: '⚡',
          description: 'Disfruta de la calculadora 1RM, historial de PRs, sube de nivel acumulando XP y registra tus entrenamientos sin conexión gracias al modo offline de la PWA.',
          accent: '#10b981'
        }
      ];
    }
  })();

  const handleNext = () => {
    if (step < stepsData.length) {
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
          {stepsData.map((_, idx) => {
            const s = idx + 1;
            return (
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
            );
          })}
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
          minHeight: '110px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'left'
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
          {step === stepsData.length ? 'COMENZAR' : 'SIGUIENTE'}
        </button>
      </div>
    </div>
  );
};

export default OnboardingModal;
