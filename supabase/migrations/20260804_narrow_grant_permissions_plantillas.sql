-- Migration: Achicar los permisos otorgados en 20260804_grant_permissions_plantillas_entrenador.sql
-- Date: 2026-08-04 (follow-up)
--
-- PROBLEMA DETECTADO:
-- La migración anterior usó `GRANT ALL` (que en Postgres incluye SELECT, INSERT, UPDATE,
-- DELETE, TRUNCATE, REFERENCES y TRIGGER -- no solo las 4 operaciones que la app usa) y
-- se lo otorgó también al rol `anon` (cualquier visitante sin sesión iniciada).
--
-- Hoy RLS igual bloquea a `anon` (auth.uid() es NULL para un request anónimo, y las
-- políticas exigen auth.uid() = trainer_id / cliente_id), así que no hay una fuga de
-- datos activa. Pero:
--   1. TRUNCATE no está filtrado por RLS en absoluto -- no hay ninguna razón de producto
--      para que `anon` o `authenticated` tengan ese privilegio en estas tablas.
--   2. Ya encontramos dos bugs reales de RLS en estas mismas tablas en esta misma
--      auditoría. Depender únicamente de que las políticas de RLS sean perfectas para
--      siempre, mientras además se le da acceso de tabla a usuarios sin sesión, es una
--      capa de defensa de menos si alguna política futura tiene un error similar.
--
-- FIX: revocar todo lo otorgado a `anon` (no tiene ningún caso de uso legítimo), y
-- reducir `authenticated` a los 4 privilegios que la app realmente usa.
-- `service_role` no se toca: bypassea RLS por diseño y ya tiene acceso completo.

REVOKE ALL ON TABLE public.plantillas_entrenador FROM anon;
REVOKE ALL ON TABLE public.valoraciones_antropometricas FROM anon;

REVOKE ALL ON TABLE public.plantillas_entrenador FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.plantillas_entrenador TO authenticated;

REVOKE ALL ON TABLE public.valoraciones_antropometricas FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.valoraciones_antropometricas TO authenticated;

-- ── Verificación post-migración (correr a mano en el SQL editor) ─────────
-- SELECT grantee, table_name, privilege_type
-- FROM information_schema.role_table_grants
-- WHERE table_schema = 'public'
--   AND table_name IN ('plantillas_entrenador', 'valoraciones_antropometricas')
-- ORDER BY table_name, grantee, privilege_type;
-- No debería aparecer ninguna fila con grantee = 'anon', y `authenticated` solo debería
-- tener SELECT, INSERT, UPDATE, DELETE (no TRUNCATE/REFERENCES/TRIGGER).
