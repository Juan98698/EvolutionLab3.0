# Cierre de hallazgos — 13 de noviembre de 2026

Esta entrega reúne las correcciones de seguridad, fiabilidad, arquitectura y el diseño Estudio elegido por el usuario. Las verificaciones de esta revisión se detallan a continuación. La publicación requiere completar las comprobaciones indicadas al final del documento.

La integración posterior con los cambios remotos se detalla en [verificación de la fusión](merge-verification.md).

## Correcciones y evidencia

| Hallazgo | Corrección | Evidencia |
| --- | --- | --- |
| Datos locales compartidos entre cuentas | Cachés y colas por propietario, copias defensivas y protección contra hidratación tardía | `sessionIsolation`, `sessionsOffline`, `planCache` |
| Plan anterior reaparece al cambiar de cuenta | Procedencia verificable, archivo de planes antiguos y cancelación de consultas obsoletas | `useAthletePlan`, `planCache`, `normalizePlan` |
| Sesión guardada parcialmente o duplicada | RPC transaccional e idempotencia con clave persistente | PostgreSQL y Supabase remoto: repetición devuelve la misma sesión |
| Acceso entre entrenadores y escalado de privilegios | RLS restrictiva, protección de columnas, roles limitados y selección inicial de un solo uso | PostgreSQL y dos equipos separados en Supabase remoto |
| Catálogo global con políticas definidas pero RLS desactivada | Activación de RLS y privilegios mínimos de tablas/secuencias | PostgreSQL/PGlite, proyecto restaurado y comprobación de RLS y permisos en producción |
| Vinculación sin consentimiento y exposición de correos | Invitaciones con aceptación, directorio limitado a campos de presentación | PostgreSQL y aceptación remota sin acceso previo |
| Pagos manipulables, repetidos o fuera de orden | Catálogo del servidor, JWT obligatorio, firma, comprobación de moneda/importe y ledger transaccional | Tests de API y PostgreSQL; preferencia real de sandbox |
| Redirección a un dominio ajeno | Allowlist y rutas limitadas; dominio confirmado `evolutionlab.fit` | Tests de API y preferencia de sandbox |
| Mocks dentro del cliente de producción | Adaptador exclusivo E2E y comprobación del bundle | Build de producción sin identidades ficticias |
| Dependencias vulnerables | Vite 8, Vitest 5, Router 7 y herramientas actualizadas; parche acotado de deepmerge | `npm audit`: 0 avisos; regresión de contaminación de prototipos |
| Vistas con responsabilidades mezcladas | Autenticación, carga de planes, normalización, portada del plan y calculadora extraídas | Suite de hooks, normalización, autenticación y componentes |
| Exceso de ruido y navegación desigual | Shell compartido por rol, paleta Estudio, filas de atletas y herramientas secundarias | Flujos de entrenador, atleta y administración |
| Portada cortada en pantallas bajas | Flujo vertical, cabecera sin desplazamiento, áreas seguras y reinicio de scroll por ruta | 320×568, 390×667 y 1440×720 en Chromium y WebKit |
| Portada sin personalidad | Ilustración vectorial de progreso y tres pasos, sin métricas ficticias | Capturas `docs/previews/` |
| Formularios y modales desbordados | Rejillas fluidas, controles táctiles, scroll interno y ajuste de nutrición a 320 px | Pruebas responsive de 320 a 1440 px |
| Foco y cierre de modales inconsistentes | Foco estable, Tab contenido, Escape solo en el diálogo superior y etiquetas | `useModalA11y` y revisión de navegador |
| PDF y fuentes penalizan el arranque | PDF cargado bajo demanda; Inter local incluida en precaché | Build PWA y medición móvil de producción |
| Recomendaciones presentadas como certeza | Aviso visible de estimación y posibilidad de adaptación por entrenador | Periodización, sugerencias previas y calculadora |
| Comprobaciones no reproducibles | Scripts portables, versión Playwright fijada, CI con tipos, lint, tests, build, audit, visual y rendimiento | Ejecuciones locales y configuración de CI |

## Validación ejecutada

