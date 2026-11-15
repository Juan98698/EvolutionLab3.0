# Políticas del catálogo de ejercicios

Durante el ensayo de restauración se encontró que `ejercicios_globales` tenía políticas para lectores autenticados, contribuciones de entrenadores/administradores y borrado por administrador, pero RLS estaba desactivada. Los permisos de tabla permitían escritura al rol `anon`. No se probaron escrituras sobre ejercicios de producción.

`supabase/migrations/20261114090000_enable_exercise_catalog_rls.sql` activa las políticas existentes, restringe los permisos de tabla a los necesarios y limita los permisos de secuencias. También activa las políticas de lectura existentes en `ejercicios_alias`. La migración verifica que existan las políticas base antes de cambiar la configuración y se ejecuta dentro de una transacción.

Se comprobó con PostgreSQL/PGlite que un visitante no puede insertar ejercicios, que un atleta puede leer pero no escribir, que un entrenador conserva sus contribuciones y que el borrado corresponde al administrador. Se incluye la comprobación de TRUNCATE, que RLS por sí sola no impide. La migración pasó también en el proyecto remoto de restauración.

La lectura posterior de producción confirmó RLS activa en ambos catálogos y escritura anónima revocada. La comprobación se registra también en `finding-closure.md`. Un respaldo anterior a esta migración debe recibirla después de comprobar su restauración y antes de ponerse en servicio.
