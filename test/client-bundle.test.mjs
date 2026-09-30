import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('publishes the dsh 0.2.0 web client contract', async () => {
  const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
  assert.equal(manifest.exports['./client'], './dist/client.js')
  assert.equal(manifest.dsh.client.platform, 'web')
  assert.deepEqual(manifest.dsh.client.inject, [
    '@deepseek-ai/dsh-client-locale',
    '@deepseek-ai/dsh-client-ui-settings',
    '@deepseek-ai/dsh-api-remotes',
  ])
  // dsh 0.2.0 validates exactly these four dsh.client keys and nothing else —
  // an extra key is a load error, so the set is pinned here.
  assert.deepEqual(
    Object.keys(manifest.dsh.client).sort(),
    ['inject', 'platform'],
  )
  // `compatibility.dshReleases` no longer exists in 0.2.0; the declarative
  // compatibility field is `engines.dsh`.
  assert.equal(manifest.dsh.compatibility.dshReleases, undefined)
  assert.equal(manifest.dsh.compatibility.dsh, '^0.2.0-rc.2')
  assert.equal(manifest.engines.dsh, '^0.2.0-rc.2')
  assert.equal(manifest.engines.node, '>=22')
})

test('ships the credential card, the quota surfaces, and the quota remote', async () => {
  const client = await readFile(new URL('../dist/client.js', import.meta.url), 'utf8')
  const host = await readFile(new URL('../dist/index.js', import.meta.url), 'utf8')
  assert.match(client, /window\.__ModuleLoader__\.load/)
  // The credential editor slot.
  assert.match(client, /settings\.models\.provider-card/)
  assert.match(client, /QODERCN_PERSONAL_ACCESS_TOKEN/)
  assert.match(client, /credentials\.set/)
  // The quota surfaces: a footer entry above Settings and a keyed main panel
  // selected by the same id.
  assert.match(client, /sidebar\.footer\.action/)
  assert.match(client, /qoder-quota-panel/)
  assert.match(client, /panel\.qoder/)
  // The toggle that gates both the card and the background poll.
  assert.match(client, /showSidebarQuota/)
  // The Host receiver the browser reaches through the Typert Gateway.
  assert.match(host, /qoder\/quota/)
  assert.match(host, /showSidebarQuota/)
})
