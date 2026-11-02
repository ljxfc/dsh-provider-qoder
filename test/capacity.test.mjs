import assert from 'node:assert/strict'
import test from 'node:test'
import { Config, mergeModelLimits, resolveAdapterOptions, resolveCapacity, selectedGatewayContext, parseQoderModelCatalog, parseModelCapacities, MODELS_DESCRIPTOR, QoderAdapter } from '../dist/index.js'

const base = { defaultContextWindow: 1000000, maxTokens: 32768 }
const model = { id: 'test-model', contextWindow: 200000, contextWindows: [200000, 1000000], maxTokens: 32768 }
test('explicit capacity precedence, automatic compatibility, and output room', () => {
  assert.deepEqual(resolveCapacity(base, model), { contextWindow: 200000, maxTokens: 32768 })
  assert.equal(resolveCapacity({ ...base, contextWindowOverride: 500000 }, model).contextWindow, 500000)
  assert.equal(resolveCapacity({ ...base, contextWindowOverride: 1000000 }, model).contextWindow, 1000000)
  const settings = { ...base, contextWindowOverride: 500000, maxOutputTokens: 64000, modelLimits: { 'test-model': { contextWindow: 8192, maxTokens: 16000 } } }
  assert.deepEqual(resolveCapacity(settings, model), { contextWindow: 8192, maxTokens: 8191 })
  assert.equal(resolveCapacity({ ...base, maxOutputTokens: 8000 }, model, undefined, 64000).maxTokens, 32768)
  assert.equal(resolveCapacity({ ...base, maxOutputTokens: 8000 }, model, undefined, 4000).maxTokens, 4000)
  assert.equal(resolveCapacity(base, { id: 'unknown' }).contextWindow, 1000000)
})
test('config validates safe integers, preserves nested precedence, detaches model settings', () => {
  for (const value of [0, -1, 1.5, Infinity, NaN, Number.MAX_SAFE_INTEGER + 1]) {
    for (const field of ['contextWindowOverride', 'maxOutputTokens']) assert.throws(() => resolveAdapterOptions({ [field]: value }), /positive safe integer/)
    assert.throws(() => resolveAdapterOptions({ modelLimits: { m: { contextWindow: value } } }), /positive safe integer/)
  }
  assert.throws(() => resolveAdapterOptions({ contextWindowOverride: 1 }), /room/)
  const limits = { m: { contextWindow: 500000 } }
  const resolved = resolveAdapterOptions({ contextWindowOverride: 500000, maxOutputTokens: 8000, modelLimits: limits, providers: { 'qoder-cn': { contextWindowOverride: 1000000 } } })
  assert.equal(resolved.contextWindowOverride, 1000000)
  assert.equal(resolved.maxOutputTokens, 8000)
  limits.m.contextWindow = 100
  assert.equal(resolved.modelLimits.m.contextWindow, 500000)
  const schema = new Config({})
  assert.equal(schema.modelLimits.get(), undefined)
})
test('catalog retains all tier values and raw identifiers while preserving default', () => {
  const [entry] = parseQoderModelCatalog({ chat: [{ key: 'test', enable: true, max_input_tokens: 180000, context_config: { large: { token_count: 1000000 }, normal: { token_count: 200000, is_default: true } } }] })
  assert.equal(entry.contextWindow, 200000)
  assert.deepEqual(entry.contextWindows, [200000, 1000000])
  assert.deepEqual(entry.contextTiers, { large: 1000000, normal: 200000 })
  assert.equal(selectedGatewayContext({ contextWindowOverride: 1000000 }, entry), 1000000)
  assert.equal(selectedGatewayContext({ contextWindowOverride: 500000 }, entry), undefined)
  assert.equal(selectedGatewayContext({ contextWindowOverride: 1000000 }, { id: 'unknown' }), undefined)
})
test('models remote strict codec rejects malformed fields', () => {
  const result = [{ ...model, name: 'Test', effectiveContextWindow: 500000, effectiveMaxTokens: 32768 }]
  assert.deepEqual(parseModelCapacities(result), result)
  assert.deepEqual(MODELS_DESCRIPTOR.result.create().parse(result), result)
  for (const field of ['effectiveMaxTokens', 'contextWindow', 'effectiveContextWindow']) assert.throws(() => parseModelCapacities([{ ...result[0], [field]: 1.2 }]), /qoder\/models/)
})
function decode(body) {
  const alphabet = '_doRTgHZBKcGVjlvpC,@aFSx#DPuNJme&i*MzLOEn)sUrthbf%Y^w.(kIQyXqWA!'
  const standard = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  const shuffled = [...String(body)].map(char => char === '$' ? '=' : standard[alphabet.indexOf(char)]).join('')
  const a = Math.floor(shuffled.length / 3)
  return JSON.parse(Buffer.from(shuffled.slice(-a) + shuffled.slice(a, -a) + shuffled.slice(0, a), 'base64').toString())
}
test('resolve and encoded generation agree; only supported windows reach gateway', async t => {
  const original = globalThis.fetch
  t.after(() => { globalThis.fetch = original })
  let sent
  globalThis.fetch = async (url, init) => {
    if (String(url).includes('jobToken/exchange')) return Response.json({ token: 'jt', refresh_token: 'jrt', expires_in: 86400000 })
    if (String(url).includes('userinfo')) return Response.json({ id: 'capacity-test-user' })
    sent = decode(init.body)
    return new Response('data: [DONE]\n\n', { headers: { 'content-type': 'text/event-stream' } })
  }
  let settings = { ...base, models: [model], maxOutputTokens: 16000, contextWindowOverride: 1000000, endpoints: { gateway: 'https://gateway.example', openapi: 'https://openapi.example', manage: 'https://manage.example' }, apiKeyEnv: 'TEST', streamIdleTimeoutMs: 300000, retryPolicy: {}, machineId: 'test' }
  const adapter = new QoderAdapter({ options: () => settings, resolveApiKey: async () => 'capacity-test-pat', resolveAttachments: () => undefined })
  const run = async maxTokens => { try { for await (const chunk of adapter.stream({ model: model.id, messages: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }], ...(maxTokens === undefined ? {} : { maxTokens }) })) {} } catch (error) { if (error.code !== 'EMPTY_RESPONSE') throw error } }
  await run()
  assert.equal(sent.parameters.context_length, 1000000)
  assert.equal(sent.parameters.max_tokens, (await adapter.resolveModel('qoder-cn', model.id)).defaultMaxTokens)
  assert.equal(sent.model_config.max_output_tokens, 16000)
  await run(100000)
  assert.equal(sent.parameters.max_tokens, 32768)
  assert.equal(sent.model_config.max_output_tokens, 32768)
  settings = { ...settings, contextWindowOverride: 500000 }
  await run()
  assert.equal(sent.parameters.context_length, undefined)
  assert.equal((await adapter.getModelCapacities())[0].effectiveContextWindow, 500000)
  settings = { ...settings, contextWindowOverride: undefined, maxOutputTokens: undefined, maxTokens: 8192 }
  await run()
  assert.equal(sent.parameters.max_tokens, 8192)
  assert.equal(sent.model_config.max_output_tokens, 8192)
  // Existing automatic resolveModel catalog precedence remains compatible.
  assert.equal((await adapter.resolveModel('qoder-cn', model.id)).defaultMaxTokens, 32768)
})

