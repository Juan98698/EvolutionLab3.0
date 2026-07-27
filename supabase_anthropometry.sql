-- ============================================================================
-- Módulo de Valoraciones Antropométricas, Composición Corporal y Marca Blanca
-- ============================================================================

-- 1. Agregar columna de sexo/género a la tabla profiles si no existe
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS sexo VARCHAR(20) DEFAULT 'masculino';

-- 2. Crear tabla de valoraciones antropométricas
CREATE TABLE IF NOT EXISTS public.valoraciones_antropometricas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  entrenador_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  edad INT NOT NULL,
  peso NUMERIC(5,2) NOT NULL,
  estatura NUMERIC(5,2) NOT NULL,
  estatura_sentado NUMERIC(5,2),
  genero VARCHAR(20) NOT NULL DEFAULT 'masculino',
  metodo VARCHAR(50) NOT NULL DEFAULT 'Yuhasz', -- 'Yuhasz' | 'Faulkner' | 'ISAK'
  objetivo VARCHAR(100),
  frecuencia_entreno VARCHAR(50),
  
  -- Pliegues cutáneos (mm)
  pliegues JSONB DEFAULT '{}'::jsonb,
  -- Perímetros (cm)
  perimetros JSONB DEFAULT '{}'::jsonb,
  -- Diámetros (cm)
  diametros JSONB DEFAULT '{}'::jsonb,
  
  -- Resultados calculados de composición corporal (4 masas)
  imc NUMERIC(4,2),
  clasificacion_imc VARCHAR(50),
  pct_grasa NUMERIC(4,2),
  clasificacion_grasa VARCHAR(50),
  kg_grasa NUMERIC(5,2),
  pct_musculo NUMERIC(4,2),
  clasificacion_musculo VARCHAR(50),
  kg_musculo NUMERIC(5,2),
  pct_oseo NUMERIC(4,2),
  kg_oseo NUMERIC(5,2),
  pct_residual NUMERIC(4,2),
  kg_residual NUMERIC(5,2),
  ratio_musculo_grasa NUMERIC(4,2),
  
  -- Somatotipo Heath-Carter (Endomorfia, Mesomorfia, Ectomorfia, Coordenadas X, Y)
  somatotipo JSONB DEFAULT '{}'::jsonb,
  
  -- Metabolismo & Prescripción de Macronutrientes
  bmr INT,
  tdee INT,
  target_calorias INT,
  ajuste_calorico_pct NUMERIC(4,2) DEFAULT 0,
  macros JSONB DEFAULT '{}'::jsonb,
  
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Habilitar RLS (Row Level Security)
ALTER TABLE public.valoraciones_antropometricas ENABLE ROW LEVEL SECURITY;

-- 4. Políticas de Seguridad RLS consistentes con es_entrenador()
DROP POLICY IF EXISTS "Ver valoraciones propia o de atletas" ON public.valoraciones_antropometricas;
CREATE POLICY "Ver valoraciones propia o de atletas"
  ON public.valoraciones_antropometricas FOR SELECT
  USING (auth.uid() = cliente_id OR public.es_entrenador(auth.uid()));

DROP POLICY IF EXISTS "Crear valoraciones" ON public.valoraciones_antropometricas;
CREATE POLICY "Crear valoraciones"
  ON public.valoraciones_antropometricas FOR INSERT
  WITH CHECK (auth.uid() = cliente_id OR public.es_entrenador(auth.uid()));

DROP POLICY IF EXISTS "Actualizar valoraciones" ON public.valoraciones_antropometricas;
CREATE POLICY "Actualizar valoraciones"
  ON public.valoraciones_antropometricas FOR UPDATE
  USING (auth.uid() = cliente_id OR public.es_entrenador(auth.uid()));
