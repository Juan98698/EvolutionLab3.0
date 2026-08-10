-- Migration: Corregir sobre-alcance del trigger de Solo Lifter Pro
-- Date: 2026-08-10 (follow-up de 20260810_enforce_solo_lifter_pro_rules_trigger.sql)
--
-- PROBLEMA DETECTADO (mismo patrón que el fix anterior, escondido en un lugar nuevo):
--
-- El trigger vigilaba cambios en `periodizationConfig` como si fuera parte de la función
-- premium de Solo Lifter Pro. Pero esa clave la escribe ActiveSession.tsx
-- (autoRegulatePlanForNextWeek, el motor de auto-regulación científica RP: avance de
-- semana_actual, deloads) -- funcionalidad GRATUITA y central, que corre para
-- absolutamente todo atleta al terminar una sesión, tenga o no Solo Lifter Pro.
--
-- Resultado: cualquier atleta solo sin Solo Lifter Pro que completara una sesión con
-- periodización científica activada (`periodizationConfig.enabled`) se encontraba con
-- el guardado de su progreso RECHAZADO por el trigger -- rompiendo otra vez la
-- funcionalidad básica y gratuita más central de la app, exactamente el mismo tipo de
-- regresión que se corrigió en 20260810_fix_overscoped_pro_gate_on_planes.sql, pero
-- esta vez en un trigger, no visible revisando solo pg_policies.
--
-- SoloConfigRules.tsx (la función premium real) escribe `trackerConfig` y
-- `trackerRules` juntos en un mismo guardado -- nunca `periodizationConfig`. Se
-- confirmó que `trackerConfig` no se escribe en ningún otro lugar del código
-- (solo se lee en AthleteDashboard.tsx), así que es seguro agregarlo al chequeo.
--
-- FIX: sacar `periodizationConfig` del trigger, agregar `trackerConfig` (el trigger
-- original solo vigilaba `trackerRules`, dejando un hueco menor donde trackerConfig
-- podía cambiar solo sin disparar el chequeo).

CREATE OR REPLACE FUNCTION public.validar_solo_lifter_pro_rules_trigger()
RETURNS TRIGGER AS $$
BEGIN
  -- Solo inspeccionar la actualización cuando sea realizada por el propio atleta independiente
  IF auth.uid() IS NOT NULL AND NEW.cliente_id = auth.uid() AND (NEW.creador_id IS NULL OR NEW.creador_id = NEW.cliente_id) THEN

    -- Verificar si hubo modificación en las llaves de la pantalla de configuración
    -- premium (trackerConfig / trackerRules). periodizationConfig NO se incluye acá:
    -- la escribe el motor de auto-regulación científica, que es gratuito.
    IF (
      (OLD.datos_plan->'trackerRules' IS DISTINCT FROM NEW.datos_plan->'trackerRules')
      OR (OLD.datos_plan->'trackerConfig' IS DISTINCT FROM NEW.datos_plan->'trackerConfig')
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

-- El trigger en sí no cambia (misma función, mismo nombre) -- CREATE OR REPLACE alcanza,
-- no hace falta recrearlo.