test('legacy automatic generation has no cold-cache catalog dependency', async t => {
  const original = globalThis.fetch
  t.after(() => { globalThis.fetch = original })
  const calls = []
  let sent
  globalThis.fetch = async (url, init) => {
    calls.push(String(url))
    if (String(url).includes('model/list')) throw new Error('catalog outage')
    if (String(url).includes('jobToken/exchange')) return Response.json({ token: 'jt', refresh_token: 'jrt', expires_in: 86400000 })
    if (String(url).includes('userinfo')) return Response.json({ id: 'legacy-outage-user' })
    sent = decode(init.body)
    return new Response('data: [DONE]\n\n', { headers: { 'content-type': 'text/event-stream' } })
  }
  const adapter = new QoderAdapter({
    options: () => ({ ...base, maxTokens: 8192, endpoints: { gateway: 'https://catalog-outage.example', openapi: 'https://openapi.example', manage: 'https://manage.example' }, apiKeyEnv: 'TEST', streamIdleTimeoutMs: 300000, retryPolicy: {}, machineId: 'test' }),
    resolveApiKey: async () => 'legacy-outage-pat', resolveAttachments: () => undefined,
  })
  try { for await (const chunk of adapter.stream({ model: 'glm-5.3', messages: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }] })) {} } catch (error) { if (error.code !== 'EMPTY_RESPONSE') throw error }
  assert.ok(sent)
  assert.equal(sent.parameters.max_tokens, 8192)
  assert.equal(calls.some(url => url.includes('model/list')), false)
})

