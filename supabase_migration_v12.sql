-- =====================================================================
-- Migración v12: Refuerzo de seguridad sobre v11 (chequeo de integridad)
-- =====================================================================
-- Dos correcciones sobre supabase_migration_v11.sql:
--
-- 1. Las funciones de v11 son `security definer` (corren con privilegios
--    elevados, no con los del usuario que las llama). Por defecto Supabase
--    expone TODA función SQL como endpoint RPC invocable por cualquier
--    usuario autenticado (`supabase.rpc('check_multiple_active_plans')`).
--    Nadie las llama hoy desde el frontend, pero sin un REVOKE explícito,
--    cualquiera con una cuenta podría dispararlas a mano desde la consola
--    del navegador. No exponen datos sensibles gracias a la deduplicación
--    y a que `data_integrity_alerts` no tiene policies de select, pero
--    quedan invocables sin necesidad — las cerramos.
--
-- 2. El webhook de Discord en v11 queda escrito en texto plano dentro del
--    archivo .sql. Si ese archivo se commitea a git con la URL real
--    (reemplazando 'TU_WEBHOOK_AQUI'), el webhook queda expuesto en el
--    historial del repositorio para siempre, aunque el repo sea privado
--    hoy. Lo movemos a una configuración de la base de datos que se setea
--    UNA VEZ a mano en el SQL Editor y nunca se commitea.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Revocar la posibilidad de invocar estas funciones vía RPC.
--    Solo deben poder correr desde el cron (que actúa como el dueño de
--    la función / postgres) o a mano desde el SQL Editor (como service_role).
-- ---------------------------------------------------------------------
revoke execute on function check_multiple_active_plans() from public, anon, authenticated;
revoke execute on function check_stale_sync_reports() from public, anon, authenticated;
revoke execute on function notify_new_integrity_alerts() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 2. Mover el webhook a una configuración de base de datos en vez de un
--    literal en el código SQL.
--
--    Paso manual único (NO lo pegues en un archivo que vayas a commitear):
--    correr esto UNA VEZ en el SQL Editor de Supabase, reemplazando la URL:
--
--      alter database postgres
--        set app.settings.integrity_webhook_url = 'https://discord.com/api/webhooks/TU_WEBHOOK_REAL';
--
--    Esto queda guardado en la configuración de la base, no en tu repo.
-- ---------------------------------------------------------------------
create or replace function notify_new_integrity_alerts()
returns void
language plpgsql
security definer
as $$
declare
  webhook_url text := current_setting('app.settings.integrity_webhook_url', true);
  alerta record;
  mensaje text;
begin
  -- Si todavía no se configuró el webhook (paso manual de arriba),
  -- no intentar avisar — las alertas siguen quedando en la tabla igual.
  if webhook_url is null or webhook_url = '' then
    return;
  end if;

  for alerta in
    select * from data_integrity_alerts
    where resuelto = false
      and detectado_en > now() - interval '25 hours'
  loop
    mensaje := format(
      '⚠️ Alerta de integridad: %s | cliente_id: %s | detalle: %s',
      alerta.tipo, alerta.cliente_id, alerta.detalle::text
    );

    perform net.http_post(
      url := webhook_url,
      body := jsonb_build_object('content', mensaje),
      headers := '{"Content-Type": "application/json"}'::jsonb
    );
  end loop;
end;
$$;

revoke execute on function notify_new_integrity_alerts() from public, anon, authenticated;