- TypeScript y ESLint aprobados.
- Suite Vitest tras la fusión: 93 archivos y 906 pruebas aprobadas; incluye PostgreSQL real con PGlite, aislamiento de cuentas, pagos, caché, autenticación y nutrición.
- Navegador: 73 casos aprobados; 8 casos visuales omitidos intencionadamente en WebKit porque sus cuatro escenarios se comparan en Chromium. Los flujos funcionales sí se prueban en los tres proyectos.
- Ocho imágenes de referencia Estudio revisadas, generadas y comparadas sin regeneración en la ejecución de verificación.
- CI Linux aprobado sobre `a713961`: tipos, lint, 906 pruebas, auditoría sin vulnerabilidades, build, 73 casos de navegador y rendimiento móvil. Las referencias Linux y Windows se conservan por separado, con la tolerancia visual original. La muestra móvil del runner registró LCP 1620 ms y CLS 0,000050. Evidencia y enlaces en `ci-visual-verification.md`.
- Build de producción aprobado con verificación del bundle y generación del service worker.
- Medición final de portada compilada tras la fusión: LCP 3.056 ms, CLS 0, DOM listo 1.823 ms y 251.349 bytes de recursos. Perfil simulado Pixel 5, CPU ×4, 1,6 Mbps y 150 ms de latencia. Es una medición de laboratorio, no una medición de usuarios reales.
- Supabase remoto: seis comprobaciones aprobadas, incluidos aislamiento, columnas protegidas, sesión atómica/idempotente, consentimiento e imposibilidad de escribir pagos desde el cliente. Limpieza de cuentas y datos desechables completada.
- Mercado Pago: vendedor confirmado como `test_user`; checkout actual crea preferencia sandbox por 19.900 COP, usa la identidad verificada y conserva importe, moneda, retorno y URL de webhook. Cero pagos creados; tarifas intactas.
- API pública existente: acceso sin JWT y notificación de pago sin firma responden 401. La clave del webhook en Vercel fue confirmada por el usuario.
- Auditoría npm: cero avisos conocidos. El parche vendorizado está documentado con su licencia y sus pruebas; requiere seguimiento cuando upstream publique una corrección.
- Instalación limpia con `npm ci` aprobada en una carpeta aislada, usando el lockfile y el paquete local; comprobación de coherencia del lockfile aprobada también en la raíz. `.npmrc` conserva la instalación de dependencias locales como paquetes, sin depender de junctions del equipo.

## Migraciones remotas

El usuario confirmó que ejecutó correctamente las tres migraciones del paquete inicial y `20261113090300_service_session_maintenance.sql`. La cuarta concede únicamente SELECT y DELETE en las tablas de sesiones al rol privado del servidor, necesario para la limpieza administrativa. No añade permisos al navegador.

Para otra instalación, `node scripts/prepare-db-release.mjs` genera `supabase/release/20261114_security_and_reliability.sql`, con las cinco migraciones en una sola transacción. El paquete original del día 13 se conserva como entrega histórica. Los verificadores leen credenciales del entorno, nunca las imprimen. `node scripts/verify-remote.mjs` es de solo lectura; `--integration` crea y elimina cuentas desechables. `node scripts/verify-checkout.mjs` exige un vendedor de pruebas y no cobra.

## Estado de las comprobaciones de publicación

1. **Accesos: comprobados.** Google regresó al panel real de atleta. El usuario confirmó que verificó el código del correo, guardó su contraseña nueva y volvió a entrar. Se observaron los paneles reales de entrenador y administración con cuentas desechables, y el entrenador fue rechazado al intentar abrir `/admin`. Se cerraron sus sesiones y se eliminaron ambas cuentas. Detalles del flujo de correo en [recuperación de contraseña](password-recovery.md).
2. **Mercado Pago: circuito completo pendiente.** La notificación auténtica del simulador oficial llegó a `evolutionlab.fit` y recibió HTTP 200. El evento `payment.updated` usó un ID ficticio, `live_mode: false`, y no creó registros en el ledger ni cobros. Faltan aprobación, repetición, renovación y devolución de un pago sandbox real contra el ledger. La simulación por sí sola no certifica ese circuito completo.
3. **Respaldo y restauración: comprobados.** Copia cifrada de PostgreSQL, restauración en un proyecto separado, comparación de 25 tablas y restauración de 320 archivos con descarga y SHA-256 de cada uno. Las seis pruebas funcionales del proyecto restaurado pasaron y limpiaron sus cuentas desechables. Evidencia, fecha del punto de recuperación y procedimiento en [ensayo de restauración](restore-rehearsal.md).

