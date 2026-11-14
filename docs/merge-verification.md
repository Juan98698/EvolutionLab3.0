# Integración de Estudio con los cambios remotos

La fusión integra `544878a` y `411d997`, conservando los commits de ambos lados.

## Decisiones de integración

- Se conserva el sistema visual Estudio, sus componentes de autenticación, navegación por rol, estilos responsive y ocho referencias visuales. Las capturas antiguas que ya no utiliza la suite permanecen eliminadas. Se incorporan las correcciones remotas de codificación de textos.
- Se conserva el aislamiento de cachés por propietario y el RPC transaccional e idempotente de sesiones. La fórmula de 1RM unifica repeticiones máximas y redondeo a una décima. El resultado de guardado corresponde a la sesión actual, incluso si una anterior sigue pendiente.
- La captura KG/LBS conserva la conversión de valores al cambiar de unidad y guarda siempre kilogramos. Los textos de React evitan el escape manual duplicado.
- La confirmación del retorno de Mercado Pago espera al perfil persistido. El ID del pago del ledger permite confirmar renovaciones anticipadas; un plan que ya estaba activo no confirma otra compra solo por los parámetros de la URL. Se preservan los parámetros de navegación ajenos al checkout.
- Se retira el manejador duplicado de `useTrainerSubscription`, para que no anuncie éxito antes del sondeo compartido.
- Los imports ejecutables de las API usan `.js` para Vercel ESM. `billing.ts` conserva el catálogo único; `plans.ts` ofrece el nombre compatible sin duplicar precios.
- La firma admite ID en la URL, normalización de mayúsculas, clave sin espacios añadidos y omisión de partes ausentes, según la [documentación de Mercado Pago](https://www.mercadopago.com.co/developers/en/docs/checkout-pro-preferences/additional-settings/optional-notifications?scope=prod). El ID del cuerpo debe coincidir con el firmado. Se conservan la comprobación exacta del importe y moneda, el ledger y el procesamiento de devoluciones. Un fallo transitorio mantiene el reintento; una simulación explícita sin pago real se reconoce sin activar acceso.
- Los mocks siguen fuera del cliente normal, en el adaptador explícito del servidor E2E. Las nuevas pruebas verifican que una bandera del navegador no modifica el cliente real.
- Se incorporan la recuperación de `auth-ready` al salir, el boot guard limitado al arranque, rutas internas en push, liberación de canales de realtime y carga diferida del acceso.
- CI conserva ejecución manual, auditoría y comprobaciones Estudio. El workflow de actualización de capturas usa la misma versión de Playwright y genera solo las referencias actuales. El lockfile conserva versiones iguales o más recientes que las actualizaciones remotas y el parche local reproducible.
- Vitest descubre las pruebas de la plataforma en `src/` y `api/`, excluyendo dependencias anidadas y pruebas de carpetas temporales de instalación.
- Las dos esperas de carga diferida detectadas en Safari admiten hasta 15 segundos, coherentes con el presupuesto de arranque; las comprobaciones de geometría y de funcionamiento se mantienen.

## Verificación reproducible

Resultado final: tipos, lint y build aprobados; 906 pruebas en 93 archivos; 73 casos de navegador aprobados y 8 casos visuales omitidos intencionadamente en WebKit; una prueba de rendimiento móvil aprobada. Las referencias Estudio se compararon sin regenerarlas. El lockfile es coherente y la auditoría npm reporta cero avisos conocidos.

Se verificó la disponibilidad del esquema remoto de Supabase y se repitió el checkout contra Mercado Pago sandbox: identidad obtenida del JWT, 19.900 COP, cero pagos creados, tarifas intactas y cuenta desechable eliminada. La portada compilada registró LCP de 3.056 ms y CLS 0 bajo el perfil móvil simulado.

```sh
npm run typecheck
npm run lint
npm run test:run
npm run build
npm run test:e2e -- --workers=2
npm run test:performance
npm ci --dry-run --ignore-scripts --no-audit --no-fund
npm audit --audit-level=low
```

Los chequeos remotos están separados: `node scripts/verify-remote.mjs` solo lee el esquema; `node scripts/verify-checkout.mjs` exige vendedor de pruebas, crea una preferencia sin cargo y elimina su cuenta desechable. La fusión no añade migraciones nuevas.

El CI de GitHub y el despliegue público no se ejecutan al crear el commit local. Las comprobaciones de publicación de `finding-closure.md` siguen siendo aplicables.
