import { defineConfig } from 'vite'

// Compila la página pública del catálogo (npm run build:catalog). Es aparte de la app: no lleva Conta ni su base de datos.
export default defineConfig({
  root: 'catalog',
  base: './',
  build: { outDir: '../dist-artifact/catalog-build', emptyOutDir: true, target: 'es2022' },
})