## Avance remoto — 14 de noviembre de 2026

- Se repitieron las seis comprobaciones de Supabase remoto: esquema, aislamiento de equipos, columnas protegidas, sesión atómica/idempotente, invitación con consentimiento y acceso restringido al ledger. Cuentas y datos desechables eliminados.
- `node scripts/verify-production.mjs` comprueba el despliegue HTTPS, proveedores habilitados, inicio OAuth, acceso por contraseña, destino del enlace de recuperación y cierre de sesión. La API publicada rechazó checkout sin JWT y webhooks sin firma o con firma falsa, todos con HTTP 401.
- El checkout de Vercel creó una preferencia autenticada con destino `www.mercadopago.com.co`. La consulta de esa preferencia con la credencial local devuelve 401, mientras `/users/me` confirma que la credencial local es de un vendedor de pruebas de Colombia. Falta confirmar vendedor y entorno de Vercel; la URL normal por sí sola no certifica el entorno real del vendedor. No se hicieron pagos ni cambios de tarifas.
- Se verificó `auth.evolutionlab.fit` en Resend mediante DNS en Vercel y se configuró `acceso@auth.evolutionlab.fit` como remitente SMTP de Supabase. Un rechazo posterior SMTP 535 se resolvió con una clave de envío limitada al dominio, configurada directamente por el usuario. El correo con código quedó entregado y el usuario completó la recuperación y el acceso posterior.
- La corrección de recuperación se publicó en `ec3d31c`: código de un solo uso, sesión verificada antes de mostrar/guardar la contraseña, conservación segura tras recarga y compatibilidad con eventos de enlaces anteriores. CI y despliegue aprobados: [ejecución de CI](https://github.com/Juan98698/EvolutionLab3.0/actions/runs/43638284600), [despliegue](https://vercel.com/juan-manuel-s-projects3/evolution-lab3-0-main/FfTkNVvWf1DkDR62MgR2Hqsd1RH6). Pasaron 915 pruebas unitarias y el flujo nuevo en Chromium y WebKit de escritorio/móvil; la comprobación remota también rechazó reutilizar el código.
- Los paneles de entrenador y administración se verificaron en `evolutionlab.fit`, con cierre de sesión y limpieza de las cuentas de prueba. La ruta administrativa rechazó al entrenador. Google aportó la comprobación del panel de atleta con una cuenta real.
- `supabase/verification/restore_manifest.sql` compara datos agregados, columnas, restricciones, funciones, triggers, permisos y políticas. La comparación real pasó sobre 25 tablas del proyecto `evolutionlab-restore-check`. Se conservaron explícitamente el evento de RLS propio del proyecto nuevo y las fechas de recuperación; no se ignoran diferencias de funciones de aplicación.
- Storage: 320 archivos y 99.000.874 bytes copiados con AES-256-GCM, manifiesto cifrado y clave separada, restaurados en el proyecto aislado y descargados desde allí para comprobar SHA-256. Los respaldos y claves permanecen excluidos de Git. Herramientas y procedimiento en `docs/restore-rehearsal.md`.
- La comprobación de permisos encontró RLS desactivada en el catálogo y escritura permitida a `anon`. La migración `20261114090000_enable_exercise_catalog_rls.sql` pasó PostgreSQL/PGlite y el clon remoto. La lectura posterior de producción confirmó RLS activa en ambos catálogos y escritura anónima revocada. Ver [políticas del catálogo](exercise-catalog-security.md).
- Después del cambio de catálogo pasaron siete comprobaciones de integración en producción, incluida su lectura por atleta y entrenador. Se eliminaron las cuatro cuentas desechables y sus datos de esta ejecución, sin escribir en el ledger.

El circuito de pagos no debe presentarse como cerrado hasta completar la comprobación del proveedor. La evaluación con profesionales y usuarios reales y las métricas de dispositivos físicos forman parte del seguimiento del producto. Los grandes editores conservan código heredado: se separaron las responsabilidades críticas de esta entrega, sin afirmar que desapareció toda la deuda técnica.
