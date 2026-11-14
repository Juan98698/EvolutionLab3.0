-- Some existing deployments grant session maintenance only to authenticated.
-- The server needs these two operations to remove session children before an
-- administrative account deletion. No browser or anonymous grant is added.
BEGIN;
GRANT SELECT, DELETE ON TABLE public.sesiones_historial, public.sesiones_ejercicios TO service_role;
COMMIT;
