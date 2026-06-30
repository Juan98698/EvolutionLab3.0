# Estado de ESLint — notas de mantenimiento

## Por qué `max-warnings` es 20 y no 0

Al activar el archivo de configuración de ESLint (`.eslintrc.json`) por primera
vez para habilitar CI, el proyecto reveló **20 warnings preexistentes**, casi
todos del tipo `react-hooks/exhaustive-deps` (dependencias faltantes/extra en
`useEffect` y `useMemo`).

No se corrigieron de inmediato porque varios de esos hooks probablemente
excluyen dependencias **a propósito**, para evitar loops infinitos de
re-render (un patrón común y válido en React, aunque el linter no lo sepa
distinguir de un descuido real). Corregirlos a ciegas sin entender cada caso
individual podía introducir bugs de comportamiento reales a cambio de
silenciar warnings — un mal trade-off.

## Los 8 errores reales (no warnings) ya se corrigieron

A diferencia de los warnings de hooks, estos sí eran problemas concretos y se
arreglaron en el mismo commit que introdujo este archivo:

- 4× `prefer-const`: variables declaradas con `let` que nunca se reasignaban
  (`queue`, `updatedMicrocycles`, `aliasMap`, `globalMap`) — auto-fixeado.
- 4× `no-useless-escape`: comillas escapadas innecesariamente dentro de un
  string con comillas dobles en `AthleteDashboard.tsx` — no era un bug
  funcional, pero sí ruido que confundía la lectura del código.

## Roadmap

Cada warning de `exhaustive-deps` debería revisarse uno por uno: si la
dependencia faltante es intencional, agregar un comentario
`// eslint-disable-next-line react-hooks/exhaustive-deps` con la razón
explícita. Si no es intencional, agregar la dependencia y verificar que no
rompe el comportamiento. A medida que se vayan resolviendo, bajar el número
en `max-warnings` hasta llegar a 0.
