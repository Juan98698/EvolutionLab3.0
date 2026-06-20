import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useSupabase } from '../../context/SupabaseContext';
import { useNavigate } from 'react-router-dom';
import AthleteNavbar from '../common/AthleteNavbar';
import Toast from '../common/Toast';
import { PlanData, TrainingDay, Exercise, GlobalVariable, EjercicioGlobal } from '../../types/database.types';

// ─── Helpers ────────────────────────────────────────────────────────────────────
const genDayId = () => 'day_' + Math.random().toString(36).substring(2, 9);
const genExId = () => 'ex_' + Math.random().toString(36).substring(2, 9);

const MUSCLE_GROUPS = ['Pecho', 'Espalda', 'Cuádriceps', 'Isquiosurales', 'Hombros', 'Bíceps', 'Tríceps', 'Glúteos', 'Pantorrillas', 'Abdomen'] as const;

interface LocalExercise {
  id: string;
  nombre: string;
  grupoMuscular: string;
  variables?: Record<string, string>;
  progression_notes?: string;
  progression_type?: 'linear' | 'double' | 'undulating' | 'deload';
  progression_params?: Record<string, any>;
}

interface LocalDay {
  id: string;
  name: string;
  exercises: LocalExercise[];
}

interface GlobalVarLocal {
  id: string;
  label: string;
  type: string;
  defaultValue: string;
}

const DEFAULT_GLOBAL_VARS: GlobalVarLocal[] = [
  { id: "series de aproximacion", label: "SERIES DE APROXIMACION", type: "number", defaultValue: "2" },
  { id: "series de trabajo", label: "SERIES DE TRABAJO", type: "text", defaultValue: "3" },
  { id: "repeticiones", label: "REPETICIONES", type: "text", defaultValue: "10-12" },
  { id: "tempo", label: "TEMPO", type: "text", defaultValue: "2:1:1" },
  { id: "rir", label: "RIR", type: "number", defaultValue: "2" },
  { id: "descanso", label: "DESCANSO(MIN)", type: "number", defaultValue: "2" },
  { id: "peso", label: "PESO(KG)", type: "text", defaultValue: "10" }
];

const DEFAULT_VAR_DEFS: Record<string, string> = {
  "series de aproximacion": "Son series previas con poco peso para calentar los músculos y preparar las articulaciones sin cansarte. Ejemplo: Si vas a levantar 50kg, haces una serie previa con solo la barra o con 20kg.",
  "series de trabajo": "Son las series reales del plan donde el esfuerzo es alto y cuentan para el progreso. Ejemplo: Hacer 3 series de 10 repeticiones con el peso máximo que dominas.",
  "repeticiones": "Es el número de veces que realizas el movimiento completo del ejercicio dentro de una serie. Ejemplo: hacer 12 sentadillas seguidas sin parar.",
  "tempo": "Es la velocidad a la que realizas cada fase del movimiento (bajada, pausa y subida). Ejemplo: En sentadilla, bajar en 3 segundos, hacer 1 segundo de pausa abajo y subir rápido en 1 segundo.",
  "rir": "Indica cuántas repeticiones sientes que podrías haber hecho antes de llegar al fallo total. Ejemplo: Si haces 10 repeticiones con un RIR 2, significa que terminaste sintiendo que podrías haber hecho 2 más.",
  "descanso": "El tiempo que esperas entre una serie y otra para recuperar energía. Ejemplo: Cronometrar 2 minutos sentado antes de empezar la siguiente serie.",
  "peso": "Representa la resistencia externa que se opone a la contracción muscular para generar estímulo de adaptación en el organismo."
};

const createEmptyExercises = (count: number): LocalExercise[] =>
  Array.from({ length: count }, () => ({ id: genExId(), nombre: '', grupoMuscular: '', variables: {} }));

const createDefaultDay = (index: number): LocalDay => ({
  id: genDayId(),
  name: `Día ${index + 1}`,
  exercises: createEmptyExercises(3),
});

const todayISO = () => new Date().toISOString().split('T')[0];

interface TemplateDay {
  name: string;
  exercises: { nombre: string; grupoMuscular: string }[];
}

