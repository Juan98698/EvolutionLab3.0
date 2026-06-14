import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { Profile, PlanData } from '../../types/database.types';
import Toast from '../common/Toast';
import { InfoTooltip } from '../common/InfoTooltip';
import { DEFAULT_RULES } from '../../lib/rules';

interface NumberStepperProps {
  id?: string;
  value: number;
  min: number;
  max: number;
  onChange: (val: number) => void;
}

const NumberStepper: React.FC<NumberStepperProps> = ({ id, value, min, max, onChange }) => {
  const handleDecrement = () => {
    if (value > min) onChange(value - 1);
  };

  const handleIncrement = () => {
    if (value < max) onChange(value + 1);
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', overflow: 'hidden', height: '42px', width: '100%', maxWidth: '240px' }}>
      <button
        type="button"
        onClick={handleDecrement}
        disabled={value <= min}
        style={{
          width: '50px',
          height: '100%',
          background: 'rgba(255,255,255,0.01)',
          border: 'none',
          borderRight: '1px solid rgba(255,255,255,0.08)',
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
        id={id}
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
          borderLeft: '1px solid rgba(255,255,255,0.08)',
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

export const ConfigRules: React.FC = () => {
  const navigate = useNavigate();

  const [clientes, setClientes] = useState<Profile[]>([]);
  const [selectedClienteId, setSelectedClienteId] = useState<string>('');
  const [loadingClientes, setLoadingClientes] = useState<boolean>(true);
  const [loadingPlan, setLoadingPlan] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);

  // Estados del Plan activo seleccionado
  const [existingPlan, setExistingPlan] = useState<any>(null);
  const [trackerConfig, setTrackerConfig] = useState<any>({
    minSesiones: 3,
    ventana: 4,
    diasDescansoExcesivo: 14,
    diasOptimo: 7,
    sesionesRegresionAlerta: 3,
    semanasEstancamiento: 5
  });
  const [trackerRules, setTrackerRules] = useState<any[]>([]);

  // Estados de Toast
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

  const DEFAULT_CONFIG = {
    minSesiones: 3,
    ventana: 4,
    diasDescansoExcesivo: 14,
    diasOptimo: 7,
    sesionesRegresionAlerta: 3,
    semanasEstancamiento: 5
  };

  const mergeRules = (loadedRules: any[]) => {
    const rulesArray = Array.isArray(loadedRules) ? loadedRules : [];
    const existingMap = new Map(rulesArray.map(r => [r.id, r]));
    return DEFAULT_RULES.map(defaultRule => {
      if (existingMap.has(defaultRule.id)) {
        return {
          ...defaultRule,
          ...existingMap.get(defaultRule.id)
        };
      }
      return defaultRule;
    });
  };

  // Cargar lista de clientes
  useEffect(() => {
    const fetchClientes = async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, nombre, email, rol')
          .eq('rol', 'cliente')
          .order('nombre', { ascending: true });

        if (error) throw error;
        setClientes((data as Profile[]) || []);
      } catch (err: any) {
        console.error('Error al cargar selector:', err);
        showToast('Error al cargar atletas: ' + err.message, 'error');
      } finally {
        setLoadingClientes(false);
      }
    };
    fetchClientes();
  }, []);

  // Cargar plan cuando el cliente es seleccionado
  useEffect(() => {
    const loadPlan = async () => {
      if (!selectedClienteId) {
        setExistingPlan(null);
        setTrackerConfig(DEFAULT_CONFIG);
        setTrackerRules(DEFAULT_RULES);
        return;
      }

      setLoadingPlan(true);
      try {
        const { data, error } = await supabase
          .from('planes')
          .select('*')
          .eq('cliente_id', selectedClienteId)
          .eq('activo', true)
          .maybeSingle();

        if (error) throw error;

        if (data && data.datos_plan) {
          setExistingPlan(data);
          const p = data.datos_plan as PlanData;
          setTrackerConfig(p.trackerConfig || DEFAULT_CONFIG);
          setTrackerRules(mergeRules(p.trackerRules || DEFAULT_RULES));
          showToast('Reglas de sobrecarga cargadas del atleta.', 'success');
        } else {
          setExistingPlan(null);
          setTrackerConfig(DEFAULT_CONFIG);
          setTrackerRules(DEFAULT_RULES);
          showToast('Sin plan asignado. Mostrando reglas estándar.', 'info');
        }
      } catch (err: any) {
        console.error('Error al cargar plan:', err);
        showToast('Error: ' + err.message, 'error');
      } finally {
        setLoadingPlan(false);
      }
    };

    loadPlan();
  }, [selectedClienteId]);

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
    if (window.confirm('¿Seguro que deseas restaurar todos los parámetros y mensajes a sus valores científicos por defecto?')) {
      setTrackerConfig(DEFAULT_CONFIG);
      setTrackerRules(DEFAULT_RULES);
      showToast('Valores restablecidos por defecto.', 'info');
    }
  };

  const handleSaveConfig = async () => {
    if (!selectedClienteId) {
      alert('Por favor selecciona un atleta antes de guardar.');
      return;
    }

    setSaving(true);
    showToast('Guardando configuración en la nube...', 'info');

    try {
      if (existingPlan) {
        // Actualizar datos del plan con la nueva config de sobrecarga
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
        
        // Actualizar en el estado local
        setExistingPlan((prev: any) => ({ ...prev, datos_plan: updatedDatosPlan }));
      } else {
        // Insertar un plan básico activo
        const planDataPayload: PlanData = {
          portada: {
            userName: clientes.find(c => c.id === selectedClienteId)?.nombre || '',
            startDate: new Date().toISOString().split('T')[0],
            planVigenciaPlan: '28',
          },
          globalVariables: [],
          variableDefinitions: {},
          trainingDays: [],
          weekdayMapping: { '0': -1, '1': -1, '2': -1, '3': -1, '4': -1, '5': -1, '6': -1 },
          trackerConfig,
          trackerRules
        };

        const { data, error } = await supabase
          .from('planes')
          .insert({
            cliente_id: selectedClienteId,
            datos_plan: planDataPayload,
            activo: true
          })
          .select('*')
          .single();

        if (error) throw error;
        setExistingPlan(data);
      }

      showToast('¡Motor de sobrecarga progresiva guardado con éxito! ☁️', 'success');
    } catch (err: any) {
      console.error('Error al guardar configuración de sobrecarga:', err);
      showToast('Error al guardar: ' + err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ background: 'transparent', minHeight: '100vh', color: 'white', paddingBottom: '60px' }}>
      
      {/* HEADER DE REGLAS */}
      <div className="top-bar" style={{ marginBottom: '20px', padding: '12px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px', maxWidth: '1200px', margin: '0 auto', padding: '0 20px' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={() => navigate('/trainer')}
              style={{ background: 'none', border: 'none', color: 'var(--theme-primary)', fontSize: '12px', cursor: 'pointer', fontFamily: "'Orbitron', sans-serif", padding: '8px 12px', borderRadius: '8px', borderStyle: 'solid', borderWidth: '1px', borderColor: 'var(--theme-border)' }}
            >
              ← Volver al Panel
            </button>
            <div>
              <h1 style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '15px', fontWeight: 800, margin: 0, letterSpacing: '1px' }}>
                MOTOR DE SOBRECARGA PROGRESIVA
              </h1>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginTop: '2px' }}>
                Ajustando umbrales y reglas científicas de análisis
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleSaveConfig}
              disabled={saving}
              className={`btn btn-primary ${saving ? 'button-loading' : ''}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '10px 20px',
                transition: 'all 0.3s ease',
                opacity: saving ? 0.7 : 1
              }}
            >
              {saving ? (
                <>
                  <span className="spinner-icon" style={{ width: '14px', height: '14px', borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid var(--theme-primary)' }} />
                  <span>GUARDANDO...</span>
                </>
              ) : (
                <span>✓ GUARDAR CONFIGURACIÓN</span>
              )}
            </button>
          </div>

        </div>
      </div>

      <div className="container stagger-3" style={{ padding: '0 20px', maxWidth: '1200px', margin: '0 auto' }}>
        
        {/* SELECTOR DE ATLETA EN REGLAS */}
        <div style={{ background: 'var(--theme-card-bg)', border: '1px solid var(--theme-border)', borderRadius: '16px', padding: '20px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'wrap', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}>
          <label htmlFor="atleta-config" style={{ fontSize: '12px', fontWeight: 700, color: 'rgba(255,255,255,0.7)', fontFamily: "'Orbitron', sans-serif" }}>ATLETA PARA CONFIGURAR:</label>
          {loadingClientes ? (
            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', fontFamily: "'Orbitron', sans-serif" }}>Cargando atletas...</span>
          ) : (
            <select
              id="atleta-config"
              value={selectedClienteId}
              onChange={(e) => setSelectedClienteId(e.target.value)}
              style={{ minWidth: '220px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '8px 12px', borderRadius: '8px', fontSize: '12px' }}
            >
              <option value="">-- Seleccionar Atleta --</option>
              {clientes.map(c => (
                <option key={c.id} value={c.id}>{c.nombre} ({c.email})</option>
              ))}
            </select>
          )}
        </div>

        {loadingPlan ? (
          <div style={{ textAlign: 'center', padding: '60px', color: 'var(--theme-primary)', fontFamily: 'Orbitron, sans-serif' }}>
            <span>Cargando parámetros de análisis...</span>
          </div>
        ) : (
          <>
            {/* SECCIÓN 1: PARAMETROS GENERALES */}
            <div style={{ background: 'var(--theme-card-bg)', border: '1px solid var(--theme-border)', borderRadius: '16px', padding: '24px', marginBottom: '24px', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}>
              <h3 style={{ fontFamily: "'Orbitron', sans-serif", fontSize: '13px', color: 'var(--theme-primary)', letterSpacing: '0.5px', marginBottom: '20px', marginTop: 0 }}>
                📊 PARÁMETROS GENERALES DE ANÁLISIS
              </h3>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label htmlFor="minSesiones" style={{ display: 'flex', alignItems: 'center', fontSize: '12px', fontWeight: 600 }}>Sesiones mínimas para evaluar<InfoTooltip title="Sesiones Mínimas" body="Número mínimo de sesiones registradas de un ejercicio antes de que el motor de sobrecarga empiece a generar sugerencias. Evita falsas alarmas cuando aún no hay datos suficientes para un análisis estadístico confiable." /></label>
                  <NumberStepper
                    id="minSesiones"
                    value={trackerConfig.minSesiones || 3}
                    min={1}
                    max={10}
                    onChange={(val) => handleConfigChange('minSesiones', val)}
                  />
                  <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', lineHeight: 1.4 }}>No se generan alertas ni sugerencias de sobrecarga si el atleta tiene menos de estas sesiones registradas por ejercicio.</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label htmlFor="ventana" style={{ display: 'flex', alignItems: 'center', fontSize: '12px', fontWeight: 600 }}>Sesiones a mirar atrás (Ventana)<InfoTooltip title="Ventana de Análisis" body="Foco temporal de análisis. El motor solo evaluará las últimas N sesiones para calcular tendencias, promedios y detectar patrones. Un valor más alto suaviza la tendencia; uno más bajo la hace más reactiva a cambios recientes." /></label>
                  <NumberStepper
                    id="ventana"
                    value={trackerConfig.ventana || 4}
                    min={2}
                    max={10}
                    onChange={(val) => handleConfigChange('ventana', val)}
                  />
                  <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', lineHeight: 1.4 }}>Cuántas sesiones de entrenamiento recientes se consideran en la ventana deslizante para estimar las tendencias.</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label htmlFor="diasDescansoExcesivo" style={{ display: 'flex', alignItems: 'center', fontSize: '12px', fontWeight: 600 }}>Descanso Excesivo (Días de inactividad)<InfoTooltip title="Descanso Excesivo" body="Días máximos de inactividad permitidos para un ejercicio antes de activar una alerta preventiva. Si el atleta supera estos días sin entrenar, se recomendará una bajada de peso para evitar lesión por pérdida de adaptaciones." /></label>
                  <NumberStepper
                    id="diasDescansoExcesivo"
                    value={trackerConfig.diasDescansoExcesivo || 14}
                    min={3}
                    max={30}
                    onChange={(val) => handleConfigChange('diasDescansoExcesivo', val)}
                  />
                  <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', lineHeight: 1.4 }}>Si el atleta pasa más de estos días seguidos sin registrar un ejercicio, se alertará de descanso excesivo y regresión.</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label htmlFor="diasOptimo" style={{ display: 'flex', alignItems: 'center', fontSize: '12px', fontWeight: 600 }}>Frecuencia Óptima (Días máximos recomendados)<InfoTooltip title="Frecuencia Óptima" body="Intervalo ideal recomendado entre sesiones del mismo patrón de movimiento. Si el atleta entrena un ejercicio más tarde de estos días, se notificará como descanso corto o fuera de frecuencia ideal según la programación." /></label>
                  <NumberStepper
                    id="diasOptimo"
                    value={trackerConfig.diasOptimo || 7}
                    min={1}
                    max={14}
                    onChange={(val) => handleConfigChange('diasOptimo', val)}
                  />
                  <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', lineHeight: 1.4 }}>Rango máximo de días considerado óptimo y normal entre sesiones del mismo ejercicio para el progreso de fuerza.</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label htmlFor="sesionesRegresionAlerta" style={{ display: 'flex', alignItems: 'center', fontSize: '12px', fontWeight: 600 }}>Sesiones con baja para Alerta Regresión<InfoTooltip title="Alerta de Regresión" body="Número de sesiones consecutivas con caída en el volumen de entrenamiento que activan la alerta visual de regresión. Criterio matemático para sugerir un deload o cambio de estímulo cuando la tendencia es negativa." /></label>
                  <NumberStepper
                    id="sesionesRegresionAlerta"
                    value={trackerConfig.sesionesRegresionAlerta || 3}
                    min={2}
                    max={6}
                    onChange={(val) => handleConfigChange('sesionesRegresionAlerta', val)}
                  />
                  <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', lineHeight: 1.4 }}>Cantidad de sesiones consecutivas con caída acumulada de volumen que disparan la alerta visual de regresión.</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label htmlFor="semanasEstancamiento" style={{ display: 'flex', alignItems: 'center', fontSize: '12px', fontWeight: 600 }}>Semanas Estancamiento antes de sugerir Cambio<InfoTooltip title="Estancamiento" body="Semanas sin mejora en el 1RM estimado antes de sugerir variar o sustituir el ejercicio. Un estancamiento prolongado indica adaptación neural completa al estímulo, y el cambio de ejercicio puede reactivar la hipertrofia." /></label>
                  <NumberStepper
                    id="semanasEstancamiento"
                    value={trackerConfig.semanasEstancamiento || 5}
                    min={2}
                    max={12}
                    onChange={(val) => handleConfigChange('semanasEstancamiento', val)}
                  />
                  <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', lineHeight: 1.4 }}>Semanas sin mejoras en el 1RM estimado antes de sugerir variar o sustituir el ejercicio.</span>
                </div>
              </div>
            </div>

            {/* SECCIÓN 2: REGLAS Y MENSAJES INDIVIDUALES */}
            <div style={{ background: 'var(--theme-card-bg)', border: '1px solid var(--theme-border)', borderRadius: '16px', padding: '24px', marginBottom: '24px', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}>
              <h3 style={{ fontFamily: "'Orbitron', sans-serif", fontSize: '13px', color: 'var(--theme-primary)', letterSpacing: '0.5px', marginBottom: '10px', marginTop: 0 }}>
                📋 REGLAS DE NOTIFICACIÓN DE SOBRECARGA
              </h3>
              <p style={{ margin: '0 0 20px 0', fontSize: '11px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.4 }}>
                Activa o desactiva las reglas automáticas de análisis y personaliza los textos que leerá el atleta en su bitácora. Puedes usar las variables comodines <code style={{ background: 'rgba(255,255,255,0.06)', padding: '1px 5px', borderRadius: '4px' }}>{`{ejercicio}`}</code>, <code style={{ background: 'rgba(255,255,255,0.06)', padding: '1px 5px', borderRadius: '4px' }}>{`{valor}`}</code>, <code style={{ background: 'rgba(255,255,255,0.06)', padding: '1px 5px', borderRadius: '4px' }}>{`{peso}`}</code>, <code style={{ background: 'rgba(255,255,255,0.06)', padding: '1px 5px', borderRadius: '4px' }}>{`{porciento}`}</code> en tus textos.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {trackerRules.map((rule, idx) => (
                  <div
                    key={rule.id}
                    className="stagger-item"
                    style={{
                      background: 'var(--theme-badge-bg)',
                      border: '1px solid var(--theme-border)',
                      borderRadius: '12px',
                      padding: '20px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
                      <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 700, fontFamily: "'Orbitron', sans-serif", color: rule.activa ? 'white' : 'rgba(255,255,255,0.4)' }}>
                        {idx + 1}. {rule.titulo}
                      </h4>
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
                      <div>
                        <label htmlFor={`rule-mensaje-${rule.id}`} style={{ display: 'block', fontSize: '10px', color: 'rgba(255,255,255,0.5)', fontWeight: 600, marginBottom: '6px', cursor: 'pointer' }}>RECOMENDACIÓN AL ATLETA (Mensaje de Notificación)</label>
                        <textarea
                          id={`rule-mensaje-${rule.id}`}
                          rows={2}
                          value={rule.mensaje}
                          onChange={(e) => handleRuleChange(idx, 'mensaje', e.target.value)}
                          style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', color: 'white', padding: '10px', fontSize: '12px', resize: 'vertical' }}
                        />
                      </div>

                      {/* Parámetros de regla específicos */}
                      {rule.activa && (
                        <div style={{ marginTop: '8px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '15px', padding: '15px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.03)' }}>
                          {rule.id === 'subir_peso_reps' && (
                            <>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <label htmlFor={`rule-rir_umbral-${rule.id}`} style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', fontWeight: 600, cursor: 'pointer' }}>RIR MÍNIMO PARA SUBIR</label>
                                <input
                                  id={`rule-rir_umbral-${rule.id}`}
                                  type="number"
                                  value={rule.rir_umbral !== undefined ? rule.rir_umbral : 3}
                                  onChange={(e) => handleRuleChange(idx, 'rir_umbral', parseInt(e.target.value, 10))}
                                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: 'white', padding: '8px', fontSize: '12px' }}
                                />
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <label htmlFor={`rule-sesiones_consecutivas-${rule.id}`} style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', fontWeight: 600, cursor: 'pointer' }}>SESIONES CONSECUTIVAS</label>
                                <input
                                  id={`rule-sesiones_consecutivas-${rule.id}`}
                                  type="number"
                                  value={rule.sesiones_consecutivas !== undefined ? rule.sesiones_consecutivas : 3}
                                  onChange={(e) => handleRuleChange(idx, 'sesiones_consecutivas', parseInt(e.target.value, 10))}
                                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: 'white', padding: '8px', fontSize: '12px' }}
                                />
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <label htmlFor={`rule-incremento_porciento-${rule.id}`} style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', fontWeight: 600, cursor: 'pointer' }}>% DE INCREMENTO</label>
                                <input
                                  id={`rule-incremento_porciento-${rule.id}`}
                                  type="number"
                                  value={rule.incremento_porciento !== undefined ? rule.incremento_porciento : 5}
                                  onChange={(e) => handleRuleChange(idx, 'incremento_porciento', parseInt(e.target.value, 10))}
                                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: 'white', padding: '8px', fontSize: '12px' }}
                                />
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <label htmlFor={`rule-incremento_minimo_kg-${rule.id}`} style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', fontWeight: 600, cursor: 'pointer' }}>MÍNIMO INCREMENTO (KG)</label>
                                <input
                                  id={`rule-incremento_minimo_kg-${rule.id}`}
                                  type="number"
                                  step="0.5"
                                  value={rule.incremento_minimo_kg !== undefined ? rule.incremento_minimo_kg : 2.5}
                                  onChange={(e) => handleRuleChange(idx, 'incremento_minimo_kg', parseFloat(e.target.value))}
                                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: 'white', padding: '8px', fontSize: '12px' }}
                                />
                              </div>
                            </>
                          )}

                          {rule.id === 'subir_peso_reps_objetivo' && (
                            <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                              <div>
                                <label style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>OBJETIVOS ESPECÍFICOS / EXCEPCIONES</label>
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
                                  <label htmlFor={`rule-series_minimas_pct-${rule.id}`} style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', fontWeight: 600, cursor: 'pointer' }}>% MÍNIMO DE SERIES QUE DEBEN CUMPLIR</label>
                                  <input
                                    id={`rule-series_minimas_pct-${rule.id}`}
                                    type="number"
                                    value={rule.series_minimas_pct !== undefined ? rule.series_minimas_pct : 75}
                                    onChange={(e) => handleRuleChange(idx, 'series_minimas_pct', parseInt(e.target.value, 10))}
                                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: 'white', padding: '8px', fontSize: '12px' }}
                                  />
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                  <label htmlFor={`rule-sesiones_consecutivas-${rule.id}`} style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', fontWeight: 600, cursor: 'pointer' }}>SESIONES CONSECUTIVAS</label>
                                  <input
                                    id={`rule-sesiones_consecutivas-${rule.id}`}
                                    type="number"
                                    value={rule.sesiones_consecutivas !== undefined ? rule.sesiones_consecutivas : 2}
                                    onChange={(e) => handleRuleChange(idx, 'sesiones_consecutivas', parseInt(e.target.value, 10))}
                                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: 'white', padding: '8px', fontSize: '12px' }}
                                  />
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                  <label htmlFor={`rule-incremento_porciento-${rule.id}`} style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', fontWeight: 600, cursor: 'pointer' }}>% DE INCREMENTO</label>
                                  <input
                                    id={`rule-incremento_porciento-${rule.id}`}
                                    type="number"
                                    value={rule.incremento_porciento !== undefined ? rule.incremento_porciento : 5}
                                    onChange={(e) => handleRuleChange(idx, 'incremento_porciento', parseInt(e.target.value, 10))}
                                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: 'white', padding: '8px', fontSize: '12px' }}
                                  />
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                  <label htmlFor={`rule-incremento_minimo_kg-${rule.id}`} style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', fontWeight: 600, cursor: 'pointer' }}>MÍNIMO INCREMENTO (KG)</label>
                                  <input
                                    id={`rule-incremento_minimo_kg-${rule.id}`}
                                    type="number"
                                    step="0.5"
                                    value={rule.incremento_minimo_kg !== undefined ? rule.incremento_minimo_kg : 2.5}
                                    onChange={(e) => handleRuleChange(idx, 'incremento_minimo_kg', parseFloat(e.target.value))}
                                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: 'white', padding: '8px', fontSize: '12px' }}
                                  />
                                </div>
                              </div>
                            </div>
                          )}

                          {rule.id === 'subir_reps_antes_peso' && (
                            <>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <label htmlFor={`rule-umbral_crecimiento_vol-${rule.id}`} style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', fontWeight: 600, cursor: 'pointer' }}>% CRECIMIENTO DE VOLUMEN</label>
                                <input
                                  id={`rule-umbral_crecimiento_vol-${rule.id}`}
                                  type="number"
                                  value={rule.umbral_crecimiento_vol !== undefined ? rule.umbral_crecimiento_vol : 8}
                                  onChange={(e) => handleRuleChange(idx, 'umbral_crecimiento_vol', parseInt(e.target.value, 10))}
                                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: 'white', padding: '8px', fontSize: '12px' }}
                                />
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <label htmlFor={`rule-sesiones_consecutivas-${rule.id}`} style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', fontWeight: 600, cursor: 'pointer' }}>SESIONES CONSECUTIVAS</label>
                                <input
                                  id={`rule-sesiones_consecutivas-${rule.id}`}
                                  type="number"
                                  value={rule.sesiones_consecutivas !== undefined ? rule.sesiones_consecutivas : 2}
                                  onChange={(e) => handleRuleChange(idx, 'sesiones_consecutivas', parseInt(e.target.value, 10))}
                                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: 'white', padding: '8px', fontSize: '12px' }}
                                />
                              </div>
                            </>
                          )}

                          {rule.id === 'mantener_peso' && (
                            <>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <label htmlFor={`rule-umbral_estabilidad-${rule.id}`} style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', fontWeight: 600, cursor: 'pointer' }}>±% PARA "ESTABLE"</label>
                                <input
                                  id={`rule-umbral_estabilidad-${rule.id}`}
                                  type="number"
                                  value={rule.umbral_estabilidad !== undefined ? rule.umbral_estabilidad : 5}
                                  onChange={(e) => handleRuleChange(idx, 'umbral_estabilidad', parseInt(e.target.value, 10))}
                                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: 'white', padding: '8px', fontSize: '12px' }}
                                />
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <label htmlFor={`rule-sesiones_consecutivas-${rule.id}`} style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', fontWeight: 600, cursor: 'pointer' }}>SESIONES CONSECUTIVAS</label>
                                <input
                                  id={`rule-sesiones_consecutivas-${rule.id}`}
                                  type="number"
                                  value={rule.sesiones_consecutivas !== undefined ? rule.sesiones_consecutivas : 3}
                                  onChange={(e) => handleRuleChange(idx, 'sesiones_consecutivas', parseInt(e.target.value, 10))}
                                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: 'white', padding: '8px', fontSize: '12px' }}
                                />
                              </div>
                            </>
                          )}

                          {rule.id === 'bajar_peso_rir_alto' && (
                            <>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <label htmlFor={`rule-rir_umbral_bajo-${rule.id}`} style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', fontWeight: 600, cursor: 'pointer' }}>RIR MÁXIMO (FALLO)</label>
                                <input
                                  id={`rule-rir_umbral_bajo-${rule.id}`}
                                  type="number"
                                  value={rule.rir_umbral_bajo !== undefined ? rule.rir_umbral_bajo : 1}
                                  onChange={(e) => handleRuleChange(idx, 'rir_umbral_bajo', parseInt(e.target.value, 10))}
                                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: 'white', padding: '8px', fontSize: '12px' }}
                                />
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <label htmlFor={`rule-reduccion_porciento-${rule.id}`} style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', fontWeight: 600, cursor: 'pointer' }}>% DE REDUCCIÓN</label>
                                <input
                                  id={`rule-reduccion_porciento-${rule.id}`}
                                  type="number"
                                  value={rule.reduccion_porciento !== undefined ? rule.reduccion_porciento : 7}
                                  onChange={(e) => handleRuleChange(idx, 'reduccion_porciento', parseInt(e.target.value, 10))}
                                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: 'white', padding: '8px', fontSize: '12px' }}
                                />
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <label htmlFor={`rule-sesiones_consecutivas-${rule.id}`} style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', fontWeight: 600, cursor: 'pointer' }}>SESIONES CON VOLUMEN CAYENDO</label>
                                <input
                                  id={`rule-sesiones_consecutivas-${rule.id}`}
                                  type="number"
                                  value={rule.sesiones_consecutivas !== undefined ? rule.sesiones_consecutivas : 3}
                                  onChange={(e) => handleRuleChange(idx, 'sesiones_consecutivas', parseInt(e.target.value, 10))}
                                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: 'white', padding: '8px', fontSize: '12px' }}
                                />
                              </div>
                            </>
                          )}

                          {rule.id === 'bajar_peso_regresion' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <label htmlFor={`rule-reduccion_porciento-${rule.id}`} style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', fontWeight: 600, cursor: 'pointer' }}>% DE REDUCCIÓN</label>
                              <input
                                id={`rule-reduccion_porciento-${rule.id}`}
                                type="number"
                                value={rule.reduccion_porciento !== undefined ? rule.reduccion_porciento : 7}
                                onChange={(e) => handleRuleChange(idx, 'reduccion_porciento', parseInt(e.target.value, 10))}
                                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: 'white', padding: '8px', fontSize: '12px' }}
                              />
                            </div>
                          )}

                          {rule.id === 'descanso_excesivo' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <label htmlFor={`rule-reduccion_porciento-${rule.id}`} style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', fontWeight: 600, cursor: 'pointer' }}>% DE REDUCCIÓN</label>
                              <input
                                id={`rule-reduccion_porciento-${rule.id}`}
                                type="number"
                                value={rule.reduccion_porciento !== undefined ? rule.reduccion_porciento : 10}
                                onChange={(e) => handleRuleChange(idx, 'reduccion_porciento', parseInt(e.target.value, 10))}
                                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: 'white', padding: '8px', fontSize: '12px' }}
                              />
                            </div>
                          )}

                          {rule.id === 'descanso_corto' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <label htmlFor={`rule-umbral_descanso_alto-${rule.id}`} style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', fontWeight: 600, cursor: 'pointer' }}>DESCANSO ALTO (SEG)</label>
                              <input
                                id={`rule-umbral_descanso_alto-${rule.id}`}
                                type="number"
                                value={rule.umbral_descanso_alto !== undefined ? rule.umbral_descanso_alto : 180}
                                onChange={(e) => handleRuleChange(idx, 'umbral_descanso_alto', parseInt(e.target.value, 10))}
                                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: 'white', padding: '8px', fontSize: '12px' }}
                              />
                            </div>
                          )}

                          {rule.id === 'estancamiento' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <label htmlFor={`rule-sesiones_sin_mejora_peso_reps-${rule.id}`} style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', fontWeight: 600, cursor: 'pointer' }}>SESIONES SIN MEJORAR PESO/REPS</label>
                              <input
                                id={`rule-sesiones_sin_mejora_peso_reps-${rule.id}`}
                                type="number"
                                value={rule.sesiones_sin_mejora_peso_reps !== undefined ? rule.sesiones_sin_mejora_peso_reps : 4}
                                onChange={(e) => handleRuleChange(idx, 'sesiones_sin_mejora_peso_reps', parseInt(e.target.value, 10))}
                                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: 'white', padding: '8px', fontSize: '12px' }}
                              />
                            </div>
                          )}

                          {rule.id === 'racha_positiva' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <label htmlFor={`rule-sesiones_racha-${rule.id}`} style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', fontWeight: 600, cursor: 'pointer' }}>SESIONES EN RACHA</label>
                              <input
                                id={`rule-sesiones_racha-${rule.id}`}
                                type="number"
                                value={rule.sesiones_racha !== undefined ? rule.sesiones_racha : 3}
                                onChange={(e) => handleRuleChange(idx, 'sesiones_racha', parseInt(e.target.value, 10))}
                                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: 'white', padding: '8px', fontSize: '12px' }}
                              />
                            </div>
                          )}

                          {rule.id === 'deload_sugerido' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <label htmlFor={`rule-semanas_consecutivas-${rule.id}`} style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', fontWeight: 600, cursor: 'pointer' }}>SEMANAS CONSECUTIVAS</label>
                              <input
                                id={`rule-semanas_consecutivas-${rule.id}`}
                                type="number"
                                value={rule.semanas_consecutivas !== undefined ? rule.semanas_consecutivas : 6}
                                onChange={(e) => handleRuleChange(idx, 'semanas_consecutivas', parseInt(e.target.value, 10))}
                                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: 'white', padding: '8px', fontSize: '12px' }}
                              />
                            </div>
                          )}

                          {rule.id === 'autocarga_subir_reps' && (
                            <>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <label htmlFor={`rule-rir_umbral-${rule.id}`} style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', fontWeight: 600, cursor: 'pointer' }}>RIR MÍNIMO PARA SUBIR</label>
                                <input
                                  id={`rule-rir_umbral-${rule.id}`}
                                  type="number"
                                  value={rule.rir_umbral !== undefined ? rule.rir_umbral : 3}
                                  onChange={(e) => handleRuleChange(idx, 'rir_umbral', parseInt(e.target.value, 10))}
                                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: 'white', padding: '8px', fontSize: '12px' }}
                                />
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <label htmlFor={`rule-sesiones_consecutivas-${rule.id}`} style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', fontWeight: 600, cursor: 'pointer' }}>SESIONES CONSECUTIVAS</label>
                                <input
                                  id={`rule-sesiones_consecutivas-${rule.id}`}
                                  type="number"
                                  value={rule.sesiones_consecutivas !== undefined ? rule.sesiones_consecutivas : 2}
                                  onChange={(e) => handleRuleChange(idx, 'sesiones_consecutivas', parseInt(e.target.value, 10))}
                                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: 'white', padding: '8px', fontSize: '12px' }}
                                />
                              </div>
                            </>
                          )}

                          {rule.id === 'autocarga_tut_tiempo' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <label htmlFor={`rule-sesiones_consecutivas-${rule.id}`} style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', fontWeight: 600, cursor: 'pointer' }}>SESIONES CONSECUTIVAS</label>
                              <input
                                id={`rule-sesiones_consecutivas-${rule.id}`}
                                type="number"
                                value={rule.sesiones_consecutivas !== undefined ? rule.sesiones_consecutivas : 2}
                                onChange={(e) => handleRuleChange(idx, 'sesiones_consecutivas', parseInt(e.target.value, 10))}
                                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: 'white', padding: '8px', fontSize: '12px' }}
                              />
                            </div>
                          )}

                          {rule.id === 'autocarga_descanso_densidad' && (
                            <>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <label htmlFor={`rule-umbral_descanso_alto-${rule.id}`} style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', fontWeight: 600, cursor: 'pointer' }}>DESCANSO ALTO (SEG)</label>
                                <input
                                  id={`rule-umbral_descanso_alto-${rule.id}`}
                                  type="number"
                                  value={rule.umbral_descanso_alto !== undefined ? rule.umbral_descanso_alto : 90}
                                  onChange={(e) => handleRuleChange(idx, 'umbral_descanso_alto', parseInt(e.target.value, 10))}
                                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: 'white', padding: '8px', fontSize: '12px' }}
                                />
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <label htmlFor={`rule-sesiones_consecutivas-${rule.id}`} style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', fontWeight: 600, cursor: 'pointer' }}>SESIONES CONSECUTIVAS</label>
                                <input
                                  id={`rule-sesiones_consecutivas-${rule.id}`}
                                  type="number"
                                  value={rule.sesiones_consecutivas !== undefined ? rule.sesiones_consecutivas : 2}
                                  onChange={(e) => handleRuleChange(idx, 'sesiones_consecutivas', parseInt(e.target.value, 10))}
                                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: 'white', padding: '8px', fontSize: '12px' }}
                                />
                              </div>
                            </>
                          )}

                          {rule.id === 'autocarga_evolucion_mecanica' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <label htmlFor={`rule-sesiones_consecutivas-${rule.id}`} style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', fontWeight: 600, cursor: 'pointer' }}>SESIONES CONSECUTIVAS</label>
                              <input
                                id={`rule-sesiones_consecutivas-${rule.id}`}
                                type="number"
                                value={rule.sesiones_consecutivas !== undefined ? rule.sesiones_consecutivas : 2}
                                onChange={(e) => handleRuleChange(idx, 'sesiones_consecutivas', parseInt(e.target.value, 10))}
                                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: 'white', padding: '8px', fontSize: '12px' }}
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* BOTONES DE CONTROL DE REGLAS */}
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={handleResetDefaults}
              >
                ↺ Restaurar Valores Científicos por Defecto
              </button>
            </div>
          </>
        )}

      </div>

      <Toast message={toastState.message} type={toastState.type} visible={toastState.visible} />
    </div>
  );
};

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
    <div style={{
      display: 'flex',
      gap: '10px',
      alignItems: 'center',
      marginTop: '8px',
      flexWrap: 'wrap'
    }}>
      <label htmlFor="exception-exercise-name" style={{
        position: 'absolute',
        width: '1px',
        height: '1px',
        padding: 0,
        margin: '-1px',
        overflow: 'hidden',
        clip: 'rect(0, 0, 0, 0)',
        border: 0
      }}>Nombre del ejercicio</label>
      <input
        id="exception-exercise-name"
        type="text"
        placeholder="Nombre del ejercicio..."
        value={exName}
        onChange={(e) => setExName(e.target.value)}
        style={{
          flex: '1 1 200px',
          background: 'rgba(0, 0, 0, 0.3)',
          border: '1px solid rgba(255,255,255,0.1)',
          color: 'white',
          padding: '10px 14px',
          borderRadius: '8px',
          fontSize: '12px',
          outline: 'none',
          height: '40px',
          boxSizing: 'border-box'
        }}
      />
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        flex: '1 0 auto',
        justifyContent: 'flex-start'
      }}>
        <label htmlFor="exception-exercise-reps" style={{
          position: 'absolute',
          width: '1px',
          height: '1px',
          padding: 0,
          margin: '-1px',
          overflow: 'hidden',
          clip: 'rect(0, 0, 0, 0)',
          border: 0
        }}>Repeticiones para la excepción</label>
        <input
          id="exception-exercise-reps"
          type="number"
          min="1"
          value={reps}
          onChange={(e) => setReps(parseInt(e.target.value, 10))}
          style={{
            width: '65px',
            background: 'rgba(0, 0, 0, 0.3)',
            border: '1px solid rgba(255,255,255,0.1)',
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
            border: '1px solid rgba(255,255,255,0.1)',
            background: 'rgba(255,255,255,0.03)',
            height: '40px',
            borderRadius: '8px',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxSizing: 'border-box',
            transition: 'all 0.2s'
          }}
        >
          Agregar
        </button>
      </div>
    </div>
  );
};

export default ConfigRules;
