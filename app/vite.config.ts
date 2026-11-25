/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// `npm run build:artifact` genera la versión que se publica como página en claude.ai:
// sin service worker (no está permitido allí) y con rutas relativas.
const artifact = process.env.CONTA_ARTIFACT === '1'

export default defineConfig({
  base: artifact ? './' : '/',
  plugins: [
    react(),
    ...(artifact
      ? []
      : [
          VitePWA({
            registerType: 'autoUpdate',
            includeAssets: ['icon.svg'],
            // La página pública del catálogo (/catalogo/) es otra página: no debe abrir Conta.
            workbox: { navigateFallbackDenylist: [/^\/catalogo\//] },
            manifest: {
              name: 'Conta',
              short_name: 'Conta',
              description: 'Ventas, gastos, deudas e inventario de tu negocio.',
              lang: 'es',
              theme_color: '#0f766e',
              background_color: '#f5f7f6',
              display: 'standalone',
              start_url: '/',
              icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }],
            },
          }),
        ]),
  ],
  test: { environment: 'node', setupFiles: ['./src/test-setup.ts'] },
})