const ROUTINE_TEMPLATES: Record<string, { title: string; days: TemplateDay[] }> = {
  full_body: {
    title: 'Full Body (3 Días)',
    days: [
      {
        name: 'Día 1: Fuerza & Empuje',
        exercises: [
          { nombre: 'Sentadilla Libre con Barra', grupoMuscular: 'Cuádriceps' },
          { nombre: 'Press de Banca Plano con Barra', grupoMuscular: 'Pecho' },
          { nombre: 'Remo con Barra', grupoMuscular: 'Espalda' },
          { nombre: 'Elevaciones Laterales con Mancuernas', grupoMuscular: 'Hombros' },
          { nombre: 'Curl de Bíceps con Barra', grupoMuscular: 'Bíceps' },
        ],
      },
      {
        name: 'Día 2: Cadena Posterior & Tracción',
        exercises: [
          { nombre: 'Peso Muerto Convencional', grupoMuscular: 'Isquiosurales' },
          { nombre: 'Press Militar con Barra', grupoMuscular: 'Hombros' },
          { nombre: 'Dominadas Pronas (o Jalón al Pecho)', grupoMuscular: 'Espalda' },
          { nombre: 'Prensa de Piernas inclinada', grupoMuscular: 'Cuádriceps' },
          { nombre: 'Copa de Tríceps con Mancuerna', grupoMuscular: 'Tríceps' },
        ],
      },
      {
        name: 'Día 3: Hipertrofia & Accesorios',
        exercises: [
          { nombre: 'Zancadas Dinámicas con Mancuernas', grupoMuscular: 'Cuádriceps' },
          { nombre: 'Press de Banca Inclinado con Mancuernas', grupoMuscular: 'Pecho' },
          { nombre: 'Remo Gironda (Remo Sentado en Polea)', grupoMuscular: 'Espalda' },
          { nombre: 'Elevación de Talones de Pie (Prensa)', grupoMuscular: 'Cuádriceps' },
          { nombre: 'Abdominales de tipo Crunch en Colchoneta', grupoMuscular: 'Abdomen' },
        ],
      },
    ],
  },
  torso_pierna: {
    title: 'Torso / Extremidades (4 Días)',
    days: [
      {
        name: 'Día 1: Torso Enfocado en Empuje',
        exercises: [
          { nombre: 'Press de Banca Plano con Barra', grupoMuscular: 'Pecho' },
          { nombre: 'Remo con Barra Pendlay', grupoMuscular: 'Espalda' },
          { nombre: 'Press Militar con Mancuernas Sentado', grupoMuscular: 'Hombros' },
          { nombre: 'Jalón al Pecho agarre Neutro', grupoMuscular: 'Espalda' },
          { nombre: 'Curl de Bíceps alterno con Mancuernas', grupoMuscular: 'Bíceps' },
          { nombre: 'Extensión de Tríceps en Polea Alta', grupoMuscular: 'Tríceps' },
        ],
      },
      {
        name: 'Día 2: Cuádriceps & Glúteos (Fuerza)',
        exercises: [
          { nombre: 'Sentadilla Libre con Barra', grupoMuscular: 'Cuádriceps' },
          { nombre: 'Peso Muerto Rumano con Mancuernas', grupoMuscular: 'Isquiosurales' },
          { nombre: 'Prensa de Piernas', grupoMuscular: 'Cuádriceps' },
          { nombre: 'Curl de Piernas Acostado en Máquina', grupoMuscular: 'Isquiosurales' },
          { nombre: 'Elevación de Talones Sentado en Máquina', grupoMuscular: 'Cuádriceps' },
          { nombre: 'Plancha Abdominal Estática', grupoMuscular: 'Abdomen' },
        ],
      },
      {
        name: 'Día 3: Torso Enfocado en Tracción',
        exercises: [
          { nombre: 'Dominadas con Peso Corporal', grupoMuscular: 'Espalda' },
          { nombre: 'Press Inclinado con Mancuernas', grupoMuscular: 'Pecho' },
          { nombre: 'Remo con Mancuerna a una mano', grupoMuscular: 'Espalda' },
          { nombre: 'Elevaciones Laterales en Polea baja', grupoMuscular: 'Hombros' },
          { nombre: 'Curl de Bíceps en Banco Scott', grupoMuscular: 'Bíceps' },
          { nombre: 'Press Francés con Barra Z en banco plano', grupoMuscular: 'Tríceps' },
        ],
      },
      {
        name: 'Día 4: Isquiosurales & Pantorrillas (Volumen)',
        exercises: [
          { nombre: 'Peso Muerto Rumano con Barra', grupoMuscular: 'Isquiosurales' },
          { nombre: 'Prensa de Piernas inclinada', grupoMuscular: 'Cuádriceps' },
          { nombre: 'Zancadas Búlgaras con Mancuernas', grupoMuscular: 'Cuádriceps' },
          { nombre: 'Extensiones de Cuádriceps en Máquina', grupoMuscular: 'Cuádriceps' },
          { nombre: 'Elevación de Talones de Pie', grupoMuscular: 'Cuádriceps' },
          { nombre: 'Elevación de Piernas Colgado en barra', grupoMuscular: 'Abdomen' },
        ],
      },
    ],
  },
  push_pull_legs: {
    title: 'Push / Pull / Legs (3 Días)',
    days: [
      {
        name: 'Día 1: Empuje (Push)',
        exercises: [
          { nombre: 'Press de Banca Plano con Barra', grupoMuscular: 'Pecho' },
          { nombre: 'Press Militar con Barra de Pie', grupoMuscular: 'Hombros' },
          { nombre: 'Press Inclinado con Mancuernas', grupoMuscular: 'Pecho' },
          { nombre: 'Elevaciones Laterales con Mancuernas', grupoMuscular: 'Hombros' },
          { nombre: 'Extensión de Tríceps en Polea con Cuerda', grupoMuscular: 'Tríceps' },
        ],
      },
      {
        name: 'Día 2: Tracción (Pull)',
        exercises: [
          { nombre: 'Remo con Barra Prono', grupoMuscular: 'Espalda' },
          { nombre: 'Jalón al Pecho agarre Abierto', grupoMuscular: 'Espalda' },
          { nombre: 'Remo con Mancuerna apoyado en banco', grupoMuscular: 'Espalda' },
          { nombre: 'Curl de Bíceps con Barra Z', grupoMuscular: 'Bíceps' },
          { nombre: 'Curl de Bíceps Martillo con Mancuernas', grupoMuscular: 'Bíceps' },
        ],
      },
      {
        name: 'Día 3: Pierna (Cuádriceps & Femorales)',
        exercises: [
          { nombre: 'Sentadilla Libre con Barra', grupoMuscular: 'Cuádriceps' },
          { nombre: 'Peso Muerto Rumano con Barra', grupoMuscular: 'Isquiosurales' },
          { nombre: 'Prensa de Piernas inclinada', grupoMuscular: 'Cuádriceps' },
          { nombre: 'Curl de Piernas Acostado en Máquina', grupoMuscular: 'Isquiosurales' },
          { nombre: 'Elevación de Talones de Pie (Prensa)', grupoMuscular: 'Cuádriceps' },
        ],
      },
    ],
  },
};

