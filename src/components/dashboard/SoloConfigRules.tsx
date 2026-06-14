import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { useSupabase } from '../../context/SupabaseContext';
import { PlanData, Rule } from '../../types/database.types';
import { DEFAULT_RULES } from '../../lib/rules';
import AthleteNavbar from '../common/AthleteNavbar';
import Toast from '../common/Toast';

/* ── NumberStepper (inline [−] value [+]) ── */

interface NumberStepperProps {
  value: number;
  min: number;
  max: number;
  onChange: (val: number) => void;
}

const NumberStepper: React.FC<NumberStepperProps> = ({ value, min, max, onChange }) => {
  const handleDecrement = () => {
    if (value > min) onChange(value - 1);
  };

  const handleIncrement = () => {
    if (value < max) onChange(value + 1);
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.25)', border: '1px solid var(--theme-border)', borderRadius: '8px', overflow: 'hidden', height: '42px', width: '100%', maxWidth: '240px' }}>
      <button
        type="button"
        onClick={handleDecrement}
        disabled={value <= min}
        style={{
          width: '50px',
          height: '100%',
          background: 'rgba(255,255,255,0.01)',
          border: 'none',
          borderRight: '1px solid var(--theme-border)',
          color: value <= min ? 'rgba(255,255,255,0.15)' : 'var(--theme-primary)',
          fontSize: '20px',
          fontWeight: 'bold',
          cursor: value <= min ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.2s ease',
          outline: 'none',
          userSelect: 'none',
          touchAction: 'manipulation'
        }}
        onMouseEnter={(e) => {
          if (value > min) e.currentTarget.style.background = 'rgba(0, 212, 255, 0.08)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'rgba(255,255,255,0.01)';
        }}
      >
        −
      </button>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => {
          const val = parseInt(e.target.value, 10);
          if (!isNaN(val)) {
            onChange(Math.max(min, Math.min(max, val)));
          }
        }}
        style={{
          flex: 1,
          background: 'transparent',
          border: 'none',
          color: 'white',
          textAlign: 'center',
          fontSize: '15px',
          fontWeight: '700',
          fontFamily: "'Orbitron', sans-serif",
          width: '50px',
          height: '100%',
          outline: 'none',
          padding: 0
        }}
      />
      <button
        type="button"
        onClick={handleIncrement}
        disabled={value >= max}
        style={{
          width: '50px',
          height: '100%',
          background: 'rgba(255,255,255,0.01)',
          border: 'none',
          borderLeft: '1px solid var(--theme-border)',
          color: value >= max ? 'rgba(255,255,255,0.15)' : 'var(--theme-primary)',
          fontSize: '20px',
          fontWeight: 'bold',
          cursor: value >= max ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.2s ease',
          outline: 'none',
          userSelect: 'none',
          touchAction: 'manipulation'
        }}
        onMouseEnter={(e) => {
          if (value < max) e.currentTarget.style.background = 'rgba(0, 212, 255, 0.08)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'rgba(255,255,255,0.01)';
        }}
      >
        +
      </button>
    </div>
  );
};

/* ── AddExceptionForm (for reps_por_ejercicio) ── */

interface AddExceptionFormProps {
  onAdd: (name: string, reps: number) => void;
}

const AddExceptionForm: React.FC<AddExceptionFormProps> = ({ onAdd }) => {
  const [exName, setExName] = useState('');
  const [reps, setReps] = useState(10);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!exName.trim()) return;
    onAdd(exName.trim(), reps);
    setExName('');
  };

  return (
    <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '8px', flexWrap: 'wrap' }}>
      <input
        type="text"
        placeholder="Nombre del ejercicio..."
        value={exName}
        onChange={(e) => setExName(e.target.value)}
        style={{
          flex: '1 1 200px',
          background: 'rgba(0, 0, 0, 0.35)',
          border: '1px solid var(--theme-border)',
          color: 'white',
          padding: '10px 14px',
          borderRadius: '8px',
          fontSize: '12px',
          outline: 'none',
          height: '40px',
          boxSizing: 'border-box'
        }}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '1 0 auto', justifyContent: 'flex-start' }}>
        <input
          type="number"
          min="1"
          value={reps}
          onChange={(e) => setReps(parseInt(e.target.value, 10))}
          style={{
            width: '65px',
            background: 'rgba(0, 0, 0, 0.35)',
            border: '1px solid var(--theme-border)',
            color: 'white',
            padding: '10px',
            borderRadius: '8px',
            fontSize: '12px',
            outline: 'none',
            textAlign: 'center',
            height: '40px',
            boxSizing: 'border-box'
          }}
        />
        <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>Reps</span>
        <button
          type="button"
          onClick={handleSubmit}
          className="btn btn-ghost"
          style={{
            padding: '0 16px',
            fontSize: '11px',
            whiteSpace: 'nowrap',
            border: '1px solid var(--theme-border)',
            background: 'var(--theme-badge-bg)',
            height: '40px',
            borderRadius: '8px',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxSizing: 'border-box',
            transition: 'all 0.2s',
            color: 'white'
          }}
        >
          Agregar
        </button>
      </div>
    </div>
  );
};

