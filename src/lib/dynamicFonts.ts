/**
 * Carga bajo demanda las tipografías de Google Fonts usadas SOLO para el
 * branding personalizado del entrenador (TrainerBranding.tsx) y, en el
 * dashboard del atleta, la tipografía específica que su entrenador eligió.
 *
 * 'Orbitron' e 'Inter' se usan en toda la app y siguen cargándose de forma
 * global desde index.html — por eso están pre-marcadas como "ya cargadas"
 * acá, para que nunca se pidan de nuevo por esta vía.
 *
 * Evita inyectar la misma familia dos veces aunque se llame desde varios
 * componentes (branding del entrenador + dashboard de uno o más atletas).
 */

// Pesos exactos que ya usaba index.html para cada familia, para no cambiar
// el aspecto visual al pasarlas de carga global a carga dinámica.
const BRAND_FONT_WEIGHTS: Record<string, string> = {
  'Outfit': 'wght@400;600;700;800',
  'Montserrat': 'wght@400;600;700;800',
  'Bebas Neue': '',
  'Oswald': 'wght@500;700',
  'Rajdhani': 'wght@500;600;700',
  'Chakra Petch': 'wght@500;600;700',
};

const alreadyLoaded = new Set<string>(['Orbitron', 'Inter']);

export function loadBrandFonts(families: Array<string | undefined | null>): void {
  const pending = Array.from(
    new Set(
      families.filter(
        (f): f is string => !!f && !alreadyLoaded.has(f) && f in BRAND_FONT_WEIGHTS
      )
    )
  );
  if (pending.length === 0) return;

  const familyParams = pending
    .map(f => {
      const weights = BRAND_FONT_WEIGHTS[f];
      const encoded = f.replace(/ /g, '+');
      return weights ? `family=${encoded}:${weights}` : `family=${encoded}`;
    })
    .join('&');

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?${familyParams}&display=swap`;
  document.head.appendChild(link);

  pending.forEach(f => alreadyLoaded.add(f));
}
