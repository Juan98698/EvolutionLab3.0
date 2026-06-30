/**
 * Funciones puras del Smart Block Builder.
 *
 * Separadas de SmartBlockBuilderModal.tsx (que solo exporta el componente)
 * porque la regla ESLint react-refresh/only-export-components advierte al
 * mezclar exports de funciones con el export del componente en el mismo
 * archivo — eso rompe el fast-refresh de Vite en desarrollo. Mismo patrón
 * que periodizationEngine.ts para calcTargetRIRForWeek (usada por
 * PeriodizationPanel.tsx).
 */

/**
 * Devuelve los parámetros por defecto para cada plantilla de progresión.
 * La usa tanto PlanPlanner (en handleOpenProgression, para abrir el modal
 * con valores iniciales) como el propio modal.
 */
export const getDefaultParamsForTemplate = (template: string) => {
  switch (template) {
    case 'linear':
      return {
        duracion: 4,
        series: '3',
        repeticiones: '8-10',
        rir: '2',
        incremento: '2.5',
        cargaInicial: 'Peso base'
      };
    case 'double':
      return {
        duracion: 4,
        series: '3',
        repsIniciales: '8',
        repsIntermedias: '10',
        repsMaximas: '12',
        rir: '2-3',
        incremento: '2.5',
        cargaInicial: 'Peso base'
      };
    case 'undulating':
      return {
        duracion: 4,
        cargaInicial: 'Peso base',
        incrementoFuerza: '2.5',
        seriesFuerza: '4',
        repsFuerza: '5',
        rirFuerza: '1',
        seriesHipertrofia: '3',
        repsHipertrofia: '10',
        rirHipertrofia: '2'
      };
    case 'deload':
      return {
        duracion: 1,
        reduccionVolumen: '50-60',
        cargaRecomendada: 'Moderada',
        series: '2',
        rir: '3-4'
      };
    default:
      return {};
  }
};

/**
 * Genera el texto descriptivo de la "Regla de Juego" para cada plantilla,
 * en base a los parámetros configurados por el entrenador en el modal.
 * Función pura — fácil de testear de forma aislada.
 */
export const generateProgressionText = (template: string, params: any): string => {
  if (!params) return '';

  switch (template) {
    case 'linear': {
      return [
        `📈 REGLA DE JUEGO: Progresión Lineal (${params.duracion} Semanas)`,
        `• Objetivo: Realizar ${params.series} series de trabajo, buscando aumentar la carga semanalmente (+${params.incremento || '2.5'} kg) manteniendo RIR ${params.rir} y técnica perfecta.`,
        `• Repeticiones base: ${params.repeticiones}.`,
        `• Sinergia Smart Coach: Si completas las repeticiones objetivo en todas tus series de forma limpia, el Smart Coach te sugerirá automáticamente aumentar el peso (+${params.incremento || '2.5'} kg) para tu próxima sesión. Si no las completas, mantendrás la misma carga para consolidar.`
      ].join('\n');
    }

    case 'double': {
      return [
        `🔁 REGLA DE JUEGO: Progresión Doble (${params.duracion} Semanas)`,
        `• Objetivo: Realizar ${params.series} series, buscando progresar primero en volumen (repeticiones) desde ${params.repsIniciales} hasta ${params.repsMaximas} manteniendo RIR ${params.rir}.`,
        `• Sinergia Smart Coach: Mantén el mismo peso sesión tras sesión intentando sumar repeticiones. Cuando completes las ${params.repsMaximas} reps en tus ${params.series} series, el Smart Coach te sugerirá subir peso (+${params.incremento || '2.5'} kg) y reiniciarás el ciclo a ${params.repsIniciales} reps.`
      ].join('\n');
    }

    case 'undulating': {
      return [
        `🌊 REGLA DE JUEGO: Periodización Ondulante (${params.duracion} Semanas)`,
        `• Objetivo: Este bloque alterna estímulos semanales de Fuerza (semanas impares) y de Hipertrofia (semanas pares) para evitar adaptaciones y optimizar fuerza y masa muscular.`,
        `• Sinergia Smart Coach: El Smart Coach adaptará dinámicamente tus series, repeticiones y RIR en cada sesión:`,
        `  - Semanas Impares (Fuerza): ${params.seriesFuerza} series × ${params.repsFuerza} reps @RIR ${params.rirFuerza} (alta intensidad).`,
        `  - Semanas Pares (Hipertrofia): ${params.seriesHipertrofia} series × ${params.repsHipertrofia} reps @RIR ${params.rirHipertrofia} (carga moderada).`
      ].join('\n');
    }

    case 'deload': {
      return [
        `💤 REGLA DE JUEGO: Descarga Activa (Deload - ${params.duracion} Semana/s)`,
        `• Objetivo: Reducir las series a ${params.series} de trabajo y el volumen para disipar la fatiga acumulada a nivel articular y nervioso.`,
        `• Sinergia Smart Coach: Mantente alejado del fallo (RIR objetivo: ${params.rir}) y usa una carga ${params.cargaRecomendada || 'moderada'}. El motor silenciará las alertas de regresión ya que esta descarga es planificada.`
      ].join('\n');
    }

    default:
      return '';
  }
};
