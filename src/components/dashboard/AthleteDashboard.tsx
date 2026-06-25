import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabaseClient';
import NotificationCard from './NotificationCard';
import NotificationsEmptyState from './NotificationsEmptyState';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import { useLocation, useNavigate } from 'react-router-dom';
import confetti from 'canvas-confetti';
import { useSupabase } from '../../context/SupabaseContext';

import { PlanData, TrainingDay, GlobalVariable, Rule, LocalSesion, FilosofiaPilar } from '../../types/database.types';

import AthleteNavbar from '../common/AthleteNavbar';
import WorkoutBanner from './WorkoutBanner';
import WorkoutCard from './WorkoutCard';
import { analizarSobrecargaProgresiva as analyzeOverload, DEFAULT_OVERLOAD_CONFIG } from '../../lib/overload';
import {
  flattenSessionsForOverload,
  loadAthleteSessions,
  readSessionsFromCache,
  resolveOverloadConfig,
  resolveOverloadRules,
  SESSIONS_UPDATED_EVENT,
} from '../../lib/sessions';
import {
  DISMISSED_NOTIFS_KEY,
  filterVisibleNotifications,
  getNotificationKey,
  getNotificationsEmptyState,
} from '../../lib/notifications';
import Toast from '../common/Toast';
import AddSesion from './AddSesion'; // Renders manual session logging if tab=add
import PreWorkoutPrompt from './PreWorkoutPrompt';
import GamificacionPanel from './GamificacionPanel';
import { OnboardingModal } from '../common/OnboardingModal';
import { ShareableProgressCard } from './ShareableProgressCard';
import { InitialPeriodizationEvaluation } from './InitialPeriodizationEvaluation';
import { subscribirNotificacionesPush, verificarSuscripcionPushActiva } from '../../lib/pushNotifications';

