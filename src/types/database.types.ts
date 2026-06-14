// Interfaces TypeScript para la base de datos de Supabase de Evolution Lab

export interface Profile {
  id: string; // uuid
  email: string;
  nombre: string;
  rol: 'admin' | 'entrenador' | 'cliente';
  objetivo?: string | null;
  fecha_inicio?: string | null; // date
  vigencia_dias?: number;
  created_at?: string;
  filosofia?: FilosofiaPilar[] | null;
  marca?: MarcaConfig | null;
  logo_url?: string | null;
  entrenador_id?: string | null;
  suscripcion_plan?: 'free' | 'iniciacion' | 'intermedio' | 'profesional' | 'premium';
  suscripcion_estado?: 'activo' | 'expirado' | 'cancelado';
  suscripcion_expira_at?: string | null;
}

export interface FilosofiaPilar {
  id: string;
  titulo: string;
  descripcion: string;
  icono: string; // emoji or icon name
}

export interface MarcaConfig {
  nombre_display: string;
  color_primario: string;
  color_secundario: string;
  tipografia: 'Inter' | 'Outfit' | 'Montserrat' | 'Bebas Neue' | 'Oswald' | 'Orbitron' | 'Rajdhani' | 'Chakra Petch';
  eslogan?: string;
  whatsapp?: string;
}

export interface Plan {
  id: string; // uuid
  cliente_id: string;
  creador_id?: string | null; // uuid
  activo: boolean;
  datos_plan: PlanData;
  created_at?: string;
}

export interface PlanData {
  portada?: {
    userName?: string;
    userGoal?: string;
    startDate?: string;
    planVigenciaPlan?: string;
    trainerName?: string;
    whatsappLink?: string;
    instagramLink?: string;
    globalNote?: string;
    trainerEslogan?: string;
  };
  globalVariables?: GlobalVariable[];
  variableDefinitions?: Record<string, string>;
  trainingDays?: TrainingDay[];
  weekdayMapping?: Record<string, number>;
  trackerConfig?: TrackerConfig;
  trackerRules?: TrackerRule[];
}

export interface GlobalVariable {
  id: string;
  label: string;
  type: string;
  defaultValue: string;
}

export interface TrainingDay {
  id: string;
  name: string;
  exercises: Exercise[];
}

export interface Exercise {
  id: string;
  nombre: string;
  nombre_original?: string;
  variables: Record<string, string>;
  video_url?: string;
  image_url?: string;
  gif_url?: string;
  completed?: boolean;
  description?: string;
  grupo_muscular?: string;
  progression_notes?: string;
  progression_type?: 'linear' | 'double' | 'undulating' | 'deload';
  progression_params?: Record<string, any>;
}

export interface TrackerConfig {
  minSesiones?: number;
  ventana?: number;
  diasDescansoExcesivo?: number;
  diasOptimo?: number;
  sesionesRegresionAlerta?: number;
  sesionesEstancamiento?: number;
}

export interface TrackerRule {
  id: string;
  title: string;
  msg: string;
  enabled: boolean;
}

/** Nueva interfaz para reglas de sobrecarga progresiva */
export interface Rule {
  id: string;
  tipo: 'subir' | 'bajar' | 'mantener' | 'info' | 'descanso' | 'cambio';
  activa: boolean;
  titulo: string;
  mensaje: string;
  rir_umbral?: number;
  sesiones_consecutivas?: number;
  incremento_porciento?: number;
  incremento_minimo_kg?: number;
  reps_por_ejercicio?: Record<string, number>;
  series_minimas_pct?: number;
  umbral_crecimiento_vol?: number;
  umbral_estabilidad?: number;
  rir_umbral_bajo?: number;
  reduccion_porciento?: number;
  umbral_descanso_alto?: number;
  sesiones_sin_mejora_peso_reps?: number;
  sesiones_racha?: number;
  semanas_consecutivas?: number;
}

export interface DiaPlan {
  id: string; // uuid
  plan_id: string; // uuid
  nombre: string;
  orden: number;
  weekday_mapping: Record<string, number>;
  created_at?: string;
}

export interface EjercicioPlan {
  id: string; // uuid
  dia_id: string; // uuid
  nombre: string;
  variables: Record<string, any>;
  video_url?: string | null;
  image_url?: string | null;
  gif_url?: string | null;
  orden: number;
  created_at?: string;
}

export interface SesionHistorial {
  id: string; // uuid (o string temporal local en offline)
  cliente_id: string;
  fecha: string; // YYYY-MM-DD
  notas_generales?: string | null;
  created_at?: string;
}

export interface SesionEjercicio {
  id: string; // uuid
  sesion_id: string; // uuid
  nombre_ejercicio: string;
  grupo_muscular?: string | null;
  series_reps: number[]; // Array de repeticiones de las series completadas
  peso: number;
  rpe_rir: number;
  descanso: number;
  volumen: number;
  rm_estimado: number;
  created_at?: string;
}

// Interfaz para la sesión en el estado local de la app
export interface LocalSesion {
  id: string | number; // UUID en DB, número autoincrementable en offline temporal
  fecha: string;
  notas_sesion: string;
  ejercicios: LocalSesionEjercicio[];
}

export interface LocalSesionEjercicio {
  id_ej: string | number; // UUID en DB, número autoincrementable en offline
  nombre: string;
  grupo: string;
  peso: number;
  repsArray: number[];
  rpe: number;
  descanso: number;
  notas_ej?: string;
}

export interface EjercicioGlobal {
  id: string;
  nombre: string;
  grupo_muscular: string;
  imagen_url?: string | null;
  descripcion?: string | null;
  created_at?: string;
}

export interface Logro {
  id: string;
  cliente_id: string;
  tipo: 'racha' | 'insignia' | 'logro' | 'pr';
  titulo: string;
  descripcion?: string | null;
  valor: number;
  fecha: string;
  datos?: Record<string, unknown>;
}

export interface SugerenciaPreWorkout {
  ejercicio: string;
  tipo: 'peso' | 'reps' | 'descanso' | 'general';
  titulo: string;
  mensaje: string;
  valor_actual: number;
  valor_sugerido: number;
  unidad: string;
}

export interface Suscripcion {
  id: string;
  cliente_id: string;
  tipo: 'free' | 'premium';
  estado: 'activa' | 'cancelada' | 'expirada';
  fecha_inicio?: string;
  fecha_expiracion?: string | null;
  created_at?: string;
}
