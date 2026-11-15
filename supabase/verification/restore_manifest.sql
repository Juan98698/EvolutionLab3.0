-- Read-only verification. Run in SQL Editor on the source before backup and
-- on the isolated restored project, before adding test records to that project.
-- Output contains counts, schema metadata and comparison hashes, no row data.
-- MD5 is only a change fingerprint here, not a security or password primitive.
-- Production writes after the source snapshot can legitimately change hashes.
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '45s';
SET LOCAL TIME ZONE 'UTC';
SET LOCAL DateStyle = 'ISO, YMD';

DO $verification$
DECLARE
  item record;
  row_count bigint;
  row_hash text;
  tables jsonb := '[]'::jsonb;
  manifest jsonb;
BEGIN
  FOR item IN
    SELECT n.nspname AS schema_name, c.relname AS table_name,
      c.relrowsecurity AS rls, c.relforcerowsecurity AS forced_rls,
      COALESCE((SELECT jsonb_agg(jsonb_build_array(
        CASE WHEN acl.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(acl.grantee) END,
        pg_get_userbyid(acl.grantor), acl.privilege_type, acl.is_grantable)
        ORDER BY CASE WHEN acl.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(acl.grantee) END,
          pg_get_userbyid(acl.grantor), acl.privilege_type, acl.is_grantable)::text
        FROM aclexplode(COALESCE(c.relacl,acldefault('r',c.relowner))) acl),'[]') AS grants
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE (n.nspname = 'public'
      OR (n.nspname = 'auth' AND c.relname IN ('users', 'identities'))
      OR (n.nspname = 'storage' AND c.relname IN ('buckets', 'objects')))
      AND c.relkind IN ('r', 'p') AND NOT c.relispartition
    ORDER BY n.nspname, c.relname
  LOOP
    EXECUTE format(
      'SELECT count(*)::bigint, md5(COALESCE(string_agg(h, '''' ORDER BY h), ''''))
       FROM (SELECT md5(to_jsonb(t)::text) AS h FROM %I.%I t) rows_to_check',
      item.schema_name, item.table_name
    ) INTO row_count, row_hash;
    tables := tables || jsonb_build_array(jsonb_build_object(
      'schema', item.schema_name, 'table', item.table_name,
      'rows', row_count, 'dataFingerprint', row_hash,
      'rls', item.rls, 'forcedRls', item.forced_rls,
      'grantsFingerprint', md5(item.grants)
    ));
  END LOOP;

  SELECT jsonb_build_object(
    'formatVersion', 2,
    'generatedAt', now(),
    'postgresVersion', current_setting('server_version'),
    'tables', tables,
    'publicColumnsFingerprint', (
      SELECT md5(COALESCE(string_agg(
        jsonb_build_array(table_name, column_name, ordinal_position,
          data_type, udt_schema, udt_name, is_nullable, column_default,
          is_identity, identity_generation, is_generated, generation_expression)::text,
        E'\n' ORDER BY table_name, ordinal_position), ''))
      FROM information_schema.columns WHERE table_schema = 'public'
    ),
    'publicFunctions', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'name', p.proname,
        'arguments', pg_get_function_identity_arguments(p.oid),
        'definitionFingerprint', md5(pg_get_functiondef(p.oid)),
        'grantsFingerprint', md5(COALESCE((SELECT jsonb_agg(jsonb_build_array(
          CASE WHEN acl.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(acl.grantee) END,
          pg_get_userbyid(acl.grantor), acl.privilege_type, acl.is_grantable)
          ORDER BY CASE WHEN acl.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(acl.grantee) END,
            pg_get_userbyid(acl.grantor), acl.privilege_type, acl.is_grantable)::text
          FROM aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) acl),'[]')),
        'securityDefiner', p.prosecdef
      ) ORDER BY p.proname, pg_get_function_identity_arguments(p.oid)), '[]'::jsonb)
      FROM pg_catalog.pg_proc p
      JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.prokind IN ('f', 'p')
    ),
    'publicPolicies', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'table', tablename, 'name', policyname,
        'definitionFingerprint', md5(jsonb_build_array(permissive, roles, cmd, qual, with_check)::text)
      ) ORDER BY tablename, policyname), '[]'::jsonb)
      FROM pg_catalog.pg_policies WHERE schemaname = 'public'
    ),
    'constraints', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'table', c.relname, 'name', con.conname, 'validated', con.convalidated,
        'definitionFingerprint', md5(pg_get_constraintdef(con.oid, true))
      ) ORDER BY c.relname, con.conname), '[]'::jsonb)
      FROM pg_catalog.pg_constraint con
      JOIN pg_catalog.pg_class c ON c.oid = con.conrelid
      JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
    ),
    'customTriggers', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'schema', n.nspname, 'table', c.relname, 'name', t.tgname,
        'functionSchema', fn.nspname, 'function', p.proname,
        'definitionFingerprint', md5(pg_get_triggerdef(t.oid, true))
      ) ORDER BY n.nspname, c.relname, t.tgname), '[]'::jsonb)
      FROM pg_catalog.pg_trigger t
      JOIN pg_catalog.pg_class c ON c.oid = t.tgrelid
      JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
      JOIN pg_catalog.pg_proc p ON p.oid = t.tgfoid
      JOIN pg_catalog.pg_namespace fn ON fn.oid = p.pronamespace
      WHERE NOT t.tgisinternal
        AND (n.nspname = 'public' OR (n.nspname IN ('auth', 'storage') AND fn.nspname = 'public'))
    ),
    'extensionsToReviewBeforeClone', (
      SELECT COALESCE(jsonb_agg(extname ORDER BY extname), '[]'::jsonb)
      FROM pg_catalog.pg_extension
      WHERE extname IN ('pg_cron', 'pg_net', 'wrappers', 'pgsodium', 'supabase_vault')
    ),
    'storageFilesIncluded', false,
    'note', 'Storage rows are metadata only. Back up actual Storage files separately. Compare against the backup snapshot; later live writes can change fingerprints.'
  ) INTO manifest;
  PERFORM set_config('evolution.restore_manifest', manifest::text, true);
END;
$verification$;

SELECT current_setting('evolution.restore_manifest')::jsonb AS restore_manifest;
COMMIT;
