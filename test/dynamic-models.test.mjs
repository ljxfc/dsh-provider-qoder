import assert from 'node:assert/strict'
import test from 'node:test'
import { Config, getQoderCNDirectModel, getQoderCNFriendlyModelInfo, parseQoderModelCatalog, QoderAdapter } from '../dist/index.js'

const endpoints = {
  gateway: 'https://tenant-gateway.vpc.qoder.com.cn',
  openapi: 'https://tenant-openapi.vpc.qoder.com.cn',
  manage: 'https://tenant.vpc.qoder.com.cn',
}

function connection(models) {
  return {
    endpoints,
    apiKeyEnv: 'QODERCN_PERSONAL_ACCESS_TOKEN',
    maxTokens: 32_768,
    defaultContextWindow: 1_000_000,
    ...(models === undefined ? {} : { models }),
    streamIdleTimeoutMs: 300_000,
    retryPolicy: {},
    machineId: 'test-machine',
  }
}

function gmodel() {
  return {
    key: 'gmodel',
    enable: true,
    display_name: 'GLM-5.3',
    is_vl: true,
    is_reasoning: true,
    max_input_tokens: 180_000,
    max_output_tokens: 32_768,
    context_config: {
      '1M': { token_count: 1_000_000 },
      '200K': { token_count: 200_000, is_default: true },
    },
    thinking_config: {
      enabled: { efforts: { high: {}, low: {}, max: { is_default: true } } },
    },
  }
}

function valueOf(value) {
  return value && typeof value === 'object' && typeof value.get === 'function'
    ? value.get()
    : value
}

test('keeps an omitted catalog absent inside the v0.1.7 volatile settings contract', () => {
  const resolved = new Config({
    providers: {
      'qoder-cn': {
        apiKeyEnv: 'QODER_CN_API_KEY',
        vpcInstance: 'tenant',
      },
    },
  })
  assert.equal(valueOf(resolved.models), undefined)
  assert.equal(valueOf(resolved.providers)['qoder-cn'].models, undefined)
})

test('parses enabled live models and rejects unusable listings', () => {
  assert.deepEqual(parseQoderModelCatalog({
    chat: [
      gmodel(),
      { key: 'gm51model', enable: true, display_name: 'GLM-5.2', max_input_tokens: 180_000 },
      { key: '', enable: true },
      { key: 'disabled', enable: false },
    ],
  }), [
    {
      id: 'glm-5.3',
      name: 'GLM 5.3',
      contextWindow: 200_000,
      maxTokens: 32_768,
      inputModalities: ['text', 'image'],
      reasoning: true,
    },
    {
      id: 'glm-5.2',
      name: 'GLM 5.2',
      contextWindow: 180_000,
      inputModalities: ['text'],
      reasoning: false,
    },
  ])
  assert.throws(
    () => parseQoderModelCatalog({ models: [] }),
    error => error?.code === 'DISCOVERY_FAILED',
  )
  assert.throws(
    () => parseQoderModelCatalog({ chat: [{ key: 'disabled', enable: false }] }),
    error => error?.code === 'DISCOVERY_FAILED',
  )
})

test('refreshes the signed live catalog and reuses it for exact-model resolution', async (t) => {
  const originalFetch = globalThis.fetch
  t.after(() => { globalThis.fetch = originalFetch })
  let catalogCalls = 0
  let liveChat = [gmodel()]
  globalThis.fetch = async (input, init = {}) => {
    const url = String(input)
    if (url.endsWith('/api/v1/jobToken/exchange')) {
      return Response.json({ token: 'jt-test', refresh_token: 'jrt-test', expires_in: 86_400_000 })
    }
    if (url.endsWith('/api/v1/userinfo')) {
      return Response.json({ id: 'user-test', email: 'user@example.com', name: 'Test User' })
    }
    if (url.endsWith('/algo/api/v2/model/list?Encode=1')) {
      catalogCalls += 1
      const authorization = new Headers(init.headers).get('authorization')
      assert.match(authorization ?? '', /^Bearer COSY\./)
      assert.equal(new Headers(init.headers).get('cosy-version'), '1.1.38')
      // A proxy dispatcher in front of the gateway can deliver a compressed
      // body without its content-encoding header, so discovery must ask for
      // an uncompressed response.
      assert.equal(new Headers(init.headers).get('accept-encoding'), 'identity')
      assert.equal(init.method, 'GET')
      return Response.json({ chat: liveChat })
    }
    throw new Error(`Unexpected URL: ${url}`)
  }

  const adapter = new QoderAdapter({
    options: () => connection(),
    resolveApiKey: async () => 'pt-dynamic-model-test',
    resolveAttachments: () => undefined,
  })
  const first = await adapter.listModels('qoder-cn')
  assert.deepEqual(first, [{
    provider: 'qoder-cn',
    id: 'glm-5.3',
    name: 'GLM 5.3 · 图像 · 200K',
    description: '图像 · 200K',
    inputModalities: ['text', 'image'],
  }])
  const resolved = await adapter.resolveModel('qoder-cn', 'glm-5.3')
  assert.equal(resolved.context.contextWindow, 200_000)
  assert.equal(resolved.defaultMaxTokens, 32_768)
  assert.deepEqual(resolved.reasoning?.efforts.map(effort => effort.id), ['off', 'high', 'max'])
  assert.equal(catalogCalls, 1)

  liveChat = [...liveChat, {
    key: 'new-wire-model',
    enable: true,
    display_name: 'NewModel-Preview',
    max_input_tokens: 256_000,
  }]
  const refreshed = await adapter.listModels('qoder-cn')
  assert.deepEqual(refreshed.map(model => model.id), ['glm-5.3', 'new-wire-model'])
  assert.equal(catalogCalls, 2)
})

