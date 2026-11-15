-- Read-only export of application customizations in managed schemas, which
-- Supabase CLI intentionally excludes from its normal schema dump.
SELECT COALESCE(string_agg(statement, E'\n' ORDER BY sort_key), '-- No managed-schema customizations')
FROM (
  SELECT n.nspname || '.' || c.relname || '.' || t.tgname AS sort_key,
    'DROP TRIGGER IF EXISTS ' || quote_ident(t.tgname) || ' ON ' || quote_ident(n.nspname) || '.' || quote_ident(c.relname) || ';' || E'\n' ||
    pg_get_triggerdef(t.oid, true) || ';' AS statement
  FROM pg_catalog.pg_trigger t
  JOIN pg_catalog.pg_class c ON c.oid = t.tgrelid
  JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
  JOIN pg_catalog.pg_proc p ON p.oid = t.tgfoid
  JOIN pg_catalog.pg_namespace fn ON fn.oid = p.pronamespace
  WHERE NOT t.tgisinternal AND n.nspname IN ('auth', 'storage') AND fn.nspname = 'public'
  UNION ALL
  SELECT schemaname || '.' || tablename || '.' || policyname,
    format('DROP POLICY IF EXISTS %I ON %I.%I;%sCREATE POLICY %I ON %I.%I AS %s FOR %s TO %s%s%s;',
      policyname, schemaname, tablename, E'\n', policyname, schemaname, tablename,
      permissive, cmd,
      (SELECT string_agg(CASE WHEN role_name = 'public' THEN 'PUBLIC' ELSE quote_ident(role_name) END, ', ' ORDER BY role_name) FROM unnest(roles) AS role_name),
      CASE WHEN qual IS NOT NULL THEN ' USING (' || qual || ')' ELSE '' END,
      CASE WHEN with_check IS NOT NULL THEN ' WITH CHECK (' || with_check || ')' ELSE '' END)
  FROM pg_catalog.pg_policies WHERE schemaname IN ('auth', 'storage')
) customizations;
