-- =====================================================================
-- FIX: onboarding_completado — reemplaza la detección basada en
-- suscripcion_plan (rota) por un flag dedicado y confiable.
-- =====================================================================
-- Causa raíz del bug: suscripcion_plan tiene DEFAULT 'free' a nivel de
-- columna (migración v4). handle_new_user() no lo incluye en su INSERT,
-- así que Postgres lo rellena con 'free' automáticamente en cada perfil
-- nuevo — tanto los creados por registro manual como por Google OAuth —
-- ANTES de que el cliente pueda revisar nada. La condición
-- `!profileData.suscripcion_plan` en SupabaseContext.tsx nunca es
-- verdadera para nadie, así que el modal de selección de rol nunca se
-- dispara en producción.
--
-- Solución: un campo booleano dedicado exclusivamente a esta señal, sin
-- superponerse con el significado de suscripcion_plan.
-- =====================================================================

-- 1. Agregar la columna. DEFAULT true para que todos los perfiles
--    existentes (ya onboardeados, sean del rol que sean) no se vean
--    afectados retroactivamente.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS
  onboarding_completado boolean DEFAULT true;

COMMENT ON COLUMN public.profiles.onboarding_completado IS
  'false únicamente para perfiles recién creados por OAuth que todavía no eligieron su rol. Todo perfil preexistente o creado por registro manual (que siempre trae rol explícito) queda en true.';

-- 2. Redefinir handle_new_user(): marca onboarding_completado = false
--    solo cuando raw_user_meta_data no trae 'rol' explícito — es decir,
--    exactamente el mismo caso que hoy dispara el fallback a 'cliente'
--    por defecto (OAuth, que nunca manda ese campo). El registro manual
--    (Login.tsx -> handleRegister) siempre pasa 'rol' en options.data,
--    así que sigue quedando en true sin cambios de comportamiento.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (
    id, email, nombre, rol, objetivo, vigencia_dias, entrenador_id, modalidad,
    onboarding_completado
  )
  VALUES (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'nombre', 'Nuevo Atleta'),
    coalesce(new.raw_user_meta_data->>'rol', 'cliente'),
    new.raw_user_meta_data->>'objetivo',
    coalesce((new.raw_user_meta_data->>'vigencia_dias')::integer, 28),
    (new.raw_user_meta_data->>'entrenador_id')::uuid,
    coalesce(new.raw_user_meta_data->>'modalidad', 'remoto'),
    (new.raw_user_meta_data->>'rol' IS NOT NULL)
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Redefinir complete_role_selection(): además de guardar el rol
--    elegido, marca onboarding_completado = true para que el modal no
--    vuelva a aparecer en logins futuros.
CREATE OR REPLACE FUNCTION public.complete_role_selection(
  p_rol text,
  p_nombre text DEFAULT NULL,
  p_whatsapp text DEFAULT '',
  p_instagram text DEFAULT ''
)
RETURNS jsonb AS $$
DECLARE
  _profile jsonb;
  _user_id uuid := auth.uid();
  _existing_plan text;
  _final_name text;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  IF p_rol NOT IN ('cliente', 'entrenador') THEN
    RAISE EXCEPTION 'Rol inválido: %', p_rol;
  END IF;

  SELECT suscripcion_plan, nombre
  INTO _existing_plan, _final_name
  FROM public.profiles
  WHERE id = _user_id;

  IF NOT FOUND THEN
    _final_name := COALESCE(NULLIF(p_nombre, ''), 'Atleta');
    INSERT INTO public.profiles (
      id, email, nombre, rol, vigencia_dias,
      suscripcion_plan, suscripcion_estado, suscripcion_expira_at,
      onboarding_completado
    )
    SELECT
      _user_id, u.email, _final_name, p_rol, 30,
      'free', 'activo', (NOW() + INTERVAL '30 days')::timestamptz,
      true
    FROM auth.users u
    WHERE u.id = _user_id;
  END IF;

  IF p_nombre IS NOT NULL AND TRIM(p_nombre) <> '' AND TRIM(p_nombre) <> 'Nuevo Atleta' THEN
    _final_name := TRIM(p_nombre);
  ELSIF _final_name = 'Nuevo Atleta' OR _final_name IS NULL THEN
    _final_name := COALESCE(NULLIF(p_nombre, ''), 'Atleta');
  END IF;

  IF p_rol = 'entrenador' THEN
    UPDATE public.profiles SET
      rol = 'entrenador',
      nombre = _final_name,
      suscripcion_plan = 'free',
      suscripcion_estado = 'activo',
      vigencia_dias = 30,
      suscripcion_expira_at = (NOW() + INTERVAL '30 days')::timestamptz,
      onboarding_completado = true,
      marca = jsonb_build_object(
        'nombre_display', _final_name,
        'color_primario', '#00d4ff',
        'color_secundario', '#0070a0',
        'tipografia', 'Inter',
        'eslogan', '',
        'whatsapp', COALESCE(TRIM(p_whatsapp), ''),
        'instagram', COALESCE(TRIM(p_instagram), '')
      )
    WHERE id = _user_id;
  ELSE
    UPDATE public.profiles SET
      rol = 'cliente',
      nombre = _final_name,
      suscripcion_plan = 'free',
      suscripcion_estado = 'activo',
      vigencia_dias = 30,
      suscripcion_expira_at = (NOW() + INTERVAL '30 days')::timestamptz,
      onboarding_completado = true
    WHERE id = _user_id;
  END IF;

  SELECT to_jsonb(p.*) INTO _profile FROM public.profiles p WHERE p.id = _user_id;
  RETURN _profile;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.complete_role_selection(text, text, text, text) TO authenticated;