test('every published model id maps back to the wire key that serves it', () => {
  // The selector id and the wire key are two halves of one fact, and they used
  // to be maintained by hand in two tables — which is how `qfmodel` (the live
  // Qwen3.8-Flash key) came to be labelled "Qwen 3.6 Flash" and to send a
  // retired key. Every live wire key must round-trip.
  const liveKeys = [
    'auto', 'qmodel_38max', 'qfmodel', 'qmodel_latest', 'qmodel', 'q37fmodel',
    'dmodel', 'dfmodel', 'gmodel', 'gfmodel', 'gm51model', 'kmodel_latest',
    'kmodel', 'mmodel',
  ]
  const seenIds = new Set()
  for (const key of liveKeys) {
    const identity = getQoderCNFriendlyModelInfo(key)
    // `auto` is the one key whose published id is itself; every other key must
    // resolve to a readable id rather than leaking its internal wire key.
    if (key !== 'auto') assert.notEqual(identity.id, key, `${key} must resolve to a published id`)
    assert.equal(getQoderCNDirectModel(identity.id), key, `${identity.id} must send ${key}`)
    assert.equal(seenIds.has(identity.id), false, `${key} collides on id ${identity.id}`)
    seenIds.add(identity.id)
  }
  // Qwen3.8-Flash is the model the picker could not offer: the live key is
  // `qfmodel`, and it must not be confused with the retired `q36fmodel`.
  assert.deepEqual(getQoderCNFriendlyModelInfo('qfmodel'), { id: 'qwen3.8-flash', name: 'Qwen 3.8 Flash' })
  assert.equal(getQoderCNDirectModel('qwen3.8-flash'), 'qfmodel')
  assert.deepEqual(getQoderCNFriendlyModelInfo('q36fmodel'), { id: 'qwen3.6-flash', name: 'Qwen 3.6 Flash' })
  // Ids saved by earlier builds keep sending the key they always sent, so a
  // resumed session does not silently switch models.
  assert.equal(getQoderCNDirectModel('qwen3.6-flash'), 'q36fmodel')
  assert.equal(getQoderCNDirectModel('kimi-k2.6'), 'kmodel')
  assert.equal(getQoderCNDirectModel('glm-5.1'), 'gm51model')
  assert.equal(getQoderCNDirectModel('minimax-m3'), 'mmodel')
  assert.equal(getQoderCNDirectModel('qwen3.6-plus'), 'qmodel')
  assert.equal(getQoderCNDirectModel('qoder-cn'), 'auto')
  // A model released after this build stays addressable without an update.
  assert.equal(getQoderCNDirectModel('brand-new-wire-key'), 'brand-new-wire-key')
  assert.equal(getQoderCNDirectModel(undefined), 'auto')
})

test('uses an explicit static catalog without contacting Qoder discovery', async (t) => {
  const originalFetch = globalThis.fetch
  t.after(() => { globalThis.fetch = originalFetch })
  globalThis.fetch = async () => { throw new Error('unexpected discovery request') }
  const adapter = new QoderAdapter({
    options: () => connection([{ id: 'pinned', name: 'Pinned' }]),
    resolveApiKey: async () => 'pt-static-model-test',
    resolveAttachments: () => undefined,
  })
  assert.deepEqual(await adapter.listModels('qoder-cn'), [{
    provider: 'qoder-cn',
    id: 'pinned',
    name: 'Pinned',
  }])
})

test('cancels first-use dynamic resolution with the caller signal', async (t) => {
  const originalFetch = globalThis.fetch
  t.after(() => { globalThis.fetch = originalFetch })
  globalThis.fetch = async (_input, init = {}) => await new Promise((_resolve, reject) => {
    const signal = init.signal
    if (signal?.aborted) {
      reject(signal.reason)
      return
    }
    signal?.addEventListener('abort', () => { reject(signal.reason) }, { once: true })
  })
  const adapter = new QoderAdapter({
    options: () => connection(),
    resolveApiKey: async () => 'pt-aborted-model-test',
    resolveAttachments: () => undefined,
  })
  const controller = new AbortController()
  const resolution = adapter.resolveModel('qoder-cn', 'gmodel', controller.signal)
  controller.abort('test cancellation')
  await assert.rejects(resolution, error => error?.code === 'ABORTED')
})
