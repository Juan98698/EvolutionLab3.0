-- Apply after the existing migrations. All changes are transactional.
BEGIN;

CREATE OR REPLACE FUNCTION public.can_access_athlete(p_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT auth.uid() IS NOT NULL AND (
    auth.uid() = p_id OR public.es_admin(auth.uid()) OR EXISTS (
      SELECT 1 FROM public.profiles p JOIN public.profiles coach ON coach.id = auth.uid()
      WHERE p.id = p_id AND p.entrenador_id = coach.id AND coach.rol = 'entrenador'
    )
  );
$$;
REVOKE ALL ON FUNCTION public.can_access_athlete(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_athlete(uuid) TO authenticated;

-- Restrictive policies are ANDed with legacy policies, so a forgotten broad
-- permissive policy cannot grant cross-coach access. Subscription gates remain.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['sesiones_historial','planes','valoraciones_antropometricas','planes_nutricionales'] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('DROP POLICY IF EXISTS account_isolation ON public.%I', t);
      EXECUTE format('CREATE POLICY account_isolation ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (public.can_access_athlete(cliente_id)) WITH CHECK (public.can_access_athlete(cliente_id))', t);
    END IF;
  END LOOP;
END $$;

DROP POLICY IF EXISTS account_isolation ON public.sesiones_ejercicios;
CREATE POLICY account_isolation ON public.sesiones_ejercicios AS RESTRICTIVE FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.sesiones_historial h WHERE h.id = sesion_id AND public.can_access_athlete(h.cliente_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.sesiones_historial h WHERE h.id = sesion_id AND public.can_access_athlete(h.cliente_id)));
DROP POLICY IF EXISTS account_isolation ON public.dias_plan;
CREATE POLICY account_isolation ON public.dias_plan AS RESTRICTIVE FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.planes p WHERE p.id = plan_id AND public.can_access_athlete(p.cliente_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.planes p WHERE p.id = plan_id AND public.can_access_athlete(p.cliente_id)));
DROP POLICY IF EXISTS account_isolation ON public.ejercicios_plan;
CREATE POLICY account_isolation ON public.ejercicios_plan AS RESTRICTIVE FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.dias_plan d JOIN public.planes p ON p.id = d.plan_id WHERE d.id = dia_id AND public.can_access_athlete(p.cliente_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.dias_plan d JOIN public.planes p ON p.id = d.plan_id WHERE d.id = dia_id AND public.can_access_athlete(p.cliente_id)));

-- Restrict existing profile grants as well as future grants.
-- Avoid recursive RLS lookups through a small security-definer helper.
CREATE OR REPLACE FUNCTION public.my_trainer_id() RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT entrenador_id FROM public.profiles WHERE id = auth.uid();
$$;
REVOKE ALL ON FUNCTION public.my_trainer_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.my_trainer_id() TO authenticated;
DROP POLICY IF EXISTS profile_read_isolation ON public.profiles;
CREATE POLICY profile_read_isolation ON public.profiles AS RESTRICTIVE FOR SELECT TO authenticated
  USING (public.can_access_athlete(id) OR id = public.my_trainer_id());
DROP POLICY IF EXISTS profile_write_isolation ON public.profiles;
CREATE POLICY profile_write_isolation ON public.profiles AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.can_access_athlete(id)) WITH CHECK (public.can_access_athlete(id));
DROP POLICY IF EXISTS profile_insert_isolation ON public.profiles;
CREATE POLICY profile_insert_isolation ON public.profiles AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.es_admin(auth.uid()));

-- Row permissions alone do not protect sensitive columns. SECURITY INVOKER is
-- deliberate: trusted service/RPC updates execute with the definer's DB role.
CREATE OR REPLACE FUNCTION public.protect_profile_privileges() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF current_user IN ('postgres', 'supabase_admin', 'service_role') OR public.es_admin(auth.uid()) THEN RETURN NEW; END IF;
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.rol IS DISTINCT FROM OLD.rol
    OR NEW.entrenador_id IS DISTINCT FROM OLD.entrenador_id
    OR NEW.suscripcion_plan IS DISTINCT FROM OLD.suscripcion_plan
    OR NEW.suscripcion_estado IS DISTINCT FROM OLD.suscripcion_estado
    OR NEW.suscripcion_expira_at IS DISTINCT FROM OLD.suscripcion_expira_at
    OR (OLD.id = auth.uid() AND (NEW.vigencia_dias IS DISTINCT FROM OLD.vigencia_dias OR NEW.fecha_inicio IS DISTINCT FROM OLD.fecha_inicio))
    OR NEW.onboarding_completado IS DISTINCT FROM OLD.onboarding_completado THEN
    RAISE EXCEPTION 'Los permisos y la suscripción solo pueden actualizarse mediante operaciones autorizadas' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS protect_profile_privileges ON public.profiles;
CREATE TRIGGER protect_profile_privileges BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.protect_profile_privileges();

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE requested_role text := new.raw_user_meta_data->>'rol'; coach_id uuid;
BEGIN
  IF requested_role NOT IN ('cliente', 'entrenador') OR requested_role IS NULL THEN requested_role := 'cliente'; END IF;
  -- A self-service invitation may only target a genuine coach, never an admin.
  IF requested_role = 'cliente' AND nullif(new.raw_user_meta_data->>'entrenador_id', '') IS NOT NULL THEN
    SELECT id INTO coach_id FROM public.profiles WHERE id = (new.raw_user_meta_data->>'entrenador_id')::uuid AND rol = 'entrenador';
    IF coach_id IS NULL THEN RAISE EXCEPTION 'Invitación de entrenador no válida'; END IF;
  END IF;
  INSERT INTO public.profiles (id, email, nombre, rol, objetivo, vigencia_dias, entrenador_id, modalidad, onboarding_completado)
  VALUES (new.id, new.email, coalesce(nullif(new.raw_user_meta_data->>'nombre', ''), 'Nuevo Atleta'), requested_role,
    new.raw_user_meta_data->>'objetivo', 30, coach_id,
    CASE WHEN new.raw_user_meta_data->>'modalidad' = 'presencial' THEN 'presencial' ELSE 'remoto' END,
    coalesce(new.raw_user_meta_data->>'rol' IN ('cliente', 'entrenador'), false));
  RETURN new;
