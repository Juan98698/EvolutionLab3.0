-- The catalog already has role-based policies, but RLS was disabled remotely.
-- Enable those policies and remove privileges that bypass RLS (e.g. TRUNCATE).
-- No exercise rows, media URLs, prices or subscription data are changed.
BEGIN;

DO $guard$
BEGIN
  IF (SELECT count(DISTINCT cmd) FROM pg_policies
      WHERE schemaname='public' AND tablename='ejercicios_globales'
        AND cmd IN ('SELECT','INSERT','UPDATE','DELETE')) <> 4
    OR NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
      AND tablename='ejercicios_alias' AND cmd='SELECT') THEN
    RAISE EXCEPTION 'Faltan las políticas base del catálogo; no se cambió la configuración.';
  END IF;
END $guard$;

ALTER TABLE public.ejercicios_globales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ejercicios_alias ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.ejercicios_globales, public.ejercicios_alias FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.ejercicios_globales, public.ejercicios_alias TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.ejercicios_globales TO authenticated;
GRANT ALL ON public.ejercicios_globales, public.ejercicios_alias TO service_role;

-- Handle a serial/identity primary key if present, without assuming its name.
DO $sequences$
DECLARE item record;
BEGIN
  FOR item IN SELECT DISTINCT ns.nspname, seq.relname
    FROM pg_class seq JOIN pg_namespace ns ON ns.oid=seq.relnamespace
    JOIN pg_depend dep ON dep.objid=seq.oid AND dep.classid='pg_class'::regclass AND dep.deptype IN ('a','i')
    JOIN pg_class tbl ON tbl.oid=dep.refobjid
    JOIN pg_namespace tn ON tn.oid=tbl.relnamespace
    WHERE seq.relkind='S' AND tn.nspname='public' AND tbl.relname='ejercicios_globales'
  LOOP
    EXECUTE format('REVOKE ALL ON SEQUENCE %I.%I FROM PUBLIC, anon, authenticated',item.nspname,item.relname);
    EXECUTE format('GRANT USAGE, SELECT ON SEQUENCE %I.%I TO authenticated',item.nspname,item.relname);
    EXECUTE format('GRANT ALL ON SEQUENCE %I.%I TO service_role',item.nspname,item.relname);
  END LOOP;
END $sequences$;

COMMIT;
