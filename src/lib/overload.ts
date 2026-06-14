import { Rule, SugerenciaPreWorkout, Exercise } from '../types/database.types';
import { DEFAULT_RULES } from './rules';

export interface Session {
  id: string;
  fecha: string;
  ejercicio: string;
  peso: number;
  rpe_rir?: number;
  rpe?: number;
  reps?: number;
  repsArray?: number[];
  series_reps?: number[];
  descanso?: number;
  volumen?: number;
  rm?: number;
  rm_estimado?: number;
  grupo?: string;
  [key: string]: unknown;
}

export interface Notification {
  id: string;
  ejercicio: string;
  tipo: 'info' | 'warning' | 'error' | 'success';
  titulo?: string;
  mensaje: string;
}

export interface OverloadConfig {
  minSesiones: number;
  ventana: number;
  diasDescansoExcesivo: number;
  diasOptimo: number;
  sesionesRegresionAlerta: number;
  sesionesEstancamiento: number;
}

export const DEFAULT_OVERLOAD_CONFIG: OverloadConfig = {
  minSesiones: 3,
  ventana: 4,
  diasDescansoExcesivo: 14,
  diasOptimo: 7,
  sesionesRegresionAlerta: 3,
  sesionesEstancamiento: 5,
};

interface FilaEjercicio {
  fecha: string;
  ejercicio: string;
  grupo: string;
  repsArray: number[];
  peso: number;
  rpe: number;
  descanso: number;
  volumen: number;
  rm: number;
}

const interpolar = (texto: string, vars: Record<string, string | number>) =>
  texto.replace(/\{(\w+)\}/g, (_, k) =>
    vars[k] !== undefined ? String(vars[k]) : `{${k}}`
  );

const redondearPeso = (kg: number) => Math.round(kg / 2.5) * 2.5;

const parsearFechaISO = (d: string) => new Date(d).getTime();

const ruleTipoToNotifTipo = (tipo: Rule['tipo']): Notification['tipo'] => {
  switch (tipo) {
    case 'subir':
      return 'success';
    case 'bajar':
    case 'cambio':
      return 'warning';
    default:
      return 'info';
  }
};

const obtenerRepsArray = (s: Session): number[] => {
  if (s.repsArray?.length) return s.repsArray;
  if (s.series_reps?.length) return s.series_reps;
  if (s.reps != null) return [s.reps];
  return [5];
};

const calcularVolumen = (peso: number, repsArray: number[]) =>
  peso * repsArray.reduce((a, b) => a + b, 0);

const calcularRM = (peso: number, repsArray: number[]) => {
  if (!repsArray.length) return 0;
  return Math.max(...repsArray.map((reps) => peso * (1 + reps / 30)));
};

const normalizarFila = (s: Session): FilaEjercicio => {
  const repsArray = obtenerRepsArray(s);
  const peso = s.peso;
  return {
    fecha: s.fecha,
    ejercicio: s.ejercicio,
    grupo: s.grupo ?? 'General',
    repsArray,
    peso,
    rpe: s.rpe_rir ?? s.rpe ?? 2,
    descanso: s.descanso ?? 90,
    volumen: s.volumen ?? calcularVolumen(peso, repsArray),
    rm: s.rm ?? s.rm_estimado ?? calcularRM(peso, repsArray),
  };
};

const pushNotif = (
  notifs: Notification[],
  rule: Rule,
  ejercicio: string,
  vars: Record<string, string | number>
) => {
  notifs.push({
    id: rule.id,
    ejercicio,
    tipo: ruleTipoToNotifTipo(rule.tipo),
    titulo: rule.titulo,
    mensaje: interpolar(rule.mensaje, vars),
  });
};

/**
 * Analiza la sobrecarga progresiva aplicando todas las reglas definidas.
 */
