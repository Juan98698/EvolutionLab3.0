-- =====================================================================
-- MIGRATION v11: Sistema de Monitoreo de Integridad de Datos (Chequeo Automático)
-- =====================================================================
-- Propósito:
-- 1. Crear las tablas necesarias para guardar alertas de integridad de
--    datos y reportes de salud de sincronización offline de los atletas.
-- 2. Crear las funciones SQL que chequean anomalías conocidas:
--    a) check_multiple_active_plans(): Más de un plan activo por cliente.
--    b) check_stale_sync_reports(): Sesiones offline sin sincronizar por más de 48hs.
-- 3. Crear notify_new_integrity_alerts() para reportar alertas.
-- =====================================================================

-- 1. Crear la tabla de alertas de integridad si no existe
CREATE TABLE IF NOT EXISTS public.data_integrity_alerts (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    tipo text NOT NULL, -- 'multiple_active_plans', 'stale_sync_reports'
    cliente_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    detalle jsonb DEFAULT '{}'::jsonb,
    resuelto boolean DEFAULT false,
    detectado_en timestamp with time zone DEFAULT now()
);

-- Habilitar RLS en alertas (por seguridad)
ALTER TABLE public.data_integrity_alerts ENABLE ROW LEVEL SECURITY;

-- 2. Crear la tabla de reportes de sincronización offline (sync_health_reports) si no existe
CREATE TABLE IF NOT EXISTS public.sync_health_reports (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    unsynced_count integer NOT NULL DEFAULT 0,
    oldest_unsynced_fecha text,
    creado_en timestamp with time zone DEFAULT now()
);

-- Habilitar RLS en sync_health_reports
ALTER TABLE public.sync_health_reports ENABLE ROW LEVEL SECURITY;

-- Las políticas de lectura/escritura para las tablas nuevas:
CREATE POLICY "Usuarios pueden insertar sus propios reportes de sincronización"
  ON public.sync_health_reports FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admin puede ver todos los reportes de sincronización"
  ON public.sync_health_reports FOR SELECT
  USING (public.es_admin(auth.uid()));

-- 3. Definir la función check_multiple_active_plans()
CREATE OR REPLACE FUNCTION public.check_multiple_active_plans()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    r record;
BEGIN
    FOR r IN
        SELECT cliente_id, count(*) as active_count
        FROM public.planes
        WHERE activo = true
        GROUP BY cliente_id
        HAVING count(*) > 1
    LOOP
        -- Insertar alerta si no hay una sin resolver para este cliente y anomalía
        IF NOT EXISTS (
            SELECT 1 FROM public.data_integrity_alerts
            WHERE cliente_id = r.cliente_id
              AND tipo = 'multiple_active_plans'
              AND resuelto = false
        ) THEN
            INSERT INTO public.data_integrity_alerts (tipo, cliente_id, detalle, resuelto, detectado_en)
            VALUES (
                'multiple_active_plans',
                r.cliente_id,
                jsonb_build_object('active_plans_count', r.active_count),
                false,
                now()
            );
        END IF;
    END LOOP;
END;
$$;

-- 4. Definir la función check_stale_sync_reports()
CREATE OR REPLACE FUNCTION public.check_stale_sync_reports()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    r record;
BEGIN
    FOR r IN
        -- Obtener el reporte más reciente de cada usuario con sesiones pendientes
        SELECT DISTINCT ON (user_id) user_id, unsynced_count, oldest_unsynced_fecha, creado_en
        FROM public.sync_health_reports
        WHERE unsynced_count > 0
        ORDER BY user_id, creado_en DESC
    LOOP
        -- Verificar si la fecha de la sesión no sincronizada más vieja tiene más de 48 horas
        -- Usamos una validación segura de casteo de fecha (YYYY-MM-DD)
        IF r.oldest_unsynced_fecha IS NOT NULL AND r.oldest_unsynced_fecha ~ '^\d{4}-\d{2}-\d{2}$' THEN
            IF (r.oldest_unsynced_fecha::date) < (now() - interval '48 hours')::date THEN
                IF NOT EXISTS (
                    SELECT 1 FROM public.data_integrity_alerts
                    WHERE cliente_id = r.user_id
                      AND tipo = 'stale_sync_reports'
                      AND resuelto = false
                ) THEN
                    INSERT INTO public.data_integrity_alerts (tipo, cliente_id, detalle, resuelto, detectado_en)
                    VALUES (
                        'stale_sync_reports',
                        r.user_id,
                        jsonb_build_object(
                            'unsynced_count', r.unsynced_count,
                            'oldest_unsynced_fecha', r.oldest_unsynced_fecha,
                            'report_created_at', r.creado_en
                        ),
                        false,
                        now()
                    );
                END IF;
            END IF;
        END IF;
    END LOOP;
END;
$$;

-- 5. Crear la función notify_new_integrity_alerts() (inicialmente con webhook marcador de posición, v12 lo refina)
CREATE OR REPLACE FUNCTION public.notify_new_integrity_alerts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Esta función será reemplazada en v12 con la configuración segura de Discord.
    RETURN;
END;
$$;
