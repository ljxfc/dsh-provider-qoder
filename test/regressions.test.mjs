/**
 * Regression tests for four defects that were silent in normal use:
 *
 * - the quota poll left a timer running after the last surface unmounted, so the
 *   plugin kept calling Qoder every two minutes with nothing on screen;
 * - a transient 5xx from the PAT-exchange host was reported as a bad credential,
 *   which made a retryable outage look permanent;
 * - a pinned static model catalog silently dropped the free / price / promotion
 *   facts the live discovery path publishes;
 * - an omitted modality list read as "accepts nothing".
 */

import assert from 'node:assert/strict'
import test from 'node:test'

import { QoderAdapter, fetchUserInfo, startQuotaAutoRefresh, QUOTA_AUTO_REFRESH_MS, resolveAdapterOptions } from '../dist/index.js'

const endpoints = {
  gateway: 'https://gateway.example',
  openapi: 'https://openapi.example',
  manage: 'https://manage.example',
}

function connection() {
  return {
    endpoints,
    apiKeyEnv: 'QODERCN_PERSONAL_ACCESS_TOKEN',
    maxTokens: 32_768,
    defaultContextWindow: 1_000_000,
    streamIdleTimeoutMs: 300_000,
    retryPolicy: {},
    machineId: 'test-machine',
  }
}

/** An adapter whose PAT exchange always answers `status`. */
function adapterAnswering(status) {
  return new QoderAdapter({
    options: connection,
    resolveApiKey: async () => 'pt-regression',
    resolveAttachments: () => undefined,
  })
}

async function statusOfExchange(status) {
  const original = globalThis.fetch
  globalThis.fetch = async (input) => {
    if (String(input).includes('/jobToken/exchange')) {
      return {
        ok: false,
        status,
        statusText: 'stub',
        text: async () => 'stub body',
      }
    }
    throw new Error(`unexpected ${String(input)}`)
  }
  try {
    await adapterAnswering(status).getUsage()
    return 'no error'
  } catch (error) {
    return error.code
  } finally {
    globalThis.fetch = original
  }
}

test('a 5xx from the PAT exchange stays retryable instead of reading as a bad credential', async () => {
  assert.equal(await statusOfExchange(503), 'SERVER')
  assert.equal(await statusOfExchange(500), 'SERVER')
  // Only the two statuses that really mean "this PAT cannot work" are AUTH.
  assert.equal(await statusOfExchange(401), 'AUTH')
  assert.equal(await statusOfExchange(403), 'AUTH')
})

test('the exchange failure message is reported once, not prefixed twice', async () => {
  const original = globalThis.fetch
  globalThis.fetch = async (input) => {
    if (String(input).includes('/jobToken/exchange')) {
      return { ok: false, status: 401, statusText: 'Unauthorized', text: async () => '' }
    }
    throw new Error(`unexpected ${String(input)}`)
  }
  try {
    await adapterAnswering(401).getUsage()
    assert.fail('expected the exchange to fail')
  } catch (error) {
    assert.equal(error.message.match(/PAT exchange failed/g).length, 1, error.message)
  } finally {
    globalThis.fetch = original
  }
})

test('a pinned catalog keeps every fact the live discovery path publishes', () => {
  const [model] = resolveAdapterOptions({
    models: [{
      id: 'x',
      name: 'X',
      contextWindow: 200_000,
      free: true,
      priceFactor: 0.5,
      promotion: { badge: { en: 'off-peak' }, windowStart: '22:00', windowEnd: '08:00' },
    }],
  }).models
  assert.equal(model.free, true)
  assert.equal(model.priceFactor, 0.5)
  assert.deepEqual(model.promotion, {
    badge: { en: 'off-peak' },
    windowStart: '22:00',
    windowEnd: '08:00',
  })
})

test('an empty modality list from the settings schema reads as unspecified, not as none', () => {
  const [model] = resolveAdapterOptions({
    models: [{ id: 'y', inputModalities: [] }],
  }).models
  assert.equal(model.inputModalities, undefined)
})

test('the quota poll leaves no timer behind whichever surface stops last', () => {
  const live = new Map()
  let nextHandle = 1
  const timer = {
    set: (callback) => { const handle = nextHandle++; live.set(handle, callback); return handle },
    clear: (handle) => { live.delete(handle) },
  }
  let reads = 0
  const controller = { refresh: async () => { reads += 1 } }

  // The order that used to leak: the surface that STARTED the poll stops first,
  // while the second one is still mounted.
  const stopCard = startQuotaAutoRefresh(controller, () => true, timer)
  const stopPanel = startQuotaAutoRefresh(controller, () => true, timer)
  assert.equal(live.size, 1, 'both surfaces share one timer')

  stopCard()
  assert.equal(live.size, 1, 'the poll must survive while one surface is mounted')

  stopPanel()
  assert.equal(live.size, 0, 'the last stop must clear the timer')

  // A remount after a full teardown gets a working timer again.
  const stopAgain = startQuotaAutoRefresh(controller, () => true, timer)
  assert.equal(live.size, 1)
  stopAgain()
  assert.equal(live.size, 0)
  assert.ok(reads >= 2)
})

