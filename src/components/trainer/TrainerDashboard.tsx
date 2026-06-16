import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';
import { useSupabase } from '../../context/SupabaseContext';
import { supabase } from '../../lib/supabaseClient';
import { Profile } from '../../types/database.types';
import Toast from '../common/Toast';
import TrainerAlertsHub from './TrainerAlertsHub';
import OnboardingModal from '../common/OnboardingModal';
import { verificarSuscripcionPushActiva, subscribirNotificacionesPush } from '../../lib/pushNotifications';
import { analizarSobrecargaProgresiva, Session, type Notification } from '../../lib/overload';
import { DEFAULT_RULES } from '../../lib/rules';
import { resolveOverloadRules, resolveOverloadConfig } from '../../lib/sessions';
import { isRealEmailDomain } from '../../lib/validations';

const ALERT_COLORS: Record<string, { bg: string; border: string; text: string; icon: string }> = {
  error: { bg: 'rgba(239, 68, 68, 0.1)', border: 'rgba(239, 68, 68, 0.25)', text: '#f87171', icon: '🔴' },
  warning: { bg: 'rgba(245, 158, 11, 0.1)', border: 'rgba(245, 158, 11, 0.25)', text: '#fbbf24', icon: '🟡' },
  success: { bg: 'rgba(16, 185, 129, 0.1)', border: 'rgba(16, 185, 129, 0.25)', text: '#34d399', icon: '🟢' },
  info: { bg: 'rgba(99, 102, 241, 0.1)', border: 'rgba(99, 102, 241, 0.25)', text: '#a5b4fc', icon: '🔵' },
};

const calculateVolume = (peso: any, seriesReps: any): number => {
  const weight = parseFloat(String(peso)) || 0;
  let totalReps = 0;
  if (Array.isArray(seriesReps)) {
    totalReps = seriesReps.reduce((sum, r) => sum + (parseInt(String(r), 10) || 0), 0);
  } else if (typeof seriesReps === 'string') {
    const parts = seriesReps.split('-');
    totalReps = parts.reduce((sum, r) => sum + (parseInt(r.trim(), 10) || 0), 0);
  } else if (typeof seriesReps === 'number') {
    totalReps = seriesReps;
  }
  return weight * totalReps;
};

const calculateEstimated1RM = (peso: any, seriesReps: any): number => {
  const weight = parseFloat(String(peso)) || 0;
  if (weight <= 0) return 0;
  let repsList: number[] = [];
  if (Array.isArray(seriesReps)) {
    repsList = seriesReps.map(r => parseInt(String(r), 10) || 0).filter(r => r > 0);
  } else if (typeof seriesReps === 'string') {
    repsList = seriesReps.split('-').map(r => parseInt(r.trim(), 10) || 0).filter(r => r > 0);
  } else if (typeof seriesReps === 'number') {
    repsList = [seriesReps];
  }
  if (repsList.length === 0) return weight;
  const rmVals = repsList.map(r => {
    const b = weight / (1.0278 - 0.0278 * Math.min(r, 30));
    const e = weight * (1 + Math.min(r, 30) / 30);
    return (b + e) / 2;
  });
  return Math.max(...rmVals);
};

