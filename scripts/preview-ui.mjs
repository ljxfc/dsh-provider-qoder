// Reproducible local component preview. React is a temporary dev dependency, not shipped.
import { buildSync } from 'esbuild'
import { createServer } from 'node:http'
import { mkdirSync, readFileSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { tmpdir } from 'node:os'
const root = resolve(import.meta.dirname, '..')
const output = join(root, 'output', 'playwright')
const modules = process.env.QODER_PREVIEW_MODULES ?? join(tmpdir(), 'dsh-qoder-ui-validation', 'node_modules')
mkdirSync(output, { recursive: true })
buildSync({ entryPoints: [join(root, 'scripts/ui-preview.tsx')], bundle: true, platform: 'browser', format: 'iife', target: 'es2022', outfile: join(output, 'preview.js'), alias: { react: join(modules, 'react'), 'react-dom': join(modules, 'react-dom') } })
if (process.argv.includes('--build-only')) process.exit(0)
const server = createServer((req, res) => {
  if (req.url?.split('?')[0] === '/preview.js') {
    res.writeHead(200, { 'content-type': 'text/javascript' }).end(readFileSync(join(output, 'preview.js')))
  } else {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Qoder UI validation fixture</title></head><body><div id="root"></div><script src="/preview.js"></script></body></html>')
  }
})
server.listen(47831, '127.0.0.1', () => console.log('UI fixture: http://127.0.0.1:47831'))
