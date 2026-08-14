-- ============================================================================
-- MIGRACIÓN ADITIVA: Soporte de Ejercicios Funcionales y HIIT (V1)
-- ============================================================================

-- 1. Extensión de la tabla ejercicios_globales
ALTER TABLE ejercicios_globales 
  ADD COLUMN IF NOT EXISTS categoria TEXT DEFAULT 'musculacion',
  ADD COLUMN IF NOT EXISTS subcategoria_funcional TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS tipo_metrica TEXT DEFAULT 'peso_reps',
  ADD COLUMN IF NOT EXISTS musculos_secundarios TEXT[] DEFAULT '{}';

-- Índices optimizados para filtrado en la Biblioteca
CREATE INDEX IF NOT EXISTS idx_ejercicios_categoria ON ejercicios_globales(categoria);
CREATE INDEX IF NOT EXISTS idx_ejercicios_subcategoria ON ejercicios_globales(subcategoria_funcional);

-- 2. Modificación de columnas en sesiones_ejercicios a NULLABLE
-- Permite guardar NULL en ejercicios funcionales donde tonelaje/1RM no aplica,
-- protegiendo la matemática SQL (SUM, AVG) y previniendo el falseamiento de RPE.
ALTER TABLE sesiones_ejercicios 
  ALTER COLUMN peso DROP NOT NULL,
  ALTER COLUMN rpe_rir DROP NOT NULL,
  ALTER COLUMN volumen DROP NOT NULL,
  ALTER COLUMN rm_estimado DROP NOT NULL;

-- 3. Inserción de catálogo inicial de ejercicios funcionales y HIIT (Semilla V1)
INSERT INTO ejercicios_globales (nombre, grupo_muscular, categoria, subcategoria_funcional, tipo_metrica, musculos_secundarios, descripcion)
VALUES 
  ('Wall Ball', 'Full Body', 'funcional', 'metabolico', 'reps_tiempo', ARRAY['Cuádriceps', 'Hombros', 'Glúteos'], 'Lanzamiento de balón medicinal a la pared desde posición de sentadilla profunda.'),
  ('Azote de Cuerda (Battle Ropes)', 'Full Body', 'funcional', 'metabolico', 'tiempo', ARRAY['Hombros', 'Core', 'Brazos'], 'Ondulaciones alternadas de cuerda pesada para acondicionamiento cardiovascular de alta intensidad.'),
  ('Burpees', 'Full Body', 'funcional', 'metabolico', 'reps_tiempo', ARRAY['Pecho', 'Cuádriceps', 'Core'], 'Ejercicio calisténico compuesto con flexión de pecho, recogida de piernas y salto vertical.'),
  ('Kettlebell Swing', 'Full Body', 'funcional', 'potencia', 'reps_tiempo', ARRAY['Glúteos', 'Isquiosurales', 'Espalda Baja'], 'Bisagra de cadera explosiva impulsando la pesa rusa a la altura de los hombros.'),
  ('Empuje de Trineo (Sled Push)', 'Full Body', 'funcional', 'potencia', 'distancia_peso', ARRAY['Cuádriceps', 'Pantorrillas', 'Glúteos'], 'Empuje de trineo con carga sobre césped sintético para potencia y resistencia láctica.')
ON CONFLICT DO NOTHING;

