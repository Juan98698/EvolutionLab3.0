/**
 * Detecta si la app corre bajo los tests E2E de Playwright.
 *
 * Solo se consulta en desarrollo: supabaseClient.ts lo llama dentro de un
 * `if (import.meta.env.DEV)`, así que en el build de producción los mocks ni
 * siquiera se incluyen y nadie puede activarlos con `?e2e=true`.
 */
export function isE2EContext(env: { userAgent: string; search: string; playwrightFlag: unknown }): boolean {
  return (
    env.userAgent.includes('Headless') ||
    env.playwrightFlag === true ||
    new URLSearchParams(env.search).get('e2e') === 'true'
  );
}
