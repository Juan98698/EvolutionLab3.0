import type { VercelRequest, VercelResponse } from './_lib/types';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Manejo de preflight CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido. Utilizar GET.', products: [] });
  }

  const rawQuery = (req.query.q as string) || '';
  const term = rawQuery.trim();

  if (!term || term.length < 2) {
    return res.status(400).json({
      error: 'Parámetro de búsqueda "q" requerido (mínimo 2 caracteres).',
      products: [],
    });
  }

  try {
    const normalizedTerm = term.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    let products: any[] = [];

    // Función auxiliar para consultar search.openfoodfacts.org (Search-a-licious)
    const fetchSearchService = async (q: string): Promise<any[]> => {
      try {
        const url = `https://search.openfoodfacts.org/search?q=${encodeURIComponent(q)}&page_size=25`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);

        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'User-Agent': 'EvolutionLab/3.0 - Web - (soporte@evolutionlab.app)',
            Accept: 'application/json',
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) return [];

        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) return [];

        const data = await response.json();
        if (Array.isArray(data?.hits)) {
          return data.hits.map((h: any) => ({
            code: h.code || '',
            product_name: h.product_name || h.product_name_es || h.product_name_en || '',
            product_name_es: h.product_name_es || h.product_name || '',
            brands: Array.isArray(h.brands) ? h.brands.join(', ') : (h.brands || ''),
            nutriments: h.nutriments || {},
            image_front_small_url: h.image_front_small_url || h.image_url || '',
          }));
        }
      } catch (err: any) {
        console.warn(`Error consultando search.openfoodfacts.org para "${q}":`, err?.message || err);
      }
      return [];
    };

    // 1. Consultar término original en el servicio oficial de búsqueda
    const hits1 = await fetchSearchService(term);
    products.push(...hits1);

    // 2. Si el término tenía tildes y hay pocos resultados (< 15), complementar con versión sin tildes
    if (term !== normalizedTerm && products.length < 15) {
      const hits2 = await fetchSearchService(normalizedTerm);
      for (const h of hits2) {
        const exists = products.some(
          (p) => (p.code && p.code === h.code) || (p.product_name && p.product_name === h.product_name)
        );
        if (!exists) {
          products.push(h);
        }
      }
    }

    // 3. Fallback a world.openfoodfacts.org si el servicio Search-a-licious no devolvió productos
    if (products.length === 0) {
      try {
        const offUrl = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(
          normalizedTerm
        )}&search_simple=1&action=process&json=1&page_size=25&fields=code,product_name,product_name_es,brands,nutriments,image_front_small_url`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);

        const response = await fetch(offUrl, {
          method: 'GET',
          headers: {
            'User-Agent': 'EvolutionLab/3.0 - Web - (soporte@evolutionlab.app)',
            Accept: 'application/json',
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const contentType = response.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            const data = await response.json();
            if (Array.isArray(data?.products)) {
              products = data.products;
            }
          }
        }
      } catch (err: any) {
        console.warn('Fallback cgi/search.pl falló:', err?.message || err);
      }
    }

    // Cache CDN por 1 hora en Vercel Edge Cache para respuestas instantáneas
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
    return res.status(200).json({ products });
  } catch (err: any) {
    console.error('Error en proxy /api/food-search:', err?.message || err);
    return res.status(200).json({
      products: [],
      error: err?.name === 'AbortError' ? 'Tiempo de espera agotado al consultar Open Food Facts' : err?.message,
    });
  }
}
