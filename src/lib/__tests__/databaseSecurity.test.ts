import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const coachA = '10000000-0000-0000-0000-000000000001';
const coachB = '10000000-0000-0000-0000-000000000002';
const athleteA = '20000000-0000-0000-0000-000000000001';
const athleteB = '20000000-0000-0000-0000-000000000002';
let db: PGlite;
const migration = (name: string) => readFileSync(`supabase/migrations/${name}`, 'utf8');
async function identity(id: string, role = 'authenticated') {
  await db.exec('RESET ROLE');
  await db.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [id]);
  await db.exec(`SET ROLE ${role}`);
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role;
    CREATE TABLE auth.users(id uuid PRIMARY KEY, email text, raw_user_meta_data jsonb DEFAULT '{}');
    CREATE TABLE public.profiles(id uuid PRIMARY KEY, email text, nombre text, rol text, objetivo text, fecha_inicio date DEFAULT current_date, vigencia_dias int DEFAULT 30,
      entrenador_id uuid, modalidad text, onboarding_completado boolean DEFAULT true, marca jsonb, logo_url text, filosofia jsonb,
      suscripcion_plan text DEFAULT 'free', suscripcion_estado text DEFAULT 'activo', suscripcion_expira_at timestamptz);
    CREATE FUNCTION public.es_admin(uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$ SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id=$1 AND rol='admin') $$;
    CREATE TABLE sesiones_historial(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), cliente_id uuid REFERENCES profiles(id), fecha date, notas_generales text, express_mode boolean, express_blocks jsonb);
    CREATE TABLE sesiones_ejercicios(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), sesion_id uuid REFERENCES sesiones_historial(id), nombre_ejercicio text NOT NULL, grupo_muscular text, series_reps jsonb, peso numeric, rpe_rir numeric, descanso int, volumen numeric, rm_estimado numeric, feedback_estimulo text, feedback_recuperacion text);
    CREATE TABLE planes(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), cliente_id uuid, creador_id uuid);
    CREATE TABLE dias_plan(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), plan_id uuid);
    CREATE TABLE ejercicios_plan(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), dia_id uuid);
    CREATE TABLE valoraciones_antropometricas(id uuid PRIMARY KEY, cliente_id uuid);
    CREATE TABLE planes_nutricionales(id uuid PRIMARY KEY, cliente_id uuid);
    CREATE TABLE suscripciones(cliente_id uuid PRIMARY KEY, tipo text, estado text CHECK(estado IN ('activa','cancelada','expirada')), fecha_inicio timestamptz, fecha_expiracion timestamptz);
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated, service_role;
    INSERT INTO profiles(id, nombre, rol) VALUES ('${coachA}','Coach A','entrenador'),('${coachB}','Coach B','entrenador');
    INSERT INTO profiles(id,nombre,rol,entrenador_id) VALUES ('${athleteA}','Athlete A','cliente','${coachA}'),('${athleteB}','Athlete B','cliente','${coachB}');
    DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['profiles','planes','dias_plan','ejercicios_plan','sesiones_historial','sesiones_ejercicios','valoraciones_antropometricas','planes_nutricionales'] LOOP
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
      EXECUTE format('CREATE POLICY legacy_broad ON %I FOR ALL TO authenticated USING (true) WITH CHECK (true)',t);
    END LOOP; END $$;
  `);
  await db.exec(migration('20261113090000_security_and_atomic_sessions.sql'));
  await db.exec(migration('20261113090100_payment_ledger.sql'));
  await db.exec(migration('20261113090200_coach_invitations.sql'));
  await db.exec('REVOKE SELECT, DELETE ON sesiones_historial, sesiones_ejercicios FROM service_role');
  await db.exec(migration('20261113090300_service_session_maintenance.sql'));
  await db.exec('CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user()');
}, 60000);
afterAll(async () => { await db?.close(); });

describe('PostgreSQL authorization and transactions', () => {
  it('restores server-only session maintenance grants on legacy deployments', async () => {
    await identity('', 'service_role');
    expect((await db.query('SELECT * FROM sesiones_historial')).rows).toHaveLength(0);
    await db.query('DELETE FROM sesiones_ejercicios WHERE false');
    await identity('', 'anon');
    await expect(db.query('SELECT * FROM sesiones_historial')).rejects.toThrow(/permission denied/);
  });
  it('limits coach reads even when an old permissive policy allows everything', async () => {
    await identity(coachA);
    const { rows } = await db.query<{ id: string }>('SELECT id FROM profiles ORDER BY id');
    expect(rows.map(r => r.id)).toEqual([coachA, athleteA]);
    const result = await db.query('UPDATE profiles SET nombre = $1 WHERE id = $2 RETURNING id', ['unauthorized', athleteB]);
    expect(result.rows).toHaveLength(0);
  });
  it('blocks self promotion and subscription manipulation', async () => {
    await identity(coachA);
    await expect(db.query("UPDATE profiles SET rol='admin' WHERE id=$1", [coachA])).rejects.toThrow(/autorizadas/);
    await expect(db.query("UPDATE profiles SET suscripcion_plan='profesional' WHERE id=$1", [coachA])).rejects.toThrow(/autorizadas/);
    await expect(db.query("UPDATE profiles SET vigencia_dias=99999 WHERE id=$1", [coachA])).rejects.toThrow(/autorizadas/);
  });
  it('does not trust admin or subscription metadata during signup', async () => {
    await db.exec('RESET ROLE');
    await db.exec(`INSERT INTO auth.users VALUES ('30000000-0000-0000-0000-000000000001','test@example.test','{"rol":"admin","vigencia_dias":99999,"suscripcion_plan":"profesional"}')`);
    const { rows } = await db.query<{ rol: string; vigencia_dias: number; suscripcion_plan: string }>("SELECT * FROM profiles WHERE email='test@example.test'");
    expect(rows[0]).toMatchObject({ rol: 'cliente', vigencia_dias: 30, suscripcion_plan: 'free' });
  });
  it('makes role onboarding one-time and preserves existing billing', async () => {
    const id = '30000000-0000-0000-0000-000000000001';
    await identity(id);
    await db.query("SELECT complete_role_selection('entrenador','Test','','')");
    await expect(db.query("SELECT complete_role_selection('cliente','Test','','')")).rejects.toThrow(/completada/);
  });
  it('rolls back the header if any exercise is invalid', async () => {
    await identity(athleteA);
    await expect(db.query('SELECT record_training_session($1,$2,$3)', [athleteA, 'invalid', { fecha: '2026-11-13', ejercicios: [{}] }])).rejects.toThrow();
    const { rows } = await db.query('SELECT * FROM sesiones_historial');
    expect(rows).toHaveLength(0);
  });
  it('retries a committed operation without duplicating sessions or exercises', async () => {
    await identity(athleteA);
    const payload = { fecha: '2026-11-13', ejercicios: [{ nombre_ejercicio: 'Sentadilla', series_reps: [8], peso: 60, rpe_rir: 2, descanso: 120, volumen: 480, rm_estimado: 80 }] };
    const args = [athleteA, 'stable-operation', payload];
    const first = await db.query('SELECT record_training_session($1,$2,$3) result', args);
    const second = await db.query('SELECT record_training_session($1,$2,$3) result', args);
    expect(second.rows).toEqual(first.rows);
    expect((await db.query('SELECT * FROM sesiones_historial')).rows).toHaveLength(1);
    expect((await db.query('SELECT * FROM sesiones_ejercicios')).rows).toHaveLength(1);
    await identity(coachB);
    expect((await db.query('SELECT * FROM sesiones_historial')).rows).toHaveLength(0);
    await expect(db.query('SELECT record_training_session($1,$2,$3)', args)).rejects.toThrow(/autorizada/);
  });
  it('prevents clients from applying payments', async () => {
    await identity(athleteA);
    await expect(db.query("SELECT apply_verified_payment('1',$1,'premium','approved',now(),now())", [athleteA])).rejects.toThrow(/permission denied/);
  });
  it('requires the athlete to accept before sharing data with a coach', async () => {
    const id = '40000000-0000-0000-0000-000000000001';
    await db.exec('RESET ROLE');
    await db.exec(`INSERT INTO auth.users VALUES ('${id}','invited@example.test','{"rol":"cliente"}')`);
    await identity(coachA);
    await db.query("SELECT request_coach_invitation('invited@example.test','remoto')");
    expect((await db.query('SELECT * FROM profiles WHERE id=$1', [id])).rows).toHaveLength(0);
    await identity(id);
    const pending = await db.query<{ result: { id: string; coach_name: string }[] }>('SELECT pending_coach_invitations() result');
    expect(pending.rows[0].result[0].coach_name).toBe('Coach A');
    const invitationId = pending.rows[0].result[0].id;
    await identity(athleteB);
    await expect(db.query('SELECT respond_coach_invitation($1,true)', [invitationId])).rejects.toThrow(/disponible/);
    await identity(id);
    await db.query('SELECT respond_coach_invitation($1,true)', [invitationId]);
    expect((await db.query<{ entrenador_id: string }>('SELECT * FROM profiles WHERE id=$1', [id])).rows[0].entrenador_id).toBe(coachA);
  });
  it('reconciles duplicate, out-of-order payments and refunds in one transaction', async () => {
    await identity('', 'service_role');
    const apply = (id: string, status: string, date: string, updated = date) => db.query('SELECT apply_verified_payment($1,$2,$3,$4,$5,$6)', [id, athleteA, 'premium', status, date, updated]);
    await apply('newer', 'approved', '2026-11-12T00:00:00Z');
    await apply('older', 'approved', '2026-11-01T00:00:00Z');
    const before = (await db.query('SELECT suscripcion_expira_at FROM profiles WHERE id=$1', [athleteA])).rows;
    await apply('older', 'approved', '2026-11-01T00:00:00Z');
    expect((await db.query('SELECT suscripcion_expira_at FROM profiles WHERE id=$1', [athleteA])).rows).toEqual(before);
    await apply('older', 'refunded', '2026-11-01T00:00:00Z', '2026-11-13T00:00:00Z');
    const { rows } = await db.query<{ billing_payment_id: string; suscripcion_plan: string }>('SELECT * FROM profiles WHERE id=$1', [athleteA]);
    expect(rows[0]).toMatchObject({ billing_payment_id: 'newer', suscripcion_plan: 'premium' });
    await apply('newer', 'charged_back', '2026-11-12T00:00:00Z', '2026-11-13T01:00:00Z');
    expect((await db.query<{ suscripcion_estado: string }>('SELECT * FROM profiles WHERE id=$1', [athleteA])).rows[0].suscripcion_estado).toBe('cancelado');
  });
});
