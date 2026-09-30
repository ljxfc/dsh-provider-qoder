/**
 * The quota reads and the selector annotations: the two features that are pure
 * enough to pin without a live account. The network is stubbed, but the stubbed
 * bodies are the real payloads captured from the gateway on 2026-09-29.
 */

import assert from 'node:assert/strict'
import test from 'node:test'

import {
  compareModelsForSelector,
  fetchQoderQuota,
  modelAnnotationParts,
  modelDescription,
  modelSelectorLabel,
  parseQuotaPool,
  parseQuotaSnapshot,
} from '../dist/index.js'

/** The real `GET /api/v2/user/plan` body (482 B). */
const PLAN_V2 = {
  user_type: 'teams',
  plan_tier_name: 'Teams',
  is_personal_version: false,
  is_paid_plan: true,
  is_highest_tier: false,
  organization: {
    org_id: 'dfe8f6ff-b258-594d-95bd-2e900e5d23bf',
    org_name: '上海交通大学',
    role_name: 'Member',
    is_suspended: false,
    can_manage_subscriptions: false,
    resource_package_feature_enabled: true,
  },
  start_date: 1790128216000,
  end_date: 1792771200000,
}

/** The real `GET /api/v2/quota/usage` body (481 B). */
const USAGE_V2 = {
  userId: '01a0e766-860b-7b62-a99a-7db2b811f8fd',
  userType: 'teams',
  usageType: 'credits',
  totalUsagePercentage: 0.03,
  isQuotaExceeded: false,
  expiresAt: 1792771200000,
  upgradeUrl: 'https://qoder.com.cn/pricing?client=qoder',
  userQuota: { total: 3000, used: 84, remaining: 2916, percentage: 0.03, unit: 'credits' },
  orgResourcePackage: { used: 0, remaining: 0, percentage: 0, unit: 'credits', cap: -1, available: false },
  isPlanQuotaProrated: false,
}

/** The real `GET /api/v1/me/usage` body, with an add-on balance added. */
const USAGE_V1 = {
  user_id: '01a0e766-860b-7b62-a99a-7db2b811f8fd',
  user_type: 'team_member',
  plan_tier: 'team',
  plan_tier_name: 'Team',
  is_highest_tier: false,
  expires_at: 1792771200000,
  // The v1 backend reports a PERCENT where v2 reports a fraction.
  total_usage_percentage: 3,
  upgrade_url: 'https://qoder.com/pricing?client=qoder',
  user_quota: { used: 84, remaining: 2916, total: 3000, percentage: 3, unit: 'credits' },
  shared_quota: { used: 0, remaining: 0, total: -1, percentage: 0, unit: 'credits' },
  add_on_quota: { used: 100, remaining: 400, total: 500, percentage: 20, unit: 'credits' },
}

/** Route a stubbed fetch by path, and record every requested URL. */
function stubFetch(routes) {
  const calls = []
  globalThis.fetch = async (url) => {
    calls.push(String(url))
    const route = routes.find(([match]) => String(url).includes(match))
    if (route === undefined) throw new Error(`unstubbed request: ${url}`)
    return { ok: true, status: 200, json: async () => route[1] }
  }
  return calls
}

const ENDPOINTS = { gateway: 'https://gateway.qoder.com.cn', openapi: 'https://openapi.qoder.com.cn' }

test('parseQuotaPool normalises a percent and a fraction to the same ratio', () => {
  const percent = parseQuotaPool({ total: 3000, used: 84, remaining: 2916, percentage: 3, unit: 'credits' })
  const fraction = parseQuotaPool({ total: 3000, used: 84, remaining: 2916, percentage: 0.03, unit: 'credits' })
  assert.equal(percent.percentage, 0.03)
  assert.equal(fraction.percentage, 0.03)
  // An unreported `available` reads as spendable so an older gateway still renders.
  assert.equal(percent.available, true)
})

test('parseQuotaSnapshot accepts the wire shape and rejects a mistyped field', () => {
  const snapshot = {
    planTierName: 'Teams',
    userType: 'teams',
    isPaidPlan: true,
    isHighestTier: false,
    organizationName: '上海交通大学',
    organizationRole: 'Member',
    periodStart: 1,
    periodEnd: 2,
    personal: { total: 3000, used: 84, remaining: 2916, percentage: 0.03, unit: 'credits', available: true },
    usageType: 'credits',
    totalPercentage: 0.03,
    isQuotaExceeded: false,
    expiresAt: 3,
  }
  assert.deepEqual(parseQuotaSnapshot(snapshot), snapshot)
  assert.throws(() => parseQuotaSnapshot({ ...snapshot, planTierName: 7 }), /qoder\/quota result: invalid planTierName/)
  assert.throws(() => parseQuotaSnapshot({ ...snapshot, addOnPool: { total: 'x' } }), TypeError)
  // The optional add-on pool travels when present.
  const withAddOn = { ...snapshot, addOnPool: { total: 500, used: 100, remaining: 400, percentage: 0.2, unit: 'credits', available: true } }
  assert.deepEqual(parseQuotaSnapshot(withAddOn).addOnPool, withAddOn.addOnPool)
})