export function analizarSobrecargaProgresiva(
  sesiones: Session[],
  rules: Rule[] = DEFAULT_RULES,
  config: Partial<OverloadConfig> = {},
  exercises: Exercise[] = []
): Notification[] {
  const cfg: OverloadConfig = { ...DEFAULT_OVERLOAD_CONFIG, ...config };
  const notifs: Notification[] = [];
  if (!sesiones.length) return notifs;

  const ejercicios = Array.from(new Set(sesiones.map((s) => s.ejercicio)));

  for (const nombre of ejercicios) {
    const filas = sesiones
      .filter((s) => s.ejercicio === nombre)
      .map(normalizarFila)
      .sort((a, b) => a.fecha.localeCompare(b.fecha));

    const n = filas.length;

    // Buscar la configuración del plan para este ejercicio (Sinergia)
    const exConfig = exercises.find((e) => e.nombre.toLowerCase().trim() === nombre.toLowerCase().trim());
    const hasDeload = exConfig?.progression_type === 'deload';
    const hasDouble = exConfig?.progression_type === 'double';
    const hasUndulating = exConfig?.progression_type === 'undulating';

    if (n === 1) {
      const rule = rules.find((r) => r.id === 'primer_sesion');
      if (rule?.activa) {
        pushNotif(notifs, rule, nombre, { ejercicio: nombre });
      }
      continue;
    }

    if (n < cfg.minSesiones) continue;

    const ventana = Math.min(cfg.ventana, n);
    const recientes = filas.slice(-ventana);
    const ultima = filas[n - 1];
    const penultima = filas[n - 2];

    const diasDesdeUltima = Math.round(
      (parsearFechaISO(ultima.fecha) - parsearFechaISO(penultima.fecha)) /
        (1000 * 60 * 60 * 24)
    );

    const avgRIR = recientes.reduce((s, f) => s + f.rpe, 0) / recientes.length;
    const avgDescanso =
      recientes.reduce((s, f) => s + f.descanso, 0) / recientes.length;

    const volActual = ultima.volumen;
    const volAnterior = penultima.volumen;
    const deltaPct = volAnterior
      ? ((volActual - volAnterior) / volAnterior) * 100
      : null;

    let regresionCount = 0;
    for (let i = n - 1; i >= 1; i--) {
      if (filas[i].volumen < filas[i - 1].volumen) regresionCount++;
      else break;
    }

    let rachaPositiva = 0;
    for (let i = n - 1; i >= 1; i--) {
      if (filas[i].volumen > filas[i - 1].volumen) rachaPositiva++;
      else break;
    }

    let sesionsSinMejora = 0;
    const rm1Reciente = filas[n - 1].rm;
    for (let i = n - 2; i >= 0; i--) {
      if (filas[i].rm >= rm1Reciente - 0.5) sesionsSinMejora++;
      else break;
    }

    let sesionsSinMejoraPesoReps = 0;
    const pesoUltima = filas[n - 1].peso;
    const repsUltima = filas[n - 1].repsArray.reduce((a, b) => a + b, 0);
    for (let i = n - 2; i >= 0; i--) {
      const pesoI = filas[i].peso;
      const repsI = filas[i].repsArray.reduce((a, b) => a + b, 0);
      if (pesoI >= pesoUltima - 0.01 && repsI >= repsUltima) sesionsSinMejoraPesoReps++;
      else break;
    }

    const esAutocarga = ultima.peso === 0;
    const findRule = (id: string) => rules.find((r) => r.id === id);

    // 1. Descanso excesivo (prioridad — corta evaluación del resto)
    const rDescansoEx = findRule('descanso_excesivo');
    if (
      !esAutocarga &&
      rDescansoEx?.activa &&
      diasDesdeUltima > cfg.diasDescansoExcesivo
    ) {
      const redPct = rDescansoEx.reduccion_porciento ?? 10;
      const pesoNuevo = redondearPeso(ultima.peso * (1 - redPct / 100));
      pushNotif(notifs, rDescansoEx, nombre, {
        ejercicio: nombre,
        valor: diasDesdeUltima,
        porciento: redPct,
        peso: pesoNuevo,
      });
      continue;
    }

    // 2. Regresión consecutiva de volumen
    const rReg = findRule('bajar_peso_regresion');
    if (!esAutocarga && rReg?.activa && regresionCount >= cfg.sesionesRegresionAlerta && !hasDeload) {
      const redPct = rReg.reduccion_porciento ?? 7;
      const pesoNuevo = redondearPeso(ultima.peso * (1 - redPct / 100));
      pushNotif(notifs, rReg, nombre, {
        ejercicio: nombre,
        valor: regresionCount,
        porciento: Math.abs(deltaPct ?? 0).toFixed(1),
        peso: pesoNuevo,
      });
    }

    // 3. RIR bajo + volumen cayendo → bajar peso
    const rRirAlto = findRule('bajar_peso_rir_alto');
    if (
      !esAutocarga &&
      rRirAlto?.activa &&
      avgRIR <= (rRirAlto.rir_umbral_bajo ?? 1) &&
      regresionCount >= (rRirAlto.sesiones_consecutivas ?? 3) &&
      !hasDeload
    ) {
      const redPct = rRirAlto.reduccion_porciento ?? 7;
      const pesoNuevo = redondearPeso(ultima.peso * (1 - redPct / 100));
      pushNotif(notifs, rRirAlto, nombre, {
        ejercicio: nombre,
        valor: avgRIR.toFixed(1),
        porciento: redPct,
        peso: pesoNuevo,
      });
    }

    // 4. RIR alto → subir peso
    const rSubir = findRule('subir_peso_reps');
    if (!esAutocarga && rSubir?.activa && !hasDouble && !hasDeload) {
      const consecutivas = rSubir.sesiones_consecutivas ?? 3;
      const riresRecientes = recientes.slice(-consecutivas).map((f) => f.rpe);
      const todosRIRAltos =
        riresRecientes.length >= consecutivas &&
        riresRecientes.every((r) => r >= (rSubir.rir_umbral ?? 3));
      if (todosRIRAltos && regresionCount === 0) {
        const incPct = rSubir.incremento_porciento ?? 5;
        const incKg = Math.max(
          rSubir.incremento_minimo_kg ?? 2.5,
          ultima.peso * (incPct / 100)
        );
        const pesoNuevo = redondearPeso(ultima.peso + incKg);
        pushNotif(notifs, rSubir, nombre, {
          ejercicio: nombre,
          valor: avgRIR.toFixed(1),
          porciento: incPct,
          peso: pesoNuevo,
        });
      }
    }

    // 5. Reps objetivo alcanzadas → subir peso (Sinergia)
    const rRepsObj = findRule('subir_peso_reps_objetivo');
    if (!esAutocarga && rRepsObj?.activa && n >= (rRepsObj.sesiones_consecutivas ?? 2) && !hasDeload) {
      let repsObjetivo = rRepsObj.reps_por_ejercicio?.[nombre];
      if (hasDouble && exConfig?.progression_params?.repsMaximas) {
        repsObjetivo = parseInt(exConfig.progression_params.repsMaximas, 10) || 12;
      } else if (exConfig?.progression_type === 'linear' && exConfig?.progression_params?.repeticiones) {
        const repsObjStr = exConfig.progression_params.repeticiones;
        repsObjetivo = repsObjStr.includes('-') 
          ? (parseInt(repsObjStr.split('-')[1], 10) || 10)
          : (parseInt(repsObjStr, 10) || 10);
      } else if (!repsObjetivo) {
        repsObjetivo =
          filas[0].repsArray.length > 0 ? filas[0].repsArray[0] : 10;
      }
      const seriesMinPct = rRepsObj.series_minimas_pct ?? 75;
      const ultimasSesiones = recientes.slice(-(rRepsObj.sesiones_consecutivas ?? 2));
      const todasCumplen =
        ultimasSesiones.length >= (rRepsObj.sesiones_consecutivas ?? 2) &&
        ultimasSesiones.every((fila) => {
          const totalSeries = fila.repsArray.length;
          if (totalSeries === 0) return false;
          const seriesNecesarias = Math.ceil((totalSeries * seriesMinPct) / 100);
          const seriesCumplen = fila.repsArray.filter((r) => r >= repsObjetivo!).length;
          return seriesCumplen >= seriesNecesarias;
        });
      if (todasCumplen) {
        const incPct = rRepsObj.incremento_porciento ?? 5;
        const incKg = Math.max(
          rRepsObj.incremento_minimo_kg ?? 2.5,
          ultima.peso * (incPct / 100)
        );
        const pesoNuevo = redondearPeso(ultima.peso + incKg);
        const seriesMinimas = Math.ceil(
          ((ultima.repsArray.length || 1) * seriesMinPct) / 100
        );
        pushNotif(notifs, rRepsObj, nombre, {
          ejercicio: nombre,
          valor: repsObjetivo!,
          grupo: filas[0].grupo,
          reps_objetivo: repsObjetivo!,
          series_minimas: seriesMinimas,
          sesiones_consecutivas: rRepsObj.sesiones_consecutivas ?? 2,
          porciento: incPct,
          peso: pesoNuevo,
        });
      }
    }

    // 6. Crecimiento de volumen → agregar reps antes de subir peso
    const rReps = findRule('subir_reps_antes_peso');
    if (
      !esAutocarga &&
      rReps?.activa &&
      deltaPct !== null &&
      deltaPct >= (rReps.umbral_crecimiento_vol ?? 8) &&
      rachaPositiva >= (rReps.sesiones_consecutivas ?? 2) &&
      !hasDeload
    ) {
      pushNotif(notifs, rReps, nombre, {
        ejercicio: nombre,
        valor: ultima.peso,
        porciento: deltaPct.toFixed(1),
        peso: ultima.peso,
      });
    }

    // 7. Volumen estable → mantener
    const rMantener = findRule('mantener_peso');
    if (
      !esAutocarga &&
      rMantener?.activa &&
      deltaPct !== null &&
      Math.abs(deltaPct) <= (rMantener.umbral_estabilidad ?? 5) &&
      !hasDeload
    ) {
      pushNotif(notifs, rMantener, nombre, {
        ejercicio: nombre,
        valor: Math.abs(deltaPct).toFixed(1),
        porciento: 0,
        peso: ultima.peso,
      });
    }

    // 8. Descanso entre series alto
    const rDescansoLargo = findRule('descanso_largo');
    if (
      !esAutocarga &&
      rDescansoLargo?.activa &&
      avgDescanso >= (rDescansoLargo.umbral_descanso_alto ?? 180)
    ) {
      pushNotif(notifs, rDescansoLargo, nombre, {
        ejercicio: nombre,
        valor: Math.round(avgDescanso),
        porciento: 0,
        peso: ultima.peso,
      });
    }

    // 9. Estancamiento (Válido para ambos) (Sinergia)
    const rEstanc = findRule('estancamiento');
    if (rEstanc?.activa && !hasDeload && !hasUndulating) {
      const umbralPesoReps = rEstanc.sesiones_sin_mejora_peso_reps ?? 3;
      const hayEstanc1RM = !esAutocarga && sesionsSinMejora >= cfg.sesionesEstancamiento;
      const hayEstancPesoReps = sesionsSinMejoraPesoReps >= umbralPesoReps;
      if (hayEstanc1RM || hayEstancPesoReps) {
        const sesionesAfectadas = hayEstancPesoReps
          ? sesionsSinMejoraPesoReps
          : sesionsSinMejora;
        pushNotif(notifs, rEstanc, nombre, {
          ejercicio: nombre,
          valor: sesionesAfectadas,
          porciento: 0,
          peso: ultima.peso,
        });
      }
    }

    // 10. Racha positiva
    const rRacha = findRule('racha_positiva');
    if (!esAutocarga && rRacha?.activa && rachaPositiva >= (rRacha.sesiones_racha ?? 3)) {
      pushNotif(notifs, rRacha, nombre, {
        ejercicio: nombre,
        valor: rachaPositiva,
        porciento: 0,
        peso: ultima.peso,
      });
    }

    // 11. Récord personal
    const rRecord = findRule('record_personal');
    if (!esAutocarga && rRecord?.activa && n >= 2) {
      const rm1MaxPrev = Math.max(...filas.slice(0, n - 1).map((f) => f.rm));
      const rm1Ultima = ultima.rm;
      if (rm1Ultima > rm1MaxPrev && rm1Ultima - rm1MaxPrev >= 0.5) {
        pushNotif(notifs, rRecord, nombre, {
          ejercicio: nombre,
          valor: rm1Ultima.toFixed(1),
          porciento: 0,
          peso: rm1MaxPrev.toFixed(1),
        });
      }
    }

    // === REGLAS DE AUTOCARGA / CALISTENIA ===
    if (esAutocarga) {
      // 1. Subir repeticiones
      const rAutocargaSubirReps = findRule('autocarga_subir_reps');
      if (rAutocargaSubirReps?.activa) {
        const consecutivas = rAutocargaSubirReps.sesiones_consecutivas ?? 2;
        const ultimasFilas = recientes.slice(-consecutivas);
        const cumpleRIR =
          ultimasFilas.length >= consecutivas &&
          ultimasFilas.every((f) => f.rpe >= (rAutocargaSubirReps.rir_umbral ?? 3));
        if (cumpleRIR) {
          pushNotif(notifs, rAutocargaSubirReps, nombre, {
            ejercicio: nombre,
            valor: avgRIR.toFixed(1),
            sesiones_consecutivas: consecutivas,
          });
        }
      }

      // 2. Aumentar Tiempo Bajo Tensión (TUT)
      const rAutocargaTUT = findRule('autocarga_tut_tiempo');
      if (rAutocargaTUT?.activa) {
        const consecutivas = rAutocargaTUT.sesiones_consecutivas ?? 2;
        const ultimasFilas = recientes.slice(-consecutivas);
        if (ultimasFilas.length >= consecutivas) {
          const avgRepsPerSet =
            ultimasFilas.reduce(
              (s, f) => s + f.repsArray.reduce((a, b) => a + b, 0) / f.repsArray.length,
              0
            ) / consecutivas;
          if (avgRepsPerSet >= 10 && avgRepsPerSet < 15) {
            pushNotif(notifs, rAutocargaTUT, nombre, {
              ejercicio: nombre,
              valor: Math.round(avgRepsPerSet),
            });
          }
        }
      }

      // 3. Más densidad — Reducir descanso
      const rAutocargaDensidad = findRule('autocarga_descanso_densidad');
      if (rAutocargaDensidad?.activa) {
        const consecutivas = rAutocargaDensidad.sesiones_consecutivas ?? 2;
        const ultimasFilas = recientes.slice(-consecutivas);
        const avgDesc =
          ultimasFilas.reduce((s, f) => s + f.descanso, 0) / consecutivas;
        if (
          ultimasFilas.length >= consecutivas &&
          avgDesc >= (rAutocargaDensidad.umbral_descanso_alto ?? 90)
        ) {
          pushNotif(notifs, rAutocargaDensidad, nombre, {
            ejercicio: nombre,
            valor: Math.round(avgDesc),
            nuevo_descanso: Math.max(45, Math.round(avgDesc - 15)),
          });
        }
      }

      // 4. Evolución mecánica sugerida
      const rAutocargaEvolucion = findRule('autocarga_evolucion_mecanica');
      if (rAutocargaEvolucion?.activa) {
        const consecutivas = rAutocargaEvolucion.sesiones_consecutivas ?? 2;
        const ultimasFilas = recientes.slice(-consecutivas);
        if (ultimasFilas.length >= consecutivas) {
          const avgRepsPerSet =
            ultimasFilas.reduce(
              (s, f) => s + f.repsArray.reduce((a, b) => a + b, 0) / f.repsArray.length,
              0
            ) / consecutivas;
          const avgDesc =
            ultimasFilas.reduce((s, f) => s + f.descanso, 0) / consecutivas;
          if (avgRepsPerSet >= 15 && avgDesc <= 75) {
            pushNotif(notifs, rAutocargaEvolucion, nombre, {
              ejercicio: nombre,
              valor: Math.round(avgRepsPerSet),
            });
          }
        }
      }
    }

    // 12. Deload sugerido (Válido para ambos)
    const rDeload = findRule('deload_sugerido');
    if (rDeload?.activa) {
      const semanasDeload = rDeload.semanas_consecutivas ?? 6;
      let fechaStreakStart = parsearFechaISO(ultima.fecha);
      for (let i = n - 1; i >= 1; i--) {
        const d1 = parsearFechaISO(filas[i].fecha);
        const d0 = parsearFechaISO(filas[i - 1].fecha);
        const diff = Math.round((d1 - d0) / (1000 * 60 * 60 * 24));
        if (diff > 14) break;
        fechaStreakStart = d0;
      }
      const semanasConsecutivas = Math.floor(
        (parsearFechaISO(ultima.fecha) - fechaStreakStart) /
          (1000 * 60 * 60 * 24 * 7)
      );
      if (semanasConsecutivas >= semanasDeload) {
        pushNotif(notifs, rDeload, nombre, {
          ejercicio: nombre,
          valor: semanasConsecutivas,
          porciento: 0,
          peso: ultima.peso,
        });
      }
    }
  }

  return notifs;
}

