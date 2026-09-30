/**
 * Rolling spend ledger for Qoder CN.
 *
 * Qoder CN publishes no rolling window: `/api/v2/quota/usage` reports the
 * monthly billing cycle and its credit pools, and a bounded sweep of the
 * neighbouring read paths answers ALB 503, so there is no five-hour or weekly
 * window to fetch. The rolling figures the quota surfaces show are therefore
 * MEASURED LOCALLY — one line per billed request, appended as each stream
 * completes, summed over a rolling window when the panel reads. The monthly
 * pool stays the server's own number, and every surface labels the two
 * differently so one cannot be mistaken for the other.
 *
 * The store is a single JSONL file under the DSH data root, so it survives an
 * app restart and can be read with any text tool. It is deliberately
 * best-effort throughout: a ledger that cannot be written must never fail a
 * request that already succeeded, and a ledger that cannot be read must never
 * blank the server-reported pools beside it.
 *
 * @module dsh-provider-qoder/usage-ledger
 */

import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import type { QuotaSpendWire, QuotaSpendWindowWire } from './usage-wire.ts'

/** One completed, billed request. */
export interface QoderSpendRecord {
  /** Completion time (epoch millis). */
  at: number
  /** Credits billed for the request, after any promotion discount. */
  credits: number
  /** Credits that would have been billed without the discount. */
  originalCredits?: number
  /** The selector-facing model id the request named. */
  model?: string
}

/** One hour, in milliseconds. */
const HOUR_MS = 60 * 60 * 1000

/**
 * The rolling windows every surface reports, shortest first. The five-hour and
 * weekly pair mirrors the surfaces users compare against; the day-long window
 * sits between them because a five-hour burst and a weekly total cannot show
 * what happened yesterday.
 */
export const QODER_SPEND_WINDOWS_MS: readonly number[] = [
  5 * HOUR_MS,
  24 * HOUR_MS,
  7 * 24 * HOUR_MS,
]

/** How long a record is kept: the longest window plus a day of slack. */
export const SPEND_RETENTION_MS = 8 * 24 * HOUR_MS

/** Credits are summed as floats; six decimals is well under one credit's noise. */
const CREDIT_DECIMALS = 1e6

/** The ledger file, inside the active DSH data root. */
export function spendLedgerPath(): string {
  const configured = process.env.DSH_HOME?.trim()
  const root = configured !== undefined && configured.length > 0 ? configured : join(homedir(), '.dsh')
  return join(root, 'qoder-spend.jsonl')
}

