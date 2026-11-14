# Corrección del CI visual — 14 de noviembre de 2026

El [CI de la fusión](https://github.com/Juan98698/EvolutionLab3.0/actions/runs/43603218362)
aprobó tipos, lint, 906 pruebas unitarias, auditoría y build. Playwright aprobó
70 casos, omitió los ocho visuales de WebKit previstos y falló en tres
comparaciones de Chromium: entrenador, portada móvil y periodización.

Las referencias compartidas procedían de Windows y el CI renderiza en Linux.
Había diferencias de rasterizado, glifos y altura: la portada móvil medía
390 × 1669 px en Windows y 390 × 1646 px en Linux; periodización difería en
un píxel de alto. Los pasos posteriores de build y rendimiento se omitieron
por depender de Playwright.

## Corrección

- `snapshotPathTemplate` incluye `{platform}`. Las ocho referencias originales
  se conservan sin cambios en `win32/` y Linux tiene ocho referencias propias.
- Linux se genera con `mcr.microsoft.com/playwright:v1.65.1-noble`, la misma
  imagen del CI. No se modificó la interfaz Estudio ni el umbral visual de 0,02.
- Los runners quedan fijados en Ubuntu 24.04. Checkout, setup-node y
  upload-artifact usan versiones oficiales con runtime Node 24, fijadas por SHA.
  La versión del proyecto sigue siendo Node 22 en el job de compilación.
- La regeneración sigue siendo manual. El CI habitual compara capturas;
  no las actualiza automáticamente cuando aparece una diferencia.

## Evidencia

- Windows: cuatro escenarios y ocho capturas aprobados sin regeneración.
- [Generación Linux](https://github.com/Juan98698/EvolutionLab3.0/actions/runs/43605663836)
  completada correctamente. Se revisaron las ocho imágenes de portada,
  entrenador, atleta, navegación y periodización automática/manual.
- [CI independiente de la rama de corrección](https://github.com/Juan98698/EvolutionLab3.0/actions/runs/43605802061):
  aprobado sobre `a713961`. Tipos, lint, auditoría sin vulnerabilidades,
  906 pruebas en 93 archivos, build, 73 casos de navegador y una prueba de
  rendimiento aprobados. Las ocho omisiones visuales de WebKit son intencionales;
  los flujos funcionales sí se ejecutan en los tres proyectos. La comparación
  usa las referencias nuevas sin `--update-snapshots`.
- Muestra móvil de producción en ese CI: LCP 1620 ms, CLS 0,000050,
  221085 bytes de recursos y ancho de contenido/viewport de 393 px.
  Perfil Pixel 5, CPU ×4, red de 1,6 Mbps y latencia de 150 ms;
  es una medición de laboratorio, no de usuarios reales.
- Los dos jobs finalizaron sin las anotaciones de deprecación de Node 20
  ni las de migración de `ubuntu-latest` que aparecían en la ejecución anterior.

El commit creado con `GITHUB_TOKEN` por el workflow de capturas no dispara
otro workflow. Después de revisar las imágenes, hay que ejecutar manualmente
**CI → Run workflow** sobre la rama y el commit nuevo antes de integrarlos.
