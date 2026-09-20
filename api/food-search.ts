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
    // Endpoint optimizado en español con filtrado estricto de campos para velocidad extrema
    const offUrl = `https://es.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(
      term
    )}&search_simple=1&action=process&json=1&page_size=20&fields=code,product_name,product_name_es,brands,nutriments`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7000);

    const response = await fetch(offUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'EvolutionLab/3.0 - Web - (soporte@evolutionlab.app)',
        Accept: 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`Open Food Facts respondió con estado ${response.status}`);
      return res.status(200).json({ products: [], warning: `Estado upstream: ${response.status}` });
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      console.warn('Open Food Facts devolvió un formato no JSON:', contentType);
      return res.status(200).json({ products: [] });
    }

    const data = await response.json();
    const products = Array.isArray(data?.products) ? data.products : [];

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
