// Genera dist-artifact/catalogo.html: la página pública del catálogo en un solo archivo, lista para publicarla
// como página en claude.ai. Uso: npm run build:catalog
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const out = 'dist-artifact'
mkdirSync(out, { recursive: true })
execFileSync('npx', ['vite', 'build', '--config', 'vite.catalog.config.ts'], { stdio: 'inherit' })

const build = join(out, 'catalog-build')
const html = readFileSync(join(build, 'index.html'), 'utf8')
const scripts = [...html.matchAll(/<script[^>]*\ssrc="\.?\/?([^"]+)"[^>]*><\/script>/g)].map((m) => m[1])
const styles = [...html.matchAll(/<link[^>]*rel="stylesheet"[^>]*\shref="\.?\/?([^"]+)"[^>]*>/g)].map((m) => m[1])
if (scripts.length !== 1) throw new Error(`Se esperaba un solo script y hay ${scripts.length}: ${scripts}`)
if (styles.length === 0) throw new Error('La página no trae hoja de estilos: falta importar catalog.css en main.ts')

const read = (f) => readFileSync(join(build, f), 'utf8')
const js = read(scripts[0]).replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--')
const css = styles.map(read).join('\n').replace(/<\/style/gi, '<\\/style')

const page = `<title>Catálogo del negocio</title>
<style id="catalog-style">${css}</style>
<div id="app"></div>
<script type="application/json" id="catalog-data">null</script>
<script type="module" id="catalog-script">${js}</script>
`
writeFileSync(join(out, 'catalogo.html'), page)
console.log(`\ndist-artifact/catalogo.html: ${(page.length / 1024).toFixed(0)} KB`)