END $$;

CREATE OR REPLACE FUNCTION public.complete_role_selection(p_rol text, p_nombre text DEFAULT NULL, p_whatsapp text DEFAULT '', p_instagram text DEFAULT '')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE result jsonb;
BEGIN
  IF auth.uid() IS NULL OR p_rol IS NULL OR p_rol NOT IN ('cliente', 'entrenador') THEN RAISE EXCEPTION 'Operación no autorizada' USING ERRCODE = '42501'; END IF;
  PERFORM 1 FROM public.profiles WHERE id = auth.uid() AND onboarding_completado = false FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'La selección inicial de rol ya está completada'; END IF;
  UPDATE public.profiles SET rol = p_rol, nombre = coalesce(nullif(trim(p_nombre), ''), nombre), onboarding_completado = true,
    marca = CASE WHEN p_rol = 'entrenador' THEN coalesce(marca, '{}'::jsonb) || jsonb_build_object('nombre_display', p_nombre, 'whatsapp', p_whatsapp, 'instagram', p_instagram) ELSE marca END
  WHERE id = auth.uid();
  SELECT to_jsonb(p) INTO result FROM public.profiles p WHERE id = auth.uid();
  RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.complete_role_selection(text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_role_selection(text,text,text,text) TO authenticated;

-- Public discovery returns presentation fields, never email or subscription data.
CREATE OR REPLACE FUNCTION public.trainer_directory(p_id uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object('id', id, 'nombre', nombre, 'marca', marca, 'logo_url', logo_url, 'filosofia', filosofia)), '[]'::jsonb)
  FROM public.profiles WHERE rol = 'entrenador' AND (p_id IS NULL OR id = p_id);
$$;
REVOKE ALL ON FUNCTION public.trainer_directory(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.trainer_directory(uuid) TO anon, authenticated;

-- One transaction and one stable key for both offline and online recordings.
ALTER TABLE public.sesiones_historial ADD COLUMN IF NOT EXISTS client_operation_id text;
ALTER TABLE public.sesiones_ejercicios ADD COLUMN IF NOT EXISTS client_exercise_index integer;
CREATE UNIQUE INDEX IF NOT EXISTS sesiones_operation_unique ON public.sesiones_historial(cliente_id, client_operation_id);
CREATE OR REPLACE FUNCTION public.record_training_session(p_cliente_id uuid, p_operation_id text, p_session jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE session_id uuid; exercises jsonb;
BEGIN
  IF NOT public.can_access_athlete(p_cliente_id) OR p_operation_id IS NULL OR length(trim(p_operation_id)) NOT BETWEEN 1 AND 160 THEN
    RAISE EXCEPTION 'Operación no autorizada' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(p_session->'ejercicios') IS DISTINCT FROM 'array' OR jsonb_array_length(p_session->'ejercicios') NOT BETWEEN 1 AND 200 THEN
    RAISE EXCEPTION 'La sesión debe contener entre 1 y 200 ejercicios';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_cliente_id::text || ':' || p_operation_id, 0));
  SELECT id INTO session_id FROM public.sesiones_historial WHERE cliente_id = p_cliente_id AND client_operation_id = p_operation_id;
  IF session_id IS NULL THEN
    INSERT INTO public.sesiones_historial(cliente_id, fecha, notas_generales, express_mode, express_blocks, client_operation_id)
    VALUES (p_cliente_id, (p_session->>'fecha')::date, p_session->>'notas_sesion', coalesce((p_session->>'express_mode')::boolean, false), coalesce(p_session->'express_blocks', '[]'::jsonb), p_operation_id)
    RETURNING id INTO session_id;
    INSERT INTO public.sesiones_ejercicios(sesion_id, nombre_ejercicio, grupo_muscular, series_reps, peso, rpe_rir, descanso, volumen, rm_estimado, feedback_estimulo, feedback_recuperacion, client_exercise_index)
    SELECT session_id, e->>'nombre_ejercicio', e->>'grupo_muscular', e->'series_reps', (e->>'peso')::numeric, (e->>'rpe_rir')::numeric,
      (e->>'descanso')::integer, (e->>'volumen')::numeric, (e->>'rm_estimado')::numeric, e->>'feedback_estimulo', e->>'feedback_recuperacion', ordinal::integer
    FROM jsonb_array_elements(p_session->'ejercicios') WITH ORDINALITY AS entries(e, ordinal);
  END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object('id_ej', id, 'nombre', nombre_ejercicio) ORDER BY client_exercise_index), '[]'::jsonb) INTO exercises FROM public.sesiones_ejercicios WHERE sesion_id = session_id;
  RETURN jsonb_build_object('id', session_id, 'ejercicios', exercises);
END $$;
REVOKE ALL ON FUNCTION public.record_training_session(uuid,text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_training_session(uuid,text,jsonb) TO authenticated;
COMMIT;
