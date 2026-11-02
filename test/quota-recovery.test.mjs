import assert from 'node:assert/strict'
import test from 'node:test'
import { createQuotaController } from '../dist/index.js'

test('a failed refresh keeps the successful report and its timestamp, then recovers', async () => {
  const report = { planTierName: 'fixture' }
  let response = { ok: true, value: report }
  const controller = createQuotaController(() => ({ quota: async () => response }))
  await controller.refresh()
  const successful = controller.getSnapshot()
  response = { ok: false, error: { message: 'network unavailable' } }
  await controller.refresh()
  assert.equal(controller.getSnapshot().status, 'error')
  assert.equal(controller.getSnapshot().report, report)
  assert.equal(controller.getSnapshot().fetchedAt, successful.fetchedAt)
  assert.equal(controller.getSnapshot().error, 'network unavailable')
  response = { ok: true, value: { planTierName: 'refreshed' } }
  await controller.refresh()
  assert.equal(controller.getSnapshot().status, 'ready')
  assert.equal(controller.getSnapshot().report.planTierName, 'refreshed')
  assert.equal(controller.getSnapshot().error, undefined)
})

test('an exception or unmounted remote preserves cached data; first failure stays empty', async () => {
  let namespace = { quota: async () => { throw new Error('offline') } }
  const controller = createQuotaController(() => namespace)
  await controller.refresh()
  assert.equal(controller.getSnapshot().report, undefined)
  assert.equal(controller.getSnapshot().fetchedAt, undefined)
  namespace = { quota: async () => ({ ok: true, value: { planTierName: 'cached' } }) }
  await controller.refresh()
  namespace = { quota: async () => { throw new Error('offline') } }
  await controller.refresh()
  assert.equal(controller.getSnapshot().report.planTierName, 'cached')
  namespace = undefined
  await controller.refresh()
  assert.equal(controller.getSnapshot().report.planTierName, 'cached')
  assert.equal(controller.getSnapshot().status, 'error')
})

test('concurrent refresh callers share one request and settle on the same result', async () => {
  let resolve
  let calls = 0
  const controller = createQuotaController(() => ({ quota: () => {
    calls++
    return new Promise(done => { resolve = done })
  } }))
  const first = controller.refresh()
  const second = controller.refresh()
  assert.equal(calls, 1)
  assert.equal(first, second)
  resolve({ ok: true, value: { planTierName: 'latest' } })
  await Promise.all([first, second])
  assert.equal(controller.getSnapshot().report.planTierName, 'latest')
})
