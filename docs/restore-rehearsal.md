# Ensayo de restauración — 14 de noviembre de 2026

Se restauró una copia de Evolution Lab en el proyecto separado `evolutionlab-restore-check`. Producción solo se leyó durante el respaldo. Las herramientas comprueban que origen y destino sean diferentes y que el destino esté vacío antes de importar.

## Resultado comprobado

- PostgreSQL 17.11: 25 tablas comparadas contra el respaldo, incluidas tablas de aplicación, usuarios/identidades y metadatos de Storage. Se comprobaron datos, columnas, restricciones, funciones de aplicación, triggers, permisos y políticas RLS.
- Cinco artefactos SQL cifrados: roles, esquema, datos, personalizaciones de esquemas gestionados y permisos exactos de aplicación.
- Storage: 320 archivos y 99.000.874 bytes restaurados. Se descargó cada archivo del destino y se verificó tamaño y SHA-256 contra el manifiesto original.
- Se repitieron seis comprobaciones funcionales sobre el proyecto restaurado: esquema, aislamiento de dos equipos, columnas protegidas, sesión atómica/idempotente, consentimiento de invitaciones y bloqueo del ledger al cliente. Las cuentas desechables se eliminaron y no se insertaron pagos ficticios.

El respaldo de base de datos verificado corresponde a `2026-11-14T20:54:56Z`. La comparación terminó a las `21:09:47Z` y la verificación de archivos a las `21:13:09Z`. Es una restauración a un punto en el tiempo; no afirma incluir cambios posteriores en producción.

## Diferencias del proyecto nuevo

Un proyecto nuevo puede tener permisos por defecto más amplios que el origen. El exportador revoca los permisos existentes de cada objeto de aplicación antes de reproducir los originales. También conserva los estados ENABLE/FORCE de RLS: el evento automático de un proyecto nuevo puede activar RLS al importar tablas.

La función adicional `rls_auto_enable()` se conservó después de comprobar su propietario `postgres`, retorno `event_trigger` y vínculo activo `ensure_rls`. Se informa expresamente en el comprobante; las funciones de aplicación se comparan con el respaldo. Los inventarios de catálogo se ordenan por identidad para evitar diferencias entre collations. Los datos se comparan con sus huellas originales.

El primer volcado se importó antes de terminar las pruebas de correo. Para la comparación final se actualizó exclusivamente la copia de `auth.users` del clon desde el respaldo final: se exigió que el clon siguiera coincidiendo con los datos originales, que el resto del esquema y datos coincidieran y que los IDs de usuarios no cambiaran. Producción no se modificó con esa operación.

La API de Storage actualiza versiones y fechas de sus metadatos al subir archivos. Por eso se compara la base antes de subirlos y, después, se verifica el contenido real de cada archivo. No se presenta una fila de `storage.objects` como prueba de que el archivo existe.

## Repetir el procedimiento

1. Configurar las conexiones en `.env.local`, con las contraseñas entre comillas si contienen caracteres como `#`. Usar un proyecto de destino separado y vacío. Las conexiones de mantenimiento no se configuran en el despliegue público.
2. Preparar PostgreSQL `pg_dump`/`psql` compatibles y la CLI oficial `supabase@3.1.0`. En Windows las herramientas nativas se ejecutan en WSL Ubuntu; no se pasan contraseñas en argumentos.
3. Ejecutar `node scripts/backup-database.mjs` y `node scripts/backup-storage.mjs`. Conservar los directorios y archivos de clave que indica cada comando.
4. Ejecutar sus modos `--verify <directorio> <archivo-clave>`. `backup-storage.mjs --verify-source` comprueba también que el inventario remoto no cambió.
5. Ejecutar `node scripts/restore-database.mjs <respaldo-db> <clave-db>`. Importa en una transacción y genera `restore-proof.json` solo si coincide con el respaldo.
6. Ejecutar `node scripts/restore-storage.mjs <respaldo-storage> <clave-storage> <ruta-a-restore-proof.json>`. Exige el comprobante de base y verifica todos los archivos restaurados.
7. Aplicar al clon las migraciones posteriores a la fecha del respaldo antes de usarlo. Para este ensayo se validó también `20261114090000_enable_exercise_catalog_rls.sql`, que corrige las políticas desactivadas del catálogo.
8. Ejecutar `node scripts/verify-remote.mjs --restore --integration` y comprobar que la limpieza termina correctamente. No usar datos de clientes para probar escrituras.

Los respaldos y manifiestos se cifran con AES-256-GCM y se verifican con SHA-256. Los directorios `scratch/recovery-backups/` y `scratch/recovery-keys/` están excluidos de Git; cada clave se guarda separada de su copia. No publicar respaldos, claves ni archivos `.env.local`. Este ensayo valida la recuperación; no instala una tarea automática de respaldo ni configura por sí solo SMTP, Google o Mercado Pago en el destino.
