import assert from 'node:assert/strict';

// Fresh Supabase projects may include this DDL-only RLS event hook. Validate
// its identity and binding explicitly; never silently ignore extra app code.
export async function applicationSnapshot(actual, expected, query) {
  const identity = fn => `${fn.name}(${fn.arguments})`;
  const expectedFunctions = new Set(expected.publicFunctions.map(identity));
  const extras = actual.publicFunctions.filter(fn => !expectedFunctions.has(identity(fn)));
  for (const fn of extras) {
    assert.equal(identity(fn), 'rls_auto_enable()', 'El destino tiene funciones adicionales sin revisar.');
    const result = JSON.parse((await query(`SELECT jsonb_build_object(
      'owner',pg_get_userbyid(p.proowner),'returns',format_type(p.prorettype,NULL),
      'binding',EXISTS(SELECT 1 FROM pg_event_trigger e WHERE e.evtfoid=p.oid AND e.evtname='ensure_rls' AND e.evtenabled='O'))
      FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND p.proname='rls_auto_enable' AND p.pronargs=0;`)).toString());
    assert.equal(result.owner, 'postgres', 'Propietario inesperado del evento RLS.');
    assert.equal(result.returns, 'event_trigger', 'La función adicional no es un evento de DDL.');
    assert(result.binding, 'El evento de RLS no tiene el vínculo esperado.');
  }
  return { snapshot: { ...actual, publicFunctions: actual.publicFunctions.filter(fn => expectedFunctions.has(identity(fn))) }, preservedPlatformFunctions: extras.map(fn => fn.name) };
}
