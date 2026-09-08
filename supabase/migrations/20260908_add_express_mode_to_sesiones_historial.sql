-- ============================================================================
-- MIGRACIÓN ADITIVA: Soporte de Modo Express y Auditoría de Bloques en sesiones_historial
-- ============================================================================

-- 1. Añadir columnas a sesiones_historial
ALTER TABLE public.sesiones_historial
  ADD COLUMN IF NOT EXISTS express_mode boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS express_blocks jsonb DEFAULT '[]'::jsonb;

-- 2. Índice parcial para auditorías y reportes de sesiones que usaron Modo Express
CREATE INDEX IF NOT EXISTS idx_sesiones_historial_express_mode
  ON public.sesiones_historial(cliente_id, fecha DESC)
  WHERE express_mode = true;
