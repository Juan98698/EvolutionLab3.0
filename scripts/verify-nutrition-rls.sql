-- ============================================================================
-- SCRIPT DE VERIFICACIÓN DE AISLAMIENTO RLS: Módulo de Nutrición y Antropometría
-- ============================================================================
-- IMPORTANTE:
--   Este script ejecuta una transacción temporal aislada (BEGIN ... ROLLBACK)
--   que simula usuarios autenticados reales mediante SET LOCAL ROLE y JWT claims.
--   NUNCA comitea datos. Si se corre en Supabase SQL Editor o psql, verifica
--   el comportamiento real del motor Postgres ante ataques y accesos cruzados.
-- ============================================================================

BEGIN;

-- 1. Sembrar auth.users PRIMERO (con privilegios de superusuario/postgres antes de bajar)
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'entrenador-a-test@evolutionlab.test', crypt('test', gen_salt('bf')), now(), now(), now(), '{}', '{}'),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'entrenador-b-test@evolutionlab.test', crypt('test', gen_salt('bf')), now(), now(), now(), '{}', '{}'),
  ('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cliente-a-test@evolutionlab.test', crypt('test', gen_salt('bf')), now(), now(), now(), '{}', '{}'),
  ('44444444-4444-4444-4444-444444444444', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cliente-b-test@evolutionlab.test', crypt('test', gen_salt('bf')), now(), now(), now(), '{}', '{}')
ON CONFLICT (id) DO NOTHING;

-- 2. Sembrar o actualizar public.profiles (el trigger de Supabase handle_new_user ya pudo haber auto-creado la fila)
INSERT INTO public.profiles (id, email, nombre, rol, entrenador_id, vigencia_dias) VALUES
  ('11111111-1111-1111-1111-111111111111', 'entrenador-a-test@evolutionlab.test', 'Entrenador A', 'entrenador', NULL, 30),
  ('22222222-2222-2222-2222-222222222222', 'entrenador-b-test@evolutionlab.test', 'Entrenador B', 'entrenador', NULL, 30),
  ('33333333-3333-3333-3333-333333333333', 'cliente-a-test@evolutionlab.test', 'Cliente A (de Entrenador A)', 'cliente', '11111111-1111-1111-1111-111111111111', 30),
  ('44444444-4444-4444-4444-444444444444', 'cliente-b-test@evolutionlab.test', 'Cliente B (de Entrenador B)', 'cliente', '22222222-2222-2222-2222-222222222222', 30)
ON CONFLICT (id) DO UPDATE 
SET email = EXCLUDED.email,
    nombre = EXCLUDED.nombre,
    rol = EXCLUDED.rol,
    entrenador_id = EXCLUDED.entrenador_id,
    vigencia_dias = EXCLUDED.vigencia_dias;

-- Sembrar un plan legítimo para Cliente B (hecho por Entrenador B)
INSERT INTO public.planes_nutricionales (id, cliente_id, entrenador_id, nombre, target_calorias)
VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '44444444-4444-4444-4444-444444444444', '22222222-2222-2222-2222-222222222222', 'Dieta de Cliente B', 2200)
ON CONFLICT (id) DO UPDATE SET target_calorias = EXCLUDED.target_calorias;

-- 3. CAMBIAR A ROL AUTENTICADO COMO ENTRENADOR A (RLS ACTIVADO)
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

-- TEST 1: Entrenador A intenta leer los planes de Cliente B (Debe retornar 0 filas)
DO $$
DECLARE
  v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count FROM public.planes_nutricionales WHERE cliente_id = '44444444-4444-4444-4444-444444444444';
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'TEST 1 FALLIDO: Entrenador A pudo leer el plan de Cliente B (retornó % filas)', v_count;
  ELSE
    RAISE NOTICE '✅ TEST 1 PASADO: Entrenador A NO puede leer el plan de Cliente B (0 filas)';
  END IF;
END $$;

-- TEST 2: Entrenador A intenta insertar un plan para Cliente B (Debe fallar por RLS WITH CHECK)
DO $$
BEGIN
  BEGIN
    INSERT INTO public.planes_nutricionales (cliente_id, nombre, target_calorias)
    VALUES ('44444444-4444-4444-4444-444444444444', 'Hack Plan', 1800);
    RAISE EXCEPTION 'TEST 2 FALLIDO: El RLS permitió a Entrenador A insertar un plan a Cliente B';
  EXCEPTION WHEN insufficient_privilege OR check_violation THEN
    RAISE NOTICE '✅ TEST 2 PASADO: Entrenador A fue bloqueado al intentar insertar en Cliente B';
  END;
END $$;

-- TEST 3: Entrenador A intenta actualizar el plan de Cliente B (Debe afectar 0 filas)
DO $$
DECLARE
  v_updated INT;
BEGIN
  UPDATE public.planes_nutricionales 
  SET nombre = 'Nombre Hackeado' 
  WHERE id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated > 0 THEN
    RAISE EXCEPTION 'TEST 3 FALLIDO: Entrenador A pudo modificar el plan de Cliente B';
  ELSE
    RAISE NOTICE '✅ TEST 3 PASADO: Entrenador A NO pudo actualizar el plan de Cliente B (0 filas afectadas)';
  END IF;
END $$;

-- TEST 4: Entrenador A inserta legítimamente para Cliente A (Debe funcionar)
INSERT INTO public.planes_nutricionales (id, cliente_id, nombre, target_calorias)
VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333', 'Dieta Legítima Cliente A', 2400)
ON CONFLICT (id) DO UPDATE SET target_calorias = EXCLUDED.target_calorias;

-- TEST 5: Verificar que el trigger pobló entrenador_id automáticamente
DO $$
DECLARE
  v_entrenador UUID;
BEGIN
  SELECT entrenador_id INTO v_entrenador 
  FROM public.planes_nutricionales 
  WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  
  IF v_entrenador = '11111111-1111-1111-1111-111111111111' THEN
    RAISE NOTICE '✅ TEST 5 PASADO: El trigger auto-pobló entrenador_id correctamente como Entrenador A';
  ELSE
    RAISE EXCEPTION 'TEST 5 FALLIDO: entrenador_id esperado 1111... pero se obtuvo %', v_entrenador;
  END IF;
END $$;

-- RESET Y ROLLBACK (Ningún dato persiste en la base de datos)
RESET ROLE;
ROLLBACK;
