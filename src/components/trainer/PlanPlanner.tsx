import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { useSupabase } from '../../context/SupabaseContext';
import { Profile, PlanData, TrainingDay, Exercise, GlobalVariable, EjercicioGlobal, PeriodizationConfig } from '../../types/database.types';
import Toast from '../common/Toast';
import { InfoTooltip } from '../common/InfoTooltip';
import ReasoningTooltip, { buildLoadReasoningSteps, buildVolumeReasoningSteps } from '../common/ReasoningTooltip';
import { getPrescribedLoadDetailed, mapExerciseToLiftKey } from '../../lib/periodizationEngine';
import { PeriodizationHelpModal } from '../common/PeriodizationHelpModal';
import { getThresholdsForMuscleGroup } from '../../lib/volumeThresholds';
import { VolumeThresholdsTable } from './VolumeThresholdsTable';
import { VolumeDistributorWizard } from './VolumeDistributorWizard';
import { GuidedPlanSetup, GuidedPlanParams } from './GuidedPlanSetup';
import { ProtocolSelectorModal } from './ProtocolSelectorModal';
import { getProtocolsForContext } from '../../lib/protocols';
import { VolumeTracker } from './VolumeTracker';
import { PeriodizationPanel } from './PeriodizationPanel';
import { SmartBlockBuilderModal, ProgModalState, ExerciseHistoryEntry } from './SmartBlockBuilderModal';
import { getDefaultParamsForTemplate } from '../../lib/progressionTemplates';
import { 
  getStrengthThreshold, 
  evaluateStrengthVolumeDetailed,
  detectPatternFromExerciseName, 
} from '../../lib/strengthThresholds';
import { GeneratedSession } from '../../lib/sessionDistributor';
import {
  Chart as ChartJS,
  RadialLinearScale,
  ArcElement,
  Tooltip as ChartTooltipPlugin,
  Legend as ChartLegendPlugin,
  PointElement as ChartPointElement,
  LineElement as ChartLineElement,
  Filler as ChartFiller,
} from 'chart.js';
import { Radar } from 'react-chartjs-2';

ChartJS.register(RadialLinearScale, ArcElement, ChartTooltipPlugin, ChartLegendPlugin, ChartPointElement, ChartLineElement, ChartFiller);

const DEFAULT_VARIABLE_DEFINITIONS: Record<string, string> = {
  "series de aproximacion": "Son series previas con poco peso para calentar los músculos y preparar las articulaciones sin cansarte. Ejemplo: Si vas a levantar 50kg, haces una serie previa con solo la barra o con 20kg.",
  "series de trabajo": "Son las series reales del plan donde el esfuerzo es alto y cuentan para el progreso. Ejemplo: Hacer 3 series de 10 repeticiones con el peso máximo que dominas.",
  "repeticiones": "Es el número de veces que realizas el movimiento completo del ejercicio dentro de una serie. Ejemplo: hacer 12 sentadillas seguidas sin parar.",
  "tempo": "Es la velocidad a la que realizas cada fase del movimiento (bajada, pausa y subida). Ejemplo: En sentadilla, bajar en 3 segundos, hacer 1 segundo de pausa abajo y subir rápido en 1 segundo.",
  "rir": "Indica cuántas repeticiones sientes que podrías haber hecho antes de llegar al fallo total. Ejemplo: Si haces 10 repeticiones con un RIR 2, significa que terminaste sintiendo que podrías haber hecho 2 más.",
  "descanso": "El tiempo que esperas entre una serie y otra para recuperar energía. Ejemplo: Cronometrar 2 minutos sentado antes de empezar la siguiente serie.",
  "peso": "Representa la resistencia externa que se opone a la contracción muscular para generar estímulo de adaptación en el organismo."
};

const DEFAULT_VARS: GlobalVariable[] = [
  { id: "series de aproximacion", label: "SERIES DE APROXIMACION", type: "number", defaultValue: "2" },
  { id: "series de trabajo", label: "SERIES DE TRABAJO", type: "text", defaultValue: "3" },
  { id: "repeticiones", label: "REPETICIONES", type: "text", defaultValue: "10-12" },
  { id: "tempo", label: "TEMPO", type: "text", defaultValue: "2:1:1" },
  { id: "rir", label: "RIR", type: "number", defaultValue: "2" },
  { id: "descanso", label: "DESCANSO(MIN)", type: "number", defaultValue: "120" },
  { id: "peso", label: "PESO(KG)", type: "text", defaultValue: "10" }
];

