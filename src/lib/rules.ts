// src/lib/rules.ts
// Definición de reglas de sobrecarga progresiva (portadas del proyecto legacy)
import { Rule } from '../types/database.types';

export const DEFAULT_RULES: Rule[] = [
  {
    id: 'subir_peso_reps',
    tipo: 'subir',
    activa: true,
    titulo: 'Subir peso',
    mensaje:
      '¡Sube el peso! En {ejercicio} tuviste un RIR promedio de {valor} (guardaste muchas reps en el tanque y la intensidad fue baja). Sube un {porciento}% (~{peso} kg) manteniendo el rango de movimiento activo (ROM) para despertar fibras musculares profundas. 🏋️',
    rir_umbral: 3,
    sesiones_consecutivas: 3,
    incremento_porciento: 5,
    incremento_minimo_kg: 2.5,
  },
  {
    id: 'subir_peso_reps_objetivo',
    tipo: 'subir',
    activa: true,
    titulo: 'Subir peso — Reps objetivo alcanzadas',
    mensaje:
      '¡Objetivo cumplido! En {ejercicio} ({grupo}) lograste hacer {reps_objetivo} reps en al menos {series_minimas} series por {sesiones_consecutivas} entrenamientos seguidos. Sube {porciento}% (~{peso} kg) y domina este nuevo estímulo. ¡No le temas al progreso! 🚀',
    reps_por_ejercicio: {
      'Press de banca': 10,
      Sentadilla: 10,
      'Peso muerto': 8,
    },
    series_minimas_pct: 75,
    sesiones_consecutivas: 2,
    incremento_porciento: 5,
    incremento_minimo_kg: 2.5,
  },
  {
    id: 'subir_reps_antes_peso',
    tipo: 'subir',
    activa: true,
    titulo: 'Agregar repeticiones',
    mensaje:
      '¡Volumen al alza! Tu volumen en {ejercicio} aumentó un {porciento}% últimamente. Antes de tocar el peso, exprime 1-2 repeticiones más por serie para consolidar tu Tiempo Bajo Tensión (TUT) y asegurar una base sólida. 🎯',
    umbral_crecimiento_vol: 8,
    sesiones_consecutivas: 2,
  },
  {
    id: 'mantener_peso',
    tipo: 'mantener',
    activa: true,
    titulo: 'Mantener peso',
    mensaje:
      '¡Consolidación del estímulo! En {ejercicio} tu volumen se mantuvo estable (±{valor}%). Quédate en {peso} kg y enfócate en controlar el tempo excéntrico y perfeccionar tu ROM antes de incrementar carga. 🛡️',
    umbral_estabilidad: 5,
    sesiones_consecutivas: 3,
  },
  {
    id: 'bajar_peso_rir_alto',
    tipo: 'bajar',
    activa: true,
    titulo: 'Bajar peso — Cerca del fallo',
    mensaje:
      '¡Escucha a tu cuerpo! Tu RIR promedio en {ejercicio} fue de {valor} (muy cerca del fallo) y tu volumen total cayó. El peso actual está sobrecargando tu sistema nervioso. Baja un {porciento}% (~{peso} kg) para recuperar calidad y volver a tomar vuelo. 🔋',
    rir_umbral_bajo: 1,
    reduccion_porciento: 7,
    sesiones_consecutivas: 3,
  },
  {
    id: 'bajar_peso_regresion',
    tipo: 'bajar',
    activa: true,
    titulo: 'Bajar peso — Regresión de volumen',
    mensaje:
      '¡Freno de mano! Tu volumen en {ejercicio} cayó un {porciento}% durante {valor} entrenamientos seguidos. Baja la carga un 5-10% y concéntrate en la velocidad de barra y en disipar fatiga. Es un paso atrás para dar tres adelante. 🧠',
    reduccion_porciento: 7,
  },
  {
    id: 'descanso_excesivo',
    tipo: 'descanso',
    activa: true,
    titulo: 'Retomar tras descanso largo',
    mensaje:
      '¡Reactiva con cuidado! Llevas {valor} días sin entrenar {ejercicio}. Para disipar el desentrenamiento y evitar agujetas destructivas, inicia hoy con un {porciento}% menos de peso (~{peso} kg) y restaura tu memoria motora. ⚡',
    reduccion_porciento: 10,
  },
  {
    id: 'descanso_largo',
    tipo: 'info',
    activa: true,
    titulo: 'Descanso entre series — Alto',
    mensaje:
      '¡Eleva la densidad metabólica! En {ejercicio} descansaste {valor}s en promedio. Si acortas tus descansos a 90-120s, mantendrás la fatiga residual acumulada en las fibras objetivo, estimulando mayor hipertrofia por estrés metabólico. ⏱️',
    umbral_descanso_alto: 180,
  },
  {
    id: 'estancamiento',
    tipo: 'cambio',
    activa: true,
    titulo: 'Posible estancamiento',
    mensaje:
      '¡Rompe el estancamiento! Llevas {valor} sesiones sin progresar en {ejercicio}. Para romper esta meseta sin forzar lesiones, prueba a variar el ángulo, cambiar de agarre o sustituirlo por una variante biomecánica similar por 2-3 semanas. 🔄',
    sesiones_sin_mejora_peso_reps: 4,
  },
  {
    id: 'racha_positiva',
    tipo: 'subir',
    activa: true,
    titulo: 'Racha de progreso',
    mensaje:
      '¡Imparable! Llevas una racha de {valor} entrenamientos seguidos subiendo el volumen en {ejercicio}. Estás en pleno estado anabólico, prepárate mentalmente para dar un pequeño salto de carga en tu próxima sesión. 🔥',
    sesiones_racha: 3,
  },
  {
    id: 'primer_sesion',
    tipo: 'info',
    activa: true,
    titulo: 'Primera sesión registrada',
    mensaje:
      'Registraste tu primera sesión de {ejercicio}. Necesitas al menos 3 sesiones para que el motor de progresión te dé sugerencias personalizadas basadas en tu rendimiento real. 🆕',
  },
  {
    id: 'record_personal',
    tipo: 'subir',
    activa: true,
    titulo: '¡Nuevo Récord Personal!',
    mensaje:
      '¡RÉCORD PERSONAL DESBLOQUEADO! 🏆 Rompiste tu marca histórica en {ejercicio} alcanzando un 1RM estimado de {valor} kg (récord anterior: {peso} kg). ¡Celebra esta victoria de tu sistema neuromuscular!',
  },
  {
    id: 'deload_sugerido',
    tipo: 'descanso',
    activa: true,
    titulo: 'Deload Sugerido',
    mensaje:
      '¡Fatiga a raya! Has acumulado {valor} semanas consecutivas entrenando duro {ejercicio}. Tu tejido conectivo y sistema nervioso central piden tregua. Sugiere una descarga (Deload) reduciendo volumen y peso un 40% para disipar fatiga y prevenir lesiones. 💤',
    semanas_consecutivas: 6,
  },
  {
    id: 'autocarga_subir_reps',
    tipo: 'subir',
    activa: true,
    titulo: 'Subir repeticiones — Autocarga',
    mensaje:
      '¡Domina la gravedad! En {ejercicio} mantuviste un RIR promedio de {valor} durante las últimas {sesiones_consecutivas} sesiones. Si quieres seguir reclutando fibras sin añadir lastre externo, suma 1-2 repeticiones por serie manteniendo una contracción máxima. 🤸',
    rir_umbral: 3,
    sesiones_consecutivas: 2,
  },
  {
    id: 'autocarga_tut_tiempo',
    tipo: 'info',
    activa: true,
    titulo: 'Aumentar Tiempo Bajo Tensión (TUT)',
    mensaje:
      '¡Haz cada repetición más larga! Promediaste {valor} reps por serie en {ejercicio}. Para disparar la hipertrofia sin añadir reps infinitas, extiende la bajada (fase excéntrica) a 4 segundos (TUT de 4:1:1). ¡Sentirás el verdadero estímulo! ⏳',
    sesiones_consecutivas: 2,
  },
  {
    id: 'autocarga_descanso_densidad',
    tipo: 'descanso',
    activa: true,
    titulo: 'Más densidad — Reducir descanso',
    mensaje:
      '¡Entrena más denso! Descansaste {valor}s en promedio en {ejercicio}. Intenta recortar tus pausas a {nuevo_descanso}s para entrenar a tu sistema cardiovascular local y forzar la adaptación bajo fatiga acumulada. 🥋',
    umbral_descanso_alto: 90,
    sesiones_consecutivas: 2,
  },
  {
    id: 'autocarga_evolucion_mecanica',
    tipo: 'cambio',
    activa: true,
    titulo: 'Evolución mecánica sugerida',
    mensaje:
      '¡Subiendo de nivel biomecánico! Lograste {valor} reps promedio con descansos muy densos en {ejercicio}. Has ganado suficiente fuerza relativa; es momento de cambiar la palanca o pasar a una variante más compleja (ej. flexiones declinadas) para seguir progresando. 🛠️',
    sesiones_consecutivas: 2,
  },
];
