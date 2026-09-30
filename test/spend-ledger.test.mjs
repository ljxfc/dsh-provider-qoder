/**
 * The rolling spend ledger and the accounting it is built from.
 *
 * Qoder CN publishes no rolling window, so these totals are the one number on
 * the quota surfaces that the plugin derives itself — which makes them the one
 * number worth pinning without a live account. The clock and the data root are
 * both injected here: the ledger reads `DSH_HOME` per call, so a test can point
 * it at a scratch directory instead of the user's real store.
 */

import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import {
  parseQuotaSnapshot,
  readQoderSpend,
  readSpendRecords,
  readUsageAccounting,
  recordQoderSpend,
  spendLedgerPath,
  summariseSpend,
  QODER_SPEND_WINDOWS_MS,
  SPEND_RETENTION_MS,
} from '../dist/index.js'

const HOUR = 60 * 60 * 1000
const [FIVE_HOURS, ONE_DAY, ONE_WEEK] = QODER_SPEND_WINDOWS_MS

test('the published windows are the five-hour, day-long and weekly spans', () => {
  assert.deepEqual([...QODER_SPEND_WINDOWS_MS], [5 * HOUR, 24 * HOUR, 7 * 24 * HOUR])
  // Retention has to outlast the longest window, or a weekly total would be
  // computed from a ledger that had already forgotten part of its own window.
  assert.ok(SPEND_RETENTION_MS > ONE_WEEK)
})

test('summariseSpend counts each record in every window it falls inside', () => {
  const now = Date.UTC(2026, 0, 8, 12)
  const summary = summariseSpend([
    { at: now - 1 * HOUR, credits: 1.5 },
    { at: now - 4 * HOUR, credits: 2 },
    // Older than five hours but well inside the day.
    { at: now - 20 * HOUR, credits: 4 },
    // Older than a day, inside the week.
    { at: now - 3 * 24 * HOUR, credits: 8 },
  ], now)

  assert.deepEqual(summary.windows.map((window) => window.spanMs), [FIVE_HOURS, ONE_DAY, ONE_WEEK])
  assert.deepEqual(summary.windows.map((window) => window.requests), [2, 3, 4])
  assert.deepEqual(summary.windows.map((window) => window.credits), [3.5, 7.5, 15.5])
  assert.equal(summary.updatedAt, now - 1 * HOUR)
})

test('a window releases when its oldest counted request ages out', () => {
  const now = Date.UTC(2026, 0, 8, 12)
  const summary = summariseSpend([
    { at: now - 4 * HOUR, credits: 1 },
    { at: now - 1 * HOUR, credits: 1 },
  ], now)
  // The five-hour window empties at oldest + span, not at the newest request.
  assert.equal(summary.windows[0].resetsAt, now - 4 * HOUR + FIVE_HOURS)
  assert.equal(summary.windows[1].resetsAt, now - 4 * HOUR + ONE_DAY)
  // An empty window announces no release, because it has nothing to release.
  const empty = summariseSpend([], now)
  assert.deepEqual(empty.windows.map((window) => window.requests), [0, 0, 0])
  assert.equal(empty.windows[0].resetsAt, undefined)
  assert.equal(empty.updatedAt, undefined)
})

test('a window boundary is exclusive, so a request exactly one span old is out', () => {
  const now = Date.UTC(2026, 0, 8, 12)
  const summary = summariseSpend([{ at: now - FIVE_HOURS, credits: 5 }], now)
  assert.equal(summary.windows[0].requests, 0)
  assert.equal(summary.windows[0].credits, 0)
  assert.equal(summary.windows[1].requests, 1)
})

test('records older than retention are dropped even from the longest window', () => {
  const now = Date.UTC(2026, 0, 8, 12)
  const summary = summariseSpend([
    { at: now - SPEND_RETENTION_MS - 1, credits: 100 },
    { at: now - 2 * 24 * HOUR, credits: 3 },
  ], now)
  assert.equal(summary.windows[2].credits, 3)
  assert.equal(summary.updatedAt, now - 2 * 24 * HOUR)
})

test('readUsageAccounting reports only the fields the frame actually carried', () => {
  assert.deepEqual(
    readUsageAccounting({ credits: 0.002768612, original_credits: 0.004, billable: true }),
    { credits: 0.002768612, originalCredits: 0.004, billable: true },
  )
  // Token-only frames are the common case on a free model, and they must not
  // produce an empty accounting object that reads as "billed nothing".
  assert.equal(readUsageAccounting({ prompt_tokens: 10, completion_tokens: 2 }), undefined)
  // `billable: false` is a real answer and has to survive.
  assert.deepEqual(readUsageAccounting({ billable: false, credits: 0 }), { credits: 0, billable: false })
  assert.equal(readUsageAccounting({ credits: Number.NaN }), undefined)
})