/**
 * Genera sugerencias pre-entrenamiento inteligentes para cada ejercicio.
 * Se basa en el historial del atleta para proponer metas concretas.
 */
export function calcularSugerenciasPreWorkout(
  sesiones: Session[],
  ejerciciosDelDia: Exercise[]
): SugerenciaPreWorkout[] {
  const sugerencias: SugerenciaPreWorkout[] = [];
  if (!sesiones.length || !ejerciciosDelDia.length) return sugerencias;

  for (const ex of ejerciciosDelDia) {
    const nombre = ex.nombre;
    const filas = sesiones
      .filter((s) => s.ejercicio === nombre)
      .map(normalizarFila)
      .sort((a, b) => a.fecha.localeCompare(b.fecha));

    const n = filas.length;
    if (n === 0) {
      sugerencias.push({
        ejercicio: nombre,
        tipo: 'general',
        titulo: '🆕 Primera sesión',
        mensaje: `Es tu primera vez con ${nombre}. Enfócate en la técnica y registra tu rendimiento base.`,
        valor_actual: 0,
        valor_sugerido: 0,
        unidad: '',
      });
      continue;
    }

    const ultima = filas[n - 1];
    const esAutocarga = ultima.peso === 0;

    // Verificar si el ejercicio tiene configurada una progresión del Smart Block Builder (Sinergia Regla de Juego)
    if (ex.progression_type && ex.progression_params) {
      const type = ex.progression_type;
      const params = ex.progression_params;

      if (type === 'double') {
        const repsMax = parseInt(params.repsMaximas || '12', 10) || 12;
        const repsMin = parseInt(params.repsIniciales || '8', 10) || 8;
        const incremento = parseFloat(params.incremento || '2.5') || 2.5;
        const seriesTotal = parseInt(params.series || '3', 10) || 3;

        // Verificar si completó todas las series al máximo de repeticiones en la última sesión
        const seriesCumplen = ultima.repsArray.length >= seriesTotal && 
                              ultima.repsArray.every((r: number) => r >= repsMax);

        if (seriesCumplen) {
          const nuevoPeso = redondearPeso(ultima.peso + incremento);
          sugerencias.push({
            ejercicio: nombre,
            tipo: 'peso',
            titulo: '💪 ¡Progresión Doble: Sube Peso!',
            mensaje: `Completaste las ${repsMax} reps en todas tus series de ${nombre}. Sube a ${nuevoPeso} kg y reinicia a ${repsMin} reps.`,
            valor_actual: ultima.peso,
            valor_sugerido: nuevoPeso,
            unidad: 'kg',
          });
        } else {
          const maxRepsReal = Math.max(...ultima.repsArray);
          const repsSugeridas = Math.min(repsMax, maxRepsReal + 1);
          sugerencias.push({
            ejercicio: nombre,
            tipo: 'reps',
            titulo: '🎯 Progresión Doble: Suma Reps',
            mensaje: `Mantén ${ultima.peso} kg e intenta sumar repeticiones en tus series de ${nombre} (última sesión max: ${maxRepsReal} reps, objetivo: ${repsMax} reps).`,
            valor_actual: maxRepsReal,
            valor_sugerido: repsSugeridas,
            unidad: 'reps',
          });
        }
        continue;
      }

      if (type === 'linear') {
        const repsObjStr = params.repeticiones || '10';
        const repsObj = repsObjStr.includes('-') 
          ? (parseInt(repsObjStr.split('-')[1], 10) || 10)
          : (parseInt(repsObjStr, 10) || 10);
        const incremento = parseFloat(params.incremento || '2.5') || 2.5;
        const seriesTotal = parseInt(params.series || '3', 10) || 3;

        const seriesCumplen = ultima.repsArray.length >= seriesTotal && 
                              ultima.repsArray.every((r: number) => r >= repsObj);

        if (seriesCumplen) {
          const nuevoPeso = redondearPeso(ultima.peso + incremento);
          sugerencias.push({
            ejercicio: nombre,
            tipo: 'peso',
            titulo: '💪 Progresión Lineal: Sube Peso',
            mensaje: `Completaste tu objetivo de ${repsObj} reps en ${nombre}. Sube un escalón a ${nuevoPeso} kg.`,
            valor_actual: ultima.peso,
            valor_sugerido: nuevoPeso,
            unidad: 'kg',
          });
        } else {
          sugerencias.push({
            ejercicio: nombre,
            tipo: 'peso',
            titulo: '🛡️ Progresión Lineal: Consolida',
            mensaje: `Mantén ${ultima.peso} kg e intenta completar todas tus series a ${repsObj} repeticiones antes de subir carga.`,
            valor_actual: ultima.peso,
            valor_sugerido: ultima.peso,
            unidad: 'kg',
          });
        }
        continue;
      }

      if (type === 'undulating') {
        const semanaActual = n + 1;
        const esSemanaFuerza = semanaActual % 2 !== 0;

        if (esSemanaFuerza) {
          const repsFuerza = parseInt(params.repsFuerza || '5', 10) || 5;
          const seriesFuerza = parseInt(params.seriesFuerza || '4', 10) || 4;
          const rirFuerza = params.rirFuerza || '1';
          sugerencias.push({
            ejercicio: nombre,
            tipo: 'general',
            titulo: '⚡ Ondulante: Semana de Fuerza',
            mensaje: `Hoy es semana de Fuerza. Realiza ${seriesFuerza} series de ${repsFuerza} reps con un RIR de ${rirFuerza} (alta intensidad).`,
            valor_actual: 0,
            valor_sugerido: repsFuerza,
            unidad: 'reps',
          });
        } else {
          const repsHiper = parseInt(params.repsHipertrofia || '10', 10) || 10;
          const seriesHiper = parseInt(params.seriesHipertrofia || '3', 10) || 3;
          const rirHiper = params.rirHipertrofia || '2';
          sugerencias.push({
            ejercicio: nombre,
            tipo: 'general',
            titulo: '🌊 Ondulante: Semana de Hipertrofia',
            mensaje: `Hoy es semana de Hipertrofia. Realiza ${seriesHiper} series de ${repsHiper} reps con un RIR de ${rirHiper} (carga moderada).`,
            valor_actual: 0,
            valor_sugerido: repsHiper,
            unidad: 'reps',
          });
        }
        continue;
      }

      if (type === 'deload') {
        const deloadSeries = parseInt(params.series || '2', 10) || 2;
        const deloadRir = params.rir || '3-4';
        sugerencias.push({
          ejercicio: nombre,
          tipo: 'general',
          titulo: '💤 Semana de Descarga (Deload)',
          mensaje: `Semana de descarga activa para disipar fatiga. Reduce tus series de trabajo a ${deloadSeries} y mantente alejado del fallo (RIR objetivo: ${deloadRir}).`,
          valor_actual: 0,
          valor_sugerido: deloadSeries,
          unidad: 'series',
        });
        continue;
      }
    }

    // Sugerencia de peso (solo si no es autocarga)
    if (!esAutocarga && n >= 2) {
      const avgRIR = filas.slice(-Math.min(3, n)).reduce((s, f) => s + f.rpe, 0) / Math.min(3, n);
      
      if (avgRIR >= 3) {
        // RIR alto: sugerir subir peso
        const incremento = Math.max(2.5, ultima.peso * 0.05);
        const pesoSugerido = redondearPeso(ultima.peso + incremento);
        sugerencias.push({
          ejercicio: nombre,
          tipo: 'peso',
          titulo: '💪 ¡Sube peso hoy! 🏋️',
          mensaje: `En tus últimas sesiones dejaste un RIR promedio de ${avgRIR.toFixed(0)}, lo que significa que guardaste demasiadas repeticiones en el tanque. Para activar la sobrecarga progresiva y reclutar más fibras musculares, sube a ${pesoSugerido} kg manteniendo tu rango de movimiento activo (ROM) completo.`,
          valor_actual: ultima.peso,
          valor_sugerido: pesoSugerido,
          unidad: 'kg',
        });
      } else if (avgRIR <= 1) {
        // RIR bajo: mantener o bajar
        sugerencias.push({
          ejercicio: nombre,
          tipo: 'peso',
          titulo: '🛡️ Consolida la técnica',
          mensaje: `Tu RIR promedio fue de ${avgRIR.toFixed(1)}, lo que indica que estuviste muy cerca del fallo mecánico real. Quédate con ${ultima.peso} kg hoy para perfeccionar el control del movimiento, disipar fatiga y consolidar la técnica antes de dar el siguiente salto.`,
          valor_actual: ultima.peso,
          valor_sugerido: ultima.peso,
          unidad: 'kg',
        });
      }
    }

    // Sugerencia de reps
    if (n >= 1) {
      const maxRepsPerSet = Math.max(...ultima.repsArray);
      const targetReps = maxRepsPerSet + 1;
      
      if (esAutocarga || (ultima.rpe >= 3 && !esAutocarga)) {
        sugerencias.push({
          ejercicio: nombre,
          tipo: 'reps',
          titulo: '🎯 Exprime una repetición más',
          mensaje: `En tu última sesión lograste un máximo de ${maxRepsPerSet} repeticiones. Hoy tu misión es buscar esa repetición extra para llegar a ${targetReps} en tu primera serie de trabajo. Mantén la fase excéntrica controlada (TUT de 2-3 segundos) para maximizar la tensión mecánica.`,
          valor_actual: maxRepsPerSet,
          valor_sugerido: targetReps,
          unidad: 'reps',
        });
      }
    }

    // Sugerencia de descanso
    if (n >= 2 && ultima.descanso >= 150) {
      const nuevoDescanso = Math.max(60, ultima.descanso - 15);
      sugerencias.push({
        ejercicio: nombre,
        tipo: 'descanso',
        titulo: '⏱️ Aumenta la densidad',
        mensaje: `Tu descanso promedio fue de ${ultima.descanso} segundos. Si recortas el tiempo a ${nuevoDescanso} segundos, aumentarás la densidad del entrenamiento (hacer el mismo trabajo en menos tiempo), elevando el estrés metabólico sin necesidad de añadir peso.`,
        valor_actual: ultima.descanso,
        valor_sugerido: nuevoDescanso,
        unidad: 'seg',
      });
    }

    // Alerta de inactividad
    if (n >= 2) {
      const diasDesdeUltima = Math.round(
        (Date.now() - new Date(ultima.fecha).getTime()) / (1000 * 60 * 60 * 24)
      );
      if (diasDesdeUltima > 10) {
        sugerencias.push({
          ejercicio: nombre,
          tipo: 'general',
          titulo: '⚠️ Reactiva tu memoria muscular',
          mensaje: `Han pasado ${diasDesdeUltima} días desde que estimulaste este patrón de movimiento. Tu sistema nervioso necesita readaptarse. Te sugiero iniciar con ${esAutocarga ? 'autocarga controlada' : redondearPeso(ultima.peso * 0.9) + ' kg (un 10% menos)'} para evitar fatiga neuromuscular excesiva y asegurar un ROM activo limpio.`,
          valor_actual: diasDesdeUltima,
          valor_sugerido: esAutocarga ? 0 : redondearPeso(ultima.peso * 0.9),
          unidad: esAutocarga ? 'días' : 'kg',
        });
      }
    }
  }

  return sugerencias;
}
