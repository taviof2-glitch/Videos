// Genera dist-artifact/conta.html: toda la app (JS y CSS) dentro de un solo archivo, lista para publicarla
// como página en claude.ai. Uso: npm run build:artifact
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const out = 'dist-artifact'
// Solo se limpia lo propio: en esta carpeta también vive catalogo.html (npm run build:catalog).
rmSync(join(out, 'build'), { recursive: true, force: true })
mkdirSync(out, { recursive: true })
execFileSync('npx', ['vite', 'build', '--outDir', join(out, 'build'), '--emptyOutDir'], {
  stdio: 'inherit',
  env: { ...process.env, CONTA_ARTIFACT: '1', VITE_ROUTER: 'memory' },
})

const html = readFileSync(join(out, 'build', 'index.html'), 'utf8')
const scripts = [...html.matchAll(/<script[^>]*\ssrc="\.?\/?([^"]+)"[^>]*><\/script>/g)].map((m) => m[1])
const styles = [...html.matchAll(/<link[^>]*rel="stylesheet"[^>]*\shref="\.?\/?([^"]+)"[^>]*>/g)].map((m) => m[1])
if (scripts.length !== 1) throw new Error(`Se esperaba un solo script y hay ${scripts.length}: ${scripts}`)
if (styles.length === 0) throw new Error('La página no trae hoja de estilos')

const read = (f) => readFileSync(join(out, 'build', f), 'utf8')
// Dentro de <script> y <style> inline hay que evitar que el contenido cierre la etiqueta.
const js = read(scripts[0]).replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--')
const css = styles.map(read).join('\n').replace(/<\/style/gi, '<\\/style')

const page = `<title>Conta</title>
<style>
${css}
</style>
<div id="root"></div>
<script type="module">
${js}
</script>
`
writeFileSync(join(out, 'conta.html'), page)
console.log(`\ndist-artifact/conta.html: ${(page.length / 1024).toFixed(0)} KB (${scripts.length} script, ${styles.length} hoja de estilos)`)
