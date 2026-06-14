-- ============================================================================
-- EVOLUTION LAB 3.0 — MIGRATION V6: Suscripciones Notificaciones Push
-- ============================================================================
-- Ejecutar DESPUÉS de supabase_migration_v5.sql
-- Propósito: Crear la tabla push_subscriptions y habilitar RLS para que los 
--            atletas puedan guardar su suscripción push del navegador de forma segura.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  subscription jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Habilitar RLS
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
DROP POLICY IF EXISTS "Los clientes pueden gestionar sus propias suscripciones push" ON public.push_subscriptions;
CREATE POLICY "Los clientes pueden gestionar sus propias suscripciones push"
  ON public.push_subscriptions
  FOR ALL
  TO authenticated
  USING (cliente_id = auth.uid())
  WITH CHECK (cliente_id = auth.uid());
