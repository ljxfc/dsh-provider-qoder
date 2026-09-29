import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('publishes the dsh-v0.1.7 web client card contract', async () => {
  const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
  const client = await readFile(new URL('../dist/client.js', import.meta.url), 'utf8')
  assert.equal(manifest.exports['./client'], './dist/client.js')
  assert.equal(manifest.dsh.compatibility.dshReleases['0.1.7-rc.2'], 'compatible')
  assert.equal(manifest.dsh.client.platform, 'web')
  assert.deepEqual(manifest.dsh.client.inject, [
    '@deepseek-ai/dsh-client-locale',
    '@deepseek-ai/dsh-client-ui-settings',
    '@deepseek-ai/dsh-api-remotes',
  ])
  assert.match(client, /window\.__ModuleLoader__\.load/)
  assert.match(client, /settings\.models\.provider-card/)
  assert.match(client, /QODERCN_PERSONAL_ACCESS_TOKEN/)
  assert.match(client, /credentials\.set/)
})