test('recordQoderSpend and readSpendRecords round-trip through the ledger file', async () => {
  const root = await mkdtemp(join(tmpdir(), 'qoder-spend-'))
  const previous = process.env.DSH_HOME
  process.env.DSH_HOME = root
  try {
    assert.equal(spendLedgerPath(), join(root, 'qoder-spend.jsonl'))
    const now = Date.now()
    await recordQoderSpend({ at: now - 2 * HOUR, credits: 0.5, model: 'qwen3.8-flash' })
    await recordQoderSpend({ at: now - 1 * HOUR, credits: 0.25, originalCredits: 0.5 })
    // A zero-credit request is not a billed request; it must not appear as one.
    await recordQoderSpend({ at: now, credits: 0 })

    const records = await readSpendRecords(now)
    assert.equal(records.length, 2)
    const summary = await readQoderSpend(now)
    assert.equal(summary.windows[0].credits, 0.75)
    assert.equal(summary.windows[0].requests, 2)
  } finally {
    if (previous === undefined) delete process.env.DSH_HOME
    else process.env.DSH_HOME = previous
    await rm(root, { recursive: true, force: true })
  }
})

test('a ledger of unreadable lines reads as empty and compacts itself', async () => {
  const root = await mkdtemp(join(tmpdir(), 'qoder-spend-'))
  const previous = process.env.DSH_HOME
  process.env.DSH_HOME = root
  try {
    const now = Date.now()
    const path = spendLedgerPath()
    await writeFile(path, [
      'not json at all',
      '{"at":"soon","credits":1}',
      '{"credits":1}',
      // Stale by a day more than retention, so it is dropped on read.
      JSON.stringify({ at: now - SPEND_RETENTION_MS - HOUR, credits: 9 }),
      JSON.stringify({ at: now - HOUR, credits: 1 }),
      '',
    ].join('\n'), 'utf8')

    const records = await readSpendRecords(now)
    assert.deepEqual(records, [{ at: now - HOUR, credits: 1 }])
    // The rewrite keeps only what survived, so an append-only file stays bounded.
    const rewritten = (await readFile(path, 'utf8')).trim().split('\n')
    assert.equal(rewritten.length, 1)
    assert.deepEqual(JSON.parse(rewritten[0]), { at: now - HOUR, credits: 1 })
  } finally {
    if (previous === undefined) delete process.env.DSH_HOME
    else process.env.DSH_HOME = previous
    await rm(root, { recursive: true, force: true })
  }
})

test('a missing ledger is a zeroed summary rather than an error', async () => {
  const root = await mkdtemp(join(tmpdir(), 'qoder-spend-'))
  const previous = process.env.DSH_HOME
  process.env.DSH_HOME = root
  try {
    const summary = await readQoderSpend()
    assert.deepEqual(summary.windows.map((window) => window.requests), [0, 0, 0])
    assert.equal(summary.updatedAt, undefined)
  } finally {
    if (previous === undefined) delete process.env.DSH_HOME
    else process.env.DSH_HOME = previous
    await rm(root, { recursive: true, force: true })
  }
})

test('parseQuotaSnapshot carries locally measured spend and rejects a bad window', () => {
  const base = {
    planTierName: 'Teams',
    userType: 'teams',
    isPaidPlan: true,
    isHighestTier: false,
    organizationName: '上海交通大学',
    organizationRole: 'Member',
    periodStart: 1,
    periodEnd: 2,
    personal: { total: 3000, used: 129, remaining: 2871, percentage: 0.043, unit: 'credits', available: true },
    usageType: 'credits',
    totalPercentage: 0.043,
    isQuotaExceeded: false,
    expiresAt: 3,
  }
  // Absent spend is the shape an older Host sends, and it has to keep parsing.
  assert.equal(parseQuotaSnapshot(base).spend, undefined)

  const snapshot = parseQuotaSnapshot({
    ...base,
    spend: {
      windows: [{ spanMs: FIVE_HOURS, credits: 0.75, requests: 2, resetsAt: 9 }],
      updatedAt: 8,
    },
  })
  assert.deepEqual(snapshot.spend, {
    windows: [{ spanMs: FIVE_HOURS, credits: 0.75, requests: 2, resetsAt: 9 }],
    updatedAt: 8,
  })
  // An empty ledger is legal and carries no timestamp.
  assert.deepEqual(parseQuotaSnapshot({ ...base, spend: { windows: [] } }).spend, { windows: [] })
  // A present-but-mistyped value is a contract violation, not a silent drop.
  assert.throws(
    () => parseQuotaSnapshot({ ...base, spend: { windows: [{ spanMs: '5h', credits: 1, requests: 1 }] } }),
    /invalid spanMs/,
  )
  assert.throws(() => parseQuotaSnapshot({ ...base, spend: { windows: 'none' } }), /invalid windows/)
})
