# Cierre de hallazgos — 13 de noviembre de 2026

Esta entrega reúne las correcciones de seguridad, fiabilidad, arquitectura y el diseño Estudio elegido por el usuario. Las verificaciones de esta revisión se detallan a continuación. La publicación requiere completar las comprobaciones indicadas al final del documento.

## Correcciones y evidencia

| Hallazgo | Corrección | Evidencia |
| --- | --- | --- |
| Datos locales compartidos entre cuentas | Cachés y colas por propietario, copias defensivas y protección contra hidratación tardía | `sessionIsolation`, `sessionsOffline`, `planCache` |
| Plan anterior reaparece al cambiar de cuenta | Procedencia verificable, archivo de planes antiguos y cancelación de consultas obsoletas | `useAthletePlan`, `planCache`, `normalizePlan` |
| Sesión guardada parcialmente o duplicada | RPC transaccional e idempotencia con clave persistente | PostgreSQL y Supabase remoto: repetición devuelve la misma sesión |
| Acceso entre entrenadores y escalado de privilegios | RLS restrictiva, protección de columnas, roles limitados y selección inicial de un solo uso | PostgreSQL y dos equipos separados en Supabase remoto |
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
- Suite Vitest: 89 archivos y 871 pruebas aprobadas; incluye PostgreSQL real con PGlite, aislamiento de cuentas, pagos, caché, autenticación y nutrición.
- Navegador: 73 casos aprobados; 8 casos visuales omitidos intencionadamente en WebKit porque sus cuatro escenarios se comparan en Chromium. Los flujos funcionales sí se prueban en los tres proyectos.
- Ocho imágenes de referencia Estudio revisadas, generadas y comparadas sin regeneración en la ejecución de verificación.
- Build de producción aprobado con verificación del bundle y generación del service worker.
- Medición final de portada compilada: LCP 2.596 ms, CLS 0, DOM listo 1.902 ms y 249.271 bytes de recursos. Perfil simulado Pixel 5, CPU ×4, 1,6 Mbps y 150 ms de latencia. Es una medición de laboratorio, no una medición de usuarios reales.
- Supabase remoto: seis comprobaciones aprobadas, incluidos aislamiento, columnas protegidas, sesión atómica/idempotente, consentimiento e imposibilidad de escribir pagos desde el cliente. Limpieza de cuentas y datos desechables completada.
- Mercado Pago: vendedor confirmado como `test_user`; checkout actual crea preferencia sandbox por 19.900 COP, usa la identidad verificada y conserva importe, moneda, retorno y URL de webhook. Cero pagos creados; tarifas intactas.
- API pública existente: acceso sin JWT y notificación de pago sin firma responden 401. La clave del webhook en Vercel fue confirmada por el usuario.
- Auditoría npm: cero avisos conocidos. El parche vendorizado está documentado con su licencia y sus pruebas; requiere seguimiento cuando upstream publique una corrección.
- Instalación limpia con `npm ci` aprobada en una carpeta aislada, usando el lockfile y el paquete local; comprobación de coherencia del lockfile aprobada también en la raíz. `.npmrc` conserva la instalación de dependencias locales como paquetes, sin depender de junctions del equipo.

## Migraciones remotas

El usuario confirmó que ejecutó correctamente las tres migraciones del paquete inicial y `20261113090300_service_session_maintenance.sql`. La cuarta concede únicamente SELECT y DELETE en las tablas de sesiones al rol privado del servidor, necesario para la limpieza administrativa. No añade permisos al navegador.

Para otra instalación, `node scripts/prepare-db-release.mjs` genera el paquete de las cuatro migraciones en una sola transacción. Los verificadores leen credenciales del entorno, nunca las imprimen. `node scripts/verify-remote.mjs` es de solo lectura; `--integration` crea y elimina cuentas desechables. `node scripts/verify-checkout.mjs` exige un vendedor de pruebas y no cobra.

## Comprobaciones de publicación que siguen pendientes

1. Ejecutar CI después del commit y revisar la comparación Linux de las referencias generadas en Windows. La comprobación local de Docker no pudo ejecutarse porque el motor no estaba iniciado.
2. Desplegar el código revisado y comprobar Google OAuth, recuperación por correo y acceso con una cuenta de cada rol en el dominio final. Los proveedores externos no se sustituyen por los mocks E2E.
3. Enviar una notificación auténtica firmada de Mercado Pago al código nuevo y comprobar aprobación, repetición, renovación y devolución contra el ledger. Las transacciones y la firma están cubiertas automáticamente, pero la prueba de preferencia no certifica el circuito completo del proveedor.
4. Conservar un respaldo y ensayar su restauración antes de una publicación importante. Las migraciones nuevas se validaron, pero no se ha ejecutado una restauración de respaldo.

Estas comprobaciones dependen del despliegue o de los proveedores; no deben presentarse como ejecutadas. La evaluación con profesionales y usuarios reales, y las métricas de dispositivos físicos, forman parte del seguimiento del producto. Los grandes editores conservan código heredado: se separaron las responsabilidades críticas de esta entrega, sin afirmar que desapareció toda la deuda técnica.
