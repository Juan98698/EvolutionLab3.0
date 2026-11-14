/** Solo rutas internas de la app ("/dashboard"), nunca enlaces externos ni "//otro-dominio". */
export function isInternalPath(url: unknown): url is string {
  return typeof url === 'string' && url.startsWith('/') && !url.startsWith('//') && !url.includes('\\');
}
