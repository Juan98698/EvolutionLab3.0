-- Fresh Supabase projects can have broader default grants than the source.
-- Reset each application's object ACL before replaying its actual source ACL.
-- This export reads only catalog metadata; execute its output on the clone only.
WITH objects AS (
  SELECT 'TABLE' AS kind, format('%I.%I', n.nspname,c.relname) AS name,
    COALESCE(c.relacl,acldefault(CASE WHEN c.relkind='S' THEN 's'::"char" ELSE 'r'::"char" END,c.relowner)) AS acl,
    c.relowner AS owner, c.oid, CASE WHEN c.relkind='S' THEN 'SEQUENCE' ELSE 'TABLE' END AS grant_kind,
    CASE WHEN c.relkind IN ('r','p') THEN format('ALTER TABLE %I.%I %s ROW LEVEL SECURITY; ALTER TABLE %I.%I %s FORCE ROW LEVEL SECURITY;',
      n.nspname,c.relname,CASE WHEN c.relrowsecurity THEN 'ENABLE' ELSE 'DISABLE' END,
      n.nspname,c.relname,CASE WHEN c.relforcerowsecurity THEN '' ELSE 'NO' END) ELSE '' END AS rls_ddl
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','S','f')
  UNION ALL
  SELECT 'FUNCTION', format('%I.%I(%s)',n.nspname,p.proname,oidvectortypes(p.proargtypes)),
    COALESCE(p.proacl,acldefault('f',p.proowner)),p.proowner,p.oid,'FUNCTION',''
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prokind='f'
), statements AS (
  SELECT kind,name,
    format($ddl$DO $acl_reset$ DECLARE entry record; BEGIN
      FOR entry IN SELECT DISTINCT CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE quote_ident(r.rolname) END AS role_name
        FROM %s object CROSS JOIN LATERAL aclexplode(COALESCE(object.%s,acldefault('%s',object.%s))) a
        LEFT JOIN pg_roles r ON r.oid=a.grantee WHERE object.oid=%L::reg%s
      LOOP EXECUTE 'REVOKE ALL PRIVILEGES ON %s %s FROM ' || entry.role_name || ' CASCADE'; END LOOP;
    END $acl_reset$;
    $ddl$,
      CASE WHEN kind='FUNCTION' THEN 'pg_proc' ELSE 'pg_class' END,
      CASE WHEN kind='FUNCTION' THEN 'proacl' ELSE 'relacl' END,
      CASE WHEN kind='FUNCTION' THEN 'f' WHEN grant_kind='SEQUENCE' THEN 's' ELSE 'r' END,
      CASE WHEN kind='FUNCTION' THEN 'proowner' ELSE 'relowner' END,
      name,CASE WHEN kind='FUNCTION' THEN 'procedure' ELSE 'class' END,grant_kind,replace(name,'''',''''''))
    || COALESCE((SELECT string_agg(format('GRANT %s ON %s %s TO %s%s;', a.privilege_type, grant_kind,name,
      CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE quote_ident(r.rolname) END,
      CASE WHEN a.is_grantable THEN ' WITH GRANT OPTION' ELSE '' END),E'\n' ORDER BY a.grantee,a.privilege_type)
      FROM aclexplode(acl) a LEFT JOIN pg_roles r ON r.oid=a.grantee),'') || E'\n' || rls_ddl AS ddl
  FROM objects
)
SELECT ddl FROM statements ORDER BY kind,name;