export const PlanPlanner: React.FC = () => {
  const { clienteId } = useParams<{ clienteId: string }>();
  const navigate = useNavigate();
  const { profile } = useSupabase();

  // Estados de datos
  const [clientProfile, setClientProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [existingPlanId, setExistingPlanId] = useState<string | null>(null);

  // Estados de interfaz y navegación
  const [variablesOpen, setVariablesOpen] = useState<boolean>(false);
  const [showExitConfirm, setShowExitConfirm] = useState<boolean>(false);
  const [showTourSaveReminder, setShowTourSaveReminder] = useState<boolean>(false);
  const [show1RMCalculator, setShow1RMCalculator] = useState<boolean>(false);
  const [calcWeight, setCalcWeight] = useState<number>(80);
  const [calcReps, setCalcReps] = useState<number>(8);
  const [calcRIR, setCalcRIR] = useState<number>(2);
  const [calcSelectedLift, setCalcSelectedLift] = useState<string>('press de banca');
  const [calcUnit, setCalcUnit] = useState<'kg' | 'lbs'>('kg');
  const [calcFormula, setCalcFormula] = useState<'promedio' | 'epley' | 'brzycki'>('promedio');

  /**
   * languageMode — controla qué tan técnico es el lenguaje de las alertas inline.
   *   'simple'  → solo headline + acción (entrenadores metodología intuitiva/experiencia)
   *   'tecnico' → headline + acción + dato técnico (entrenadores científicos)
   * Se lee desde datos_plan.language_mode al cargar el plan.
   * Default: 'tecnico' para no ocultar info a entrenadores sin onboarding.
   */
  const [languageMode, setLanguageMode] = useState<'simple' | 'tecnico'>('tecnico');

  // ── Guided mode — primer plan ──────────────────────────────────────────────
  const isFirstPlan = profile?.id ? !localStorage.getItem(`evolution_guided_plan_v1_${profile.id}`) : false;
  const [showGuidedSetup, setShowGuidedSetup]   = useState<boolean>(false);
  const [showTourTip,     setShowTourTip]        = useState<number>(0); // 0=off, 1-3=step
  const [tourComplete,    setTourComplete]        = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<number>(0);

  // Estados del Plan (editables)
  const [portada, setPortada] = useState<any>({
    userName: '',
    userGoal: '',
    startDate: new Date().toISOString().split('T')[0],
    planVigenciaPlan: '28',
    trainerName: '',
    whatsappLink: '',
    instagramLink: '',
    globalNote: 'Recuerda calentar 10 min antes. Respeta el RIR y tempo indicado. Hidrátate bien.'
  });
  const [globalVariables, setGlobalVariables] = useState<GlobalVariable[]>([]);
  const [variableDefinitions, setVariableDefinitions] = useState<Record<string, string>>({});
  const [weekdayMapping, setWeekdayMapping] = useState<Record<string, number>>({});
  const [trainingDays, setTrainingDays] = useState<TrainingDay[]>([]);
  const [microcycles, setMicrocycles] = useState<any[]>([]);
  const [trackerConfig, setTrackerConfig] = useState<any>({});
  const [trackerRules, setTrackerRules] = useState<any[]>([]);
  const [periodizationConfig, setPeriodizationConfig] = useState<PeriodizationConfig | undefined>(undefined);
  const [weeklyTargets, setWeeklyTargets] = useState<Record<string, number>>({});

  // Recalcular pesos sugeridos según marcas 1RM y configuración de periodización
  const recalculatePlanWeights = (
    days: TrainingDay[],
    marcas: Record<string, number>,
    formulaOverride?: 'epley' | 'brzycki' | 'epley_brzycki_avg',
    roundingOverride?: number
  ): TrainingDay[] => {
    const formula = formulaOverride || periodizationConfig?.formula_preferida || 'epley';
    const rounding = roundingOverride ?? periodizationConfig?.redondeo_peso ?? 2.5;

    return days.map(day => ({
      ...day,
      exercises: day.exercises.map(ex => {
        if (!ex.nombre) return ex;
        const normName = ex.nombre.toLowerCase().trim();
        
        // Buscar 1RM para este ejercicio con fallback robusto a marcas base
        let oneRM = marcas[normName];
        if (oneRM === undefined || oneRM === null || Number(oneRM) === 0 || String(oneRM).trim() === '' || isNaN(Number(oneRM))) {
          const alias = mapExerciseToLiftKey(normName);
          if (alias) {
            const aliasVal = marcas[alias];
            if (aliasVal && !isNaN(Number(aliasVal)) && Number(aliasVal) > 0) {
              oneRM = Number(aliasVal);
            }
          }
        }
        
        const numericOneRM = Number(oneRM) || 0;
        
        // Si hay 1RM, calcular peso sugerido usando la fórmula y redondeo preferidos
        if (numericOneRM && numericOneRM > 0) {
          const repsStr = ex.variables?.['repeticiones'] || '';
          const repsMatch = repsStr.match(/\d+/);
          const reps = repsMatch ? parseInt(repsMatch[0], 10) : 0;
          
          const rirStr = ex.variables?.['rir'] || '0';
          const rirMatch = rirStr.match(/\d+/);
          const targetRIR = rirMatch ? parseFloat(rirMatch[0]) : 0;
          
          if (reps > 0) {
            const lp = getPrescribedLoadDetailed(numericOneRM, reps, targetRIR, formula, rounding);
            const newLoad = lp.weight;
            if (newLoad > 0) {
              return {
                ...ex,
                variables: {
                  ...ex.variables,
                  'peso': `🤖 ${newLoad} kg`
                }
              };
            }
          }
        } else {
          // Si no hay 1RM o es 0, y el peso era uno autogenerado anteriormente, lo limpiamos
          if (ex.variables && ex.variables['peso'] && ex.variables['peso'].startsWith('🤖')) {
            const updatedVars = { ...ex.variables };
            delete updatedVars['peso'];
            return {
              ...ex,
              variables: updatedVars
            };
          }
        }
        return ex;
      })
    }));
  };

  // Estado para el menú de automatización de progresión (Smart Block Builder)
  const [autoProgExId, setAutoProgExId] = useState<string | null>(null);

  // Estado para el panel de simetría de volumen
  const [volumeChartOpen, setVolumeChartOpen] = useState<boolean>(false);

  // Historial de ejercicios para permitir revertir cambios de automatización
  const [exerciseHistory, setExerciseHistory] = useState<Record<string, ExerciseHistoryEntry>>({});

  // Control del modal de automatización personalizada (Smart Block Builder)
  // El estado abierto/cerrado vive aquí porque se setea desde el dropdown
  // "⚙️ Progresión" de cada ejercicio (handleOpenProgression más abajo);
  // el modal en sí fue extraído a SmartBlockBuilderModal.tsx.
  const [progModal, setProgModal] = useState<ProgModalState | null>(null);

  // Periodization help modal state
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  const [thresholdsTableOpen, setThresholdsTableOpen] = useState(false);
  const [distributorWizardOpen, setDistributorWizardOpen] = useState(false);

  // Generar ID aleatorio
  const generateId = (): string => Math.random().toString(36).substring(2, 11);

  const handleApplyDistribution = (sessions: GeneratedSession[], targets: Record<string, number>) => {
    // Si se pasa un arreglo vacío (como en el modo Fuerza), solo actualizamos targets
    if (sessions.length === 0) {
      setWeeklyTargets(targets);
      setDistributorWizardOpen(false);
      return;
    }

    // Si ya hay ejercicios creados, advertimos
    const hasExercises = trainingDays.some(day => day.exercises && day.exercises.some(ex => ex.nombre_original !== ''));
    if (hasExercises) {
      if (!window.confirm("Aplicar el esqueleto de volumen reemplazará los días y ejercicios actuales. ¿Estás seguro de que quieres continuar?")) {
        return;
      }
    }

    // Reemplazar trainingDays
    const newDays: TrainingDay[] = sessions.map(session => {
      return {
        id: `day_${generateId()}`,
        name: session.label,
        exercises: session.muscleTargets.map(target => {
          const exVariables = { ...Object.fromEntries(globalVariables.map(gv => [gv.id, gv.defaultValue || ''])) };
          exVariables['series de trabajo'] = String(target.plannedSets);

          return {
            id: generateId(),
            nombre: `[ ESPACIO PARA: ${target.muscleGroup.toUpperCase()} ]`,
            nombre_original: '',
            grupo_muscular: target.muscleGroup,
            variables: exVariables,
            video_url: '',
            image_url: '',
            gif_url: ''
          } as Exercise;
        })
      };
    });

    setTrainingDays(newDays);
    setWeeklyTargets(targets);
    setDistributorWizardOpen(false);
    showToast('Esqueleto de distribución generado correctamente. ⚡', 'success');
  };

  // Capitalizar texto respetando acentos en español (ej. "Extensión de rodilla")
  const capitalizarEspanol = (str: string): string => {
    if (!str) return '';
    const conectores = ['de', 'con', 'en', 'para', 'la', 'el', 'un', 'una', 'del', 'al', 'y', 'a'];
    return str
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .map((word, index) => {
        if (!word) return '';
        if (index > 0 && conectores.includes(word)) {
          return word;
        }
        return word.charAt(0).toUpperCase() + word.slice(1);
      })
      .join(' ');
  };

  // Normalizar grupos musculares provenientes de Supabase para alinearlos con el planificador
  const normalizeMuscleGroup = (g: string | undefined | null): string => {
    if (!g) return '';
    const norm = g.toLowerCase().trim();
    if (norm.includes('pecho') || norm.includes('chest')) return 'Pecho';
    if (norm.includes('espalda') || norm.includes('back')) return 'Espalda';
    if (norm.includes('femoral') || norm.includes('isquio') || norm.includes('isquiotibiales') || norm.includes('isquiosurles') || norm.includes('isquiosurales')) return 'Isquiosurales';
    if (norm.includes('cuad') || norm.includes('cuádriceps') || norm.includes('cuadriceps')) return 'Cuádriceps';
    if (norm.includes('glute') || norm.includes('glúteo') || norm.includes('gluteo') || norm.includes('glúteos') || norm.includes('gluteos')) return 'Glúteos';
    if (norm.includes('hombro') || norm.includes('shoulder')) return 'Hombros';
    if (norm.includes('biceps') || norm.includes('bíceps')) return 'Bíceps';
    if (norm.includes('triceps') || norm.includes('tríceps')) return 'Tríceps';
    if (norm.includes('pantorrilla') || norm.includes('pantorrillas') || norm.includes('gemelo') || norm.includes('gemelos')) return 'Pantorrillas';
    if (norm.includes('core') || norm.includes('abdomen') || norm.includes('abs') || norm.includes('abdominales')) return 'Core';
    if (norm.includes('cardio') || norm.includes('aeróbico') || norm.includes('aerobico')) return 'Cardio';
    
    // Fallback: capitalizar primera letra
    return g.charAt(0).toUpperCase() + g.slice(1).toLowerCase();
  };

  // Estado: catalogo global de ejercicios (Supabase)
  const [globalCatalog, setGlobalCatalog] = useState<EjercicioGlobal[]>([]);
  const [globalCatalogNames, setGlobalCatalogNames] = useState<string[]>([]);
  
  const [protocolModalOpen, setProtocolModalOpen] = useState(false);
  const [activeInput, setActiveInput] = useState<{ dayId: string; exId: string } | null>(null);
  const [filteredSuggestions, setFilteredSuggestions] = useState<EjercicioGlobal[]>([]);

  // ── Handler del guided setup ───────────────────────────────────────────────
  const handleGuidedComplete = (params: GuidedPlanParams) => {
    if (profile?.id) {
      localStorage.setItem(`evolution_guided_plan_v1_${profile.id}`, 'true');
    }
    setShowGuidedSetup(false);

    // 0. Calibrar lenguaje según nivel — proxy de familiaridad técnica
    //    principiante → simple (sin datos técnicos en alertas)
    //    intermedio/avanzado → técnico (con datos técnicos)
    setLanguageMode(params.nivel === 'principiante' ? 'simple' : 'tecnico');

    // 1. Configurar periodización con los parámetros elegidos
    setPeriodizationConfig(prev => ({
      ...prev,
      enabled:                      true,
      objetivo:                     params.objetivo,
      total_semanas:                params.semanas,
      semana_actual:                1,
      nivel_atleta:                 params.nivel,
      rir_inicial:                  params.nivel === 'avanzado' ? 4 : 3,
      rir_progresion:               params.nivel === 'principiante' ? 'lenta' : 'normal',
      // FIX: sessions_per_week se setea desde params.dias al crear el plan,
      // no desde trainingDays.length en runtime. Evita desincronización si el
      // entrenador modifica los días del plan después de crearlo.
      sessions_per_week:            params.dias,
      sessions_completed_this_week: 0,
      weekly_session_feedback:      [],
    }));

    // 2. Buscar el protocolo más adecuado para objetivo + nivel
    const protocols = getProtocolsForContext(params.objetivo, params.nivel);
    const best      = protocols.find(p => p.daysPerWeek === params.dias) || protocols[0];

    if (best) {
      const newDays: TrainingDay[] = best.days.map((day, idx) => ({
        id:        `day_${idx + 1}`,
        dayNumber: idx + 1,
        name:      day.label,
        exercises: day.exercises.map(ex => ({
          id:              crypto.randomUUID(),
          nombre:          ex.name,
          nombre_original: ex.name,
          grupo_muscular:  ex.muscle,
          variables: {
            'series de trabajo': ex.sets,
            'repeticiones':      ex.reps,
            'rir':               ex.rir,
            'descanso':          ex.rest,
          },
        })),
      }));
      setTrainingDays(newDays);
    }

    // 3. Activar tour si el entrenador lo pidió
    if (params.wantsTour) {
      setTimeout(() => setShowTourTip(1), 500);
    }
  };

  // ── Trigger del guided setup al cargar si es primer plan ──────────────────
  useEffect(() => {
    if (isFirstPlan && !loading) {
      setShowGuidedSetup(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  // Cargar catalogo global de ejercicios una sola vez
  useEffect(() => {
    const fetchGlobalCatalog = async () => {
      try {
        const { data, error } = await supabase
          .from('ejercicios_globales')
          .select('nombre, grupo_muscular, imagen_url, video_url, descripcion')
          .order('nombre');
        if (!error && data) {
          const normalized = (data as any[]).map((e: any) => ({
            ...e,
            grupo_muscular: normalizeMuscleGroup(e.grupo_muscular)
          }));
          setGlobalCatalog(normalized as EjercicioGlobal[]);
          setGlobalCatalogNames(normalized.map((e: any) => capitalizarEspanol(e.nombre)));
        }
      } catch (e) {
        console.warn('No se pudo cargar el catalogo global de ejercicios:', e);
      }
    };
    fetchGlobalCatalog();
  }, []);

  // Opciones de autocompletado recopiladas del plan actual, localStorage y catalogo global
  const computedExerciseOptions = useMemo(() => {
    try {
      const setNames = new Set<string>();
      
      // 1. Catalogo global de ejercicios (Supabase)
      globalCatalogNames.forEach(name => setNames.add(name));

      // 2. Dias del plan actual
      if (Array.isArray(trainingDays)) {
        trainingDays.forEach(day => {
          if (day && Array.isArray(day.exercises)) {
            day.exercises.forEach(ex => {
              if (ex && typeof ex.nombre === 'string' && ex.nombre.trim()) {
                const pretty = capitalizarEspanol(ex.nombre);
                if (pretty) setNames.add(pretty);
              }
            });
          }
        });
      }
      
      // 3. Biblioteca local en localStorage (aislada por entrenador)
      const trainerId = profile?.id || 'default';
      const libraryStr = localStorage.getItem(`evolution_exercise_library_${trainerId}`);
      if (libraryStr) {
        const library = JSON.parse(libraryStr);
        Object.keys(library).forEach(name => {
          if (name && typeof name === 'string') {
            const pretty = capitalizarEspanol(name);
            if (pretty) setNames.add(pretty);
          }
        });
      }
      
      return Array.from(setNames).sort();
    } catch (e) {
      console.error('Error al generar opciones de autocompletado:', e);
      return [];
    }
  }, [trainingDays, globalCatalogNames, profile?.id]);

  // Helper to parse volume series
  const parseSeries = (seriesStr: string | undefined): number => {
    if (!seriesStr) return 0;
    const cleanStr = seriesStr.trim();
    if (!cleanStr) return 0;
    const rangeMatch = cleanStr.match(/^(\d+)\s*-\s*(\d+)$/);
    if (rangeMatch) {
      const min = parseInt(rangeMatch[1], 10);
      const max = parseInt(rangeMatch[2], 10);
      return (min + max) / 2;
    }
    const singleMatch = cleanStr.match(/^(\d+)/);
    if (singleMatch) {
      return parseInt(singleMatch[1], 10);
    }
    return 0;
  };

  // Helper to parse volume reps
  const parseReps = (repsStr: string | undefined): number => {
    if (!repsStr) return 0;
    const cleanStr = repsStr.trim();
    if (!cleanStr) return 0;
    const rangeMatch = cleanStr.match(/^(\d+)\s*-\s*(\d+)$/);
    if (rangeMatch) {
      const min = parseInt(rangeMatch[1], 10);
      const max = parseInt(rangeMatch[2], 10);
      return (min + max) / 2;
    }
    const singleMatch = cleanStr.match(/^(\d+)/);
    if (singleMatch) {
      return parseInt(singleMatch[1], 10);
    }
    return 0;
  };

  // Sumar volumen total de Fuerza de TODA la semana por patrón (NL = series * reps)
  const weeklyNLData = useMemo(() => {
    const nlMap: Record<string, number> = {};
    if (trainingDays && Array.isArray(trainingDays)) {
      trainingDays.forEach(day => {
        if (day && Array.isArray(day.exercises)) {
          day.exercises.forEach(ex => {
            const pattern = detectPatternFromExerciseName(ex.nombre || '');
            if (pattern) {
              const seriesStr = ex.variables?.['series de trabajo'] || ex.variables?.['series'] || '';
              const repsStr = ex.variables?.['repeticiones'] || ex.variables?.['reps'] || '';
              const series = parseSeries(seriesStr);
              const reps = parseReps(repsStr);
              nlMap[pattern] = (nlMap[pattern] || 0) + (series * reps);
            }
          });
        }
      });
    }
    return nlMap;
  }, [trainingDays]);

  // Calcular distribución de volumen (series efectivas) por grupo muscular en el día activo
  const activeDayVolumeData = useMemo(() => {
    const volumeMap: Record<string, number> = {
      'Pecho': 0,
      'Espalda': 0,
      'Cuádriceps': 0,
      'Isquiosurales': 0,
      'Hombros': 0,
      'Bíceps': 0,
      'Tríceps': 0,
      'Core': 0,
      'Glúteos': 0,
      'Pantorrillas': 0,
      'Cardio': 0
    };

    const safeIdx = activeTab >= trainingDays.length ? 0 : activeTab;
    const day = trainingDays[safeIdx];
    if (day && Array.isArray(day.exercises)) {
      day.exercises.forEach(ex => {
        const gm = normalizeMuscleGroup((ex as any).grupo_muscular);
        if (gm && volumeMap[gm] !== undefined) {
          const seriesStr = ex.variables['series de trabajo'] || ex.variables['series'] || '';
          volumeMap[gm] += parseSeries(seriesStr);
        }
      });
    }

    return volumeMap;
  }, [trainingDays, activeTab]);

  // Sumar volumen total del día activo
  const totalActiveDayVolume = useMemo(() => {
    return Object.values(activeDayVolumeData).reduce((sum, val) => sum + val, 0);
  }, [activeDayVolumeData]);

  // Sumar volumen total de TODA la semana por grupo muscular (Auditoría MRV)
  const weeklyVolumeData = useMemo(() => {
    const volumeMap: Record<string, number> = {};
    if (trainingDays && Array.isArray(trainingDays)) {
      trainingDays.forEach(day => {
        if (day && Array.isArray(day.exercises)) {
          day.exercises.forEach(ex => {
            const gm = getThresholdsForMuscleGroup((ex as any).grupo_muscular || '', periodizationConfig?.nivel_atleta, periodizationConfig?.objetivo as any).gm;
            const seriesStr = ex.variables?.['series de trabajo'] || ex.variables?.['series'] || '';
            const series = parseSeries(seriesStr);
            volumeMap[gm] = (volumeMap[gm] || 0) + series;
          });
        }
      });
    }
    return volumeMap;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trainingDays]);

  // Generar datos detallados y porcentaje para las barras de progreso
  const volumeSummaryStats = useMemo(() => {
    const maxVal = Math.max(...Object.values(activeDayVolumeData), 1);
    const list = Object.entries(activeDayVolumeData)
      .filter(([_, val]) => val > 0)
      .sort((a, b) => b[1] - a[1]);
    return { list, maxVal };
  }, [activeDayVolumeData]);

  // Configurar datos del Radar Chart
  const radarChartData = useMemo(() => {
    const labels = Object.keys(activeDayVolumeData);
    const data = Object.values(activeDayVolumeData);

    return {
      labels,
      datasets: [
        {
          label: 'Series Efectivas',
          data,
          backgroundColor: 'rgba(255, 126, 46, 0.2)', // Naranja traslúcido
          borderColor: '#ff7e2e',                     // Naranja
          borderWidth: 2,
          pointBackgroundColor: '#ff7e2e',
          pointBorderColor: '#fff',
          pointHoverBackgroundColor: '#fff',
          pointHoverBorderColor: '#ff7e2e',
        }
      ]
    };
  }, [activeDayVolumeData]);

  // Opciones del Radar Chart
  const radarChartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      r: {
        angleLines: {
          color: 'rgba(255, 255, 255, 0.1)',
        },
        grid: {
          color: 'rgba(255, 255, 255, 0.08)',
        },
        pointLabels: {
          color: 'rgba(255, 255, 255, 0.7)',
          font: {
            family: "'Orbitron', sans-serif",
            size: 10,
          },
        },
        ticks: {
          color: 'rgba(255, 255, 255, 0.4)',
          backdropColor: 'transparent',
          font: {
            size: 9,
          },
          stepSize: 2,
        },
        suggestedMin: 0,
        suggestedMax: 10,
      },
    },
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        titleColor: '#ff7e2e',
        bodyColor: '#fff',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
        titleFont: {
          family: "'Orbitron', sans-serif",
          weight: 'bold',
        },
        bodyFont: {
          family: 'inherit',
        },
        callbacks: {
          label: (context: any) => ` ${context.raw} series efectivas`,
        },
      },
    },
  }), []);

  // Estados de variables temporales para agregar
  const [newVarLabel, setNewVarLabel] = useState<string>('');
  const [newVarDef, setNewVarDef] = useState<string>('');

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

  // Inicializar plan limpio por defecto
  const resetToDefaultPlan = (profileData?: Profile) => {
    const initialExercises = (count: number): Exercise[] => {
      const arr: Exercise[] = [];
      for (let i = 0; i < count; i++) {
        arr.push({
          id: generateId(),
          nombre: '',
          nombre_original: '',
          variables: {},
          video_url: '',
          image_url: '',
          gif_url: ''
        });
      }
      return arr;
    };

    setGlobalVariables(DEFAULT_VARS);
    setVariableDefinitions(DEFAULT_VARIABLE_DEFINITIONS);
    setWeekdayMapping({ '0': -1, '1': -1, '2': -1, '3': -1, '4': -1, '5': -1, '6': -1 });
    setTrainingDays([
      { id: "day_1", name: "Día 1 - Pecho y Tríceps", exercises: initialExercises(3) },
      { id: "day_2", name: "Día 2 - Espalda y Bíceps", exercises: initialExercises(3) },
      { id: "day_3", name: "Día 3 - Cuádriceps e Isquiosurales", exercises: initialExercises(3) },
      { id: "day_4", name: "Día 4 - Hombros y Abdominales", exercises: initialExercises(3) },
      { id: "day_5", name: "Día 5 - Full Body / Cardio", exercises: initialExercises(3) }
    ]);
    setTrackerConfig({
      minSesiones: 4,
      ventana: 6,
      diasDescansoExcesivo: 7,
      diasOptimo: 3,
      sesionesRegresionAlerta: 3,
      semanasEstancamiento: 3
    });
    setTrackerRules([]);
    setPeriodizationConfig({
      enabled: false,
      objetivo: 'hipertrofia',
      semana_actual: 1,
      total_semanas: 4,
      mrv_limite_alcanzado: false,
      marcas_1rm: {},
      puntos_debiles: {
        sentadilla: 'abajo',
        banca: 'pecho',
        peso_muerto: 'despegue'
      }
    });

    if (profileData) {
      setPortada({
        userName: profileData.nombre || '',
        userGoal: profileData.objetivo || '',
        startDate: profileData.fecha_inicio || new Date().toISOString().split('T')[0],
        planVigenciaPlan: String(profileData.vigencia_dias || '28'),
        trainerName: profile?.nombre || '',
        whatsappLink: '',
        instagramLink: '',
        globalNote: 'Recuerda calentar 10 min antes. Respeta el RIR y tempo indicado. Hidrátate bien.'
      });
    }
  };

  // Cargar datos del cliente y plan
  useEffect(() => {
    const loadData = async () => {
      if (!clienteId) return;
      setLoading(true);

      try {
        // 1. Cargar perfil del cliente
        const { data: profData, error: profError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', clienteId)
          .single();

        if (profError) throw profError;
        setClientProfile(profData as Profile);

        // Sincronizar los planes del entrenador desde Supabase para crear una biblioteca de autocompletado privada
        try {
          const trainerId = profile?.id;
          if (trainerId) {
            const { data: plansData } = await supabase
              .from('planes')
              .select('datos_plan')
              .eq('creador_id', trainerId);

            if (plansData) {
              const libraryKey = `evolution_exercise_library_${trainerId}`;
              const library = JSON.parse(localStorage.getItem(libraryKey) || '{}');
              let updated = false;

              plansData.forEach(p => {
                const dp = p.datos_plan as any;
                if (dp && Array.isArray(dp.trainingDays)) {
                  dp.trainingDays.forEach((day: any) => {
                    if (day && Array.isArray(day.exercises)) {
                      day.exercises.forEach((ex: any) => {
                        if (ex && ex.nombre) {
                          const nameClean = ex.nombre.trim().toLowerCase();
                          const imageVal = ex.image_url || ex.imageData || '';
                          const gifVal = ex.gif_url || ex.gifData || '';
                          const videoVal = ex.video_url || ex.videoUrl || '';
                          const descVal = ex.description || '';
                          const origVal = ex.nombre_original || '';
                          const gmVal = normalizeMuscleGroup(ex.grupo_muscular || '');

                          if (nameClean && (imageVal || gifVal || videoVal || descVal || origVal || gmVal)) {
                            if (
                              !library[nameClean] ||
                              (imageVal && library[nameClean].imageData !== imageVal) ||
                              (gifVal && library[nameClean].gifData !== gifVal) ||
                              (videoVal && library[nameClean].videoUrl !== videoVal) ||
                              (descVal && library[nameClean].description !== descVal) ||
                              (origVal && library[nameClean].nombreOriginal !== origVal) ||
                              (gmVal && library[nameClean].grupoMuscular !== gmVal)
                            ) {
                              library[nameClean] = {
                                imageData: imageVal || library[nameClean]?.imageData || '',
                                gifData: gifVal || library[nameClean]?.gifData || '',
                                videoUrl: videoVal || library[nameClean]?.videoUrl || '',
                                description: descVal || library[nameClean]?.description || '',
                                nombreOriginal: origVal || library[nameClean]?.nombreOriginal || '',
                                grupoMuscular: gmVal || library[nameClean]?.grupoMuscular || ''
                              };
                              updated = true;
                            }
                          }
                        }
                      });
                    }
                  });
                }
              });

              if (updated) {
                localStorage.setItem(libraryKey, JSON.stringify(library));
                console.log(`✨ [Biblioteca de Ejercicios] Biblioteca local del entrenador ${trainerId} sincronizada desde Supabase:`, library);
              }
            }
          }
        } catch (e) {
          console.error('Error al sincronizar biblioteca de ejercicios desde Supabase:', e);
        }

        // 2. Cargar plan activo
        const { data: planData, error: planError } = await supabase
          .from('planes')
          .select('*')
          .eq('cliente_id', clienteId)
          .eq('activo', true)
          .maybeSingle();

        if (planError) throw planError;

        if (planData && planData.datos_plan) {
          setExistingPlanId(planData.id);
          const p = planData.datos_plan as PlanData;

          // Leer language_mode guardado por el onboarding
          if ((p as any).language_mode === 'simple' || (p as any).language_mode === 'tecnico') {
            setLanguageMode((p as any).language_mode);
          }
          if (p.globalVariables && Array.isArray(p.globalVariables) && p.globalVariables.length > 0) {
            setGlobalVariables(p.globalVariables);
          } else {
            setGlobalVariables(DEFAULT_VARS);
          }
          if (p.weeklyTargets) setWeeklyTargets(p.weeklyTargets);
          setVariableDefinitions({
            ...DEFAULT_VARIABLE_DEFINITIONS,
            ...(p.variableDefinitions || {})
          });
          
          if (p.trainingDays) {
            const normalizedDays = p.trainingDays.map(day => {
              const exercises = (day.exercises || []).map((ex: any) => ({
                id: ex.id || 'ex_' + Math.random().toString(36).substring(2, 11),
                nombre: ex.nombre !== undefined ? ex.nombre : (ex.name !== undefined ? ex.name : ''),
                nombre_original: ex.nombre_original || '',
                variables: ex.variables || {},
                video_url: ex.video_url !== undefined ? ex.video_url : (ex.videoUrl !== undefined ? ex.videoUrl : ''),
                image_url: ex.image_url !== undefined ? ex.image_url : (ex.imageData !== undefined ? ex.imageData : ''),
                gif_url: ex.gif_url !== undefined ? ex.gif_url : (ex.gifData !== undefined ? ex.gifData : ''),
                description: ex.description || '',
                grupo_muscular: normalizeMuscleGroup(ex.grupo_muscular || ''),
                progression_notes: ex.progression_notes || '',
                progression_type: ex.progression_type,
                progression_params: ex.progression_params
              }));

              const currentExCount = exercises.length;
              if (currentExCount < 3) {
                const needed = 3 - currentExCount;
                for (let i = 0; i < needed; i++) {
                  exercises.push({
                    id: generateId(),
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
                // FIX: planes antiguos pueden no tener `id` en el día (solo lo
                // tenían los ejercicios). Sin id, los selects que iteran
                // trainingDays (ej. el mapeo de días de la semana) usan
                // key={day.id}=undefined para todos los días, lo cual genera
                // el warning de React "each child needs a unique key" y puede
                // causar reconciliación incorrecta entre renders.
                id: day.id || `day_${generateId()}`,
                exercises
              };
            });
            setTrainingDays(normalizedDays);
          }
          
          if (p.weekdayMapping) setWeekdayMapping(p.weekdayMapping);
          if (p.microcycles) setMicrocycles(p.microcycles);
          if (p.trackerConfig) setTrackerConfig(p.trackerConfig);
          if (p.trackerRules) setTrackerRules(p.trackerRules || []);
          if (p.portada) setPortada(p.portada);
          if (p.periodizationConfig) {
            const config = p.periodizationConfig;
            if (!config.marcas_1rm || Object.keys(config.marcas_1rm).length === 0) {
              config.marcas_1rm = {
                'sentadilla': 100,
                'sentadilla con barra': 100,
                'press de banca': 80,
                'press de banca con barra': 80,
                'peso muerto': 120,
                'peso muerto con barra': 120,
                'press militar': 50,
                'press militar con barra': 50,
                'prensa': 200,
                'remo con barra': 70
              };
            }
            // Asegurar redondeo_peso y formula por defecto si faltan
            if (!config.formula_preferida) config.formula_preferida = 'epley';
            if (config.redondeo_peso === undefined) config.redondeo_peso = 2.5;

            setPeriodizationConfig(config);
          } else {
            setPeriodizationConfig({
              enabled: false,
              objetivo: 'hipertrofia',
              semana_actual: 1,
              total_semanas: 4,
              mrv_limite_alcanzado: false,
              marcas_1rm: {
                'sentadilla': 100,
                'sentadilla con barra': 100,
                'press de banca': 80,
                'press de banca con barra': 80,
                'peso muerto': 120,
                'peso muerto con barra': 120,
                'press militar': 50,
                'press militar con barra': 50,
                'prensa': 200,
                'remo con barra': 70
              },
              puntos_debiles: { sentadilla: 'abajo', banca: 'pecho', peso_muerto: 'despegue' },
              formula_preferida: 'epley',
              redondeo_peso: 2.5
            });
          }
          showToast('¡Plan activo cargado correctamente!', 'success');
        } else {
          resetToDefaultPlan(profData as Profile);
          showToast('Creando plan nuevo por defecto.', 'info');
        }
      } catch (err: any) {
        console.error('Error al cargar planificador:', err);
        showToast('Error al cargar: ' + err.message, 'error');
      } finally {
        setLoading(false);
      }
    };

    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [clienteId, profile?.id, profile?.nombre]);

  // Manejar cambios en portada
  const handlePortadaChange = (field: string, val: string) => {
    setPortada((prev: any) => ({ ...prev, [field]: val }));
  };

  // Mapear días de la semana
  const handleWeekdayMap = (dayOfWeek: string, dayIndex: number) => {
    setWeekdayMapping((prev) => ({ ...prev, [dayOfWeek]: dayIndex }));
  };

  // Variables globales
  const handleAddGlobalVar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVarLabel.trim()) return;

    const varId = newVarLabel.toLowerCase().trim();
    if (globalVariables.some(v => v.id === varId)) {
      alert('La variable ya existe.');
      return;
    }

    const newVar: GlobalVariable = {
      id: varId,
      label: newVarLabel.toUpperCase().trim(),
      type: 'text',
      defaultValue: ''
    };

    setGlobalVariables(prev => [...prev, newVar]);
    if (newVarDef.trim()) {
      setVariableDefinitions(prev => ({ ...prev, [varId]: newVarDef.trim() }));
    }

    setNewVarLabel('');
    setNewVarDef('');
    showToast('Variable global añadida.', 'success');
  };

  const handleRemoveGlobalVar = (id: string) => {
    if (window.confirm('¿Eliminar esta variable global del plan? Se quitará de todos los ejercicios.')) {
      setGlobalVariables(prev => prev.filter(v => v.id !== id));
      setVariableDefinitions(prev => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });
    }
  };

  // Días de entrenamiento
  const handleAddDay = () => {
    const nextIdx = trainingDays.length + 1;
    const newDay: TrainingDay = {
      id: `day_${generateId()}`,
      name: `Día ${nextIdx} - Nuevo Día`,
      exercises: [
        { id: generateId(), nombre: '', nombre_original: '', variables: {} }
      ]
    };
    setTrainingDays(prev => {
      const next = [...prev, newDay];
      setActiveTab(next.length - 1);
      return next;
    });
  };

  const handleRemoveDay = (dayId: string) => {
    if (window.confirm('¿Seguro que deseas eliminar este día completo de entrenamiento?')) {
      setTrainingDays(prev => {
        const next = prev.filter(d => d.id !== dayId);
        if (activeTab >= next.length) {
          setActiveTab(Math.max(0, next.length - 1));
        }
        return next;
      });
    }
  };

  const handleDayNameChange = (dayId: string, newName: string) => {
    setTrainingDays(prev =>
      prev.map(d => (d.id === dayId ? { ...d, name: newName } : d))
    );
  };

  // Ejercicios
  const handleAddExercise = (dayId: string) => {
    setTrainingDays(prev =>
      prev.map(d => {
        if (d.id === dayId) {
          return {
            ...d,
            exercises: [
              ...d.exercises,
              { id: generateId(), nombre: '', nombre_original: '', variables: {} }
            ]
          };
        }
        return d;
      })
    );
  };

  const handleRemoveExercise = (dayId: string, exId: string) => {
    setTrainingDays(prev =>
      prev.map(d => {
        if (d.id === dayId) {
          return {
            ...d,
            exercises: d.exercises.filter(ex => ex.id !== exId)
          };
        }
        return d;
      })
    );
  };

  const handleExerciseChange = (dayId: string, exId: string, field: keyof Exercise, val: any) => {
    setTrainingDays(prev =>
      prev.map(d => {
        if (d.id === dayId) {
          return {
            ...d,
            exercises: d.exercises.map(ex => {
              if (ex.id === exId) {
                // Si cambiamos el nombre, verificar si podemos auto-rellenar multimedia desde la biblioteca local o global
                if (field === 'nombre') {
                  try {
                    const trainerId = profile?.id || 'default';
                    const libraryKey = `evolution_exercise_library_${trainerId}`;
                    const library = JSON.parse(localStorage.getItem(libraryKey) || '{}');
                    const key = (val || '').trim().toLowerCase();

                    const foundLocal = library[key];
                    const foundGlobal = globalCatalog.find(
                      g => g.nombre.trim().toLowerCase() === key
                    );

                    let nextImageUrl = ex.image_url || '';
                    let nextGifUrl = ex.gif_url || '';
                    let nextVideoUrl = ex.video_url || '';
                    let nextDescription = (ex as any).description || '';
                    let nextNombreOriginal = ex.nombre_original || '';
                    let nextGrupoMuscular = ex.grupo_muscular || '';

                    const isCustomUpload = ex.image_url && ex.image_url.includes(`/${trainerId}/`);

                    if (foundLocal || foundGlobal) {
                      // Priorizar valores locales (historial) pero con fallback a valores globales si los locales están vacíos
                      nextImageUrl = (foundLocal?.imageData) || (foundGlobal?.imagen_url) || '';
                      nextGifUrl = (foundLocal?.gifData) || '';
                      nextVideoUrl = (foundLocal?.videoUrl) || '';
                      nextDescription = (foundLocal?.description) || (foundGlobal?.descripcion) || '';
                      nextNombreOriginal = (foundGlobal?.nombre) || (foundLocal?.nombreOriginal) || '';
                      nextGrupoMuscular = (foundGlobal?.grupo_muscular) || (foundLocal?.grupoMuscular) || '';
                      
                      if (foundLocal && foundGlobal) {
                        showToast(`✨ ¡Auto-rellenado (historial + catálogo global) para "${val}"!`, 'info');
                      } else if (foundLocal) {
                        showToast(`✨ ¡Auto-rellenado personalizado para "${val}"!`, 'info');
                      } else {
                        if (foundGlobal?.imagen_url) {
                          showToast(`✨ ¡Auto-rellenado global para "${val}"!`, 'info');
                        } else {
                          showToast(`ℹ️ "${val}" no tiene imagen. ¡Sube una para ayudar a otros!`, 'info');
                        }
                      }
                    } else {
                      // No hay coincidencia exacta (está escribiendo o es un ejercicio totalmente nuevo)
                      if (nextNombreOriginal) {
                        const origKey = nextNombreOriginal.trim().toLowerCase();
                        const linkedLocal = library[origKey];
                        const linkedGlobal = globalCatalog.find(
                          g => g.nombre.trim().toLowerCase() === origKey
                        );
                        
                        if (!isCustomUpload) {
                          nextImageUrl = ex.image_url || (linkedLocal?.imageData) || (linkedGlobal?.imagen_url) || '';
                          nextGifUrl = ex.gif_url || (linkedLocal?.gifData) || '';
                          nextVideoUrl = ex.video_url || (linkedLocal?.videoUrl) || '';
                          nextDescription = (ex as any).description || (linkedLocal?.description) || (linkedGlobal?.descripcion) || '';
                          nextGrupoMuscular = ex.grupo_muscular || (linkedGlobal?.grupo_muscular) || (linkedLocal?.grupoMuscular) || '';
                        }
                      } else {
                        // Si la imagen actual NO es un upload personalizado, la limpiamos para no arrastrar la imagen del ejercicio anterior
                        if (!isCustomUpload) {
                          nextImageUrl = '';
                          nextGifUrl = '';
                          nextVideoUrl = '';
                          nextDescription = '';
                          nextGrupoMuscular = '';
                        }
                      }
                      if (val.trim() === '') {
                        nextNombreOriginal = '';
                        nextImageUrl = '';
                        nextGifUrl = '';
                        nextVideoUrl = '';
                        nextDescription = '';
                        nextGrupoMuscular = '';
                      }
                    }

                    const updatedVars = { ...ex.variables };
                    const normName = (val || '').toLowerCase().trim();
                    const marcas = periodizationConfig?.marcas_1rm || {};
                    
                    let oneRM = marcas[normName];
                    if (oneRM === undefined || oneRM === null || Number(oneRM) === 0 || String(oneRM).trim() === '' || isNaN(Number(oneRM))) {
                      const alias = mapExerciseToLiftKey(normName);
                      if (alias) {
                        const aliasVal = marcas[alias];
                        if (aliasVal && !isNaN(Number(aliasVal)) && Number(aliasVal) > 0) {
                          oneRM = Number(aliasVal);
                        }
                      }
                    }
                    
                    const numericOneRM = Number(oneRM) || 0;
                    
                    if (numericOneRM && numericOneRM > 0) {
                      const repsStr = ex.variables?.['repeticiones'] || '';
                      const repsMatch = repsStr.match(/\d+/);
                      const reps = repsMatch ? parseInt(repsMatch[0], 10) : 0;
                      
                      const rirStr = ex.variables?.['rir'] || '0';
                      const rirMatch = rirStr.match(/\d+/);
                      const targetRIR = rirMatch ? parseFloat(rirMatch[0]) : 0;
                      
                      if (reps > 0) {
                        const formula = periodizationConfig?.formula_preferida || 'epley';
                        const rounding = periodizationConfig?.redondeo_peso || 2.5;
                        const lp = getPrescribedLoadDetailed(numericOneRM, reps, targetRIR, formula, rounding);
                        const newLoad = lp.weight;
                        if (newLoad > 0) {
                          updatedVars['peso'] = `🤖 ${newLoad} kg`;
                        }
                      }
                    } else {
                      // Si el nuevo nombre no tiene 1RM, y el peso actual era autogenerado por robot, lo limpiamos
                      if (updatedVars['peso'] && updatedVars['peso'].startsWith('🤖')) {
                        delete updatedVars['peso'];
                      }
                    }

                    return {
                      ...ex,
                      nombre: val,
                      nombre_original: nextNombreOriginal,
                      image_url: nextImageUrl,
                      gif_url: nextGifUrl,
                      video_url: nextVideoUrl,
                      description: nextDescription,
                      grupo_muscular: nextGrupoMuscular,
                      variables: updatedVars
                    };
                  } catch (e) {
                    console.error('Error al auto-rellenar ejercicio:', e);
                  }
                }
                return { ...ex, [field]: val };
              }
              return ex;
            })
          };
        }
        return d;
      })
    );
  };

  const handleFileUpload = async (dayId: string, exId: string, field: 'image_url' | 'gif_url', file: File | null) => {
    if (!file) return;

    // 1. Obtener el nombre del ejercicio para crear un nombre de archivo limpio
    let exName = 'ejercicio';
    for (const day of trainingDays) {
      const ex = day.exercises.find(e => e.id === exId);
      if (ex) {
        exName = ex.nombre || 'ejercicio';
        break;
      }
    }

    // 2. Limpiar el nombre (sanitizar a minúsculas, guiones bajos y sin caracteres especiales)
    const nameClean = exName.trim().toLowerCase();
    const isGeneric = nameClean.startsWith('ejercicio');
    const slug = isGeneric 
      ? exId 
      : nameClean.replace(/[^a-z0-9_-]/g, '_').replace(/__+/g, '_');
      
    const ext = file.name.split('.').pop() || 'png';
    const tipo = field === 'image_url' ? 'image' : 'gif';
    const trainerId = profile?.id || 'default';
    const filePath = `${trainerId}/${slug}_${tipo}.${ext}`;

    showToast('⏳ Subiendo archivo al almacenamiento...', 'info');

    try {
      // 3. Subir el archivo al bucket "ejercicios" con upsert: true (sobrescribir si ya existe)
      const { error } = await supabase.storage
        .from('ejercicios')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (error) throw error;

      // 4. Obtener la URL pública del archivo subido
      const { data: publicData } = supabase.storage
        .from('ejercicios')
        .getPublicUrl(filePath);

      if (!publicData || !publicData.publicUrl) {
        throw new Error('No se pudo obtener la URL pública.');
      }

      // 5. Guardar la URL pública en el ejercicio
      handleExerciseChange(dayId, exId, field, publicData.publicUrl);
      showToast('¡Archivo subido con éxito al bucket! ☁️', 'success');

      // 6. Sincronizar con ejercicios_globales si es una imagen
      if (field === 'image_url' && exName && exName.trim() && !isGeneric) {
        try {
          const nameClean = exName.trim();
          const { data: existingEx } = await supabase
            .from('ejercicios_globales')
            .select('*')
            .ilike('nombre', nameClean);

          if (existingEx && existingEx.length > 0) {
            const targetEx = existingEx[0];
            if (!targetEx.imagen_url) {
              const { error: updateError } = await supabase
                .from('ejercicios_globales')
                .update({ imagen_url: publicData.publicUrl })
                .eq('id', targetEx.id);
              if (updateError) {
                console.error('❌ Error al actualizar imagen en catálogo global:', updateError.message);
              } else {
                console.log('✅ Actualizado ejercicio global existente con nueva imagen:', nameClean);
              }
            }
          } else {
            const { error: insertError } = await supabase
              .from('ejercicios_globales')
              .insert({
                nombre: capitalizarEspanol(exName),
                grupo_muscular: 'General',
                imagen_url: publicData.publicUrl
              });
            if (insertError) {
              console.error('❌ Error al crear ejercicio global con imagen:', insertError.message);
            } else {
              console.log('✅ Creado nuevo ejercicio global con imagen:', nameClean);
            }
          }

          // Recargar catálogo global en el estado
          const { data: updatedCatalog } = await supabase
            .from('ejercicios_globales')
            .select('nombre, grupo_muscular, imagen_url, video_url, descripcion')
            .order('nombre');
          if (updatedCatalog) {
            setGlobalCatalog(updatedCatalog as EjercicioGlobal[]);
            setGlobalCatalogNames(updatedCatalog.map((e: any) => capitalizarEspanol(e.nombre)));
          }
        } catch (errGlobal) {
          console.warn('Error al sincronizar ejercicio en catálogo global:', errGlobal);
        }
      }
    } catch (err: any) {
      console.error('Error al subir archivo a Storage:', err);
      showToast('Error al subir archivo: ' + err.message, 'error');
    }
  };

  const handleExerciseVarChange = (dayId: string, exId: string, varId: string, val: string) => {
    setTrainingDays(prev =>
      prev.map(d => {
        if (d.id === dayId) {
          return {
            ...d,
            exercises: d.exercises.map(ex => {
              if (ex.id === exId) {
                const updatedVariables = { ...ex.variables, [varId]: val };
                
                // Si cambiaron repeticiones o rir, recalculamos el peso sugerido si tiene 1RM
                if (varId === 'repeticiones' || varId === 'rir') {
                  const normName = (ex.nombre || '').toLowerCase().trim();
                  const marcas = periodizationConfig?.marcas_1rm || {};
                  
                  // Buscar 1RM
                  let oneRM = marcas[normName];
                  if (oneRM === undefined || oneRM === null || Number(oneRM) === 0 || String(oneRM).trim() === '' || isNaN(Number(oneRM))) {
                    const alias = mapExerciseToLiftKey(normName);
                    if (alias) {
                      const aliasVal = marcas[alias];
                      if (aliasVal && !isNaN(Number(aliasVal)) && Number(aliasVal) > 0) {
                        oneRM = Number(aliasVal);
                      }
                    }
                  }
                  
                  const numericOneRM = Number(oneRM) || 0;
                  
                  if (numericOneRM && numericOneRM > 0) {
                    const repsStr = updatedVariables['repeticiones'] || '';
                    const repsMatch = repsStr.match(/\d+/);
                    const reps = repsMatch ? parseInt(repsMatch[0], 10) : 0;
                    
                    const rirStr = updatedVariables['rir'] || '0';
                    const rirMatch = rirStr.match(/\d+/);
                    const targetRIR = rirMatch ? parseFloat(rirMatch[0]) : 0;
                    
                    if (reps > 0) {
                      const formula = periodizationConfig?.formula_preferida || 'epley';
                      const rounding = periodizationConfig?.redondeo_peso || 2.5;
                      const lp = getPrescribedLoadDetailed(numericOneRM, reps, targetRIR, formula, rounding);
                      const newLoad = lp.weight;
                      if (newLoad > 0) {
                        updatedVariables['peso'] = `🤖 ${newLoad} kg`;
                      }
                    }
                  } else {
                    // Si no hay 1RM y el peso actual era autogenerado por robot, lo limpiamos
                    if (updatedVariables['peso'] && updatedVariables['peso'].startsWith('🤖')) {
                      delete updatedVariables['peso'];
                    }
                  }
                }
                
                return {
                  ...ex,
                  variables: updatedVariables
                };
              }
              return ex;
            })
          };
        }
        return d;
      })
    );
  };


  // Abrir el modal de personalización de automatización
  const handleOpenProgression = (dayId: string, exId: string, template: string) => {
    setProgModal({
      isOpen: true,
      dayId,
      exId,
      template,
      params: getDefaultParamsForTemplate(template)
    });
    setAutoProgExId(null); // Cerrar el menú desplegable pequeño
  };


  // Revertir la automatización de un ejercicio (Deshacer)
  const handleRevertProgression = (dayId: string, exId: string) => {
    const historyKey = `${dayId}_${exId}`;
    const previousState = exerciseHistory[historyKey];
    if (!previousState) return;

    setTrainingDays(prev =>
      prev.map(d => {
        if (d.id !== dayId) return d;
        return {
          ...d,
          exercises: d.exercises.map(ex => {
            if (ex.id !== exId) return ex;
            return {
              ...ex,
              variables: { ...previousState.variables },
              progression_notes: previousState.progression_notes,
              progression_type: previousState.progression_type as any,
              progression_params: previousState.progression_params
            };
          })
        };
      })
    );

    // Limpiar el historial para este ejercicio
    setExerciseHistory(prev => {
      const copy = { ...prev };
      delete copy[historyKey];
      return copy;
    });

    showToast(`Se revirtieron los cambios de progresión`, 'info');
  };

  // Guardar Plan
  const handleSavePlan = async () => {
    if (!clienteId) return;

    // Validar nombres de días
    for (const day of trainingDays) {
      const dayNameClean = (day.name || '').trim();
      if (!dayNameClean) {
        showToast('Hay días de entrenamiento con el nombre vacío.', 'error');
        return;
      }
    }

    setSaving(true);
    showToast('Guardando plan en la nube...', 'info');

    const compatibleTrainingDays = trainingDays.map(day => ({
      ...day,
      exercises: day.exercises.map(ex => ({
        ...ex,
        nombre: ex.nombre || '',
        nombre_original: ex.nombre_original || '',
        video_url: ex.video_url || '',
        image_url: ex.image_url || '',
        gif_url: ex.gif_url || '',
        name: ex.nombre || '',
        videoUrl: ex.video_url || '',
        imageData: ex.image_url || '',
        gifData: ex.gif_url || '',
        description: ex.description || '',
        grupo_muscular: ex.grupo_muscular || '',
        progression_notes: ex.progression_notes || '',
        progression_type: ex.progression_type,
        progression_params: ex.progression_params
      }))
    }));

    // Inyectar nombre de marca y eslogan del entrenador logueado en la portada del plan al guardar
    const compatiblePortada = {
      ...portada,
      trainerName: profile?.marca?.nombre_display || profile?.nombre || portada.trainerName || 'Evolution Lab',
      trainerEslogan: profile?.marca?.eslogan || 'NO NECESITAS ENTRENAR MÁS.\nNECESITAS ENTRENAR MEJOR.'
    };

    // Sincronizar trainingDays con la semana actual en microcycles
    const currentWeek = periodizationConfig?.semana_actual || 1;
    const updatedMicrocycles = [...microcycles];
    const existingIndex = updatedMicrocycles.findIndex(m => m.weekNumber === currentWeek);
    if (existingIndex >= 0) {
      updatedMicrocycles[existingIndex].trainingDays = compatibleTrainingDays;
    } else {
      updatedMicrocycles.push({
        weekNumber: currentWeek,
        isCompleted: false,
        trainingDays: compatibleTrainingDays
      });
    }

    const planDataPayload: PlanData = {
      portada: compatiblePortada,
      globalVariables,
      variableDefinitions,
      trainingDays: compatibleTrainingDays,
      microcycles: updatedMicrocycles,
      weekdayMapping,
      trackerConfig,
      trackerRules,
      periodizationConfig,
      weeklyTargets
    };

    try {
      // 1. Guardar en Supabase (insert o update)
      let result;
      if (existingPlanId) {
        result = await supabase
          .from('planes')
          .update({ datos_plan: planDataPayload })
          .eq('id', existingPlanId);
      } else {
        const { data: { session } } = await supabase.auth.getSession();
        result = await supabase
          .from('planes')
          .insert({
            cliente_id: clienteId,
            creador_id: session?.user?.id || null,
            datos_plan: planDataPayload,
            activo: true
          })
          .select('id')
          .single();

        if (result.data) {
          setExistingPlanId(result.data.id);
        }
      }

      if (result.error) throw result.error;

      // 2. Actualizar metadatos básicos en el perfil de Supabase (inicio y vigencia)
      const { error: profError } = await supabase
        .from('profiles')
        .update({
          fecha_inicio: portada.startDate || null,
          vigencia_dias: parseInt(portada.planVigenciaPlan, 10) || 28
        })
        .eq('id', clienteId);

      if (profError) throw profError;

      // 3. Emitir actualización en tiempo real por el Broadcast Channel
      const channelName = 'plan-updates:' + clienteId;
      const channel = supabase.channel(channelName);
      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          channel.send({
            type: 'broadcast',
            event: 'plan-updated',
            payload: { message: 'El entrenador ha modificado tu rutina.' }
          });
        }
      });

      // 4. Guardar ejercicios en la biblioteca local del entrenador para autocompletado posterior
      try {
        const trainerId = profile?.id || 'default';
        const libraryKey = `evolution_exercise_library_${trainerId}`;
        const library = JSON.parse(localStorage.getItem(libraryKey) || '{}');
        let updated = false;
        for (const day of trainingDays) {
          for (const ex of day.exercises) {
            const nameClean = ex.nombre.trim().toLowerCase();
            const gmVal = normalizeMuscleGroup(ex.grupo_muscular || '');
            if (nameClean && (ex.image_url || ex.gif_url || ex.video_url || (ex as any).description || ex.nombre_original || gmVal)) {
              if (
                !library[nameClean] ||
                (ex.image_url && library[nameClean].imageData !== ex.image_url) ||
                (ex.gif_url && library[nameClean].gifData !== ex.gif_url) ||
                (ex.video_url && library[nameClean].videoUrl !== ex.video_url) ||
                ((ex as any).description && library[nameClean].description !== (ex as any).description) ||
                (ex.nombre_original && library[nameClean].nombreOriginal !== ex.nombre_original) ||
                (gmVal && library[nameClean].grupoMuscular !== gmVal)
              ) {
                library[nameClean] = {
                  imageData: ex.image_url || library[nameClean]?.imageData || '',
                  gifData: ex.gif_url || library[nameClean]?.gifData || '',
                  videoUrl: ex.video_url || library[nameClean]?.videoUrl || '',
                  description: (ex as any).description || library[nameClean]?.description || '',
                  nombreOriginal: ex.nombre_original || library[nameClean]?.nombreOriginal || '',
                  grupoMuscular: gmVal || library[nameClean]?.grupoMuscular || ''
                };
                updated = true;
              }
            }
          }
        }
        if (updated) {
          localStorage.setItem(libraryKey, JSON.stringify(library));
          console.log(`✨ [Biblioteca de Ejercicios] Biblioteca local del entrenador ${trainerId} sincronizada:`, library);
        }
      } catch (e) {
        console.error('Error al actualizar biblioteca de ejercicios:', e);
      }

      showToast('¡Plan guardado con éxito! Sincronizado en tiempo real. ☁️', 'success');
    } catch (err: any) {
      console.error('Error al guardar plan:', err);
      showToast('Error al guardar: ' + err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#0b0f19', color: 'var(--theme-primary)', fontFamily: 'Orbitron, sans-serif' }}>
        <span style={{ fontSize: '18px', fontWeight: 700, letterSpacing: '1.5px' }}>EVOLUTION LAB</span>
        <span style={{ fontSize: '12px', opacity: 0.7 }}>Cargando Planificador de Rutina...</span>
      </div>
    );
  }

  return (
    <div style={{ background: 'transparent', minHeight: '100vh', color: 'white', paddingBottom: '60px' }}>

      {/* ── Guided Setup — primer plan ─────────────────────────────────────── */}
      {showGuidedSetup && (
        <GuidedPlanSetup
          onComplete={handleGuidedComplete}
          onSkip={() => {
            if (profile?.id) {
              localStorage.setItem(`evolution_guided_plan_v1_${profile.id}`, 'true');
            }
            setShowGuidedSetup(false);
          }}
        />
      )}

      {/* ── Tour tips — 3 tooltips contextuales post-guided ───────────────── */}
      {showTourTip > 0 && !tourComplete && (
        <div style={{
          position: 'fixed', bottom: '80px', left: '50%', transform: 'translateX(-50%)',
          zIndex: 8000, maxWidth: '380px', width: '90%',
          background: 'rgba(10,14,23,0.97)', border: '1px solid #c2ff0044',
          borderRadius: '14px', padding: '16px 20px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px #c2ff0022',
          backdropFilter: 'blur(12px)',
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '10px', color: '#c2ff00', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '6px' }}>
                Tour rápido — {showTourTip}/3
              </div>
              <p style={{ fontSize: '13px', color: '#e5e7eb', lineHeight: 1.5, margin: 0 }}>
                {showTourTip === 1 && '📊 Volumen Semanal: Los puntos muestran si el volumen está en zona segura. Nota: Puedes volver a este plan desde "MI ENTRENAMIENTO PERSONAL" en el Dashboard.'}
                {showTourTip === 2 && '🤖 Carga Inteligente: Pasa el cursor sobre los pesos con el robot para ver la fórmula y el 1RM estimado en acción.'}
                {showTourTip === 3 && '📚 Catálogo de Protocolos: Accede a plantillas basadas en evidencia para aplicarlas con un clic y ajustarlas a tu gusto.'}
              </p>
            </div>
            <button
              onClick={() => {
                if (showTourTip < 3) {
                  setShowTourTip(t => t + 1);
                } else {
                  setShowTourTip(0);
                  setTourComplete(true);
                  setShowTourSaveReminder(true);
                }
              }}
              style={{
                flexShrink: 0, padding: '8px 16px', borderRadius: '8px',
                background: '#c2ff00', border: 'none', color: '#000',
                fontWeight: 700, fontSize: '12px', cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {showTourTip < 3 ? 'Siguiente →' : '¡Listo!'}
            </button>
          </div>
          {/* Indicador de progreso del tour */}
          <div style={{ display: 'flex', gap: '4px', marginTop: '12px' }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{
                height: '3px', flex: 1, borderRadius: '2px',
                background: i <= showTourTip ? '#c2ff00' : 'rgba(255,255,255,0.1)',
                transition: 'background 0.3s',
              }} />
            ))}
          </div>
        </div>
      )}
      {/* HEADER PLANNER */}
      <div 
        className="top-bar planner-header-container" 
        style={{ 
          position: 'sticky',
          top: 0,
          zIndex: 1000,
          background: 'rgba(11, 15, 25, 0.88)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderBottom: '1px solid var(--theme-border)',
          marginBottom: '20px', 
          padding: '12px 0' 
        }}
      >
        <style>{`
          @media (max-width: 768px) {
            .planner-header-container {
              padding: 5px 0 !important;
              margin-bottom: 10px !important;
            }
            .top-bar-inner {
              gap: 6px !important;
              flex-wrap: nowrap !important;
              justify-content: space-between !important;
              align-items: center !important;
              padding: 0 10px !important;
            }
            .planner-header-left-inner {
              gap: 6px !important;
            }
            .planner-title-main {
              display: none !important;
            }
            .planner-client-name {
              font-size: 11px !important;
              max-width: 130px !important;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
              margin-top: 0 !important;
            }
            .btn-back-mobile {
              padding: 5px 8px !important;
              font-size: 10px !important;
              white-space: nowrap;
              border-radius: 6px !important;
            }
            .btn-save-mobile {
              padding: 6px 12px !important;
              font-size: 10px !important;
              white-space: nowrap;
              height: auto !important;
              border-radius: 6px !important;
            }
            .hide-mobile {
              display: none !important;
            }
          }
        `}</style>
        <div className="top-bar-inner" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px', maxWidth: '1200px', margin: '0 auto', padding: '0 20px' }}>
          
          <div className="planner-header-left-inner" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
               onClick={() => setShowExitConfirm(true)}
               className="btn-back-mobile"
               style={{ background: 'none', border: 'none', color: 'var(--theme-primary)', fontSize: '12px', cursor: 'pointer', fontFamily: "'Orbitron', sans-serif", padding: '8px 12px', borderRadius: '8px', borderStyle: 'solid', borderWidth: '1px', borderColor: 'var(--theme-border)' }}
            >
              ← Volver
            </button>
            <div>
              <h1 className="planner-title-main" style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '15px', fontWeight: 800, margin: 0, letterSpacing: '1px' }}>
                PLANIFICADOR DE RUTINA
              </h1>
              <div className="planner-client-name" style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginTop: '2px' }}>
                Atleta: <span style={{ color: 'var(--theme-primary)', fontWeight: 600 }}>{clientProfile?.nombre}</span>
              </div>
            </div>
          </div>

          <button
            onClick={handleSavePlan}
            disabled={saving}
            className={`btn btn-primary btn-save-mobile ${saving ? 'button-loading' : ''}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '10px 24px',
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
              <span>
                ✓ GUARDAR<span className="hide-mobile"> EN LA NUBE</span>
              </span>
            )}
          </button>

        </div>
      </div>

      <div className="container stagger-3" style={{ padding: '0 20px', maxWidth: '1200px', margin: '0 auto' }}>
        
        {/* ACTION BAR: Herramientas de Planificación */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', overflowX: 'auto', paddingBottom: '4px' }}>
          <button 
            onClick={() => setProtocolModalOpen(true)} 
            className="btn" 
            style={{ background: '#0284c7', border: 'none', color: '#fff', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold', whiteSpace: 'nowrap', boxShadow: '0 4px 12px rgba(2, 132, 199, 0.3)' }}
          >
            <span style={{ fontSize: '16px' }}>📚</span> Protocolos de entrenamiento
          </button>
          <button 
            onClick={() => setThresholdsTableOpen(true)} 
            className="btn" 
            style={{ background: '#1A1A1A', border: '1px solid #333', color: 'white', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}
          >
            <span style={{ fontSize: '16px' }}>📊</span> Tabla MEV/MAV/MRV
          </button>
          <button 
            onClick={() => setDistributorWizardOpen(true)} 
            className="btn" 
            style={{ background: 'var(--theme-primary)', border: 'none', color: '#000', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold', whiteSpace: 'nowrap' }}
          >
            <span style={{ fontSize: '16px' }}>⚡</span> Asistente de Distribución
          </button>
        </div>

        {/* VOLUME TRACKER UI */}
        <VolumeTracker
          trainingDays={trainingDays}
          weeklyTargets={weeklyTargets}
          athleteLevel={periodizationConfig?.nivel_atleta || 'intermedio'}
          blockObjective={periodizationConfig?.objetivo || 'hipertrofia'}
        />

        {/* SECCIÓN 1: PORTADA / DETALLES DEL PLAN */}
        <div style={{ background: 'var(--theme-card-bg)', border: '1px solid var(--theme-border)', borderRadius: '16px', padding: '20px', marginBottom: '24px', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', boxShadow: '0 8px 32px 0 var(--theme-glow)' }}>
          <h3 style={{ fontFamily: "'Orbitron', sans-serif", fontSize: '13px', color: 'var(--theme-primary)', letterSpacing: '0.5px', marginBottom: '16px', marginTop: 0 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px', verticalAlign: '-1px', display: 'inline-block' }}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg> DETALLES DE PORTADA DEL PLAN
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
            <div>
              <label htmlFor="portada-userName" style={{ display: 'block', fontSize: '10px', color: 'rgba(255,255,255,0.5)', fontWeight: 700, marginBottom: '6px' }}>NOMBRE DEL ATLETA</label>
              <input
                id="portada-userName"
                type="text"
                value={portada.userName}
                onChange={(e) => handlePortadaChange('userName', e.target.value)}
                style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', color: 'white', padding: '10px' }}
              />
            </div>
            <div>
              <label htmlFor="portada-userGoal" style={{ display: 'block', fontSize: '10px', color: 'rgba(255,255,255,0.5)', fontWeight: 700, marginBottom: '6px' }}>OBJETIVO</label>
              <input
                id="portada-userGoal"
                type="text"
                value={portada.userGoal}
                onChange={(e) => handlePortadaChange('userGoal', e.target.value)}
                style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', color: 'white', padding: '10px' }}
              />
            </div>
            <div>
              <label htmlFor="portada-startDate" style={{ display: 'block', fontSize: '10px', color: 'rgba(255,255,255,0.5)', fontWeight: 700, marginBottom: '6px' }}>FECHA INICIO</label>
              <input
                id="portada-startDate"
                type="date"
                value={portada.startDate}
                onChange={(e) => handlePortadaChange('startDate', e.target.value)}
                style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', color: 'white', padding: '10px' }}
              />
            </div>
            <div>
              <label htmlFor="portada-planVigenciaPlan" style={{ display: 'flex', alignItems: 'center', fontSize: '10px', color: 'rgba(255,255,255,0.5)', fontWeight: 700, marginBottom: '6px' }}>VIGENCIA PLAN (Días)<InfoTooltip title="Vigencia del Plan" body="Número de días que el plan estará activo para el atleta. Al vencer, el atleta verá una notificación de renovación. Un valor típico es 28-30 días (4 semanas)." /></label>
              <input
                id="portada-planVigenciaPlan"
                type="number"
                value={portada.planVigenciaPlan}
                onChange={(e) => handlePortadaChange('planVigenciaPlan', e.target.value)}
                style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', color: 'white', padding: '10px' }}
              />
            </div>
            <div>
              <label htmlFor="portada-trainerName" style={{ display: 'block', fontSize: '10px', color: 'rgba(255,255,255,0.5)', fontWeight: 700, marginBottom: '6px' }}>NOMBRE ENTRENADOR</label>
              <input
                id="portada-trainerName"
                type="text"
                value={portada.trainerName}
                onChange={(e) => handlePortadaChange('trainerName', e.target.value)}
                style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', color: 'white', padding: '10px' }}
              />
            </div>
            <div>
              <label htmlFor="portada-whatsappLink" style={{ display: 'block', fontSize: '10px', color: 'rgba(255,255,255,0.5)', fontWeight: 700, marginBottom: '6px' }}>WHATSAPP ENTRENADOR</label>
              <input
                id="portada-whatsappLink"
                type="text"
                value={portada.whatsappLink}
                onChange={(e) => handlePortadaChange('whatsappLink', e.target.value)}
                placeholder="https://wa.me/..."
                style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', color: 'white', padding: '10px' }}
              />
            </div>
            <div>
              <label htmlFor="portada-instagramLink" style={{ display: 'block', fontSize: '10px', color: 'rgba(255,255,255,0.5)', fontWeight: 700, marginBottom: '6px' }}>INSTAGRAM ENTRENADOR</label>
              <input
                id="portada-instagramLink"
                type="text"
                value={portada.instagramLink}
                onChange={(e) => handlePortadaChange('instagramLink', e.target.value)}
                placeholder="https://instagram.com/..."
                style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', color: 'white', padding: '10px' }}
              />
            </div>
          </div>

          <div style={{ marginTop: '16px' }}>
            <label htmlFor="portada-globalNote" style={{ display: 'block', fontSize: '10px', color: 'rgba(255,255,255,0.5)', fontWeight: 700, marginBottom: '6px' }}>INDICACIONES GENERALES DEL ENTRENADOR</label>
            <textarea
              id="portada-globalNote"
              rows={2}
              value={portada.globalNote}
              onChange={(e) => handlePortadaChange('globalNote', e.target.value)}
              style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', color: 'white', padding: '10px', resize: 'vertical' }}
            />
          </div>
        </div>

        {/* SECCIÓN 2: SEMANA DE ENTRENAMIENTO MAP (WEEKDAY CONFIG) */}
        <div style={{ background: 'var(--theme-card-bg)', border: '1px solid var(--theme-border)', borderRadius: '16px', padding: '20px', marginBottom: '24px', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', boxShadow: '0 8px 32px 0 var(--theme-glow)' }}>
          <h3 style={{ fontFamily: "'Orbitron', sans-serif", fontSize: '13px', color: 'var(--theme-primary)', letterSpacing: '0.5px', marginBottom: '8px', marginTop: 0 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px', verticalAlign: '-1px', display: 'inline-block' }}><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> CONFIGURACIÓN DE DÍAS DE LA SEMANA
            <InfoTooltip title="Configuración de Días" body="Asocia los días de la semana con tus días de entrenamiento. Los días que dejes como 'Descanso' no aparecerán como días de entrenamiento para el atleta. Esto permite que el plan se adapte al calendario real del cliente." />
          </h3>
           <p className="desc-text" style={{ margin: '0 0 16px 0', fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>
            Asigna qué día de entrenamiento le corresponde a cada día calendario de la semana.
          </p>

          <div className="weekday-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px' }}>
            {['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'].map((dayName, idx) => {
              const currentVal = weekdayMapping[String(idx)] ?? -1;
              return (
                <div
                  key={idx}
                  style={{
                    textAlign: 'center',
                    background: 'var(--theme-badge-bg)',
                    padding: '12px 10px',
                    border: '1px solid var(--theme-border)',
                    borderRadius: '10px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '8px',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <label
                    htmlFor={`planner-weekday-${idx}`}
                    style={{
                      display: 'block',
                      fontSize: '11px',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      color: '#ff7e2e',
                      fontFamily: "'Orbitron', sans-serif",
                      cursor: 'pointer'
                    }}
                  >
                    {dayName}
                  </label>
                  <select
                    id={`planner-weekday-${idx}`}
                    value={currentVal}
                    onChange={(e) => handleWeekdayMap(String(idx), parseInt(e.target.value, 10))}
                    style={{
                      background: 'rgba(15, 23, 42, 0.6)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      color: 'white',
                      fontSize: '12px',
                      padding: '8px 6px',
                      width: '100%',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      height: '36px',
                      boxSizing: 'border-box',
                      textAlign: 'center'
                    }}
                  >
                    <option value={-1} style={{ background: '#0b0f19', color: 'white' }}>Descanso</option>
                    {trainingDays.map((day, dIdx) => (
                      <option key={day.id} value={dIdx} style={{ background: '#0b0f19', color: 'white' }}>
                        {day.name.substring(0, 22)}
                      </option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>
        </div>

        {/* SECCIÓN 3: VARIABLES GLOBALES */}
        <div style={{ background: 'var(--theme-card-bg)', border: '1px solid var(--theme-border)', borderRadius: '16px', padding: '20px', marginBottom: '24px', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', boxShadow: '0 8px 32px 0 var(--theme-glow)' }}>
          <div
            onClick={() => setVariablesOpen(!variablesOpen)}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              cursor: 'pointer',
              userSelect: 'none'
            }}
          >
            <h3 style={{ fontFamily: "'Orbitron', sans-serif", fontSize: '13px', color: 'var(--theme-primary)', letterSpacing: '0.5px', margin: 0, display: 'flex', alignItems: 'center' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              VARIABLES GLOBALES Y SIGNIFICADOS
              <InfoTooltip title="Variables Globales" body="Son los parámetros que definen cada ejercicio del plan (series, repeticiones, tempo, RIR, descanso, etc.). El atleta verá estos valores como indicadores durante su entrenamiento. Puedes personalizar las definiciones para que tu cliente entienda cada concepto." />
            </h3>
            <span style={{ fontSize: '11px', color: 'var(--theme-primary)', fontWeight: 'bold', fontFamily: "'Orbitron', sans-serif" }}>
              {variablesOpen ? '▲ OCULTAR' : '▼ CONFIGURAR'}
            </span>
          </div>

          {variablesOpen && (
            <div style={{ marginTop: '20px' }}>
              <form onSubmit={handleAddGlobalVar} style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '20px', alignItems: 'flex-end' }}>
                <div style={{ flex: 1, minWidth: '150px' }}>
                  <label htmlFor="new-var-label" style={{ display: 'block', fontSize: '10px', color: 'rgba(255,255,255,0.5)', fontWeight: 600, marginBottom: '6px' }}>NOMBRE VARIABLE</label>
                  <input
                    id="new-var-label"
                    type="text"
                    required
                    value={newVarLabel}
                    onChange={(e) => setNewVarLabel(e.target.value)}
                    placeholder="Ej. RPE, Tempo, Series, etc."
                    style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', color: 'white', padding: '10px' }}
                  />
                </div>
                <div style={{ flex: 2, minWidth: '250px' }}>
                  <label htmlFor="new-var-def" style={{ display: 'block', fontSize: '10px', color: 'rgba(255,255,255,0.5)', fontWeight: 600, marginBottom: '6px' }}>EXPLICACIÓN TEÓRICA (opcional)</label>
                  <input
                    id="new-var-def"
                    type="text"
                    value={newVarDef}
                    onChange={(e) => setNewVarDef(e.target.value)}
                    placeholder="Escribe una breve guía para el atleta..."
                    style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', color: 'white', padding: '10px' }}
                  />
                </div>
                <button type="submit" className="btn btn-ghost" style={{ height: '42px', padding: '0 20px' }}>Añadir Variable</button>
              </form>

              {/* Listado de variables existentes */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '20px' }}>
                {globalVariables.map(v => (
                  <span
                    key={v.id}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.05)',
                      padding: '6px 12px',
                      borderRadius: '12px',
                      fontSize: '11px',
                      fontWeight: 600
                    }}
                  >
                    🛠️ {v.label}
                    <button
                      type="button"
                      onClick={() => handleRemoveGlobalVar(v.id)}
                      style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '12px', cursor: 'pointer', marginLeft: '8px' }}
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>

              {/* Definiciones/Significados de las variables */}
              <div style={{ marginTop: '24px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '20px' }}>
                <h4 style={{ fontFamily: "'Orbitron', sans-serif", fontSize: '11px', color: 'var(--theme-primary)', letterSpacing: '0.5px', marginBottom: '8px', textTransform: 'uppercase', marginTop: 0 }}>
                  Significados de las Variables para el Atleta
                </h4>
                <p style={{ margin: '0 0 16px 0', fontSize: '11px', color: 'rgba(255,255,255,0.4)', lineHeight: '1.4' }}>
                  Edita el significado de cada variable. Tu cliente podrá ver esta explicación al presionar el botón de información ⓘ en su panel de entrenamiento.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                  {globalVariables.map(v => {
                    const varId = v.id.trim().toLowerCase();
                    const currentDef = variableDefinitions[varId] || '';
                    return (
                      <div key={v.id} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '10px', padding: '12px' }}>
                        <label
                          htmlFor={`var-def-${varId}`}
                          style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: 'var(--theme-primary)', marginBottom: '8px', fontFamily: "'Orbitron', sans-serif", cursor: 'pointer' }}
                        >
                          {v.label}
                        </label>
                        <textarea
                          id={`var-def-${varId}`}
                          rows={3}
                          value={currentDef}
                          onChange={(e) => {
                            const val = e.target.value;
                            setVariableDefinitions(prev => ({
                              ...prev,
                              [varId]: val
                            }));
                          }}
                          placeholder={`Escribe la explicación teórica de ${v.label.toLowerCase()}...`}
                          style={{ width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '6px', color: 'white', padding: '8px', fontSize: '11px', resize: 'vertical', fontFamily: 'inherit' }}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        <PeriodizationPanel
          config={periodizationConfig}
          setConfig={setPeriodizationConfig}
          trainingDays={trainingDays}
          setTrainingDays={setTrainingDays}
          languageMode={languageMode}
          recalculatePlanWeights={recalculatePlanWeights}
          showToast={showToast}
          onOpenHelpModal={() => setIsHelpModalOpen(true)}
          onOpenCalculator={() => setShow1RMCalculator(true)}
          weeklyTargets={weeklyTargets}
        />


        {/* SECCIÓN 4: DÍAS DE RUTINA Y EJERCICIOS */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '12px' }}>
            <h2 style={{ fontFamily: "'Orbitron', sans-serif", fontSize: '16px', fontWeight: 800, margin: 0 }}>DÍAS DE ENTRENAMIENTO PROGRAMADOS</h2>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={handleAddDay}
              style={{
                fontSize: '11px',
                padding: '8px 16px',
                height: 'auto',
                fontFamily: "'Orbitron', sans-serif",
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              ➕ Añadir Nuevo Día
            </button>
          </div>

          {/* DAY TABS BAR (Igual que en el perfil del cliente) */}
          {trainingDays.length > 0 && (
            <div className="day-tabs-bar" style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '20px', padding: '4px', background: 'var(--theme-card-bg)', border: '1px solid var(--theme-border)', borderRadius: '12px', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}>
              {trainingDays.map((day, idx) => {
                const dayName = (day.name || `Día ${idx + 1}`).trim();
                const shortName = dayName.length > 28 ? dayName.substring(0, 25) + '…' : dayName;
                return (
                  <button
                    key={day.id}
                    type="button"
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

          {/* RENDERIZAR ÚNICAMENTE EL DÍA SELECCIONADO */}
          {trainingDays.length > 0 ? (
            (() => {
              const safeIdx = activeTab >= trainingDays.length ? 0 : activeTab;
              const day = trainingDays[safeIdx];
              return (
                <div key={day.id} className="day-card tab-content-enter">
                  <div className="day-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                    <div className="day-title" style={{ flexGrow: 1 }}>
                      <input
                        type="text"
                        className="day-name-input"
                        value={day.name}
                        onChange={(e) => handleDayNameChange(day.id, e.target.value)}
                        style={{
                          fontFamily: "'Orbitron', sans-serif",
                          fontSize: '1.2rem',
                          fontWeight: 700,
                          background: 'rgba(255, 255, 255, 0.05)',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          borderRadius: '8px',
                          color: 'white',
                          padding: '4px 8px',
                          width: '100%',
                          maxWidth: '300px'
                        }}
                      />
                    </div>

                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <button
                        type="button"
                        onClick={() => setVolumeChartOpen(!volumeChartOpen)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '8px 14px',
                          borderRadius: '8px',
                          background: volumeChartOpen ? 'rgba(255, 126, 46, 0.15)' : 'rgba(255, 255, 255, 0.04)',
                          border: `1px solid ${volumeChartOpen ? 'rgba(255, 126, 46, 0.35)' : 'rgba(255, 255, 255, 0.08)'}`,
                          color: volumeChartOpen ? 'var(--theme-primary)' : 'rgba(255, 255, 255, 0.8)',
                          fontSize: '11px',
                          fontWeight: 700,
                          fontFamily: "'Orbitron', sans-serif",
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px'
                        }}
                      >
                        📊 {volumeChartOpen ? 'Ocultar Simetría' : 'Ver Simetría'}
                      </button>

                      <button
                        type="button"
                        className="btn-remove-day"
                        onClick={() => handleRemoveDay(day.id)}
                        style={{ display: 'inline-flex', alignItems: 'center' }}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px', verticalAlign: '-1px' }}>
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                        Eliminar día
                      </button>
                    </div>
                  </div>

                  {/* PANEL DE SIMETRÍA DE VOLUMEN (RADAR CHART) */}
                  {volumeChartOpen && (
                    <div style={{
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                      borderRadius: '16px',
                      padding: '20px',
                      marginBottom: '20px',
                      backdropFilter: 'blur(20px)',
                      WebkitBackdropFilter: 'blur(20px)',
                      boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.2)',
                      animation: 'fadeIn 0.25s ease'
                    }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
                        {/* Gráfico Radar */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '260px', background: 'rgba(0,0,0,0.15)', borderRadius: '12px', padding: '12px', border: '1px solid rgba(255, 255, 255, 0.04)' }}>
                          {totalActiveDayVolume > 0 ? (
                            <div style={{ position: 'relative', width: '100%', height: '250px' }}>
                              <Radar data={radarChartData} options={radarChartOptions as any} />
                            </div>
                          ) : (
                            <div style={{ textAlign: 'center', padding: '20px', color: 'rgba(255,255,255,0.35)' }}>
                              <div style={{ fontSize: '28px', marginBottom: '8px' }}>📊</div>
                              <div style={{ fontSize: '11px', fontFamily: "'Orbitron', sans-serif", fontWeight: 700, color: 'var(--theme-primary)', letterSpacing: '0.5px' }}>SIN VOLUMEN PROGRAMADO</div>
                              <p style={{ fontSize: '10px', margin: '6px 0 0 0', color: 'rgba(255,255,255,0.25)', lineHeight: '1.4' }}>
                                Asigna grupos musculares y series de trabajo a tus ejercicios para ver la distribución de volumen en tiempo real.
                              </p>
                            </div>
                          )}
                        </div>

                        {/* Resumen Detallado */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', justifyContent: 'center' }}>
                          <div>
                            <h4 style={{ margin: 0, fontSize: '12px', fontFamily: "'Orbitron', sans-serif", color: 'var(--theme-primary)', letterSpacing: '0.5px', fontWeight: 700 }}>
                              DISTRIBUCIÓN DE VOLUMEN POR GRUPO MUSCULAR
                            </h4>
                            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>
                              Basado en {totalActiveDayVolume} series de trabajo totales en este día.
                            </div>
                          </div>
                          
                          {volumeSummaryStats.list.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '180px', overflowY: 'auto', paddingRight: '6px' }}>
                              {volumeSummaryStats.list.map(([gm, val]) => {
                                const percentage = (val / volumeSummaryStats.maxVal) * 100;
                                return (
                                  <div key={gm} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                                      <span style={{ fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>{gm}</span>
                                      <span style={{ fontFamily: "'Orbitron', sans-serif", fontWeight: 700, color: '#ff7e2e' }}>{val} series</span>
                                    </div>
                                    <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
                                      <div style={{ width: `${percentage}%`, height: '100%', background: 'linear-gradient(90deg, #ff7e2e, #ff9a52)', borderRadius: '3px' }} />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', margin: 0, lineHeight: '1.4' }}>
                              No hay series efectivas asignadas a ningún grupo muscular. Por favor, especifica el grupo muscular y el número de series en las tarjetas de los ejercicios de abajo.
                            </p>
                          )}

                          <div style={{ marginTop: '6px', padding: '10px 12px', background: 'rgba(255,126,46,0.05)', border: '1px solid rgba(255,126,46,0.15)', borderRadius: '10px', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                            <span style={{ fontSize: '14px', color: '#ff7e2e', lineHeight: 1 }}>💡</span>
                            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)', lineHeight: '1.4' }}>
                              <strong>Consejo científico:</strong> Un volumen balanceado previene asimetrías de fuerza y postura. Procura emparejar el volumen de empuje vertical/horizontal con tracciones similares para hombros sanos.
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* LISTA DE EJERCICIOS DEL DÍA SELECCIONADO */}
                  <div className="exercises-list">
                    {day.exercises.map((ex, exIndex) => {
                      const hasStatic = !!ex.image_url;
                      const hasAnimated = !!ex.gif_url;
                      const isOnline = navigator.onLine;
                      const imageUrl = isOnline
                        ? (ex.image_url || ex.gif_url || '')
                        : (ex.gif_url || ex.image_url || '');

                      return (
                        <div
                          key={ex.id}
                          className="exercise-card"
                          data-exercise-id={ex.id}
                          data-day-id={day.id}
                        >
                          <div className="exercise-header">
                            <div className="exercise-checkbox client-only-checkbox" data-ex-id={ex.id} data-day-id={day.id}></div>
                            
                            <div className="exercise-name" style={{ display: 'flex', flexDirection: 'column', gap: '4px', position: 'relative' }}>
                              <input
                                id={`ex-name-${day.id}-${ex.id}`}
                                aria-label={`Nombre del ejercicio ${exIndex + 1}`}
                                type="text"
                                className="exercise-name-input"
                                value={ex.nombre}
                                onChange={(e) => {
                                  handleExerciseChange(day.id, ex.id, 'nombre', e.target.value);
                                  const query = e.target.value.trim().toLowerCase();
                                  if (!query) {
                                    setFilteredSuggestions(globalCatalog.slice(0, 8));
                                  } else {
                                    const matches = globalCatalog.filter(g => g.nombre.toLowerCase().includes(query)).slice(0, 8);
                                    setFilteredSuggestions(matches);
                                  }
                                }}
                                onFocus={() => {
                                  setActiveInput({ dayId: day.id, exId: ex.id });
                                  const query = (ex.nombre || '').trim().toLowerCase();
                                  if (!query) {
                                    setFilteredSuggestions(globalCatalog.slice(0, 8));
                                  } else {
                                    const matches = globalCatalog.filter(g => g.nombre.toLowerCase().includes(query)).slice(0, 8);
                                    setFilteredSuggestions(matches);
                                  }
                                }}
                                onBlur={() => {
                                  setTimeout(() => {
                                    setActiveInput(null);
                                  }, 250);
                                }}
                                placeholder={`Ejercicio ${exIndex + 1}`}
                                style={{ width: '100%' }}
                                autoComplete="off"
                              />

                              {/* Dropdown de Sugerencias Visuales */}
                              {activeInput && activeInput.dayId === day.id && activeInput.exId === ex.id && filteredSuggestions.length > 0 && (
                                <div style={{
                                  position: 'absolute',
                                  top: '100%',
                                  left: 0,
                                  width: '100%',
                                  maxHeight: '260px',
                                  overflowY: 'auto',
                                  background: '#0c0f17',
                                  border: '1px solid rgba(255, 255, 255, 0.12)',
                                  borderRadius: '12px',
                                  boxShadow: '0 12px 30px rgba(0,0,0,0.6)',
                                  zIndex: 9999,
                                  marginTop: '4px',
                                  padding: '4px',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '2px'
                                }}>
                                  {filteredSuggestions.map((sug) => (
                                    <div
                                      key={sug.id}
                                      onMouseDown={(e) => {
                                        e.preventDefault();
                                        handleExerciseChange(day.id, ex.id, 'nombre', sug.nombre);
                                        setActiveInput(null);
                                        setFilteredSuggestions([]);
                                      }}
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '10px',
                                        padding: '8px 12px',
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                        transition: 'background 0.2s ease',
                                        color: 'white',
                                        fontSize: '12px'
                                      }}
                                      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)'}
                                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                    >
                                      {/* Miniatura de la Imagen */}
                                      <div style={{
                                        width: '36px',
                                        height: '36px',
                                        borderRadius: '6px',
                                        overflow: 'hidden',
                                        background: '#04070e',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        flexShrink: 0,
                                        border: '1px solid rgba(255, 255, 255, 0.08)'
                                      }}>
                                        {sug.imagen_url ? (
                                          <img src={sug.imagen_url} alt={sug.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        ) : (
                                          <span style={{ fontSize: '14px' }}>💪</span>
                                        )}
                                      </div>

                                      {/* Nombre y Grupo Muscular */}
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flexGrow: 1, textAlign: 'left' }}>
                                        <span style={{ fontWeight: 'bold' }}>{sug.nombre}</span>
                                        <span style={{ fontSize: '9px', color: 'var(--theme-primary, #00d4ff)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                          {sug.grupo_muscular}
                                        </span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                              {ex.nombre_original && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px', flexWrap: 'wrap' }}>
                                  <span style={{ fontSize: '9px', color: 'var(--theme-primary)', background: 'rgba(249, 115, 22, 0.1)', border: '1px solid rgba(249, 115, 22, 0.3)', padding: '2px 8px', borderRadius: '4px', fontFamily: "'Orbitron', sans-serif", textTransform: 'uppercase', letterSpacing: '0.5px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                                    Vinculado a: {ex.nombre_original}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleExerciseChange(day.id, ex.id, 'nombre_original' as any, '')}
                                    title="Desvincular del ejercicio global"
                                    style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '11px', cursor: 'pointer', padding: '0 4px', display: 'flex', alignItems: 'center', fontFamily: "'Orbitron', sans-serif", fontWeight: 'bold' }}
                                  >
                                    ✕ Desvincular
                                  </button>
                                </div>
                              )}
                            </div>

                            <div className="img-zone">
                              <div className="img-preview-container">
                                {imageUrl ? (
                                  <img
                                    className="exercise-media img-preview"
                                    src={imageUrl}
                                    alt="preview"
                                    style={{ display: 'block' }}
                                  />
                                ) : (
                                  <div className="img-placeholder-wrapper" style={{ display: 'flex' }}>
                                    <div className="img-placeholder">📷 Sin imagen</div>
                                  </div>
                                )}
                              </div>

                              <button
                                type="button"
                                className="img-upload-label"
                                onClick={() => {
                                  const el = document.getElementById(`img-file-${ex.id}`);
                                  if (el) el.click();
                                }}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                              >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg> Subir foto {hasStatic ? '(Listo)' : ''}
                              </button>
                              
                              <button
                                type="button"
                                className="gif-upload-label"
                                onClick={() => {
                                  const el = document.getElementById(`gif-file-${ex.id}`);
                                  if (el) el.click();
                                }}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                              >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="2" ry="2"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="7" x2="7" y2="7"/><line x1="2" y1="17" x2="7" y2="17"/><line x1="17" y1="17" x2="22" y2="17"/><line x1="17" y1="7" x2="22" y2="7"/></svg> Animación Offline {hasAnimated ? '(Listo)' : ''}
                              </button>

                              <input
                                type="file"
                                id={`img-file-${ex.id}`}
                                accept="image/png, image/jpeg"
                                onChange={(e) => handleFileUpload(day.id, ex.id, 'image_url', e.target.files?.[0] ?? null)}
                                style={{ display: 'none' }}
                              />

                              <input
                                type="file"
                                id={`gif-file-${ex.id}`}
                                accept="image/gif"
                                onChange={(e) => handleFileUpload(day.id, ex.id, 'gif_url', e.target.files?.[0] ?? null)}
                                style={{ display: 'none' }}
                              />
                            </div>
                          </div>

                          <div className="variables-row">
                            {globalVariables.map(v => {
                              const val = ex.variables[v.id] ?? '';
                              const uniqueVarInputId = `var-input-${day.id}-${ex.id}-${v.id.trim().replace(/\s+/g, '-')}`;

                              // ─── ReasoningTooltip para el campo Peso ────────
                              const isPesoField = v.id === 'peso';
                              const isAutoWeight = isPesoField && typeof val === 'string' && val.startsWith('🤖');

                              let loadPrescriptionSteps = null;
                              let loadSource = '';
                              let loadResult = '';
                              if (isAutoWeight) {
                                try {
                                  const normName = (ex.nombre || '').toLowerCase().trim();
                                  const marcas = periodizationConfig?.marcas_1rm || {};
                                  let oneRM = marcas[normName];
                                  if (!oneRM) {
                                    const alias = mapExerciseToLiftKey(normName);
                                    if (alias) oneRM = marcas[alias];
                                  }
                                  const repsStr = ex.variables?.['repeticiones'] || '';
                                  const repsMatch = repsStr.match(/\d+/);
                                  const reps = repsMatch ? parseInt(repsMatch[0], 10) : 0;
                                  const rirStr = ex.variables?.['rir'] || '0';
                                  const rirMatch = rirStr.match(/\d+/);
                                  const targetRIR = rirMatch ? parseFloat(rirMatch[0]) : 0;
                                  if (oneRM && oneRM > 0 && reps > 0) {
                                    const formula = periodizationConfig?.formula_preferida || 'epley';
                                    const rounding = periodizationConfig?.redondeo_peso || 2.5;
                                    const lp = getPrescribedLoadDetailed(oneRM, reps, targetRIR, formula, rounding);
                                    loadPrescriptionSteps = buildLoadReasoningSteps(lp);
                                    loadSource = lp.source;
                                    loadResult = `${lp.weight} kg`;
                                  }
                                } catch (_) { /* silencioso */ }
                              }

                              const inputEl = (
                                <input
                                  id={uniqueVarInputId}
                                  type="text"
                                  className="var-input"
                                  value={val}
                                  onChange={(e) => handleExerciseVarChange(day.id, ex.id, v.id, e.target.value)}
                                  placeholder={v.defaultValue}
                                />
                              );

                              return (
                                <div key={v.id} className="var-item">
                                  <label htmlFor={uniqueVarInputId}>{v.label}</label>
                                  {isAutoWeight && loadPrescriptionSteps ? (
                                    <ReasoningTooltip
                                      trigger={inputEl}
                                      title="Peso Sugerido"
                                      steps={loadPrescriptionSteps}
                                      source={loadSource}
                                      result={loadResult}
                                      confidence="high"
                                    />
                                  ) : inputEl}
                                </div>
                              );
                            })}
                          </div>

                          {/* Grupo Muscular selector */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px', marginBottom: '4px', flexWrap: 'wrap' }}>
                            <label htmlFor={`select-muscle-${day.id}-${ex.id}`} style={{ fontSize: '9px', fontWeight: 700, color: 'rgba(255,255,255,0.4)', fontFamily: "'Orbitron', sans-serif", letterSpacing: '0.3px', whiteSpace: 'nowrap', cursor: 'pointer' }}>GRUPO MUSC.</label>
                            <select
                              id={`select-muscle-${day.id}-${ex.id}`}
                              value={(ex as any).grupo_muscular || ''}
                              onChange={(e) => handleExerciseChange(day.id, ex.id, 'grupo_muscular' as any, e.target.value)}
                              style={{
                                flex: 1, maxWidth: '180px',
                                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                                borderRadius: '6px', color: 'white', padding: '4px 8px', fontSize: '11px'
                              }}
                            >
                              <option value="" style={{ background: '#0b0f19' }}>Sin asignar</option>
                              {['Pecho', 'Espalda', 'Cuádriceps', 'Isquiosurales', 'Hombros', 'Bíceps', 'Tríceps', 'Core', 'Glúteos', 'Pantorrillas', 'Cardio'].map(g => (
                                <option key={g} value={g} style={{ background: '#0b0f19' }}>{g}</option>
                              ))}
                            </select>
                            <InfoTooltip title="Grupo Muscular" body="Asigna el grupo muscular principal de este ejercicio. Se usa para calcular el gráfico de simetría y distribución de volumen del día de entrenamiento." size={14} />
                            
                            {/* Inline Volume Status */}
                            {(() => {
                              const isStrength = periodizationConfig?.objetivo === 'fuerza';
                              if (isStrength) {
                                const pattern = detectPatternFromExerciseName(ex.nombre || '');
                                if (!pattern) {
                                  return (
                                    <div style={{
                                      fontSize: '11px', fontWeight: 600, color: 'rgba(255,255,255,0.4)',
                                      background: 'rgba(255,255,255,0.05)', padding: '2px 8px',
                                      borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)',
                                      display: 'flex', alignItems: 'center', gap: '4px'
                                    }}>
                                      <span>Auxiliar (Sin patrón de fuerza)</span>
                                    </div>
                                  );
                                }
                                
                                const threshold = getStrengthThreshold(pattern, periodizationConfig?.nivel_atleta || 'intermedio');
                                const currentTotal = weeklyNLData[pattern] || 0;
                                const customTarget = weeklyTargets[pattern];
                                const evalDetailed = evaluateStrengthVolumeDetailed(pattern, currentTotal, periodizationConfig?.nivel_atleta || 'intermedio');
                                const { status } = evalDetailed;

                                let badgeColor = '';
                                if (status === 'danger') badgeColor = '#ef4444';
                                else if (status === 'optimal') badgeColor = '#10b981';
                                else if (status === 'warning') badgeColor = '#f97316';
                                else if (status === 'building') badgeColor = '#facc15';
                                else badgeColor = '#94a3b8';

                                let indicator = '';
                                if (customTarget && customTarget > 0) {
                                  if (currentTotal < customTarget) indicator = `Faltan ${customTarget - currentTotal} NL para Objetivo (${customTarget})`;
                                  else if (currentTotal === customTarget) indicator = `Objetivo Alcanzado (${customTarget})`;
                                  else if (currentTotal > customTarget && currentTotal < threshold.mrv) indicator = `Superó Objetivo (${customTarget}), cerca de MRV (${threshold.mrv})`;
                                  else indicator = `Límite MRV superado (${threshold.mrv})`;
                                } else {
                                  indicator = evalDetailed.humanLabel;
                                }

                                const volSteps = buildVolumeReasoningSteps(evalDetailed);

                                return (
                                  <ReasoningTooltip
                                    trigger={
                                      <div style={{
                                        fontSize: '11px', fontWeight: 600, color: badgeColor,
                                        background: 'rgba(255,255,255,0.05)', padding: '2px 8px',
                                        borderRadius: '12px', border: `1px solid ${badgeColor}40`,
                                        display: 'flex', alignItems: 'center', gap: '4px',
                                        cursor: 'pointer'
                                      }}>
                                        <span>Patrón: {threshold.label} ({currentTotal} NL)</span>
                                        <span style={{ color: 'rgba(255,255,255,0.3)' }}>|</span>
                                        <span>{indicator}</span>
                                      </div>
                                    }
                                    title={`Volumen: ${threshold.label}`}
                                    steps={volSteps}
                                    source={evalDetailed.source}
                                    recommendation={evalDetailed.recommendation}
                                  />
                                );
                              } else {
                                // Modo Hipertrofia (Original)
                                if (!(ex as any).grupo_muscular) return null;
                                const gmRaw = (ex as any).grupo_muscular;
                                const gmNormalized = getThresholdsForMuscleGroup(gmRaw, periodizationConfig?.nivel_atleta, periodizationConfig?.objetivo as any).gm;
                                const currentTotal = weeklyVolumeData[gmNormalized] || 0;
                                const level = periodizationConfig?.nivel_atleta || 'intermedio';
                                const thresholds = getThresholdsForMuscleGroup(gmRaw, level as any, periodizationConfig?.objetivo as any);
                                const customTarget = weeklyTargets[gmNormalized];
                                
                                let indicator = '';
                                let badgeColor = '';
                                
                                if (customTarget && customTarget > 0) {
                                  if (currentTotal < customTarget) {
                                    indicator = `Faltan ${customTarget - currentTotal} para Objetivo (${customTarget})`;
                                    badgeColor = '#fbbf24';
                                  } else if (currentTotal === customTarget) {
                                    indicator = `Objetivo Alcanzado (${customTarget})`;
                                    badgeColor = '#10b981';
                                  } else if (currentTotal > customTarget && currentTotal < thresholds.mrv) {
                                    indicator = `Superó Objetivo, cerca de MRV (${thresholds.mrv})`;
                                    badgeColor = '#f97316';
                                  } else {
                                    indicator = `Límite MRV superado (${thresholds.mrv})`;
                                    badgeColor = '#ef4444';
                                  }
                                } else {
                                  if (currentTotal < thresholds.mev) {
                                    indicator = `Faltan ${thresholds.mev - currentTotal} para MEV (${thresholds.mev})`;
                                    badgeColor = '#fbbf24';
                                  } else if (currentTotal >= thresholds.mev && currentTotal < thresholds.mavMin) {
                                    indicator = `Faltan ${thresholds.mavMin - currentTotal} para MAV (${thresholds.mavMin}-${thresholds.mavMax})`;
                                    badgeColor = '#34d399';
                                  } else if (currentTotal >= thresholds.mavMin && currentTotal <= thresholds.mavMax) {
                                    indicator = `Óptimo en MAV (${thresholds.mavMin}-${thresholds.mavMax})`;
                                    badgeColor = '#10b981';
                                  } else if (currentTotal > thresholds.mavMax && currentTotal < thresholds.mrv) {
                                    indicator = `Cerca de MRV (${thresholds.mrv})`;
                                    badgeColor = '#f97316';
                                  } else {
                                    indicator = `¡Peligro! MRV (${thresholds.mrv}) superado.`;
                                    badgeColor = '#ef4444';
                                  }
                                }

                                return (
                                  <div style={{
                                    fontSize: '11px', fontWeight: 600, color: badgeColor,
                                    background: 'rgba(255,255,255,0.05)', padding: '2px 8px',
                                    borderRadius: '12px', border: `1px solid ${badgeColor}40`,
                                    display: 'flex', alignItems: 'center', gap: '4px'
                                  }}>
                                    <span>Llevas: {currentTotal} series</span>
                                    <span style={{ color: 'rgba(255,255,255,0.3)' }}>|</span>
                                    <span>{indicator}</span>
                                  </div>
                                );
                              }
                            })()}
                          </div>

                          <div className="video-link-item">
                            <label htmlFor={`input-video-${day.id}-${ex.id}`} style={{ display: 'flex', alignItems: 'center', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text2)', marginBottom: '4px', cursor: 'pointer' }}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '5px', verticalAlign: '-1px' }}>
                                <path d="M23 7l-7 5 7 5V7z"></path>
                                <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
                              </svg>
                              Video explicativo (URL)
                              <InfoTooltip title="Video Explicativo" body="Enlace directo a un video de YouTube o Google Drive que muestre la técnica correcta del ejercicio. El atleta podrá verlo directamente desde su panel de entrenamiento para asegurar una ejecución segura." />
                            </label>
                            <input
                              id={`input-video-${day.id}-${ex.id}`}
                              type="text"
                              className="video-url-input"
                              value={ex.video_url || ''}
                              onChange={(e) => handleExerciseChange(day.id, ex.id, 'video_url', e.target.value)}
                              placeholder="Pega enlace de Drive o YouTube"
                              style={{ width: '100%', marginBottom: '8px' }}
                            />
                            {ex.video_url && (
                              <a
                                href={ex.video_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ display: 'inline-flex', alignItems: 'center', padding: '8px 12px', background: 'rgba(59, 130, 246, 0.12)', borderRadius: '40px', color: '#60a5fa', textDecoration: 'none', fontWeight: 600, textAlign: 'center', border: '1px solid rgba(59, 130, 246, 0.35)', transition: 'all 0.3s ease', fontSize: '10px', fontFamily: "'Orbitron',sans-serif", textTransform: 'uppercase', letterSpacing: '0.5px' }}
                              >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '5px', verticalAlign: '-1px' }}>
                                  <path d="M23 7l-7 5 7 5V7z"></path>
                                  <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
                                </svg>
                                Ver video
                              </a>
                            )}
                            <br />
                            <small style={{ display: 'inline-flex', alignItems: 'center', marginTop: '6px', color: 'var(--text3)', fontSize: '0.7rem' }}>
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '4px', flexShrink: 0, verticalAlign: '-1px' }}>
                                <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A5 5 0 0 0 8 8c0 1 .3 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"></path>
                                <path d="M9 18h6"></path>
                                <path d="M10 22h4"></path>
                              </svg>
                              Si el video no se abre, mantén presionado el enlace y selecciona "Abrir en navegador".
                            </small>
                          </div>

                          <div className="description-link-item" style={{ marginTop: '10px' }}>
                            <label htmlFor={`input-desc-${day.id}-${ex.id}`} style={{ display: 'flex', alignItems: 'center', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text2)', marginBottom: '4px', cursor: 'pointer' }}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '5px', verticalAlign: '-1px' }}>
                                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
                              </svg>
                              Guía de ejecución teórica
                              <InfoTooltip title="Guía de Ejecución" body="Instrucciones escritas detalladas sobre cómo realizar el ejercicio paso a paso. Incluye indicaciones posturales, respiración, errores comunes a evitar y tips de activación muscular. El atleta las verá en su panel de entrenamiento." />
                            </label>
                            <textarea
                              id={`input-desc-${day.id}-${ex.id}`}
                              className="exercise-description-input"
                              value={ex.description || ''}
                              onChange={(e) => handleExerciseChange(day.id, ex.id, 'description', e.target.value)}
                              placeholder="Escribe aquí las indicaciones paso a paso de cómo realizar el ejercicio..."
                              rows={3}
                              style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border2)', background: 'rgba(255,255,255,0.03)', color: 'white', borderRadius: '12px', fontSize: '0.8rem', fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", resize: 'vertical', transition: 'border-color 0.2s' }}
                            />
                          </div>

                          <div className="progression-notes-item" style={{ marginTop: '10px' }}>
                            <label htmlFor={`input-prog-${day.id}-${ex.id}`} style={{ display: 'flex', alignItems: 'center', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text2)', marginBottom: '4px', cursor: 'pointer' }}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '5px', verticalAlign: '-1px' }}>
                                <line x1="18" y1="20" x2="18" y2="10"></line>
                                <line x1="12" y1="20" x2="12" y2="4"></line>
                                <line x1="6" y1="20" x2="6" y2="14"></line>
                              </svg>
                              Notas de progresión y bloques (Automático/Manual)
                              <InfoTooltip title="Notas de Progresión" body="Escribe aquí las pautas de progresión de volumen o carga a lo largo de las semanas. El sistema de automatización escribirá aquí directamente para no interferir con la técnica de ejecución de arriba." />
                            </label>
                            <textarea
                              id={`input-prog-${day.id}-${ex.id}`}
                              className="exercise-progression-notes-input"
                              value={ex.progression_notes || ''}
                              onChange={(e) => handleExerciseChange(day.id, ex.id, 'progression_notes', e.target.value)}
                              placeholder="Ej: Sem 1: Peso base 3x10. Sem 2: +2.5kg 3x9... O deja que la automatización genere la pauta."
                              rows={3}
                              style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border2)', background: 'rgba(255,255,255,0.03)', color: 'white', borderRadius: '12px', fontSize: '0.8rem', fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", resize: 'vertical', transition: 'border-color 0.2s' }}
                            />
                          </div>

                          <div className="exercise-actions" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                            {/* Smart Block Builder */}
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                              <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                <button
                                  type="button"
                                  onClick={() => setAutoProgExId(autoProgExId === ex.id ? null : ex.id)}
                                  style={{
                                    display: 'inline-flex', alignItems: 'center', gap: '5px',
                                    padding: '6px 12px', borderRadius: '8px',
                                    background: autoProgExId === ex.id ? 'rgba(249, 115, 22, 0.15)' : 'rgba(255,255,255,0.04)',
                                    border: `1px solid ${autoProgExId === ex.id ? 'rgba(249, 115, 22, 0.4)' : 'rgba(255,255,255,0.08)'}`,
                                    color: autoProgExId === ex.id ? 'var(--theme-primary)' : 'rgba(255,255,255,0.6)',
                                    fontSize: '10px', fontWeight: 700, fontFamily: "'Orbitron', sans-serif",
                                    cursor: 'pointer', transition: 'all 0.2s', textTransform: 'uppercase', letterSpacing: '0.3px'
                                  }}
                                >
                                  ⚙️ Progresión
                                </button>
                                <InfoTooltip title="Definir Progresión" body="Configura una estrategia de periodización científica (lineal, doble, ondulante, descarga). El Smart Coach usará esta estrategia junto con los registros del atleta para guiarlo e indicarle cuándo debe subir o mantener la carga." size={14} />
                                
                                {autoProgExId === ex.id && (
                                  <div style={{
                                    position: 'absolute', bottom: '100%', left: 0, marginBottom: '6px',
                                    background: 'linear-gradient(165deg, rgba(20,20,24,0.98), rgba(12,12,16,0.99))',
                                    backdropFilter: 'blur(30px)', WebkitBackdropFilter: 'blur(30px)',
                                    border: '1px solid rgba(255,255,255,0.12)', borderRadius: '12px',
                                    padding: '8px', minWidth: '220px', zIndex: 100,
                                    boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
                                    animation: 'fadeIn 0.15s ease'
                                  }}>
                                    <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', fontWeight: 700, fontFamily: "'Orbitron', sans-serif", padding: '4px 8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>PLANTILLAS DE PROGRESIÓN</div>
                                    {[
                                      { id: 'linear', label: '📈 Progresión Lineal', sub: 'Fuerza / Hipertrofia · 4 sem' },
                                      { id: 'double', label: '🔁 Progresión Doble', sub: 'Volumen → Carga · 4 sem' },
                                      { id: 'undulating', label: '🌊 Ondulante', sub: 'Fuerza + Hipertrofia alterno' },
                                      { id: 'deload', label: '💤 Descarga (Deload)', sub: 'Recuperación activa · 1 sem' },
                                    ].map(t => (
                                      <button
                                        key={t.id}
                                        type="button"
                                        onClick={() => handleOpenProgression(day.id, ex.id, t.id)}
                                        style={{
                                          display: 'block', width: '100%', textAlign: 'left',
                                          padding: '8px 10px', borderRadius: '8px',
                                          background: 'transparent', border: 'none',
                                          color: 'rgba(255,255,255,0.85)', cursor: 'pointer',
                                          transition: 'background 0.15s', fontSize: '12px'
                                        }}
                                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                      >
                                        <div style={{ fontWeight: 600 }}>{t.label}</div>
                                        <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>{t.sub}</div>
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                              
                              {/* Botón de Deshacer/Revertir */}
                              {exerciseHistory[`${day.id}_${ex.id}`] && (
                                <button
                                  type="button"
                                  onClick={() => handleRevertProgression(day.id, ex.id)}
                                  style={{
                                    display: 'inline-flex', alignItems: 'center', gap: '4px',
                                    padding: '6px 12px', borderRadius: '8px',
                                    background: 'rgba(239, 68, 68, 0.1)',
                                    border: '1px solid rgba(239, 68, 68, 0.35)',
                                    color: '#ef4444',
                                    fontSize: '10px', fontWeight: 700, fontFamily: "'Orbitron', sans-serif",
                                    cursor: 'pointer', transition: 'all 0.2s', textTransform: 'uppercase', letterSpacing: '0.3px'
                                  }}
                                >
                                  ↩️ Revertir
                                </button>
                              )}
                            </div>
                            <button
                              type="button"
                              className="btn-sm btn-rem-ex"
                              onClick={() => handleRemoveExercise(day.id, ex.id)}
                            >
                              ❌ Eliminar ejercicio
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="exercise-actions" style={{ marginTop: '15px' }}>
                    <button
                      type="button"
                      className="btn-sm btn-add-ex"
                      onClick={() => handleAddExercise(day.id)}
                    >
                      ➕ Añadir ejercicio
                    </button>
                  </div>
                </div>
              );
            })()
          ) : (
            <div style={{ textAlign: 'center', padding: '40px', background: 'var(--theme-card-bg)', border: '1px solid var(--theme-border)', borderRadius: '16px' }}>
              <p style={{ color: 'rgba(255,255,255,0.4)' }}>Aún no hay días de entrenamiento creados. Agrega uno para empezar a estructurar la rutina.</p>
            </div>
          )}

        </div>
      </div>

      {/* DATALIST DE AUTOCOMPLETADO GLOBAL */}
      <datalist id="evolution-exercise-list">
        {computedExerciseOptions.map(name => (
          <option key={name} value={name} />
        ))}
      </datalist>

      {/* MODAL DE PERSONALIZACIÓN DE AUTOMATIZACIÓN (SMART BLOCK BUILDER) */}
      {/* Extraído a SmartBlockBuilderModal.tsx — ver comentario del componente
          para el detalle de qué se movió y qué permanece aquí (el dropdown
          "⚙️ Progresión" y handleRevertProgression siguen en este archivo). */}
      <SmartBlockBuilderModal
        progModal={progModal}
        setProgModal={setProgModal}
        trainingDays={trainingDays}
        setTrainingDays={setTrainingDays}
        setExerciseHistory={setExerciseHistory}
        showToast={showToast}
      />

      <Toast message={toastState.message} type={toastState.type} visible={toastState.visible} />
      <PeriodizationHelpModal isOpen={isHelpModalOpen} onClose={() => setIsHelpModalOpen(false)} />

      {thresholdsTableOpen && (
        <VolumeThresholdsTable
          onClose={() => setThresholdsTableOpen(false)}
          defaultMode={periodizationConfig?.objetivo === 'fuerza' ? 'fuerza' : 'hipertrofia'}
        />
      )}

      {distributorWizardOpen && (
        <VolumeDistributorWizard 
          onClose={() => setDistributorWizardOpen(false)} 
          onApply={handleApplyDistribution}
          athleteLevel={periodizationConfig?.nivel_atleta || 'intermedio'}
          blockObjective={periodizationConfig?.objetivo as any || 'hipertrofia'}
            initialTargets={weeklyTargets}
        />
      )}

      {protocolModalOpen && periodizationConfig && (
        <ProtocolSelectorModal
          isOpen={protocolModalOpen}
          onClose={() => setProtocolModalOpen(false)}
          objective={periodizationConfig.objetivo as any || 'hipertrofia'}
          level={periodizationConfig.nivel_atleta as any || 'intermedio'}
          onApplyProtocol={(newDays: TrainingDay[], recommendedSchedule?: number[]) => {
            const trainerId = profile?.id || 'default';
            const libraryKey = `evolution_exercise_library_${trainerId}`;
            const localLibrary = JSON.parse(localStorage.getItem(libraryKey) || '{}');
            
            const enrichedDays = newDays.map((day: TrainingDay) => ({
              ...day,
              exercises: day.exercises.map((ex: Exercise) => {
                const key = (ex.nombre || '').trim().toLowerCase();
                const foundLocal = localLibrary[key];
                const foundGlobal = globalCatalog.find(g => g.nombre.trim().toLowerCase() === key);
                
                // Priorizar el catálogo global oficial sobre el caché local del entrenador
                // para evitar arrastrar descripciones o imágenes desactualizadas/rotas de planes antiguos.
                const meta = foundGlobal || foundLocal;
                if (meta) {
                  const isGlobal = !!foundGlobal;
                  return {
                    ...ex,
                    image_url: isGlobal ? (foundGlobal.imagen_url || ex.image_url) : (foundLocal.image_url || foundLocal.imageData || ex.image_url),
                    gif_url: isGlobal ? ex.gif_url : (foundLocal.gif_url || foundLocal.gifData || ex.gif_url),
                    video_url: isGlobal ? (foundGlobal.video_url || ex.video_url) : (foundLocal.video_url || foundLocal.videoUrl || ex.video_url),
                    description: isGlobal ? (foundGlobal.descripcion || ex.description) : (foundLocal.description || ex.description),
                    nombre_original: isGlobal ? foundGlobal.nombre : (foundLocal.nombre_original || ex.nombre_original),
                    grupo_muscular: isGlobal ? foundGlobal.grupo_muscular : (foundLocal.grupo_muscular || ex.grupo_muscular)
                  };
                }
                return ex;
              })
            }));
            
            const finalDays = recalculatePlanWeights(enrichedDays, periodizationConfig?.marcas_1rm || {});
            setTrainingDays(finalDays);
            
            if (recommendedSchedule && recommendedSchedule.length === 7) {
              const newMapping: Record<string, number> = {};
              recommendedSchedule.forEach((val: number, idx: number) => {
                newMapping[String(idx)] = val;
              });
              setWeekdayMapping(newMapping);
              showToast('✅ Protocolo cargado con distribución de descanso sugerida según la evidencia.', 'success');
            } else {
              showToast('✅ Protocolo de entrenamiento cargado y adaptado.', 'success');
            }
          }}
        />
      )}

      {/* Exit Confirmation / Save Reminder Modal */}
      {showExitConfirm && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(5, 8, 16, 0.85)', backdropFilter: 'blur(10px)',
          zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
          fontFamily: "'Inter', sans-serif"
        }}>
          <div style={{
            background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.8), 0 0 40px rgba(14, 165, 233, 0.15)',
            borderRadius: '20px', maxWidth: '440px', width: '100%', padding: '24px',
            color: 'white', textAlign: 'center'
          }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>☁️</div>
            <h3 style={{ fontSize: '18px', fontWeight: 800, margin: '0 0 10px 0', color: '#c2ff00' }}>
              ¿Guardaste tus cambios en la nube?
            </h3>
            <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)', lineHeight: 1.5, margin: '0 0 20px 0' }}>
              Para que tu atleta (o tú mismo) pueda ver las rutinas actualizadas, las sugerencias del robot inteligente y los gráficos en tiempo real, asegúrate de guardar el plan.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button
                onClick={async () => {
                  setShowExitConfirm(false);
                  await handleSavePlan();
                  navigate('/trainer');
                }}
                style={{
                  width: '100%', background: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)',
                  color: 'white', border: 'none', borderRadius: '8px', padding: '12px',
                  fontSize: '13px', fontWeight: 800, cursor: 'pointer',
                  boxShadow: '0 4px 15px rgba(14, 165, 233, 0.3)'
                }}
              >
                ✓ Guardar cambios y Salir
              </button>
              <button
                onClick={() => {
                  setShowExitConfirm(false);
                  navigate('/trainer');
                }}
                style={{
                  width: '100%', background: 'rgba(239, 68, 68, 0.1)',
                  color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '8px', padding: '12px',
                  fontSize: '13px', fontWeight: 700, cursor: 'pointer'
                }}
              >
                Salir sin Guardar
              </button>
              <button
                onClick={() => setShowExitConfirm(false)}
                style={{
                  width: '100%', background: 'rgba(255,255,255,0.05)',
                  color: 'rgba(255,255,255,0.6)', border: 'none', borderRadius: '8px', padding: '12px',
                  fontSize: '13px', fontWeight: 600, cursor: 'pointer'
                }}
              >
                Seguir Editando
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tour Complete / Save Reminder Modal */}
      {showTourSaveReminder && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(5, 8, 16, 0.85)', backdropFilter: 'blur(10px)',
          zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
          fontFamily: "'Inter', sans-serif"
        }}>
          <div style={{
            background: 'linear-gradient(135deg, #0f172a 0%, #090d16 100%)',
            border: '1px solid rgba(194, 255, 0, 0.2)',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.8), 0 0 40px rgba(194, 255, 0, 0.1)',
            borderRadius: '20px', maxWidth: '440px', width: '100%', padding: '24px',
            color: 'white', textAlign: 'center'
          }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>🎉</div>
            <h3 style={{ fontSize: '18px', fontWeight: 800, margin: '0 0 10px 0', color: '#c2ff00' }}>
              ¡Tour Completado con Éxito!
            </h3>
            <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)', lineHeight: 1.5, margin: '0 0 20px 0' }}>
              ¡Listo! Ahora tienes el control científico total de tu plan de práctica. Recuerda que para consolidar y guardar de manera segura todo tu progreso en la base de datos, debes pulsar el botón <strong>"✓ GUARDAR"</strong> arriba a la derecha.
            </p>
            <button
              onClick={() => setShowTourSaveReminder(false)}
              style={{
                width: '100%', background: '#c2ff00',
                color: '#000', border: 'none', borderRadius: '8px', padding: '12px',
                fontSize: '13px', fontWeight: 800, cursor: 'pointer',
                boxShadow: '0 4px 15px rgba(194, 255, 0, 0.3)'
              }}
            >
              Comenzar a Planificar 🏋️
            </button>
          </div>
        </div>
      )}

      {/* 🧮 Interactive 1RM Calculator Modal */}
      {show1RMCalculator && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(5, 8, 16, 0.88)', backdropFilter: 'blur(12px)',
          zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
          fontFamily: "'Inter', sans-serif"
        }}>
          <div style={{
            background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            boxShadow: '0 24px 48px rgba(0, 0, 0, 0.8), 0 0 50px rgba(194, 255, 0, 0.15)',
            borderRadius: '24px', maxWidth: '480px', width: '100%', padding: '28px',
            color: 'white', position: 'relative'
          }}>
            <button
              onClick={() => setShow1RMCalculator(false)}
              style={{
                position: 'absolute', top: '16px', right: '16px',
                background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)',
                fontSize: '18px', cursor: 'pointer', outline: 'none'
              }}
            >
              ✕
            </button>

            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <div style={{ fontSize: '36px', marginBottom: '8px' }}>🧮</div>
              <h3 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: '#c2ff00', fontFamily: "'Orbitron', sans-serif" }}>
                Calculadora Científica 1RM
              </h3>
              <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', margin: '4px 0 0 0' }}>
                Estima tu Fuerza Máxima (1RM) a partir de una serie real y aplícala de inmediato a tu plan.
              </p>
            </div>

            {/* Unit Switcher & Formula Selector */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr', gap: '14px', marginBottom: '18px', textAlign: 'left' }}>
              <div>
                <label style={{ fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.5)', fontFamily: "'Orbitron', sans-serif", letterSpacing: '0.5px', display: 'block', marginBottom: '8px' }}>
                  UNIDAD
                </label>
                <div style={{ display: 'flex', gap: '4px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '3px' }}>
                  <button
                    type="button"
                    onClick={() => setCalcUnit('kg')}
                    style={{
                      flex: 1, border: 'none', borderRadius: '6px', padding: '5px 8px', fontSize: '9px',
                      fontFamily: "'Orbitron', sans-serif", fontWeight: 700, cursor: 'pointer',
                      background: calcUnit === 'kg' ? 'linear-gradient(135deg, #c2ff00 0%, #a3e635 100%)' : 'transparent',
                      color: calcUnit === 'kg' ? '#000' : 'rgba(255,255,255,0.6)', transition: 'all 0.15s'
                    }}
                  >
                    KG
                  </button>
                  <button
                    type="button"
                    onClick={() => setCalcUnit('lbs')}
                    style={{
                      flex: 1, border: 'none', borderRadius: '6px', padding: '5px 8px', fontSize: '9px',
                      fontFamily: "'Orbitron', sans-serif", fontWeight: 700, cursor: 'pointer',
                      background: calcUnit === 'lbs' ? 'linear-gradient(135deg, #c2ff00 0%, #a3e635 100%)' : 'transparent',
                      color: calcUnit === 'lbs' ? '#000' : 'rgba(255,255,255,0.6)', transition: 'all 0.15s'
                    }}
                  >
                    LBS
                  </button>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.5)', fontFamily: "'Orbitron', sans-serif", letterSpacing: '0.5px', display: 'block', marginBottom: '8px' }}>
                  FÓRMULA DE ESTIMACIÓN
                </label>
                <select
                  value={calcFormula}
                  onChange={(e) => setCalcFormula(e.target.value as any)}
                  style={{
                    width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '8px', color: 'white', padding: '8px 10px', fontSize: '11px', height: '32px', boxSizing: 'border-box'
                  }}
                >
                  <option value="promedio">Promedio Automático (Recomendado)</option>
                  <option value="epley">Epley (1985)</option>
                  <option value="brzycki">Brzycki (1993)</option>
                </select>
              </div>
            </div>

            {/* Inputs */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '18px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '9px', fontWeight: 700, color: 'rgba(255,255,255,0.5)', marginBottom: '6px', textTransform: 'uppercase' }}>
                  Peso ({calcUnit})
                </label>
                <input
                  type="number"
                  value={calcWeight || ''}
                  onChange={(e) => setCalcWeight(parseFloat(e.target.value) || 0)}
                  style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', color: 'white', padding: '10px', fontSize: '12px', boxSizing: 'border-box' }}
                  placeholder={calcUnit === 'kg' ? '80' : '175'}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '9px', fontWeight: 700, color: 'rgba(255,255,255,0.5)', marginBottom: '6px', textTransform: 'uppercase' }}>Reps hechas</label>
                <input
                  type="number"
                  value={calcReps || ''}
                  onChange={(e) => setCalcReps(parseInt(e.target.value, 10) || 0)}
                  style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', color: 'white', padding: '10px', fontSize: '12px', boxSizing: 'border-box' }}
                  placeholder="8"
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '9px', fontWeight: 700, color: 'rgba(255,255,255,0.5)', marginBottom: '6px', textTransform: 'uppercase' }}>RIR de la serie</label>
                <input
                  type="number"
                  value={calcRIR ?? ''}
                  onChange={(e) => setCalcRIR(parseInt(e.target.value, 10) ?? 0)}
                  style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', color: 'white', padding: '10px', fontSize: '12px', boxSizing: 'border-box' }}
                  placeholder="2"
                />
              </div>
            </div>

            {/* Calculations Breakdown */}
            {(() => {
              const effective = calcReps + (calcRIR || 0);
              const epleyVal = calcWeight * (1 + effective / 30);
              const denom = 1.0278 - 0.0278 * effective;
              const brzyckiVal = denom > 0.01 ? (calcWeight / denom) : calcWeight;
              const avgVal = (epleyVal + brzyckiVal) / 2;

              // Determinar qué valor y etiqueta mostrar según la fórmula seleccionada
              let selectedVal = avgVal;
              let formulaLabel = '1RM Promedio Estimado';
              if (calcFormula === 'epley') {
                selectedVal = epleyVal;
                formulaLabel = '1RM Epley Estimado';
              } else if (calcFormula === 'brzycki') {
                selectedVal = brzyckiVal;
                formulaLabel = '1RM Brzycki Estimado';
              }

              const roundedVal = Math.round(selectedVal * 10) / 10;
              const secondaryUnit = calcUnit === 'kg' ? 'lbs' : 'kg';
              const secondaryVal = calcUnit === 'kg' ? roundedVal * 2.20462 : roundedVal / 2.20462;

              // Collect exercises for applying
              const baseLifts = ['sentadilla', 'press de banca', 'peso muerto'];
              const planExerciseNames = trainingDays
                .flatMap(d => d.exercises)
                .map(ex => ex.nombre.trim().toLowerCase())
                .filter(n => n.length > 0);
              const existingMarcaKeys = Object.keys(periodizationConfig?.marcas_1rm || {});
              const allLifts = [...new Set([...baseLifts, ...planExerciseNames, ...existingMarcaKeys])];

              return (
                <div>
                  <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '14px', marginBottom: '18px', fontSize: '11px', lineHeight: '1.4' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span style={{ color: 'rgba(255,255,255,0.5)', fontWeight: calcFormula === 'epley' ? 700 : 400 }}>
                        Fórmula Epley (1985): {calcFormula === 'epley' && '🎯'}
                      </span>
                      <strong style={{ color: calcFormula === 'epley' ? '#c2ff00' : '#fff' }}>
                        {(Math.round(epleyVal * 10) / 10).toFixed(1)} {calcUnit}
                      </strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span style={{ color: 'rgba(255,255,255,0.5)', fontWeight: calcFormula === 'brzycki' ? 700 : 400 }}>
                        Fórmula Brzycki (1993): {calcFormula === 'brzycki' && '🎯'}
                      </span>
                      <strong style={{ color: calcFormula === 'brzycki' ? '#c2ff00' : '#fff' }}>
                        {(Math.round(brzyckiVal * 10) / 10).toFixed(1)} {calcUnit}
                      </strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '8px', marginTop: '8px', fontSize: '13px', alignItems: 'baseline' }}>
                      <span style={{ color: '#a5b4fc', fontWeight: 600 }}>{formulaLabel}:</span>
                      <div style={{ textAlign: 'right' }}>
                        <strong style={{ color: '#c2ff00', fontSize: '16px' }}>{roundedVal.toFixed(1)} {calcUnit}</strong>
                        <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', fontFamily: "'Orbitron', sans-serif", marginTop: '2px' }}>
                          ≈ {secondaryVal.toFixed(1)} {secondaryUnit}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Tabla de Equivalencias de Cargas */}
                  <div style={{ marginTop: '16px', marginBottom: '20px' }}>
                    <div style={{ fontSize: '9px', fontWeight: 800, color: '#a5b4fc', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: 'left', fontFamily: "'Orbitron', sans-serif" }}>
                      📋 TABLA DE PORCENTAJES DE CARGA (Basada en {calcFormula.toUpperCase()})
                    </div>
                    <div style={{
                      maxHeight: '170px',
                      overflowY: 'auto',
                      background: 'rgba(0,0,0,0.25)',
                      border: '1px solid rgba(255,255,255,0.06)',
                      borderRadius: '12px',
                    }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left', fontFamily: "'Inter', sans-serif" }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)', fontSize: '8.5px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            <th style={{ padding: '8px 10px' }}>%</th>
                            <th style={{ padding: '8px 10px' }}>Carga ({calcUnit})</th>
                            <th style={{ padding: '8px 10px' }}>Equivalencia</th>
                            <th style={{ padding: '8px 10px', textAlign: 'right' }}>Reps Sugeridas</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[
                            { pct: 100, reps: '1 rep' },
                            { pct: 95,  reps: '2 reps' },
                            { pct: 90,  reps: '4 reps' },
                            { pct: 85,  reps: '6 reps' },
                            { pct: 80,  reps: '8 reps' },
                            { pct: 75,  reps: '10 reps' },
                            { pct: 70,  reps: '12 reps' },
                            { pct: 65,  reps: '15 reps' },
                          ].map((row) => {
                            const mainVal = Math.round((roundedVal * (row.pct / 100)) * 10) / 10;
                            const eqVal = calcUnit === 'kg' ? mainVal * 2.20462 : mainVal / 2.20462;
                            const isSelected = row.pct === 85;
                            return (
                              <tr
                                key={row.pct}
                                style={{
                                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                                  background: isSelected ? 'rgba(0, 212, 255, 0.05)' : 'transparent',
                                  color: isSelected ? '#00d4ff' : 'rgba(255,255,255,0.85)',
                                  fontWeight: isSelected ? 700 : 400
                                }}
                              >
                                <th style={{ padding: '8px 10px', color: isSelected ? '#00d4ff' : 'rgba(0, 212, 255, 0.6)', fontWeight: 'bold' }}>{row.pct}%</th>
                                <td style={{ padding: '8px 10px', color: '#c2ff00', fontWeight: 'bold' }}>{mainVal.toFixed(1)} {calcUnit}</td>
                                <td style={{ padding: '8px 10px', color: 'rgba(255,255,255,0.45)' }}>{eqVal.toFixed(1)} {secondaryUnit}</td>
                                <td style={{ padding: '8px 10px', textAlign: 'right', color: '#fff' }}>{row.reps}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Dropdown to Apply to Exercise */}
                  <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', fontSize: '9px', fontWeight: 700, color: 'rgba(255,255,255,0.5)', marginBottom: '6px', textTransform: 'uppercase' }}>
                      Aplicar esta marca al Ejercicio:
                    </label>
                    <select
                      value={calcSelectedLift}
                      onChange={(e) => setCalcSelectedLift(e.target.value)}
                      style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', color: 'white', padding: '10px', fontSize: '12px', height: '38px', boxSizing: 'border-box' }}
                    >
                      <option value="">-- Seleccionar Ejercicio --</option>
                      {allLifts.map(lift => (
                        <option key={lift} value={lift} style={{ background: '#0b0f19' }}>
                          {lift.toUpperCase()}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    onClick={() => {
                      if (!calcSelectedLift) {
                        showToast('Selecciona un ejercicio para aplicar el 1RM.', 'error');
                        return;
                      }
                      if (roundedVal <= 0) {
                        showToast('Ingresa valores de peso y reps válidos.', 'error');
                        return;
                      }

                      // SIEMPRE inyectar en KG al planificador (para mantener consistencia interna del robot)
                      const finalKgValue = calcUnit === 'kg' ? roundedVal : Math.round((roundedVal / 2.20462) * 10) / 10;

                      const updatedMarcas = {
                        ...(periodizationConfig?.marcas_1rm || {}),
                        [calcSelectedLift]: finalKgValue
                      };

                      // Mapear calcFormula de la calculadora al tipo que espera el config
                      const formulaParaConfig = calcFormula === 'promedio' ? 'epley_brzycki_avg' : calcFormula;

                      setPeriodizationConfig(prev => {
                        if (!prev) return prev;
                        return {
                          ...prev,
                          marcas_1rm: updatedMarcas,
                          formula_preferida: formulaParaConfig
                        };
                      });

                      setTrainingDays(prevDays => recalculatePlanWeights(prevDays, updatedMarcas));
                      showToast(`✅ 1RM de ${finalKgValue} kg aplicado a ${calcSelectedLift.toUpperCase()} con éxito. Fórmulas y pesos del robot recalculados.`, 'success');
                      setShow1RMCalculator(false);
                    }}
                    style={{
                      width: '100%', background: 'linear-gradient(135deg, #c2ff00 0%, #a3e635 100%)',
                      color: '#000', border: 'none', borderRadius: '10px', padding: '12px',
                      fontSize: '13px', fontWeight: 800, cursor: 'pointer',
                      boxShadow: '0 4px 15px rgba(194, 255, 0, 0.3)'
                    }}
                  >
                    ✓ Aplicar Marca de 1RM al Plan
                  </button>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};

export default PlanPlanner;