test('fetchQoderQuota merges the gateway and openapi reads, add-on included', async () => {
  const calls = stubFetch([
    ['/api/v2/user/plan', PLAN_V2],
    ['/api/v2/quota/usage', USAGE_V2],
    ['/api/v1/me/usage', USAGE_V1],
  ])
  const report = await fetchQoderQuota('jt-test', ENDPOINTS)
  assert.deepEqual(calls.sort(), [
    'https://gateway.qoder.com.cn/api/v2/quota/usage',
    'https://gateway.qoder.com.cn/api/v2/user/plan',
    'https://openapi.qoder.com.cn/api/v1/me/usage',
  ])
  // The gateway's richer plan wins the shared fields...
  assert.equal(report.planTierName, 'Teams')
  assert.equal(report.userType, 'teams')
  assert.equal(report.organization?.name, '上海交通大学')
  assert.equal(report.organization?.role, 'Member')
  assert.equal(report.periodStart, 1790128216000)
  // ...its fraction is never re-divided...
  assert.equal(report.totalPercentage, 0.03)
  // ...and the personal pool plus the dormant org package survive.
  assert.equal(report.personal.used, 84)
  assert.equal(report.organizationPool?.available, false)
  // The add-on (purchased/gifted) balance only exists in the openapi read, and
  // it is normalised to a fraction even though v1 sent a percent.
  assert.equal(report.addOnPool?.total, 500)
  assert.equal(report.addOnPool?.used, 100)
  assert.equal(report.addOnPool?.percentage, 0.2)
})

test('the openapi read alone still yields a usable report', async () => {
  stubFetch([['/api/v1/me/usage', USAGE_V1]])
  const report = await fetchQoderQuota('jt-test', ENDPOINTS)
  assert.equal(report.planTierName, 'Team')
  assert.equal(report.addOnPool?.remaining, 400)
  assert.equal(report.personal.used, 84)
})

test('fetchQoderQuota throws only when every read fails', async () => {
  globalThis.fetch = async () => ({ ok: false, status: 503, json: async () => ({}) })
  await assert.rejects(fetchQoderQuota('jt-test', ENDPOINTS), /HTTP 503/)
})

test('selector annotations lead with the operator-supplied plan tier', () => {
  const model = {
    id: 'qmodel_latest',
    name: 'Qwen3.7-Max',
    contextWindow: 180000,
    inputModalities: ['text', 'image'],
    plan: 'Pro',
    free: false,
    promotion: {
      badge: { en: 'Off-Peak 80% off', zh: '错峰 2 折' },
      windowStart: '22:00',
      windowEnd: '08:00',
      timezone: 'Asia/Shanghai',
      discountFactor: 0.2,
    },
  }
  const parts = modelAnnotationParts(model, 'zh')
  assert.equal(parts[0], 'Pro')
  assert.match(parts[1], /错峰 2 折/)
  assert.match(parts[1], /22:00-08:00/)
  assert.ok(parts.includes('图像'))
  assert.equal(parts.at(-1), '180K')
  assert.equal(modelDescription(model, 'zh'), parts.join(' · '))
  // The picker renders names only, so the row label must carry the annotations.
  assert.equal(modelSelectorLabel(model, 'zh'), `Qwen3.7-Max · ${parts.join(' · ')}`)
  assert.equal(modelSelectorLabel(model, 'en'), 'Qwen3.7-Max · Pro · Off-Peak 80% off(22:00-08:00) · Image · 180K')
  // An unmapped model carries no plan label rather than a guessed one.
  assert.equal(modelAnnotationParts({ id: 'auto', contextWindow: 200000 }, 'zh').join(' · '), '200K')
  assert.equal(modelSelectorLabel({ id: 'auto', contextWindow: 200000 }, 'zh'), 'auto · 200K')
  // Nothing to annotate leaves the bare name untouched.
  assert.equal(modelSelectorLabel({ id: 'x', name: 'Plain' }, 'zh'), 'Plain')
})

test('the free models sort ahead of every paid one', () => {
  const models = [
    { id: 'zmodel', name: 'Zeta', contextWindow: 1 },
    { id: 'amodel', name: 'Alpha', contextWindow: 1, free: true },
    { id: 'bmodel', name: 'Beta', contextWindow: 1 },
  ]
  assert.deepEqual([...models].sort(compareModelsForSelector).map((model) => model.id), ['amodel', 'bmodel', 'zmodel'])
})
