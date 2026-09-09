import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { PlanData, ExpressBlockAudit } from '../../types/database.types';
import { writeSessionsToCache, readSessionsFromCache } from '../../lib/sessions';
import { autoRegulatePlanForNextWeek } from '../../lib/periodizationEngine';
import { ErrorBoundary } from '../common/ErrorBoundary';
import { useModalA11y } from '../../hooks/useModalA11y';
import { useWakeLock } from '../../hooks/useWakeLock';
import { isFunctionalExercise } from '../../lib/exerciseUtils';
import { computeBlockTags, applyExpressMode, computeNextExerciseStep, chainExercisesWithReorder, swapBlockPartner } from '../../lib/exerciseBlockUtils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SeriesEntry {
  reps: number | string;
  peso: string;
  done: boolean;
}

interface ActiveExercise {
  id: string;
  nombre: string;
  grupo: string;
  suggestedPeso: string;   // Ghost value from plan variables
  suggestedReps: number;   // Ghost value from plan variables
  targetRIR: string;
  descanso: number;        // in seconds
  /** Descanso real medido entre series consecutivas de este ejercicio (segundos).
   * A diferencia de `descanso` (el prescrito por el plan), esto refleja lo
   * que el atleta realmente hizo — necesario para 'autocarga_descanso_densidad'
   * en ruleBasedProgression.ts, que evalúa comportamiento real, no lo prescrito. */
  descansosReales: number[];
  series: SeriesEntry[];
  feedback_estimulo: 'none' | 'good' | 'extreme';
  feedback_recuperacion: 'recovered' | 'just_in_time' | 'sore';
  rirPercibido?: number;
  isFunctional?: boolean;
  video_url?: string;
  image_url?: string;
  gif_url?: string;
  description?: string;
  block_id?: string;
  block_rest?: number;
  transition_rest?: number;
  block_tag?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const parseNumericField = (val: string | undefined): number => {
  if (!val) return 0;
  const clean = val.trim();
  const range = clean.match(/^(\d+)\s*[-–]\s*(\d+)$/);
  if (range) return Math.round((parseInt(range[1], 10) + parseInt(range[2], 10)) / 2);
  const single = clean.match(/^[\d.]+/);
  return single ? parseFloat(single[0]) : 0;
};

const parseSeries = (val: string | undefined): number => {
  if (!val) return 3;
  const n = parseNumericField(val);
  return Math.max(1, Math.min(10, n || 3));
};

const parseReps = (val: string | undefined): number => {
  if (!val) return 10;
  const n = parseNumericField(val);
  return Math.max(1, Math.min(50, n || 10));
};

const parsePeso = (val: string | undefined): string => {
  if (!val) return '';
  // Strip the robot prefix if present
  return val.replace(/^🤖\s*/, '').trim();
};

const parseDescanso = (val: string | undefined): number => {
  if (!val) return 90;
  const n = parseNumericField(val);
  // If the parsed number is small (e.g. less than 30), it represents minutes. We convert it to seconds.
  const seconds = n < 30 ? Math.round(n * 60) : Math.round(n);
  return Math.max(30, seconds || 90);
};

const isExerciseFinished = (ex: ActiveExercise): boolean => {
  return Boolean(ex.series && ex.series.length > 0 && ex.series.every(s => s.done));
};


/**
 * ActiveSession — Ultra-minimalist workout logging screen.
 *
 * Design principle: max 5 taps per set.
 *   Open → see exercise → tap peso → tap reps → tap ✓ → next
 *
 * This component is a standalone full-screen route (/session/active/:dayIndex)
 * without the athlete navbar, so there are zero distractions during the workout.
 */
const ActiveSession: React.FC = () => {
  const { dayIndex } = useParams<{ dayIndex: string }>();
  const navigate = useNavigate();

  // Prevent screen suspension during the active workout session
  useWakeLock(true);

  // ─── Plan data ───────────────────────────────────────────────────────────
  const [plan, setPlan] = useState<PlanData | null>(null);
  const [exercises, setExercises] = useState<ActiveExercise[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [activeMediaType, setActiveMediaType] = useState<'image' | 'gif'>('image');
  const [saving, setSaving] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [sessionNotes, setSessionNotes] = useState('');
  const [showFullImage, setShowFullImage] = useState(false);
  const [showGuideModal, setShowGuideModal] = useState(false);
  const fullImageDialogRef = useModalA11y<HTMLDivElement>({
    isOpen: showFullImage,
    onClose: () => setShowFullImage(false),
  });
  const guideDialogRef = useModalA11y<HTMLDivElement>({
    isOpen: showGuideModal,
    onClose: () => setShowGuideModal(false),
  });
  const [showFeedbackGuide, setShowFeedbackGuide] = useState(false);
  const [showExpressModal, setShowExpressModal] = useState(false);
  // Compañero elegido para reemplazar cuando el bloque actual tiene 3+ miembros
  // (triset/circuito) y no basta con asumir "el primero de la lista".
  const [selectedSwapPartnerId, setSelectedSwapPartnerId] = useState<string | null>(null);
  const expressDialogRef = useModalA11y<HTMLDivElement>({
    isOpen: showExpressModal,
    onClose: () => setShowExpressModal(false),
  });
  const [expressModeActive, setExpressModeActive] = useState(false);
  const [expressBlocksAudit, setExpressBlocksAudit] = useState<ExpressBlockAudit[]>([]);
  // Selección personalizada de ejercicios para encadenar en Súper Serie (2, 3, 4, 5...)
  const [selectedChainIds, setSelectedChainIds] = useState<string[]>([]);
  const [customBlockRest, setCustomBlockRest] = useState<number>(90);
  const [customTransitionRest, setCustomTransitionRest] = useState<number>(10);

  // ─── Rest timer ──────────────────────────────────────────────────────────
  const [restSecondsLeft, setRestSecondsLeft] = useState<number | null>(null);
  const restIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  /** Marca de tiempo (ms) de cuándo arrancó el descanso más reciente, por
   * índice de ejercicio — para medir cuánto descansó realmente el atleta
   * entre series (no lo prescrito). Ver ActiveExercise.descansosReales. */
  const restStartedAtRef = useRef<Record<number, number>>({});

  // ─── Load plan from localStorage ─────────────────────────────────────────
  useEffect(() => {
    try {
      const raw = localStorage.getItem('pwa_client_plan');
      if (!raw) return;
      const parsed: PlanData = JSON.parse(raw);
      setPlan(parsed);

      const idx = parseInt(dayIndex || '0', 10);
      const day = parsed.trainingDays?.[idx];
      if (!day) return;

      const blockTags = computeBlockTags(day.exercises);

      // Build ActiveExercise array from plan exercises
      const built: ActiveExercise[] = day.exercises.map((ex, exIdx) => {
        const isFunc = isFunctionalExercise(ex);
        const vars = ex.variables || {};
        const seriesKey = Object.keys(vars).find(k => {
          const kl = k.toLowerCase();
          return kl.includes('series de trabajo') || kl.includes('series') || kl.includes('ronda');
        });
        const seriesRaw = seriesKey ? vars[seriesKey] : undefined;
        const numSeries = parseSeries(seriesRaw);

        const repsKey = Object.keys(vars).find(k => {
          const kl = k.toLowerCase();
          if (kl === 'reps_objetivo' || kl.includes('series')) return false;
          return kl.includes('repeticiones') || kl.includes('reps') || kl.includes('trabajo');
        });
        const repsRaw = repsKey ? vars[repsKey] : undefined;

        // Si la periodización ya recalculó un objetivo de reps coherente con
        // el nuevo peso (repsMin del rango, usado en la misma fórmula que
        // calculó el peso), se usa ese valor en vez del promedio del rango.
        // Si el ejercicio nunca tuvo un ajuste algorítmico (o el plan no usa
        // periodización), no existe 'reps_objetivo' y se cae al comportamiento
        // original (promedio del rango "10-12" definido por el entrenador).
        const repsObjetivoKey = Object.keys(vars).find(k => k.toLowerCase().trim() === 'reps_objetivo');
        const repsObjetivoRaw = repsObjetivoKey ? vars[repsObjetivoKey] : undefined;
        const repsObjetivoNum = repsObjetivoRaw
          ? parseInt(repsObjetivoRaw.replace(/^🤖\s*/, '').trim(), 10)
          : NaN;
        const numReps = (!isNaN(repsObjetivoNum) && repsObjetivoNum > 0)
          ? repsObjetivoNum
          : parseReps(repsRaw);

        const pesoKey = Object.keys(vars).find(k => {
          const kl = k.toLowerCase();
          return kl.includes('peso') || kl.includes('carga');
        });
        const pesoRaw = pesoKey ? vars[pesoKey] : undefined;
        const pesoSugerido = parsePeso(pesoRaw);

        const descansoKey = Object.keys(vars).find(k => {
          const kl = k.toLowerCase();
          return kl.includes('descanso') || kl.includes('pausa');
        });
        const descansoRaw = descansoKey ? vars[descansoKey] : undefined;
        const descanso = parseDescanso(descansoRaw);

        const rirKey = Object.keys(vars).find(k => {
          const kl = k.toLowerCase().trim();
          return kl === 'rir' || kl === 'rpe' || kl.includes('intensi');
        });
        const rirRaw = rirKey ? vars[rirKey] : '';

        const series: SeriesEntry[] = Array.from({ length: numSeries }, () => ({
          reps: numReps,
          peso: pesoSugerido,
          done: false,
        }));

        return {
          id: ex.id || `ex_${idx}_${exIdx}_${Date.now()}`,
          nombre: ex.nombre || 'Ejercicio',
          grupo: (ex as any).grupo_muscular || ex.grupo_muscular || '',
          suggestedPeso: pesoSugerido,
          suggestedReps: numReps,
          targetRIR: rirRaw || '',
          descanso,
          descansosReales: [],
          series,
          feedback_estimulo: 'good',
          feedback_recuperacion: 'recovered',
          rirPercibido: !isNaN(parseFloat(rirRaw)) ? Math.min(4, Math.max(0, Math.round(parseFloat(rirRaw)))) : 2,
          isFunctional: isFunc,
          video_url: ex.video_url || '',
          image_url: ex.image_url || '',
          gif_url: ex.gif_url || '',
          description: (ex as any).descripcion || (ex as any).description || '',
          block_id: ex.block_id,
          block_rest: ex.block_rest,
          transition_rest: ex.transition_rest,
          block_tag: blockTags[ex.id]
        };
      });

      setExercises(built);
    } catch (e) {
      console.error('Error loading plan for ActiveSession:', e);
    }
  }, [dayIndex]);

  // Set initial active media type based on what is available when selected exercise changes
  useEffect(() => {
    const curEx = exercises[currentIdx];
    if (curEx) {
      setActiveMediaType(curEx.image_url ? 'image' : 'gif');
    }
  }, [currentIdx, exercises]);

  // Cargar dinámicamente el gif_url del catálogo global si no viene en el plan
  useEffect(() => {
    const fetchGlobalGif = async () => {
      const curEx = exercises[currentIdx];
      if (curEx && !curEx.gif_url) {
        try {
          const { data } = await supabase
            .from('ejercicios_globales')
            .select('gif_url')
            .ilike('nombre', curEx.nombre.trim())
            .maybeSingle();

          if (data && data.gif_url) {
            setExercises(prev => prev.map((ex, idx) => 
              idx === currentIdx ? { ...ex, gif_url: data.gif_url } : ex
            ));
          }
        } catch (e) {
          console.warn('Error fetching global gif_url:', e);
        }
      }
    };
    fetchGlobalGif();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIdx]);

  // ─── Rest timer audio & vibration alert ────────────────────────────────────
  const playRestTimerStartAlert = () => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate([150, 80, 150]);
      } catch (e) {}
    }
  };

  const playRestTimerEndAlert = () => {
    // 1. Vibración háptica potente al terminar
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate([300, 120, 300, 120, 450]);
      } catch (e) {}
    }

    // 2. Sonido audible deportivo LOUD sintetizado con Web Audio API (100% nativo)
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();

      const now = ctx.currentTime;
      const playBeep = (freq: number, startTime: number, duration: number, type: OscillatorType = 'triangle') => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, startTime);
        gain.gain.setValueAtTime(0.85, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(startTime);
        osc.stop(startTime + duration);
      };

      // Tono deportivo de 4 notas potente y claro (G5 -> A5 -> C6 -> E6)
      playBeep(783.99, now, 0.12, 'triangle');
      playBeep(880.00, now + 0.15, 0.12, 'triangle');
      playBeep(1046.50, now + 0.30, 0.12, 'triangle');
      playBeep(1318.51, now + 0.45, 0.40, 'sine');
    } catch (e) {
      console.warn('No se pudo reproducir el tono de audio del temporizador:', e);
    }
  };

  // ─── Rest timer logic ─────────────────────────────────────────────────────
  const startRestTimer = useCallback((seconds: number) => {
    if (restIntervalRef.current) clearInterval(restIntervalRef.current);
    setRestSecondsLeft(seconds);
    playRestTimerStartAlert();
    restIntervalRef.current = setInterval(() => {
      setRestSecondsLeft(prev => {
        if (prev === null || prev <= 1) {
          clearInterval(restIntervalRef.current!);
          playRestTimerEndAlert();
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  useEffect(() => {
    return () => {
      if (restIntervalRef.current) clearInterval(restIntervalRef.current);
    };
  }, []);

  // ─── Series handlers ──────────────────────────────────────────────────────
  const handleSeriesFieldChange = useCallback(
    (exIdx: number, sIdx: number, field: 'reps' | 'peso', value: string) => {
      setExercises(prev => {
        const copy = [...prev];
        const series = [...copy[exIdx].series];
        if (field === 'reps') {
          if (value === '') {
            series[sIdx] = { ...series[sIdx], reps: '' };
          } else {
            const parsed = parseInt(value, 10);
            series[sIdx] = { ...series[sIdx], reps: isNaN(parsed) ? '' : parsed };
          }
        } else {
          series[sIdx] = { ...series[sIdx], peso: value };
        }
        copy[exIdx] = { ...copy[exIdx], series };
        return copy;
      });
    },
    []
  );

  const handleSeriesDone = useCallback(
    (exIdx: number, sIdx: number) => {
      const isCurrentlyDone = exercises[exIdx]?.series[sIdx]?.done;

      setExercises(prev => {
        const copy = [...prev];
        const series = [...copy[exIdx].series];

        if (isCurrentlyDone) {
          series[sIdx] = { ...series[sIdx], done: false };
        } else {
          // Fill in ghost values if the field is still empty
          if (!series[sIdx].peso && copy[exIdx].suggestedPeso) {
            series[sIdx] = { ...series[sIdx], peso: copy[exIdx].suggestedPeso };
          }
          if (!series[sIdx].reps && copy[exIdx].suggestedReps) {
            series[sIdx] = { ...series[sIdx], reps: copy[exIdx].suggestedReps };
          }
          series[sIdx] = { ...series[sIdx], done: true };
        }

        copy[exIdx] = { ...copy[exIdx], series };
        return copy;
      });

      // Start rest timer only if marked as done (was not done previously)
      if (!isCurrentlyDone) {
        // Guardar descanso real medido
        const startedAt = restStartedAtRef.current[exIdx];
        if (startedAt) {
          const elapsedSeconds = Math.round((Date.now() - startedAt) / 1000);
          if (elapsedSeconds > 0) {
            setExercises(prev => {
              const copy = [...prev];
              const descansosReales = [...(copy[exIdx].descansosReales || []), elapsedSeconds];
              copy[exIdx] = { ...copy[exIdx], descansosReales };
              return copy;
            });
          }
        }
        restStartedAtRef.current[exIdx] = Date.now();

        // Calculate next step in round-robin or standard progression
        const updatedExercisesState = exercises.map((e, idx) => {
          if (idx !== exIdx) return e;
          const seriesCopy = [...e.series];
          seriesCopy[sIdx] = { ...seriesCopy[sIdx], done: true };
          return { ...e, series: seriesCopy };
        });

        const step = computeNextExerciseStep(updatedExercisesState, exIdx, sIdx);
        startRestTimer(step.timerSeconds);
        if (step.nextIdx !== currentIdx) {
          setCurrentIdx(step.nextIdx);
        }
      }
    },
    [exercises, currentIdx, startRestTimer]
  );

  const handleFeedbackChange = useCallback(
    (exIdx: number, field: 'feedback_estimulo' | 'feedback_recuperacion', value: string) => {
      setExercises(prev => {
        const copy = [...prev];
        copy[exIdx] = { ...copy[exIdx], [field]: value };
        return copy;
      });
    },
    []
  );

  const handleApplyExpressMode = useCallback((mode: 'supersets' | 'circuit' | 'reset') => {
    const fakeExercises = exercises.map(ex => ({
      id: ex.id,
      nombre: ex.nombre,
      grupo_muscular: ex.grupo,
      series: String(ex.series.length),
      block_id: ex.block_id,
      block_rest: ex.block_rest,
      transition_rest: ex.transition_rest,
      variables: {},
    }));

    const result = applyExpressMode(fakeExercises, mode);
    const blockTags = computeBlockTags(result.exercises);

    setExercises(prev => prev.map((ex, idx) => {
      const updatedEx = result.exercises[idx];
      return {
        ...ex,
        block_id: updatedEx?.block_id,
        block_rest: updatedEx?.block_rest,
        transition_rest: updatedEx?.transition_rest,
        block_tag: blockTags[ex.id],
      };
    }));

    if (mode === 'reset') {
      setExpressModeActive(false);
      setExpressBlocksAudit([]);
    } else {
      setExpressModeActive(true);
      setExpressBlocksAudit(result.expressBlocks);
    }
    setShowExpressModal(false);
  }, [exercises]);

  // Sincronizar selección inicial de Súper Serie al abrir el modal o cambiar de ejercicio
  useEffect(() => {
    if (showExpressModal && exercises[currentIdx]) {
      const cur = exercises[currentIdx];
      if (cur.block_id) {
        // Preservar el ejercicio actual y compañeros del bloque que sigan pendientes
        const currentBlockMembers = exercises
          .filter(e => e.block_id === cur.block_id && (e.id === cur.id || !isExerciseFinished(e)))
          .map(e => e.id);
        setSelectedChainIds(currentBlockMembers);
      } else {
        setSelectedChainIds([cur.id]);
      }
      setCustomBlockRest(cur.block_rest ?? 90);
      setCustomTransitionRest(cur.transition_rest ?? 10);
    }
  }, [showExpressModal, currentIdx, exercises]);

  const handleChainSelectedExercises = useCallback(() => {
    const cur = exercises[currentIdx];
    if (!cur) return;

    // Solo permitir encadenar el ejercicio actual y ejercicios pendientes (no 100% terminados)
    const validChainIds = selectedChainIds.filter(id => {
      const ex = exercises.find(e => e.id === id);
      return ex && (ex.id === cur.id || !isExerciseFinished(ex));
    });
    if (validChainIds.length < 2) return;

    const fakeExercises = exercises.map(ex => ({
      id: ex.id,
      nombre: ex.nombre,
      grupo_muscular: ex.grupo,
      series: String(ex.series.length),
      block_id: ex.block_id,
      block_rest: ex.block_rest,
      transition_rest: ex.transition_rest,
      variables: {},
    }));

    const result = chainExercisesWithReorder(
      fakeExercises,
      cur.id,
      validChainIds,
      customBlockRest,
      customTransitionRest
    );
    const blockTags = computeBlockTags(result.exercises);
    const reorderedMap = new Map(exercises.map(e => [e.id, e]));

    const newActiveExercises: ActiveExercise[] = result.exercises.map(item => {
      const original = reorderedMap.get(item.id)!;
      return {
        ...original,
        block_id: item.block_id,
        block_rest: item.block_rest,
        transition_rest: item.transition_rest,
        block_tag: blockTags[item.id],
      };
    });

    setExercises(newActiveExercises);
    const newCurrentIdx = newActiveExercises.findIndex(e => e.id === cur.id);
    if (newCurrentIdx !== -1) setCurrentIdx(newCurrentIdx);

    const blockMap: Record<string, string[]> = {};
    result.exercises.forEach(e => {
      if (e.block_id) {
        if (!blockMap[e.block_id]) blockMap[e.block_id] = [];
        blockMap[e.block_id].push(e.nombre || 'Ejercicio');
      }
    });
    const audit: ExpressBlockAudit[] = Object.entries(blockMap)
      .filter(([_, names]) => names.length >= 2)
      .map(([bId, names]) => ({ block_id: bId, exercise_names: names }));

    setExpressModeActive(true);
    setExpressBlocksAudit(audit);
    setShowExpressModal(false);
  }, [exercises, currentIdx, selectedChainIds, customBlockRest, customTransitionRest]);

  const handleSwapPartnerInActiveSession = useCallback((oldPartnerId: string, newPartnerId: string) => {
    const cur = exercises[currentIdx];
    if (!cur) return;

    const fakeExercises = exercises.map(ex => ({
      id: ex.id,
      nombre: ex.nombre,
      grupo_muscular: ex.grupo,
      series: String(ex.series.length),
      block_id: ex.block_id,
      block_rest: ex.block_rest,
      transition_rest: ex.transition_rest,
      variables: {},
    }));

    const resultExercises = swapBlockPartner(fakeExercises, cur.id, oldPartnerId, newPartnerId);
    const blockTags = computeBlockTags(resultExercises);
    const reorderedMap = new Map(exercises.map(e => [e.id, e]));

    const newActiveExercises: ActiveExercise[] = resultExercises.map(item => {
      const original = reorderedMap.get(item.id)!;
      return {
        ...original,
        block_id: item.block_id,
        block_rest: item.block_rest,
        transition_rest: item.transition_rest,
        block_tag: blockTags[item.id],
      };
    });

    setExercises(newActiveExercises);
    const newCurrentIdx = newActiveExercises.findIndex(e => e.id === cur.id);
    if (newCurrentIdx !== -1) setCurrentIdx(newCurrentIdx);

    const blockMap: Record<string, string[]> = {};
    resultExercises.forEach(e => {
      if (e.block_id) {
        if (!blockMap[e.block_id]) blockMap[e.block_id] = [];
        blockMap[e.block_id].push(e.nombre || 'Ejercicio');
      }
    });
    const audit: ExpressBlockAudit[] = Object.entries(blockMap)
      .filter(([_, names]) => names.length >= 2)
      .map(([bId, names]) => ({ block_id: bId, exercise_names: names }));

    setExpressModeActive(true);
    setExpressBlocksAudit(audit);
    setShowExpressModal(false);
  }, [exercises, currentIdx]);

  const handleUngroupCurrentBlock = useCallback(() => {
    const cur = exercises[currentIdx];
    if (!cur?.block_id) return;
    const targetBlockId = cur.block_id;

    const fakeExercises = exercises.map(ex => ({
      id: ex.id,
      nombre: ex.nombre,
      grupo_muscular: ex.grupo,
      series: String(ex.series.length),
      block_id: ex.block_id,
      block_rest: ex.block_rest,
      transition_rest: ex.transition_rest,
      variables: {},
    }));

    const resultExercises = fakeExercises.map(ex => {
      if (ex.block_id === targetBlockId) {
        const { block_id: _b, block_rest: _br, transition_rest: _tr, ...rest } = ex;
        return rest as any;
      }
      return ex;
    });

    const blockTags = computeBlockTags(resultExercises);
    setExercises(prev => prev.map(ex => {
      if (ex.block_id === targetBlockId) {
        const { block_id: _b, block_rest: _br, transition_rest: _tr, block_tag: _bt, ...rest } = ex;
        return rest as ActiveExercise;
      }
      return {
        ...ex,
        block_tag: blockTags[ex.id],
      };
    }));

    setShowExpressModal(false);
  }, [exercises, currentIdx]);

  // ─── Navigation ───────────────────────────────────────────────────────────
  const currentExercise = exercises[currentIdx];
  const totalExercises = exercises.length;
  const isFirst = currentIdx === 0;
  const isLast = currentIdx === totalExercises - 1;
  const allSeriesDone = currentExercise?.series.every(s => s.done) ?? false;

  const handleNext = useCallback(() => {
    if (currentIdx < totalExercises - 1) {
      setCurrentIdx(prev => prev + 1);
      // Cancel rest timer on manual nav
      if (restIntervalRef.current) clearInterval(restIntervalRef.current);
      setRestSecondsLeft(null);
    }
  }, [currentIdx, totalExercises]);

  const handlePrev = useCallback(() => {
    if (currentIdx > 0) {
      setCurrentIdx(prev => prev - 1);
      if (restIntervalRef.current) clearInterval(restIntervalRef.current);
      setRestSecondsLeft(null);
    }
  }, [currentIdx]);

  // ─── Save session ─────────────────────────────────────────────────────────
  const handleSaveSession = useCallback(async () => {
    if (!plan) return;
    setSaving(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const currentUser = session?.user;
      if (!currentUser) throw new Error('No hay sesión activa.');

      const today = new Date();
      const fecha = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

      // Build exercises list for saving (mirrors AddSesion.handleSaveSession structure)
      const ejerciciosGuardar = exercises
        .filter(ex => ex.series.some(s => s.done))
        .map((ex, index) => {
          const isFunc = isFunctionalExercise(ex);
          const repsArray = ex.series
            .filter(s => s.done)
            .map(s => {
              const r = parseInt(String(s.reps), 10);
              return isNaN(r) || r < 1 ? ex.suggestedReps || 1 : r;
            });
          const pesoRaw = (ex.series.find(s => s.done)?.peso || '').trim().toLowerCase();
          const pesoNum = isFunc ? null : ((pesoRaw === '' || pesoRaw === 'autocarga') ? 0 : parseFloat(pesoRaw) ?? 0);
          const descansoReal = ex.descansosReales?.length
            ? Math.round(ex.descansosReales.reduce((a, b) => a + b, 0) / ex.descansosReales.length)
            : undefined;
          return {
            id_ej: 1000 + index,
            nombre: ex.nombre.trim().charAt(0).toUpperCase() + ex.nombre.trim().slice(1),
            grupo: ex.grupo,
            peso: pesoNum,
            repsArray,
            rpe: isFunc ? null : (ex.rirPercibido ?? (parseFloat(ex.targetRIR) || 2)),
            descanso: ex.descanso,
            descansoReal,
            fecha,
            notas_ej: '',
            feedback_estimulo: ex.feedback_estimulo,
            feedback_recuperacion: ex.feedback_recuperacion,
          };
        });

      // ── Offline-first: save to local cache ──
      const sesiones = readSessionsFromCache();
      const nextSesionId = sesiones.length > 0
        ? Math.max(...sesiones.map((s: any) => (typeof s.id === 'number' ? s.id : 0))) + 1
        : 1;

      const finalNotes = expressModeActive
        ? (sessionNotes ? `${sessionNotes}\n[⚡ Súper Serie]` : '[⚡ Súper Serie]')
        : sessionNotes;

      const nuevaSesion = {
        id: nextSesionId,
        fecha,
        notas_sesion: finalNotes,
        ejercicios: ejerciciosGuardar,
        express_mode: expressModeActive || undefined,
        express_blocks: expressBlocksAudit.length > 0 ? expressBlocksAudit : undefined,
      };
      sesiones.push(nuevaSesion);
      writeSessionsToCache(sesiones);

      // ── Online: sync to Supabase ──
      if (navigator.onLine) {
        const { data: histData, error: histError } = await supabase
          .from('sesiones_historial')
          .insert({
            cliente_id: currentUser.id,
            fecha,
            notas_generales: finalNotes,
            express_mode: expressModeActive || false,
            express_blocks: expressBlocksAudit.length > 0 ? expressBlocksAudit : []
          })
          .select('id')
          .single();

        if (histError) throw histError;

        const sesionId = histData.id;
        nuevaSesion.id = sesionId;

        const ejerciciosInsert = ejerciciosGuardar.map(ej => {
          const isFunc = isFunctionalExercise(ej);
          const totalReps = ej.repsArray.reduce((a, b) => a + b, 0);
          const vol = isFunc || ej.peso == null ? null : ej.peso * totalReps;
          const lastSetReps = ej.repsArray.length > 0 ? ej.repsArray[ej.repsArray.length - 1] : 0;
          const epley = isFunc || ej.peso == null ? null : ej.peso * (1 + lastSetReps / 30);
          const brzyckiDenominator = 1.0278 - 0.0278 * lastSetReps;
          const brzycki = isFunc || ej.peso == null ? null : (brzyckiDenominator > 0.01 ? ej.peso / brzyckiDenominator : ej.peso);
          const rmEst = (epley != null && brzycki != null) ? Math.round(((epley + brzycki) / 2) * 10) / 10 : null;
          return {
            sesion_id: sesionId,
            nombre_ejercicio: ej.nombre,
            grupo_muscular: ej.grupo,
            series_reps: ej.repsArray,
            peso: isFunc ? null : ej.peso,
            rpe_rir: isFunc ? null : ej.rpe,
            descanso: ej.descanso,
            volumen: vol,
            rm_estimado: rmEst,
            feedback_estimulo: ej.feedback_estimulo || null,
            feedback_recuperacion: ej.feedback_recuperacion || null,
          };
        });

        await supabase.from('sesiones_ejercicios').insert(ejerciciosInsert);
        writeSessionsToCache(sesiones);
      }

      // ── Auto-regulation ──
      if (plan.periodizationConfig?.enabled) {
        try {
          const updatedPlan = autoRegulatePlanForNextWeek(
            plan,
            ejerciciosGuardar.map(e => ({
              nombre: e.nombre,
              repsArray: e.repsArray,
              peso: e.peso,
              rir: e.rpe,
              fecha: e.fecha,
              descansoReal: e.descansoReal,
              feedback_estimulo: e.feedback_estimulo,
              feedback_recuperacion: e.feedback_recuperacion,
            }))
          );
          if (updatedPlan) {
            localStorage.setItem('pwa_client_plan', JSON.stringify(updatedPlan));
            if (navigator.onLine) {
              const { data: activePlan } = await supabase
                .from('planes')
                .select('id')
                .eq('cliente_id', currentUser.id)
                .eq('activo', true)
                .maybeSingle();
              if (activePlan) {
                await supabase.from('planes').update({ datos_plan: updatedPlan }).eq('id', activePlan.id);
              }
            }
          }
        } catch (ePeriod) {
          console.error('Error en auto-regulación:', ePeriod);
        }
      }

      // ── Navigate to summary screen ──
      navigate('/session/complete', {
        state: {
          exercises: exercises
            .filter(ex => ex.series.some(s => s.done))
            .map(ex => ({
              nombre:                ex.nombre,
              grupo:                 ex.grupo,
              series:                ex.series
                                       .filter(s => s.done)
                                       .map(s => ({
                                         reps: s.reps,
                                         // Strip robot emoji from ghost values before passing
                                         peso: s.peso.replace(/^🤖\s*/, '').trim(),
                                       })),
              feedback_estimulo:     ex.feedback_estimulo,
              feedback_recuperacion: ex.feedback_recuperacion,
              targetRIR:             ex.targetRIR,
            })),
          fecha,
          savedOnline: navigator.onLine,
        },
      });
    } catch (err: any) {
      console.error('Error al guardar sesión:', err);
      alert('Error al guardar: ' + err.message);
    } finally {
      setSaving(false);
    }
  }, [plan, exercises, sessionNotes, expressModeActive, expressBlocksAudit, navigate]);

  // ─── Guard: no plan or exercises ──────────────────────────────────────────
  if (!plan || exercises.length === 0) {
    return (
      <div style={{
        minHeight: '100vh', background: '#0b0f19', display: 'flex',
        alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '16px'
      }}>
        <div style={{ fontSize: '32px' }}>🏋️</div>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px' }}>Cargando sesión...</p>
        <button
          onClick={() => navigate('/dashboard')}
          style={{
            background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: '10px', color: 'rgba(255,255,255,0.6)', padding: '10px 20px',
            fontSize: '12px', cursor: 'pointer'
          }}
        >
          ← Volver al Dashboard
        </button>
      </div>
    );
  }

  const restPct = restSecondsLeft != null && currentExercise
    ? (restSecondsLeft / currentExercise.descanso) * 100
    : 0;

  return (
    <div className="active-session-root">
      {/* ── Exit Confirm Overlay ── */}
      {showExitConfirm && (
        <div className="active-session-overlay">
          <div className="active-session-exit-card">
            <div style={{ fontSize: '28px', marginBottom: '8px' }}>⚠️</div>
            <h3 style={{ margin: '0 0 8px', fontSize: '16px', color: 'white' }}>
              ¿Salir de la sesión?
            </h3>
            <p style={{ margin: '0 0 20px', fontSize: '13px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.5 }}>
              El progreso no guardado se perderá.
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                className="active-session-btn-secondary"
                onClick={() => setShowExitConfirm(false)}
              >
                Continuar
              </button>
              <button
                className="active-session-btn-danger"
                onClick={() => navigate('/dashboard')}
              >
                Salir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Top Bar ── */}
      <div className="active-session-topbar">
        <button
          className="active-session-exit-btn"
          onClick={() => setShowExitConfirm(true)}
          aria-label="Salir de la sesión"
        >
          ← Salir
        </button>
        <div className="active-session-progress-text">
          {currentIdx + 1} / {totalExercises} ejercicios
        </div>
        <button
          type="button"
          onClick={() => setShowExpressModal(true)}
          style={{
            background: expressModeActive ? 'rgba(251, 191, 36, 0.2)' : 'rgba(255, 255, 255, 0.06)',
            border: `1px solid ${expressModeActive ? '#f59e0b' : 'rgba(255, 255, 255, 0.15)'}`,
            color: expressModeActive ? '#fbbf24' : 'rgba(255, 255, 255, 0.7)',
            borderRadius: '8px',
            padding: '4px 10px',
            fontSize: '11px',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            transition: 'all 0.2s',
          }}
          title="Entrenar en Súper Serie (Agrupar ejercicios para alternar series)"
        >
          <span>⚡</span> {expressModeActive ? 'Súper Serie Activa' : 'Entrenar en Súper Serie'}
        </button>
        {/* Progress bar */}
        <div className="active-session-progress-bar-track">
          <div
            className="active-session-progress-bar-fill"
            style={{ width: `${((currentIdx + 1) / totalExercises) * 100}%` }}
          />
        </div>
      </div>

      {/* ── Contenido del ejercicio actual: si algo rompe acá (datos raros de
           un ejercicio puntual), la topbar y la navegación de abajo siguen
           funcionando — el atleta puede saltar al siguiente ejercicio en
           vez de quedar bloqueado a mitad de un entrenamiento. ── */}
      <ErrorBoundary
        label="Ejercicio actual"
        fallback={(_error, reset) => (
          <div className="active-session-exercise-header" role="alert" style={{ textAlign: 'center', padding: '30px 16px' }}>
            <div style={{ fontSize: '28px', marginBottom: '8px' }}>⚠️</div>
            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px', marginBottom: '16px' }}>
              No se pudo mostrar este ejercicio. Tu progreso hasta ahora está guardado.
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button className="active-session-btn-secondary" onClick={reset}>Reintentar</button>
              {currentIdx < totalExercises - 1 && (
                <button className="active-session-nav-btn primary" onClick={() => { reset(); setCurrentIdx(i => i + 1); }}>
                  Saltar al siguiente →
                </button>
              )}
            </div>
          </div>
        )}
      >
      {/* ── Exercise Name ── */}
      <div className="active-session-exercise-header">
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '6px' }}>
          {currentExercise.isFunctional && (
            <span style={{ fontSize: '10px', color: '#60a5fa', background: 'rgba(59, 130, 246, 0.15)', border: '1px solid rgba(59, 130, 246, 0.35)', padding: '2px 10px', borderRadius: '6px', fontFamily: "'Orbitron', sans-serif", fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              ⚡ EJERCICIO FUNCIONAL / WOD
            </span>
          )}
          {currentExercise.block_tag && (
            <button
              type="button"
              onClick={() => setShowExpressModal(true)}
              style={{
                fontSize: '11px',
                color: '#f59e0b',
                background: 'rgba(245, 158, 11, 0.15)',
                border: '1px solid rgba(245, 158, 11, 0.4)',
                padding: '2px 10px',
                borderRadius: '6px',
                fontWeight: 800,
                fontFamily: "'Orbitron', sans-serif",
                letterSpacing: '0.5px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                cursor: 'pointer'
              }}
              title="Gestionar Bi-serie / Cambiar Compañero"
            >
              ⚡ {currentExercise.block_tag}
            </button>
          )}
        </div>
        <h1 className="active-session-exercise-name">
          {currentExercise.nombre}
        </h1>
        {currentExercise.grupo && (
          <span className="active-session-exercise-group">{currentExercise.grupo}</span>
        )}
        <div className="active-session-exercise-meta">
          {currentExercise.series.length} {currentExercise.isFunctional ? 'rondas / bloques' : 'series'}
          {currentExercise.suggestedReps > 0 && ` · ${currentExercise.suggestedReps} ${currentExercise.isFunctional ? 'trabajo / reps' : 'reps objetivo'}`}
          {currentExercise.targetRIR && ` · ${currentExercise.isFunctional ? 'RPE' : 'RIR'} ${currentExercise.targetRIR}`}
          {currentExercise.block_id && (
            <span style={{ color: '#fbbf24', marginLeft: '6px' }}>
              · Transición: {currentExercise.transition_rest ?? 10}s · Ronda: {currentExercise.block_rest ?? 90}s
            </span>
          )}
        </div>
      </div>

      {/* ── Series Table ── */}
      <div className="active-session-series-container">
        {/* Header row */}
        <div className="active-session-series-header">
          <span className="active-session-col-label">{currentExercise.isFunctional ? 'Ronda' : 'Serie'}</span>
          <span className="active-session-col-label">{currentExercise.isFunctional ? 'Carga (opc)' : 'Peso (kg)'}</span>
          <span className="active-session-col-label">{currentExercise.isFunctional ? 'Trabajo / Reps' : 'Reps'}</span>
          <span className="active-session-col-label">✓</span>
        </div>

        {currentExercise.series.map((s, sIdx) => (
          <div
            key={sIdx}
            className={`active-session-series-row${s.done ? ' done' : ''}`}
          >
            {/* Series number */}
            <span className="active-session-series-num">{sIdx + 1}</span>

            {/* Peso input */}
            <input
              type="text"
              inputMode="decimal"
              className={`active-session-input${s.done ? ' done' : ''}`}
              value={s.peso}
              placeholder={currentExercise.suggestedPeso || '—'}
              onChange={e => handleSeriesFieldChange(currentIdx, sIdx, 'peso', e.target.value)}
              disabled={s.done}
              aria-label={`Peso serie ${sIdx + 1}`}
            />

            {/* Reps input with +/- buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '3px', width: '100%', justifyContent: 'center' }}>
              <button
                type="button"
                onClick={() => {
                  const currentVal = parseInt(String(s.reps), 10) || currentExercise.suggestedReps || 10;
                  handleSeriesFieldChange(currentIdx, sIdx, 'reps', String(Math.max(1, currentVal - 1)));
                }}
                disabled={s.done}
                style={{
                  width: '24px',
                  height: '38px',
                  borderRadius: '8px',
                  border: '1px solid rgba(255,255,255,0.08)',
                  background: 'rgba(255,255,255,0.04)',
                  color: 'white',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 'bold',
                  fontSize: '14px',
                  transition: 'all 0.15s ease',
                  flexShrink: 0
                }}
              >
                −
              </button>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                className={`active-session-input${s.done ? ' done' : ''}`}
                value={s.reps === undefined || s.reps === null || s.reps === '' ? '' : s.reps}
                placeholder={String(currentExercise.suggestedReps || '—')}
                onChange={e => handleSeriesFieldChange(currentIdx, sIdx, 'reps', e.target.value)}
                disabled={s.done}
                style={{
                  flex: 1,
                  minWidth: '20px',
                  padding: '10px 2px',
                  fontSize: '13px',
                  height: '38px',
                  boxSizing: 'border-box'
                }}
                aria-label={`Reps serie ${sIdx + 1}`}
              />
              <button
                type="button"
                onClick={() => {
                  const currentVal = parseInt(String(s.reps), 10) || currentExercise.suggestedReps || 10;
                  handleSeriesFieldChange(currentIdx, sIdx, 'reps', String(Math.min(100, currentVal + 1)));
                }}
                disabled={s.done}
                style={{
                  width: '24px',
                  height: '38px',
                  borderRadius: '8px',
                  border: '1px solid rgba(255,255,255,0.08)',
                  background: 'rgba(255,255,255,0.04)',
                  color: 'white',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 'bold',
                  fontSize: '14px',
                  transition: 'all 0.15s ease',
                  flexShrink: 0
                }}
              >
                +
              </button>
            </div>

            {/* Done button */}
            <button
              className={`active-session-check-btn${s.done ? ' done' : ''}`}
              onClick={() => handleSeriesDone(currentIdx, sIdx)}
              disabled={saving}
              aria-label={s.done ? `Desmarcar serie ${sIdx + 1}` : `Marcar serie ${sIdx + 1} como completada`}
            >
              {s.done ? '✓' : '○'}
            </button>
          </div>
        ))}

        {/* ── Exercise Guide & Info ── */}
        {(currentExercise.image_url || currentExercise.gif_url || currentExercise.video_url || currentExercise.description) && (
          <div className="active-session-guide-card">
            <div className="active-session-guide-content">
              {/* Left side: Image thumbnail */}
              {(currentExercise.image_url || currentExercise.gif_url) && (
                <button
                  type="button"
                  className="active-session-guide-thumbnail-container"
                  onClick={() => {
                    setActiveMediaType('image');
                    setShowFullImage(true);
                  }}
                  aria-label={`Ver imagen completa de ${currentExercise.nombre}`}
                  style={{ padding: 0 }}
                >
                  <img
                    src={currentExercise.image_url || currentExercise.gif_url || ''}
                    alt={currentExercise.nombre}
                    className="active-session-guide-thumbnail"
                  />
                  <span className="active-session-guide-zoom-badge">🔍</span>
                </button>
              )}
              
              {/* Right side: Actions & Video/Guide buttons */}
              <div className="active-session-guide-details">
                <span className="active-session-guide-title">Guía de ejecución</span>
                
                <div className="active-session-guide-actions">
                  {currentExercise.gif_url && (
                    <button
                      type="button"
                      className="active-session-guide-btn"
                      onClick={() => {
                        setActiveMediaType('gif');
                        setShowFullImage(true);
                      }}
                      style={{
                        background: 'rgba(0, 212, 255, 0.1)',
                        border: '1px solid rgba(0, 212, 255, 0.25)',
                        color: 'var(--theme-primary)'
                      }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '4px' }}>
                        <polygon points="5 3 19 12 5 21 5 3"></polygon>
                      </svg>
                      Ver GIF
                    </button>
                  )}

                  {currentExercise.video_url && (
                    <a
                      href={currentExercise.video_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="active-session-guide-video-link"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M23 7l-7 5 7 5V7z" />
                        <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                      </svg>
                      Ver Video
                    </a>
                  )}
                  
                  {currentExercise.description && (
                    <button
                      className="active-session-guide-btn"
                      onClick={() => setShowGuideModal(true)}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                      </svg>
                      Guía Teórica
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Rest Timer ── */}
      {restSecondsLeft !== null && (
        <div className="active-session-rest-timer">
          <div className="active-session-rest-track">
            <div
              className="active-session-rest-fill"
              style={{ width: `${restPct}%` }}
            />
          </div>
          <span className="active-session-rest-label">
            ⏱ Descanso: {Math.floor(restSecondsLeft / 60)}:{String(restSecondsLeft % 60).padStart(2, '0')}
          </span>
          <button
            className="active-session-rest-skip"
            onClick={() => {
              if (restIntervalRef.current) clearInterval(restIntervalRef.current);
              setRestSecondsLeft(null);
            }}
          >
            Saltar
          </button>
        </div>
      )}

      {/* ── Feedback (shown when all series are done) ── */}
      {allSeriesDone && (
        <div className="active-session-feedback" style={{ position: 'relative' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <p className="active-session-feedback-title" style={{ margin: 0 }}>¿Cómo fue este ejercicio?</p>
            <button
              onClick={() => setShowFeedbackGuide(!showFeedbackGuide)}
              style={{
                background: showFeedbackGuide ? 'rgba(0, 242, 254, 0.15)' : 'rgba(255,255,255,0.05)',
                border: `1px solid ${showFeedbackGuide ? 'rgba(0, 242, 254, 0.4)' : 'rgba(255,255,255,0.1)'}`,
                color: showFeedbackGuide ? '#00f2fe' : 'rgba(255,255,255,0.5)',
                borderRadius: '6px', padding: '3px 8px', fontSize: '10px', fontWeight: 600, cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: '4px', transition: 'all 0.2s'
              }}
            >
              <span>ℹ️</span> {showFeedbackGuide ? 'Ocultar Guía' : 'Guía de Feedback'}
            </button>
          </div>

          {/* Feedback Explanatory Guide Box */}
          {showFeedbackGuide && (
            <div style={{
              background: 'rgba(5, 8, 16, 0.95)', border: '1px solid rgba(0, 242, 254, 0.25)',
              borderRadius: '10px', padding: '12px', marginBottom: '14px', textAlign: 'left',
              fontSize: '11px', lineHeight: 1.45, color: '#e2e8f0', boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
              fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
            }}>
              <strong style={{ color: '#00f2fe', display: 'block', marginBottom: '6px', fontSize: '12px' }}>
                ¿Cómo responder según la ciencia de Evolution Lab?
              </strong>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div>
                  <span style={{ color: '#a5b4fc', fontWeight: 'bold' }}>Estímulo (Volumen & Congestión):</span>
                  <ul style={{ margin: '4px 0 0 12px', padding: 0, color: 'rgba(255,255,255,0.75)' }}>
                    <li><strong style={{ color: '#fff' }}>😐 Ninguno:</strong> No sentiste bombeo (pump) ni fatiga local en el músculo objetivo.</li>
                    <li><strong style={{ color: '#fff' }}>💪 Bueno:</strong> Sentiste una congestión retadora y fatiga en el músculo que querías trabajar.</li>
                    <li><strong style={{ color: '#fff' }}>🔥 Extremo:</strong> Fatiga local extrema o quemazón que limitó notablemente tus últimas series.</li>
                  </ul>
                </div>
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '6px' }}>
                  <span style={{ color: '#a5b4fc', fontWeight: 'bold' }}>Recuperación (Al llegar hoy):</span>
                  <p style={{ margin: '4px 0', fontSize: '10.5px', color: 'rgba(255,255,255,0.5)' }}>
                    Evalúa cómo se sentía el músculo objetivo <strong>antes de iniciar la primera serie hoy</strong> (para aislarlo de la fatiga que sientes justo ahora al terminar). <em>(Nota: Si es tu primera sesión o vienes de un descanso, marca "Llegué Recuperado")</em>.
                  </p>
                  <ul style={{ margin: '4px 0 0 12px', padding: 0, color: 'rgba(255,255,255,0.75)' }}>
                    <li><strong style={{ color: '#fff' }}>✅ Llegué Recuperado:</strong> Te sentías fuerte, sin agujetas ni molestia residual en ese músculo al empezar.</li>
                    <li><strong style={{ color: '#fff' }}>⚡ Llegué Justo:</strong> El músculo se recuperó justo a tiempo para hoy, pero estuvo tenso o cansado hasta hace poco.</li>
                    <li><strong style={{ color: '#fff' }}>😫 Llegué Agotado:</strong> Tenías agujetas o una fatiga acumulada notable que afectó tu fuerza al iniciar.</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {!currentExercise.isFunctional && (
            <div className="active-session-feedback-row">
              <span className="active-session-feedback-label">RIR (Serie exigente)</span>
              <div className="active-session-feedback-options">
                {([0, 1, 2, 3, 4] as const).map(val => {
                  const label = val === 0 ? '0 (Fallo)' : val === 4 ? '4+' : `${val}`;
                  const isSelected = (currentExercise.rirPercibido ?? 2) === val;
                  return (
                    <button
                      key={val}
                      type="button"
                      className={`active-session-feedback-btn${isSelected ? ' selected' : ''}`}
                      onClick={() => {
                        setExercises(prev => {
                          const copy = [...prev];
                          copy[currentIdx] = { ...copy[currentIdx], rirPercibido: val };
                          return copy;
                        });
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="active-session-feedback-row">
            <span className="active-session-feedback-label">Estímulo</span>
            <div className="active-session-feedback-options">
              {(['none', 'good', 'extreme'] as const).map(opt => (
                <button
                  key={opt}
                  className={`active-session-feedback-btn${currentExercise.feedback_estimulo === opt ? ' selected' : ''}`}
                  onClick={() => handleFeedbackChange(currentIdx, 'feedback_estimulo', opt)}
                >
                  {opt === 'none' ? '😐 Ninguno' : opt === 'good' ? '💪 Bueno' : '🔥 Extremo'}
                </button>
              ))}
            </div>
          </div>
          <div className="active-session-feedback-row">
            <span className="active-session-feedback-label">Recuperación (Al llegar)</span>
            <div className="active-session-feedback-options">
              {(['recovered', 'just_in_time', 'sore'] as const).map(opt => (
                <button
                  key={opt}
                  className={`active-session-feedback-btn${currentExercise.feedback_recuperacion === opt ? ' selected' : ''}`}
                  onClick={() => handleFeedbackChange(currentIdx, 'feedback_recuperacion', opt)}
                >
                  {opt === 'recovered' ? '✅ Llegué Recuperado' : opt === 'just_in_time' ? '⚡ Llegué Justo' : '😫 Llegué Agotado'}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      </ErrorBoundary>

      {/* ── Bottom Navigation ── */}
      <div className="active-session-bottom-nav">
        <button
          className="active-session-nav-btn"
          onClick={handlePrev}
          disabled={isFirst}
          aria-label="Ejercicio anterior"
        >
          ← Anterior
        </button>

        {isLast ? (
          <button
            className="active-session-finish-btn"
            onClick={handleSaveSession}
            disabled={saving}
          >
            {saving ? 'Guardando...' : '✅ Finalizar sesión'}
          </button>
        ) : (
          <button
            className="active-session-nav-btn primary"
            onClick={handleNext}
            aria-label="Siguiente ejercicio"
          >
            Siguiente →
          </button>
        )}
      </div>

      {/* ── Session Notes (inline, bottom) ── */}
      {isLast && (
        <div className="active-session-notes">
          <label style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', fontWeight: 700, display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Nota de sesión (opcional)
          </label>
          <textarea
            className="active-session-notes-input"
            value={sessionNotes}
            onChange={e => setSessionNotes(e.target.value)}
            placeholder="¿Cómo te sentiste hoy? Lesiones, motivación, sueño..."
            rows={2}
          />
        </div>
      )}

      {/* ── Full Screen Image Modal ── */}
      {showFullImage && (currentExercise.image_url || currentExercise.gif_url) && (
        // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- backdrop de modal: cierra al hacer click afuera (conveniencia de mouse); el diálogo de abajo ya tiene cierre con Escape y foco atrapado vía useModalA11y
        <div className="active-session-image-overlay" onClick={() => setShowFullImage(false)}>
          {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events -- ya tiene role="dialog" + Escape/foco atrapado vía useModalA11y; este onClick solo evita que el click se propague al backdrop */}
          <div
            ref={fullImageDialogRef}
            className="active-session-image-modal-content"
            role="dialog"
            aria-modal="true"
            aria-label={currentExercise.nombre}
            tabIndex={-1}
            onClick={e => e.stopPropagation()}
          >
            <button
              type="button"
              className="active-session-image-close"
              onClick={() => setShowFullImage(false)}
              aria-label="Cerrar vista previa"
            >
              ✕
            </button>
            
            {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions -- marco contenedor de proteccion contra clic derecho */}
            <div className="active-session-image-frame" onContextMenu={(e) => e.preventDefault()} onDragStart={(e) => e.preventDefault()} style={{ position: 'relative' }}>
              <img
                src={activeMediaType === 'image' ? (currentExercise.image_url || currentExercise.gif_url) : (currentExercise.gif_url || currentExercise.image_url)}
                alt={currentExercise.nombre}
                className="active-session-image-large protected-media"
                style={{ pointerEvents: 'none', userSelect: 'none' }}
              />
              {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions -- capa transparente de proteccion contra clic derecho */}
              <div className="media-protection-overlay" onContextMenu={(e) => e.preventDefault()} onDragStart={(e) => e.preventDefault()} />
            </div>

            <div className="active-session-image-footer">
              <p className="active-session-image-caption">{currentExercise.nombre}</p>
              {currentExercise.image_url && currentExercise.gif_url && (
                <button
                  type="button"
                  className="active-session-image-toggle-btn"
                  onClick={() => setActiveMediaType(prev => prev === 'image' ? 'gif' : 'image')}
                >
                  {activeMediaType === 'image' ? '🎬 Ver GIF' : '🖼️ Ver Foto'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Execution Guide Modal Overlay ── */}
      {showGuideModal && currentExercise.description && (
        // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- backdrop de modal: cierra al hacer click afuera (conveniencia de mouse); el diálogo de abajo ya tiene cierre con Escape y foco atrapado vía useModalA11y
        <div className="active-session-modal-overlay" onClick={() => setShowGuideModal(false)}>
          {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events -- ya tiene role="dialog" + Escape/foco atrapado vía useModalA11y; este onClick solo evita que el click se propague al backdrop */}
          <div
            ref={guideDialogRef}
            className="active-session-guide-modal-box"
            role="dialog"
            aria-modal="true"
            aria-labelledby="active-session-guide-modal-title"
            tabIndex={-1}
            onClick={e => e.stopPropagation()}
          >
            <div className="active-session-guide-modal-header">
              <h3 className="active-session-guide-modal-title" id="active-session-guide-modal-title">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px', verticalAlign: '-1px' }}>
                  <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                  <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                </svg>
                Guía de Ejecución
              </h3>
              <button className="active-session-guide-modal-close" onClick={() => setShowGuideModal(false)}>&times;</button>
            </div>
            
            <h4 className="active-session-guide-modal-exercise-name">{currentExercise.nombre}</h4>
            
            <div className="active-session-guide-modal-body">
              {currentExercise.description}
            </div>
            
            <div className="active-session-guide-modal-footer">
              <button className="active-session-guide-modal-btn-confirm" onClick={() => setShowGuideModal(false)}>
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modo Express Modal Overlay ── */}
      {showExpressModal && (() => {
        const currentInBlock = !!currentExercise?.block_id;
        const currentBlockPartners = exercises.filter(e => e.block_id === currentExercise?.block_id && e.id !== currentExercise?.id);
        const outsideExercises = exercises.filter(
          e => e.block_id !== currentExercise?.block_id && !isExerciseFinished(e)
        );
        const candidateExercises = exercises.filter(
          ex => ex.id === currentExercise?.id || !isExerciseFinished(ex)
        );
        const hasAnyBlock = expressModeActive || exercises.some(e => e.block_id);

        return (
          // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
          <div className="active-session-modal-overlay" onClick={() => setShowExpressModal(false)}>
            {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events */}
            <div
              ref={expressDialogRef}
              className="active-session-guide-modal-box"
              role="dialog"
              aria-modal="true"
              aria-labelledby="active-session-express-modal-title"
              tabIndex={-1}
              onClick={e => e.stopPropagation()}
              style={{ maxWidth: '480px', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}
            >
              <div className="active-session-guide-modal-header">
                <h3 className="active-session-guide-modal-title" id="active-session-express-modal-title" style={{ color: '#fbbf24' }}>
                  <span style={{ marginRight: '8px' }}>⚡</span>
                  Entrenar en Súper Serie
                </h3>
                <button className="active-session-guide-modal-close" onClick={() => setShowExpressModal(false)}>&times;</button>
              </div>

              <div className="active-session-guide-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px', overflowY: 'auto', paddingRight: '4px' }}>
                {/* 1. Contextual Block Actions for Current Exercise */}
                {currentInBlock && (
                  <div style={{ background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '12px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ fontWeight: 700, fontSize: '13px', color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>🔄</span> ¿Máquina Ocupada? Cambiar Compañero
                    </div>
                    <p style={{ margin: 0, fontSize: '11.5px', color: 'rgba(255,255,255,0.7)', lineHeight: 1.4 }}>
                      Estás entrenando <strong>{currentExercise.nombre}</strong> ({currentExercise.block_tag}) junto a: <em>{currentBlockPartners.map(p => p.nombre).join(', ') || 'compañero'}</em>.
                    </p>
                    {(() => {
                      const effectivePartnerId =
                        (selectedSwapPartnerId && currentBlockPartners.some(p => p.id === selectedSwapPartnerId))
                          ? selectedSwapPartnerId
                          : currentBlockPartners[0]?.id ?? null;

                      return currentBlockPartners.length > 1 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>
                            ¿A cuál compañero reemplazas?
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            {currentBlockPartners.map(p => {
                              const isSelected = p.id === effectivePartnerId;
                              return (
                                <button
                                  key={p.id}
                                  type="button"
                                  onClick={() => setSelectedSwapPartnerId(p.id)}
                                  style={{
                                    padding: '5px 10px',
                                    borderRadius: '999px',
                                    fontSize: '11px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    border: isSelected ? '1px solid #fbbf24' : '1px solid rgba(255,255,255,0.15)',
                                    background: isSelected ? 'rgba(245, 158, 11, 0.18)' : 'rgba(255,255,255,0.04)',
                                    color: isSelected ? '#fbbf24' : 'rgba(255,255,255,0.75)',
                                  }}
                                >
                                  {p.block_tag ? `${p.block_tag} · ` : ''}{p.nombre}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ) : null;
                    })()}
                    {outsideExercises.length > 0 && (() => {
                      const effectivePartnerId =
                        (selectedSwapPartnerId && currentBlockPartners.some(p => p.id === selectedSwapPartnerId))
                          ? selectedSwapPartnerId
                          : currentBlockPartners[0]?.id ?? null;
                      const effectivePartner = currentBlockPartners.find(p => p.id === effectivePartnerId);
                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
                          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>
                            Sustituir por otra máquina / ejercicio disponible:
                          </div>
                          <div style={{ maxHeight: '130px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {outsideExercises.map(otherEx => (
                              <button
                                key={otherEx.id}
                                type="button"
                                onClick={() => {
                                  if (effectivePartnerId) {
                                    handleSwapPartnerInActiveSession(effectivePartnerId, otherEx.id);
                                  }
                                }}
                                style={{
                                  background: 'rgba(255,255,255,0.04)',
                                  border: '1px solid rgba(255,255,255,0.1)',
                                  borderRadius: '8px',
                                  padding: '8px 10px',
                                  textAlign: 'left',
                                  cursor: 'pointer',
                                  color: 'white',
                                  transition: 'all 0.15s ease',
                                }}
                                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(245, 158, 11, 0.15)')}
                                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
                              >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <span style={{ fontWeight: 600, fontSize: '12px' }}>{otherEx.nombre}</span>
                                  <span style={{ fontSize: '9px', color: '#60a5fa', background: 'rgba(59, 130, 246, 0.15)', padding: '1px 6px', borderRadius: '4px', textTransform: 'uppercase' }}>
                                    {otherEx.grupo || 'General'}
                                  </span>
                                </div>
                                <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', marginTop: '2px' }}>
                                  ⇄ Intercambiar por {effectivePartner?.nombre || 'compañero'}
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })()}
                    <button
                      type="button"
                      onClick={handleUngroupCurrentBlock}
                      style={{
                        background: 'transparent',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        borderRadius: '8px',
                        padding: '6px 10px',
                        color: '#f87171',
                        fontSize: '11px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        marginTop: '4px',
                        textAlign: 'center',
                      }}
                    >
                      ✕ Desvincular este bloque (Volver a series individuales)
                    </button>
                  </div>
                )}

                {/* 2. Custom Súper Serie Builder (Selección flexible de 2, 3, 4, 5... ejercicios) */}
                <div style={{ background: 'rgba(0, 212, 255, 0.06)', border: '1px solid rgba(0, 212, 255, 0.25)', borderRadius: '12px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ fontWeight: 700, fontSize: '13px', color: '#38bdf8', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>🔗</span> Encadenar en Súper Serie
                    </span>
                    <span style={{ fontSize: '10px', color: selectedChainIds.length >= 2 ? '#34d399' : '#fbbf24', background: 'rgba(0,0,0,0.35)', padding: '2px 8px', borderRadius: '6px', fontFamily: "'Orbitron', sans-serif" }}>
                      {selectedChainIds.length} {selectedChainIds.length === 1 ? 'ejercicio' : 'ejercicios'}
                      {selectedChainIds.length === 2 ? ' (Súper Serie)' : selectedChainIds.length === 3 ? ' (Tri-serie)' : selectedChainIds.length >= 4 ? ' (Circuito)' : ''}
                    </span>
                  </div>

                  <p style={{ margin: 0, fontSize: '11.5px', color: 'rgba(255,255,255,0.7)', lineHeight: 1.4 }}>
                    Marca los ejercicios del día que deseas alternar de forma continua (puedes encadenar 2, 3, 4 o los que necesites):
                  </p>

                  {candidateExercises.length < 2 && (
                    <div style={{ fontSize: '11px', color: '#fbbf24', background: 'rgba(245, 158, 11, 0.12)', border: '1px solid rgba(245, 158, 11, 0.25)', padding: '8px 10px', borderRadius: '6px' }}>
                      ℹ️ No hay otros ejercicios pendientes en esta sesión para formar una Súper Serie (los demás ejercicios ya están 100% completados).
                    </div>
                  )}

                  <div style={{ maxHeight: '180px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px', paddingRight: '2px' }}>
                    {candidateExercises.map(ex => {
                      const isSelected = selectedChainIds.includes(ex.id);
                      const isCurrent = ex.id === currentExercise.id;
                      return (
                        <label
                          key={ex.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            background: isSelected ? 'rgba(0, 212, 255, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                            border: `1px solid ${isSelected ? 'rgba(0, 212, 255, 0.4)' : 'rgba(255, 255, 255, 0.08)'}`,
                            borderRadius: '8px',
                            padding: '8px 10px',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {
                              setSelectedChainIds(prev =>
                                prev.includes(ex.id) ? prev.filter(id => id !== ex.id) : [...prev, ex.id]
                              );
                            }}
                            style={{ width: '16px', height: '16px', accentColor: '#00d4ff', cursor: 'pointer' }}
                          />
                          <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              <span style={{ fontWeight: 600, fontSize: '12px', color: isSelected ? 'white' : 'rgba(255,255,255,0.75)' }}>
                                {ex.nombre}
                              </span>
                              {isCurrent && (
                                <span style={{ marginLeft: '6px', fontSize: '9px', color: '#fbbf24', background: 'rgba(245, 158, 11, 0.15)', padding: '1px 5px', borderRadius: '4px', fontWeight: 700 }}>
                                  ACTUAL
                                </span>
                              )}
                              {ex.block_tag && (
                                <span style={{ marginLeft: '6px', fontSize: '9px', color: '#00d4ff', background: 'rgba(0, 212, 255, 0.15)', padding: '1px 5px', borderRadius: '4px', fontWeight: 700 }}>
                                  ⚡ {ex.block_tag}
                                </span>
                              )}
                            </div>
                            <span style={{ fontSize: '9px', color: '#60a5fa', background: 'rgba(59, 130, 246, 0.15)', padding: '1px 6px', borderRadius: '4px', textTransform: 'uppercase' }}>
                              {ex.grupo || 'General'}
                            </span>
                          </div>
                        </label>
                      );
                    })}
                  </div>

                  {/* Configuración de descansos para la Súper Serie */}
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', background: 'rgba(0,0,0,0.25)', padding: '8px 12px', borderRadius: '8px' }}>
                    <label style={{ fontSize: '11px', color: 'rgba(255,255,255,0.75)', display: 'flex', alignItems: 'center', gap: '6px', flex: 1, minWidth: '130px' }}>
                      ⚡ Transición:
                      <input
                        type="number"
                        min={0}
                        max={120}
                        value={customTransitionRest}
                        onChange={e => setCustomTransitionRest(Math.max(0, parseInt(e.target.value, 10) || 0))}
                        style={{ width: '50px', padding: '3px 6px', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(0,212,255,0.3)', borderRadius: '6px', color: '#38bdf8', fontWeight: 700, textAlign: 'center' }}
                      />
                      s
                    </label>
                    <label style={{ fontSize: '11px', color: 'rgba(255,255,255,0.75)', display: 'flex', alignItems: 'center', gap: '6px', flex: 1, minWidth: '130px' }}>
                      ⏱️ Descanso ronda:
                      <input
                        type="number"
                        min={0}
                        max={300}
                        value={customBlockRest}
                        onChange={e => setCustomBlockRest(Math.max(0, parseInt(e.target.value, 10) || 0))}
                        style={{ width: '55px', padding: '3px 6px', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(0,212,255,0.3)', borderRadius: '6px', color: '#38bdf8', fontWeight: 700, textAlign: 'center' }}
                      />
                      s
                    </label>
                  </div>

                  {/* Botón de acción para encadenar los seleccionados */}
                  <button
                    type="button"
                    onClick={handleChainSelectedExercises}
                    disabled={selectedChainIds.length < 2}
                    style={{
                      background: selectedChainIds.length >= 2 ? 'var(--theme-btn-gradient)' : 'rgba(255, 255, 255, 0.06)',
                      border: 'none',
                      color: selectedChainIds.length >= 2 ? 'white' : 'rgba(255, 255, 255, 0.35)',
                      borderRadius: '8px',
                      padding: '10px 14px',
                      fontSize: '12px',
                      fontFamily: "'Orbitron', sans-serif",
                      fontWeight: 700,
                      cursor: selectedChainIds.length >= 2 ? 'pointer' : 'not-allowed',
                      boxShadow: selectedChainIds.length >= 2 ? '0 0 12px var(--theme-btn-glow)' : 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      transition: 'all 0.2s'
                    }}
                  >
                    <span>⚡</span>
                    {selectedChainIds.length < 2
                      ? 'Selecciona al menos 2 ejercicios'
                      : `Encadenar ${selectedChainIds.length} Ejercicios en Súper Serie`}
                  </button>
                </div>

                {/* 3. Mass Quick Actions */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '2px' }}>
                  <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>
                    Acciones rápidas para toda la sesión:
                  </div>

                  <button
                    type="button"
                    onClick={() => handleApplyExpressMode('supersets')}
                    style={{
                      background: 'rgba(245, 158, 11, 0.12)',
                      border: '1px solid rgba(245, 158, 11, 0.4)',
                      borderRadius: '10px',
                      padding: '10px 12px',
                      textAlign: 'left',
                      cursor: 'pointer',
                      color: 'white',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: '12.5px', color: '#fbbf24', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>⚡</span> Súper Series automáticas por parejas (Toda la sesión)
                    </div>
                    <div style={{ fontSize: '10.5px', color: 'rgba(255,255,255,0.65)', lineHeight: 1.3 }}>
                      Agrupa todos los ejercicios de 2 en 2 (A1+A2, B1+B2) con descanso de 10s y 90s de ronda.
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleApplyExpressMode('circuit')}
                    style={{
                      background: 'rgba(59, 130, 246, 0.12)',
                      border: '1px solid rgba(59, 130, 246, 0.4)',
                      borderRadius: '10px',
                      padding: '10px 12px',
                      textAlign: 'left',
                      cursor: 'pointer',
                      color: 'white',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: '12.5px', color: '#60a5fa', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>🔄</span> Circuito Completo (Todos en 1 bloque)
                    </div>
                    <div style={{ fontSize: '10.5px', color: 'rgba(255,255,255,0.65)', lineHeight: 1.3 }}>
                      Agrupa todos los ejercicios en un solo circuito continuo con descanso de 10s y 120s de vuelta.
                    </div>
                  </button>

                  {hasAnyBlock && (
                    <button
                      type="button"
                      onClick={() => handleApplyExpressMode('reset')}
                      style={{
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        borderRadius: '10px',
                        padding: '9px 12px',
                        textAlign: 'left',
                        cursor: 'pointer',
                        color: '#f87171',
                        fontSize: '11.5px',
                        fontWeight: 600,
                      }}
                    >
                      ↩️ Desactivar todas las Súper Series (Volver a series individuales)
                    </button>
                  )}
                </div>
              </div>

              <div className="active-session-guide-modal-footer">
                <button className="active-session-btn-secondary" onClick={() => setShowExpressModal(false)}>
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default ActiveSession;
