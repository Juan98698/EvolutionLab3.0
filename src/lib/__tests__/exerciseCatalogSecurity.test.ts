import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

describe('Exercise catalog security', () => {
  it('enforces existing role policies and prevents anonymous writes and authenticated TRUNCATE', async () => {
    const db = new PGlite();
    try {
      await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
        CREATE SCHEMA auth;
        CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql AS $$ SELECT current_setting('request.jwt.claim.role',true) $$;
        CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
        CREATE TABLE public.test_roles(id uuid,rol text);
        INSERT INTO public.test_roles VALUES ('11111111-1111-1111-1111-111111111111','cliente'),('22222222-2222-2222-2222-222222222222','entrenador'),('33333333-3333-3333-3333-333333333333','admin');
        CREATE FUNCTION public.es_admin(id uuid) RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$ SELECT rol='admin' FROM public.test_roles WHERE test_roles.id=$1 $$;
        CREATE FUNCTION public.es_entrenador_o_admin(id uuid) RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$ SELECT rol IN ('entrenador','admin') FROM public.test_roles WHERE test_roles.id=$1 $$;
        CREATE TABLE public.ejercicios_globales(id serial PRIMARY KEY,nombre text);
        CREATE TABLE public.ejercicios_alias(alias text PRIMARY KEY,nombre_real text);
        INSERT INTO public.ejercicios_globales(nombre) VALUES ('Original');
        INSERT INTO public.ejercicios_alias VALUES ('alias','Original');
        GRANT USAGE ON SCHEMA auth TO anon,authenticated;
        GRANT ALL ON public.ejercicios_globales,public.ejercicios_alias TO anon,authenticated,service_role;
        GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon,authenticated,service_role;
        CREATE POLICY catalog_read ON public.ejercicios_globales FOR SELECT USING (auth.role()='authenticated');
        CREATE POLICY catalog_insert ON public.ejercicios_globales FOR INSERT WITH CHECK (public.es_entrenador_o_admin(auth.uid()));
        CREATE POLICY catalog_update ON public.ejercicios_globales FOR UPDATE USING (public.es_entrenador_o_admin(auth.uid()));
        CREATE POLICY catalog_delete ON public.ejercicios_globales FOR DELETE USING (public.es_admin(auth.uid()));
        CREATE POLICY aliases_read ON public.ejercicios_alias FOR SELECT TO anon,authenticated USING (true);
      `);
      await db.exec(readFileSync('supabase/migrations/20261114090000_enable_exercise_catalog_rls.sql','utf8'));
      const asRole = async (role: string, id: string, statement: string) => {
        await db.exec(`BEGIN; SET LOCAL ROLE ${role}; SELECT set_config('request.jwt.claim.role','${role}',true),set_config('request.jwt.claim.sub','${id}',true);`);
        try { return await db.query(statement); } finally { await db.exec('ROLLBACK'); }
      };
      expect((await asRole('anon','','SELECT * FROM public.ejercicios_alias')).rows).toHaveLength(1);
      expect((await asRole('anon','','SELECT * FROM public.ejercicios_globales')).rows).toHaveLength(0);
      await expect(asRole('anon','',"INSERT INTO public.ejercicios_globales(nombre) VALUES ('Injected')")).rejects.toThrow(/permission denied/);
      const athlete='11111111-1111-1111-1111-111111111111';
      expect((await asRole('authenticated',athlete,'SELECT * FROM public.ejercicios_globales')).rows).toHaveLength(1);
      await expect(asRole('authenticated',athlete,"INSERT INTO public.ejercicios_globales(nombre) VALUES ('Injected')")).rejects.toThrow(/row-level security/);
      expect((await asRole('authenticated',athlete,"UPDATE public.ejercicios_globales SET nombre='Changed' RETURNING id")).rows).toHaveLength(0);
      await expect(asRole('authenticated',athlete,'TRUNCATE public.ejercicios_globales')).rejects.toThrow(/permission denied/);
      const coach='22222222-2222-2222-2222-222222222222';
      expect((await asRole('authenticated',coach,"INSERT INTO public.ejercicios_globales(nombre) VALUES ('Contribution') RETURNING id")).rows).toHaveLength(1);
      expect((await asRole('authenticated',coach,"UPDATE public.ejercicios_globales SET nombre='Contribution' RETURNING id")).rows).toHaveLength(1);
      expect((await asRole('authenticated',coach,'DELETE FROM public.ejercicios_globales RETURNING id')).rows).toHaveLength(0);
      expect((await asRole('authenticated','33333333-3333-3333-3333-333333333333','DELETE FROM public.ejercicios_globales RETURNING id')).rows).toHaveLength(1);
      expect((await asRole('service_role','','SELECT * FROM public.ejercicios_globales')).rows).toHaveLength(1);
    } finally { await db.close(); }
  },30000);
});
