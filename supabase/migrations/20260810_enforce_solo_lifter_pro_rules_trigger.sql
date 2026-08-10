-- Migration: Trigger de Postgres para el Gate Fino de Solo Lifter Pro en datos_plan
-- Date: 2026-08-10

-- 1. Crear función del Trigger BEFORE UPDATE para inspeccionar cambios específicos en JSONB
CREATE OR REPLACE FUNCTION public.validar_solo_lifter_pro_rules_trigger()
RETURNS TRIGGER AS $$
BEGIN
  -- Solo inspeccionar la actualización cuando sea realizada por el propio atleta independiente
  IF auth.uid() IS NOT NULL AND NEW.cliente_id = auth.uid() AND (NEW.creador_id IS NULL OR NEW.creador_id = NEW.cliente_id) THEN
    
    -- Verificar si hubo modificación en las llaves del motor de sobrecarga (trackerRules o periodizationConfig)
    IF (
      (OLD.datos_plan->'trackerRules' IS DISTINCT FROM NEW.datos_plan->'trackerRules')
      OR (OLD.datos_plan->'periodizationConfig' IS DISTINCT FROM NEW.datos_plan->'periodizationConfig')
    ) THEN
      
      -- Si intentó modificar reglas de sobrecarga sin poseer el plan Solo Lifter Pro activo, rechazar con excepción
      IF NOT public.es_solo_lifter_pro(auth.uid()) THEN
        RAISE EXCEPTION 'Acceso denegado: La personalización de las reglas de sobrecarga requiere la suscripción activa a Solo Lifter Pro.'
          USING ERRCODE = '42501';
      END IF;

    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Limpieza idempotente del trigger previo
DROP TRIGGER IF EXISTS check_solo_lifter_pro_rules ON public.planes;

-- 3. Crear el Trigger BEFORE UPDATE en la tabla planes
CREATE TRIGGER check_solo_lifter_pro_rules
  BEFORE UPDATE ON public.planes
  FOR EACH ROW
  EXECUTE FUNCTION public.validar_solo_lifter_pro_rules_trigger();