export const AthleteDashboard: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile, isSoloClient, refreshProfile } = useSupabase();

  // Sincronización del tema actual seleccionado por el atleta
  const [currentTheme, setCurrentTheme] = useState<string>(() => {
    const saved = localStorage.getItem('pwa_login_theme');
    return saved || 'cyan';
  });

  const [paymentLoading, setPaymentLoading] = useState<boolean>(false);
  const [showPushPrompt, setShowPushPrompt] = useState<boolean>(false);
  const [showOnboarding, setShowOnboarding] = useState<boolean>(false);
  const [showShareCard, setShowShareCard] = useState<boolean>(false);

  // Manejar redirección exitosa o cancelada de MercadoPago
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const paymentSuccess = params.get('payment_success');
    const paymentCancel = params.get('payment_cancel');

    if (paymentSuccess === 'true') {
      showToast('🎉 ¡Tu suscripción ha sido activada con éxito! Disfruta de las herramientas Pro.', 'success');
      refreshProfile();
      // Limpiar parámetros de la URL
      navigate(location.pathname, { replace: true });
    } else if (paymentCancel === 'true') {
      showToast('Pago cancelado. Si tienes dudas, ponte en contacto con soporte.', 'info');
      // Limpiar parámetros de la URL
      navigate(location.pathname, { replace: true });
    }
  }, [location.search, navigate, location.pathname, refreshProfile]);

  useEffect(() => {
    const comprobarPush = async () => {
      if (user && 'serviceWorker' in navigator && 'PushManager' in window) {
        const activa = await verificarSuscripcionPushActiva(user.id);
        const rechazada = localStorage.getItem(`pwa_push_prompt_dismissed_${user.id}`);
        if (!activa && !rechazada) {
          setShowPushPrompt(true);
        }
      }
    };
    const t = setTimeout(comprobarPush, 4000);
    return () => clearTimeout(t);
  }, [user]);

  // Verificar si es la primera vez que inicia sesión para el Onboarding
  useEffect(() => {
    if (user) {
      const isOnboarded = localStorage.getItem('evolution_onboarded_v1');
      if (!isOnboarded) {
        setShowOnboarding(true);
      }
    }
  }, [user]);

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

  useEffect(() => {
    const handleThemeChange = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setCurrentTheme(detail);
    };
    window.addEventListener('pwa-theme-changed', handleThemeChange);
    return () => window.removeEventListener('pwa-theme-changed', handleThemeChange);
  }, []);

  useEffect(() => {
    const handleShowUpgrade = () => {
      setShowSoloUpgradeModal(true);
    };
    window.addEventListener('pwa-show-upgrade-modal', handleShowUpgrade);
    return () => window.removeEventListener('pwa-show-upgrade-modal', handleShowUpgrade);
  }, []);

  // Buscar si la URL tiene ?tab=add
  const isAddTab = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get('tab') === 'add';
  }, [location.search]);

  // Auxiliar para formatear enlaces de redes sociales
  const formatSocialLink = (url: string | undefined, type: 'whatsapp' | 'instagram'): string => {
    if (!url) return '';
    const trimmed = url.trim();
    if (!trimmed || trimmed === '#' || trimmed.toLowerCase() === 'null') return '';
    
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return trimmed;
    }
    
    if (type === 'whatsapp') {
      const cleanNumber = trimmed.replace(/[^\d]/g, '');
      return `https://wa.me/${cleanNumber}`;
    }
    
    if (type === 'instagram') {
      const cleanUser = trimmed.replace('@', '');
      return `https://instagram.com/${cleanUser}`;
    }
    
    return trimmed;
  };

  // Estados del plan (inicialización síncrona desde caché para evitar parpadeos y spinner de pantalla completa)
  const [plan, setPlan] = useState<PlanData | null>(() => {
    try {
      const cached = localStorage.getItem('pwa_client_plan');
      if (cached) {
        const parsed = JSON.parse(cached) as PlanData;
        const paddedDays = (parsed.trainingDays || []).map(day => {
          const exercises = day.exercises || [];
          const normalizedExercises = exercises.map(ex => ({
            id: ex.id || 'ex_' + Math.random().toString(36).substring(2, 9),
            nombre: ex.nombre || '',
            variables: ex.variables || {},
            video_url: ex.video_url || '',
            image_url: ex.image_url || '',
            gif_url: ex.gif_url || ''
          }));
          const currentExCount = normalizedExercises.length;
          if (currentExCount < 3) {
            const needed = 3 - currentExCount;
            for (let i = 0; i < needed; i++) {
              normalizedExercises.push({
                id: 'ex_' + Math.random().toString(36).substring(2, 9),
                nombre: '',
                variables: {},
                video_url: '',
                image_url: '',
                gif_url: ''
              });
            }
          }
          return { ...day, exercises: normalizedExercises };
        });
        return { ...parsed, trainingDays: paddedDays };
      }
    } catch (e) {
      console.error('Error al inicializar plan desde caché:', e);
    }
    return null;
  });



  const [trainerProfile, setTrainerProfile] = useState<{
    nombre: string;
    filosofia?: FilosofiaPilar[] | null;
    marca?: {
      nombre_display: string;
      color_primario: string;
      color_secundario: string;
      tipografia: string;
      eslogan?: string;
      whatsapp?: string;
    } | null;
    suscripcion_plan?: string;
    suscripcion_estado?: string;
    suscripcion_expira_at?: string | null;
    insignias_custom?: any[] | null;
  } | null>(null);

  const wsHref = useMemo(() => {
    if (trainerProfile?.marca?.whatsapp) {
      return formatSocialLink(trainerProfile.marca.whatsapp, 'whatsapp');
    }
    return formatSocialLink(plan?.portada?.whatsappLink, 'whatsapp');
  }, [trainerProfile?.marca?.whatsapp, plan?.portada?.whatsappLink]);
  const igHref = useMemo(() => formatSocialLink(plan?.portada?.instagramLink, 'instagram'), [plan?.portada?.instagramLink]);

  const [localSesiones, setLocalSesiones] = useState<LocalSesion[]>(() => readSessionsFromCache());
  const [activeTab, setActiveTab] = useState<number>(0);

  // Estados de modales
  const [philosophyOpen, setPhilosophyOpen] = useState<boolean>(false);
  const [guideModal, setGuideModal] = useState<{ open: boolean; title: string; content: string }>({ open: false, title: '', content: '' });
  const [is1RMModalOpen, setIs1RMModalOpen] = useState<boolean>(false);
  const [showSmartCoach, setShowSmartCoach] = useState<boolean>(false);
  const [showSoloUpgradeModal, setShowSoloUpgradeModal] = useState<boolean>(false);
  const [showUpdateModal, setShowUpdateModal] = useState<boolean>(false);

  // Estados de Toast
  const [toastState, setToastState] = useState<{ visible: boolean; message: string; type: 'success' | 'error' | 'info' }>({
    visible: false,
    message: '',
    type: 'success',
  });

  // Calculadora 1RM
  const [calcUnit, setCalcUnit] = useState<'kg' | 'lbs'>('kg');
  const [calcPeso, setCalcPeso] = useState<string>('');
  const [calcReps, setCalcReps] = useState<string>('');
  const [calcFormula, setCalcFormula] = useState<string>('promedio');
  const [rmResult, setRmResult] = useState<number | null>(null);
  const [rmTable, setRmTable] = useState<{ pct: number; carga: number; reps: number }[]>([]);

  // checklist persistente por día actual YYYY-MM-DD
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const [checkedIds, setCheckedIds] = useLocalStorage<string[]>(`checklist_${todayStr}`, []);

  // Controlar confetti lanzado para evitar disparos múltiples por render
  const [hasCelebratedToday, setHasCelebratedToday] = useLocalStorage<Record<string, boolean>>('pwa_celebrations', {});

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastState({ visible: true, message, type });
    setTimeout(() => {
      setToastState((prev) => ({ ...prev, visible: false }));
    }, 3000);
  };

  // Cargar plan de Supabase o localCache fallback
  useEffect(() => {
    if (!user) return;
    const padPlanData = (p: PlanData | null): PlanData | null => {
      if (!p) return null;

      const defaultVars = [
        { id: "series de aproximacion", label: "SERIES DE APROXIMACION", type: "number", defaultValue: "2" },
        { id: "series de trabajo", label: "SERIES DE TRABAJO", type: "text", defaultValue: "3" },
        { id: "repeticiones", label: "REPETICIONES", type: "text", defaultValue: "10-12" },
        { id: "tempo", label: "TEMPO", type: "text", defaultValue: "2:1:1" },
        { id: "rir", label: "RIR", type: "number", defaultValue: "2" },
        { id: "descanso", label: "DESCANSO(MIN)", type: "number", defaultValue: "2" },
        { id: "peso", label: "PESO(KG)", type: "text", defaultValue: "10" }
      ];

      const keyMapping: Record<string, string> = {
        'gv_series': 'series de trabajo',
        'series de trabajo': 'series de trabajo',
        'gv_reps': 'repeticiones',
        'repeticiones': 'repeticiones',
        'gv_rir': 'rir',
        'rir': 'rir',
        'gv_descanso': 'descanso',
        'descanso': 'descanso',
        'gv_peso': 'peso',
        'peso': 'peso',
        'gv_tempo': 'tempo',
        'tempo': 'tempo',
        'gv_aproximacion': 'series de aproximacion',
        'series de aproximacion': 'series de aproximacion'
      };

      const oldIds = ['gv_series', 'gv_reps', 'gv_rir', 'gv_descanso', 'gv_peso'];
      const newIds = defaultVars.map(v => v.id);

      const currentVars = p.globalVariables || [];
      const normalizedVars: GlobalVariable[] = [];

      defaultVars.forEach(dv => {
        const existing = currentVars.find(v => v.id === dv.id || keyMapping[v.id] === dv.id);
        if (existing) {
          normalizedVars.push({
            id: dv.id,
            label: dv.label,
            type: dv.type,
            defaultValue: existing.defaultValue || dv.defaultValue
          });
        } else {
          normalizedVars.push(dv);
        }
      });

      currentVars.forEach(v => {
        const isDefault = newIds.includes(v.id) || oldIds.includes(v.id);
        if (!isDefault) {
          normalizedVars.push(v);
        }
      });

      p.globalVariables = normalizedVars;

      if (!p.trainingDays) return p;

      const paddedDays = p.trainingDays.map(day => {
        const normalizedExercises = (day.exercises || []).map((ex: any) => {
          const newVars: Record<string, string> = {};
          Object.entries(ex.variables || {}).forEach(([oldKey, val]) => {
            const cleanKey = oldKey.toLowerCase().trim();
            const newKey = keyMapping[cleanKey] || cleanKey;
            newVars[newKey] = String(val ?? '');
          });

          normalizedVars.forEach(nv => {
            if (newVars[nv.id] === undefined || newVars[nv.id] === '') {
              newVars[nv.id] = nv.defaultValue;
            }
          });

          return {
            id: ex.id || 'temp_' + Math.random().toString(36).substring(2, 11),
            nombre: ex.nombre !== undefined ? ex.nombre : (ex.name !== undefined ? ex.name : ''),
            nombre_original: ex.nombre_original || '',
            variables: newVars,
            video_url: ex.video_url !== undefined ? ex.video_url : (ex.videoUrl !== undefined ? ex.videoUrl : ''),
            image_url: ex.image_url !== undefined ? ex.image_url : (ex.imageData !== undefined ? ex.imageData : ''),
            gif_url: ex.gif_url !== undefined ? ex.gif_url : (ex.gifData !== undefined ? ex.gifData : ''),
            description: ex.description || '',
            grupo_muscular: ex.grupo_muscular || '',
            progression_notes: ex.progression_notes || '',
            progression_type: ex.progression_type,
            progression_params: ex.progression_params
          };
        });

        const currentExCount = normalizedExercises.length;
        if (currentExCount < 3) {
          const needed = 3 - currentExCount;
          for (let i = 0; i < needed; i++) {
            normalizedExercises.push({
              id: 'temp_' + Math.random().toString(36).substring(2, 11),
              nombre: '',
              nombre_original: '',
              variables: {},
              video_url: '',
              image_url: '',
              gif_url: '',
              description: '',
              grupo_muscular: '',
              progression_notes: '',
              progression_type: undefined,
              progression_params: undefined
            });
          }
        }
        return {
          ...day,
          exercises: normalizedExercises
        };
      });

      return {
        ...p,
        trainingDays: paddedDays
      };
    };

    const fetchPlan = async () => {
      if (!user) return;


      let success = false;

      try {
        const { data, error } = await supabase
          .from('planes')
          .select('*')
          .eq('cliente_id', user.id)
          .eq('activo', true)
          .maybeSingle();

        if (error) throw error;

        if (data && data.datos_plan && Object.keys(data.datos_plan).length > 0) {
          const padded = padPlanData(data.datos_plan as PlanData);
          setPlan(padded);
          localStorage.setItem('pwa_client_plan', JSON.stringify(data.datos_plan));
          success = true;
          
          if (padded?.periodizationConfig?.has_new_updates) {
             setShowUpdateModal(true);
             const updatedPlan = { ...padded, periodizationConfig: { ...padded.periodizationConfig, has_new_updates: false } };
             supabase.from('planes').update({ datos_plan: updatedPlan }).eq('id', data.id).then();
             setPlan(updatedPlan);
             localStorage.setItem('pwa_client_plan', JSON.stringify(updatedPlan));
          }
        }
      } catch (err) {
        console.warn('No se pudo descargar el plan de la nube, usando caché local:', err);
      }

      if (!success) {
        // Fallback a Caché Local
        try {
          const cached = localStorage.getItem('pwa_client_plan');
          if (cached) {
            const parsed = JSON.parse(cached) as PlanData;
            const padded = padPlanData(parsed);
            setPlan(padded);
            showToast('Cargado en modo offline 🔌', 'info');
          } else {
            if (!isSoloClient) {
              showToast('No tienes un plan activo asignado.', 'error');
            }
            // Si es solo client sin plan, el CTA Quick Start se muestra en el render
          }
        } catch (e) {
          console.error('Error al cargar plan de caché:', e);
        }
      }


    };

    fetchPlan();

    const channelName = 'plan-updates:' + user.id;
    const channel = supabase.channel(channelName);
    channel
      .on('broadcast', { event: 'plan-updated' }, () => {
        showToast('✨ ¡Tu entrenador ha modificado tu rutina en tiempo real! ⚡', 'info');
        fetchPlan();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Fetch trainer profile for branding/philosophy
  useEffect(() => {
    const fetchTrainerProfile = async () => {
      if (!user) return;
      try {
        const { data: planData } = await supabase
          .from('planes')
          .select('creador_id')
          .eq('cliente_id', user.id)
          .eq('activo', true)
          .maybeSingle();

        if (planData?.creador_id && planData.creador_id !== user.id) {
          const { data: trainer } = await supabase
            .from('profiles')
            .select('nombre, filosofia, marca, suscripcion_plan, suscripcion_estado, suscripcion_expira_at, insignias_custom')
            .eq('id', planData.creador_id)
            .maybeSingle();

          if (trainer) {
            setTrainerProfile(trainer as any);
          }
        }
      } catch (err) {
        console.warn('No se pudo cargar el perfil del entrenador:', err);
      }
    };
    fetchTrainerProfile();
  }, [user]);

  // Cargar historial de sesiones desde Supabase (+ caché offline)
  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    const refresh = async (fromNetwork = true) => {
      const data = fromNetwork
        ? await loadAthleteSessions(user.id)
        : readSessionsFromCache();
      if (!cancelled) setLocalSesiones(data);
    };

    refresh();

    const onSessionsUpdated = () => {
      refresh(false);
    };
    window.addEventListener(SESSIONS_UPDATED_EVENT, onSessionsUpdated);

    const channel = supabase
      .channel(`historial_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sesiones_historial',
          filter: `cliente_id=eq.${user.id}`,
        },
        () => {
          refresh();
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      window.removeEventListener(SESSIONS_UPDATED_EVENT, onSessionsUpdated);
      supabase.removeChannel(channel);
    };
  }, [user]);

  const overloadSessions = useMemo(
    () => flattenSessionsForOverload(localSesiones),
    [localSesiones]
  );

  const overloadRules = useMemo(
    () => resolveOverloadRules(plan?.trackerRules as Rule[] | undefined),
    [plan?.trackerRules]
  );

  const overloadConfig = useMemo(
    () => resolveOverloadConfig(plan?.trackerConfig),
    [plan?.trackerConfig]
  );

  const notificaciones = useMemo(
    () =>
      plan
        ? analyzeOverload(overloadSessions, overloadRules, overloadConfig)
        : [],
    [plan, overloadSessions, overloadRules, overloadConfig]
  );

  const [dismissedKeys, setDismissedKeys] = useLocalStorage<string[]>(DISMISSED_NOTIFS_KEY, []);

  const handleDismissNotification = (key: string) => {
    setDismissedKeys((prev) => [...prev, key]);
  };

  const minSesiones = overloadConfig.minSesiones ?? DEFAULT_OVERLOAD_CONFIG.minSesiones;

  const notificationsEmptyState = useMemo(
    () => getNotificationsEmptyState(overloadSessions, minSesiones),
    [overloadSessions, minSesiones]
  );

  const visibleNotificaciones = useMemo(
    () => filterVisibleNotifications(notificaciones, dismissedKeys),
    [notificaciones, dismissedKeys]
  );

  const showNotificationsPanel =
    notificationsEmptyState !== null || visibleNotificaciones.length > 0;

  // Verificar expiración del plan
  const planExpiration = useMemo(() => {
    // Prioridad 1: Perfil
    const vigencia = profile?.vigencia_dias ?? 30;
    const inicioStr = profile?.fecha_inicio ?? plan?.portada?.startDate;

    if (vigencia >= 9999) return { expired: false, message: '' };
    if (!inicioStr) return { expired: false, message: '' };

    const partes = inicioStr.split('-');
    if (partes.length !== 3) return { expired: false, message: '' };
    const anio = parseInt(partes[0], 10);
    const mes = parseInt(partes[1], 10) - 1;
    const dia = parseInt(partes[2], 10);
    const fechaInicio = new Date(anio, mes, dia);

    if (isNaN(fechaInicio.getTime())) return { expired: false, message: '' };
    const hoy = new Date();
    const hoyLocal = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
    const diasTranscurridos = (hoyLocal.getTime() - fechaInicio.getTime()) / (1000 * 60 * 60 * 24);

    const expired = diasTranscurridos >= vigencia;
    const message = vigencia >= 9999
      ? '🔒 Tu plan ha finalizado. Contacta a tu entrenador para renovar.'
      : `🔒 Tu plan ha finalizado. Han pasado más de ${vigencia} días. Contacta a tu entrenador para renovar.`;

    return { expired, message };
  }, [profile, plan]);

  // Verificar si el diagnóstico de periodización está pendiente
  const isEvaluationPending = useMemo(() => {
    if (!plan?.periodizationConfig?.enabled) return false;
    const config = plan.periodizationConfig;
    const has1RM = config.marcas_1rm && Object.keys(config.marcas_1rm).length > 0;
    const hasFecha = !!config.fecha_evaluacion;
    return !has1RM || !hasFecha;
  }, [plan]);

  // Verificar si la cuenta del entrenador ha expirado
  const isCoachExpired = useMemo(() => {
    if (!trainerProfile) return false;
    const estado = trainerProfile.suscripcion_estado || 'activo';
    if (estado === 'expirado' || estado === 'cancelado') return true;
    if (trainerProfile.suscripcion_expira_at) {
      const expDate = new Date(trainerProfile.suscripcion_expira_at);
      if (!isNaN(expDate.getTime()) && expDate < new Date()) {
        return true;
      }
    }
    return false;
  }, [trainerProfile]);

  // Disparar confetti si se completaron todos los ejercicios de la pestaña activa
  const activeDay = useMemo<TrainingDay | null>(() => {
    if (!plan?.trainingDays || plan.trainingDays.length === 0) return null;
    return plan.trainingDays[activeTab] || plan.trainingDays[0];
  }, [plan, activeTab]);

  useEffect(() => {
    if (!activeDay || activeDay.exercises.length === 0 || planExpiration.expired) return;

    const dayExIds = activeDay.exercises.map((e) => e.id);
    const allChecked = dayExIds.every((id) => checkedIds.includes(id));

    if (allChecked) {
      const dayCelebKey = `${todayStr}_day_${activeDay.id}`;
      if (!hasCelebratedToday[dayCelebKey]) {
        const style = getComputedStyle(document.documentElement);
        const pri = style.getPropertyValue('--theme-primary').trim() || '#00d4ff';
        const sec = style.getPropertyValue('--theme-secondary').trim() || '#7b2ff7';
        confetti({
          particleCount: 150,
          spread: 80,
          origin: { y: 0.6 },
          colors: [pri, sec, '#ffffff'],
        });
        showToast('🎉 ¡Entrenamiento completado!', 'success');
        setHasCelebratedToday((prev) => ({ ...prev, [dayCelebKey]: true }));
      }
    }
  }, [checkedIds, activeDay, planExpiration.expired, hasCelebratedToday, todayStr, setHasCelebratedToday]);

  const handleToggleCheck = (exerciseId: string) => {
    if (planExpiration.expired) {
      showToast('⛔ Plan expirado. No se pueden modificar tareas.', 'error');
      return;
    }

    setCheckedIds((prev) => {
      if (prev.includes(exerciseId)) {
        return prev.filter((id) => id !== exerciseId);
      } else {
        return [...prev, exerciseId];
      }
    });
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

  // Almacenamiento automático y silencioso de imágenes y GIFs en caché física en segundo plano (para uso offline sin configuración manual)
  useEffect(() => {
    if (!plan || !plan.trainingDays || !navigator.onLine) return;
    const trainingDays = plan.trainingDays;

    const cacheAllPlanMediaSilently = async () => {
      try {
        const urls: string[] = [];
        trainingDays.forEach(day => {
          if (day && day.exercises) {
            day.exercises.forEach(ex => {
              if (ex.image_url && typeof ex.image_url === 'string' && ex.image_url.trim()) {
                urls.push(ex.image_url.trim());
              }
              if (ex.gif_url && typeof ex.gif_url === 'string' && ex.gif_url.trim()) {
                urls.push(ex.gif_url.trim());
              }
            });
          }
        });
        const uniqueUrls = Array.from(new Set(urls));
        const cache = await caches.open('supabase-storage-cache');

        console.log('⚡ PWA: Iniciando almacenamiento silencioso de multimedia para uso offline:', uniqueUrls.length, 'recursos.');

        // Bucle asíncrono silencioso
        for (const url of uniqueUrls) {
          try {
            // Primer intento: con CORS
            const response = await fetch(url, { mode: 'cors' });
            if (response.ok || response.status === 0) {
              await cache.put(url, response);
            } else {
              throw new Error('CORS disabled, falling back to no-cors');
            }
          } catch (err) {
            // Segundo intento: sin CORS (respuesta opaca)
            try {
              const fallbackRes = await fetch(url, { mode: 'no-cors' });
              await cache.put(url, fallbackRes);
            } catch (e2) {
              console.warn('⚡ PWA: Error al pre-cargar recurso:', url, e2);
            }
          }
          
          // Pre-carga clásica en paralelo para renderizado instantáneo
          const img = new Image();
          img.src = url;
        }
        console.log('⚡ PWA: Todos los recursos multimedia han sido cacheados silenciosamente.');
      } catch (e) {
        console.error('⚡ PWA: Error en el pre-cargador automático:', e);
      }
    };

    // Ejecutar con retraso de 1.5s para no competir con el montaje inicial de la app
    const timer = setTimeout(() => {
      cacheAllPlanMediaSilently();
    }, 1500);

    return () => clearTimeout(timer);
  }, [plan]);

  // Si el plan ha expirado, bloquear el acceso por completo mostrando pantalla de renovación premium
  if (planExpiration.expired) {
    const vigencia = profile?.vigencia_dias ?? 30;
    const inicioStr = profile?.fecha_inicio || plan?.portada?.startDate || '-';

    return (
      <div style={{ background: 'transparent', minHeight: '100vh', color: 'white', paddingBottom: '60px' }}>
        <AthleteNavbar />
        <div className="container stagger-3" style={{ padding: '0 20px', maxWidth: '600px', margin: '40px auto 0 auto' }}>
          <div style={{
            background: 'var(--theme-card-bg)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid var(--theme-border)',
            borderRadius: '24px',
            padding: '40px 30px',
            textAlign: 'center',
            boxShadow: '0 20px 50px var(--theme-glow)'
          }}>
            {/* Locked Icon */}
            <div className="pulse-lock" style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 24px auto',
              boxShadow: '0 0 20px rgba(239, 68, 68, 0.2)',
            }}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>

            {/* Title */}
            <h2 style={{
              fontFamily: "'Orbitron', sans-serif",
              fontSize: '22px',
              fontWeight: 800,
              color: '#fca5a5',
              letterSpacing: '1.5px',
              textTransform: 'uppercase',
              margin: '0 0 16px 0'
            }}>
              Acceso Restringido
            </h2>

            {/* Description */}
            <p style={{
              fontSize: '14px',
              color: '#94a3b8',
              lineHeight: 1.6,
              margin: '0 0 28px 0'
            }}>
              Tu plan de entrenamiento ha llegado al fin de su vigencia (<strong>{vigencia} días</strong> desde el <strong>{inicioStr}</strong>). 
              Para continuar visualizando tu rutina de ejercicios y registrando tus sesiones, por favor ponte en contacto con tu entrenador para renovar.
            </p>

            {/* Profile Info Summary */}
            <div style={{
              background: 'var(--theme-badge-bg)',
              border: '1px solid var(--theme-border)',
              borderRadius: '16px',
              padding: '16px',
              marginBottom: '28px',
              textAlign: 'left',
              fontSize: '12px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255, 255, 255, 0.04)', paddingBottom: '8px', marginBottom: '8px' }}>
                <span style={{ color: 'rgba(255, 255, 255, 0.5)' }}>Atleta:</span>
                <span style={{ fontWeight: 600 }}>{profile?.nombre || plan?.portada?.userName || '-'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255, 255, 255, 0.04)', paddingBottom: '8px', marginBottom: '8px' }}>
                <span style={{ color: 'rgba(255, 255, 255, 0.5)' }}>Fecha de Inicio:</span>
                <span style={{ fontWeight: 600 }}>{inicioStr}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'rgba(255, 255, 255, 0.5)' }}>Vigencia del Plan:</span>
                <span style={{ fontWeight: 600, color: '#ef4444' }}>{vigencia} días (Expirado)</span>
              </div>
            </div>

            {/* Trainer Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {wsHref && (
                <a href={wsHref} target="_blank" rel="noopener noreferrer" style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  background: '#25d366',
                  color: 'white',
                  textDecoration: 'none',
                  padding: '12px 24px',
                  borderRadius: '30px',
                  fontSize: '13px',
                  fontWeight: 700,
                  fontFamily: "'Orbitron', sans-serif",
                  boxShadow: '0 4px 15px rgba(37, 211, 102, 0.25)',
                  transition: 'all 0.3s ease'
                }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                  Contactar por WhatsApp
                </a>
              )}
              {igHref && (
                <a href={igHref} target="_blank" rel="noopener noreferrer" style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  background: 'linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)',
                  color: 'white',
                  textDecoration: 'none',
                  padding: '12px 24px',
                  borderRadius: '30px',
                  fontSize: '13px',
                  fontWeight: 700,
                  fontFamily: "'Orbitron', sans-serif",
                  boxShadow: '0 4px 15px rgba(220, 39, 67, 0.25)',
                  transition: 'all 0.3s ease'
                }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204 0 3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
                  </svg>
                  Seguir en Instagram
                </a>
              )}
            </div>
          </div>
        </div>
        <Toast message={toastState.message} type={toastState.type} visible={toastState.visible} />
      </div>
    );
  }

  // Si la cuenta del entrenador ha expirado, bloquear el acceso del atleta
  if (isCoachExpired) {
    return (
      <div style={{ background: 'transparent', minHeight: '100vh', color: 'white', paddingBottom: '60px' }}>
        <AthleteNavbar />
        <div className="container stagger-3" style={{ padding: '0 20px', maxWidth: '600px', margin: '40px auto 0 auto' }}>
          <div style={{
            background: 'var(--theme-card-bg)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid var(--theme-border)',
            borderRadius: '24px',
            padding: '40px 30px',
            textAlign: 'center',
            boxShadow: '0 20px 50px var(--theme-glow)'
          }}>
            {/* Locked Icon */}
            <div className="pulse-lock" style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 24px auto',
              boxShadow: '0 0 20px rgba(239, 68, 68, 0.2)',
            }}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>

            {/* Title */}
            <h2 style={{
              fontFamily: "'Orbitron', sans-serif",
              fontSize: '18px',
              fontWeight: 800,
              color: '#fca5a5',
              letterSpacing: '1.5px',
              textTransform: 'uppercase',
              margin: '0 0 16px 0'
            }}>
              SERVICIO TEMPORALMENTE INACTIVO
            </h2>

            {/* Description */}
            <p style={{
              fontSize: '14px',
              color: '#94a3b8',
              lineHeight: 1.6,
              margin: '0 0 28px 0'
            }}>
              La cuenta de tu entrenador <strong>{trainerProfile?.marca?.nombre_display || trainerProfile?.nombre || 'tu Coach'}</strong> se encuentra inactiva o pendiente de renovación.
              Por favor, infórmale para que pueda restablecer el servicio.
            </p>

            {/* Trainer Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {wsHref && (
                <a href={wsHref} target="_blank" rel="noopener noreferrer" style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  background: '#25d366',
                  color: 'white',
                  textDecoration: 'none',
                  padding: '12px 24px',
                  borderRadius: '30px',
                  fontSize: '13px',
                  fontWeight: 700,
                  fontFamily: "'Orbitron', sans-serif",
                  boxShadow: '0 4px 15px rgba(37, 211, 102, 0.25)',
                  transition: 'all 0.3s ease'
                }}>
                  Avisar a mi Entrenador
                </a>
              )}
            </div>
          </div>
        </div>
        <Toast message={toastState.message} type={toastState.type} visible={toastState.visible} />
      </div>
    );
  }

  // Si está en la pestaña "Nueva Sesión" (tab=add)
  if (isAddTab) {
    return (
      <div style={{ background: 'transparent', minHeight: '100vh', color: 'white', paddingBottom: '50px' }}>
        <AthleteNavbar />
        <div className="container stagger-3" style={{ padding: '0 20px', maxWidth: '1200px', margin: '0 auto' }}>
          <AddSesion plan={plan} expired={planExpiration.expired} showToast={showToast} onCancel={() => navigate('/dashboard')} />
        </div>
        <Toast message={toastState.message} type={toastState.type} visible={toastState.visible} />
      </div>
    );
  }

  // Mapear los datos de portada con valores predeterminados
  const portada = plan?.portada || {};
  const globalVariables: GlobalVariable[] = plan?.globalVariables || [];
  const variableDefinitions: Record<string, string> = plan?.variableDefinitions || {
    "series de aproximacion": "Son series previas con poco peso para calentar los músculos y preparar las articulaciones sin cansarte. Ejemplo: Si vas a levantar 50kg, haces una serie previa con solo la barra o con 20kg.",
    "series de trabajo": "Son las series reales del plan donde el esfuerzo es alto y cuentan para el progreso. Ejemplo: Hacer 3 series de 10 repeticiones con el peso máximo que dominas.",
    "repeticiones": "Es el número de veces que realizas el movimiento completo del ejercicio dentro de una serie. Ejemplo: hacer 12 sentadillas seguidas sin parar.",
    "tempo": "Es la velocidad a la que realizas cada fase del movimiento (bajada, pausa y subida). Ejemplo: En sentadilla, bajar en 3 segundos, hacer 1 segundo de pausa abajo y subir rápido en 1 segundo.",
    "rir": "Indica cuántas repeticiones sientes que podrías haber hecho antes de llegar al fallo total. Ejemplo: Si haces 10 repeticiones con un RIR 2, significa que terminaste sintiendo que podrías haber hecho 2 más.",
    "descanso": "El tiempo que esperas entre una serie y otra para recuperar energía. Ejemplo: Cronometrar 2 minutos sentado antes de empezar la siguiente serie.",
    "peso": "Representa la resistencia externa que se opone a la contracción muscular para generar estímulo de adaptación en el organismo."
  };
  const trainingDays: TrainingDay[] = plan?.trainingDays || [];
  const weekdayMapping: Record<string, number> = plan?.weekdayMapping || { '0': -1, '1': -1, '2': -1, '3': -1, '4': -1, '5': -1, '6': -1 };

  return (
    <div style={{ background: 'transparent', minHeight: '100vh', color: 'white', paddingBottom: '60px' }}>
      {currentTheme === 'cyan' && trainerProfile?.marca && (
        <style>{`
          :root {
            --theme-primary: ${trainerProfile.marca.color_primario} !important;
            --theme-secondary: ${trainerProfile.marca.color_secundario} !important;
            --theme-glow: ${trainerProfile.marca.color_primario}24 !important;
            --theme-border: ${trainerProfile.marca.color_primario}33 !important;
            --theme-text-gradient: linear-gradient(135deg, ${trainerProfile.marca.color_primario} 30%, ${trainerProfile.marca.color_secundario} 100%) !important;
            --theme-btn-gradient: linear-gradient(135deg, ${trainerProfile.marca.color_primario} 0%, ${trainerProfile.marca.color_secundario} 100%) !important;
            --theme-btn-glow: ${trainerProfile.marca.color_primario}40 !important;
            --theme-input-focus: ${trainerProfile.marca.color_primario} !important;
            --theme-input-focus-glow: ${trainerProfile.marca.color_primario}2e !important;
            --theme-badge-bg: ${trainerProfile.marca.color_primario}33 !important;
            --font-primary: '${trainerProfile.marca.tipografia}', 'Orbitron', sans-serif !important;
          }
          .brand-name, .section-title, .mcard-value, .tab, .btn, .philosophy-title {
            font-family: '${trainerProfile.marca.tipografia}', 'Orbitron', sans-serif !important;
          }
        `}</style>
      )}
      <AthleteNavbar />

      <div className="container stagger-3" style={{ padding: '0 20px', maxWidth: '1200px', margin: '0 auto' }}>
        
        {/* Banner de invitación a activar notificaciones Push */}
        {showPushPrompt && !planExpiration.expired && (
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
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', marginTop: '4px', lineHeight: '1.4' }}>Recibe recordatorios para mantener tu racha de entrenamiento y entérate al instante cuando tu entrenador actualice tu plan.</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button
                onClick={async () => {
                  if (user) {
                    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
                      showToast('Tu navegador no soporta notificaciones. Instala la PWA en tu pantalla de inicio o usa un navegador moderno.', 'info');
                      setShowPushPrompt(false);
                      return;
                    }
                    if (Notification.permission === 'denied') {
                      showToast('Las notificaciones están bloqueadas. Restablécelas en los ajustes del navegador.', 'info');
                      setShowPushPrompt(false);
                      return;
                    }
                    const ok = await subscribirNotificacionesPush(user.id);
                    if (ok) {
                      showToast('🔔 ¡Notificaciones activadas exitosamente!', 'success');
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
                  if (user) {
                    localStorage.setItem(`pwa_push_prompt_dismissed_${user.id}`, 'true');
                    setShowPushPrompt(false);
                  }
                }}
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  color: 'rgba(255,255,255,0.6)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '30px',
                  padding: '8px 16px',
                  fontSize: '11px',
                  fontWeight: 700,
                  fontFamily: "'Orbitron', sans-serif",
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                MÁS TARDE
              </button>
            </div>
          </div>
        )}

        {/* Banner de expiración */}
        {planExpiration.expired && (
          <div className="aviso-bloqueo" style={{ display: 'block', margin: '10px 0 20px 0', padding: '16px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '12px', color: '#fca5a5', fontWeight: 600, textAlign: 'center' }}>
            {planExpiration.message}
          </div>
        )}

        {/* Banner Inteligente de Entrenamiento de Hoy */}
        {!planExpiration.expired && trainingDays.length > 0 && (
          <WorkoutBanner
            weekdayMapping={weekdayMapping}
            trainingDays={trainingDays}
            startDate={portada.startDate}
            onScrollToDay={(idx) => {
              setActiveTab(idx);
              const el = document.getElementById('workoutCardSection');
              if (el) el.scrollIntoView({ behavior: 'smooth' });
            }}
          />
        )}
        {/* SMART COACH - Pre-Workout Suggestions */}
        {!planExpiration.expired && plan && overloadSessions.length > 0 && trainingDays.length > 0 && (
          <div style={{ marginTop: '16px', marginBottom: '4px' }}>
            <button
              onClick={() => {
                if (isSoloClient && profile?.suscripcion_plan !== 'premium') {
                  setShowSoloUpgradeModal(true);
                } else {
                  setShowSmartCoach(true);
                }
              }}
              style={{
                width: '100%', padding: '14px 20px', borderRadius: '14px', cursor: 'pointer',
                background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.12), rgba(168, 85, 247, 0.08))',
                border: '1px solid rgba(99, 102, 241, 0.25)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                transition: 'all 0.3s ease',
                boxShadow: '0 4px 16px rgba(99, 102, 241, 0.1)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '20px' }}>🧠</span>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#a5b4fc', fontFamily: "'Orbitron', sans-serif", letterSpacing: '0.5px' }}>SMART COACH</div>
                  <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', marginTop: '2px' }}>Ver sugerencias inteligentes para tu entrenamiento de hoy</div>
                </div>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#a5b4fc" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>
        )}

        {/* SOLO LIFTER — Quick Start CTA (cuando no hay plan) */}
        {!planExpiration.expired && isSoloClient && !plan && (
          <div style={{ marginTop: '20px' }}>
            <div style={{
              background: 'var(--theme-card-bg)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: '1px solid var(--theme-border)',
              borderRadius: '24px',
              padding: '40px 30px',
              textAlign: 'center',
              boxShadow: '0 20px 50px var(--theme-glow)'
            }}>
              <div style={{
                width: '64px', height: '64px', borderRadius: '50%',
                background: 'var(--theme-badge-bg)',
                border: '1px solid var(--theme-border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 20px auto',
                boxShadow: '0 0 20px var(--theme-glow)',
              }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--theme-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </div>
              <h2 style={{
                fontFamily: "'Orbitron', sans-serif",
                fontSize: '18px', fontWeight: 800,
                color: 'var(--theme-primary)', letterSpacing: '1.5px',
                textTransform: 'uppercase', margin: '0 0 12px 0'
              }}>Quick Start</h2>
              <p style={{ fontSize: '13px', color: '#94a3b8', lineHeight: 1.6, margin: '0 0 24px 0' }}>
                Aún no tienes un plan de entrenamiento. Crea tu propia rutina personalizada y empieza a entrenar con el motor de sobrecarga progresiva.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center' }}>
                <button
                  onClick={() => navigate('/solo/planner')}
                  style={{
                    background: 'var(--theme-btn-gradient)',
                    color: 'white', border: 'none',
                    padding: '14px 32px', borderRadius: '30px',
                    fontSize: '13px', fontWeight: 700,
                    fontFamily: "'Orbitron', sans-serif",
                    cursor: 'pointer', letterSpacing: '1px',
                    boxShadow: '0 4px 20px var(--theme-btn-glow)',
                    transition: 'all 0.3s ease',
                    display: 'inline-flex', alignItems: 'center', gap: '8px'
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                  CREAR MI PLAN
                </button>
                <button
                  onClick={() => navigate('/solo/config')}
                  style={{
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: 'white',
                    padding: '10px 24px',
                    borderRadius: '30px',
                    fontSize: '11px',
                    fontWeight: 700,
                    fontFamily: "'Orbitron', sans-serif",
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  ⚙️ Configurar Motor de Sobrecarga
                </button>
              </div>
            </div>
          </div>
        )}

        {/* SOLO LIFTER — Editar Plan & Motor de Progresión */}
        {!planExpiration.expired && isSoloClient && plan && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '12px',
            marginTop: '16px',
            marginBottom: '4px'
          }}>
            <button
              onClick={() => navigate('/solo/planner')}
              style={{
                width: '100%', padding: '14px 20px', borderRadius: '14px', cursor: 'pointer',
                background: 'var(--theme-badge-bg)',
                border: '1px solid var(--theme-border)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                transition: 'all 0.3s ease',
                boxShadow: '0 4px 16px var(--theme-glow)',
                boxSizing: 'border-box'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '20px' }}>✏️</span>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--theme-primary)', fontFamily: "'Orbitron', sans-serif", letterSpacing: '0.5px' }}>EDITAR MI PLAN</div>
                  <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', marginTop: '2px' }}>Modifica tus ejercicios, días y variables del plan</div>
                </div>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--theme-primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
            </button>

            <button
              onClick={() => navigate('/solo/config')}
              style={{
                width: '100%', padding: '14px 20px', borderRadius: '14px', cursor: 'pointer',
                background: 'var(--theme-badge-bg)',
                border: '1px solid var(--theme-border)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                transition: 'all 0.3s ease',
                boxShadow: '0 4px 16px var(--theme-glow)',
                boxSizing: 'border-box'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '20px' }}>⚙️</span>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--theme-primary)', fontFamily: "'Orbitron', sans-serif", letterSpacing: '0.5px' }}>MOTOR DE PROGRESIÓN</div>
                  <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', marginTop: '2px' }}>Configura las reglas de tu sobrecarga personal</div>
                </div>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--theme-primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>
        )}

        {/* NOTIFICACIONES DE SOBRECARGA */}
        {!planExpiration.expired && plan && showNotificationsPanel && (
          <div className="sp-notif-container" style={{ marginTop: '20px' }}>
            {visibleNotificaciones.map((n) => (
              <NotificationCard
                key={getNotificationKey(n)}
                notif={n}
                onDismiss={() => handleDismissNotification(getNotificationKey(n))}
              />
            ))}
            {visibleNotificaciones.length === 0 && notificationsEmptyState && (
              <NotificationsEmptyState
                message={notificationsEmptyState.message}
                hint={notificationsEmptyState.hint}
                onAddSession={() => navigate('/dashboard?tab=add')}
              />
            )}
          </div>
        )}

        {/* GAMIFICACION */}
        {!planExpiration.expired && overloadSessions.length > 0 && (
          <div style={{ marginTop: '20px', marginBottom: '4px' }}>
            <div style={{
              background: 'var(--theme-card-bg)', border: '1px solid var(--theme-border)',
              boxShadow: '0 8px 32px 0 var(--theme-glow)',
              borderRadius: '16px', padding: '20px', overflow: 'hidden'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '18px' }}>🎮</span>
                  <h3 style={{ margin: 0, fontFamily: "'Orbitron', sans-serif", fontSize: '12px', fontWeight: 800, color: 'var(--theme-primary)', letterSpacing: '0.5px' }}>
                    TU PROGRESO
                  </h3>
                </div>
                <button
                  onClick={() => setShowShareCard(true)}
                  style={{
                    background: 'var(--theme-badge-bg)',
                    border: '1px solid var(--theme-border)',
                    color: 'var(--theme-primary)',
                    fontFamily: "'Orbitron', sans-serif",
                    fontSize: '10px',
                    fontWeight: 700,
                    letterSpacing: '0.5px',
                    padding: '6px 12px',
                    borderRadius: '20px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    boxShadow: '0 2px 8px var(--theme-glow)'
                  }}
                >
                  COMPARTIR 📸
                </button>
              </div>
              <GamificacionPanel sesiones={overloadSessions} customBadges={trainerProfile?.insignias_custom || []} />
            </div>
          </div>
        )}

        <div className="cover-page" style={{ position: 'relative', marginTop: '20px' }}>
          
          {/* Central Title */}
          <div style={{ textAlign: 'center', marginBottom: '30px' }}>
            <h1 className="theme-text-gradient" style={{ fontFamily: "'Orbitron', sans-serif", fontSize: '1.9rem', fontWeight: 800, borderBottom: '4px solid var(--theme-primary)', display: 'inline-block', paddingBottom: '8px', letterSpacing: '1px' }}>
              PLAN DE ENTRENAMIENTO PERSONALIZADO
            </h1>
            <p style={{ fontFamily: "'Orbitron', sans-serif", fontSize: '0.95rem', color: 'var(--text2)', marginTop: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Estrategia inteligente, ejecución impecable
            </p>
          </div>

          {/* Philosophy Collapsible */}
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
              <span className="philosophy-toggle-title" style={{ fontWeight: 700, fontSize: '13px', fontFamily: "'Orbitron', sans-serif", color: 'var(--theme-primary)', letterSpacing: '0.5px', textTransform: 'uppercase', display: 'flex', alignItems: 'center' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                </svg>
                Nuestra Filosofía de Entrenamiento
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
                transition: 'max-height 0.6s cubic-bezier(0.4, 0, 0.2, 1)'
              }}
            >
              <div className="philosophy-section">
                <h2 className="philosophy-title">SISTEMA DE ENTRENAMIENTO</h2>
                <p className="philosophy-author">
                  Por <span id="trainerNameDisplay">{trainerProfile?.marca?.nombre_display || portada.trainerName || 'Evolution Lab'}</span>
                </p>

                <div className="philosophy-quote">
                  <p style={{ whiteSpace: 'pre-line' }}>
                    {trainerProfile?.marca?.eslogan || portada?.trainerEslogan || 'NO NECESITAS ENTRENAR MÁS.\nNECESITAS ENTRENAR MEJOR.'}
                  </p>
                </div>

                <p className="philosophy-description">
                  Este sistema fue diseñado para maximizar resultados a través de estímulo inteligente, técnica eficiente y progresión estructurada.
                </p>

                <h3 className="philosophy-subtitle">¿QUÉ HACE DIFERENTE ESTE MÉTODO?</h3>

                <div className="philosophy-grid">
                  {trainerProfile?.filosofia && trainerProfile.filosofia.length > 0 ? (
                    trainerProfile.filosofia.map((pilar, i) => (
                      <div key={pilar.id} className={`philosophy-card${i === (trainerProfile.filosofia!.length - 1) && trainerProfile.filosofia!.length % 2 !== 0 ? ' full-width' : ''}`}>
                        <span className="pillar-number">{pilar.icono} Pilar {String(i + 1).padStart(2, '0')}</span>
                        <strong>{pilar.titulo}</strong>
                        <p>{pilar.descripcion}</p>
                      </div>
                    ))
                  ) : (
                    <>
                      <div className="philosophy-card">
                        <span className="pillar-number">Pilar 01</span>
                        <strong>ENTRENAMIENTO BASADO EN ESTÍMULO REAL</strong>
                        <p>Cada ejercicio tiene una función específica dentro del programa. Nada está puesto al azar.</p>
                      </div>
                      <div className="philosophy-card">
                        <span className="pillar-number">Pilar 02</span>
                        <strong>INTENSIDAD CONTROLADA</strong>
                        <p>No buscamos agotarte. Buscamos generar adaptación. La intensidad se utiliza estratégicamente para progresar sin destruir la recuperación.</p>
                      </div>
                      <div className="philosophy-card">
                        <span className="pillar-number">Pilar 03</span>
                        <strong>TÉCNICA COMO PRIORIDAD</strong>
                        <p>La ejecución determina qué músculo trabaja realmente. Menos ego. Más control. Más resultados.</p>
                      </div>
                      <div className="philosophy-card">
                        <span className="pillar-number">Pilar 04</span>
                        <strong>PROGRESIÓN MEDIBLE</strong>
                        <p>El objetivo es mejorar rendimiento, composición corporal y capacidad física semana tras semana.</p>
                      </div>
                      <div className="philosophy-card full-width">
                        <span className="pillar-number">Pilar 05</span>
                        <strong>RECUPERACIÓN PLANIFICADA</strong>
                        <p>Dormir, recuperarse y manejar la fatiga también hacen parte del progreso.</p>
                      </div>
                    </>
                  )}
                </div>

                <div className="philosophy-footer">
                  <p>AQUÍ NO SE ENTRENA POR MOTIVACIÓN.<br />SE ENTRENA CON ESTRUCTURA, PROPÓSITO Y DIRECCIÓN.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Cover Info Grid & Global Notes */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginBottom: '25px' }}>
            {/* Athlete metadata */}
            <div style={{ background: 'var(--theme-card-bg)', border: '1px solid var(--theme-border)', borderRadius: '16px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}>
              <h4 style={{ margin: 0, fontSize: '13px', fontFamily: "'Orbitron', sans-serif", color: 'var(--theme-primary)', letterSpacing: '0.5px' }}>DATOS DEL ATLETA</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--theme-border)', paddingBottom: '6px' }}>
                  <span style={{ color: 'rgba(255,255,255,0.5)' }}>Nombre</span>
                  <span style={{ fontWeight: 600 }}>{portada.userName || profile?.nombre || '-'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--theme-border)', paddingBottom: '6px' }}>
                  <span style={{ color: 'rgba(255,255,255,0.5)' }}>Objetivo</span>
                  <span style={{ fontWeight: 600, color: 'var(--theme-secondary)' }}>{portada.userGoal || profile?.objetivo || '-'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--theme-border)', paddingBottom: '6px' }}>
                  <span style={{ color: 'rgba(255,255,255,0.5)' }}>Fecha inicio</span>
                  <span style={{ fontWeight: 600 }}>{portada.startDate || profile?.fecha_inicio || '-'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'rgba(255,255,255,0.5)' }}>Vigencia</span>
                  <span style={{ fontWeight: 600 }}>{portada.planVigenciaPlan || profile?.vigencia_dias || '28'} días</span>
                </div>
              </div>
            </div>

            {/* Planificación Activa */}
            <div style={{ background: 'var(--theme-card-bg)', border: '1px solid var(--theme-border)', borderRadius: '16px', padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '14px', boxShadow: '0 8px 32px 0 var(--theme-glow)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}>
              <div style={{ color: 'var(--theme-primary)', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontFamily: "'Orbitron', sans-serif", fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="20" x2="18" y2="10" />
                  <line x1="12" y1="20" x2="12" y2="4" />
                  <line x1="6" y1="20" x2="6" y2="14" />
                </svg>
                Planificación Activa
              </div>
              <div style={{ fontFamily: "'Orbitron', sans-serif", fontSize: '28px', fontWeight: 800, color: 'white', letterSpacing: '0.5px' }}>
                {Object.values(weekdayMapping).filter(v => Number(v) !== -1).length || trainingDays.length || 7} Días / Sem
              </div>
            </div>

            {/* Global notes & Trainer socials */}
            <div style={{ background: 'var(--theme-card-bg)', border: '1px solid var(--theme-border)', boxShadow: '0 8px 32px 0 var(--theme-glow)', borderRadius: '16px', padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '14px', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}>
              <div>
                <h4 style={{ margin: '0 0 8px 0', fontSize: '13px', fontFamily: "'Orbitron', sans-serif", color: 'var(--theme-secondary)', letterSpacing: '0.5px' }}>INDICACIONES GENERALES</h4>
                <p style={{ margin: 0, fontSize: '12px', lineHeight: 1.5, color: '#94a3b8', fontStyle: 'italic' }}>
                  "{portada.globalNote || 'Entrena duro, controla tus ejecuciones y descansa lo necesario para lograr el máximo estímulo progresivo.'}"
                </p>
              </div>

              {/* Redes Entrenador */}
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {wsHref && (
                  <a href={wsHref} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(37, 211, 102, 0.12)', border: '1px solid rgba(37, 211, 102, 0.35)', color: '#4ade80', textDecoration: 'none', padding: '6px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: 600, fontFamily: "'Orbitron', sans-serif" }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '2px' }}>
                      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                    </svg>
                    WhatsApp Entrenador
                  </a>
                )}
                {igHref && (
                  <a href={igHref} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(251, 113, 133, 0.12)', border: '1px solid rgba(251, 113, 133, 0.35)', color: '#fda4af', textDecoration: 'none', padding: '6px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: 600, fontFamily: "'Orbitron', sans-serif" }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '2px' }}>
                      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
                    </svg>
                    Instagram Entrenador
                  </a>
                )}
                <button
                  onClick={() => setIs1RMModalOpen(true)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'var(--theme-badge-bg)', border: '1px solid var(--theme-border)', color: 'var(--theme-primary)', padding: '6px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: 600, fontFamily: "'Orbitron', sans-serif", cursor: 'pointer' }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '2px' }}>
                    <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
                    <line x1="9" y1="22" x2="9" y2="16" />
                    <line x1="15" y1="22" x2="15" y2="16" />
                    <line x1="9" y1="16" x2="15" y2="16" />
                    <line x1="9" y1="12" x2="15" y2="12" />
                    <line x1="9" y1="8" x2="15" y2="8" />
                  </svg>
                  Calculadora 1RM
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* DAY TABS BAR */}
        {trainingDays.length > 1 && (
          <div className="day-tabs-bar" style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '20px', padding: '4px', background: 'var(--theme-card-bg)', border: '1px solid var(--theme-border)', borderRadius: '12px', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}>
            {trainingDays.map((day, idx) => {
              const dayName = (day.name || `Día ${idx + 1}`).trim();
              const shortName = dayName.length > 28 ? dayName.substring(0, 25) + '…' : dayName;
              return (
                <button
                  key={day.id}
                  className={`day-tab-btn${activeTab === idx ? ' active' : ''}`}
                  onClick={() => setActiveTab(idx)}
                  style={{
                    fontFamily: "'Orbitron',sans-serif",
                    fontSize: '10px',
                    fontWeight: 600,
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: 'none',
                    transition: 'all 0.2s',
                    cursor: 'pointer'
                  }}
                >
                  {shortName}
                </button>
              );
            })}
          </div>
        )}

        {/* WORKOUT CARD SECTION */}
        <div id="workoutCardSection" key={`tab-${activeTab}`} className="tab-content-enter" style={{ contentVisibility: 'auto' }}>
          {trainingDays.length > 0 ? (
            <WorkoutCard
              day={trainingDays[activeTab] || trainingDays[0]}
              globalVariables={globalVariables}
              variableDefinitions={variableDefinitions}
              checkedExerciseIds={checkedIds}
              onToggleCheck={handleToggleCheck}
              onShowGuide={(title, content) => setGuideModal({ open: true, title, content })}
            />
          ) : (
            <div style={{ textAlign: 'center', padding: '40px', background: 'var(--theme-card-bg)', border: '1px solid var(--theme-border)', boxShadow: '0 8px 32px 0 var(--theme-glow)', borderRadius: '16px' }}>
              <p style={{ color: 'var(--text2)' }}>Cargando ejercicios de tu plan...</p>
            </div>
          )}
        </div>

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

      </div>

      {/* 1RM CALCULATOR MODAL OVERLAY */}
      {is1RMModalOpen && (
        <div id="modal-1rm" className={is1RMModalOpen ? 'open' : ''} style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', display: is1RMModalOpen ? 'flex' : 'none', justifyContent: 'center', alignItems: 'center', background: 'rgba(0,0,0,0.6)', zIndex: 99999 }} onClick={(e) => { if (e.target === e.currentTarget) { setIs1RMModalOpen(false); setRmResult(null); } }}>
          <div className="modal-1rm-box">
            <div className="modal-1rm-header">
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px', color: 'var(--theme-primary)' }}>
                  <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
                  <line x1="9" y1="22" x2="9" y2="16" />
                  <line x1="15" y1="22" x2="15" y2="16" />
                  <line x1="9" y1="16" x2="15" y2="16" />
                  <line x1="9" y1="12" x2="15" y2="12" />
                  <line x1="9" y1="8" x2="15" y2="8" />
                </svg>
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
              <button type="submit" className="modal-1rm-btn-calc full-width">Calcular 1RM</button>
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

      {/* Brand footer */}
      <div style={{ textAlign: 'center', marginTop: '40px', paddingBottom: '30px', opacity: 0.5 }}>
        <p style={{ fontSize: '11px', color: '#94a3b8', fontFamily: "'Orbitron', sans-serif", letterSpacing: '1px' }}>
          Exclusivo para ti por Evolution Lab | Planificación inteligente, ejecución impecable
        </p>
      </div>

      {/* EXECUTION GUIDE MODAL OVERLAY */}
      {guideModal.open && (
        <div className={`modal-overlay modal-overlay-enter ${guideModal.open ? 'open' : ''}`} style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: 'rgba(0,0,0,0.6)', zIndex: 99999 }}>
          <div className="modal-box modal-enter" style={{ maxWidth: '500px', width: '90%', border: '1px solid rgba(0, 212, 255, 0.15)', boxShadow: '0 20px 50px rgba(0, 212, 255, 0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '12px', marginBottom: '15px' }}>
              <h3 style={{ margin: 0, fontFamily: "'Orbitron', sans-serif", color: 'var(--theme-primary)', fontSize: '1rem', letterSpacing: '0.5px', display: 'flex', alignItems: 'center' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}>
                  <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                  <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                </svg>
                Guía de Ejecución
              </h3>
              <button onClick={() => setGuideModal({ open: false, title: '', content: '' })} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '20px', cursor: 'pointer' }}>&times;</button>
            </div>
            <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: 700, color: 'white' }}>{guideModal.title}</h4>
            <div style={{ whiteSpace: 'pre-wrap', textAlign: 'left', maxHeight: '350px', overflowY: 'auto', padding: '12px', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', color: '#e2e8f0', fontSize: '0.95rem', lineHeight: '1.6' }}>
              {guideModal.content}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '15px' }}>
              <button
                className="modal-cancel"
                onClick={() => setGuideModal({ open: false, title: '', content: '' })}
                style={{
                  background: 'var(--theme-badge-bg)',
                  border: '1px solid var(--theme-border)',
                  color: 'var(--theme-primary)',
                  fontFamily: "'Orbitron', sans-serif",
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  fontSize: '0.85rem',
                  padding: '10px 20px',
                  borderRadius: '40px',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Smart Coach Pre-Workout Modal */}
      {showSmartCoach && (
        <PreWorkoutPrompt
          sesiones={overloadSessions}
          ejerciciosDelDia={
            trainingDays.length > 0
              ? (trainingDays[activeTab]?.exercises || [])
                  .filter((ex) => ex.nombre && ex.nombre.trim() !== '')
              : []
          }
          visible={showSmartCoach}
          onClose={() => setShowSmartCoach(false)}
        />
      )}

      {/* Upgrade Modal para Clientes Autónomos (Solo Lifter) */}
      {showSoloUpgradeModal && (
        <div className="modal-overlay open" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999, backdropFilter: 'blur(8px)' }}>
          <div className="modal-box" style={{ maxWidth: '450px', width: '90%', background: 'rgba(15, 23, 42, 0.98)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '20px', padding: '28px', boxShadow: '0 20px 50px rgba(0,0,0,0.5)', textAlign: 'center' }}>
            <div style={{ display: 'inline-flex', width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(123, 47, 247, 0.1)', border: '1px solid rgba(123, 47, 247, 0.25)', alignItems: 'center', justifyContent: 'center', fontSize: '24px', color: '#a855f7', marginBottom: '16px' }}>
              🧠
            </div>
            
            <h3 style={{ fontFamily: "'Orbitron', sans-serif", fontSize: '16px', fontWeight: 800, color: 'white', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '12px' }}>
              ACTUALIZA A SOLO LIFTER PRO
            </h3>
            
            <p style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.6)', lineHeight: '1.6', marginBottom: '20px' }}>
              Las sugerencias pre-entrenamiento del <strong>Smart Coach</strong> y la automatización de sobrecarga progresiva son exclusivas del plan premium. ¡Desbloquea rutinas ilimitadas, reglas avanzadas y Smart Coach por solo <strong>$19.900 COP / mes</strong>!
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                onClick={() => handleMercadoPagoCheckout('premium', '/dashboard')}
                disabled={paymentLoading}
                style={{
                  background: 'linear-gradient(135deg, #7b2ff7, #00d4ff)',
                  color: 'white', border: 'none', padding: '12px', borderRadius: '10px',
                  fontSize: '11px', fontFamily: "'Orbitron', sans-serif", fontWeight: 700,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  boxShadow: '0 4px 15px rgba(123, 47, 247, 0.25)',
                  cursor: paymentLoading ? 'not-allowed' : 'pointer',
                  opacity: paymentLoading ? 0.7 : 1
                }}
              >
                {paymentLoading ? 'PROCESANDO PAGO...' : 'PAGAR CON MERCADOPAGO 💳'}
              </button>
              
              <a
                href={`https://wa.me/573113666959?text=Hola!%20Quiero%20adquirir%20el%20plan%20Solo%20Lifter%20Pro%20en%20Evolution%20Lab.%20Mi%20correo%20de%20usuario%20es:%20${encodeURIComponent(profile?.email || '')}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  background: 'rgba(37, 211, 102, 0.12)',
                  border: '1px solid rgba(37, 211, 102, 0.35)',
                  color: '#4ade80', textDecoration: 'none', padding: '12px', borderRadius: '10px',
                  fontSize: '11px', fontFamily: "'Orbitron', sans-serif", fontWeight: 700,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  cursor: paymentLoading ? 'not-allowed' : 'pointer',
                  pointerEvents: paymentLoading ? 'none' : 'auto'
                }}
              >
                PAGAR CON NEQUI/PSE (WHATSAPP 💬)
              </a>

              <button
                onClick={() => setShowSoloUpgradeModal(false)}
                disabled={paymentLoading}
                style={{
                  background: 'transparent', border: '1px solid rgba(255, 255, 255, 0.1)', color: 'rgba(255, 255, 255, 0.6)',
                  padding: '10px', borderRadius: '10px', fontSize: '11px', fontFamily: "'Orbitron', sans-serif",
                  fontWeight: 700, cursor: paymentLoading ? 'not-allowed' : 'pointer', transition: 'all 0.2s'
                }}
              >
                LUEGO
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Onboarding welcome modal */}
      {showOnboarding && (
        <OnboardingModal 
          onClose={() => setShowOnboarding(false)} 
          rol={isSoloClient ? 'cliente_autonomo' : 'cliente_guiado'}
          suscripcionPlan={profile?.suscripcion_plan || 'free'}
        />
      )}

      {/* Shareable Progress Card Modal */}
      {showShareCard && (
        <ShareableProgressCard
          onClose={() => setShowShareCard(false)}
          athleteName={profile?.nombre || plan?.portada?.userName || 'Atleta Evolution'}
          themeColor={trainerProfile?.marca?.color_primario || 'var(--theme-primary)'}
          themeSecondaryColor={trainerProfile?.marca?.color_secundario || 'var(--theme-secondary)'}
          sesiones={overloadSessions}
          rol={isSoloClient ? 'cliente_autonomo' : 'cliente_guiado'}
          suscripcionPlan={profile?.suscripcion_plan || 'free'}
        />
      )}

      {/* INITIAL PERIODIZATION EVALUATION MODAL OVERLAY */}
      {isEvaluationPending && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          background: 'rgba(0,0,0,0.85)',
          backdropFilter: 'blur(10px)',
          zIndex: 999999,
          padding: '20px',
          boxSizing: 'border-box',
          overflowY: 'auto'
        }}>
          <InitialPeriodizationEvaluation
            plan={plan}
            onSave={async (config) => {
              if (!plan || !user) return;
              const updatedPlan = {
                ...plan,
                periodizationConfig: config
              };
              
              try {
                // Save to Supabase
                const { error } = await supabase
                  .from('planes')
                  .update({ datos_plan: updatedPlan })
                  .eq('cliente_id', user.id)
                  .eq('activo', true);

                if (error) throw error;

                // Update local state and cache
                setPlan(updatedPlan);
                localStorage.setItem('pwa_client_plan', JSON.stringify(updatedPlan));
                showToast('¡Diagnóstico inicial guardado y calibrado con éxito! 💪', 'success');
              } catch (err: any) {
                console.error('Error saving periodization diagnostic:', err);
                showToast('Error al guardar el diagnóstico: ' + err.message, 'error');
              }
            }}
            onCancel={() => {
              navigate('/');
            }}
          />
        </div>
      )}

      {/* Plan Update Notification Modal */}
      {showUpdateModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          background: 'rgba(0,0,0,0.85)',
          backdropFilter: 'blur(10px)',
          zIndex: 999999,
          padding: '20px',
          boxSizing: 'border-box'
        }}>
          <div style={{
            background: 'var(--theme-card-bg)',
            border: '1px solid var(--theme-primary)',
            borderRadius: '20px',
            padding: '24px',
            maxWidth: '400px',
            width: '100%',
            textAlign: 'center',
            boxShadow: '0 0 30px rgba(var(--theme-primary-rgb), 0.3)'
          }}>
            <div style={{ fontSize: '40px', marginBottom: '16px' }}>🤖</div>
            <h3 style={{ fontFamily: "'Orbitron', sans-serif", fontSize: '18px', color: 'white', marginBottom: '12px' }}>
              ¡Tu Plan se ha Actualizado!
            </h3>
            <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.7)', lineHeight: '1.5', marginBottom: '24px' }}>
              El sistema analizó tus registros recientes y ha calibrado automáticamente tus pesos y series sugeridas para esta semana. 
              Busca el icono 🤖 en tu plan para ver tus nuevas cargas adaptadas a tu nivel.
            </p>
            <button
              onClick={() => setShowUpdateModal(false)}
              style={{
                width: '100%',
                background: 'var(--theme-primary)',
                color: 'black',
                border: 'none',
                padding: '12px',
                borderRadius: '12px',
                fontSize: '14px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              ¡Entendido! 💪
            </button>
          </div>
        </div>
      )}

      {/* Global Toast Alert */}
      <Toast message={toastState.message} type={toastState.type} visible={toastState.visible} />
    </div>
  );
};

export default AthleteDashboard;
