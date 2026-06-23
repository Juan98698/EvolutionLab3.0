-- ============================================================================
-- EVOLUTION LAB 3.0 — MIGRATION V8: Videos de Ejercicios en Catálogo Global
-- ============================================================================
-- Ejecutar DESPUÉS de supabase_migration_v7.sql
-- Propósito:
--   1. Agregar la columna "video_url" a la tabla de catálogo global ejercicios_globales.
-- ============================================================================

-- 1. Agregar columna de video a ejercicios_globales
ALTER TABLE public.ejercicios_globales 
ADD COLUMN IF NOT EXISTS video_url text;

COMMENT ON COLUMN public.ejercicios_globales.video_url IS
  'URL remota (YouTube, Vimeo, Cloudinary, etc.) para visualizar la ejecución en video del ejercicio';
