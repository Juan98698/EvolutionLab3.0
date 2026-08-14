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
