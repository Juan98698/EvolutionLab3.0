-- ============================================================================
-- EVOLUTION LAB 3.0 — MIGRATION V5: Insignias Personalizadas para Entrenadores
-- ============================================================================
-- Ejecutar DESPUÉS de supabase_migration_v4.sql
-- Propósito: Añadir columna insignias_custom a la tabla public.profiles para 
--            que los entrenadores puedan configurar logros personalizados.
-- ============================================================================

-- 1. AÑADIR COLUMNA DE INSIGNIAS PERSONALIZADAS A PROFILES
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS 
  insignias_custom jsonb DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.profiles.insignias_custom IS 
  'Listado de insignias personalizadas creadas por el entrenador en formato JSONB';
