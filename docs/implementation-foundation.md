# Base de seguridad y fiabilidad — noviembre de 2026

La entrega incorpora el diseño Estudio elegido por el usuario y los contratos de seguridad, sincronización y pagos. El estado verificable se recoge en `finding-closure.md`.

## Arquitectura

- `sessionCache.ts`: almacenamiento por identidad, copias defensivas y protección frente a hidratación tardía. Las sesiones pendientes sobreviven al cierre de sesión en el espacio de su propietario.
- `sessions.ts`: consulta de historial y sincronización. Todos los registros del atleta usan `record_training_session`: una transacción para cabecera y ejercicios, con una clave de operación persistida antes del envío. El servidor devuelve los mismos identificadores ante un reintento.
- `planCache.ts`: conserva la procedencia del plan de compatibilidad. Cambiar de cuenta archiva la copia anterior y evita mostrarla en la nueva cuenta.
- El cliente real de Supabase no contiene simulaciones. El servidor E2E aplica un alias explícito hacia `e2e/support/`. El build comprueba que no se filtren identidades de pruebas.
- `api/_lib/billing.ts`: catálogo de precios compartido por checkout y verificación. Las renovaciones, devoluciones y entregas fuera de orden se reconcilian en una transacción de PostgreSQL.
- Las invitaciones requieren aceptación del atleta. Buscar un correo no permite enumerar perfiles ni vincular una cuenta sin consentimiento.
- `useAthletePlan.ts` contiene carga, caché y realtime con cancelación por identidad; `normalizePlan.ts` adapta planes históricos sin mutar los datos recibidos.
- Autenticación, portada del plan y calculadora tienen módulos propios. `StudioShell` unifica navegación, salida y estructura responsive por rol.

## Aplicación de migraciones

Antes de publicar el frontend, crear una copia de seguridad y aplicar en un entorno de ensayo con el esquema completo actual, en este orden:

1. `20261113090000_security_and_atomic_sessions.sql`.
2. `20261113090100_payment_ledger.sql`.
3. `20261113090200_coach_invitations.sql`.
4. `20261113090300_service_session_maintenance.sql`.

Estas migraciones se probaron en PostgreSQL con identidades ficticias y el usuario confirmó su ejecución en Supabase remoto. La integración remota pasó seis comprobaciones y eliminó sus cuentas desechables. El paquete SQL atómico se genera con `node scripts/prepare-db-release.mjs`. Las políticas restrictivas se combinan con los permisos existentes para conservar los controles de vigencia y planes de pago. No ejecutar después scripts antiguos que redefinan los triggers de perfiles.

Validar con dos entrenadores y dos atletas separados: cada entrenador ve solo su equipo, el atleta conserva su historial y una invitación no concede acceso hasta aceptarse. Probar además registro OAuth, alta mediante invitación, edición de marca y gestión administrativa. La RPC de selección de rol es de un solo uso y no reinicia suscripciones.

El cambio del contrato de sincronización requiere desplegar primero las migraciones. Si no existen las nuevas RPC, los registros locales permanecen pendientes y el frontend no simula un guardado correcto.

## Datos locales anteriores

La clave antigua `sobrecarga_v5` no incorpora un propietario verificable. Se conserva intacta, sin atribuir sus sesiones al siguiente usuario. El historial confirmado se recupera desde Supabase. Cualquier sesión antigua pendiente debe recuperarse mediante exportación y verificación de su propietario antes de importarla; no eliminar el almacenamiento del navegador durante esta transición.

Los planes antiguos o de otra identidad se archivan en `evolution:archived-plan:<propietario>`. La copia de trabajo solo se restaura automáticamente cuando el propietario coincide con la sesión autenticada.

## Pagos

El webhook comprueba firma, identidad del usuario, plan, moneda e importe antes de conceder acceso. Un error transitorio de verificación devuelve 503 para permitir reintentos. La confirmación HTTP se envía después de que la transacción se haya persistido. No se anuncia el envío de un correo que no se ha enviado.

Cada compra aprobada añade 30 días. La reconciliación ordena las compras por fecha de aprobación y excluye las devueltas o con contracargo. Los eventos repetidos o anteriores no sustituyen un estado más reciente del mismo pago. El ledger solo admite escrituras del servidor; los tokens de servicio permanecen fuera del frontend.

El checkout actual se verificó contra Supabase y un vendedor de pruebas real de Mercado Pago: preferencia sandbox, identidad del JWT, 19.900 COP y retorno al dominio confirmado. No se generaron pagos ni se modificaron tarifas. Antes de publicar, validar las notificaciones auténticas de Mercado Pago, incluida firma, reintentos, devolución y renovación anticipada contra el ledger. La API pública existente rechaza notificaciones sin firma; esto no certifica una aprobación completa en el código nuevo.

## Comprobaciones

```sh
npm ci
npm run typecheck
npm run lint
npm run test:run
npm run build
npm run test:e2e
npm run test:performance
npm audit
```

El servidor E2E es exclusivo de pruebas y no reutiliza un servidor normal. Los relojes se fijan para que las vigencias simuladas no caduquen con el calendario real. Las referencias visuales Estudio ya se regeneraron y compararon en Chromium local; CI deberá confirmar el rasterizado Linux.

El servidor E2E usa `127.0.0.1:5185` y una caché propia. El chequeo remoto de checkout usa otra caché para no interferir con la previsualización. `.npmrc` conserva `install-links=true` para instalar el parche local como paquete normal y reproducir el lockfile en CI.

## Cambios adicionales completados

- Implementado con Estudio: separar la vista de acceso de la lógica de autenticación y retirar el simulador decorativo de la portada.
- Implementado con Estudio: navegación compartida, jerarquía visual de formularios y mensajes, y gestión de atletas mediante filas. La validación visual final se detalla en `studio-design.md`.
- Extraídos carga de planes, normalización, portada del plan y calculadora. Los editores conservan código heredado que puede seguir simplificándose por responsabilidades.
- Portada de producción medida bajo CPU y red limitadas; PDF nutricional bajo demanda e Inter local. El comportamiento funcional de navegación y registro se verifica en móvil; no se presenta como un benchmark en dispositivos físicos.
- Recomendaciones identificadas como estimaciones. La evaluación con profesionales y usuarios reales sigue siendo necesaria para hacer afirmaciones sobre resultados individuales.
- Migradas Vite 8, Vitest 5, Router 7 y herramientas compatibles. Auditoría npm sin avisos conocidos; parche vendorizado de deepmerge con licencia y regresión documentadas. No se usó `npm audit fix --force`.

La validación local no sustituye una restauración de respaldo ensayada ni las pruebas de integración contra el esquema remoto completo.
