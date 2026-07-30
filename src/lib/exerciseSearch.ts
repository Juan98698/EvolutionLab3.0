/**
 * Normaliza una cadena de texto para búsqueda flexible:
 * - Convierte a minúsculas
 * - Remueve acentos y tildes (NFD)
 * - Reemplaza caracteres especiales por espacios
 */
export const normalizeSearchText = (str: string | undefined | null): string => {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .trim();
};

/**
 * Filtra una lista de ejercicios usando búsqueda basada en tokens (palabras clave multitono).
 * Permite encontrar ejercicios independientemente del orden de las palabras, acentos o conectores.
 * Ej. "press inclinado hammer" o "press hammer" encontrará "Press de Pecho Inclinado en Máquina Hammer".
 */
export const filterExercisesByQuery = <T extends { nombre: string; grupo_muscular?: string | null; descripcion?: string | null }>(
  items: T[],
  rawQuery: string,
  limit = 25
): T[] => {
  const cleanQuery = normalizeSearchText(rawQuery);
  if (!cleanQuery) return items.slice(0, limit);

  const queryTokens = cleanQuery.split(/\s+/).filter(Boolean);

  return items
    .filter(item => {
      const normName = normalizeSearchText(item.nombre);
      const normGroup = normalizeSearchText(item.grupo_muscular);
      const normDesc = normalizeSearchText(item.descripcion);
      const fullText = `${normName} ${normGroup} ${normDesc}`;

      // Todas las palabras ingresadas por el usuario deben estar presentes en el texto del ejercicio
      return queryTokens.every(token => fullText.includes(token));
    })
    .sort((a, b) => {
      const normA = normalizeSearchText(a.nombre);
      const normB = normalizeSearchText(b.nombre);

      // 1. Priorizar coincidencia exacta de inicio
      const aStarts = normA.startsWith(cleanQuery);
      const bStarts = normB.startsWith(cleanQuery);
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;

      // 2. Priorizar coincidencia donde el nombre del ejercicio contiene todos los tokens (frente a coincidencias en descripción)
      const aNameMatch = queryTokens.every(token => normA.includes(token));
      const bNameMatch = queryTokens.every(token => normB.includes(token));
      if (aNameMatch && !bNameMatch) return -1;
      if (!aNameMatch && bNameMatch) return 1;

      return normA.localeCompare(normB);
    })
    .slice(0, limit);
};