/* ── Rule type badge colours ── */

const TIPO_COLORS: Record<string, string> = {
  subir: '#22c55e',
  bajar: '#ef4444',
  mantener: '#eab308',
  info: '#3b82f6',
  descanso: '#f97316',
  cambio: '#a855f7'
};

const TIPO_LABELS: Record<string, string> = {
  subir: 'SUBIR',
  bajar: 'BAJAR',
  mantener: 'MANTENER',
  info: 'INFO',
  descanso: 'DESCANSO',
  cambio: 'CAMBIO'
};

/* ── Param input inline style ── */

const paramInputStyle: React.CSSProperties = {
  background: 'rgba(0, 0, 0, 0.35)',
  border: '1px solid var(--theme-border)',
  borderRadius: '6px',
  color: 'white',
  padding: '8px',
  fontSize: '12px'
};

const paramLabelStyle: React.CSSProperties = {
  fontSize: '10px',
  color: 'rgba(255,255,255,0.5)',
  fontWeight: 600
};

/* ════════════════════════════════════════════
   SoloConfigRules — Solo Lifter Rule Configurator
   ════════════════════════════════════════════ */

export const SoloConfigRules: React.FC = () => {
  const navigate = useNavigate();
  const { user, profile, isSoloClient } = useSupabase();

  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [existingPlan, setExistingPlan] = useState<any>(null);
  const [noPlan, setNoPlan] = useState<boolean>(false);

  const DEFAULT_CONFIG = {
    minSesiones: 3,
    ventana: 4,
    diasDescansoExcesivo: 14,
    diasOptimo: 7,
    sesionesRegresionAlerta: 3,
    semanasEstancamiento: 5
  };

  const [trackerConfig, setTrackerConfig] = useState<any>(DEFAULT_CONFIG);
  const [trackerRules, setTrackerRules] = useState<Rule[]>([]);

  const [toastState, setToastState] = useState<{ visible: boolean; message: string; type: 'success' | 'error' | 'info' }>({
    visible: false,
    message: '',
    type: 'success',
  });

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastState({ visible: true, message, type });
    setTimeout(() => {
      setToastState((prev) => ({ ...prev, visible: false }));
    }, 3000);
  };

  /* ── Merge saved rules with defaults so new rules get added ── */
  const mergeRules = (saved: any[] | undefined, defaults: Rule[]): Rule[] => {
    if (!saved || saved.length === 0) return defaults.map(r => ({ ...r }));
    const existingMap = new Map(saved.map((r: any) => [r.id, r]));
    return defaults.map(defaultRule => {
      if (existingMap.has(defaultRule.id)) {
        return { ...defaultRule, ...existingMap.get(defaultRule.id) };
      }
      return { ...defaultRule };
    });
  };

  /* ── Redirect if not solo client ── */
  useEffect(() => {
    if (user && isSoloClient === false) {
      navigate('/dashboard');
    }
  }, [user, isSoloClient, navigate]);

  /* ── Load own active plan on mount ── */
  useEffect(() => {
    const loadOwnPlan = async () => {
      if (!user) return;

      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('planes')
          .select('*')
          .eq('cliente_id', user.id)
          .eq('activo', true)
          .maybeSingle();

        if (error) throw error;

        if (data && data.datos_plan) {
          setExistingPlan(data);
          const p = data.datos_plan as PlanData;
          setTrackerConfig({ ...DEFAULT_CONFIG, ...(p.trackerConfig || {}) });
          setTrackerRules(mergeRules(p.trackerRules as any[] | undefined, DEFAULT_RULES));
          setNoPlan(false);
        } else {
          setExistingPlan(null);
          setTrackerConfig(DEFAULT_CONFIG);
          setTrackerRules(DEFAULT_RULES.map(r => ({ ...r })));
          setNoPlan(true);
        }
      } catch (err: any) {
        console.error('Error al cargar plan propio:', err);
        showToast('Error al cargar tu plan: ' + err.message, 'error');
      } finally {
        setLoading(false);
      }
    };

    loadOwnPlan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  /* ── Handlers ── */
  const handleConfigChange = (field: string, val: number) => {
    setTrackerConfig((prev: any) => ({ ...prev, [field]: val }));
  };

  const handleRuleToggle = (idx: number) => {
    setTrackerRules(prev => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], activa: !copy[idx].activa };
      return copy;
    });
  };

  const handleRuleChange = (idx: number, field: string, val: any) => {
    setTrackerRules(prev => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: val };
      return copy;
    });
  };

  const handleResetDefaults = () => {
    if (window.confirm('¿Seguro que deseas restaurar todos los parámetros y mensajes a sus valores por defecto?')) {
      setTrackerConfig(DEFAULT_CONFIG);
      setTrackerRules(DEFAULT_RULES.map(r => ({ ...r })));
      showToast('Valores restablecidos por defecto.', 'info');
    }
  };

  const handleSave = async () => {
    if (isSoloClient && profile?.suscripcion_plan !== 'premium') {
      showToast('⚠️ La personalización de reglas de sobrecarga es exclusiva de Solo Lifter Pro.', 'error');
      return;
    }

    if (!existingPlan) {
      showToast('No hay un plan activo para guardar la configuración.', 'error');
      return;
    }

    setSaving(true);
    showToast('Guardando configuración...', 'info');

    try {
      const updatedDatosPlan = {
        ...existingPlan.datos_plan,
        trackerConfig,
        trackerRules
      };

      const { error } = await supabase
        .from('planes')
        .update({ datos_plan: updatedDatosPlan })
        .eq('id', existingPlan.id);

      if (error) throw error;

      // Update local state
      setExistingPlan((prev: any) => ({ ...prev, datos_plan: updatedDatosPlan }));

      // Cache updated plan to localStorage
      try {
        const cachedPlan = { ...existingPlan, datos_plan: updatedDatosPlan };
        localStorage.setItem('pwa_client_plan', JSON.stringify(cachedPlan));
      } catch (e) {
        console.warn('No se pudo cachear el plan:', e);
      }

      showToast('¡Motor de sobrecarga guardado con éxito! 🚀', 'success');
    } catch (err: any) {
      console.error('Error al guardar configuración:', err);
      showToast('Error al guardar: ' + err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  /* ── Render ── */
  return (
    <div style={{ background: 'transparent', minHeight: '100vh', color: 'white', paddingBottom: '100px' }}>
      <AthleteNavbar />

      {/* HEADER */}
      <div style={{ marginBottom: '20px', padding: '12px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px', maxWidth: '800px', margin: '0 auto', padding: '0 20px' }}>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={() => navigate('/dashboard')}
              style={{
                background: 'none',
                border: '1px solid var(--theme-border)',
                color: 'var(--theme-primary)',
                fontSize: '12px',
                cursor: 'pointer',
                fontFamily: "'Orbitron', sans-serif",
                padding: '8px 12px',
                borderRadius: '8px'
              }}
            >
              ← Volver
            </button>
            <div>
              <h1 style={{ fontFamily: "'Orbitron', sans-serif", fontSize: '15px', fontWeight: 800, margin: 0, letterSpacing: '1px', background: 'var(--theme-btn-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                ⚙️ MOTOR DE SOBRECARGA
              </h1>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginTop: '2px' }}>
                Configura las reglas de tu progresión personal
              </div>
            </div>
          </div>

          {!noPlan && (
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={handleSave}
                disabled={saving}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '10px 20px',
                  background: 'var(--theme-btn-gradient)',
                  boxShadow: '0 0 15px var(--theme-btn-glow)',
                  border: 'none',
                  borderRadius: '30px',
                  color: 'white',
                  fontFamily: "'Orbitron', sans-serif",
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: saving ? 'not-allowed' : 'pointer',
                  transition: 'all 0.3s ease',
                  opacity: saving ? 0.7 : 1,
                  letterSpacing: '0.5px'
                }}
              >
                {saving ? (
                  <>
                    <span style={{ width: '14px', height: '14px', borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid var(--theme-primary)', animation: 'spin 1s linear infinite', display: 'inline-block' }} />
                    <span>GUARDANDO...</span>
                  </>
                ) : (
                  <span>✓ GUARDAR CONFIGURACIÓN</span>
                )}
              </button>
            </div>
          )}

        </div>
      </div>

      <div className="container stagger-3" style={{ padding: '0 20px', maxWidth: '800px', margin: '0 auto' }}>

        {/* Loading state */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '60px', color: 'var(--theme-primary)', fontFamily: "'Orbitron', sans-serif" }}>
            <span>Cargando tu motor de progresión...</span>
          </div>
        )}

        {/* No plan state */}
        {!loading && noPlan && (
          <div style={{
            background: 'var(--theme-card-bg)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid var(--theme-border)',
            borderRadius: '16px',
            padding: '40px 24px',
            textAlign: 'center',
            boxShadow: '0 8px 32px 0 var(--theme-glow)'
          }}>
            <div style={{ fontSize: '40px', marginBottom: '16px' }}>📋</div>
            <h3 style={{ fontFamily: "'Orbitron', sans-serif", fontSize: '14px', fontWeight: 700, marginBottom: '10px', color: 'white' }}>
              SIN PLAN ACTIVO
            </h3>
            <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', marginBottom: '20px', lineHeight: 1.6 }}>
              Primero crea un plan en Quick Start para poder configurar tu motor de sobrecarga progresiva.
            </p>
            <button
              onClick={() => navigate('/solo/planner')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '12px 24px',
                background: 'var(--theme-btn-gradient)',
                boxShadow: '0 0 15px var(--theme-btn-glow)',
                border: 'none',
                borderRadius: '30px',
                color: 'white',
                fontFamily: "'Orbitron', sans-serif",
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                letterSpacing: '0.5px'
              }}
            >
              🚀 IR A QUICK START
            </button>
          </div>
        )}

        {/* Main content */}
        {!loading && !noPlan && (
          <>
            {/* ═══ SECTION 1: GENERAL PARAMETERS ═══ */}
            <div style={{
              background: 'var(--theme-card-bg)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: '1px solid var(--theme-border)',
              borderRadius: '16px',
              padding: '24px',
              marginBottom: '24px',
              boxShadow: '0 8px 32px 0 var(--theme-glow)'
            }}>
              <h3 style={{ fontFamily: "'Orbitron', sans-serif", fontSize: '13px', color: 'var(--theme-primary)', letterSpacing: '0.5px', marginBottom: '20px', marginTop: 0 }}>
                📊 PARÁMETROS GENERALES DE ANÁLISIS
              </h3>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
                {/* minSesiones */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600 }}>Sesiones mínimas antes de alertas</label>
                  <NumberStepper
                    value={trackerConfig.minSesiones || 3}
                    min={1}
                    max={10}
                    onChange={(val) => handleConfigChange('minSesiones', val)}
                  />
                  <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', lineHeight: 1.4 }}>No se generan sugerencias si tenés menos de estas sesiones registradas por ejercicio.</span>
                </div>

                {/* ventana */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600 }}>Ventana de sesiones recientes</label>
                  <NumberStepper
                    value={trackerConfig.ventana || 4}
                    min={2}
                    max={10}
                    onChange={(val) => handleConfigChange('ventana', val)}
                  />
                  <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', lineHeight: 1.4 }}>Cuántas sesiones recientes se analizan para estimar tendencias.</span>
                </div>

                {/* diasDescansoExcesivo */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600 }}>Días sin entrenar = descanso excesivo</label>
                  <NumberStepper
                    value={trackerConfig.diasDescansoExcesivo || 14}
                    min={3}
                    max={30}
                    onChange={(val) => handleConfigChange('diasDescansoExcesivo', val)}
                  />
                  <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', lineHeight: 1.4 }}>Si pasás más de estos días sin registrar un ejercicio, se alerta descanso excesivo.</span>
                </div>

                {/* diasOptimo */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600 }}>Días óptimos entre sesiones</label>
                  <NumberStepper
                    value={trackerConfig.diasOptimo || 7}
                    min={1}
                    max={14}
                    onChange={(val) => handleConfigChange('diasOptimo', val)}
                  />
                  <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', lineHeight: 1.4 }}>Rango máximo de días considerado óptimo entre sesiones del mismo ejercicio.</span>
                </div>

                {/* sesionesRegresionAlerta */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600 }}>Sesiones de caída para alerta</label>
                  <NumberStepper
                    value={trackerConfig.sesionesRegresionAlerta || 3}
                    min={2}
                    max={6}
                    onChange={(val) => handleConfigChange('sesionesRegresionAlerta', val)}
                  />
                  <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', lineHeight: 1.4 }}>Sesiones consecutivas con caída de volumen que disparan alerta de regresión.</span>
                </div>

                {/* semanasEstancamiento */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600 }}>Semanas sin mejora = estancamiento</label>
                  <NumberStepper
                    value={trackerConfig.semanasEstancamiento || 5}
                    min={2}
                    max={12}
                    onChange={(val) => handleConfigChange('semanasEstancamiento', val)}
                  />
                  <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', lineHeight: 1.4 }}>Semanas sin mejoras en el 1RM estimado antes de sugerir variar el ejercicio.</span>
                </div>
              </div>
            </div>

            {/* ═══ SECTION 2: INDIVIDUAL RULES ═══ */}
            <div style={{
              background: 'var(--theme-card-bg)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: '1px solid var(--theme-border)',
              borderRadius: '16px',
              padding: '24px',
              marginBottom: '24px',
              boxShadow: '0 8px 32px 0 var(--theme-glow)'
            }}>
              <h3 style={{ fontFamily: "'Orbitron', sans-serif", fontSize: '13px', color: 'var(--theme-primary)', letterSpacing: '0.5px', marginBottom: '10px', marginTop: 0 }}>
                📋 REGLAS DE NOTIFICACIÓN
              </h3>
              <p style={{ margin: '0 0 20px 0', fontSize: '11px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.4 }}>
                Activa o desactiva las reglas automáticas y personaliza los textos. Podés usar las variables{' '}
                <code style={{ background: 'rgba(255,255,255,0.06)', padding: '1px 5px', borderRadius: '4px' }}>{`{ejercicio}`}</code>,{' '}
                <code style={{ background: 'rgba(255,255,255,0.06)', padding: '1px 5px', borderRadius: '4px' }}>{`{valor}`}</code>,{' '}
                <code style={{ background: 'rgba(255,255,255,0.06)', padding: '1px 5px', borderRadius: '4px' }}>{`{peso}`}</code>,{' '}
                <code style={{ background: 'rgba(255,255,255,0.06)', padding: '1px 5px', borderRadius: '4px' }}>{`{porciento}`}</code>{' '}
                en tus textos.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {trackerRules.map((rule, idx) => {
                  const tipoColor = TIPO_COLORS[rule.tipo] || '#888';
                  const tipoLabel = TIPO_LABELS[rule.tipo] || rule.tipo.toUpperCase();

                  return (
                    <div
                      key={rule.id}
                      style={{
                        background: 'var(--theme-badge-bg)',
                        border: '1px solid var(--theme-border)',
                        borderRadius: '12px',
                        padding: '20px',
                        transition: 'all 0.3s ease'
                      }}
                    >
                      {/* Rule header: title + badge + toggle */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                          <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 700, fontFamily: "'Orbitron', sans-serif", color: rule.activa ? 'white' : 'rgba(255,255,255,0.4)' }}>
                            {idx + 1}. {rule.titulo}
                          </h4>
                          <span style={{
                            display: 'inline-block',
                            padding: '2px 8px',
                            borderRadius: '20px',
                            fontSize: '9px',
                            fontWeight: 700,
                            letterSpacing: '0.5px',
                            background: `${tipoColor}20`,
                            color: tipoColor,
                            border: `1px solid ${tipoColor}40`
                          }}>
                            {tipoLabel}
                          </span>
                        </div>
                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12px' }}>
                          <input
                            type="checkbox"
                            checked={rule.activa}
                            onChange={() => handleRuleToggle(idx)}
                            style={{ cursor: 'pointer' }}
                          />
                          <span>{rule.activa ? '✅ Activa' : '❌ Desactivada'}</span>
                        </label>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {/* Editable message */}
                        <div>
                          <label style={{ display: 'block', fontSize: '10px', color: 'rgba(255,255,255,0.5)', fontWeight: 600, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>MENSAJE DE NOTIFICACIÓN</label>
                          <textarea
                            rows={2}
                            value={rule.mensaje}
                            onChange={(e) => handleRuleChange(idx, 'mensaje', e.target.value)}
                            style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', color: 'white', padding: '10px', fontSize: '12px', resize: 'vertical', boxSizing: 'border-box' }}
                          />
                        </div>

                        {/* Rule-specific parameters (only when active) */}
                        {rule.activa && (
                          <div style={{ marginTop: '8px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '15px', padding: '15px', background: 'rgba(0,0,0,0.25)', borderRadius: '8px', border: '1px solid var(--theme-border)' }}>

                            {/* subir_peso_reps */}
                            {rule.id === 'subir_peso_reps' && (
                              <>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                  <label style={paramLabelStyle}>RIR MÍNIMO PARA SUBIR</label>
                                  <input type="number" value={rule.rir_umbral !== undefined ? rule.rir_umbral : 3} onChange={(e) => handleRuleChange(idx, 'rir_umbral', parseInt(e.target.value, 10))} style={paramInputStyle} />
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                  <label style={paramLabelStyle}>SESIONES CONSECUTIVAS</label>
                                  <input type="number" value={rule.sesiones_consecutivas !== undefined ? rule.sesiones_consecutivas : 3} onChange={(e) => handleRuleChange(idx, 'sesiones_consecutivas', parseInt(e.target.value, 10))} style={paramInputStyle} />
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                  <label style={paramLabelStyle}>% DE INCREMENTO</label>
                                  <input type="number" value={rule.incremento_porciento !== undefined ? rule.incremento_porciento : 5} onChange={(e) => handleRuleChange(idx, 'incremento_porciento', parseInt(e.target.value, 10))} style={paramInputStyle} />
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                  <label style={paramLabelStyle}>MÍNIMO INCREMENTO (KG)</label>
                                  <input type="number" step="0.5" value={rule.incremento_minimo_kg !== undefined ? rule.incremento_minimo_kg : 2.5} onChange={(e) => handleRuleChange(idx, 'incremento_minimo_kg', parseFloat(e.target.value))} style={paramInputStyle} />
                                </div>
                              </>
                            )}

                            {/* subir_peso_reps_objetivo */}
                            {rule.id === 'subir_peso_reps_objetivo' && (
                              <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                <div>
                                  <label style={{ ...paramLabelStyle, display: 'block', marginBottom: '8px' }}>OBJETIVOS ESPECÍFICOS / EXCEPCIONES</label>
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
                                    {Object.entries(rule.reps_por_ejercicio || {}).map(([ejName, reps]) => (
                                      <div key={ejName} style={{ display: 'inline-flex', alignItems: 'center', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--theme-border)', borderRadius: '20px', padding: '5px 12px', fontSize: '11px', gap: '8px' }}>
                                        <span>{ejName}</span>
                                        <span style={{ color: 'var(--theme-primary)', fontWeight: 600 }}>{reps as number} reps</span>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const newMap = { ...rule.reps_por_ejercicio };
                                            delete newMap[ejName];
                                            handleRuleChange(idx, 'reps_por_ejercicio', newMap);
                                          }}
                                          style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '12px', padding: '0 2px' }}
                                        >
                                          &times;
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                  <AddExceptionForm
                                    onAdd={(name, reps) => {
                                      const newMap = { ...rule.reps_por_ejercicio, [name]: reps };
                                      handleRuleChange(idx, 'reps_por_ejercicio', newMap);
                                    }}
                                  />
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '15px' }}>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <label style={paramLabelStyle}>% MÍNIMO DE SERIES QUE DEBEN CUMPLIR</label>
                                    <input type="number" value={rule.series_minimas_pct !== undefined ? rule.series_minimas_pct : 75} onChange={(e) => handleRuleChange(idx, 'series_minimas_pct', parseInt(e.target.value, 10))} style={paramInputStyle} />
                                  </div>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <label style={paramLabelStyle}>SESIONES CONSECUTIVAS</label>
                                    <input type="number" value={rule.sesiones_consecutivas !== undefined ? rule.sesiones_consecutivas : 2} onChange={(e) => handleRuleChange(idx, 'sesiones_consecutivas', parseInt(e.target.value, 10))} style={paramInputStyle} />
                                  </div>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <label style={paramLabelStyle}>% DE INCREMENTO</label>
                                    <input type="number" value={rule.incremento_porciento !== undefined ? rule.incremento_porciento : 5} onChange={(e) => handleRuleChange(idx, 'incremento_porciento', parseInt(e.target.value, 10))} style={paramInputStyle} />
                                  </div>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <label style={paramLabelStyle}>MÍNIMO INCREMENTO (KG)</label>
                                    <input type="number" step="0.5" value={rule.incremento_minimo_kg !== undefined ? rule.incremento_minimo_kg : 2.5} onChange={(e) => handleRuleChange(idx, 'incremento_minimo_kg', parseFloat(e.target.value))} style={paramInputStyle} />
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* subir_reps_antes_peso */}
                            {rule.id === 'subir_reps_antes_peso' && (
                              <>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                  <label style={paramLabelStyle}>% CRECIMIENTO DE VOLUMEN</label>
                                  <input type="number" value={rule.umbral_crecimiento_vol !== undefined ? rule.umbral_crecimiento_vol : 8} onChange={(e) => handleRuleChange(idx, 'umbral_crecimiento_vol', parseInt(e.target.value, 10))} style={paramInputStyle} />
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                  <label style={paramLabelStyle}>SESIONES CONSECUTIVAS</label>
                                  <input type="number" value={rule.sesiones_consecutivas !== undefined ? rule.sesiones_consecutivas : 2} onChange={(e) => handleRuleChange(idx, 'sesiones_consecutivas', parseInt(e.target.value, 10))} style={paramInputStyle} />
                                </div>
                              </>
                            )}

                            {/* mantener_peso */}
                            {rule.id === 'mantener_peso' && (
                              <>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                  <label style={paramLabelStyle}>±% PARA "ESTABLE"</label>
                                  <input type="number" value={rule.umbral_estabilidad !== undefined ? rule.umbral_estabilidad : 5} onChange={(e) => handleRuleChange(idx, 'umbral_estabilidad', parseInt(e.target.value, 10))} style={paramInputStyle} />
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                  <label style={paramLabelStyle}>SESIONES CONSECUTIVAS</label>
                                  <input type="number" value={rule.sesiones_consecutivas !== undefined ? rule.sesiones_consecutivas : 3} onChange={(e) => handleRuleChange(idx, 'sesiones_consecutivas', parseInt(e.target.value, 10))} style={paramInputStyle} />
                                </div>
                              </>
                            )}

                            {/* bajar_peso_rir_alto */}
                            {rule.id === 'bajar_peso_rir_alto' && (
                              <>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                  <label style={paramLabelStyle}>RIR MÁXIMO (FALLO)</label>
                                  <input type="number" value={rule.rir_umbral_bajo !== undefined ? rule.rir_umbral_bajo : 1} onChange={(e) => handleRuleChange(idx, 'rir_umbral_bajo', parseInt(e.target.value, 10))} style={paramInputStyle} />
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                  <label style={paramLabelStyle}>% DE REDUCCIÓN</label>
                                  <input type="number" value={rule.reduccion_porciento !== undefined ? rule.reduccion_porciento : 7} onChange={(e) => handleRuleChange(idx, 'reduccion_porciento', parseInt(e.target.value, 10))} style={paramInputStyle} />
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                  <label style={paramLabelStyle}>SESIONES CON VOLUMEN CAYENDO</label>
                                  <input type="number" value={rule.sesiones_consecutivas !== undefined ? rule.sesiones_consecutivas : 3} onChange={(e) => handleRuleChange(idx, 'sesiones_consecutivas', parseInt(e.target.value, 10))} style={paramInputStyle} />
                                </div>
                              </>
                            )}

                            {/* bajar_peso_regresion */}
                            {rule.id === 'bajar_peso_regresion' && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <label style={paramLabelStyle}>% DE REDUCCIÓN</label>
                                <input type="number" value={rule.reduccion_porciento !== undefined ? rule.reduccion_porciento : 7} onChange={(e) => handleRuleChange(idx, 'reduccion_porciento', parseInt(e.target.value, 10))} style={paramInputStyle} />
                              </div>
                            )}

                            {/* descanso_excesivo */}
                            {rule.id === 'descanso_excesivo' && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <label style={paramLabelStyle}>% DE REDUCCIÓN</label>
                                <input type="number" value={rule.reduccion_porciento !== undefined ? rule.reduccion_porciento : 10} onChange={(e) => handleRuleChange(idx, 'reduccion_porciento', parseInt(e.target.value, 10))} style={paramInputStyle} />
                              </div>
                            )}

                            {/* descanso_largo (descanso_corto in original) */}
                            {rule.id === 'descanso_largo' && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <label style={paramLabelStyle}>DESCANSO ALTO (SEG)</label>
                                <input type="number" value={rule.umbral_descanso_alto !== undefined ? rule.umbral_descanso_alto : 180} onChange={(e) => handleRuleChange(idx, 'umbral_descanso_alto', parseInt(e.target.value, 10))} style={paramInputStyle} />
                              </div>
                            )}

                            {/* estancamiento */}
                            {rule.id === 'estancamiento' && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <label style={paramLabelStyle}>SESIONES SIN MEJORAR PESO/REPS</label>
                                <input type="number" value={rule.sesiones_sin_mejora_peso_reps !== undefined ? rule.sesiones_sin_mejora_peso_reps : 4} onChange={(e) => handleRuleChange(idx, 'sesiones_sin_mejora_peso_reps', parseInt(e.target.value, 10))} style={paramInputStyle} />
                              </div>
                            )}

                            {/* racha_positiva */}
                            {rule.id === 'racha_positiva' && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <label style={paramLabelStyle}>SESIONES EN RACHA</label>
                                <input type="number" value={rule.sesiones_racha !== undefined ? rule.sesiones_racha : 3} onChange={(e) => handleRuleChange(idx, 'sesiones_racha', parseInt(e.target.value, 10))} style={paramInputStyle} />
                              </div>
                            )}

                            {/* deload_sugerido */}
                            {rule.id === 'deload_sugerido' && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <label style={paramLabelStyle}>SEMANAS CONSECUTIVAS</label>
                                <input type="number" value={rule.semanas_consecutivas !== undefined ? rule.semanas_consecutivas : 6} onChange={(e) => handleRuleChange(idx, 'semanas_consecutivas', parseInt(e.target.value, 10))} style={paramInputStyle} />
                              </div>
                            )}

                            {/* autocarga_subir_reps */}
                            {rule.id === 'autocarga_subir_reps' && (
                              <>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                  <label style={paramLabelStyle}>RIR MÍNIMO PARA SUBIR</label>
                                  <input type="number" value={rule.rir_umbral !== undefined ? rule.rir_umbral : 3} onChange={(e) => handleRuleChange(idx, 'rir_umbral', parseInt(e.target.value, 10))} style={paramInputStyle} />
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                  <label style={paramLabelStyle}>SESIONES CONSECUTIVAS</label>
                                  <input type="number" value={rule.sesiones_consecutivas !== undefined ? rule.sesiones_consecutivas : 2} onChange={(e) => handleRuleChange(idx, 'sesiones_consecutivas', parseInt(e.target.value, 10))} style={paramInputStyle} />
                                </div>
                              </>
                            )}

                            {/* autocarga_tut_tiempo */}
                            {rule.id === 'autocarga_tut_tiempo' && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <label style={paramLabelStyle}>SESIONES CONSECUTIVAS</label>
                                <input type="number" value={rule.sesiones_consecutivas !== undefined ? rule.sesiones_consecutivas : 2} onChange={(e) => handleRuleChange(idx, 'sesiones_consecutivas', parseInt(e.target.value, 10))} style={paramInputStyle} />
                              </div>
                            )}

                            {/* autocarga_descanso_densidad */}
                            {rule.id === 'autocarga_descanso_densidad' && (
                              <>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                  <label style={paramLabelStyle}>DESCANSO ALTO (SEG)</label>
                                  <input type="number" value={rule.umbral_descanso_alto !== undefined ? rule.umbral_descanso_alto : 90} onChange={(e) => handleRuleChange(idx, 'umbral_descanso_alto', parseInt(e.target.value, 10))} style={paramInputStyle} />
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                  <label style={paramLabelStyle}>SESIONES CONSECUTIVAS</label>
                                  <input type="number" value={rule.sesiones_consecutivas !== undefined ? rule.sesiones_consecutivas : 2} onChange={(e) => handleRuleChange(idx, 'sesiones_consecutivas', parseInt(e.target.value, 10))} style={paramInputStyle} />
                                </div>
                              </>
                            )}

                            {/* autocarga_evolucion_mecanica */}
                            {rule.id === 'autocarga_evolucion_mecanica' && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <label style={paramLabelStyle}>SESIONES CONSECUTIVAS</label>
                                <input type="number" value={rule.sesiones_consecutivas !== undefined ? rule.sesiones_consecutivas : 2} onChange={(e) => handleRuleChange(idx, 'sesiones_consecutivas', parseInt(e.target.value, 10))} style={paramInputStyle} />
                              </div>
                            )}

                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ═══ BOTTOM CONTROLS ═══ */}
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '20px' }}>
              <button
                type="button"
                onClick={handleResetDefaults}
                style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: '30px',
                  color: 'rgba(255,255,255,0.6)',
                  padding: '10px 20px',
                  fontSize: '11px',
                  fontFamily: "'Orbitron', sans-serif",
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  fontWeight: 600,
                  letterSpacing: '0.5px'
                }}
              >
                ↺ Restaurar Valores por Defecto
              </button>
            </div>

            {/* Floating save button for mobile */}
            <div style={{
              position: 'fixed',
              bottom: '70px',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 100,
              width: '90%',
              maxWidth: '400px'
            }}>
              <button
                onClick={handleSave}
                disabled={saving}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  padding: '14px 20px',
                  background: 'var(--theme-btn-gradient)',
                  boxShadow: '0 0 20px var(--theme-btn-glow), 0 4px 20px rgba(0,0,0,0.4)',
                  border: 'none',
                  borderRadius: '30px',
                  color: 'white',
                  fontFamily: "'Orbitron', sans-serif",
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: saving ? 'not-allowed' : 'pointer',
                  transition: 'all 0.3s ease',
                  opacity: saving ? 0.7 : 1,
                  letterSpacing: '0.5px'
                }}
              >
                {saving ? (
                  <>
                    <span style={{ width: '14px', height: '14px', borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid white', animation: 'spin 1s linear infinite', display: 'inline-block' }} />
                    <span>GUARDANDO...</span>
                  </>
                ) : (
                  <span>✓ GUARDAR CONFIGURACIÓN</span>
                )}
              </button>
            </div>
          </>
        )}
      </div>

      <Toast message={toastState.message} type={toastState.type} visible={toastState.visible} />
    </div>
  );
};

export default SoloConfigRules;