test('models remote never fabricates selectable tiers from a default capacity', async () => {
  const entry = { id: 'test-model', contextWindow: 200000, maxTokens: 32768 }
  const adapter = new QoderAdapter({
    options: () => ({ ...base, contextWindowOverride: 200000, models: [entry] }),
    resolveApiKey: async () => { throw new Error('static catalog needs no credentials') },
    resolveAttachments: () => undefined,
  })
  assert.deepEqual((await adapter.getModelCapacities())[0].contextWindows, [])
  assert.equal(selectedGatewayContext({ contextWindowOverride: 200000 }, entry), undefined)
  const [discovered] = parseQoderModelCatalog({ chat: [{ key: 'test-model', enable: true, max_input_tokens: 200000 }] })
  assert.equal(selectedGatewayContext({ contextWindowOverride: 200000 }, discovered), undefined)
})

test('provider model overrides inherit root fields and other models, including after reset', () => {
  const root = { a: { contextWindow: 500000, maxTokens: 8000 }, b: { maxTokens: 16000 } }
  const profile = { a: { maxTokens: 4000 } }
  const config = { modelLimits: root, providers: { 'qoder-cn': { modelLimits: profile } } }
  const effective = resolveAdapterOptions(config).modelLimits
  assert.equal(effective.a.contextWindow, 500000)
  assert.equal(effective.a.maxTokens, 4000)
  assert.equal(effective.b.maxTokens, 16000)
  assert.deepEqual(mergeModelLimits(root, { a: {} }), root)
  assert.deepEqual(mergeModelLimits(root, { a: { contextWindow: undefined, maxTokens: undefined } }), root)
  assert.deepEqual(resolveAdapterOptions({ ...config, providers: { 'qoder-cn': { modelLimits: { a: {} } } } }).modelLimits.a, root.a)
  assert.equal(mergeModelLimits(), undefined)
  assert.equal(resolveAdapterOptions({ providers: { 'qoder-cn': {} } }).modelLimits, undefined)
  assert.throws(() => mergeModelLimits(root, { a: { maxTokens: 0 } }), /positive safe integer/)
  const merged = mergeModelLimits(root, profile)
  profile.a.maxTokens = 1
  root.a.contextWindow = 100
  assert.equal(merged.a.maxTokens, 4000)
  assert.equal(merged.a.contextWindow, 500000)
})

test('picker and resolved names display selected supported windows and mark local budgets', async () => {
  let settings = { ...base, models: [{ ...model, name: 'Tiered Model' }] }
  const adapter = new QoderAdapter({ options: () => settings, resolveApiKey: async () => 'unused', resolveAttachments: () => undefined })
  const names = async () => [(await adapter.listModels('qoder-cn'))[0].name, (await adapter.resolveModel('qoder-cn', model.id)).name]
  for (const name of await names()) assert.match(name, /200K/)
  settings = { ...settings, contextWindowOverride: 1000000 }
  for (const name of await names()) { assert.match(name, /1M/); assert.doesNotMatch(name, /200K|本地预算/) }
  settings = { ...settings, contextWindowOverride: 500000 }
  for (const name of await names()) { assert.match(name, /200K/); assert.match(name, /本地预算 500K/) }
  settings = { ...settings, annotationLanguage: 'en' }
  for (const name of await names()) assert.match(name, /Local budget 500K/)
  settings = { ...settings, modelLimits: { [model.id]: { contextWindow: 1000000 } } }
  for (const name of await names()) { assert.match(name, /1M/); assert.doesNotMatch(name, /Local budget/) }
  const [capability] = await adapter.getModelCapacities()
  assert.equal(capability.contextWindow, 200000)
})
