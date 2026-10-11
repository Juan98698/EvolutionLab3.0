/**
 * chunkRecovery.ts
 *
 * Recuperación centralizada cuando falla la carga de un chunk de Vite
 * (típicamente: el usuario tiene un index.html/bundle viejo en memoria o en caché
 * y un deploy nuevo ya borró los archivos con hash que ese bundle pide).
 *
 * Contexto técnico importante (verificado en Vite 5.4.x): cuando el evento
 * `vite:preloadError` se cancela con `preventDefault()`, Vite TRAGA el error y el
 * `import()` resuelve con `undefined` en lugar de rechazar. `React.lazy` entonces
 * hace `undefined.default` y lanza un `TypeError` críptico ("Cannot read properties
 * of undefined (reading 'default')") que no dice nada sobre la causa real.
 */

/** Clave de sessionStorage con la marca de tiempo de la última recarga por chunk viejo. */
export const CHUNK_RELOAD_KEY = 'evolab_chunk_reload_ts';

/** Ventana mínima entre recargas automáticas, para no entrar en un bucle infinito. */
export const CHUNK_RELOAD_COOLDOWN_MS = 10_000;

/**
 * Error explícito y fácil de agrupar para fallos de carga de chunks que no se
 * pudieron resolver recargando. Reemplaza al `TypeError` críptico de React.lazy.
 */
export class ChunkLoadError extends Error {
  readonly cause?: unknown;

  constructor(
    message = 'No se pudo cargar una parte de la aplicación (versión desactualizada o sin conexión).',
    cause?: unknown
  ) {
    super(message);
    this.name = 'ChunkLoadError';
    this.cause = cause;
  }
}

// Verdadero desde que ESTA página disparó una recarga. Evita que, mientras la
// recarga está en curso, otros componentes lo interpreten como un fallo definitivo.
let reloadInFlight = false;

/**
 * Recarga la página una única vez por ventana de enfriamiento.
 *
 * @returns `true` si hay una recarga en curso (recién disparada o ya pendiente) y el
 * llamador debe esperar sin mostrar error; `false` si no se puede o no conviene
 * recargar (ya se recargó hace poco, o sessionStorage no está disponible) y el
 * llamador debe mostrar un error recuperable al usuario.
 */
export function reloadOnceForStaleChunk(now: number = Date.now()): boolean {
  if (reloadInFlight) return true;

  try {
    const last = Number(sessionStorage.getItem(CHUNK_RELOAD_KEY));
    if (last && now - last <= CHUNK_RELOAD_COOLDOWN_MS) return false;
    sessionStorage.setItem(CHUNK_RELOAD_KEY, String(now));
  } catch {
    // Sin sessionStorage (modo privado estricto, WebViews restringidos) no hay forma
    // de recordar que ya recargamos: recargar a ciegas podría crear un bucle infinito.
    // Es preferible mostrar el error recuperable.
    return false;
  }

  reloadInFlight = true;
  window.location.reload();
  return true;
}

/** Solo para tests: reinicia el estado interno del módulo. */
export function __resetChunkRecoveryForTests(): void {
  reloadInFlight = false;
}
