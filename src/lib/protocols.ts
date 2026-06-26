import { AthleteLevel } from './volumeThresholds';
import { BlockObjective } from './volumeThresholds';

export interface ProtocolExercise {
  name: string;
  muscle: string;
  sets: string; // e.g. "3", "5"
  reps: string; // e.g. "8-12", "5"
  rir: string;  // e.g. "1-2"
  rest: string; // e.g. "120s"
}

export interface ProtocolDay {
  label: string; // e.g. "Día 1: Upper"
  exercises: ProtocolExercise[];
}

export interface ProtocolTemplate {
  id: string;
  name: string;
  objective: BlockObjective;
  level: AthleteLevel;
  daysPerWeek: number;
  description: string;
  scienceGuide: string; // Explains the "why"
  recommendedSchedule?: number[];
  days: ProtocolDay[];
}

// ---------------------------------------------------------
// BIBLIOTECA CIENTÍFICA DE PROTOCOLOS
// ---------------------------------------------------------
export const PROTOCOL_LIBRARY: ProtocolTemplate[] = [
  // ============================================
  // HIPERTROFIA
  // ============================================
  {
    id: 'hyp-beg-fb-3',
    name: 'Full Body Clásico (3 Días)',
    objective: 'hipertrofia',
    level: 'principiante',
    daysPerWeek: 3,
    description: 'Rutina de cuerpo completo para principiantes con volumen bajo y alta frecuencia.',
    scienceGuide: 'Para un principiante buscando hipertrofia, la síntesis proteica cae rápidamente después del entrenamiento (aprox 24-36h). Entrenar cuerpo completo 3 veces por semana asegura que los músculos estén creciendo constantemente sin acumular fatiga excesiva (ya que su MRV es bajo).',
    recommendedSchedule: [0, -1, 1, -1, 2, -1, -1],
    days: [
      {
        label: 'Día 1: Full Body A',
        exercises: [
          { name: 'Sentadilla', muscle: 'Cuádriceps', sets: '3', reps: '10-12', rir: '2', rest: '120' },
          { name: 'Press de Banca', muscle: 'Pecho', sets: '3', reps: '10-12', rir: '2', rest: '120' },
          { name: 'Remo con Barra', muscle: 'Espalda', sets: '3', reps: '10-12', rir: '2', rest: '120' },
          { name: 'Press Militar', muscle: 'Hombros', sets: '2', reps: '12-15', rir: '2', rest: '90' },
          { name: 'Curl Bíceps', muscle: 'Bíceps', sets: '2', reps: '12-15', rir: '2', rest: '90' }
        ]
      },
      {
        label: 'Día 2: Full Body B',
        exercises: [
          { name: 'Peso Muerto Rumano', muscle: 'Isquiosurales', sets: '3', reps: '10-12', rir: '2', rest: '120' },
          { name: 'Press Inclinado Mancuernas', muscle: 'Pecho', sets: '3', reps: '10-12', rir: '2', rest: '120' },
          { name: 'Jalón al Pecho', muscle: 'Espalda', sets: '3', reps: '10-12', rir: '2', rest: '120' },
          { name: 'Elevaciones Laterales', muscle: 'Hombros', sets: '2', reps: '15', rir: '2', rest: '90' },
          { name: 'Extensión Tríceps', muscle: 'Tríceps', sets: '2', reps: '12-15', rir: '2', rest: '90' }
        ]
      },
      {
        label: 'Día 3: Full Body C',
        exercises: [
          { name: 'Prensa', muscle: 'Cuádriceps', sets: '3', reps: '12-15', rir: '2', rest: '120' },
          { name: 'Fondos', muscle: 'Pecho', sets: '3', reps: '10-12', rir: '2', rest: '120' },
          { name: 'Remo en Polea', muscle: 'Espalda', sets: '3', reps: '10-12', rir: '2', rest: '120' },
          { name: 'Elevación Talones', muscle: 'Pantorrillas', sets: '3', reps: '15-20', rir: '2', rest: '90' },
          { name: 'Plancha', muscle: 'Core', sets: '3', reps: '60s', rir: '2', rest: '90' }
        ]
      }
    ]
  },
  {
    id: 'hyp-int-ul-4',
    name: 'Upper / Lower (4 Días)',
    objective: 'hipertrofia',
    level: 'intermedio',
    daysPerWeek: 4,
    description: 'División Torso/Pierna (Frecuencia 2) ideal para el grueso de los atletas intermedios.',
    scienceGuide: 'El estándar de oro para hipertrofia en intermedios. Permite acumular el volumen necesario (MAV) por sesión sin llegar al volumen basura (junk volume). Al dividir el cuerpo en dos, podemos concentrar mayor estrés metabólico por sesión y tener 3 días de descanso completo.',
    recommendedSchedule: [0, 1, -1, 2, 3, -1, -1],
    days: [
      {
        label: 'Día 1: Torso (Fuerza/Hip)',
        exercises: [
          { name: 'Press de Banca', muscle: 'Pecho', sets: '4', reps: '6-8', rir: '1-2', rest: '180' },
          { name: 'Remo con Barra', muscle: 'Espalda', sets: '4', reps: '8-10', rir: '1-2', rest: '120' },
          { name: 'Press Militar', muscle: 'Hombros', sets: '3', reps: '8-10', rir: '2', rest: '120' },
          { name: 'Curl Bíceps', muscle: 'Bíceps', sets: '3', reps: '12-15', rir: '1-2', rest: '90' },
          { name: 'Extensión Tríceps', muscle: 'Tríceps', sets: '3', reps: '12-15', rir: '1-2', rest: '90' }
        ]
      },
      {
        label: 'Día 2: Pierna (Fuerza/Hip)',
        exercises: [
          { name: 'Sentadilla', muscle: 'Cuádriceps', sets: '4', reps: '6-8', rir: '1-2', rest: '180' },
          { name: 'Peso Muerto Rumano', muscle: 'Isquiosurales', sets: '4', reps: '8-10', rir: '1-2', rest: '180' },
          { name: 'Zancadas', muscle: 'Cuádriceps', sets: '3', reps: '10-12', rir: '2', rest: '120' },
          { name: 'Elevación Talones Pie', muscle: 'Pantorrillas', sets: '4', reps: '12-15', rir: '1-2', rest: '90' },
          { name: 'Crunch Abdominal', muscle: 'Core', sets: '3', reps: '15-20', rir: '1-2', rest: '90' }
        ]
      },
      {
        label: 'Día 3: Torso (Hipertrofia Pura)',
        exercises: [
          { name: 'Press Inclinado Mancuernas', muscle: 'Pecho', sets: '4', reps: '10-12', rir: '1', rest: '120' },
          { name: 'Jalón al Pecho', muscle: 'Espalda', sets: '4', reps: '10-12', rir: '1', rest: '120' },
          { name: 'Cruces en Polea', muscle: 'Pecho', sets: '3', reps: '15-20', rir: '0-1', rest: '90' },
          { name: 'Elevaciones Laterales', muscle: 'Hombros', sets: '4', reps: '15-20', rir: '1', rest: '90' },
          { name: 'Curl Martillo', muscle: 'Bíceps', sets: '3', reps: '12-15', rir: '1', rest: '90' }
        ]
      },
      {
        label: 'Día 4: Pierna (Hipertrofia Pura)',
        exercises: [
          { name: 'Prensa', muscle: 'Cuádriceps', sets: '4', reps: '12-15', rir: '1', rest: '120' },
          { name: 'Curl Femoral Tumbado', muscle: 'Isquiosurales', sets: '4', reps: '12-15', rir: '1', rest: '120' },
          { name: 'Extensión Cuádriceps', muscle: 'Cuádriceps', sets: '3', reps: '15-20', rir: '0-1', rest: '90' },
          { name: 'Hip Thrust', muscle: 'Glúteos', sets: '3', reps: '10-12', rir: '1-2', rest: '120' },
          { name: 'Elevación Talones Sentado', muscle: 'Pantorrillas', sets: '4', reps: '15-20', rir: '1', rest: '90' }
        ]
      }
    ]
  },
  {
    id: 'hyp-adv-ppl-6',
    name: 'Push / Pull / Legs (6 Días)',
    objective: 'hipertrofia',
    level: 'avanzado',
    daysPerWeek: 6,
    description: 'Esquema de alto volumen (Frecuencia 2) para romper resistencia anabólica.',
    scienceGuide: 'Los atletas avanzados necesitan alcanzar un MEV mucho mayor para siquiera desencadenar hipertrofia. Este esquema distribuye ese altísimo volumen (20+ series semanales por músculo) a lo largo de 6 días para evitar fatiga periférica excesiva en una sola sesión.',
    recommendedSchedule: [0, 1, 2, 3, 4, 5, -1],
    days: [
      {
        label: 'Día 1: Push (Pesado)',
        exercises: [
          { name: 'Press de Banca', muscle: 'Pecho', sets: '4', reps: '5-8', rir: '1', rest: '180' },
          { name: 'Press Militar Sentado', muscle: 'Hombros', sets: '4', reps: '8-10', rir: '1-2', rest: '120' },
          { name: 'Press Inclinado Mancuernas', muscle: 'Pecho', sets: '3', reps: '10-12', rir: '1', rest: '120' },
          { name: 'Elevaciones Laterales', muscle: 'Hombros', sets: '4', reps: '15-20', rir: '1', rest: '90' },
          { name: 'Extensión Tríceps Polea', muscle: 'Tríceps', sets: '4', reps: '10-12', rir: '1', rest: '90' }
        ]
      },
      {
        label: 'Día 2: Pull (Pesado)',
        exercises: [
          { name: 'Peso Muerto', muscle: 'Espalda', sets: '3', reps: '5-8', rir: '1-2', rest: '240' },
          { name: 'Dominadas', muscle: 'Espalda', sets: '4', reps: '8-10', rir: '1-2', rest: '120' },
          { name: 'Remo Gironda', muscle: 'Espalda', sets: '3', reps: '10-12', rir: '1', rest: '120' },
          { name: 'Pájaros', muscle: 'Hombros', sets: '3', reps: '15', rir: '1', rest: '90' },
          { name: 'Curl Bíceps Barra', muscle: 'Bíceps', sets: '4', reps: '10-12', rir: '1', rest: '90' }
        ]
      },
      {
        label: 'Día 3: Legs (Pesado)',
        exercises: [
          { name: 'Sentadilla', muscle: 'Cuádriceps', sets: '4', reps: '5-8', rir: '1-2', rest: '240' },
          { name: 'Prensa', muscle: 'Cuádriceps', sets: '3', reps: '10-12', rir: '1-2', rest: '180' },
          { name: 'Curl Femoral Tumbado', muscle: 'Isquiosurales', sets: '4', reps: '10-12', rir: '1', rest: '120' },
          { name: 'Elevación Talones Pie', muscle: 'Pantorrillas', sets: '5', reps: '12-15', rir: '1', rest: '90' }
        ]
      },
      {
        label: 'Día 4: Push (Hipertrofia)',
        exercises: [
          { name: 'Press Inclinado Barra', muscle: 'Pecho', sets: '4', reps: '10-12', rir: '1', rest: '120' },
          { name: 'Press Plano Mancuernas', muscle: 'Pecho', sets: '3', reps: '12-15', rir: '0-1', rest: '120' },
          { name: 'Cruces en Polea', muscle: 'Pecho', sets: '3', reps: '15-20', rir: '0', rest: '90' },
          { name: 'Elevaciones Laterales Cable', muscle: 'Hombros', sets: '4', reps: '15-20', rir: '0-1', rest: '90' },
          { name: 'Press Francés', muscle: 'Tríceps', sets: '4', reps: '12-15', rir: '1', rest: '90' }
        ]
      },
      {
        label: 'Día 5: Pull (Hipertrofia)',
        exercises: [
          { name: 'Jalón al Pecho', muscle: 'Espalda', sets: '4', reps: '10-12', rir: '1', rest: '120' },
          { name: 'Remo con Mancuerna', muscle: 'Espalda', sets: '3', reps: '10-12', rir: '1', rest: '120' },
          { name: 'Pullover Polea', muscle: 'Espalda', sets: '3', reps: '15-20', rir: '0-1', rest: '90' },
          { name: 'Facepull', muscle: 'Hombros', sets: '4', reps: '15-20', rir: '1', rest: '90' },
          { name: 'Curl Predicador', muscle: 'Bíceps', sets: '4', reps: '12-15', rir: '0-1', rest: '90' }
        ]
      },
      {
        label: 'Día 6: Legs (Hipertrofia)',
        exercises: [
          { name: 'Sentadilla Hack', muscle: 'Cuádriceps', sets: '4', reps: '10-12', rir: '1', rest: '180' },
          { name: 'Extensión Cuádriceps', muscle: 'Cuádriceps', sets: '4', reps: '15-20', rir: '0-1', rest: '90' },
          { name: 'Peso Muerto Rumano', muscle: 'Isquiosurales', sets: '3', reps: '10-12', rir: '1', rest: '180' },
          { name: 'Curl Femoral Sentado', muscle: 'Isquiosurales', sets: '3', reps: '15-20', rir: '0-1', rest: '90' },
          { name: 'Elevación Talones Sentado', muscle: 'Pantorrillas', sets: '5', reps: '15-20', rir: '0-1', rest: '90' }
        ]
      }
    ]
  },

  // ============================================
  // FUERZA
  // ============================================
  {
    id: 'str-beg-5x5-3',
    name: 'Linear Progression 5x5 (3 Días)',
    objective: 'fuerza',
    level: 'principiante',
    daysPerWeek: 3,
    description: 'Ganancia rápida de fuerza base mediante adaptación neurológica en los 3 básicos.',
    scienceGuide: 'Los principiantes no necesitan esquemas complejos (DUP, etc) para ganar fuerza. Al repetir el mismo estímulo (5 series de 5 reps pesadas) 3 veces por semana, el sistema nervioso "aprende" a reclutar las unidades motoras rápidamente, logrando récords en cada sesión sin sobreentrenar.',
    recommendedSchedule: [0, -1, 1, -1, 2, -1, -1],
    days: [
      {
        label: 'Día 1: Workout A',
        exercises: [
          { name: 'Sentadilla', muscle: 'Cuádriceps', sets: '5', reps: '5', rir: '1-2', rest: '180' },
          { name: 'Press de Banca', muscle: 'Pecho', sets: '5', reps: '5', rir: '1-2', rest: '180' },
          { name: 'Remo con Barra', muscle: 'Espalda', sets: '5', reps: '5', rir: '1-2', rest: '180' },
          { name: 'Plancha', muscle: 'Core', sets: '3', reps: '60s', rir: '2', rest: '90' }
        ]
      },
      {
        label: 'Día 2: Workout B',
        exercises: [
          { name: 'Sentadilla', muscle: 'Cuádriceps', sets: '5', reps: '5', rir: '1-2', rest: '180' },
          { name: 'Press Militar', muscle: 'Hombros', sets: '5', reps: '5', rir: '1-2', rest: '180' },
          { name: 'Peso Muerto', muscle: 'Isquiosurales', sets: '1', reps: '5', rir: '1', rest: '240' }, // Sólo 1 serie pesada de DL en 5x5 clásico
          { name: 'Dominadas Supinas', muscle: 'Espalda', sets: '3', reps: '8-10', rir: '2', rest: '120' }
        ]
      },
      {
        label: 'Día 3: Workout A',
        exercises: [
          { name: 'Sentadilla', muscle: 'Cuádriceps', sets: '5', reps: '5', rir: '1-2', rest: '180' },
          { name: 'Press de Banca', muscle: 'Pecho', sets: '5', reps: '5', rir: '1-2', rest: '180' },
          { name: 'Remo con Barra', muscle: 'Espalda', sets: '5', reps: '5', rir: '1-2', rest: '180' },
          { name: 'Elevación Talones', muscle: 'Pantorrillas', sets: '3', reps: '15', rir: '2', rest: '90' }
        ]
      }
    ]
  },
  {
    id: 'str-int-dup-4',
    name: 'Ondulante Diario (DUP) (4 Días)',
    objective: 'fuerza',
    level: 'intermedio',
    daysPerWeek: 4,
    description: 'Alternancia de intensidades (Hipertrofia, Potencia, Fuerza Máxima) intresemanal.',
    scienceGuide: 'Un intermedio ya no puede subir peso linealmente cada sesión. El DUP (Daily Undulating Periodization) engaña a la homeostasis cambiando el estímulo en cada sesión: un día haces volumen (series de 8), otro potencia (series de 3), y otro fuerza pesada (series de 5), maximizando adaptaciones sin estallar el SNC.',
    recommendedSchedule: [0, -1, 1, 2, -1, 3, -1],
    days: [
      {
        label: 'Día 1: Torso (Volumen)',
        exercises: [
          { name: 'Press de Banca', muscle: 'Pecho', sets: '4', reps: '8', rir: '2', rest: '180' },
          { name: 'Remo con Barra', muscle: 'Espalda', sets: '4', reps: '8', rir: '2', rest: '120' },
          { name: 'Press Militar', muscle: 'Hombros', sets: '3', reps: '10', rir: '2', rest: '120' },
          { name: 'Tríceps Polea', muscle: 'Tríceps', sets: '3', reps: '12', rir: '1-2', rest: '90' }
        ]
      },
      {
        label: 'Día 2: Pierna (Potencia)',
        exercises: [
          { name: 'Sentadilla', muscle: 'Cuádriceps', sets: '5', reps: '3', rir: '3', rest: '180' }, // Explosivo
          { name: 'Peso Muerto', muscle: 'Isquiosurales', sets: '3', reps: '3', rir: '3', rest: '180' }, // Explosivo
          { name: 'Prensa', muscle: 'Cuádriceps', sets: '3', reps: '10', rir: '2', rest: '120' },
          { name: 'Elevación Talones', muscle: 'Pantorrillas', sets: '4', reps: '15', rir: '2', rest: '90' }
        ]
      },
      {
        label: 'Día 3: Torso (Fuerza)',
        exercises: [
          { name: 'Press de Banca', muscle: 'Pecho', sets: '5', reps: '4', rir: '1', rest: '240' }, // Pesado
          { name: 'Dominadas Lastradas', muscle: 'Espalda', sets: '4', reps: '5', rir: '1-2', rest: '180' },
          { name: 'Press Inclinado', muscle: 'Pecho', sets: '3', reps: '8', rir: '2', rest: '120' },
          { name: 'Curl Bíceps', muscle: 'Bíceps', sets: '3', reps: '10', rir: '2', rest: '90' }
        ]
      },
      {
        label: 'Día 4: Pierna (Fuerza)',
        exercises: [
          { name: 'Sentadilla', muscle: 'Cuádriceps', sets: '5', reps: '4', rir: '1', rest: '240' }, // Pesado
          { name: 'Peso Muerto Rumano', muscle: 'Isquiosurales', sets: '4', reps: '6', rir: '1-2', rest: '180' },
          { name: 'Zancadas', muscle: 'Cuádriceps', sets: '3', reps: '8', rir: '2', rest: '120' },
          { name: 'Plancha Lastrada', muscle: 'Core', sets: '3', reps: '45s', rir: '2', rest: '90' }
        ]
      }
    ]
  },

  {
    id: 'str-adv-conj-4',
    name: 'Sistema Conjugado (4 Días)',
    objective: 'fuerza',
    level: 'avanzado',
    daysPerWeek: 4,
    description: 'Protocolo élite de fuerza alternando Días de Esfuerzo Máximo (ME) y Esfuerzo Dinámico (DE).',
    scienceGuide: 'Un atleta avanzado tiene un sistema nervioso altamente adaptado. No puede ir pesado todo el tiempo. El sistema Conjugado rota los levantamientos principales semanalmente en los días Max Effort (para engañar al SNC y evitar estancamiento) e incluye días Dynamic Effort al 50-60% de la 1RM con bandas o cadenas para desarrollar la máxima tasa de producción de fuerza (RFD).',
    recommendedSchedule: [0, -1, 1, -1, 2, 3, -1],
    days: [
      {
        label: 'Día 1: Max Effort Torso',
        exercises: [
          { name: 'Press de Banca Pesado (Variación)', muscle: 'Pecho', sets: '1', reps: '1-3', rir: '0', rest: '300' },
          { name: 'Press Inclinado con Mancuernas', muscle: 'Pecho', sets: '3', reps: '8-10', rir: '1-2', rest: '120' },
          { name: 'Remo Pesado', muscle: 'Espalda', sets: '4', reps: '6-8', rir: '1-2', rest: '120' },
          { name: 'Extensión Tríceps Pesada', muscle: 'Tríceps', sets: '4', reps: '8-10', rir: '1', rest: '90' }
        ]
      },
      {
        label: 'Día 2: Max Effort Pierna',
        exercises: [
          { name: 'Sentadilla o Peso Muerto Pesado', muscle: 'Cuádriceps', sets: '1', reps: '1-3', rir: '0', rest: '300' },
          { name: 'Sentadilla Búlgara', muscle: 'Cuádriceps', sets: '3', reps: '8-10', rir: '1-2', rest: '120' },
          { name: 'Peso Muerto Rumano', muscle: 'Isquiosurales', sets: '4', reps: '6-8', rir: '1-2', rest: '120' },
          { name: 'Ab Wheel / Plancha', muscle: 'Core', sets: '4', reps: '10-15', rir: '1-2', rest: '90' }
        ]
      },
      {
        label: 'Día 3: Dynamic Effort Torso',
        exercises: [
          { name: 'Press de Banca Explosivo', muscle: 'Pecho', sets: '9', reps: '3', rir: '4-5', rest: '60' }, // 50-60% 1RM
          { name: 'Press Militar con Mancuernas', muscle: 'Hombros', sets: '3', reps: '10-12', rir: '1-2', rest: '120' },
          { name: 'Dominadas Rápidas', muscle: 'Espalda', sets: '4', reps: '6-8', rir: '2', rest: '90' },
          { name: 'Facepull', muscle: 'Hombros', sets: '3', reps: '15', rir: '1', rest: '90' }
        ]
      },
      {
        label: 'Día 4: Dynamic Effort Pierna',
        exercises: [
          { name: 'Sentadilla Explosiva', muscle: 'Cuádriceps', sets: '10', reps: '2', rir: '4-5', rest: '60' }, // 50-60% 1RM
          { name: 'Peso Muerto Explosivo', muscle: 'Isquiosurales', sets: '6', reps: '2', rir: '4-5', rest: '60' },
          { name: 'Prensa Ligera', muscle: 'Cuádriceps', sets: '3', reps: '12-15', rir: '2', rest: '90' },
          { name: 'Elevación Talones', muscle: 'Pantorrillas', sets: '4', reps: '15-20', rir: '1', rest: '90' }
        ]
      }
    ]
  },
  // ============================================
  // MANTENIMIENTO / FAT LOSS
  // ============================================
  {
    id: 'mnt-all-heavy-3',
    name: 'Fat Loss / Retención Muscular (3 Días)',
    objective: 'mantenimiento', // Sirve para Fat Loss
    level: 'intermedio', // works for all mostly
    daysPerWeek: 3,
    description: 'Protocolo de déficit calórico: Bajo volumen, altísima intensidad para retener músculo.',
    scienceGuide: 'En déficit calórico severo (Fat Loss), la recuperación muscular se desploma. Si intentas hacer 20 series por músculo, te vas a sobreentrenar y perderás músculo. Este protocolo recorta el volumen (series) al MEV, pero mantiene la intensidad de carga muy alta (RIR 1, reps bajas) para obligar al cuerpo a no destruir el tejido contráctil.',
    days: [
      {
        label: 'Día 1: Full Body Pesado',
        exercises: [
          { name: 'Sentadilla', muscle: 'Cuádriceps', sets: '2', reps: '5-8', rir: '1-2', rest: '180' },
          { name: 'Press de Banca', muscle: 'Pecho', sets: '2', reps: '5-8', rir: '1-2', rest: '180' },
          { name: 'Remo con Barra', muscle: 'Espalda', sets: '2', reps: '6-8', rir: '1-2', rest: '180' },
          { name: 'Curl Bíceps', muscle: 'Bíceps', sets: '2', reps: '10-12', rir: '1-2', rest: '90' }
        ]
      },
      {
        label: 'Día 2: Full Body Metabólico',
        exercises: [
          { name: 'Zancadas Búlgaras', muscle: 'Cuádriceps', sets: '2', reps: '10-12', rir: '1-2', rest: '120' },
          { name: 'Press Inclinado Mancuernas', muscle: 'Pecho', sets: '2', reps: '10-12', rir: '1-2', rest: '120' },
          { name: 'Jalón al Pecho', muscle: 'Espalda', sets: '2', reps: '10-12', rir: '1-2', rest: '120' },
          { name: 'Elevaciones Laterales', muscle: 'Hombros', sets: '2', reps: '12-15', rir: '1-2', rest: '90' }
        ]
      },
      {
        label: 'Día 3: Full Body Pesado Posterior',
        exercises: [
          { name: 'Peso Muerto Rumano', muscle: 'Isquiosurales', sets: '2', reps: '5-8', rir: '1-2', rest: '180' },
          { name: 'Press Militar', muscle: 'Hombros', sets: '2', reps: '6-8', rir: '1-2', rest: '180' },
          { name: 'Dominadas Lastradas', muscle: 'Espalda', sets: '2', reps: '6-8', rir: '1-2', rest: '180' },
          { name: 'Extensión Tríceps', muscle: 'Tríceps', sets: '2', reps: '10-12', rir: '1-2', rest: '90' }
        ]
      }
    ]
  }
];

export const getProtocolsForContext = (objective: BlockObjective, level: AthleteLevel): ProtocolTemplate[] => {
  // First match strictly by objective
  let matches = PROTOCOL_LIBRARY.filter(p => p.objective === objective);
  
  // If it's a specific objective where level matters immensely (like Strength/Hypertrophy)
  // we could strictly filter by level too, but let's allow nearby levels if none match perfectly.
  const levelMatches = matches.filter(p => p.level === level);
  if (levelMatches.length > 0) {
    return levelMatches;
  }
  
  // Fallback: return any protocol matching the objective
  return matches;
};