// ─── Component ──────────────────────────────────────────────────────────────────
export const QuickStartPlanner: React.FC = () => {
  const navigate = useNavigate();
  const { user, profile } = useSupabase();

  // ── Toast ─────────────────────────────────────────────────────────────────────
  const [toastState, setToastState] = useState<{ visible: boolean; message: string; type: 'success' | 'error' | 'info' }>({
    visible: false,
    message: '',
    type: 'success',
  });

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastState({ visible: true, message, type });
    setTimeout(() => setToastState((prev) => ({ ...prev, visible: false })), 3000);
  }, []);

  // ── Ejercicios Globales ───────────────────────────────────────────────────────
  const [ejerciciosGlobales, setEjerciciosGlobales] = useState<EjercicioGlobal[]>([]);
  const [loadingEjercicios, setLoadingEjercicios] = useState(true);

  useEffect(() => {
    const fetchEjercicios = async () => {
      setLoadingEjercicios(true);
      try {
        const { data, error } = await supabase
          .from('ejercicios_globales')
          .select('*')
          .order('grupo_muscular');

        if (error) throw error;
        const normalizedData = (data || []).map((e: any) => {
          const g = e.grupo_muscular || '';
          const norm = g.toLowerCase().trim();
          let normalized = g;
          if (norm.includes('pecho') || norm.includes('chest')) normalized = 'Pecho';
          else if (norm.includes('espalda') || norm.includes('back')) normalized = 'Espalda';
          else if (norm.includes('femoral') || norm.includes('isquio') || norm.includes('isquiotibiales') || norm.includes('isquiosurles') || norm.includes('isquiosurales')) normalized = 'Isquiosurales';
          else if (norm.includes('cuad') || norm.includes('cuádriceps') || norm.includes('cuadriceps')) normalized = 'Cuádriceps';
          else if (norm.includes('glute') || norm.includes('glúteo') || norm.includes('gluteo') || norm.includes('glúteos') || norm.includes('gluteos')) normalized = 'Glúteos';
          else if (norm.includes('hombro') || norm.includes('shoulder')) normalized = 'Hombros';
          else if (norm.includes('biceps') || norm.includes('bíceps')) normalized = 'Bíceps';
          else if (norm.includes('triceps') || norm.includes('tríceps')) normalized = 'Tríceps';
          else if (norm.includes('pantorrilla') || norm.includes('pantorrillas') || norm.includes('gemelo') || norm.includes('gemelos')) normalized = 'Pantorrillas';
          else if (norm.includes('core') || norm.includes('abdomen') || norm.includes('abs') || norm.includes('abdominales')) normalized = 'Core';
          return { ...e, grupo_muscular: normalized };
        });
        setEjerciciosGlobales(normalizedData);
      } catch (err) {
        console.error('Error al cargar ejercicios globales:', err);
        showToast('Error al cargar el catálogo de ejercicios', 'error');
      } finally {
        setLoadingEjercicios(false);
      }
    };
    fetchEjercicios();
  }, [showToast]);

  // Cargar plan existente en mount para edición
  useEffect(() => {
    if (!user || ejerciciosGlobales.length === 0) return;
    const fetchExistingPlan = async () => {
      try {
        const { data, error } = await supabase
          .from('planes')
          .select('datos_plan')
          .eq('cliente_id', user.id)
          .eq('activo', true)
          .maybeSingle();

        if (error) throw error;
        if (data && data.datos_plan) {
          const planData = data.datos_plan as PlanData;
          if (planData.portada) {
            setGoal(planData.portada.userGoal || '');
            setStartDate(planData.portada.startDate || todayISO());
            setGlobalNote(planData.portada.globalNote || '');
          }
          if (planData.globalVariables) {
            setGlobalVars(planData.globalVariables.map(v => ({
              id: v.id,
              label: v.label,
              type: v.type,
              defaultValue: v.defaultValue
            })));
          }
          if (planData.variableDefinitions) {
            setVarDefinitions(planData.variableDefinitions);
          } else {
            setVarDefinitions({ ...DEFAULT_VAR_DEFS });
          }
          if (planData.weekdayMapping) {
            setWeekdayMapping(planData.weekdayMapping);
          } else {
            setWeekdayMapping({ '0': -1, '1': -1, '2': -1, '3': -1, '4': -1, '5': -1, '6': -1 });
          }
          if (planData.trainingDays && planData.trainingDays.length > 0) {
            setDays(planData.trainingDays.map(d => ({
              id: d.id,
              name: d.name,
              exercises: (d.exercises || []).map(e => {
                const match = ejerciciosGlobales.find(
                  (ej) => ej.nombre.toLowerCase().trim() === e.nombre.toLowerCase().trim()
                );
                return {
                  id: e.id,
                  nombre: e.nombre,
                  grupoMuscular: match ? match.grupo_muscular : '',
                  variables: e.variables || {},
                  progression_notes: e.progression_notes || '',
                  progression_type: e.progression_type,
                  progression_params: e.progression_params
                };
              })
            })));
          }
        }
      } catch (err) {
        console.error('Error al cargar plan existente:', err);
      }
    };
    fetchExistingPlan();
  }, [user, ejerciciosGlobales]);

  const ejerciciosByGroup = useMemo(() => {
    const grouped: Record<string, EjercicioGlobal[]> = {};
    ejerciciosGlobales.forEach((ej) => {
      const g = ej.grupo_muscular || 'Otros';
      if (!grouped[g]) grouped[g] = [];
      grouped[g].push(ej);
    });
    return grouped;
  }, [ejerciciosGlobales]);

  // ── Plan State ────────────────────────────────────────────────────────────────
  const [goal, setGoal] = useState('');
  const [startDate, setStartDate] = useState(todayISO());
  const [globalNote, setGlobalNote] = useState('');
  const [days, setDays] = useState<LocalDay[]>([createDefaultDay(0)]);
  const [globalVars, setGlobalVars] = useState<GlobalVarLocal[]>(DEFAULT_GLOBAL_VARS.map((v) => ({ ...v })));
  const [varDefinitions, setVarDefinitions] = useState<Record<string, string>>(() => ({ ...DEFAULT_VAR_DEFS }));
  const [weekdayMapping, setWeekdayMapping] = useState<Record<string, number>>({
    '0': -1, '1': -1, '2': -1, '3': -1, '4': -1, '5': -1, '6': -1
  });
  const [metaOpen, setMetaOpen] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedExercises, setExpandedExercises] = useState<Record<string, boolean>>({});

  // Estados de la calculadora 1RM
  const [is1RMModalOpen, setIs1RMModalOpen] = useState<boolean>(false);
  const [calcUnit, setCalcUnit] = useState<'kg' | 'lbs'>('kg');
  const [calcPeso, setCalcPeso] = useState<string>('');
  const [calcReps, setCalcReps] = useState<string>('');
  const [calcFormula, setCalcFormula] = useState<string>('promedio');
  const [rmResult, setRmResult] = useState<number | null>(null);
  const [rmTable, setRmTable] = useState<{ pct: number; carga: number; reps: number }[]>([]);
  const [calcTargetEx, setCalcTargetEx] = useState<{ dayId: string; exId: string; varKey: string } | null>(null);

  // Estados para Gestor de Variables del Plan
  const [newVarName, setNewVarName] = useState('');
  const [newVarDefault, setNewVarDefault] = useState('');
  const [newVarDef, setNewVarDef] = useState('');

  const toggleExerciseExpand = (exId: string) => {
    setExpandedExercises((prev) => ({ ...prev, [exId]: !prev[exId] }));
  };

  const handleWeekdayMap = (dayOfWeek: string, trainingDayIdx: number) => {
    setWeekdayMapping((prev) => ({
      ...prev,
      [dayOfWeek]: trainingDayIdx
    }));
  };

  const handleAddVariable = () => {
    const cleanName = newVarName.trim();
    if (!cleanName) {
      showToast('Por favor, ingresa el nombre de la variable.', 'error');
      return;
    }

    const varId = cleanName.toLowerCase().trim();
    if (globalVars.some((v) => v.label.toLowerCase().trim() === cleanName.toLowerCase().trim())) {
      showToast('Esta variable ya existe en tu plan.', 'error');
      return;
    }

    const newVar: GlobalVarLocal = {
      id: varId,
      label: cleanName.toUpperCase(),
      type: 'text',
      defaultValue: newVarDefault.trim() || 'A definir',
    };

    setGlobalVars((prev) => [...prev, newVar]);
    if (newVarDef.trim()) {
      setVarDefinitions((prev) => ({
        ...prev,
        [varId]: newVarDef.trim()
      }));
    }
    setNewVarName('');
    setNewVarDefault('');
    setNewVarDef('');
    showToast(`✅ Variable "${cleanName.toUpperCase()}" agregada`, 'success');
  };

  const handleRemoveVariable = (varId: string) => {
    const variable = globalVars.find((v) => v.id === varId);
    if (!variable) return;

    if (!window.confirm(`¿Seguro que deseas eliminar la variable "${variable.label}" del plan? Se eliminará de todos los ejercicios.`)) {
      return;
    }

    setGlobalVars((prev) => prev.filter((v) => v.id !== varId));
    setVarDefinitions((prev) => {
      const copy = { ...prev };
      delete copy[varId];
      return copy;
    });
    showToast(`❌ Variable "${variable.label}" eliminada`, 'info');
  };

  const handleLoadTemplate = (key: string) => {
    const template = ROUTINE_TEMPLATES[key];
    if (!template) return;

    if (days.some(d => d.exercises.some(e => e.nombre.trim() !== ''))) {
      if (!window.confirm('Cargar una plantilla reemplazará tus días y ejercicios actuales. ¿Deseas continuar?')) {
        return;
      }
    }

    const newDays: LocalDay[] = template.days.map((d) => ({
      id: genDayId(),
      name: d.name,
      exercises: d.exercises.map((e) => ({
        id: genExId(),
        nombre: e.nombre,
        grupoMuscular: e.grupoMuscular,
        variables: {}
      }))
    }));

    setDays(newDays);
    showToast(`✅ Rutina "${template.title}" cargada con éxito`, 'success');
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

  const updateExerciseVariables = (dayId: string, exId: string, updates: Record<string, string>) => {
    setDays((prev) =>
      prev.map((d) =>
        d.id === dayId
          ? {
              ...d,
              exercises: d.exercises.map((e) =>
                e.id === exId
                  ? {
                      ...e,
                      variables: {
                        ...(e.variables || {}),
                        ...updates,
                      },
                    }
                  : e
              ),
            }
          : d
      )
    );
  };

  const updateExerciseVariable = (dayId: string, exId: string, varKey: string, value: string) => {
    updateExerciseVariables(dayId, exId, { [varKey]: value });
  };

  // ── Day Management ────────────────────────────────────────────────────────────
  const addDay = () => {
    if (days.length >= 7) {
      showToast('Máximo 7 días de entrenamiento', 'info');
      return;
    }
    setDays((prev) => [...prev, createDefaultDay(prev.length)]);
  };

  const removeDay = (dayId: string) => {
    if (days.length <= 1) {
      showToast('Necesitas al menos 1 día de entrenamiento', 'info');
      return;
    }
    const day = days.find((d) => d.id === dayId);
    const hasExercises = day?.exercises.some((e) => e.nombre.trim() !== '');
    if (hasExercises) {
      if (!window.confirm('Este día tiene ejercicios. ¿Seguro que deseas eliminarlo?')) return;
    }
    setDays((prev) => prev.filter((d) => d.id !== dayId));
  };

  const updateDayName = (dayId: string, name: string) => {
    setDays((prev) => prev.map((d) => (d.id === dayId ? { ...d, name } : d)));
  };

  // ── Exercise Management ───────────────────────────────────────────────────────
  const addExercise = (dayId: string) => {
    setDays((prev) =>
      prev.map((d) =>
        d.id === dayId
          ? { ...d, exercises: [...d.exercises, { id: genExId(), nombre: '', grupoMuscular: '', variables: {} }] }
          : d
      )
    );
  };

  const removeExercise = (dayId: string, exId: string) => {
    setDays((prev) =>
      prev.map((d) =>
        d.id === dayId ? { ...d, exercises: d.exercises.filter((e) => e.id !== exId) } : d
      )
    );
  };

  const updateExerciseName = (dayId: string, exId: string, nombre: string) => {
    // Try to auto-fill muscle group from global catalog
    const match = ejerciciosGlobales.find(
      (ej) => ej.nombre.toLowerCase().trim() === nombre.toLowerCase().trim()
    );
    setDays((prev) =>
      prev.map((d) =>
        d.id === dayId
          ? {
              ...d,
              exercises: d.exercises.map((e) =>
                e.id === exId
                  ? { ...e, nombre, grupoMuscular: match ? match.grupo_muscular : e.grupoMuscular }
                  : e
              ),
            }
          : d
      )
    );
  };

  const updateExerciseGroup = (dayId: string, exId: string, grupoMuscular: string) => {
    setDays((prev) =>
      prev.map((d) =>
        d.id === dayId
          ? { ...d, exercises: d.exercises.map((e) => (e.id === exId ? { ...e, grupoMuscular } : e)) }
          : d
      )
    );
  };

  const updateGlobalVar = (varId: string, value: string) => {
    setGlobalVars((prev) => prev.map((v) => (v.id === varId ? { ...v, defaultValue: value } : v)));
  };

  // ── Save ──────────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!user) {
      showToast('Debes iniciar sesión para guardar', 'error');
      return;
    }

    // Validate at least one day has at least one named exercise
    const hasValidExercise = days.some((d) => d.exercises.some((e) => e.nombre.trim() !== ''));
    if (!hasValidExercise) {
      showToast('Agrega al menos un ejercicio con nombre', 'error');
      return;
    }

    setSaving(true);

    try {
      // Build default variables as Record
      const defaultVarsAsRecord: Record<string, string> = {};
      globalVars.forEach((v) => {
        defaultVarsAsRecord[v.label.toLowerCase().trim()] = v.defaultValue;
      });

      const planData: PlanData = {
        portada: {
          userName: profile?.nombre || '',
          userGoal: goal,
          startDate: startDate,
          planVigenciaPlan: String(profile?.vigencia_dias || 30),
          trainerName: profile?.nombre || '',
          globalNote: globalNote,
        },
        globalVariables: globalVars.map((v): GlobalVariable => ({
          id: v.id,
          label: v.label,
          type: v.type,
          defaultValue: v.defaultValue,
        })),
        variableDefinitions: varDefinitions,
        trainingDays: days.map((d): TrainingDay => ({
          id: d.id,
          name: d.name,
          exercises: d.exercises
            .filter((e) => e.nombre.trim())
            .map((e): Exercise => {
              const vars: Record<string, string> = {};
              globalVars.forEach((v) => {
                const key = v.label.toLowerCase().trim();
                vars[key] = e.variables?.[key] !== undefined && e.variables?.[key] !== ''
                  ? e.variables[key]
                  : v.defaultValue;
              });
              const match = ejerciciosGlobales.find(
                (ej) => ej.nombre.toLowerCase().trim() === e.nombre.toLowerCase().trim()
              );
              return {
                id: e.id,
                nombre: e.nombre,
                nombre_original: match ? match.nombre || '' : '',
                variables: vars,
                video_url: '',
                image_url: match ? match.imagen_url || '' : '',
                gif_url: '',
                description: match ? match.descripcion || '' : '',
                grupo_muscular: match ? match.grupo_muscular || '' : e.grupoMuscular || '',
                progression_notes: e.progression_notes || '',
                progression_type: e.progression_type,
                progression_params: e.progression_params
              } as any;
            }),
        })),
        weekdayMapping: weekdayMapping,
      };

      // Check for existing active plan
      const { data: existing, error: fetchError } = await supabase
        .from('planes')
        .select('id')
        .eq('cliente_id', user.id)
        .eq('activo', true)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (existing) {
        const { error: updateError } = await supabase
          .from('planes')
          .update({ datos_plan: planData })
          .eq('id', existing.id);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('planes')
          .insert({ cliente_id: user.id, creador_id: user.id, activo: true, datos_plan: planData });
        if (insertError) throw insertError;
      }

      // Cache to localStorage
      localStorage.setItem('pwa_client_plan', JSON.stringify(planData));

      showToast('✅ Plan guardado con éxito', 'success');
      setTimeout(() => navigate('/dashboard'), 1200);
    } catch (err: any) {
      console.error('Error al guardar plan:', err);
      showToast(err?.message || 'Error al guardar el plan', 'error');
    } finally {
      setSaving(false);
    }
  };

  // ── Styles ────────────────────────────────────────────────────────────────────
  const styles = {
    page: {
      background: 'transparent',
      minHeight: '100vh',
      color: 'white',
      paddingBottom: '80px',
    } as React.CSSProperties,
    container: {
      padding: '0 20px',
      maxWidth: '720px',
      margin: '0 auto',
    } as React.CSSProperties,
    headerWrap: {
      marginBottom: '28px',
    } as React.CSSProperties,
    backBtn: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: '10px',
      color: 'rgba(255,255,255,0.6)',
      padding: '8px 14px',
      fontSize: '11px',
      fontFamily: "'Orbitron', sans-serif",
      fontWeight: 600,
      cursor: 'pointer',
      transition: 'all 0.3s ease',
      marginBottom: '20px',
    } as React.CSSProperties,
    title: {
      fontFamily: "'Orbitron', sans-serif",
      fontSize: '20px',
      fontWeight: 800,
      letterSpacing: '1.5px',
      margin: '0 0 6px 0',
      background: 'var(--theme-btn-gradient)',
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      backgroundClip: 'text',
    } as React.CSSProperties,
    subtitle: {
      fontSize: '13px',
      color: 'rgba(255,255,255,0.5)',
      margin: 0,
    } as React.CSSProperties,
    card: {
      background: 'var(--theme-card-bg)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      border: '1px solid var(--theme-border)',
      borderRadius: '16px',
      padding: '20px',
      marginBottom: '16px',
      transition: 'all 0.3s ease',
      boxShadow: '0 8px 32px 0 var(--theme-glow)',
    } as React.CSSProperties,
    sectionLabel: {
      fontSize: '10px',
      fontWeight: 700,
      letterSpacing: '0.5px',
      textTransform: 'uppercase' as const,
      color: 'var(--theme-primary)',
      fontFamily: "'Orbitron', sans-serif",
      marginBottom: '14px',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
    } as React.CSSProperties,
    collapsibleHeader: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      cursor: 'pointer',
      userSelect: 'none' as const,
    } as React.CSSProperties,
    label: {
      fontSize: '10px',
      fontWeight: 700,
      letterSpacing: '0.5px',
      textTransform: 'uppercase' as const,
      color: 'rgba(255,255,255,0.5)',
      marginBottom: '6px',
      display: 'block',
    } as React.CSSProperties,
    input: {
      width: '100%',
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid var(--theme-border)',
      borderRadius: '10px',
      color: 'white',
      padding: '12px',
      fontSize: '13px',
      height: '44px',
      outline: 'none',
      transition: 'all 0.3s ease',
      boxSizing: 'border-box' as const,
    } as React.CSSProperties,
    textarea: {
      width: '100%',
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid var(--theme-border)',
      borderRadius: '10px',
      color: 'white',
      padding: '12px',
      fontSize: '13px',
      outline: 'none',
      transition: 'all 0.3s ease',
      boxSizing: 'border-box' as const,
      minHeight: '80px',
      resize: 'vertical' as const,
      fontFamily: 'inherit',
    } as React.CSSProperties,
    select: {
      width: '100%',
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid var(--theme-border)',
      borderRadius: '10px',
      color: 'white',
      padding: '12px',
      fontSize: '13px',
      height: '44px',
      outline: 'none',
      transition: 'all 0.3s ease',
      boxSizing: 'border-box' as const,
      cursor: 'pointer',
    } as React.CSSProperties,
    dayCard: {
      background: 'var(--theme-card-bg)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      border: '1px solid var(--theme-border)',
      borderRadius: '16px',
      padding: '18px',
      marginBottom: '14px',
      transition: 'all 0.3s ease',
      boxShadow: '0 8px 32px 0 var(--theme-glow)',
    } as React.CSSProperties,
    exerciseRow: {
      display: 'flex',
      gap: '8px',
      alignItems: 'center',
      marginBottom: '8px',
      flexWrap: 'wrap' as const,
    } as React.CSSProperties,
    addDayBtn: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '8px',
      width: '100%',
      padding: '12px',
      borderRadius: '30px',
      border: '1px solid rgba(34, 197, 94, 0.3)',
      background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.15), rgba(34, 197, 94, 0.05))',
      color: '#4ade80',
      fontSize: '12px',
      fontWeight: 700,
      fontFamily: "'Orbitron', sans-serif",
      cursor: 'pointer',
      transition: 'all 0.3s ease',
      letterSpacing: '0.5px',
    } as React.CSSProperties,
    removeDayBtn: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '6px 12px',
      borderRadius: '8px',
      border: '1px solid rgba(239, 68, 68, 0.3)',
      background: 'rgba(239, 68, 68, 0.1)',
      color: '#fca5a5',
      fontSize: '10px',
      fontWeight: 700,
      cursor: 'pointer',
      transition: 'all 0.3s ease',
      gap: '4px',
    } as React.CSSProperties,
    addExBtn: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      padding: '6px 14px',
      borderRadius: '8px',
      border: '1px solid rgba(255,255,255,0.08)',
      background: 'rgba(255,255,255,0.04)',
      color: 'rgba(255,255,255,0.6)',
      fontSize: '11px',
      fontWeight: 600,
      cursor: 'pointer',
      transition: 'all 0.3s ease',
    } as React.CSSProperties,
    removeExBtn: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '32px',
      height: '32px',
      minWidth: '32px',
      borderRadius: '8px',
      border: '1px solid rgba(239, 68, 68, 0.2)',
      background: 'rgba(239, 68, 68, 0.08)',
      color: '#fca5a5',
      cursor: 'pointer',
      transition: 'all 0.3s ease',
      padding: 0,
    } as React.CSSProperties,
    saveBtn: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '10px',
      width: '100%',
      padding: '16px',
      borderRadius: '30px',
      border: 'none',
      background: 'var(--theme-btn-gradient)',
      boxShadow: '0 0 15px var(--theme-btn-glow)',
      color: 'white',
      fontSize: '14px',
      fontWeight: 800,
      fontFamily: "'Orbitron', sans-serif",
      cursor: 'pointer',
      transition: 'all 0.3s ease',
      letterSpacing: '1px',
      textTransform: 'uppercase' as const,
      marginTop: '20px',
    } as React.CSSProperties,
    globalVarRow: {
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      marginBottom: '10px',
    } as React.CSSProperties,
    globalVarLabel: {
      fontSize: '12px',
      color: 'rgba(255,255,255,0.6)',
      minWidth: '130px',
      fontWeight: 600,
    } as React.CSSProperties,
    globalVarInput: {
      flex: 1,
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid var(--theme-border)',
      borderRadius: '10px',
      color: 'white',
      padding: '10px 12px',
      fontSize: '13px',
      height: '38px',
      outline: 'none',
      transition: 'all 0.3s ease',
      boxSizing: 'border-box' as const,
    } as React.CSSProperties,
    skeleton: {
      background: 'linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.5s infinite',
      borderRadius: '10px',
      height: '44px',
      marginBottom: '10px',
    } as React.CSSProperties,
    stepBadge: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '22px',
      height: '22px',
      borderRadius: '50%',
      background: 'var(--theme-btn-gradient)',
      color: 'white',
      fontSize: '10px',
      fontWeight: 800,
      fontFamily: "'Orbitron', sans-serif",
    } as React.CSSProperties,
  };

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div style={styles.page}>
      <AthleteNavbar />

      <div className="container stagger-3" style={styles.container}>
        {/* Header */}
        <div style={styles.headerWrap}>
          <button
            style={styles.backBtn}
            onClick={() => navigate('/dashboard')}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
              e.currentTarget.style.color = 'white';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
              e.currentTarget.style.color = 'rgba(255,255,255,0.6)';
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Volver al Dashboard
          </button>

          <h1 style={styles.title}>QUICK START — MI PLAN PERSONAL</h1>
          <p style={styles.subtitle}>Diseña tu propia rutina de entrenamiento</p>
        </div>

        {/* ── Step 1: Plan Metadata ──────────────────────────────────────────── */}
        <div style={styles.card}>
          <div
            style={styles.collapsibleHeader}
            onClick={() => setMetaOpen(!metaOpen)}
          >
            <div style={styles.sectionLabel}>
              <span style={styles.stepBadge}>1</span>
              Datos del Plan
            </div>
            <svg
              width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="var(--theme-primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              style={{
                transform: metaOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.3s ease',
              }}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>

          {metaOpen && (
            <div style={{ marginTop: '14px' }}>
              {/* Goal */}
              <div style={{ marginBottom: '14px' }}>
                <label style={styles.label}>Mi Objetivo</label>
                <input
                  type="text"
                  placeholder="Ej: Ganar masa muscular, definición, fuerza..."
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  style={styles.input}
                  onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--theme-primary)'; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--theme-border)'; }}
                />
              </div>

              {/* Start Date */}
              <div style={{ marginBottom: '14px' }}>
                <label style={styles.label}>Fecha de Inicio</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  style={{ ...styles.input, colorScheme: 'dark' }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--theme-primary)'; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--theme-border)'; }}
                />
              </div>

              {/* Global Note */}
              <div>
                <label style={styles.label}>Nota General (Opcional)</label>
                <textarea
                  placeholder="Agrega notas generales para tu plan..."
                  value={globalNote}
                  onChange={(e) => setGlobalNote(e.target.value)}
                  style={styles.textarea}
                  onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--theme-primary)'; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--theme-border)'; }}
                />
              </div>
            </div>
          )}
        </div>

        {/* ── Step 1.5: Weekday Config ───────────────────────────────────────── */}
        <div style={styles.card}>
          <div style={styles.sectionLabel}>
            <span style={styles.stepBadge}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: '-1px' }}><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            </span>
            Configuración de Días de la Semana
          </div>
          <p style={{ margin: '0 0 16px 0', fontSize: '11px', color: 'rgba(255,255,255,0.35)', lineHeight: '1.4' }}>
            Asigna qué día de tu rutina le corresponde a cada día calendario de la semana para activar el banner dinámico en tu Dashboard.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))', gap: '8px' }}>
            {['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'].map((dayName, idx) => {
              const currentVal = weekdayMapping[String(idx)] ?? -1;
              return (
                <div
                  key={idx}
                  style={{
                    textAlign: 'center',
                    background: 'var(--theme-badge-bg)',
                    padding: '10px 8px',
                    border: '1px solid var(--theme-border)',
                    borderRadius: '10px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '6px',
                  }}
                >
                  <div style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    color: '#ff7e2e',
                    fontFamily: "'Orbitron', sans-serif"
                  }}>
                    {dayName}
                  </div>
                  <select
                    value={currentVal}
                    onChange={(e) => handleWeekdayMap(String(idx), parseInt(e.target.value, 10))}
                    style={{
                      background: 'rgba(15, 23, 42, 0.6)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      color: 'white',
                      fontSize: '11px',
                      padding: '4px',
                      width: '100%',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      height: '28px',
                      boxSizing: 'border-box',
                    }}
                  >
                    <option value={-1} style={{ background: '#0b0f19', color: 'white' }}>Descanso</option>
                    {days.map((day, dIdx) => (
                      <option key={day.id} value={dIdx} style={{ background: '#0b0f19', color: 'white' }}>
                        {day.name || `Día ${dIdx + 1}`}
                      </option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Step 2: Training Days ──────────────────────────────────────────── */}
        <div style={styles.card}>
          <div style={styles.sectionLabel}>
            <span style={styles.stepBadge}>2</span>
            Días de Entrenamiento
            <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)', fontWeight: 500, fontFamily: 'inherit', marginLeft: 'auto' }}>
              {days.length}/7 días
            </span>
          </div>

          {/* Plantillas de rutina preestablecidas */}
          <div style={{
            background: 'var(--theme-badge-bg)',
            border: '1px solid var(--theme-border)',
            borderRadius: '12px',
            padding: '14px',
            marginBottom: '20px'
          }}>
            <span style={{
              display: 'block',
              fontSize: '10px',
              fontWeight: 700,
              color: 'var(--theme-primary)',
              textTransform: 'uppercase',
              fontFamily: "'Orbitron', sans-serif",
              letterSpacing: '0.5px',
              marginBottom: '10px'
            }}>
              Cargar Rutina Preestablecida (Bases)
            </span>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {Object.entries(ROUTINE_TEMPLATES).map(([key, template]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleLoadTemplate(key)}
                  style={{
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid var(--theme-border)',
                    borderRadius: '8px',
                    color: 'rgba(255, 255, 255, 0.8)',
                    padding: '8px 14px',
                    fontSize: '11px',
                    fontWeight: 600,
                    fontFamily: "'Orbitron', sans-serif",
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                    e.currentTarget.style.color = 'white';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                    e.currentTarget.style.color = 'rgba(255,255,255,0.8)';
                  }}
                >
                  {template.title}
                </button>
              ))}
            </div>
          </div>

          {/* Loading skeleton */}
          {loadingEjercicios && (
            <div style={{ marginBottom: '16px' }}>
              <div style={styles.skeleton} />
              <div style={{ ...styles.skeleton, width: '70%' }} />
              <div style={{ ...styles.skeleton, width: '50%' }} />
              <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', textAlign: 'center', marginTop: '8px' }}>
                Cargando catálogo de ejercicios...
              </p>
            </div>
          )}

          {/* Datalist for autocomplete */}
          <datalist id="ejerciciosGlobalesList">
            {Object.entries(ejerciciosByGroup).map(([grupo, ejercicios]) =>
              ejercicios.map((ej) => (
                <option key={ej.id} value={ej.nombre} label={`${ej.nombre} (${grupo})`} />
              ))
            )}
          </datalist>

          {/* Day Cards */}
          {days.map((day, dayIndex) => (
            <div key={day.id} style={styles.dayCard}>
              {/* Day Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: '28px', height: '28px', borderRadius: '8px',
                  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                  fontSize: '12px', fontWeight: 800, fontFamily: "'Orbitron', sans-serif",
                  color: 'var(--theme-primary)',
                }}>
                  {dayIndex + 1}
                </span>
                <input
                  type="text"
                  value={day.name}
                  onChange={(e) => updateDayName(day.id, e.target.value)}
                  placeholder={`Día ${dayIndex + 1}`}
                  style={{
                    ...styles.input,
                    flex: 1,
                    fontWeight: 700,
                    fontSize: '14px',
                    fontFamily: "'Orbitron', sans-serif",
                    height: '40px',
                  }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--theme-primary)'; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--theme-border)'; }}
                />
                <button
                  style={styles.removeDayBtn}
                  onClick={() => removeDay(day.id)}
                  title="Eliminar día"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                    <path d="M10 11v6" />
                    <path d="M14 11v6" />
                  </svg>
                  Eliminar
                </button>
              </div>

              {/* Exercises */}
              <div style={{ marginBottom: '10px' }}>
                <span style={{ ...styles.label, marginBottom: '10px' }}>
                  Ejercicios ({day.exercises.length})
                </span>

                {day.exercises.map((ex, exIndex) => {
                  const isExpanded = !!expandedExercises[ex.id];
                  return (
                    <div key={ex.id} style={{ display: 'flex', flexDirection: 'column', marginBottom: '12px', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '12px', padding: '10px' }}>
                      <div className="exercise-row-container">
                        {/* Main row: Index and Exercise Name */}
                        <div className="exercise-main-row">
                          <span className="exercise-index-num">
                            {exIndex + 1}
                          </span>

                          <input
                            type="text"
                            list="ejerciciosGlobalesList"
                            placeholder="Nombre del ejercicio"
                            value={ex.nombre}
                            onChange={(e) => updateExerciseName(day.id, ex.id, e.target.value)}
                            className="exercise-name-input"
                            onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--theme-primary)'; }}
                            onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--theme-border)'; }}
                          />
                        </div>

                        {/* Controls row: Muscle group select, custom settings cog, delete button */}
                        <div className="exercise-controls-row">
                          <select
                            value={ex.grupoMuscular}
                            onChange={(e) => updateExerciseGroup(day.id, ex.id, e.target.value)}
                            className="exercise-group-select"
                          >
                            <option value="" style={{ background: '#0f172a' }}>Grupo</option>
                            {MUSCLE_GROUPS.map((g) => (
                              <option key={g} value={g} style={{ background: '#0f172a' }}>{g}</option>
                            ))}
                          </select>

                          <button
                            type="button"
                            onClick={() => toggleExerciseExpand(ex.id)}
                            title="Configurar variables individuales"
                            className={`exercise-settings-btn ${isExpanded ? 'active' : ''}`}
                          >
                            ⚙️
                          </button>

                          <button
                            type="button"
                            className="exercise-delete-btn"
                            onClick={() => removeExercise(day.id, ex.id)}
                            title="Eliminar ejercicio"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <line x1="18" y1="6" x2="6" y2="18" />
                              <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                          </button>
                        </div>
                      </div>

                      {/* Expanded custom variables panel */}
                      {isExpanded && (
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))',
                          gap: '8px',
                          background: 'rgba(0,0,0,0.2)',
                          padding: '10px',
                          borderRadius: '8px',
                          marginTop: '8px',
                          border: '1px solid rgba(255,255,255,0.04)',
                          boxSizing: 'border-box',
                        }}>
                          {globalVars.map((gv) => {
                            const varKey = gv.label.toLowerCase().trim();
                            const isPeso =
                              gv.id === 'gv_peso' ||
                              varKey === 'peso' ||
                              varKey.includes('peso') ||
                              varKey === 'load' ||
                              varKey === 'weight' ||
                              varKey === 'carga';
                            return (
                              <div key={gv.id} style={{ display: 'flex', flexDirection: 'column' }}>
                                <label style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                                  {gv.label.toUpperCase()}
                                </label>
                                <div style={{ display: 'flex', gap: '4px', width: '100%' }}>
                                  <input
                                    type="text"
                                    placeholder={gv.defaultValue || 'A definir'}
                                    value={ex.variables?.[varKey] ?? ''}
                                    onChange={(e) => updateExerciseVariable(day.id, ex.id, varKey, e.target.value)}
                                    style={{ ...styles.input, flex: 1, height: '34px', fontSize: '11px', padding: '6px' }}
                                  />
                                  {isPeso && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setCalcTargetEx({ dayId: day.id, exId: ex.id, varKey });
                                        setIs1RMModalOpen(true);
                                      }}
                                      style={{
                                        width: '34px',
                                        height: '34px',
                                        minWidth: '34px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        borderRadius: '8px',
                                        background: 'var(--theme-badge-bg)',
                                        border: '1px solid var(--theme-border)',
                                        color: 'var(--theme-primary)',
                                        cursor: 'pointer',
                                        fontSize: '12px',
                                        padding: 0
                                      }}
                                      title="Calcular peso basado en 1RM"
                                    >
                                      🧮
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Add exercise to day */}
              <button
                type="button"
                style={styles.addExBtn}
                onClick={() => addExercise(day.id)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                  e.currentTarget.style.color = 'white';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                  e.currentTarget.style.color = 'rgba(255,255,255,0.6)';
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Agregar Ejercicio
              </button>
            </div>
          ))}

          {/* Add Day Button */}
          {days.length < 7 && (
            <button
              type="button"
              style={styles.addDayBtn}
              onClick={addDay}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'linear-gradient(135deg, rgba(34, 197, 94, 0.25), rgba(34, 197, 94, 0.1))';
                e.currentTarget.style.borderColor = 'rgba(34, 197, 94, 0.5)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'linear-gradient(135deg, rgba(34, 197, 94, 0.15), rgba(34, 197, 94, 0.05))';
                e.currentTarget.style.borderColor = 'rgba(34, 197, 94, 0.3)';
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Agregar Día de Entrenamiento
            </button>
          )}
        </div>
        <div style={styles.card}>
          <div style={styles.sectionLabel}>
            <span style={styles.stepBadge}>3</span>
            Variables del Plan
          </div>
          <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', margin: '0 0 14px 0', lineHeight: '1.4' }}>
            Define qué variables quieres medir en tus ejercicios. Los valores por defecto se usarán como plantilla para cada ejercicio nuevo, y puedes eliminarlos o añadir campos personalizados (ej: Tempo, Notas).
          </p>

          {/* Form to add a new variable */}
          <div style={{
            display: 'flex',
            gap: '8px',
            marginBottom: '16px',
            background: 'rgba(255,255,255,0.02)',
            padding: '12px',
            borderRadius: '10px',
            border: '1px solid rgba(255,255,255,0.04)',
            alignItems: 'flex-end',
            flexWrap: 'wrap'
          }}>
            <div style={{ flex: 1, minWidth: '130px' }}>
              <label style={{ ...styles.label, marginBottom: '4px' }}>Nueva Variable</label>
              <input
                type="text"
                placeholder="Ej: RPE, Tempo, Cadencia..."
                value={newVarName}
                onChange={(e) => setNewVarName(e.target.value)}
                style={{ ...styles.input, height: '38px', fontSize: '12px' }}
              />
            </div>
            <div style={{ flex: 1, minWidth: '100px' }}>
              <label style={{ ...styles.label, marginBottom: '4px' }}>Valor por defecto</label>
              <input
                type="text"
                placeholder="Ej: 3010, 8..."
                value={newVarDefault}
                onChange={(e) => setNewVarDefault(e.target.value)}
                style={{ ...styles.input, height: '38px', fontSize: '12px' }}
              />
            </div>
            <div style={{ flex: 2, minWidth: '200px' }}>
              <label style={{ ...styles.label, marginBottom: '4px' }}>Explicación teórica (opcional)</label>
              <input
                type="text"
                placeholder="Ej: Mide la velocidad de ejecución..."
                value={newVarDef}
                onChange={(e) => setNewVarDef(e.target.value)}
                style={{ ...styles.input, height: '38px', fontSize: '12px' }}
              />
            </div>
            <button
              type="button"
              onClick={handleAddVariable}
              style={{
                height: '38px',
                padding: '0 16px',
                borderRadius: '10px',
                background: 'var(--theme-badge-bg)',
                border: '1px solid var(--theme-border)',
                color: 'var(--theme-primary)',
                fontSize: '11px',
                fontWeight: 700,
                fontFamily: "'Orbitron', sans-serif",
                cursor: 'pointer',
                transition: 'all 0.3s ease',
              }}
            >
              + Añadir
            </button>
          </div>

          {/* List of active variables */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {globalVars.map((gv) => (
              <div key={gv.id} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                background: 'rgba(255,255,255,0.01)',
                border: '1px solid rgba(255,255,255,0.03)',
                padding: '10px 12px',
                borderRadius: '10px',
                flexWrap: 'wrap'
              }}>
                <span style={{
                  fontSize: '12px',
                  color: 'white',
                  fontWeight: 600,
                  flex: 1,
                  fontFamily: "'Orbitron', sans-serif",
                  minWidth: '130px'
                }}>
                  {gv.label}
                </span>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>DEF:</span>
                  <input
                    type="text"
                    value={gv.defaultValue}
                    onChange={(e) => updateGlobalVar(gv.id, e.target.value)}
                    placeholder="A definir"
                    style={{
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid var(--theme-border)',
                      borderRadius: '8px',
                      color: 'white',
                      padding: '6px 10px',
                      fontSize: '12px',
                      width: '80px',
                      height: '30px',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />

                  <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', fontWeight: 600, marginLeft: '6px' }}>GUÍA:</span>
                  <input
                    type="text"
                    value={varDefinitions[gv.id] ?? ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      setVarDefinitions(prev => ({
                        ...prev,
                        [gv.id]: val
                      }));
                    }}
                    placeholder="Explicación teórica..."
                    style={{
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid var(--theme-border)',
                      borderRadius: '8px',
                      color: 'white',
                      padding: '6px 10px',
                      fontSize: '12px',
                      width: '180px',
                      height: '30px',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />

                  <button
                    type="button"
                    onClick={() => handleRemoveVariable(gv.id)}
                    style={{
                      background: 'rgba(239, 68, 68, 0.08)',
                      border: '1px solid rgba(239, 68, 68, 0.2)',
                      borderRadius: '6px',
                      color: '#fca5a5',
                      width: '28px',
                      height: '28px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '14px',
                      transition: 'all 0.2s',
                      padding: 0
                    }}
                    title="Eliminar variable"
                  >
                    &times;
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>


        {/* ── Save Button ────────────────────────────────────────────────────── */}
        <button
          style={{
            ...styles.saveBtn,
            opacity: saving ? 0.6 : 1,
            pointerEvents: saving ? 'none' : 'auto',
          }}
          onClick={handleSave}
          disabled={saving}
          onMouseEnter={(e) => {
            if (!saving) e.currentTarget.style.transform = 'translateY(-2px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          {saving ? (
            <>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}>
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
              Guardando...
            </>
          ) : (
            <>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11z" />
                <polyline points="17 21 17 13 7 13 7 21" />
                <polyline points="7 3 7 8 15 8" />
              </svg>
              Guardar Mi Plan
            </>
          )}
        </button>

        {/* Summary line */}
        <p style={{
          textAlign: 'center',
          fontSize: '11px',
          color: 'rgba(255,255,255,0.25)',
          marginTop: '14px',
        }}>
          {days.length} {days.length === 1 ? 'día' : 'días'} · {days.reduce((acc, d) => acc + d.exercises.filter((e) => e.nombre.trim()).length, 0)} ejercicios configurados
        </p>
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

      {/* 1RM CALCULATOR MODAL OVERLAY */}
      {is1RMModalOpen && (
        <div id="modal-1rm" className={is1RMModalOpen ? 'open' : ''} style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', display: is1RMModalOpen ? 'flex' : 'none', justifyContent: 'center', alignItems: 'center', background: 'rgba(0,0,0,0.6)', zIndex: 99999 }} onClick={(e) => { if (e.target === e.currentTarget) { setIs1RMModalOpen(false); setRmResult(null); setCalcTargetEx(null); } }}>
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
              <button className="modal-1rm-close" onClick={() => { setIs1RMModalOpen(false); setRmResult(null); setCalcTargetEx(null); }}>&times;</button>
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
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid var(--theme-border)',
                    borderRadius: '10px',
                    color: 'white',
                    padding: '10px',
                    outline: 'none',
                    fontSize: '13px'
                  }}
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
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid var(--theme-border)',
                    borderRadius: '10px',
                    color: 'white',
                    padding: '10px',
                    outline: 'none',
                    fontSize: '13px'
                  }}
                />
              </div>
              <div className="modal-1rm-group full-width">
                <label htmlFor="select1RMFormula">FÓRMULA</label>
                <select
                  id="select1RMFormula"
                  value={calcFormula}
                  onChange={(e) => setCalcFormula(e.target.value)}
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid var(--theme-border)',
                    borderRadius: '10px',
                    color: 'white',
                    padding: '10px',
                    outline: 'none',
                    fontSize: '13px',
                    cursor: 'pointer'
                  }}
                >
                  <option value="promedio" style={{ background: '#0f172a' }}>Promedio Automático (Recomendado)</option>
                  <option value="brzycki" style={{ background: '#0f172a' }}>Brzycki</option>
                  <option value="epley" style={{ background: '#0f172a' }}>Epley</option>
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
                {calcTargetEx && (
                  <div style={{
                    fontSize: '11px',
                    color: 'var(--theme-primary)',
                    fontWeight: 700,
                    textAlign: 'center',
                    marginBottom: '10px',
                    fontFamily: "'Orbitron', sans-serif",
                    animation: 'pulse 1.5s infinite'
                  }}>
                    👉 HAZ CLIC EN UNA FILA PARA APLICAR EL PESO AL EJERCICIO
                  </div>
                )}
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
                        const isClickable = !!calcTargetEx;
                        return (
                          <tr
                            key={row.pct}
                            onClick={() => {
                              if (!isClickable || !calcTargetEx) return;
                              const targetWeight = row.carga.toFixed(1);
                              
                              const updates: Record<string, string> = {
                                [calcTargetEx.varKey]: targetWeight
                              };
                              const repsVar = globalVars.find(v => {
                                const lbl = v.label.toLowerCase().trim();
                                return (
                                  v.id === 'gv_reps' ||
                                  lbl === 'repeticiones' ||
                                  lbl === 'reps' ||
                                  lbl === 'rep' ||
                                  lbl === 'repetitions' ||
                                  lbl.includes('repeticion') ||
                                  lbl.includes('reps')
                                );
                              });
                              if (repsVar) {
                                updates[repsVar.label.toLowerCase().trim()] = String(row.reps);
                              }

                              updateExerciseVariables(calcTargetEx.dayId, calcTargetEx.exId, updates);
                              setIs1RMModalOpen(false);
                              setCalcTargetEx(null);
                              setRmResult(null);
                              
                              const repsMsg = repsVar ? ` y ${row.reps} repeticiones` : '';
                              showToast(`✅ Carga de ${targetWeight} ${calcUnit}${repsMsg} aplicada`, 'success');
                            }}
                            style={{
                              cursor: isClickable ? 'pointer' : 'default',
                              background: isClickable ? 'rgba(94, 234, 212, 0.02)' : undefined,
                              transition: 'all 0.2s'
                            }}
                            className={isClickable ? 'rm-row-clickable' : ''}
                          >
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

      {/* Shimmer keyframes & Custom styles (injected once) */}
      <style>{`
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .exercise-row-container {
          display: flex;
          flex-direction: row;
          align-items: center;
          gap: 8px;
          margin-bottom: 8px;
          width: 100%;
        }
        .exercise-main-row {
          display: flex;
          align-items: center;
          gap: 8px;
          flex: 2;
          min-width: 0;
        }
        .exercise-index-num {
          font-size: 10px;
          font-weight: 700;
          color: rgba(255,255,255,0.25);
          min-width: 18px;
          text-align: center;
        }
        .exercise-name-input {
          width: 100%;
          background: rgba(255,255,255,0.03);
          border: 1px solid var(--theme-border);
          border-radius: 10px;
          color: white;
          padding: 12px;
          font-size: 12px;
          height: 38px;
          outline: none;
          transition: all 0.3s ease;
          box-sizing: border-box;
        }
        .exercise-controls-row {
          display: flex;
          align-items: center;
          gap: 8px;
          flex: 1;
        }
        .exercise-group-select {
          flex: 1;
          background: rgba(255,255,255,0.03);
          border: 1px solid var(--theme-border);
          border-radius: 10px;
          color: white;
          padding: 0 12px;
          font-size: 11px;
          height: 38px;
          outline: none;
          transition: all 0.3s ease;
          box-sizing: border-box;
          cursor: pointer;
          min-width: 95px;
        }
        .exercise-settings-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          min-width: 32px;
          border-radius: 8px;
          border: 1px solid rgba(255,255,255,0.1);
          background: rgba(255,255,255,0.04);
          color: rgba(255,255,255,0.6);
          cursor: pointer;
          transition: all 0.3s ease;
          padding: 0;
        }
        .exercise-settings-btn.active {
          border: 1px solid var(--theme-primary);
          background: rgba(20, 184, 166, 0.15);
          color: var(--theme-primary);
        }
        .exercise-delete-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          min-width: 32px;
          border-radius: 8px;
          border: 1px solid rgba(239, 68, 68, 0.2);
          background: rgba(239, 68, 68, 0.08);
          color: #fca5a5;
          cursor: pointer;
          transition: all 0.3s ease;
          padding: 0;
        }
        @media (max-width: 580px) {
          .exercise-row-container {
            flex-direction: column;
            align-items: stretch;
          }
          .exercise-main-row {
            width: 100%;
          }
          .exercise-controls-row {
            width: 100%;
            margin-top: 4px;
          }
          .exercise-group-select {
            flex: 1;
          }
        }
        .rm-row-clickable {
          transition: all 0.2s ease;
        }
        .rm-row-clickable:hover {
          background: rgba(94, 234, 212, 0.08) !important;
          transform: scale(1.01);
        }
        @keyframes pulse {
          0% { opacity: 0.6; }
          50% { opacity: 1; }
          100% { opacity: 0.6; }
        }
      `}</style>

      <Toast message={toastState.message} type={toastState.type} visible={toastState.visible} />
    </div>
  );
};

export default QuickStartPlanner;
