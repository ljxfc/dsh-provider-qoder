import test from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
const built = await build({
  entryPoints: ['src/client/settings.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  write: false,
})
const { createSettingsFaces, modelOverrideInfo } = await import(
  `data:text/javascript;base64,${Buffer.from(built.outputFiles[0].text).toString('base64')}`
)
const settle = () => new Promise((resolve) => setImmediate(resolve))
function host(value = {}, writable = true) {
  const calls = []
  let revision = 1
  return {
    calls,
    value,
    async describe() {
      return {
        ok: true,
        value: { writable, namespaces: [{ ns: 'llm-qoder', value, revision }] },
      }
    },
    async mutate(ns, ops, expected) {
      calls.push({ ns, ops, expected })
      for (const op of ops) {
        let target = value
        for (const key of op.path.slice(0, -1)) target = target[key] ??= {}
        if (op.op === 'unset') delete target[op.path.at(-1)]
        else target[op.path.at(-1)] = op.value
      }
      revision++
      return { ok: true, value: { ns, value, revision } }
    },
  }
}
test('capacity writes target nested effective profile and preserve catalog and unrelated fields', async () => {
  const remote = host({
    unknown: 'preserve',
    providers: {
      'qoder-cn': { endpoint: 'keep', models: [{ id: 'dynamic' }] },
    },
  })
  const { capacity } = createSettingsFaces(() => remote)
  assert.equal(
    await capacity.set('contextWindowOverride', 500000),
    false,
    'loading fails closed',
  )
  await settle()
  assert.equal(await capacity.set('contextWindowOverride', 500000), true)
  assert.equal(capacity.getSnapshot().values.contextWindowOverride, 500000)
  assert.deepEqual(remote.calls[0].ops, [
    {
      op: 'set',
      path: ['providers', 'qoder-cn', 'contextWindowOverride'],
      value: 500000,
    },
  ])
  assert.equal(
    await capacity.set('contextWindowOverride', 1000000, 'model.with/slash'),
    true,
  )
  assert.deepEqual(
    remote.value.providers['qoder-cn'].modelLimits['model.with/slash'],
    { contextWindow: 1000000 },
  )
  await capacity.reset('model.with/slash')
  assert.equal(
    remote.value.providers['qoder-cn'].modelLimits['model.with/slash']
      .contextWindow,
    undefined,
  )
  assert.equal(remote.value.providers['qoder-cn'].endpoint, 'keep')
  assert.deepEqual(remote.value.providers['qoder-cn'].models, [
    { id: 'dynamic' },
  ])
  assert.equal(remote.value.unknown, 'preserve')
})
test('auto removes only explicit capacity fields and leaves legacy fallback intact', async () => {
  const remote = host({
    contextWindowOverride: 1000000,
    maxOutputTokens: 16384,
    defaultContextWindow: 200000,
    maxTokens: 32768,
  })
  const { capacity } = createSettingsFaces(() => remote)
  await settle()
  assert.equal(await capacity.reset(), true)
  assert.deepEqual(remote.value, {
    defaultContextWindow: 200000,
    maxTokens: 32768,
  })
})
test('invalid integer and output budget are rejected before remote writes', async () => {
  const remote = host({ contextWindowOverride: 128000 })
  const { capacity } = createSettingsFaces(() => remote)
  await settle()
  for (const value of [0, -1, 1.5, Infinity, NaN, Number.MAX_SAFE_INTEGER + 1])
    assert.equal(await capacity.set('maxOutputTokens', value), false)
  assert.equal(await capacity.set('maxOutputTokens', 128000), false)
  assert.equal(remote.calls.length, 0)
  assert.equal(await capacity.set('maxOutputTokens', 8192), true)
})
test('failed settings reads and read-only profiles disable both capacity and sidebar writes', async () => {
  for (const remote of [
    {
      async describe() {
        return { ok: false, error: { message: 'offline' } }
      },
      async mutate() {
        throw Error('must not write')
      },
    },
    host({}, false),
  ]) {
    const { capacity, quota } = createSettingsFaces(() => remote)
    await settle()
    assert.equal(capacity.getSnapshot().writable, false)
    assert.equal(await capacity.set('contextWindowOverride', 500000), false)
    assert.equal(await quota.set(true), false)
  }
})
test('conflict rereads revision and provider layer before retrying once', async () => {
  const remote = host({})
  let reads = 0
  const describe = remote.describe
  remote.describe = async () => {
    reads++
    if (reads === 2) remote.value.providers = { 'qoder-cn': { keep: true } }
    const result = await describe()
    result.value.namespaces[0].revision = reads
    return result
  }
  const mutate = remote.mutate
  remote.mutate = async (...args) => {
    if (!remote.calls.length) {
      remote.calls.push({ expected: args[2] })
      return { ok: false, error: { message: 'revision conflict' } }
    }
    return mutate(...args)
  }
  const { capacity } = createSettingsFaces(() => remote)
  await settle()
  assert.equal(await capacity.set('contextWindowOverride', 500000), true)
  assert.equal(remote.calls[1].expected, 2)
  assert.deepEqual(remote.calls[1].ops[0].path, [
    'providers',
    'qoder-cn',
    'contextWindowOverride',
  ])
})
test('failed conflict reread prevents retry and ordinary permission rejection is not retried', async () => {
  for (const conflict of [true, false]) {
    let reads = 0
    let writes = 0
    const remote = {
      async describe() {
        reads++
        return reads > 1
          ? { ok: false }
          : {
              ok: true,
              value: {
                namespaces: [{ ns: 'llm-qoder', value: {}, revision: 1 }],
              },
            }
      },
      async mutate() {
        writes++
        return {
          ok: false,
          error: {
            message: conflict ? 'revision conflict' : 'permission denied',
          },
        }
      },
    }
    const { capacity } = createSettingsFaces(() => remote)
    await settle()
    assert.equal(await capacity.set('contextWindowOverride', 1000000), false)
    assert.equal(writes, 1)
  }
})
test('a newer refresh wins and duplicate saves cannot overlap', async () => {
  let finishFirst
  const remote = host({})
  const describe = remote.describe
  remote.describe = () =>
    new Promise((resolve) => {
      finishFirst = resolve
    })
  const { capacity } = createSettingsFaces(() => remote)
  remote.describe = describe
  await capacity.refresh()
  finishFirst({ ok: false, error: { message: 'old failure' } })
  await settle()
  assert.equal(capacity.getSnapshot().failed, false)
  let finishWrite
  remote.mutate = () =>
    new Promise((resolve) => {
      finishWrite = resolve
    })
  const first = capacity.set('contextWindowOverride', 500000)
  assert.equal(await capacity.set('maxOutputTokens', 8192), false)
  finishWrite({ ok: true, value: {} })
  await first
})

test('successful mutate with unchanged Host readback is not reported as saved', async () => {
  const remote = host({})
  remote.mutate = async () => ({ ok: true, value: {} })
  const { capacity } = createSettingsFaces(() => remote)
  await settle()
  assert.equal(await capacity.set('contextWindowOverride', 500000), false)
  assert.equal(capacity.getSnapshot().saved, false)
  assert.match(capacity.getSnapshot().error, /readback/)
})

test('profile automatic inherits root without deleting the root override', async () => {
  const remote = host({
    contextWindowOverride: 1000000,
    providers: { 'qoder-cn': { contextWindowOverride: 500000 } },
  })
  const { capacity } = createSettingsFaces(() => remote)
  await settle()
  assert.equal(await capacity.set('contextWindowOverride'), true)
  assert.equal(capacity.getSnapshot().values.contextWindowOverride, 1000000)
  assert.equal(
    capacity.getSnapshot().ownValues.contextWindowOverride,
    undefined,
  )
  assert.equal(remote.value.contextWindowOverride, 1000000)
})

test('context must leave at least one token of input space', async () => {
  const remote = host({})
  const { capacity } = createSettingsFaces(() => remote)
  await settle()
  assert.equal(await capacity.set('contextWindowOverride', 1), false)
  assert.equal(remote.calls.length, 0)
})

test('effective profile model limits merge fields and reset resumes root entries', async () => {
  const remote = host({
    modelLimits: {
      a: { contextWindow: 500000, maxTokens: 8192 },
      b: { maxTokens: 16384 },
    },
    providers: { 'qoder-cn': { modelLimits: { a: { maxTokens: 4096 } } } },
  })
  const { capacity } = createSettingsFaces(() => remote)
  await settle()
  assert.deepEqual(
    { ...capacity.getSnapshot().values.modelLimits.a },
    { contextWindow: 500000, maxTokens: 4096 },
  )
  assert.equal(capacity.getSnapshot().values.modelLimits.b.maxTokens, 16384)
  assert.equal(await capacity.reset('a'), true)
  assert.deepEqual(
    { ...capacity.getSnapshot().values.modelLimits.a },
    { contextWindow: 500000, maxTokens: 8192 },
  )
  assert.equal(capacity.getSnapshot().values.modelLimits.b.maxTokens, 16384)
  assert.equal(
    capacity.getSnapshot().ownValues.modelLimits.a.contextWindow,
    undefined,
  )
})

test('inherited model context drives unsupported warning and field-specific sources', async () => {
  const remote = host({
    modelLimits: { a: { contextWindow: 500000, maxTokens: 8192 } },
    providers: { 'qoder-cn': {} },
  })
  const { capacity } = createSettingsFaces(() => remote)
  await settle()
  const info = modelOverrideInfo(capacity.getSnapshot(), 'a', [200000, 1000000])
  assert.equal(info.chosenContext, 500000)
  assert.equal(info.unsupported, true)
  assert.equal(info.contextSource, 'inheritedModelSource')
  assert.equal(info.outputSource, 'inheritedModelSource')
  assert.equal(capacity.getSnapshot().ownValues.modelLimits, undefined)
  assert.equal(await capacity.set('maxOutputTokens', 4096, 'a'), true)
  const edited = modelOverrideInfo(
    capacity.getSnapshot(),
    'a',
    [200000, 1000000],
  )
  assert.equal(edited.contextSource, 'inheritedModelSource')
  assert.equal(edited.outputSource, 'modelSource')
  assert.equal(edited.unsupported, true)
})