export const TrainerDashboard: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile, signOut, refreshProfile } = useSupabase();

  const [currentTheme, setCurrentTheme] = useState<string>(() => {
    const saved = localStorage.getItem('pwa_login_theme');
    return saved || 'cyan';
  });

  const [paymentLoading, setPaymentLoading] = useState<boolean>(false);

  // Manejar redirección exitosa o cancelada de MercadoPago
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const paymentSuccess = params.get('payment_success');
    const paymentCancel = params.get('payment_cancel');

    if (paymentSuccess === 'true') {
      showToast('🎉 ¡Tu membresía de entrenador ha sido renovada/actualizada con éxito!', 'success');
      refreshProfile();
      navigate(location.pathname, { replace: true });
    } else if (paymentCancel === 'true') {
      showToast('Pago cancelado. Si tienes dudas, ponte en contacto con soporte.', 'info');
      navigate(location.pathname, { replace: true });
    }
  }, [location.search, navigate, location.pathname, refreshProfile]);

  const handleMercadoPagoCheckout = async (plan: string, redirectPath: string) => {
    setPaymentLoading(true);
    try {
      const response = await fetch('/api/create-mercadopago-preference', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: profile?.id,
          email: profile?.email,
          plan,
          redirectPath,
        }),
      });

      const data = await response.json();
      if (data.url) {
        window.location.href = data.url; // Redirigir a MercadoPago Checkout
      } else {
        throw new Error(data.error || 'No se obtuvo la URL de pago');
      }
    } catch (err: any) {
      console.error('MercadoPago redirect error:', err);
      showToast('Error al conectar con MercadoPago: ' + err.message, 'error');
    } finally {
      setPaymentLoading(false);
    }
  };

  const [themeOpen, setThemeOpen] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'atletas' | 'auditoria'>('atletas');
  const [actividades, setActividades] = useState<any[]>([]);
  const [alertasClientes, setAlertasClientes] = useState<Record<string, Notification[]>>({});
  const [loadingAuditoria, setLoadingAuditoria] = useState(false);
  const [expandedActividades, setExpandedActividades] = useState<Record<string, boolean>>({});
  const [auditViewMode, setAuditViewMode] = useState<'cronologica' | 'ejercicio'>('cronologica');
  const [selectedAnalysisClient, setSelectedAnalysisClient] = useState<string>('all');
  const [selectedAnalysisExercise, setSelectedAnalysisExercise] = useState<string>('all');
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleThemeChange = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setCurrentTheme(detail);
    };
    window.addEventListener('pwa-theme-changed', handleThemeChange);
    return () => window.removeEventListener('pwa-theme-changed', handleThemeChange);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setThemeOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const [clientes, setClientes] = useState<Profile[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [philosophyOpen, setPhilosophyOpen] = useState<boolean>(false);
  const [showAlertsHub, setShowAlertsHub] = useState<boolean>(false);
  const [updatingVigenciaId, setUpdatingVigenciaId] = useState<string | null>(null);

  const [showOnboarding, setShowOnboarding] = useState<boolean>(false);
  const [showPushPrompt, setShowPushPrompt] = useState<boolean>(false);

  // Verificar si es la primera vez que inicia sesión para el Onboarding del Entrenador
  useEffect(() => {
    if (profile) {
      const isOnboarded = localStorage.getItem('evolution_trainer_onboarded_v1');
      if (!isOnboarded) {
        setShowOnboarding(true);
      }
    }
  }, [profile]);

  // Verificar si las notificaciones push están activas y mostrar prompt al entrenador
  useEffect(() => {
    const comprobarPush = async () => {
      if (profile && 'serviceWorker' in navigator && 'PushManager' in window) {
        const activa = await verificarSuscripcionPushActiva();
        const rechazada = localStorage.getItem(`pwa_push_prompt_dismissed_${profile.id}`);
        if (!activa && !rechazada) {
          setShowPushPrompt(true);
        }
      }
    };
    const t = setTimeout(comprobarPush, 4000);
    return () => clearTimeout(t);
  }, [profile]);

  const handleVigenciaLocalChange = (atletaId: string, value: string) => {
    const num = parseInt(value, 10);
    if (isNaN(num)) return;
    setClientes((prev) =>
      prev.map((c) => (c.id === atletaId ? { ...c, vigencia_dias: num } : c))
    );
  };

  const handleVigenciaSave = async (atletaId: string, newVigencia: number) => {
    setUpdatingVigenciaId(atletaId);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ vigencia_dias: newVigencia })
        .eq('id', atletaId);

      if (error) throw error;
      showToast('✅ Vigencia de atleta actualizada.', 'success');
    } catch (err: any) {
      console.error('Error al actualizar vigencia:', err);
      showToast('Error: ' + err.message, 'error');
    } finally {
      setUpdatingVigenciaId(null);
    }
  };

  // Estados de registro de nuevo atleta
  const [registerOpen, setRegisterOpen] = useState<boolean>(false);
  const [newEmail, setNewEmail] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [newName, setNewName] = useState<string>('');
  const [newGoal, setNewGoal] = useState<string>('');
  const [registerLoading, setRegisterLoading] = useState<boolean>(false);

  // Estados de la calculadora 1RM
  const [is1RMModalOpen, setIs1RMModalOpen] = useState<boolean>(false);
  const [calcUnit, setCalcUnit] = useState<'kg' | 'lbs'>('kg');
  const [calcPeso, setCalcPeso] = useState<string>('');
  const [calcReps, setCalcReps] = useState<string>('');
  const [calcFormula, setCalcFormula] = useState<string>('promedio');
  const [rmResult, setRmResult] = useState<number | null>(null);
  const [rmTable, setRmTable] = useState<{ pct: number; carga: number; reps: number }[]>([]);
  const [showPlanInfoModal, setShowPlanInfoModal] = useState<boolean>(false);

  // Estados de Toast
  const [toastState, setToastState] = useState<{ visible: boolean; message: string; type: 'success' | 'error' | 'info' }>({
    visible: false,
    message: '',
    type: 'success',
  });

  const [activePlanDays, setActivePlanDays] = useState<string>('7 Días / Sem');
  const [trainerSubscription, setTrainerSubscription] = useState<{
    plan: string;
    estado: string;
    expira_at: string | null;
  } | null>(null);

  const [clientesLogros, setClientesLogros] = useState<Record<string, { titulo: string, icono: string, tipo: string }[]>>({});
  const [clientesRachas, setClientesRachas] = useState<Record<string, { actual: number, maxima: number }>>({});

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastState({ visible: true, message, type });
    setTimeout(() => {
      setToastState((prev) => ({ ...prev, visible: false }));
    }, 3000);
  };

  const calcularRachaLocal = (sessions: { fecha: string }[]): { actual: number; maxima: number } => {
    if (sessions.length === 0) return { actual: 0, maxima: 0 };
    const dates = [...new Set(sessions.map((s) => s.fecha))].sort();
    if (dates.length === 0) return { actual: 0, maxima: 0 };

    let maxStreak = 1;
    let currentStreak = 1;

    for (let i = 1; i < dates.length; i++) {
      const prev = new Date(dates[i - 1]);
      const curr = new Date(dates[i]);
      const diffDays = Math.round((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24));

      if (diffDays <= 4) {
        currentStreak++;
      } else {
        maxStreak = Math.max(maxStreak, currentStreak);
        currentStreak = 1;
      }
    }
    maxStreak = Math.max(maxStreak, currentStreak);

    const lastDate = new Date(dates[dates.length - 1]);
    const daysSinceLast = Math.round((Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
    const activeStreak = daysSinceLast <= 4 ? currentStreak : 0;

    return { actual: activeStreak, maxima: maxStreak };
  };

  const fetchClientes = async () => {
    setLoading(true);
    try {
      if (profile?.id) {
        const { data: tData, error: tErr } = await supabase
          .from('profiles')
          .select('suscripcion_plan, suscripcion_estado, suscripcion_expira_at')
          .eq('id', profile.id)
          .maybeSingle();
        if (!tErr && tData) {
          setTrainerSubscription({
            plan: tData.suscripcion_plan || 'free',
            estado: tData.suscripcion_estado || 'activo',
            expira_at: tData.suscripcion_expira_at || null
          });
        }
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('rol', 'cliente')
        .order('nombre', { ascending: true });

      if (error) throw error;
      setClientes(data || []);

      if (data && data.length > 0) {
        const clientIds = data.map(c => c.id);

        const { data: achData } = await supabase
          .from('gamificacion')
          .select('cliente_id, titulo, tipo, datos')
          .in('cliente_id', clientIds);

        const logrosMap: Record<string, { titulo: string, icono: string, tipo: string }[]> = {};
        if (achData) {
          achData.forEach((item: any) => {
            if (!logrosMap[item.cliente_id]) {
              logrosMap[item.cliente_id] = [];
            }
            logrosMap[item.cliente_id].push({
              titulo: item.titulo,
              icono: item.datos?.icono || '🏆',
              tipo: item.tipo
            });
          });
        }
        setClientesLogros(logrosMap);

        const { data: sessData } = await supabase
          .from('sesiones_historial')
          .select('cliente_id, fecha')
          .in('cliente_id', clientIds);

        const rachasMap: Record<string, { actual: number; maxima: number }> = {};
        if (sessData) {
          const sessByClient: Record<string, { fecha: string }[]> = {};
          sessData.forEach((s: any) => {
            if (!sessByClient[s.cliente_id]) {
              sessByClient[s.cliente_id] = [];
            }
            sessByClient[s.cliente_id].push({ fecha: s.fecha });
          });

          clientIds.forEach((cid) => {
            const clientSessions = sessByClient[cid] || [];
            rachasMap[cid] = calcularRachaLocal(clientSessions);
          });
        }
        setClientesRachas(rachasMap);

        const { data: plansData, error: plansError } = await supabase
          .from('planes')
          .select('cliente_id, datos_plan')
          .in('cliente_id', clientIds)
          .eq('activo', true);

        if (!plansError && plansData && plansData.length > 0) {
          let totalTrainingDays = 0;
          let activePlansCount = 0;

          plansData.forEach(p => {
            const datosPlan = p.datos_plan as any;
            if (datosPlan && datosPlan.weekdayMapping) {
              const mapping = datosPlan.weekdayMapping;
              const trainingDaysCount = Object.values(mapping).filter(v => Number(v) !== -1).length;
              totalTrainingDays += trainingDaysCount;
              activePlansCount++;
            }
          });

          if (activePlansCount > 0) {
            const avgDays = Math.round(totalTrainingDays / activePlansCount);
            setActivePlanDays(`${avgDays} Días / Sem`);
          } else {
            setActivePlanDays('7 Días / Sem');
          }
        } else {
          setActivePlanDays('7 Días / Sem');
        }
      } else {
        setActivePlanDays('7 Días / Sem');
      }
    } catch (err: any) {
      console.error('Error al cargar clientes:', err);
      showToast('Error al cargar clientes: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchAuditoria = async (force = false) => {
    if (!profile) return;
    // Evitar recargar si ya tenemos datos cargados y no estamos forzando la actualización
    if (actividades.length > 0 && !force) return;

    setLoadingAuditoria(true);
    try {
      // 1. Obtener las últimas 30 sesiones de atletas asignados a este entrenador
      const { data: sesiones, error: errorSesiones } = await supabase
        .from('sesiones_historial')
        .select(`
          id,
          fecha,
          notas_generales,
          cliente_id,
          profiles!inner(id, nombre, entrenador_id),
          sesiones_ejercicios(*)
        `)
        .eq('profiles.entrenador_id', profile.id)
        .order('fecha', { ascending: false })
        .limit(30);

      if (errorSesiones) throw errorSesiones;

      const actList = sesiones || [];
      setActividades(actList);

      // 2. Extraer clientes únicos
      const clientIds = Array.from(new Set(actList.map((s: any) => s.cliente_id)));

      if (clientIds.length > 0) {
        // 3. Consulta Agrupada Única (Batching) para optimizar performance a 1 sola llamada de red
        const { data: ejerData, error: ejerError } = await supabase
          .from('sesiones_ejercicios')
          .select('*, sesiones_historial!inner(fecha, cliente_id)')
          .in('sesiones_historial.cliente_id', clientIds)
          .order('created_at', { ascending: true });

        if (ejerError) throw ejerError;

        // 4. Consulta Agrupada Única (Batching) para planes activos y obtener reglas/configs personalizadas
        const { data: plansData, error: plansError } = await supabase
          .from('planes')
          .select('cliente_id, datos_plan')
          .in('cliente_id', clientIds)
          .eq('activo', true);

        if (plansError) throw plansError;

        // 5. Agrupar ejercicios por cliente en memoria local (0ms en JS)
        const ejerciciosPorCliente: Record<string, Session[]> = {};
        if (ejerData) {
          ejerData.forEach((s: any) => {
            const cid = s.sesiones_historial?.cliente_id;
            if (!cid) return;
            if (!ejerciciosPorCliente[cid]) {
              ejerciciosPorCliente[cid] = [];
            }
            // Límite de control para mantener el motor ágil y ligero
            if (ejerciciosPorCliente[cid].length < 200) {
              ejerciciosPorCliente[cid].push({
                id: s.id,
                fecha: s.sesiones_historial?.fecha || '',
                ejercicio: s.nombre_ejercicio,
                peso: Number(s.peso) || 0,
                rpe_rir: Number(s.rpe_rir) || 2,
                series_reps: Array.isArray(s.series_reps) ? s.series_reps : [],
                descanso: Number(s.descanso) || 90,
                volumen: Number(s.volumen) || 0,
                rm_estimado: Number(s.rm_estimado) || 0,
                grupo: s.grupo_muscular || 'General',
              });
            }
          });
        }

        // 6. Agrupar planes por cliente en memoria local
        const planMap: Record<string, { rules: any[]; config: any; exercises: any[] }> = {};
        if (plansData) {
          plansData.forEach((p) => {
            const datosPlan = p.datos_plan as any;
            const trackerRules = datosPlan?.trackerRules || [];
            const trackerConfig = datosPlan?.trackerConfig || {};
            const exercises: any[] = [];
            if (datosPlan?.trainingDays) {
              datosPlan.trainingDays.forEach((d: any) => {
                if (d.exercises) {
                  exercises.push(...d.exercises);
                }
              });
            }
            planMap[p.cliente_id] = {
              rules: resolveOverloadRules(trackerRules),
              config: resolveOverloadConfig(trackerConfig),
              exercises
            };
          });
        }

        // 7. Ejecutar análisis del motor de sobrecarga con reglas/config del plan de cada cliente
        const mapaAlertas: Record<string, Notification[]> = {};
        clientIds.forEach((cid) => {
          const clientSessions = ejerciciosPorCliente[cid] || [];
          if (clientSessions.length > 0) {
            const resolved = planMap[cid] || {
              rules: DEFAULT_RULES,
              config: {},
              exercises: []
            };
            mapaAlertas[cid] = analizarSobrecargaProgresiva(clientSessions, resolved.rules, resolved.config, resolved.exercises);
          } else {
            mapaAlertas[cid] = [];
          }
        });

        setAlertasClientes(mapaAlertas);
      }
    } catch (err: any) {
      console.error('Error al cargar auditoría:', err);
      showToast('Error al cargar la actividad: ' + err.message, 'error');
    } finally {
      setLoadingAuditoria(false);
    }
  };

  useEffect(() => {
    fetchClientes();
  }, []);

  useEffect(() => {
    if (activeSubTab === 'auditoria') {
      fetchAuditoria();
    }
  }, [activeSubTab]);

  // Filtrar clientes
  const filteredClientes = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return clientes;
    return clientes.filter(
      (c) =>
        c.nombre.toLowerCase().includes(q) ||
        (c.email && c.email.toLowerCase().includes(q))
    );
  }, [clientes, searchQuery]);
  
  // Identificar la sesión más reciente de cada cliente en el feed de auditoría
  const mostRecentSessionIds = useMemo(() => {
    const seenClients = new Set<string>();
    const ids = new Set<string>();
    actividades.forEach((sesion) => {
      if (sesion.cliente_id && !seenClients.has(sesion.cliente_id)) {
        seenClients.add(sesion.cliente_id);
        ids.add(sesion.id);
      }
    });
    return ids;
  }, [actividades]);

  // Aplanar todos los ejercicios de todas las actividades para la vista de progresión
  const aplanadosEjercicios = useMemo(() => {
    const rows: any[] = [];
    
    // Invertimos las actividades para procesarlas cronológicamente de más vieja a más nueva
    const chronologicalSessions = [...actividades].reverse();
    
    chronologicalSessions.forEach((sesion) => {
      const clienteId = sesion.cliente_id;
      const athleteName = sesion.profiles?.nombre || 'Atleta desconocido';
      if (!clienteId) return;
      
      const ejercicios = sesion.sesiones_ejercicios || [];
      ejercicios.forEach((ej: any) => {
        const exName = ej.nombre_ejercicio?.trim();
        if (!exName) return;
        
        const peso = parseFloat(String(ej.peso)) || 0;
        const repsArray: number[] = Array.isArray(ej.series_reps) 
          ? ej.series_reps.map((val: any) => parseInt(String(val), 10) || 0)
          : (typeof ej.series_reps === 'string' 
              ? ej.series_reps.split('-').map((x: string) => parseInt(x.trim(), 10)).filter((x: number) => !isNaN(x)) 
              : []);
        
        const totalReps = repsArray.reduce((sum: number, r: number) => sum + r, 0);
        const volumen = peso * totalReps;
        
        let rm = 0;
        if (repsArray.length > 0) {
          const maxReps = Math.max(...repsArray);
          const epley = peso * (1 + maxReps / 30);
          const brzycki = peso / (1.0278 - 0.0278 * maxReps);
          rm = (epley + brzycki) / 2;
        }
        
        rows.push({
          id_sesion: sesion.id,
          id_ej: ej.id,
          cliente_id: clienteId,
          atleta: athleteName,
          fecha: sesion.fecha || '',
          ejercicio: exName,
          grupo: ej.grupo_muscular || 'General',
          series: repsArray.length,
          repsStr: repsArray.join(', '),
          peso,
          rpe: ej.rpe_rir,
          descanso: ej.descanso,
          volumen,
          rm,
          notas: ej.notas_ej || sesion.notas_generales || ''
        });
      });
    });
    
    // Agrupar filas por cliente y ejercicio para calcular los deltas cronológicos en porcentaje
    const mapPorClienteYEjercicio = new Map<string, any[]>();
    rows.forEach(r => {
      const key = `${r.cliente_id}_${r.ejercicio.toLowerCase()}`;
      if (!mapPorClienteYEjercicio.has(key)) {
        mapPorClienteYEjercicio.set(key, []);
      }
      mapPorClienteYEjercicio.get(key)!.push(r);
    });
    
    const rowsWithDelta = rows.map(r => {
      const key = `${r.cliente_id}_${r.ejercicio.toLowerCase()}`;
      const list = mapPorClienteYEjercicio.get(key) || [];
      const idx = list.findIndex(item => item.fecha === r.fecha && item.id_ej === r.id_ej);
      const prev = idx > 0 ? list[idx - 1] : null;
      
      let deltaHtml = '—';
      let deltaType: 'up' | 'dn' | 'eq' = 'eq';
      
      if (prev && prev.volumen > 0) {
        const diff = r.volumen - prev.volumen;
        const percent = (diff / prev.volumen) * 100;
        if (percent > 0.05) {
          deltaHtml = `▲ ${percent.toFixed(1)}%`;
          deltaType = 'up';
        } else if (percent < -0.05) {
          deltaHtml = `▼ ${Math.abs(percent).toFixed(1)}%`;
          deltaType = 'dn';
        } else {
          deltaHtml = `= 0%`;
          deltaType = 'eq';
        }
      }
      
      return { ...r, deltaHtml, deltaType };
    });
    
    // Ordenar de más reciente a más antiguo para el listado visual
    return rowsWithDelta.reverse();
  }, [actividades]);

  // Lista de ejercicios únicos disponibles para filtrar basados en el cliente seleccionado
  const availableExercisesForFilter = useMemo(() => {
    const set = new Set<string>();
    aplanadosEjercicios.forEach(r => {
      if (selectedAnalysisClient === 'all' || r.cliente_id === selectedAnalysisClient) {
        set.add(r.ejercicio);
      }
    });
    return Array.from(set).sort();
  }, [aplanadosEjercicios, selectedAnalysisClient]);

  // Filtrar las filas de progresión para la tabla final
  const filasFiltradasProgresion = useMemo(() => {
    return aplanadosEjercicios.filter(r => {
      const matchClient = selectedAnalysisClient === 'all' || r.cliente_id === selectedAnalysisClient;
      const matchEx = selectedAnalysisExercise === 'all' || r.ejercicio.toLowerCase() === selectedAnalysisExercise.toLowerCase();
      return matchClient && matchEx;
    });
  }, [aplanadosEjercicios, selectedAnalysisClient, selectedAnalysisExercise]);

  // Resetear filtro de ejercicio si ya no está disponible al cambiar de cliente
  useEffect(() => {
    if (selectedAnalysisExercise !== 'all' && !availableExercisesForFilter.includes(selectedAnalysisExercise)) {
      setSelectedAnalysisExercise('all');
    }
  }, [selectedAnalysisClient, availableExercisesForFilter, selectedAnalysisExercise]);

  // Manejar Registro de Atleta sin interferir sesión actual
  const handleRegisterClient = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegisterLoading(true);

    try {
      if (!profile?.id) throw new Error('Sesión de entrenador no válida.');

      // 1. Obtener datos actualizados del entrenador para validar límites y expiración
      const { data: updatedTrainer, error: trainerError } = await supabase
        .from('profiles')
        .select('suscripcion_plan, suscripcion_estado, suscripcion_expira_at')
        .eq('id', profile.id)
        .maybeSingle();

      if (trainerError) throw trainerError;

      // 2. Validar expiración del entrenador
      const estado = updatedTrainer?.suscripcion_estado || 'activo';
      let isExpired = estado === 'expirado' || estado === 'cancelado';
      if (updatedTrainer?.suscripcion_expira_at) {
        const expDate = new Date(updatedTrainer.suscripcion_expira_at);
        if (!isNaN(expDate.getTime()) && expDate < new Date()) {
          isExpired = true;
        }
      }

      if (isExpired) {
        throw new Error('Tu membresía está inactiva o ha expirado. Por favor, realiza la renovación para poder registrar nuevos atletas.');
      }

      // 3. Validar límite de atletas según plan
      const plan = updatedTrainer?.suscripcion_plan || 'free';
      let limit = 1;
      if (plan === 'iniciacion') limit = 2;
      else if (plan === 'intermedio') limit = 10;
      else if (plan === 'profesional') limit = 999999;

      if (clientes.length >= limit) {
        throw new Error(`Has alcanzado el límite de tu plan actual (${limit} atleta${limit > 1 ? 's' : ''}). Por favor actualiza tu suscripción para continuar.`);
      }

      const isBypass = profile?.rol === 'admin' || profile?.email === 'jmanuel8.5@outlook.com';
      if (!isBypass && !isRealEmailDomain(newEmail)) {
        throw new Error('Por favor ingresa un correo electrónico real y válido (ej: usuario@gmail.com, usuario@hotmail.com). No se admiten correos temporales ni ficticios.');
      }

      // Instancia secundaria independiente de Supabase (evita desloguear al entrenador)
      const secondarySupabase = createClient(
        import.meta.env.VITE_SUPABASE_URL || '',
        import.meta.env.VITE_SUPABASE_ANON_KEY || '',
        {
          auth: {
            persistSession: false,
          },
        }
      );

      const { error } = await secondarySupabase.auth.signUp({
        email: newEmail.trim(),
        password: newPassword,
        options: {
          data: {
            nombre: newName.trim(),
            rol: 'cliente',
            objetivo: newGoal.trim(),
            entrenador_id: profile?.id, // Vincula este atleta al entrenador actual
          },
        },
      });

      if (error) throw error;

      showToast(`🎉 ¡Atleta ${newName} registrado con éxito!`, 'success');
      
      // Limpiar campos
      setNewEmail('');
      setNewPassword('');
      setNewName('');
      setNewGoal('');
      setRegisterOpen(false);

      // Recargar lista
      fetchClientes();
    } catch (err: any) {
      console.error('Error al registrar cliente:', err);
      showToast('Error al registrar: ' + err.message, 'error');
    } finally {
      setRegisterLoading(false);
    }
  };

  const handleCalculate1RM = (e: React.FormEvent) => {
    e.preventDefault();
    const peso = parseFloat(calcPeso);
    const reps = parseInt(calcReps, 10);

    if (isNaN(peso) || peso <= 0 || isNaN(reps) || reps <= 0) {
      showToast('Por favor, ingresa un peso y repeticiones válidos.', 'error');
      return;
    }

    if (reps > 30) {
      showToast('Las fórmulas no son precisas para más de 30 repeticiones.', 'error');
      return;
    }

    let rm = 0;
    if (calcFormula === 'brzycki') {
      rm = peso / (1.0278 - 0.0278 * reps);
    } else if (calcFormula === 'epley') {
      rm = peso * (1 + reps / 30);
    } else { // promedio
      const b = peso / (1.0278 - 0.0278 * reps);
      const e = peso * (1 + reps / 30);
      rm = (b + e) / 2;
    }

    setRmResult(rm);

    // Generar tabla de porcentajes sugeridos
    const tabla = [
      { pct: 100, reps: 1 },
      { pct: 95, reps: 2 },
      { pct: 90, reps: 4 },
      { pct: 85, reps: 6 },
      { pct: 80, reps: 8 },
      { pct: 75, reps: 10 },
      { pct: 70, reps: 12 },
      { pct: 65, reps: 15 },
      { pct: 60, reps: 18 },
    ].map((item) => ({
      pct: item.pct,
      carga: rm * (item.pct / 100),
      reps: item.reps,
    }));

    setRmTable(tabla);
  };

  const handleLogout = async () => {
    if (window.confirm('¿Seguro que deseas cerrar la sesión?')) {
      await signOut();
      navigate('/login');
    }
  };

  const isTrainerExpired = useMemo(() => {
    if (!trainerSubscription) return false;
    const estado = trainerSubscription.estado;
    if (estado === 'expirado' || estado === 'cancelado') return true;
    if (trainerSubscription.expira_at) {
      const expDate = new Date(trainerSubscription.expira_at);
      if (!isNaN(expDate.getTime()) && expDate < new Date()) {
        return true;
      }
    }
    return false;
  }, [trainerSubscription]);

  return (
    <div style={{ background: 'transparent', minHeight: '100vh', color: 'white', paddingBottom: '60px' }}>
      
      {/* HEADER BAR TRAINER */}
      <div className="top-bar" style={{ marginBottom: '10px', padding: '12px 0', position: 'relative', zIndex: 100 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px', maxWidth: '1200px', margin: '0 auto', padding: '0 20px' }}>
          
          {/* Logo & Greeting */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {profile?.logo_url ? (
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
                <img src={profile.logo_url} alt="Brand Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            ) : profile?.marca ? (
              <div
                className="logo-symbol"
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: `linear-gradient(135deg, ${profile.marca.color_primario || '#00d4ff'}, ${profile.marca.color_secundario || '#0070a0'})`,
                  boxShadow: `0 0 12px ${(profile.marca.color_primario || '#00d4ff')}40`
                }}
              >
                <span style={{ fontSize: '11px', fontWeight: 800, color: 'white', fontFamily: "'Orbitron', sans-serif" }}>
                  {(profile.marca.nombre_display || profile.nombre || 'T').split(' ').map((w: string) => w[0]).join('').substring(0, 2).toUpperCase()}
                </span>
              </div>
            ) : (
              <div className="logo-symbol" style={{ width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--theme-btn-gradient)', boxShadow: '0 0 15px var(--theme-glow)' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" />
                  <path d="M2 17l10 5 10-5" />
                  <path d="M2 12l10 5 10-5" />
                </svg>
              </div>
            )}
            <div>
              <h1 style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '15px', fontWeight: 800, margin: 0, letterSpacing: '1px', display: 'flex', alignItems: 'baseline', gap: '6px', flexWrap: 'wrap' }}>
                <span style={{ color: '#ffffff' }}>{profile?.marca?.nombre_display?.toUpperCase() || 'EVOLUTION'}</span> <span className="theme-text-gradient">{profile?.marca ? '' : 'LAB'}</span>
                <span style={{ fontSize: '9px', fontWeight: 500, color: 'rgba(255,255,255,0.45)', fontFamily: "'Orbitron', sans-serif", letterSpacing: '0.5px' }}>Developed by Juan Manuel Cardona</span>
              </h1>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                Entrenador: <span style={{ color: 'var(--theme-secondary)', fontWeight: 600 }}>{profile?.marca?.nombre_display || profile?.nombre || 'Trainer'}</span>
              </div>
            </div>
          </div>
          {/* Navigation group */}
          <div className="nav-container" style={{ margin: 0, overflow: 'visible' }}>
            <div className="nav-group nav-group-plan" style={{ border: 'none', padding: 0 }}>
              <div className="nav-group-tabs" style={{ background: 'rgba(255,255,255,0.03)', padding: '4px', borderRadius: '10px', display: 'flex', gap: '4px' }}>
                <button
                  className={`tab ${activeSubTab === 'atletas' ? 'active' : ''}`}
                  onClick={() => setActiveSubTab('atletas')}
                  style={{ fontSize: '11px', padding: '8px 14px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '6px', border: 'none', cursor: 'pointer', fontFamily: "'Orbitron', sans-serif" }}
                >
                  <svg className="tab-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                  Atletas
                </button>
                <button
                  className={`tab ${activeSubTab === 'auditoria' ? 'active' : ''}`}
                  onClick={() => setActiveSubTab('auditoria')}
                  style={{ fontSize: '11px', padding: '8px 14px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '6px', border: 'none', cursor: 'pointer', fontFamily: "'Orbitron', sans-serif" }}
                >
                  <svg className="tab-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                  </svg>
                  Auditoría / Sesiones
                </button>
                <button
                  className="tab"
                  onClick={() => navigate('/trainer/config')}
                  style={{ fontSize: '11px', padding: '8px 14px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '6px', border: 'none', cursor: 'pointer', fontFamily: "'Orbitron', sans-serif" }}
                >
                  <svg className="tab-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                  </svg>
                  Reglas Motor
                </button>
                <button
                  className="tab"
                  onClick={() => navigate('/trainer/branding')}
                  style={{ fontSize: '11px', padding: '8px 14px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '6px', border: 'none', cursor: 'pointer', fontFamily: "'Orbitron', sans-serif" }}
                >
                  <svg className="tab-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2L2 7l10 5 10-5-10-5z" />
                    <path d="M2 17l10 5 10-5" />
                    <path d="M2 12l10 5 10-5" />
                  </svg>
                  Mi Marca
                </button>
                <button
                  className="tab"
                  onClick={() => navigate('/dashboard')}
                  style={{ fontSize: '11px', padding: '8px 14px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '6px', border: 'none', cursor: 'pointer', fontFamily: "'Orbitron', sans-serif", color: 'var(--theme-primary)' }}
                >
                  <svg className="tab-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
                    <path d="M2 8h16v8H2z" />
                    <path d="M6 12h4" />
                  </svg>
                  Mi Entrenamiento
                </button>
              </div>
            </div>
          {/* Professional dropdown theme selector button and floating menu */}
          <div ref={dropdownRef} style={{ position: 'relative', marginLeft: '10px', zIndex: 100 }}>
            <button
              onClick={() => setThemeOpen(!themeOpen)}
              style={{
                fontSize: '11px',
                fontFamily: "'Orbitron', sans-serif",
                fontWeight: 700,
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '10px',
                color: 'white',
                padding: '8px 14px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.2s',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                height: '32px'
              }}
            >
              <span style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: currentTheme === 'gothic' ? '#990000' : (
                  currentTheme === 'cyberpunk' ? '#ccff00' :
                  currentTheme === 'monochrome' ? '#ffffff' :
                  currentTheme === 'green' ? '#00ff87' :
                  currentTheme === 'lava' ? '#ff6b00' :
                  currentTheme === 'gold' ? '#d4af37' : '#00d4ff'
                ),
                boxShadow: `0 0 6px ${
                  currentTheme === 'gothic' ? '#990000' : (
                    currentTheme === 'cyberpunk' ? '#ccff00' :
                    currentTheme === 'monochrome' ? '#ffffff' :
                    currentTheme === 'green' ? '#00ff87' :
                    currentTheme === 'lava' ? '#ff6b00' :
                    currentTheme === 'gold' ? '#d4af37' : '#00d4ff'
                  )
                }`
              }} />
              Elegir Tema
              <svg
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  transform: themeOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s'
                }}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {themeOpen && (
              <div style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: '8px',
                background: 'rgba(15, 23, 42, 0.95)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '12px',
                padding: '6px',
                display: 'flex',
                flexDirection: 'column',
                gap: '2px',
                minWidth: '185px',
                boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                zIndex: 999
              }}>
                {(['cyan', 'cyberpunk', 'monochrome', 'green', 'lava', 'gold', 'gothic'] as const).map((th) => {
                  const colors = {
                    cyan: '#00d4ff',
                    cyberpunk: '#ccff00',
                    monochrome: '#ffffff',
                    green: '#00ff87',
                    lava: '#ff6b00',
                    gold: '#d4af37',
                    gothic: '#990000'
                  };
                  const titles = {
                    cyan: 'Evolution Cyan',
                    cyberpunk: 'Cyberpunk Acid',
                    monochrome: 'Monochrome Raw',
                    green: 'Forest Bio-Green',
                    lava: 'Lava Crimson',
                    gold: 'Royal Gold',
                    gothic: 'Gothic Void'
                  };
                  const active = currentTheme === th;
                  return (
                    <button
                      key={th}
                      onClick={() => {
                        setCurrentTheme(th);
                        localStorage.setItem('pwa_login_theme', th);
                        document.documentElement.setAttribute('data-theme', th);
                        window.dispatchEvent(new CustomEvent('pwa-theme-changed', { detail: th }));
                        setThemeOpen(false);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        width: '100%',
                        padding: '8px 12px',
                        background: active ? 'rgba(255,255,255,0.06)' : 'transparent',
                        border: 'none',
                        borderRadius: '8px',
                        color: active ? 'white' : 'rgba(255,255,255,0.65)',
                        fontSize: '11px',
                        fontFamily: "'Orbitron', sans-serif",
                        fontWeight: active ? 700 : 500,
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                        e.currentTarget.style.color = 'white';
                      }}
                      onMouseLeave={(e) => {
                        if (!active) {
                          e.currentTarget.style.background = 'transparent';
                          e.currentTarget.style.color = 'rgba(255,255,255,0.65)';
                        }
                      }}
                    >
                      <span style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: colors[th],
                        boxShadow: active ? `0 0 6px ${colors[th]}` : 'none'
                      }} />
                      {titles[th]}
                      {active && (
                        <span style={{ marginLeft: 'auto', color: 'var(--theme-primary)', fontWeight: 'bold', fontSize: '9px' }}>✓</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <button
            onClick={handleLogout}
              style={{
                fontSize: '11px',
                fontFamily: "'Orbitron', sans-serif",
                fontWeight: 700,
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                borderRadius: '10px',
                color: '#fca5a5',
                padding: '8px 14px',
                cursor: 'pointer',
                marginLeft: '10px',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              Salir
            </button>
          </div>
 
        </div>
      </div>

      {/* Banner de Suscripción Sutil del Entrenador */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.02)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
        borderTop: '1px solid rgba(255, 255, 255, 0.02)',
        padding: '6px 20px',
        textAlign: 'center',
        fontSize: '9px',
        fontFamily: "'Orbitron', sans-serif",
        fontWeight: 600,
        letterSpacing: '1.2px',
        color: 'rgba(255, 255, 255, 0.65)',
        textTransform: 'uppercase',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: '6px',
        marginBottom: '20px'
      }}>
        <span style={{
          display: 'inline-block',
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          background: trainerSubscription?.estado === 'activo' ? 'var(--theme-primary)' : '#ef4444'
        }} />
        <span>
          Plan {
            trainerSubscription?.plan === 'free' ? 'Gratuito' :
            trainerSubscription?.plan === 'iniciacion' ? 'Iniciación' :
            trainerSubscription?.plan === 'intermedio' ? 'Intermedio' :
            trainerSubscription?.plan === 'profesional' ? 'Profesional' : 'Gratuito'
          }
        </span>
        <button
          onClick={() => setShowPlanInfoModal(true)}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--theme-primary)',
            fontSize: '11px',
            cursor: 'pointer',
            padding: '2px 4px',
            display: 'inline-flex',
            alignItems: 'center',
            fontWeight: 'bold'
          }}
          title="Ver detalles del plan de entrenador"
        >
          ⓘ
        </button>
      </div>

      {/* Modal de Información del Plan del Entrenador */}
      {showPlanInfoModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 9999,
          padding: '20px'
        }} onClick={() => setShowPlanInfoModal(false)}>
          <div style={{
            background: 'var(--theme-card-bg, #0f172a)',
            border: '1px solid var(--theme-border, rgba(255, 255, 255, 0.1))',
            borderRadius: '20px',
            padding: '24px',
            maxWidth: '420px',
            width: '100%',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
            position: 'relative',
            color: 'white',
            fontFamily: "'Orbitron', sans-serif",
            textAlign: 'left'
          }} onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setShowPlanInfoModal(false)}
              style={{
                position: 'absolute',
                top: '15px',
                right: '15px',
                background: 'none',
                border: 'none',
                color: 'rgba(255,255,255,0.5)',
                fontSize: '18px',
                cursor: 'pointer'
              }}
            >
              ✕
            </button>
            <h3 style={{ fontSize: '13px', color: 'var(--theme-primary, #00d4ff)', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '16px', marginTop: 0 }}>
              Detalles de Suscripción Coach
            </h3>
            <div>
              <div style={{ fontSize: '15px', fontWeight: 800, color: 'white', marginBottom: '12px' }}>
                Plan: {
                  trainerSubscription?.plan === 'free' ? 'Gratuito (Free) 🍃' :
                  trainerSubscription?.plan === 'iniciacion' ? 'Iniciación 🚀' :
                  trainerSubscription?.plan === 'intermedio' ? 'Intermedio ⚡' :
                  trainerSubscription?.plan === 'profesional' ? 'Profesional 🔥' : 'Gratuito 🍃'
                }
              </div>
              <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)', lineHeight: '1.6', fontFamily: 'sans-serif' }}>
                <p style={{ margin: '0 0 10px 0' }}>
                  • <strong>Atletas Vinculados:</strong> {clientes.length} de {
                    trainerSubscription?.plan === 'free' ? '1' :
                    trainerSubscription?.plan === 'iniciacion' ? '2' :
                    trainerSubscription?.plan === 'intermedio' ? '10' : 'Ilimitados'
                  } atletas permitidos.
                </p>
                <p style={{ margin: '0 0 10px 0' }}>• <strong>Estado de Membresía:</strong> {
                  trainerSubscription?.estado === 'activo' ? 'Al Día / Activa' :
                  trainerSubscription?.estado === 'expirado' ? 'Expirada (Requiere Pago)' : 'Inactiva'
                }.</p>
                <p style={{ margin: '0 0 10px 0' }}>• <strong>Restricciones de Vencimiento:</strong> Al vencer tu plan, se bloquea tu acceso al panel y el acceso de todos tus atletas vinculados de forma inmediata.</p>
                
                {trainerSubscription?.expira_at && (
                  <p style={{ margin: '14px 0 0 0', color: 'var(--theme-primary, #00d4ff)', fontWeight: 600, fontFamily: "'Orbitron', sans-serif", fontSize: '10px', letterSpacing: '0.5px' }}>
                    FECHA DE EXPIRACIÓN: {new Date(trainerSubscription.expira_at).toLocaleDateString()}
                  </p>
                )}

                <div style={{ 
                  marginTop: '20px', 
                  paddingTop: '16px', 
                  borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: '12px' 
                }}>
                  <p style={{ margin: 0, fontSize: '11px', color: 'rgba(255, 255, 255, 0.6)', fontFamily: 'sans-serif', lineHeight: '1.4' }}>
                    Renueva o actualiza tu membresía de forma automática:
                  </p>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <button
                      onClick={() => handleMercadoPagoCheckout('iniciacion', '/trainer')}
                      disabled={paymentLoading}
                      style={{
                        background: 'linear-gradient(135deg, rgba(255,255,255,0.05), rgba(255,255,255,0.01))',
                        border: '1px solid rgba(255,255,255,0.1)', color: 'white',
                        padding: '10px 14px', borderRadius: '8px', fontSize: '10px',
                        fontFamily: "'Orbitron', sans-serif", fontWeight: 700,
                        cursor: paymentLoading ? 'not-allowed' : 'pointer', display: 'flex',
                        justifyContent: 'space-between', alignItems: 'center'
                      }}
                    >
                      <span>PLAN INICIACIÓN (Hasta 2 Atletas)</span>
                      <span style={{ color: 'var(--theme-primary)' }}>$14.900 COP 💳</span>
                    </button>

                    <button
                      onClick={() => handleMercadoPagoCheckout('intermedio', '/trainer')}
                      disabled={paymentLoading}
                      style={{
                        background: 'linear-gradient(135deg, rgba(0, 212, 255, 0.1), rgba(0, 212, 255, 0.02))',
                        border: '1px solid rgba(0, 212, 255, 0.25)', color: 'white',
                        padding: '10px 14px', borderRadius: '8px', fontSize: '10px',
                        fontFamily: "'Orbitron', sans-serif", fontWeight: 700,
                        cursor: paymentLoading ? 'not-allowed' : 'pointer', display: 'flex',
                        justifyContent: 'space-between', alignItems: 'center',
                        boxShadow: '0 0 10px rgba(0, 212, 255, 0.05)'
                      }}
                    >
                      <span>PLAN INTERMEDIO (Hasta 10 Atletas)</span>
                      <span style={{ color: 'var(--theme-primary)' }}>$59.900 COP 💳</span>
                    </button>

                    <button
                      onClick={() => handleMercadoPagoCheckout('profesional', '/trainer')}
                      disabled={paymentLoading}
                      style={{
                        background: 'linear-gradient(135deg, rgba(123, 47, 247, 0.1), rgba(123, 47, 247, 0.02))',
                        border: '1px solid rgba(123, 47, 247, 0.25)', color: 'white',
                        padding: '10px 14px', borderRadius: '8px', fontSize: '10px',
                        fontFamily: "'Orbitron', sans-serif", fontWeight: 700,
                        cursor: paymentLoading ? 'not-allowed' : 'pointer', display: 'flex',
                        justifyContent: 'space-between', alignItems: 'center'
                      }}
                    >
                      <span>PLAN PROFESIONAL (Atletas ilimitados)</span>
                      <span style={{ color: 'var(--theme-primary)' }}>$299.000 COP 💳</span>
                    </button>
                  </div>

                  <p style={{ margin: '8px 0 0 0', fontSize: '11px', color: 'rgba(255, 255, 255, 0.6)', fontFamily: 'sans-serif', lineHeight: '1.4' }}>
                    O si prefieres Nequi/PSE, contacta por soporte:
                  </p>
                  <a 
                    href="https://wa.me/573113666959?text=Hola,%20quisiera%20renovar%20o%20actualizar%20mi%20membres%C3%ADa%20de%20entrenador%20en%20Evolution%20Lab" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      background: 'rgba(37, 211, 102, 0.12)',
                      border: '1px solid rgba(37, 211, 102, 0.35)',
                      color: '#4ade80',
                      textDecoration: 'none',
                      padding: '10px 16px',
                      borderRadius: '10px',
                      fontSize: '11px',
                      fontWeight: 'bold',
                      fontFamily: "'Orbitron', sans-serif",
                      transition: 'background 0.2s',
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12.012 2c-5.506 0-9.988 4.482-9.988 9.988 0 1.761.459 3.477 1.332 5.002L2 22l5.166-1.355c1.478.807 3.14 1.231 4.834 1.231 5.505 0 9.987-4.482 9.987-9.988C22 6.482 17.518 2 12.012 2zm5.748 14.244c-.244.688-1.218 1.25-1.688 1.294-.47.043-.941.206-3.036-.653-2.522-1.034-4.148-3.606-4.275-3.774-.127-.168-.942-1.25-.942-2.388 0-1.137.596-1.696.807-1.926.212-.23.47-.287.625-.287.155 0 .31.002.443.007.14.006.327-.053.511.393.189.462.646 1.579.702 1.695.056.117.094.253.016.41-.078.156-.172.254-.253.351-.08.098-.168.204-.242.274-.084.08-.173.167-.074.337.099.17 4.4 7.6 1.722.956.136-.08.232-.167.311-.274.078-.107.039-.253-.02-.37-.058-.117-.511-1.231-.702-1.694-.188-.448-.372-.39-.511-.397-.13-.007-.28-.007-.43-.007-.15 0-.393.056-.599.28-.206.224-.786.769-.786 1.874 0 1.106.804 2.17 1.135 2.502.13.167.242.311.37.447.168.16.337.284.475.39.138.106.28.188.423.27.142.083.284.142.423.189z" />
                    </svg>
                    Pagar por WhatsApp 💬
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {isTrainerExpired ? (
        <div className="container stagger-3" style={{ padding: '40px 20px', maxWidth: '800px', margin: '0 auto', textAlign: 'center' }}>
          <div style={{ background: 'rgba(15, 23, 42, 0.75)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '24px', padding: '40px 24px', boxShadow: '0 20px 50px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', gap: '24px', backdropFilter: 'blur(10px)' }}>
            <div style={{ display: 'inline-flex', alignSelf: 'center', width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', alignItems: 'center', justifyContent: 'center', fontSize: '28px', color: '#f87171' }}>
              🔒
            </div>
            <div>
              <h2 style={{ fontFamily: "'Orbitron', sans-serif", fontSize: '20px', fontWeight: 800, color: 'white', letterSpacing: '1px', marginBottom: '8px' }}>ACCESO SUSPENDIDO</h2>
              <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', lineHeight: '1.6' }}>
                Tu suscripción de entrenador ha vencido o se encuentra inactiva. Para continuar gestionando tus atletas, por favor renueva tu membresía seleccionando uno de nuestros planes.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginTop: '10px' }}>
              <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '16px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px', justifyContent: 'space-between' }}>
                <div>
                  <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', fontWeight: 700, letterSpacing: '0.5px', display: 'block' }}>PLAN INICIACIÓN</span>
                  <span style={{ fontSize: '16px', fontWeight: 800, color: 'white', fontFamily: "'Orbitron', sans-serif", display: 'block', margin: '4px 0' }}>$14.900 <span style={{ fontSize: '10px', fontWeight: 500, color: 'rgba(255,255,255,0.4)' }}>COP/mes</span></span>
                  <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', display: 'block' }}>Hasta 2 Atletas</span>
                </div>
                <button
                  onClick={() => handleMercadoPagoCheckout('iniciacion', '/trainer')}
                  disabled={paymentLoading}
                  style={{
                    width: '100%',
                    background: 'linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.05))',
                    border: '1px solid rgba(255,255,255,0.15)',
                    color: 'white',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    fontSize: '9px',
                    fontFamily: "'Orbitron', sans-serif",
                    fontWeight: 700,
                    cursor: paymentLoading ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s',
                    marginTop: '8px'
                  }}
                >
                  {paymentLoading ? 'PROCESANDO...' : 'PAGAR CON MERCADOPAGO 💳'}
                </button>
              </div>
              <div style={{ background: 'rgba(0, 212, 255, 0.04)', border: '1px solid rgba(0, 212, 255, 0.25)', borderRadius: '16px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px', justifyContent: 'space-between', boxShadow: '0 0 15px rgba(0, 212, 255, 0.1)' }}>
                <div>
                  <span style={{ fontSize: '10px', color: 'var(--theme-primary)', fontWeight: 700, letterSpacing: '0.5px', display: 'block' }}>PLAN INTERMEDIO</span>
                  <span style={{ fontSize: '16px', fontWeight: 800, color: 'white', fontFamily: "'Orbitron', sans-serif", display: 'block', margin: '4px 0' }}>$59.900 <span style={{ fontSize: '10px', fontWeight: 500, color: 'rgba(255,255,255,0.4)' }}>COP/mes</span></span>
                  <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', display: 'block' }}>Hasta 10 Atletas</span>
                </div>
                <button
                  onClick={() => handleMercadoPagoCheckout('intermedio', '/trainer')}
                  disabled={paymentLoading}
                  style={{
                    width: '100%',
                    background: 'linear-gradient(135deg, rgba(0, 212, 255, 0.2), rgba(0, 212, 255, 0.05))',
                    border: '1px solid rgba(0, 212, 255, 0.35)',
                    color: 'white',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    fontSize: '9px',
                    fontFamily: "'Orbitron', sans-serif",
                    fontWeight: 700,
                    cursor: paymentLoading ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s',
                    marginTop: '8px',
                    boxShadow: '0 0 8px rgba(0, 212, 255, 0.15)'
                  }}
                >
                  {paymentLoading ? 'PROCESANDO...' : 'PAGAR CON MERCADOPAGO 💳'}
                </button>
              </div>
              <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '16px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px', justifyContent: 'space-between' }}>
                <div>
                  <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', fontWeight: 700, letterSpacing: '0.5px', display: 'block' }}>PLAN PROFESIONAL</span>
                  <span style={{ fontSize: '16px', fontWeight: 800, color: 'white', fontFamily: "'Orbitron', sans-serif", display: 'block', margin: '4px 0' }}>$299.000 <span style={{ fontSize: '10px', fontWeight: 500, color: 'rgba(255,255,255,0.4)' }}>COP/mes</span></span>
                  <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', display: 'block' }}>Atletas Ilimitados</span>
                </div>
                <button
                  onClick={() => handleMercadoPagoCheckout('profesional', '/trainer')}
                  disabled={paymentLoading}
                  style={{
                    width: '100%',
                    background: 'linear-gradient(135deg, rgba(123, 47, 247, 0.2), rgba(123, 47, 247, 0.05))',
                    border: '1px solid rgba(123, 47, 247, 0.35)',
                    color: 'white',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    fontSize: '9px',
                    fontFamily: "'Orbitron', sans-serif",
                    fontWeight: 700,
                    cursor: paymentLoading ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s',
                    marginTop: '8px',
                    boxShadow: '0 0 8px rgba(123, 47, 247, 0.15)'
                  }}
                >
                  {paymentLoading ? 'PROCESANDO...' : 'PAGAR CON MERCADOPAGO 💳'}
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '10px', alignItems: 'center' }}>
              <a
                href={`https://wa.me/573113666959?text=Hola!%20Deseo%20renovar%20mi%20membresia%20de%20entrenador%20en%20Evolution%20Lab.%20Mi%20correo%20de%20usuario%20es:%20${encodeURIComponent(profile?.email || '')}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  background: 'linear-gradient(135deg, #25D366, #128C7E)',
                  color: 'white', textDecoration: 'none', padding: '14px 28px', borderRadius: '12px',
                  fontSize: '12px', fontFamily: "'Orbitron', sans-serif", fontWeight: 700,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  boxShadow: '0 4px 15px rgba(37, 211, 102, 0.25)', transition: 'all 0.2s', width: '100%', maxWidth: '380px'
                }}
              >
                <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.457L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.37 9.864-9.799.002-2.63-1.023-5.101-2.885-6.963C16.588 2.015 14.117.99 11.5.99c-5.442 0-9.87 4.372-9.874 9.802-.001 1.73.469 3.414 1.36 4.916l-.993 3.629 3.655-.947zm11.758-5.326c-.301-.15-1.78-.877-2.056-.977-.276-.1-.477-.15-.677.15-.2.3-.776.977-.951 1.176-.176.2-.351.226-.652.076-.301-.15-1.272-.469-2.423-1.496-.895-.798-1.5-1.783-1.676-2.083-.176-.3-.019-.462.132-.611.135-.134.301-.35.452-.525.15-.175.2-.3.301-.5.1-.2.05-.375-.025-.525-.075-.15-.677-1.628-.927-2.228-.243-.584-.489-.505-.677-.514-.175-.008-.376-.01-.577-.01s-.527.075-.802.375c-.276.3-1.053 1.026-1.053 2.503s1.078 2.902 1.228 3.102c.15.2 2.122 3.24 5.143 4.545.718.311 1.279.497 1.717.637.722.23 1.379.197 1.9.12.58-.087 1.78-.727 2.03-1.43.25-.702.25-1.303.176-1.43-.076-.127-.276-.201-.577-.351z"/>
                </svg>
                SOLICITAR RENOVACIÓN POR WHATSAPP
              </a>
              <button
                onClick={handleLogout}
                style={{
                  background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)',
                  padding: '12px 28px', borderRadius: '12px', fontSize: '11px', fontFamily: "'Orbitron', sans-serif",
                  fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s', width: '100%', maxWidth: '380px'
                }}
              >
                CERRAR SESIÓN
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="container stagger-3" style={{ padding: '0 20px', maxWidth: '1200px', margin: '0 auto' }}>
          {/* Banner de invitación a activar notificaciones Push */}
          {showPushPrompt && (
            <div style={{
              background: 'linear-gradient(135deg, rgba(0, 212, 255, 0.1), rgba(123, 47, 247, 0.08))',
              border: '1px solid var(--theme-border)',
              borderRadius: '14px',
              padding: '16px 20px',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px',
              flexWrap: 'wrap',
              boxShadow: '0 4px 16px var(--theme-glow)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: '1 1 300px' }}>
                <span style={{ fontSize: '24px' }}>🔔</span>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--theme-primary)', fontFamily: "'Orbitron', sans-serif", letterSpacing: '0.5px' }}>ACTIVAR NOTIFICACIONES PUSH</div>
                  <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', marginTop: '4px', lineHeight: '1.4' }}>Recibe alertas al instante en tu celular sobre el rendimiento, fatiga e incrementos de carga de tus atletas.</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button
                  onClick={async () => {
                    if (profile) {
                      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
                        showToast('Tu navegador no soporta notificaciones push.', 'info');
                        setShowPushPrompt(false);
                        return;
                      }
                      if (Notification.permission === 'denied') {
                        showToast('Las notificaciones están bloqueadas en los ajustes del navegador.', 'info');
                        setShowPushPrompt(false);
                        return;
                      }
                      const ok = await subscribirNotificacionesPush(profile.id);
                      if (ok) {
                        showToast('🔔 ¡Notificaciones push activadas con éxito!', 'success');
                      } else {
                        const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
                        showToast(
                          isLocal
                            ? 'Las notificaciones push solo funcionan en producción (HTTPS). Sube los cambios a tu repositorio y prueba desde tu dominio desplegado.'
                            : 'No se pudo activar las notificaciones. Verifica que hayas aceptado los permisos e inténtalo de nuevo.',
                          'info'
                        );
                      }
                      setShowPushPrompt(false);
                    }
                  }}
                  style={{
                    background: 'var(--theme-btn-gradient)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '30px',
                    padding: '8px 18px',
                    fontSize: '11px',
                    fontWeight: 700,
                    fontFamily: "'Orbitron', sans-serif",
                    cursor: 'pointer',
                    boxShadow: '0 2px 10px var(--theme-btn-glow)',
                    transition: 'all 0.2s'
                  }}
                >
                  ACTIVAR
                </button>
                <button
                  onClick={() => {
                    if (profile) {
                      localStorage.setItem(`pwa_push_prompt_dismissed_${profile.id}`, 'true');
                      setShowPushPrompt(false);
                    }
                  }}
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    color: 'rgba(255,255,255,0.6)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '30px',
                    padding: '8px 18px',
                    fontSize: '11px',
                    fontWeight: 700,
                    fontFamily: "'Orbitron', sans-serif",
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  DESCARTAR
                </button>
              </div>
            </div>
          )}
          <div style={{ display: activeSubTab === 'atletas' ? 'block' : 'none' }}>
            {/* STATS OVERVIEW CARDS */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '24px' }}>
          <div className="mcard" style={{ background: 'var(--theme-card-bg)', borderColor: 'var(--theme-secondary)', boxShadow: '0 8px 32px 0 var(--theme-glow)' }}>
            <div className="mcard-label" style={{ color: 'var(--theme-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              Atletas Vinculados
            </div>
            <div className="mcard-value" style={{ fontFamily: "'Orbitron', sans-serif", fontSize: '28px', fontWeight: 800 }}>{clientes.length}</div>
          </div>
          <div className="mcard" style={{ background: 'var(--theme-card-bg)', borderColor: 'var(--theme-primary)', boxShadow: '0 8px 32px 0 var(--theme-glow)' }}>
            <div className="mcard-label" style={{ color: 'var(--theme-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="20" x2="18" y2="10" />
                <line x1="12" y1="20" x2="12" y2="4" />
                <line x1="6" y1="20" x2="6" y2="14" />
              </svg>
              Planificación Activa
            </div>
            <div className="mcard-value" style={{ fontFamily: "'Orbitron', sans-serif", fontSize: '28px', fontWeight: 800 }}>{activePlanDays}</div>
          </div>
          <div className="mcard" style={{ background: 'rgba(16, 185, 129, 0.08)', borderColor: 'rgba(16, 185, 129, 0.25)', boxShadow: '0 8px 32px 0 rgba(16, 185, 129, 0.05)' }}>
            <div className="mcard-label" style={{ color: '#34d399', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
              Motor de Sobrecarga
            </div>
            <div className="mcard-value" style={{ fontFamily: "'Orbitron', sans-serif", fontSize: '28px', fontWeight: 800 }}>Científico Activo</div>
          </div>
        </div>

        {/* ALERTS HUB BUTTON */}
        <div style={{ marginBottom: '24px' }}>
          <button
            onClick={() => setShowAlertsHub(true)}
            style={{
              width: '100%', padding: '16px 20px', borderRadius: '14px', cursor: 'pointer',
              background: 'var(--theme-card-bg)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              transition: 'all 0.3s ease',
              boxShadow: '0 4px 16px rgba(239, 68, 68, 0.08)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '22px' }}>📊</span>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#fca5a5', fontFamily: "'Orbitron', sans-serif", letterSpacing: '0.5px' }}>HUB DE ALERTAS</div>
                <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.45)', marginTop: '2px' }}>Ver estado de sobrecarga progresiva de todos tus atletas</div>
              </div>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fca5a5" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>

        {/* MI ENTRENAMIENTO PERSONAL CARD */}
        {profile && (
          <div style={{
            background: 'var(--theme-card-bg)',
            border: '1px solid var(--theme-border)',
            borderRadius: '16px',
            padding: '20px',
            marginBottom: '24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '15px',
            boxShadow: '0 8px 32px 0 var(--theme-glow)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)'
          }}>
            <div>
              <h3 style={{ fontFamily: "'Orbitron', sans-serif", fontSize: '15px', fontWeight: 800, margin: 0, color: 'var(--theme-primary)', letterSpacing: '0.5px', display: 'flex', alignItems: 'center' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
                  <path d="M6.5 6.5h11M6.5 4h-2a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h2M17.5 4h2a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-2" />
                </svg>
                MI ENTRENAMIENTO PERSONAL
              </h3>
              <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)', marginTop: '4px' }}>
                Planifica tu propio programa de entrenamiento, registra tus sesiones de sobrecarga progresiva y mira tus métricas personales.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                className="btn btn-primary"
                onClick={() => navigate(`/trainer/plan/${profile.id}`)}
                style={{ background: 'var(--theme-btn-gradient)', fontSize: '11px', padding: '10px 16px', fontFamily: "'Orbitron', sans-serif", fontWeight: 700, cursor: 'pointer', border: 'none', borderRadius: '8px', color: 'white', display: 'inline-flex', alignItems: 'center', gap: '6px', boxShadow: '0 4px 14px var(--theme-btn-glow)' }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg> Planificar Mi Rutina
              </button>
              <button
                className="btn"
                onClick={() => navigate('/dashboard')}
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', fontSize: '11px', padding: '10px 16px', fontFamily: "'Orbitron', sans-serif", fontWeight: 700, cursor: 'pointer', borderRadius: '8px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M6.5 6.5h11M6.5 4h-2a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h2M17.5 4h2a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-2"/></svg> Entrar a Entrenar
              </button>
            </div>
          </div>
        )}

        {/* COLLAPSIBLE PHILOSOPHY CARD */}
        <div style={{ marginBottom: '25px' }}>
          <div
            className={`philosophy-toggle${philosophyOpen ? ' open' : ''}`}
            onClick={() => setPhilosophyOpen(!philosophyOpen)}
            style={{
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              borderRadius: '12px',
              padding: '16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              cursor: 'pointer',
              transition: 'all 0.3s ease'
            }}
          >
            <span className="philosophy-toggle-title" style={{ fontWeight: 700, fontSize: '13px', fontFamily: "'Orbitron', sans-serif", color: 'var(--theme-primary)', letterSpacing: '0.5px', textTransform: 'uppercase', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> Nuestra Filosofía de Entrenamiento
            </span>
            <span className="philosophy-toggle-icon" style={{ fontSize: '12px', color: 'var(--theme-primary)', transition: 'transform 0.3s ease' }}>
              {philosophyOpen ? '▲' : '▼'}
            </span>
          </div>

          <div
            className="philosophy-collapsible"
            style={{
              maxHeight: philosophyOpen ? '3000px' : '0px',
              overflow: 'hidden',
              transition: 'all 0.5s cubic-bezier(0, 1, 0, 1)'
            }}
          >
            <div className="philosophy-section" style={{ borderTop: 'none', marginTop: 0, padding: '24px 20px', background: 'rgba(15, 23, 42, 0.35)', borderBottomLeftRadius: '12px', borderBottomRightRadius: '12px' }}>
              <h2 className="philosophy-title" style={{ fontSize: '1.5rem' }}>SISTEMA DE ENTRENAMIENTO</h2>
              <p className="philosophy-author">
                Por <span id="trainerNameDisplay">{profile?.marca?.nombre_display || profile?.nombre || 'Evolution Lab'}</span>
              </p>

              <div className="philosophy-quote">
                <p style={{ whiteSpace: 'pre-line' }}>
                  {profile?.marca?.eslogan || 'NO NECESITAS ENTRENAR MÁS.\nNECESITAS ENTRENAR MEJOR.'}
                </p>
              </div>

              <p className="philosophy-description">
                Este sistema fue diseñado para maximizar resultados a través de estímulo inteligente, técnica eficiente y progresión estructurada.
              </p>

              <h3 className="philosophy-subtitle">¿QUÉ HACE DIFERENTE ESTE MÉTODO?</h3>

              <div className="philosophy-grid">
                {/* Pilar 1 */}
                <div className="philosophy-card">
                  <span className="pillar-number">Pilar 01</span>
                  <strong>ENTRENAMIENTO BASADO EN ESTÍMULO REAL</strong>
                  <p>Cada ejercicio tiene una función específica dentro del programa. Nada está puesto al azar.</p>
                </div>

                {/* Pilar 2 */}
                <div className="philosophy-card">
                  <span className="pillar-number">Pilar 02</span>
                  <strong>INTENSIDAD CONTROLADA</strong>
                  <p>No buscamos agotarte. Buscamos generar adaptación. La intensidad se utiliza estratégicamente para progresar sin destruir la recuperación.</p>
                </div>

                {/* Pilar 3 */}
                <div className="philosophy-card">
                  <span className="pillar-number">Pilar 03</span>
                  <strong>TÉCNICA COMO PRIORIDAD</strong>
                  <p>La ejecución determina qué músculo trabaja realmente. Menos ego. Más control. Más resultados.</p>
                </div>

                {/* Pilar 4 */}
                <div className="philosophy-card">
                  <span className="pillar-number">Pilar 04</span>
                  <strong>PROGRESIÓN MEDIBLE</strong>
                  <p>El objetivo no es “sentir” que entrenaste fuerte. El objetivo es mejorar rendimiento, composición corporal y capacidad física semana tras semana.</p>
                </div>

                {/* Pilar 5 */}
                <div className="philosophy-card full-width">
                  <span className="pillar-number">Pilar 05</span>
                  <strong>RECUPERACIÓN PLANIFICADA</strong>
                  <p>Dormir, recuperarse y manejar la fatiga también hacen parte del progreso.</p>
                </div>
              </div>

              <div className="philosophy-footer">
                <p>AQUÍ NO SE ENTRENA POR MOTIVACIÓN.<br />SE ENTRENA CON ESTRUCTURA, PROPÓSITO Y DIRECCIÓN.</p>
              </div>
            </div>
          </div>
        </div>

        {/* TOP SEARCH & BUTTONS */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px', marginBottom: '25px' }}>
          <div style={{ position: 'relative', flex: 1, maxWidth: '400px' }}>
            <input
              type="text"
              placeholder="Buscar atleta por nombre o email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '10px',
                color: 'white',
                padding: '12px 16px',
                fontSize: '13px'
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button
              onClick={() => {
                if (!profile?.id) return;
                const inviteUrl = `${window.location.origin}/login?ref=${profile.id}`;
                navigator.clipboard.writeText(inviteUrl);
                showToast('📋 Enlace de invitación copiado al portapapeles', 'info');
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontFamily: "'Orbitron', sans-serif",
                fontSize: '11px',
                fontWeight: 700,
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: 'white',
                padding: '10px 16px',
                borderRadius: '10px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
              </svg>
              Copiar Enlace Invitación
            </button>

            <button
              onClick={() => setRegisterOpen(true)}
              className="btn btn-primary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontFamily: "'Orbitron', sans-serif", fontSize: '11px', fontWeight: 700 }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="8.5" cy="7" r="4" />
                <line x1="20" y1="8" x2="20" y2="14" />
                <line x1="17" y1="11" x2="23" y2="11" />
              </svg>
              Registrar Nuevo Atleta
            </button>
          </div>
        </div>

        {/* REGISTER CLIENT MODAL */}
        {registerOpen && (
          <div className={`modal-overlay modal-overlay-enter ${registerOpen ? 'open' : ''}`} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 99999 }}>
            <div className="modal-box modal-enter" style={{ maxWidth: '450px', width: '90%', border: '1px solid var(--theme-border)', boxShadow: '0 20px 50px var(--theme-glow)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '12px', marginBottom: '15px' }}>
                <h3 style={{ margin: 0, fontFamily: "'Orbitron', sans-serif", color: 'var(--theme-primary)', fontSize: '1rem', letterSpacing: '0.5px', display: 'flex', alignItems: 'center' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}>
                    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="8.5" cy="7" r="4" />
                    <line x1="20" y1="8" x2="20" y2="14" />
                    <line x1="17" y1="11" x2="23" y2="11" />
                  </svg>
                  REGISTRAR ATLETA
                </h3>
                <button onClick={() => setRegisterOpen(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '20px', cursor: 'pointer' }}>&times;</button>
              </div>

              <form onSubmit={handleRegisterClient} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '10px', color: 'rgba(255,255,255,0.6)', fontWeight: 700, marginBottom: '6px' }}>NOMBRE COMPLETO</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Juan Manuel Cardona"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'white', padding: '10px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '10px', color: 'rgba(255,255,255,0.6)', fontWeight: 700, marginBottom: '6px' }}>CORREO ELECTRÓNICO</label>
                  <input
                    type="email"
                    required
                    placeholder="ejemplo@correo.com"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'white', padding: '10px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '10px', color: 'rgba(255,255,255,0.6)', fontWeight: 700, marginBottom: '6px' }}>CONTRASEÑA TEMPORAL</label>
                  <input
                    type="password"
                    required
                    placeholder="Min. 6 caracteres"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'white', padding: '10px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '10px', color: 'rgba(255,255,255,0.6)', fontWeight: 700, marginBottom: '6px' }}>OBJETIVO / FOCO PRINCIPAL</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Hipertrofia general, Fuerza en banca"
                    value={newGoal}
                    onChange={(e) => setNewGoal(e.target.value)}
                    style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'white', padding: '10px' }}
                  />
                </div>

                <button type="submit" className="btn btn-primary" disabled={registerLoading} style={{ marginTop: '10px' }}>
                  <span>{registerLoading ? 'REGISTRANDO ATLETA...' : 'Confirmar y Guardar'}</span>
                </button>
              </form>
            </div>
          </div>
        )}

        {/* CLIENTS LIST GRID */}
        {loading ? (
            <div style={{ textAlign: 'center', padding: '60px', color: 'var(--theme-primary)', fontFamily: 'Orbitron, sans-serif' }}>
              <span>Cargando atletas vinculados...</span>
            </div>
          ) : filteredClientes.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', background: 'var(--theme-card-bg)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', border: '1px solid var(--theme-border)', borderRadius: '16px' }}>
            <p style={{ color: 'rgba(255,255,255,0.4)' }}>No se encontraron atletas vinculados.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
            {filteredClientes.map((atleta) => {
              const formattedDate = atleta.fecha_inicio ? atleta.fecha_inicio.split('-').reverse().join('/') : '-';
              return (
                <div
                  key={atleta.id}
                  className="stagger-item"
                  style={{
                    background: 'var(--theme-card-bg)',
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                    border: '1px solid var(--theme-border)',
                    borderRadius: '16px',
                    padding: '24px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '20px',
                    position: 'relative',
                    overflow: 'hidden'
                  }}
                >
                  {/* Conic Glow top highlight */}
                  <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '4px', background: 'var(--theme-btn-gradient)' }} />

                  <div>
                    <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: 700, color: 'white', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--theme-primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> {atleta.nombre}
                    </h3>
                    <p style={{ margin: '0 0 14px 0', fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>{atleta.email}</p>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '11px', background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.04)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'rgba(255,255,255,0.5)' }}>Objetivo:</span>
                        <span style={{ fontWeight: 600, color: 'var(--theme-primary)' }}>{atleta.objetivo || 'Sin objetivo'}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'rgba(255,255,255,0.5)' }}>Fecha inicio:</span>
                        <span style={{ fontWeight: 600 }}>{formattedDate}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: 'rgba(255,255,255,0.5)' }}>Vigencia (días):</span>
                        <input
                          type="number"
                          min="1"
                          max="9999"
                          disabled={updatingVigenciaId === atleta.id}
                          value={atleta.vigencia_dias !== undefined ? atleta.vigencia_dias : ''}
                          placeholder="30"
                          onChange={(e) => handleVigenciaLocalChange(atleta.id, e.target.value)}
                          onBlur={(e) => {
                            const val = parseInt(e.target.value, 10);
                            if (!isNaN(val)) {
                              handleVigenciaSave(atleta.id, val);
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              const val = parseInt((e.target as HTMLInputElement).value, 10);
                              if (!isNaN(val)) {
                                handleVigenciaSave(atleta.id, val);
                                (e.target as HTMLInputElement).blur();
                              }
                            }
                          }}
                          style={{
                            width: '60px',
                            background: 'rgba(0, 0, 0, 0.3)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: '4px',
                            padding: '2px 6px',
                            color: 'white',
                            textAlign: 'right',
                            fontSize: '11px',
                            fontFamily: "'Orbitron', sans-serif",
                            outline: 'none',
                          }}
                        />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '6px', marginTop: '2px' }}>
                        <span style={{ color: 'rgba(255,255,255,0.5)' }}>Racha Activa:</span>
                        <span style={{ fontWeight: 600, color: '#fbbf24' }}>
                          🔥 {clientesRachas[atleta.id]?.actual || 0} días
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: 'rgba(255,255,255,0.5)' }}>Logros:</span>
                        <span style={{ fontWeight: 600, color: '#34d399' }}>
                          🏆 {clientesLogros[atleta.id]?.length || 0}
                        </span>
                      </div>
                      {clientesLogros[atleta.id] && clientesLogros[atleta.id].length > 0 && (
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '2px' }}>
                          {clientesLogros[atleta.id].map((logro, idx) => (
                            <span key={idx} title={logro.titulo} style={{ fontSize: '13px' }}>
                              {logro.icono}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                    <button
                      className="btn btn-primary"
                      onClick={() => navigate(`/trainer/plan/${atleta.id}`)}
                      style={{ flex: 1, padding: '10px 0', fontSize: '11px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '4px' }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg> Planificar
                    </button>
                    <button
                      className="btn btn-ghost"
                      onClick={() => navigate('/trainer/config')}
                      style={{ flex: 1, padding: '10px 0', fontSize: '11px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '4px' }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg> Reglas
                    </button>
                  </div>

                </div>
              );
            })}
          </div>
        )}
          </div>

          {(actividades.length > 0 || loadingAuditoria || activeSubTab === 'auditoria') && (
            <div className="stagger-item" style={{ animationDelay: '0.1s', display: activeSubTab === 'auditoria' ? 'block' : 'none' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
              <h2 style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '18px', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: 'var(--theme-primary)' }}>📊</span> HISTORIAL DE ACTIVIDAD Y AUDITORÍA
              </h2>
              <button
                onClick={() => fetchAuditoria(true)}
                disabled={loadingAuditoria}
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '8px',
                  color: 'white',
                  padding: '6px 12px',
                  fontSize: '11px',
                  fontFamily: "'Orbitron', sans-serif",
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.2s',
                  opacity: loadingAuditoria ? 0.6 : 1
                }}
              >
                <span>🔄</span> Actualizar Actividad
              </button>
            </div>

            {/* Selector de sub-vistas de auditoría */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', justifyContent: 'flex-start' }}>
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '4px', borderRadius: '10px', display: 'flex', gap: '4px' }}>
                <button
                  onClick={() => setAuditViewMode('cronologica')}
                  style={{
                    fontSize: '10px',
                    padding: '6px 12px',
                    borderRadius: '8px',
                    border: 'none',
                    cursor: 'pointer',
                    fontFamily: "'Orbitron', sans-serif",
                    fontWeight: 600,
                    transition: 'all 0.2s',
                    background: auditViewMode === 'cronologica' ? 'var(--theme-btn-gradient)' : 'transparent',
                    color: auditViewMode === 'cronologica' ? 'white' : 'rgba(255,255,255,0.5)',
                    boxShadow: auditViewMode === 'cronologica' ? '0 0 10px var(--theme-btn-glow)' : 'none',
                  }}
                >
                  ⏱️ Vista Cronológica
                </button>
                <button
                  onClick={() => setAuditViewMode('ejercicio')}
                  style={{
                    fontSize: '10px',
                    padding: '6px 12px',
                    borderRadius: '8px',
                    border: 'none',
                    cursor: 'pointer',
                    fontFamily: "'Orbitron', sans-serif",
                    fontWeight: 600,
                    transition: 'all 0.2s',
                    background: auditViewMode === 'ejercicio' ? 'var(--theme-btn-gradient)' : 'transparent',
                    color: auditViewMode === 'ejercicio' ? 'white' : 'rgba(255,255,255,0.5)',
                    boxShadow: auditViewMode === 'ejercicio' ? '0 0 10px var(--theme-btn-glow)' : 'none',
                  }}
                >
                  📊 Análisis por Ejercicio
                </button>
              </div>
            </div>

            {loadingAuditoria ? (
              <div style={{ textAlign: 'center', padding: '60px', color: 'var(--theme-primary)', fontFamily: 'Orbitron, sans-serif' }}>
                <span>Analizando registros y procesando sobrecarga progresiva...</span>
              </div>
            ) : actividades.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', background: 'var(--theme-card-bg)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', border: '1px solid var(--theme-border)', borderRadius: '16px' }}>
                <p style={{ color: 'rgba(255,255,255,0.4)' }}>No hay sesiones registradas por tus atletas en los últimos días.</p>
              </div>
            ) : auditViewMode === 'cronologica' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {actividades.map((sesion) => {
                  const hasExercises = sesion.sesiones_ejercicios && sesion.sesiones_ejercicios.length > 0;
                  const isExpanded = !!expandedActividades[sesion.id];
                  const formattedDate = sesion.fecha ? sesion.fecha.split('-').reverse().join('/') : '-';
                  
                  // Alertas de este atleta particular (solo en su sesión más reciente)
                  const isMostRecent = mostRecentSessionIds.has(sesion.id);
                  const alertasAtleta = isMostRecent ? (alertasClientes[sesion.cliente_id] || []) : [];

                  return (
                    <div
                      key={sesion.id}
                      style={{
                        background: 'var(--theme-card-bg)',
                        backdropFilter: 'blur(20px)',
                        WebkitBackdropFilter: 'blur(20px)',
                        border: '1px solid var(--theme-border)',
                        borderRadius: '16px',
                        padding: '20px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px',
                        transition: 'all 0.3s ease',
                        boxShadow: '0 4px 20px rgba(0,0,0,0.15)'
                      }}
                    >
                      {/* Cabecera de la tarjeta de sesión */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                        <div>
                          <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'white', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            👤 {sesion.profiles?.nombre || 'Atleta desconocido'}
                          </h3>
                          <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', display: 'inline-block', marginTop: '2px' }}>
                            📅 Registro: {formattedDate}
                          </span>
                        </div>

                        {/* Botón desplegable para ver series */}
                        {hasExercises && (
                          <button
                            onClick={() => setExpandedActividades(prev => ({ ...prev, [sesion.id]: !isExpanded }))}
                            style={{
                              background: isExpanded ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)',
                              border: '1px solid rgba(255,255,255,0.08)',
                              borderRadius: '8px',
                              color: 'white',
                              padding: '6px 12px',
                              fontSize: '11px',
                              fontFamily: "'Orbitron', sans-serif",
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px'
                            }}
                          >
                            <span>{isExpanded ? 'Ocultar Detalle' : 'Ver Detalle'}</span>
                            <span>{isExpanded ? '▲' : '▼'}</span>
                          </button>
                        )}
                      </div>

                      {/* Sección de Alertas en Caliente de este cliente */}
                      {alertasAtleta.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', background: 'rgba(255,255,255,0.01)', padding: '10px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.03)' }}>
                          <div style={{ width: '100%', fontSize: '9px', color: 'rgba(255,255,255,0.35)', fontFamily: "'Orbitron', sans-serif", letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '4px' }}>
                            Alertas de Progreso Activas (Motor de Progresión)
                          </div>
                          {alertasAtleta.map((alerta, idx) => {
                            const styles = ALERT_COLORS[alerta.tipo] || { bg: 'rgba(255,255,255,0.05)', border: 'rgba(255,255,255,0.1)', text: 'white', icon: '❓' };
                            return (
                              <div
                                key={idx}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  background: styles.bg,
                                  border: `1px solid ${styles.border}`,
                                  borderRadius: '6px',
                                  padding: '4px 8px',
                                  fontSize: '10px',
                                  fontWeight: 600,
                                  color: styles.text
                                }}
                              >
                                <span>{styles.icon}</span>
                                <span><strong>{alerta.ejercicio}:</strong> {alerta.mensaje}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Notas de la sesión */}
                      {sesion.notas_generales && (
                        <div style={{ fontSize: '12px', fontStyle: 'italic', color: 'rgba(255,255,255,0.6)', background: 'rgba(255,255,255,0.02)', padding: '10px 14px', borderRadius: '10px', borderLeft: '3px solid var(--theme-primary)' }}>
                          📝 "{sesion.notas_generales}"
                        </div>
                      )}

                      {/* Desglose de ejercicios completados (acordeón expandible) */}
                      {hasExercises && isExpanded && (
                        <div style={{
                          marginTop: '4px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px',
                          background: 'rgba(0,0,0,0.15)',
                          padding: '14px',
                          borderRadius: '12px',
                          border: '1px solid rgba(255,255,255,0.04)'
                        }}>
                          <div style={{ fontSize: '10px', fontFamily: "'Orbitron', sans-serif", color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
                            Ejercicios Completados
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '10px' }}>
                            {sesion.sesiones_ejercicios.map((ej: any) => {
                              const itemVolumen = calculateVolume(ej.peso, ej.series_reps);
                              const itemRM = calculateEstimated1RM(ej.peso, ej.series_reps);
                              return (
                                <div
                                  key={ej.id}
                                  style={{
                                    background: 'rgba(255,255,255,0.02)',
                                    border: '1px solid rgba(255,255,255,0.04)',
                                    borderRadius: '8px',
                                    padding: '10px',
                                    fontSize: '12px'
                                  }}
                                >
                                  <div style={{ fontWeight: 700, color: 'white', marginBottom: '6px' }}>
                                    🏋️ {ej.nombre_ejercicio}
                                  </div>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', color: 'rgba(255,255,255,0.6)', fontSize: '11px' }}>
                                    <div>
                                      <span style={{ color: 'rgba(255,255,255,0.4)' }}>Series / Reps:</span>{' '}
                                      <span style={{ fontWeight: 600, color: 'white' }}>
                                        {Array.isArray(ej.series_reps) ? ej.series_reps.join(' - ') : ej.series_reps || '-'}
                                      </span>
                                    </div>
                                    <div>
                                      <span style={{ color: 'rgba(255,255,255,0.4)' }}>Carga:</span>{' '}
                                      <span style={{ fontWeight: 600, color: '#34d399' }}>{ej.peso} kg</span>
                                    </div>
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                      <div>
                                        <span style={{ color: 'rgba(255,255,255,0.4)' }}>Vol:</span>{' '}
                                        <span style={{ fontWeight: 600, color: '#10b981' }}>{itemVolumen} kg</span>
                                      </div>
                                      <div>
                                        <span style={{ color: 'rgba(255,255,255,0.4)' }}>1RM Est:</span>{' '}
                                        <span style={{ fontWeight: 600, color: '#fbbf24' }}>{Math.round(itemRM)} kg</span>
                                      </div>
                                    </div>
                                    <div>
                                      <span style={{ color: 'rgba(255,255,255,0.4)' }}>RPE / RIR:</span>{' '}
                                      <span style={{ fontWeight: 600, color: '#fbbf24' }}>{ej.rpe_rir}</span>
                                    </div>
                                    {ej.descanso && (
                                      <div>
                                        <span style={{ color: 'rgba(255,255,255,0.4)' }}>Descanso:</span>{' '}
                                        <span>{ej.descanso} seg</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Filtros de la Vista de Análisis */}
                <div style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '12px',
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.05)',
                  borderRadius: '12px',
                  padding: '16px',
                  alignItems: 'center'
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '180px', flex: 1 }}>
                    <label style={{ fontSize: '9px', fontWeight: 700, color: 'rgba(255,255,255,0.4)', fontFamily: "'Orbitron', sans-serif", letterSpacing: '0.5px' }}>FILTRAR POR ATLETA</label>
                    <select
                      value={selectedAnalysisClient}
                      onChange={(e) => {
                        setSelectedAnalysisClient(e.target.value);
                        setSelectedAnalysisExercise('all');
                      }}
                      style={{
                        background: 'rgba(0, 0, 0, 0.45)',
                        border: '1px solid var(--theme-border)',
                        borderRadius: '8px',
                        padding: '10px',
                        color: 'white',
                        fontSize: '12px',
                        fontFamily: "'Orbitron', sans-serif",
                        outline: 'none',
                      }}
                    >
                      <option value="all">👥 Todos los Atletas</option>
                      {clientes.map((client) => (
                        <option key={client.id} value={client.id}>👤 {client.nombre}</option>
                      ))}
                    </select>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '180px', flex: 1 }}>
                    <label style={{ fontSize: '9px', fontWeight: 700, color: 'rgba(255,255,255,0.4)', fontFamily: "'Orbitron', sans-serif", letterSpacing: '0.5px' }}>FILTRAR POR EJERCICIO</label>
                    <select
                      value={selectedAnalysisExercise}
                      onChange={(e) => setSelectedAnalysisExercise(e.target.value)}
                      style={{
                        background: 'rgba(0, 0, 0, 0.45)',
                        border: '1px solid var(--theme-border)',
                        borderRadius: '8px',
                        padding: '10px',
                        color: 'white',
                        fontSize: '12px',
                        fontFamily: "'Orbitron', sans-serif",
                        outline: 'none',
                      }}
                    >
                      <option value="all">🏋️ Todos los Ejercicios</option>
                      {availableExercisesForFilter.map((exName) => (
                        <option key={exName} value={exName}>{exName}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Contenedor de Resultados del Análisis */}
                <div className="table-wrap" style={{ background: 'var(--theme-card-bg)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', border: '1px solid var(--theme-border)', borderRadius: '16px', overflow: 'hidden' }}>
                  <div className="table-scroll" style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                          <th style={{ padding: '12px 16px' }}>Fecha</th>
                          {selectedAnalysisClient === 'all' && <th style={{ padding: '12px 16px' }}>Atleta</th>}
                          <th style={{ padding: '12px 16px' }}>Ejercicio</th>
                          <th style={{ padding: '12px 16px' }}>Grupo</th>
                          <th style={{ padding: '12px 16px', textAlign: 'center' }}>Series</th>
                          <th style={{ padding: '12px 16px', textAlign: 'center' }}>Reps</th>
                          <th style={{ padding: '12px 16px', textAlign: 'center' }}>Peso (kg)</th>
                          <th style={{ padding: '12px 16px', textAlign: 'center' }}>RIR</th>
                          <th style={{ padding: '12px 16px', textAlign: 'center' }}>Descanso</th>
                          <th style={{ padding: '12px 16px', textAlign: 'right' }}>Volumen</th>
                          <th style={{ padding: '12px 16px', textAlign: 'right' }}>1RM est.</th>
                          <th style={{ padding: '12px 16px', textAlign: 'center' }}>Δ Vol.</th>
                          <th style={{ padding: '12px 16px' }}>Notas</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filasFiltradasProgresion.length === 0 ? (
                          <tr>
                            <td colSpan={selectedAnalysisClient === 'all' ? 13 : 12} style={{ textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.4)' }}>
                              No se encontraron registros de ejercicios con los filtros seleccionados.
                            </td>
                          </tr>
                        ) : (
                          filasFiltradasProgresion.map((f, index) => {
                            const formattedDate = f.fecha ? f.fecha.split('-').reverse().join('/') : '-';
                            return (
                              <tr key={index} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.2s' }}>
                                <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>{formattedDate}</td>
                                {selectedAnalysisClient === 'all' && (
                                  <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--theme-secondary)' }}>{f.atleta}</td>
                                )}
                                <td style={{ padding: '12px 16px', fontWeight: 600, whiteSpace: 'nowrap' }}>{f.ejercicio}</td>
                                <td style={{ padding: '12px 16px' }}>
                                  <span className={`badge badge-${f.grupo.toLowerCase()}`} style={{ padding: '3px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase' }}>
                                    {f.grupo}
                                  </span>
                                </td>
                                <td style={{ padding: '12px 16px', textAlign: 'center' }}>{f.series}</td>
                                <td style={{ padding: '12px 16px', textAlign: 'center', whiteSpace: 'nowrap' }}>{f.repsStr}</td>
                                <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700 }}>{f.peso}</td>
                                <td style={{ padding: '12px 16px', textAlign: 'center' }}>{f.rpe}</td>
                                <td style={{ padding: '12px 16px', textAlign: 'center' }}>{f.descanso ? `${f.descanso}s` : '-'}</td>
                                <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600 }}>{f.volumen.toLocaleString()}</td>
                                <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: 'var(--theme-primary)' }}>{f.rm.toFixed(1)}</td>
                                <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                                  {f.deltaType === 'up' && (
                                    <span style={{
                                      color: '#10b981',
                                      fontWeight: 700,
                                      background: 'rgba(16, 185, 129, 0.1)',
                                      padding: '2px 6px',
                                      borderRadius: '4px',
                                      fontFamily: "'Orbitron', sans-serif",
                                      fontSize: '10px'
                                    }}>
                                      {f.deltaHtml}
                                    </span>
                                  )}
                                  {f.deltaType === 'dn' && (
                                    <span style={{
                                      color: '#ef4444',
                                      fontWeight: 700,
                                      background: 'rgba(239, 68, 68, 0.1)',
                                      padding: '2px 6px',
                                      borderRadius: '4px',
                                      fontFamily: "'Orbitron', sans-serif",
                                      fontSize: '10px'
                                    }}>
                                      {f.deltaHtml}
                                    </span>
                                  )}
                                  {f.deltaType === 'eq' && (
                                    <span style={{
                                      color: 'rgba(255,255,255,0.4)',
                                      fontWeight: 700,
                                      background: 'rgba(255,255,255,0.05)',
                                      padding: '2px 6px',
                                      borderRadius: '4px',
                                      fontFamily: "'Orbitron', sans-serif",
                                      fontSize: '10px'
                                    }}>
                                      {f.deltaHtml}
                                    </span>
                                  )}
                                </td>
                                <td style={{ padding: '12px 16px', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={f.notas}>
                                  {f.notas}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      )}

      {/* Floating Action Button (FAB) for 1RM calculator */}
      <button
        id="fab1RMBtn"
        onClick={() => setIs1RMModalOpen(true)}
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          background: 'var(--theme-btn-gradient)',
          border: 'none',
          borderRadius: '50%',
          width: '48px',
          height: '48px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          cursor: 'pointer',
          boxShadow: '0 4px 20px var(--theme-btn-glow)',
          zIndex: 1000,
          transition: 'all 0.2s'
        }}
        title="Calculadora 1RM"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
          <line x1="9" y1="22" x2="9" y2="16" />
          <line x1="15" y1="22" x2="15" y2="16" />
          <line x1="9" y1="16" x2="15" y2="16" />
          <line x1="9" y1="12" x2="15" y2="12" />
          <line x1="9" y1="8" x2="15" y2="8" />
          <line x1="12" y1="8" x2="12" y2="12" />
        </svg>
      </button>

      {/* 1RM CALCULATOR MODAL OVERLAY */}
      {is1RMModalOpen && (
        <div id="modal-1rm" className={`modal-overlay-enter ${is1RMModalOpen ? 'open' : ''}`} onClick={(e) => { if (e.target === e.currentTarget) { setIs1RMModalOpen(false); setRmResult(null); } }}>
          <div className="modal-1rm-box modal-enter">
            <div className="modal-1rm-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '16px' }}>🧮</span>
                <span className="modal-1rm-title">CALCULADORA 1RM</span>
              </div>
              <button className="modal-1rm-close" onClick={() => { setIs1RMModalOpen(false); setRmResult(null); }}>&times;</button>
            </div>

            <form onSubmit={handleCalculate1RM} className="modal-1rm-form">
              {/* Unit Switcher */}
              <div className="modal-1rm-group full-width" style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '15px' }}>
                <label style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.5)', fontFamily: "'Orbitron', sans-serif" }}>UNIDAD DE MEDIDA</label>
                <div style={{ display: 'flex', gap: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--theme-border)', borderRadius: '10px', padding: '4px', maxWidth: '160px' }}>
                  <button
                    type="button"
                    onClick={() => { setCalcUnit('kg'); setRmResult(null); }}
                    style={{
                      flex: 1,
                      border: 'none',
                      borderRadius: '6px',
                      padding: '6px 12px',
                      fontSize: '11px',
                      fontFamily: "'Orbitron', sans-serif",
                      fontWeight: 700,
                      cursor: 'pointer',
                      background: calcUnit === 'kg' ? 'var(--theme-btn-gradient)' : 'transparent',
                      color: calcUnit === 'kg' ? 'white' : 'rgba(255,255,255,0.6)',
                      boxShadow: calcUnit === 'kg' ? '0 0 10px var(--theme-btn-glow)' : 'none',
                      transition: 'all 0.2s'
                    }}
                  >
                    KG
                  </button>
                  <button
                    type="button"
                    onClick={() => { setCalcUnit('lbs'); setRmResult(null); }}
                    style={{
                      flex: 1,
                      border: 'none',
                      borderRadius: '6px',
                      padding: '6px 12px',
                      fontSize: '11px',
                      fontFamily: "'Orbitron', sans-serif",
                      fontWeight: 700,
                      cursor: 'pointer',
                      background: calcUnit === 'lbs' ? 'var(--theme-btn-gradient)' : 'transparent',
                      color: calcUnit === 'lbs' ? 'white' : 'rgba(255,255,255,0.6)',
                      boxShadow: calcUnit === 'lbs' ? '0 0 10px var(--theme-btn-glow)' : 'none',
                      transition: 'all 0.2s'
                    }}
                  >
                    LBS
                  </button>
                </div>
              </div>

              <div className="modal-1rm-group">
                <label htmlFor="input1RMPeso" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                  <span>PESO LEVANTADO ({calcUnit.toUpperCase()})</span>
                  {calcPeso && !isNaN(parseFloat(calcPeso)) && parseFloat(calcPeso) > 0 && (
                    <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', fontFamily: "'Orbitron', sans-serif" }}>
                      ≈ {(calcUnit === 'kg' ? parseFloat(calcPeso) * 2.20462 : parseFloat(calcPeso) / 2.20462).toFixed(1)} {calcUnit === 'kg' ? 'lbs' : 'kg'}
                    </span>
                  )}
                </label>
                <input
                  type="number"
                  id="input1RMPeso"
                  step="any"
                  value={calcPeso}
                  onChange={(e) => setCalcPeso(e.target.value)}
                  required
                  placeholder={calcUnit === 'kg' ? 'Ej: 80' : 'Ej: 175'}
                />
              </div>
              <div className="modal-1rm-group">
                <label htmlFor="input1RMReps">REPETICIONES</label>
                <input
                  type="number"
                  id="input1RMReps"
                  min="1"
                  max="30"
                  value={calcReps}
                  onChange={(e) => setCalcReps(e.target.value)}
                  required
                  placeholder="Ej: 5"
                />
              </div>
              <div className="modal-1rm-group full-width">
                <label htmlFor="select1RMFormula">FÓRMULA</label>
                <select
                  id="select1RMFormula"
                  value={calcFormula}
                  onChange={(e) => setCalcFormula(e.target.value)}
                >
                  <option value="promedio">Promedio Automático (Recomendado)</option>
                  <option value="brzycki">Brzycki</option>
                  <option value="epley">Epley</option>
                </select>
              </div>
              <button type="submit" className="modal-1rm-btn-calc full-width">🧮 Calcular 1RM</button>
            </form>

            {rmResult !== null && (
              <div className="modal-1rm-result" style={{ display: 'block' }}>
                <div className="modal-1rm-result-title">1RM Estimado</div>
                <div className="modal-1rm-value-display" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', padding: '10px 0' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                    <span style={{ fontSize: '2.2rem', fontWeight: 800 }}>{rmResult.toFixed(1)}</span>
                    <span style={{ fontSize: '1.1rem', color: 'var(--theme-primary)', fontWeight: 700 }}>{calcUnit}</span>
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)', fontFamily: "'Orbitron', sans-serif" }}>
                    ≈ {(calcUnit === 'kg' ? rmResult * 2.20462 : rmResult / 2.20462).toFixed(1)} {calcUnit === 'kg' ? 'lbs' : 'kg'}
                  </div>
                </div>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '8px', textAlign: 'center' }}>Tabla de Porcentajes de Carga</div>
                <div className="modal-1rm-table-container">
                  <table className="modal-1rm-table">
                    <thead>
                      <tr>
                        <th>%</th>
                        <th>Carga ({calcUnit})</th>
                        <th>Equivalencia</th>
                        <th>Repeticiones sugeridas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rmTable.map((row) => {
                        const equiv = calcUnit === 'kg' ? row.carga * 2.20462 : row.carga / 2.20462;
                        return (
                          <tr key={row.pct}>
                            <td style={{ fontWeight: 600, color: 'var(--theme-primary)' }}>{row.pct}%</td>
                            <td style={{ fontWeight: 700, color: '#7EC94A' }}>{row.carga.toFixed(1)} {calcUnit}</td>
                            <td style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px' }}>{equiv.toFixed(1)} {calcUnit === 'kg' ? 'lbs' : 'kg'}</td>
                            <td>{row.reps} {row.reps === 1 ? 'rep' : 'reps'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Alerts Hub Modal */}
      <TrainerAlertsHub visible={showAlertsHub} onClose={() => setShowAlertsHub(false)} />

      {/* Onboarding welcome modal */}
      {showOnboarding && (
        <OnboardingModal 
          onClose={() => setShowOnboarding(false)} 
          rol="entrenador" 
        />
      )}

      <Toast message={toastState.message} type={toastState.type} visible={toastState.visible} />
    </div>
  );
};

export default TrainerDashboard;
