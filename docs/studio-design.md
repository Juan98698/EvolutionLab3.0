# Diseño Estudio

La dirección Estudio fue elegida por el usuario. La implementación es local; todavía no está publicada.

## Sistema visual

| Uso | Color |
| --- | --- |
| Fondo | `#121716` |
| Superficies | `#1A211E` |
| Superficies elevadas | `#222C26` |
| Texto principal | `#EDF2EE` |
| Texto secundario | `#A4B0A8` |
| Separadores | `#323D36` |
| Acento y acción principal | `#91B6A1` |
| Avisos | `#D8BA80` |
| Errores y acciones destructivas | `#E5A29A` |

Inter se sirve desde el paquete de la aplicación. Los tokens están en `src/styles/studio.css`; las restricciones para pantallas y modales heredados están en `studio-responsive.css`. La marca del entrenador y los documentos exportados conservan sus opciones de personalización, mientras la interfaz usa un sistema compartido.

## Implementado

- `StudioShell`: navegación por rol, barra lateral de escritorio, menú móvil, enlace para saltar al contenido y cierre de sesión con confirmación.
- Acceso, registro y recuperación con campos etiquetados; lógica extraída a `useAuthFlow`.
- Gestión de atletas mediante filas, búsqueda y herramientas secundarias desplegables.
- Paleta, tipografía y superficies compartidas en entrenamiento, historial, métricas, biblioteca, planificación, administración y nutrición.
- Calculadora 1RM dentro de las herramientas de la pantalla; llamada principal al entrenamiento en salvia.
- Controles de nutrición y guardado adaptados a 320 px; diálogos con foco de teclado y Escape. Los diálogos apilados solo cierran el superior.
- Adaptaciones en 650 y 900 px, rejillas fluidas, controles táctiles, respeto a movimiento reducido y áreas seguras del dispositivo.
- Portada con ilustración vectorial y recorrido de tres pasos. En móvil, la presentación precede al formulario y la ilustración continúa debajo.
- Cabecera visible en pantallas bajas y reinicio del desplazamiento al cambiar de ruta.
- Portada del plan y calculadora extraídas a componentes propios; recomendaciones acompañadas de un aviso de estimación.

## Validación realizada

- TypeScript, ESLint y compilación de producción aprobados, con exclusión de identidades E2E.
- 73 casos de navegador aprobados en Chromium, WebKit de escritorio y WebKit móvil. Cubren acceso, registro, entrenador, atleta independiente y vinculado, administración, nutrición, seguimiento, configuración, biblioteca y entrenamiento activo.
- Anchos de 320, 390, 768 y 1440 px; pantallas bajas de 320×568, 390×667 y 1440×720. El modal de nutrición ya no tiene desbordamiento interno a 320 px.
- Ocho referencias visuales Estudio generadas y comparadas en Chromium. En WebKit se comprueban los flujos y el tamaño, sin comparar píxeles contra Chromium.
- Portada compilada tras la fusión bajo CPU ×4 y red limitada: LCP 3,06 segundos, CLS 0. Detalle y límites en `performance-mobile.json` y `finding-closure.md`.
- Revisión manual en navegador de la portada, salida con confirmación, calculadora en móvil y foco de diálogos.

## Capturas

Las capturas de revisión se guardan en `previews/studio-desktop.jpg` y `previews/studio-mobile.jpg`. Las referencias automáticas están en `e2e/visual-regression.spec.ts-snapshots/`.

Las referencias se separan en `linux/` y `win32/`. La comparación de Linux quedó aprobada en GitHub Actions con la misma imagen oficial usada para generar sus ocho capturas; la comparación de Windows también pasó sin regeneración. Evidencia en `ci-visual-verification.md`. Las comprobaciones del despliegue y los límites de la verificación están recogidos en `finding-closure.md`.
