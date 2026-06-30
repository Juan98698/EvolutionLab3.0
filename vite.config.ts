/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
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
                statuses: [0, 200]
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
          }
        ]
      }
    })
  ],
  test: {
    exclude: ['**/e2e/**', 'node_modules', 'dist', '.vercel']
  }
});
