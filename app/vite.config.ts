/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// `npm run build:artifact` genera la versión que se publica como página en claude.ai:
// sin service worker (no está permitido allí) y con rutas relativas.
const artifact = process.env.CONTA_ARTIFACT === '1'

export default defineConfig({
  base: artifact ? './' : '/',
  // Versión visible en «Cuenta y nube»: sirve para saber si el celular ya tiene la última.
  define: { __APP_BUILD__: JSON.stringify(new Date().toISOString().slice(0, 16).replace('T', ' ')) },
  // La página de claude.ai es un solo archivo: la tipografía va dentro del CSS.
  build: artifact ? { assetsInlineLimit: 1_000_000 } : undefined,
  plugins: [
    react(),
    ...(artifact
      ? []
      : [
          VitePWA({
            registerType: 'autoUpdate',
            includeAssets: ['icon.svg', 'apple-touch-icon.png'],
            // La página pública del catálogo (/catalogo/) es otra página: no debe abrir la app.
            workbox: { navigateFallbackDenylist: [/^\/catalogo\//, /^\/api\//], globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff2}'] },
            manifest: {
              name: 'Houselite',
              short_name: 'Houselite',
              description: 'Ventas, gastos, deudas e inventario de tu negocio.',
              lang: 'es',
              theme_color: '#0a0a0a',
              background_color: '#0a0a0a',
              display: 'standalone',
              id: '/',
              // «Compartir → Houselite» desde WhatsApp u otra app (Android/Chrome): abre /compartir con el texto.
              share_target: { action: '/compartir', method: 'GET', params: { title: 'title', text: 'text', url: 'url' } },
              start_url: '/',
              scope: '/',
              // Chrome en Android exige PNG de 192 y 512 px para ofrecer la instalación; el «maskable» es sin esquinas.
              icons: [
                { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
                { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
                { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
              ],
            },
          }),
        ]),
  ],
  test: { environment: 'node', setupFiles: ['./src/test-setup.ts'] },
})
