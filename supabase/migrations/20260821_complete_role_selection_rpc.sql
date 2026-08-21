-- =====================================================================
-- MIGRATION: complete_role_selection RPC function
-- =====================================================================
-- Propósito: Permitir que los nuevos usuarios que ingresan vía Google OAuth
-- (a quienes el trigger handle_new_user() asignó rol='cliente' por defecto)
-- puedan seleccionar su rol definitivo ('cliente' o 'entrenador') y completar
-- su onboarding sin verse bloqueados por las políticas RLS de UPDATE.
-- Se define como SECURITY DEFINER con estrictas validaciones de seguridad.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.complete_role_selection(
  p_rol text,
  p_nombre text DEFAULT NULL,
  p_whatsapp text DEFAULT '',
  p_instagram text DEFAULT ''
)
RETURNS jsonb AS \$\$
DECLARE
  _profile jsonb;
  _user_id uuid := auth.uid();
  _existing_plan text;
  _final_name text;
BEGIN
  -- 1. Validar sesión activa
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;
  
  -- 2. Validar rol permitido
  IF p_rol NOT IN ('cliente', 'entrenador') THEN
    RAISE EXCEPTION 'Rol inválido: %', p_rol;
  END IF;
  
  -- 3. Obtener estado actual del perfil
  SELECT suscripcion_plan, nombre 
  INTO _existing_plan, _final_name
  FROM public.profiles 
  WHERE id = _user_id;

  -- 4. Si no existe fila en profiles, crearla
  IF NOT FOUND THEN
    _final_name := COALESCE(NULLIF(p_nombre, ''), 'Atleta');
    INSERT INTO public.profiles (
      id,
      email,
      nombre,
      rol,
      vigencia_dias,
      suscripcion_plan,
      suscripcion_estado,
      suscripcion_expira_at
    )
    SELECT
      _user_id,
      u.email,
      _final_name,
      p_rol,
      30,
      'free',
      'activo',
      (NOW() + INTERVAL '30 days')::timestamptz
    FROM auth.users u
    WHERE u.id = _user_id;
  END IF;

  -- Determinar el nombre final a guardar
  IF p_nombre IS NOT NULL AND TRIM(p_nombre) <> '' AND TRIM(p_nombre) <> 'Nuevo Atleta' THEN
    _final_name := TRIM(p_nombre);
  ELSIF _final_name = 'Nuevo Atleta' OR _final_name IS NULL THEN
    _final_name := COALESCE(NULLIF(p_nombre, ''), 'Atleta');
  END IF;

  -- 5. Actualizar el perfil según el rol elegido
  IF p_rol = 'entrenador' THEN
    UPDATE public.profiles SET
      rol = 'entrenador',
      nombre = _final_name,
      suscripcion_plan = 'free',
      suscripcion_estado = 'activo',
      vigencia_dias = 30,
      suscripcion_expira_at = (NOW() + INTERVAL '30 days')::timestamptz,
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
      suscripcion_expira_at = (NOW() + INTERVAL '30 days')::timestamptz
    WHERE id = _user_id;
  END IF;
  
  -- 6. Retornar el perfil actualizado
  SELECT to_jsonb(p.*) INTO _profile FROM public.profiles p WHERE p.id = _user_id;
  RETURN _profile;
END;
\$\$ LANGUAGE plpgsql SECURITY DEFINER;

-- Otorgar permiso de ejecución a usuarios autenticados
GRANT EXECUTE ON FUNCTION public.complete_role_selection(text, text, text, text) TO authenticated;
