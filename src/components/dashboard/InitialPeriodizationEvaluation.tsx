import React, { useState, useEffect } from 'react';
import { PeriodizationConfig, PlanData } from '../../types/database.types';
import { calculate1RM } from '../../lib/periodizationEngine';

interface InitialPeriodizationEvaluationProps {
  onSave: (config: PeriodizationConfig) => void;
  onCancel: () => void;
  plan?: PlanData | null;
}

export const InitialPeriodizationEvaluation: React.FC<InitialPeriodizationEvaluationProps> = ({
  onSave,
  onCancel,
  plan
}) => {
  const [step, setStep] = useState<number>(1);

  // Step 1: Datos Fisiológicos
  const [edad, setEdad] = useState<number>(25);
  const [recuperacion, setRecuperacion] = useState<'alta' | 'media' | 'baja'>('media');
  const [objetivo, setObjetivo] = useState<'fuerza' | 'hipertrofia' | 'mantenimiento'>('hipertrofia');

  // Step 2: Puntos Débiles Mecánicos
  const [sentadillaWeak, setSentadillaWeak] = useState<'abajo' | 'mitad' | 'arriba'>('abajo');
  const [bancaWeak, setBancaWeak] = useState<'pecho' | 'mitad' | 'bloqueo'>('pecho');
  const [pesoMuertoWeak, setPesoMuertoWeak] = useState<'despegue' | 'rodillas' | 'bloqueo'>('despegue');

  // Step 3: Test 1RM (Marcas máximas)
  const [squatWeight, setSquatWeight] = useState<string>('');
  const [squatReps, setSquatReps] = useState<string>('');
  const [squatRir, setSquatRir] = useState<string>('2');

  const [benchWeight, setBenchWeight] = useState<string>('');
  const [benchReps, setBenchReps] = useState<string>('');
  const [benchRir, setBenchRir] = useState<string>('2');

  const [dlWeight, setDlWeight] = useState<string>('');
  const [dlReps, setDlReps] = useState<string>('');
  const [dlRir, setDlRir] = useState<string>('2');

  // Extra exercises from the plan or manual additions
  const [extraLifts, setExtraLifts] = useState<{ nombre: string; weight: string; reps: string; rir: string }[]>([]);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (plan && !initialized) {
      const names = new Set<string>();
      const baseLifts = ['sentadilla', 'press de banca', 'peso muerto'];
      const days = plan.trainingDays || (plan as any).dias || [];
      days.forEach((dia: any) => {
        const exercises = dia.exercises || dia.ejercicios || [];
        exercises.forEach((ej: any) => {
          if (ej.nombre) {
            const norm = ej.nombre.toLowerCase().trim();
            if (!baseLifts.some(l => norm.includes(l))) {
              names.add(ej.nombre.trim());
            }
          }
        });
      });
      
      const initialExtras = Array.from(names).map(name => ({
        nombre: name,
        weight: '',
        reps: '',
        rir: '2'
      }));
      setExtraLifts(initialExtras);
      setInitialized(true);
    }
  }, [plan, initialized]);

  const addExtraLift = () => {
    setExtraLifts(prev => [...prev, { nombre: '', weight: '', reps: '', rir: '2' }]);
  };

  // Cálculos dinámicos en vivo
  const sq1RM = calculate1RM(Number(squatWeight) || 0, Number(squatReps) || 0, Number(squatRir) || 0);
  const bp1RM = calculate1RM(Number(benchWeight) || 0, Number(benchReps) || 0, Number(benchRir) || 0);
  const dl1RM = calculate1RM(Number(dlWeight) || 0, Number(dlReps) || 0, Number(dlRir) || 0);

  const hasAny1RM = () => {
    if (sq1RM > 0 || bp1RM > 0 || dl1RM > 0) return true;
    return extraLifts.some(item => {
      const calc = calculate1RM(Number(item.weight) || 0, Number(item.reps) || 0, Number(item.rir) || 0);
      return calc > 0 && item.nombre.trim().length > 0;
    });
  };

  const themeColor = `var(--theme-primary, #00d4ff)`;

  const handleFinish = () => {
    const marcas_1rm: Record<string, number> = {};
    if (sq1RM > 0) marcas_1rm['sentadilla'] = sq1RM;
    if (bp1RM > 0) marcas_1rm['press de banca'] = bp1RM;
    if (dl1RM > 0) marcas_1rm['peso muerto'] = dl1RM;

    extraLifts.forEach(item => {
      const calc = calculate1RM(Number(item.weight) || 0, Number(item.reps) || 0, Number(item.rir) || 0);
      if (calc > 0 && item.nombre.trim()) {
        marcas_1rm[item.nombre.toLowerCase().trim()] = calc;
      }
    });

    const config: PeriodizationConfig = {
      enabled: true,
      objetivo,
      fecha_evaluacion: new Date().toISOString().split('T')[0],
      edad,
      capacidad_recuperacion: recuperacion,
      puntos_debiles: {
        sentadilla: sentadillaWeak,
        banca: bancaWeak,
        peso_muerto: pesoMuertoWeak
      },
      marcas_1rm,
      semana_actual: 1,
      total_semanas: 4, // Bloque base por defecto
      mrv_limite_alcanzado: false
    };

    onSave(config);
  };

  return (
    <div style={{
      background: 'rgba(10, 15, 30, 0.95)',
      border: `1px solid rgba(0, 212, 255, 0.15)`,
      borderRadius: '20px',
      padding: '30px 24px',
      maxWidth: '520px',
      width: '100%',
      margin: '0 auto',
      boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
      backdropFilter: 'blur(20px)',
      color: 'white',
      fontFamily: 'sans-serif'
    }}>
      {/* Stepper Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '28px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        paddingBottom: '16px'
      }}>
        <div>
          <span style={{
            fontSize: '9px',
            fontFamily: "'Orbitron', sans-serif",
            color: themeColor,
            letterSpacing: '2px',
            textTransform: 'uppercase'
          }}>
            Fase de Diagnóstico
          </span>
          <h2 style={{
            margin: '4px 0 0 0',
            fontSize: '18px',
            fontWeight: 800,
            fontFamily: "'Orbitron', sans-serif",
            letterSpacing: '1px'
          }}>
            EVALUACIÓN INICIAL
          </h2>
        </div>
        <div style={{
          fontFamily: "'Orbitron', sans-serif",
          fontSize: '11px',
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          padding: '6px 12px',
          borderRadius: '20px'
        }}>
          Paso {step} de 3
        </div>
      </div>

      {/* STEP 1: Datos Fisiológicos */}
      {step === 1 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <p style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.65)', lineHeight: '1.6', margin: 0 }}>
            Para programar tu volumen inicial y gestionar la fatiga acumulada, necesitamos conocer tu objetivo, tu edad y cómo evalúas tu descanso general.
          </p>

          {/* BUG-03 fix: Selector de Objetivo de Entrenamiento */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '11px', fontWeight: 700, color: themeColor, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              ¿Cuál es tu objetivo principal?
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
              {([
                { key: 'hipertrofia', label: 'Hipertrofia', desc: 'Ganar masa muscular' },
                { key: 'fuerza', label: 'Fuerza', desc: 'Mover más peso' },
                { key: 'mantenimiento', label: 'Mantener', desc: 'Conservar lo logrado' }
              ] as const).map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setObjetivo(opt.key)}
                  style={{
                    background: objetivo === opt.key ? themeColor : 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid ' + (objetivo === opt.key ? themeColor : 'rgba(255, 255, 255, 0.08)'),
                    color: objetivo === opt.key ? '#000' : 'white',
                    padding: '12px 6px',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    fontSize: '10px',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    fontFamily: "'Orbitron', sans-serif",
                    transition: 'all 0.2s ease',
                    boxShadow: objetivo === opt.key ? `0 0 10px rgba(0, 212, 255, 0.3)` : 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <span>{opt.label}</span>
                  <span style={{ fontSize: '8px', fontWeight: 400, opacity: 0.7, fontFamily: 'sans-serif', textTransform: 'none' }}>{opt.desc}</span>
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(255, 255, 255, 0.5)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              ¿Qué edad tienes?
            </label>
            <input
              type="number"
              value={edad}
              onChange={(e) => setEdad(Math.max(12, Math.min(90, parseInt(e.target.value) || 25)))}
              style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '10px',
                color: 'white',
                padding: '12px',
                fontSize: '14px',
                width: '100%',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <label style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(255, 255, 255, 0.5)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Capacidad de recuperación general
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
              {(['baja', 'media', 'alta'] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRecuperacion(r)}
                  style={{
                    background: recuperacion === r ? themeColor : 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid ' + (recuperacion === r ? themeColor : 'rgba(255, 255, 255, 0.08)'),
                    color: recuperacion === r ? '#000' : 'white',
                    padding: '12px 6px',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    fontSize: '11px',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    fontFamily: "'Orbitron', sans-serif",
                    transition: 'all 0.2s ease',
                    boxShadow: recuperacion === r ? `0 0 10px rgba(0, 212, 255, 0.3)` : 'none'
                  }}
                >
                  {r}
                </button>
              ))}
            </div>
            <span style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.4)', lineHeight: '1.4' }}>
              * Selecciona 'alta' si duermes 8+ horas y tienes bajo estrés diario. Selecciona 'baja' si tienes problemas de sueño o trabajo muy demandante.
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px' }}>
            <button
              onClick={onCancel}
              style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: '13px' }}
            >
              Cancelar
            </button>
            <button
              onClick={() => setStep(2)}
              style={{
                background: themeColor,
                border: 'none',
                color: '#000',
                fontWeight: 800,
                fontSize: '12px',
                fontFamily: "'Orbitron', sans-serif",
                padding: '12px 24px',
                borderRadius: '10px',
                cursor: 'pointer',
                letterSpacing: '1px'
              }}
            >
              Siguiente Paso
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: Puntos Débiles Mecánicos */}
      {step === 2 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <p style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.65)', lineHeight: '1.6', margin: 0 }}>
            Identifica en qué parte del recorrido sueles fallar cuando estás cerca de tu límite. Esto programará accesorios específicos para reforzar tus debilidades mecánicas.
          </p>

          {/* Sentadilla */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '11px', fontWeight: 700, color: themeColor, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Sentadilla: ¿Dónde fallas?
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
              {([
                { key: 'abajo', label: 'Fase Profunda' },
                { key: 'mitad', label: 'Punto Medio' },
                { key: 'arriba', label: 'Cerca del Bloqueo' }
              ] as const).map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setSentadillaWeak(opt.key)}
                  style={{
                    background: sentadillaWeak === opt.key ? 'rgba(0, 212, 255, 0.12)' : 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid ' + (sentadillaWeak === opt.key ? themeColor : 'rgba(255, 255, 255, 0.08)'),
                    color: 'white',
                    padding: '10px 4px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '11px',
                    fontWeight: 600,
                    transition: 'all 0.2s ease'
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Press de Banca */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '11px', fontWeight: 700, color: themeColor, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Press de Banca: ¿Dónde fallas?
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
              {([
                { key: 'pecho', label: 'Al salir del pecho' },
                { key: 'mitad', label: 'Mitad de camino' },
                { key: 'bloqueo', label: 'Cerrando el codo' }
              ] as const).map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setBancaWeak(opt.key)}
                  style={{
                    background: bancaWeak === opt.key ? 'rgba(0, 212, 255, 0.12)' : 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid ' + (bancaWeak === opt.key ? themeColor : 'rgba(255, 255, 255, 0.08)'),
                    color: 'white',
                    padding: '10px 4px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '11px',
                    fontWeight: 600,
                    transition: 'all 0.2s ease'
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Peso Muerto */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '11px', fontWeight: 700, color: themeColor, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Peso Muerto: ¿Dónde fallas?
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
              {([
                { key: 'despegue', label: 'Despegue del suelo' },
                { key: 'rodillas', label: 'Nivel de rodillas' },
                { key: 'bloqueo', label: 'Bloqueo arriba' }
              ] as const).map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setPesoMuertoWeak(opt.key)}
                  style={{
                    background: pesoMuertoWeak === opt.key ? 'rgba(0, 212, 255, 0.12)' : 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid ' + (pesoMuertoWeak === opt.key ? themeColor : 'rgba(255, 255, 255, 0.08)'),
                    color: 'white',
                    padding: '10px 4px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '11px',
                    fontWeight: 600,
                    transition: 'all 0.2s ease'
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px' }}>
            <button
              onClick={() => setStep(1)}
              style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: '13px' }}
            >
              Atrás
            </button>
            <button
              onClick={() => setStep(3)}
              style={{
                background: themeColor,
                border: 'none',
                color: '#000',
                fontWeight: 800,
                fontSize: '12px',
                fontFamily: "'Orbitron', sans-serif",
                padding: '12px 24px',
                borderRadius: '10px',
                cursor: 'pointer',
                letterSpacing: '1px'
              }}
            >
              Siguiente Paso
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: Test de 1RM */}
      {step === 3 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <p style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.65)', lineHeight: '1.6', margin: 0 }}>
            Ingresa tu mejor levantamiento reciente en los tres grandes movimientos. Calcularemos tu 1RM estimado en tiempo real para calibrar tus cargas del bloque.
          </p>

          {/* Sentadilla Levantamiento */}
          <div style={{ background: 'rgba(255, 255, 255, 0.01)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '12px', padding: '14px' }}>
            <div style={{ fontSize: '11px', fontWeight: 800, fontFamily: "'Orbitron', sans-serif", color: themeColor, marginBottom: '10px', letterSpacing: '0.5px' }}>
              SENTADILLA
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr', gap: '8px', alignItems: 'center' }}>
              <input
                type="number"
                placeholder="Peso (KG)"
                value={squatWeight}
                onChange={(e) => setSquatWeight(e.target.value)}
                style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '8px', color: 'white', padding: '8px', fontSize: '12px' }}
              />
              <input
                type="number"
                placeholder="Reps"
                value={squatReps}
                onChange={(e) => setSquatReps(e.target.value)}
                style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '8px', color: 'white', padding: '8px', fontSize: '12px' }}
              />
              <select
                value={squatRir}
                onChange={(e) => setSquatRir(e.target.value)}
                style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '8px', color: 'white', padding: '8px', fontSize: '12px' }}
              >
                <option value="0">RIR 0 (Fallo)</option>
                <option value="1">RIR 1</option>
                <option value="2">RIR 2</option>
                <option value="3">RIR 3</option>
                <option value="4">RIR 4+</option>
              </select>
            </div>
            {sq1RM > 0 && (
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginTop: '8px', fontFamily: "'Orbitron', sans-serif" }}>
                1RM estimado: <strong style={{ color: 'white' }}>{sq1RM} kg</strong>
              </div>
            )}
          </div>

          {/* Press de Banca Levantamiento */}
          <div style={{ background: 'rgba(255, 255, 255, 0.01)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '12px', padding: '14px' }}>
            <div style={{ fontSize: '11px', fontWeight: 800, fontFamily: "'Orbitron', sans-serif", color: themeColor, marginBottom: '10px', letterSpacing: '0.5px' }}>
              PRESS DE BANCA
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr', gap: '8px', alignItems: 'center' }}>
              <input
                type="number"
                placeholder="Peso (KG)"
                value={benchWeight}
                onChange={(e) => setBenchWeight(e.target.value)}
                style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '8px', color: 'white', padding: '8px', fontSize: '12px' }}
              />
              <input
                type="number"
                placeholder="Reps"
                value={benchReps}
                onChange={(e) => setBenchReps(e.target.value)}
                style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '8px', color: 'white', padding: '8px', fontSize: '12px' }}
              />
              <select
                value={benchRir}
                onChange={(e) => setBenchRir(e.target.value)}
                style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '8px', color: 'white', padding: '8px', fontSize: '12px' }}
              >
                <option value="0">RIR 0 (Fallo)</option>
                <option value="1">RIR 1</option>
                <option value="2">RIR 2</option>
                <option value="3">RIR 3</option>
                <option value="4">RIR 4+</option>
              </select>
            </div>
            {bp1RM > 0 && (
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginTop: '8px', fontFamily: "'Orbitron', sans-serif" }}>
                1RM estimado: <strong style={{ color: 'white' }}>{bp1RM} kg</strong>
              </div>
            )}
          </div>

          {/* Peso Muerto Levantamiento */}
          <div style={{ background: 'rgba(255, 255, 255, 0.01)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '12px', padding: '14px' }}>
            <div style={{ fontSize: '11px', fontWeight: 800, fontFamily: "'Orbitron', sans-serif", color: themeColor, marginBottom: '10px', letterSpacing: '0.5px' }}>
              PESO MUERTO
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr', gap: '8px', alignItems: 'center' }}>
              <input
                type="number"
                placeholder="Peso (KG)"
                value={dlWeight}
                onChange={(e) => setDlWeight(e.target.value)}
                style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '8px', color: 'white', padding: '8px', fontSize: '12px' }}
              />
              <input
                type="number"
                placeholder="Reps"
                value={dlReps}
                onChange={(e) => setDlReps(e.target.value)}
                style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '8px', color: 'white', padding: '8px', fontSize: '12px' }}
              />
              <select
                value={dlRir}
                onChange={(e) => setDlRir(e.target.value)}
                style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '8px', color: 'white', padding: '8px', fontSize: '12px' }}
              >
                <option value="0">RIR 0 (Fallo)</option>
                <option value="1">RIR 1</option>
                <option value="2">RIR 2</option>
                <option value="3">RIR 3</option>
                <option value="4">RIR 4+</option>
              </select>
            </div>
            {dl1RM > 0 && (
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginTop: '8px', fontFamily: "'Orbitron', sans-serif" }}>
                1RM estimado: <strong style={{ color: 'white' }}>{dl1RM} kg</strong>
              </div>
            )}
          </div>

          {/* Ejercicios del Plan / Adicionales */}
          {extraLifts.length > 0 && (
            <div style={{ marginTop: '10px' }}>
              <div style={{ fontSize: '12px', fontWeight: 800, fontFamily: "'Orbitron', sans-serif", color: 'rgba(255,255,255,0.7)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                Otros Ejercicios del Plan
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxHeight: '280px', overflowY: 'auto', paddingRight: '4px' }}>
                {extraLifts.map((item, idx) => {
                  const calculated = calculate1RM(Number(item.weight) || 0, Number(item.reps) || 0, Number(item.rir) || 0);
                  return (
                    <div key={idx} style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '14px', position: 'relative' }}>
                      <button
                        type="button"
                        onClick={() => {
                          setExtraLifts(prev => prev.filter((_, i) => i !== idx));
                        }}
                        style={{
                          position: 'absolute',
                          top: '10px',
                          right: '10px',
                          background: 'none',
                          border: 'none',
                          color: '#ff4d4d',
                          cursor: 'pointer',
                          fontSize: '14px',
                          padding: '4px',
                          lineHeight: 1,
                          opacity: 0.7,
                          transition: 'opacity 0.2s'
                        }}
                        title="Eliminar ejercicio"
                        onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                        onMouseLeave={(e) => e.currentTarget.style.opacity = '0.7'}
                      >
                        🗑️
                      </button>
                      
                      <div style={{ marginBottom: '10px', paddingRight: '20px' }}>
                        <input
                          type="text"
                          value={item.nombre}
                          placeholder="Nombre del ejercicio..."
                          onChange={(e) => {
                            const newName = e.target.value;
                            setExtraLifts(prev => prev.map((item, i) => i === idx ? { ...item, nombre: newName } : item));
                          }}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            borderBottom: '1px solid rgba(255,255,255,0.1)',
                            fontSize: '11px',
                            fontWeight: 800,
                            fontFamily: "'Orbitron', sans-serif",
                            color: themeColor,
                            letterSpacing: '0.5px',
                            width: '100%',
                            padding: '4px 0',
                            outline: 'none'
                          }}
                        />
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr', gap: '8px', alignItems: 'center' }}>
                        <input
                          type="number"
                          placeholder="Peso (KG)"
                          value={item.weight}
                          onChange={(e) => {
                            const newW = e.target.value;
                            setExtraLifts(prev => prev.map((item, i) => i === idx ? { ...item, weight: newW } : item));
                          }}
                          style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '8px', color: 'white', padding: '8px', fontSize: '12px' }}
                        />
                        <input
                          type="number"
                          placeholder="Reps"
                          value={item.reps}
                          onChange={(e) => {
                            const newR = e.target.value;
                            setExtraLifts(prev => prev.map((item, i) => i === idx ? { ...item, reps: newR } : item));
                          }}
                          style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '8px', color: 'white', padding: '8px', fontSize: '12px' }}
                        />
                        <select
                          value={item.rir}
                          onChange={(e) => {
                            const newRir = e.target.value;
                            setExtraLifts(prev => prev.map((item, i) => i === idx ? { ...item, rir: newRir } : item));
                          }}
                          style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '8px', color: 'white', padding: '8px', fontSize: '12px' }}
                        >
                          <option value="0">RIR 0 (Fallo)</option>
                          <option value="1">RIR 1</option>
                          <option value="2">RIR 2</option>
                          <option value="3">RIR 3</option>
                          <option value="4">RIR 4+</option>
                        </select>
                      </div>
                      {calculated > 0 && (
                        <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginTop: '8px', fontFamily: "'Orbitron', sans-serif" }}>
                          1RM estimado: <strong style={{ color: 'white' }}>{calculated} kg</strong>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={addExtraLift}
            style={{
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px dashed rgba(255, 255, 255, 0.2)',
              borderRadius: '10px',
              color: 'white',
              padding: '12px',
              fontSize: '11px',
              fontWeight: 800,
              fontFamily: "'Orbitron', sans-serif",
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'all 0.2s',
              marginTop: '5px'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
              e.currentTarget.style.borderColor = themeColor;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
            }}
          >
            ➕ Agregar otro ejercicio para calcular 1RM
          </button>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px' }}>
            <button
              onClick={() => setStep(2)}
              style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: '13px' }}
            >
              Atrás
            </button>
            {/* BUG-10 fix: Show validation message when no 1RM data entered */}
            {!hasAny1RM() ? (
              <span style={{ fontSize: '10px', color: 'rgba(255, 120, 120, 0.8)', fontFamily: "'Orbitron', sans-serif", letterSpacing: '0.5px' }}>
                Ingresa al menos un levantamiento
              </span>
            ) : (
              <button
                onClick={handleFinish}
                style={{
                  background: 'linear-gradient(135deg, var(--theme-primary, #00d4ff), var(--theme-secondary, #0070a0))',
                  border: 'none',
                  color: '#fff',
                  fontWeight: 800,
                  fontSize: '12px',
                  fontFamily: "'Orbitron', sans-serif",
                  padding: '12px 28px',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  letterSpacing: '1px',
                  boxShadow: '0 4px 15px rgba(0, 212, 255, 0.25)'
                }}
              >
                Finalizar Diagnóstico
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
