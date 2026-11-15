import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

describe('Supabase restore security export', () => {
  it('removes fresh-project default grants and restores the source RLS states', async () => {
    const source = new PGlite();
    const target = new PGlite();
    const schema = `
      CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
      CREATE TABLE public.catalog (id integer);
      CREATE TABLE public.private_records (id integer);
      CREATE FUNCTION public.apply_verified_payment(p_id text, p_user uuid) RETURNS boolean LANGUAGE sql SECURITY DEFINER AS 'SELECT true';
      CREATE FUNCTION public.default_function() RETURNS boolean LANGUAGE sql AS 'SELECT true';
    `;
    try {
      await source.exec(schema + `
        GRANT SELECT ON public.catalog TO anon, authenticated;
        ALTER TABLE public.private_records ENABLE ROW LEVEL SECURITY;
        ALTER TABLE public.private_records FORCE ROW LEVEL SECURITY;
        REVOKE ALL ON FUNCTION public.apply_verified_payment(text,uuid) FROM PUBLIC;
        GRANT EXECUTE ON FUNCTION public.apply_verified_payment(text,uuid) TO service_role;
      `);
      await target.exec(schema + `
        GRANT ALL ON public.catalog, public.private_records TO anon, authenticated;
        GRANT EXECUTE ON FUNCTION public.apply_verified_payment(text,uuid) TO anon, authenticated;
        ALTER TABLE public.catalog ENABLE ROW LEVEL SECURITY;
      `);
      const exported = await source.query<{ ddl: string }>(readFileSync('supabase/verification/export_application_grants.sql', 'utf8'));
      const ddl = exported.rows.map(row => row.ddl).join('\n');
      // A single server command avoids one network round trip per GRANT.
      await target.exec(`DO $apply$ BEGIN EXECUTE $payload$${ddl}$payload$; END $apply$;`);
      const { rows: [permissions] } = await target.query<Record<string, boolean>>(`SELECT
        has_function_privilege('anon','public.apply_verified_payment(text,uuid)','EXECUTE') AS anon_payment,
        has_function_privilege('authenticated','public.apply_verified_payment(text,uuid)','EXECUTE') AS authenticated_payment,
        has_function_privilege('service_role','public.apply_verified_payment(text,uuid)','EXECUTE') AS server_payment,
        has_function_privilege('anon','public.default_function()','EXECUTE') AS original_default,
        has_table_privilege('anon','public.catalog','SELECT') AS catalog_read,
        has_table_privilege('anon','public.catalog','INSERT') AS catalog_write,
        has_table_privilege('authenticated','public.private_records','SELECT') AS private_read,
        (SELECT relrowsecurity FROM pg_class WHERE oid='public.catalog'::regclass) AS catalog_rls,
        (SELECT relrowsecurity AND relforcerowsecurity FROM pg_class WHERE oid='public.private_records'::regclass) AS private_rls;
      `);
      expect(permissions).toEqual({ anon_payment: false, authenticated_payment: false, server_payment: true, original_default: true, catalog_read: true, catalog_write: false, private_read: false, catalog_rls: false, private_rls: true });
    } finally { await source.close(); await target.close(); }
  }, 30000);
});