test('a double unmount cannot drive the refcount negative', () => {
  const live = new Set()
  let nextHandle = 1
  const timer = {
    set: () => { const handle = nextHandle++; live.add(handle); return handle },
    clear: (handle) => { live.delete(handle) },
  }
  const controller = { refresh: async () => {} }

  const stopOne = startQuotaAutoRefresh(controller, () => true, timer)
  const stopTwo = startQuotaAutoRefresh(controller, () => true, timer)
  stopOne()
  stopOne() // the same caller unmounting twice
  assert.equal(live.size, 1, 'the second surface still owns the poll')
  stopTwo()
  assert.equal(live.size, 0)
  assert.equal(QUOTA_AUTO_REFRESH_MS > 0, true)
})

test('the poll reads the live visibility predicate, not the one captured at start', () => {
  const live = new Map()
  let nextHandle = 1
  const timer = {
    set: (callback) => { const handle = nextHandle++; live.set(handle, callback); return handle },
    clear: (handle) => { live.delete(handle) },
  }
  let reads = 0
  const controller = { refresh: async () => { reads += 1 } }

  let visible = false
  const stop = startQuotaAutoRefresh(controller, () => visible, timer)
  assert.equal(reads, 0, 'a hidden surface does not fetch on start')

  const before = reads
  visible = true
  // A real timer is gone from the clock once it fires; the double has to model
  // that, and the tick immediately schedules its successor.
  for (const [handle, callback] of [...live]) {
    live.delete(handle)
    callback()
  }
  assert.equal(reads, before + 1, 'the next tick follows the live toggle')
  stop()
  assert.equal(live.size, 0)
})

test('/userinfo tells an outage apart from a rejected token', async () => {
  const original = globalThis.fetch
  const stub = (status, body) => {
    globalThis.fetch = async () => ({
      ok: status < 400,
      status,
      statusText: 'stub',
      text: async () => 'stub body',
      json: async () => body,
    })
  }
  const endpoints = { gateway: 'https://g', openapi: 'https://o', manage: 'https://m' }
  try {
    stub(500, undefined)
    // An outage must not be reported as a credential verdict.
    await assert.rejects(
      () => fetchUserInfo('jt', endpoints),
      error => error?.status === 500 && /identity lookup failed/.test(error.message),
    )
    // An OK answer that omits the id is a real answer, not a thrown error.
    stub(200, { email: 'a@b.c' })
    assert.deepEqual(await fetchUserInfo('jt', endpoints), { userID: '', email: 'a@b.c', name: '' })
  } finally {
    globalThis.fetch = original
  }
})

test('a failing catalog refresh falls back to the catalog already read', async (t) => {
  const original = globalThis.fetch
  t.after(() => { globalThis.fetch = original })
  let catalogCalls = 0
  let failCatalog = false
  globalThis.fetch = async (input) => {
    const url = String(input)
    if (url.includes('/jobToken/exchange')) {
      return Response.json({ token: 'jt', refresh_token: 'jrt', expires_in: 86_400_000 })
    }
    if (url.includes('/api/v1/userinfo')) {
      return Response.json({ id: 'user-1', email: 'u@e.c', name: 'U' })
    }
    if (url.includes('/algo/api/v2/model/list')) {
      catalogCalls += 1
      if (failCatalog) throw new Error('gateway down')
      return Response.json({ chat: [{ key: 'gmodel', enable: true, display_name: 'GLM-5.3' }] })
    }
    throw new Error(`unexpected ${url}`)
  }
  const adapter = new QoderAdapter({
    options: connection,
    resolveApiKey: async () => 'pt-catalog-fallback',
    resolveAttachments: () => undefined,
  })
  const first = await adapter.listModels('qoder-cn')
  assert.deepEqual(first.map(model => model.id), ['glm-5.3'])

  failCatalog = true
  // The picker must not go empty because one refresh failed.
  const second = await adapter.listModels('qoder-cn')
  assert.deepEqual(second.map(model => model.id), ['glm-5.3'])
  assert.equal(catalogCalls, 2, 'the refresh was actually attempted')
})

test('a catalog entry with no window falls back to the built-in value, not to 1M', async () => {
  const adapter = new QoderAdapter({
    // The live catalog describes the model but reports no context window.
    options: () => ({ ...connection(), models: [{ id: 'deepseek-v4-flash' }] }),
    resolveApiKey: async () => 'pt-window',
    resolveAttachments: () => undefined,
  })
  const resolved = await adapter.resolveModel('qoder-cn', 'deepseek-v4-flash')
  // 128K is what this model really accepts; claiming 1M would stop the harness
  // from compacting and turn a long session into a mid-task 400.
  assert.equal(resolved.context.contextWindow, 128_000)
})

test('an unknown model still uses the configured default window', async () => {
  const adapter = new QoderAdapter({
    options: () => ({ ...connection(), models: [{ id: 'brand-new-key' }] }),
    resolveApiKey: async () => 'pt-window',
    resolveAttachments: () => undefined,
  })
  const resolved = await adapter.resolveModel('qoder-cn', 'brand-new-key')
  assert.equal(resolved.context.contextWindow, 1_000_000)
})
