import { buildSync } from 'esbuild'
import { copyFileSync, existsSync, mkdirSync, renameSync, rmSync, unlinkSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outfile = join(root, 'dist', 'index.js')
const tmpfile = join(root, 'dist', 'index.js.tmp')
const clientOutfile = join(root, 'dist', 'client.js')
const clientTmpfile = join(root, 'dist', 'client.js.tmp')

mkdirSync(join(root, 'dist'), { recursive: true })
rmSync(tmpfile, { force: true })
rmSync(clientTmpfile, { force: true })

try {
  buildSync({
    entryPoints: [join(root, 'src', 'index.ts')],
    bundle: true,
    platform: 'node',
    format: 'esm',
    // Downlevel `using` — Node's ESM loader rejects it as `Unexpected identifier`.
    target: 'node20',
    outfile: tmpfile,
    external: [
      '@deepseek-ai/cordis',
      '@deepseek-ai/schemastery',
      '@deepseek-ai/dsh-llm',
      '@deepseek-ai/dsh-credentials',
      '@deepseek-ai/dsh-launch-environment',
      '@deepseek-ai/dsh-settings',
      '@deepseek-ai/dsh-timeout',
      '@deepseek-ai/dsh-home-paths',
      '@deepseek-ai/dsh-attachment',
      '@deepseek-ai/dsh-util-values',
    ],
  })
  buildSync({
    entryPoints: [join(root, 'src', 'client', 'index.ts')],
    bundle: true,
    platform: 'browser',
    format: 'cjs',
    target: 'es2022',
    outfile: clientTmpfile,
    banner: { js: `window.__ModuleLoader__.load({ id: ${JSON.stringify('dsh-provider-qoder')}, factory: (require) => { var module = { exports: {} }; var exports = module.exports;` },
    footer: { js: 'return module.exports; } });' },
    external: [
      '@deepseek-ai/cordis',
      'react',
      'react/jsx-runtime',
      '@deepseek-ai/dsh-api-remotes',
      '@deepseek-ai/dsh-client-locale',
      '@deepseek-ai/dsh-client-ui-renderer',
      '@deepseek-ai/dsh-client-ui-settings',
      '@deepseek-ai/dsh-client-ui-slots',
    ],
  })
} catch (err) {
  console.error(err)
  rmSync(tmpfile, { force: true })
  rmSync(clientTmpfile, { force: true })
  process.exit(1)
}

try {
  renameSync(tmpfile, outfile)
  renameSync(clientTmpfile, clientOutfile)
} catch {
  if (existsSync(tmpfile)) {
    copyFileSync(tmpfile, outfile)
    unlinkSync(tmpfile)
  }
  if (existsSync(clientTmpfile)) {
    copyFileSync(clientTmpfile, clientOutfile)
    unlinkSync(clientTmpfile)
  }
}
