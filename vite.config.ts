/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { visualizer } from 'rollup-plugin-visualizer';

// Plugin dev para proxy local de Open Food Facts (/api/food-search)
function foodSearchDevPlugin() {
  return {
    name: 'food-search-dev-plugin',
    configureServer(server: any) {
      server.middlewares.use('/api/food-search', async (req: any, res: any) => {
        // Manejo de CORS
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
          res.statusCode = 204;
          res.end();
          return;
        }

        try {
          const url = new URL(req.url, 'http://localhost');
          const term = (url.searchParams.get('q') || '').trim();
          if (!term || term.length < 2) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Término de búsqueda requerido', products: [] }));
            return;
          }

          const normalizedTerm = term.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
          let products: any[] = [];

          // Consulta al nuevo servicio de búsqueda oficial de Open Food Facts (Search-a-licious)
          const fetchSearchService = async (q: string): Promise<any[]> => {
            try {
              const searchUrl = `https://search.openfoodfacts.org/search?q=${encodeURIComponent(q)}&page_size=25`;
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), 6000);

              const upstreamRes = await fetch(searchUrl, {
                method: 'GET',
                headers: {
                  'User-Agent': 'EvolutionLab/3.0 - Web - (soporte@evolutionlab.app)',
                  Accept: 'application/json',
                },
                signal: controller.signal,
              });

              clearTimeout(timeoutId);

              if (!upstreamRes.ok) return [];
              const contentType = upstreamRes.headers.get('content-type') || '';
              if (!contentType.includes('application/json')) return [];

              const data = await upstreamRes.json();
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
              console.warn(`Error en dev proxy search.openfoodfacts.org para "${q}":`, err?.message || err);
            }
            return [];
          };

          // 1. Consultar término original
          const hits1 = await fetchSearchService(term);
          products.push(...hits1);

          // 2. Si tenía acentos y hay pocos resultados (< 15), complementar con versión sin acentos
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

          // 3. Fallback a world.openfoodfacts.org si Search-a-licious no devolvió productos
          if (products.length === 0) {
            try {
              const offUrl = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(
                normalizedTerm
              )}&search_simple=1&action=process&json=1&page_size=25&fields=code,product_name,product_name_es,brands,nutriments,image_front_small_url`;
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), 6000);

              const upstreamRes = await fetch(offUrl, {
                method: 'GET',
                headers: {
                  'User-Agent': 'EvolutionLab/3.0 - Web - (soporte@evolutionlab.app)',
                  Accept: 'application/json',
                },
                signal: controller.signal,
              });

              clearTimeout(timeoutId);

              if (upstreamRes.ok) {
                const contentType = upstreamRes.headers.get('content-type') || '';
                if (contentType.includes('application/json')) {
                  const data = await upstreamRes.json();
                  if (Array.isArray(data?.products)) {
                    products = data.products;
                  }
                }
              }
            } catch (err: any) {
              console.warn('Fallback cgi/search.pl falló en dev:', err?.message || err);
            }
          }

          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ products }));
        } catch (err: any) {
          console.error('Error en Vite food-search dev middleware:', err?.message || err);
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ products: [], error: err?.message }));
        }
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    foodSearchDevPlugin(),
    // Solo se activa con `ANALYZE=true npm run build` -- no corre en builds normales
    // ni en CI, y no afecta el bundle final (solo genera un reporte HTML aparte).
    process.env.ANALYZE && visualizer({
      filename: 'dist/stats.html',
      open: false,
      gzipSize: true,
      brotliSize: true,
      template: 'treemap'
    }),
    VitePWA({
      registerType: 'autoUpdate',
      // NO usar includeAssets — los iconos y fondo ya están cubiertos por globPatterns.
      // Duplicarlos causa entradas precache duplicadas con revisiones conflictivas
      // que corrompen la caché del SW en dispositivos móviles.
      manifest: {
        name: 'Evolution Lab',
        short_name: 'Evolution Lab',
        description: 'Plataforma inteligente de entrenamiento y sobrecarga progresiva',
        theme_color: '#0b0f19',
        background_color: '#0b0f19',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          {
            src: 'icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'icon.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          }
        ]
      },

      workbox: {
        // Importar el script de push para que el SW maneje eventos push y notificationclick
        importScripts: ['sw-push.js'],
        // Solo pre-cachear los bundles generados por Vite (JS, CSS, HTML).
        // Los iconos y fondo se cargan bajo demanda, no necesitan precache.
        globPatterns: ['**/*.{js,css,html}'],
        // Excluir del precache los chunks pesados y de uso minoritario: jsPDF +
        // html2canvas (~590KB, solo se usan al exportar un reporte PDF, función
        // premium) y AdminDashboard (~39KB, solo lo usa el admin). Se siguen
        // cacheando bajo demanda vía runtimeCaching más abajo, así que la
        // experiencia offline no cambia — solo dejan de descargarse para TODOS
        // los usuarios apenas instalan la PWA.
        globIgnores: ['**/jspdf*.js', '**/html2canvas*.js', '**/AdminDashboard*.js', 'stats.html'],
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,

        // CRÍTICO: Excluir TODAS las URLs de Supabase del NavigationRoute.
        // Sin esto, el SW intercepta redirects de auth y devuelve index.html cacheado
        // en vez de permitir que Supabase procese la autenticación, causando que
        // tras varios refrescos la sesión se corrompa y el usuario sea expulsado.
        navigateFallbackDenylist: [/^\/api/, /supabase\.co/i],

        runtimeCaching: [
          {
            // CRÍTICO: Forzar que TODA solicitud a la API REST y Auth de Supabase
            // vaya SIEMPRE directo a la red, sin que el SW la toque jamás.
            // Esta es la regla más importante de toda la configuración.
            urlPattern: /.*\.supabase\.co\/(?:rest|auth|realtime)\/.*/i,
            handler: 'NetworkOnly',
          },
          {
            // Caché de Google Fonts (recursos estáticos de CDN)
            urlPattern: /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 año
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            // Caché de archivos públicos de Supabase Storage (GIFs y fotos de ejercicios)
            // Estos son archivos estáticos públicos, seguros de cachear.
            urlPattern: /.*\.supabase\.co\/storage\/v1\/object\/public\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'supabase-storage-cache',
              expiration: {
                maxEntries: 150,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 días
              },
              cacheableResponse: {
                statuses: [200]
              }
            }
          },
          {
            // Caché de imágenes y GIFs externos genéricos
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)(?:\?.*)?$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'external-media-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 días
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            // Los chunks excluidos del precache (jsPDF, html2canvas, AdminDashboard)
            // se cachean recién cuando alguien los usa de verdad, no en el install.
            urlPattern: /\/(jspdf|html2canvas|AdminDashboard)[^/]*\.js$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'on-demand-chunks-cache',
              expiration: {
                maxEntries: 6,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 días
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      }
    })
  ],
  test: {
    exclude: ['**/e2e/**', 'node_modules', 'dist', '.vercel'],
    setupFiles: ['./src/test-setup.ts']
  },
  build: {
    rollupOptions: {
      output: {
        // Basado en el perfilado real con rollup-plugin-visualizer (no en una suposición):
        // Chart.js NO aparecía en el chunk principal (ya se carga dinámicamente en
        // AthleteDashboard/Historial). Los contribuyentes reales eran Supabase completo
        // (~770KB sin comprimir, entre sus 7 subpaquetes) y Sentry (~208KB), ninguno de
        // los dos separado en un vendor chunk propio hasta ahora.
        manualChunks: {
          'vendor-supabase': [
            '@supabase/supabase-js',
            '@supabase/auth-js',
            '@supabase/postgrest-js',
            '@supabase/storage-js',
            '@supabase/realtime-js',
            '@supabase/functions-js'
          ],
          'vendor-sentry': ['@sentry/react', '@sentry/browser'],
          'vendor-react': ['react', 'react-dom', 'react-router-dom', 'react-router']
        }
      }
    }
  }
});