/** Parse one ledger line, rejecting anything that is not a usable record. */
function parseRecord(line: string): QoderSpendRecord | undefined {
  let value: unknown
  try {
    value = JSON.parse(line)
  } catch {
    return undefined
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined
  const source = value as Record<string, unknown>
  const { at, credits } = source
  // A record with no usable time or no positive charge could only ever add
  // noise to every window, so it is dropped rather than repaired.
  if (typeof at !== 'number' || !Number.isFinite(at)) return undefined
  if (typeof credits !== 'number' || !Number.isFinite(credits) || credits <= 0) return undefined
  const record: QoderSpendRecord = { at, credits }
  const original = source.originalCredits
  if (typeof original === 'number' && Number.isFinite(original) && original > 0) {
    record.originalCredits = original
  }
  const model = source.model
  if (typeof model === 'string' && model.length > 0) record.model = model
  return record
}

/** Round a summed credit total so float noise never reaches the wire. */
function roundCredits(value: number): number {
  return Math.round(value * CREDIT_DECIMALS) / CREDIT_DECIMALS
}

/**
 * Sum records over each rolling window.
 *
 * Pure on purpose: the arithmetic every surface depends on is pinned by tests
 * without touching the filesystem or the clock.
 * @param records - every record read from the ledger, in any order.
 * @param now - the instant the windows are measured from.
 * @param windows - window lengths in milliseconds, shortest first.
 * @returns the wire summary, with each window's release time when it holds anything.
 */
export function summariseSpend(
  records: readonly QoderSpendRecord[],
  now: number,
  windows: readonly number[] = QODER_SPEND_WINDOWS_MS,
): QuotaSpendWire {
  const fresh = records.filter(
    (record) => record.at <= now && now - record.at < SPEND_RETENTION_MS,
  )
  const summary: QuotaSpendWire = {
    windows: windows.map((spanMs) => {
      let credits = 0
      let requests = 0
      let oldest: number | undefined
      for (const record of fresh) {
        if (now - record.at >= spanMs) continue
        credits += record.credits
        requests += 1
        if (oldest === undefined || record.at < oldest) oldest = record.at
      }
      const window: QuotaSpendWindowWire = { spanMs, credits: roundCredits(credits), requests }
      // A rolling window releases nothing until its oldest request ages out.
      if (oldest !== undefined) window.resetsAt = oldest + spanMs
      return window
    }),
  }
  let updatedAt: number | undefined
  for (const record of fresh) {
    if (updatedAt === undefined || record.at > updatedAt) updatedAt = record.at
  }
  if (updatedAt !== undefined) summary.updatedAt = updatedAt
  return summary
}

/**
 * Append one billed request to the ledger.
 *
 * Never throws and never rejects: the caller is a stream that has already
 * produced a successful response, so a full disk or a read-only data root must
 * not turn that response into a failure. A dropped line costs the local rolling
 * estimate one request's worth of accuracy and nothing else.
 * @param record - the request to record.
 */
export async function recordQoderSpend(record: QoderSpendRecord): Promise<void> {
  if (!Number.isFinite(record.credits) || record.credits <= 0) return
  try {
    const path = spendLedgerPath()
    await mkdir(dirname(path), { recursive: true })
    await appendFile(path, `${JSON.stringify(record)}\n`, 'utf8')
  } catch {
    // Best effort by contract; see the module doc.
  }
}

/** Rewrite the ledger with only the retained records, best effort. */
async function compactLedger(path: string, records: readonly QoderSpendRecord[]): Promise<void> {
  try {
    await writeFile(path, records.map((record) => `${JSON.stringify(record)}\n`).join(''), 'utf8')
  } catch {
    // The stale lines cost nothing but space and stay filtered on the next read.
  }
}

/**
 * Read every retained record.
 *
 * Stale and unparseable lines are filtered here, and the file is rewritten only
 * when something was dropped, so the growth of an append-only file stays
 * bounded without a rewrite on every read. Compaction races a concurrent append
 * by one line; the monthly pool is the authoritative number, so the local
 * estimate tolerates that rather than serialising every read behind a lock.
 * @param now - the instant retention is measured from.
 * @returns the retained records; empty when the ledger is missing or unreadable.
 */
export async function readSpendRecords(now: number = Date.now()): Promise<QoderSpendRecord[]> {
  const path = spendLedgerPath()
  let text: string
  try {
    text = await readFile(path, 'utf8')
  } catch {
    // No ledger yet is the normal first-run state, not an error.
    return []
  }
  const kept: QoderSpendRecord[] = []
  let dropped = 0
  for (const line of text.split('\n')) {
    if (line.length === 0) continue
    const record = parseRecord(line)
    if (record === undefined || now - record.at >= SPEND_RETENTION_MS) {
      dropped += 1
      continue
    }
    kept.push(record)
  }
  if (dropped > 0) await compactLedger(path, kept)
  return kept
}

/**
 * The rolling spend summary the quota Remote attaches to its snapshot.
 * @param now - the instant the windows are measured from.
 * @returns every window, zeroed when nothing has been recorded yet.
 */
export async function readQoderSpend(now: number = Date.now()): Promise<QuotaSpendWire> {
  return summariseSpend(await readSpendRecords(now), now)
}
