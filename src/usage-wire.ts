/**
 * Wire contract for the Qoder quota Remote (`qoder/quota`).
 *
 * The browser never holds the Qoder PAT, so the quota snapshot is produced
 * Host-side and crosses the Typert Gateway: the Host half registers a strict
 * invocation descriptor against a Cordis service (`src/usage-remote.ts`) and
 * the browser half mounts the matching contribution on `ctx.remote`
 * (`src/client/index.ts`). This module is the single source both halves
 * share — the hand-rolled result validator and the exact descriptor object —
 * so neither half can drift. It is dependency-free because the client bundle
 * inlines it.
 *
 * @module dsh-provider-qoder/usage-wire
 */

import type { InvocationDescriptor, TypertRemoteContribution, TypertSchema } from '@deepseek-ai/dsh-typert-protocol'

/** The npm package identity every contribution and descriptor claims. */
export const REMOTE_PACKAGE = 'dsh-provider-qoder'

/** The Cordis service key the Gateway resolves the quota Remote from. */
export const REMOTE_SERVICE = 'qoderUsage'

/** The wire namespace every Qoder endpoint shares. */
export const REMOTE_NAMESPACE = 'qoder'

/** Canonical `<namespace>/<method>` endpoint of the quota Remote. */
export const QUOTA_ENDPOINT = 'qoder/quota'

/** One credit pool on the wire. */
export interface QuotaPoolWire {
  total: number
  used: number
  remaining: number
  percentage: number
  unit: string
  available: boolean
}

/** One rolling spend window, measured locally (see `src/usage-ledger.ts`). */
export interface QuotaSpendWindowWire {
  /** Window length in milliseconds. */
  spanMs: number
  /** Credits billed by completed requests inside the window. */
  credits: number
  /** Number of completed billed requests inside the window. */
  requests: number
  /**
   * When the oldest counted request falls out of the window (epoch millis).
   * Absent while the window is empty: a rolling window holding nothing has no
   * next release to announce.
   */
  resetsAt?: number
}

/**
 * Locally measured rolling spend.
 *
 * Qoder CN publishes no rolling window of its own — its panel reports credits
 * consumed inside the monthly billing cycle and nothing finer — so these totals
 * are summed from the credit figure the gateway returns with every completed
 * request rather than read from Qoder. Every surface labels them as locally
 * measured for that reason, and the monthly pool stays the server's own number.
 */
export interface QuotaSpendWire {
  /** Rolling windows, ordered shortest first. */
  windows: QuotaSpendWindowWire[]
  /** When the newest recorded request completed (epoch millis); absent while empty. */
  updatedAt?: number
}

/** The account facts the panel renders. */
export interface QuotaSnapshotWire {
  planTierName: string
  userType: string
  isPaidPlan: boolean
  isHighestTier: boolean
  organizationName: string
  organizationRole: string
  periodStart: number
  periodEnd: number
  personal: QuotaPoolWire
  /** Absent when the account has no organization resource package. */
  organizationPool?: QuotaPoolWire
  /** Purchased or gifted credits; absent while the account owns none. */
  addOnPool?: QuotaPoolWire
  usageType: string
  totalPercentage: number
  isQuotaExceeded: boolean
  expiresAt: number
  upgradeUrl?: string
  /**
   * Rolling spend measured on this machine. Absent when the Host half did not
   * record any (an older Host), never a stand-in for a Qoder-reported window.
   */
  spend?: QuotaSpendWire
}

/** Reject one boundary value, naming the offending field. */
function reject(field: string): never {
  throw new TypeError(`qoder/quota result: invalid ${field}`)
}

function record(value: unknown, field: string): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : reject(field)
}

function stringField(source: Record<string, unknown>, key: string): string {
  const value = source[key]
  return typeof value === 'string' ? value : reject(key)
}

function numberField(source: Record<string, unknown>, key: string): number {
  const value = source[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : reject(key)
}

function booleanField(source: Record<string, unknown>, key: string): boolean {
  const value = source[key]
  return typeof value === 'boolean' ? value : reject(key)
}

function arrayField(source: Record<string, unknown>, key: string): unknown[] {
  const value = source[key]
  return Array.isArray(value) ? value : reject(key)
}

/** Parse one untrusted boundary value into a {@link QuotaPoolWire}. */
function parsePool(value: unknown, field: string): QuotaPoolWire {
  const source = record(value, field)
  return {
    total: numberField(source, 'total'),
    used: numberField(source, 'used'),
    remaining: numberField(source, 'remaining'),
    percentage: numberField(source, 'percentage'),
    unit: stringField(source, 'unit'),
    available: booleanField(source, 'available'),
  }
}

/**
 * Parse one untrusted boundary value into a {@link QuotaSpendWire}. Only
 * `windows` is required: an empty ledger legitimately carries no timestamp.
 */
function parseSpend(value: unknown, field: string): QuotaSpendWire {
  const source = record(value, field)
  const windows = arrayField(source, 'windows').map((entry, index) => {
    const window = record(entry, `${field}.windows[${String(index)}]`)
    const parsed: QuotaSpendWindowWire = {
      spanMs: numberField(window, 'spanMs'),
      credits: numberField(window, 'credits'),
      requests: numberField(window, 'requests'),
    }
    if (window.resetsAt !== undefined) parsed.resetsAt = numberField(window, 'resetsAt')
    return parsed
  })
  const spend: QuotaSpendWire = { windows }
  if (source.updatedAt !== undefined) spend.updatedAt = numberField(source, 'updatedAt')
  return spend
}

/**
 * Parse one untrusted boundary value into a {@link QuotaSnapshotWire}. Every
 * required field is shape-checked so a malformed frame fails the boundary
 * instead of rendering garbage; the genuinely optional members (the
 * organization pool, the add-on pool, the upgrade link, the locally measured
 * spend) stay optional, and a PRESENT but malformed value is still a contract
 * violation rather than a silent drop.
 */
export function parseQuotaSnapshot(value: unknown): QuotaSnapshotWire {
  const source = record(value, 'result')
  const snapshot: QuotaSnapshotWire = {
    planTierName: stringField(source, 'planTierName'),
    userType: stringField(source, 'userType'),
    isPaidPlan: booleanField(source, 'isPaidPlan'),
    isHighestTier: booleanField(source, 'isHighestTier'),
    organizationName: stringField(source, 'organizationName'),
    organizationRole: stringField(source, 'organizationRole'),
    periodStart: numberField(source, 'periodStart'),
    periodEnd: numberField(source, 'periodEnd'),
    personal: parsePool(source.personal, 'personal'),
    usageType: stringField(source, 'usageType'),
    totalPercentage: numberField(source, 'totalPercentage'),
    isQuotaExceeded: booleanField(source, 'isQuotaExceeded'),
    expiresAt: numberField(source, 'expiresAt'),
  }
  if (source.organizationPool !== undefined) {
    snapshot.organizationPool = parsePool(source.organizationPool, 'organizationPool')
  }
  if (source.addOnPool !== undefined) {
    snapshot.addOnPool = parsePool(source.addOnPool, 'addOnPool')
  }
  if (source.upgradeUrl !== undefined) {
    snapshot.upgradeUrl = stringField(source, 'upgradeUrl')
  }
  if (source.spend !== undefined) {
    snapshot.spend = parseSpend(source.spend, 'spend')
  }
  return snapshot
}

/**
 * The strict result codec both halves attach to the descriptor.
 *
 * The registry requires `mode: 'strict'` carrying the LAZY schema factory
 * (`create()`); there is deliberately no `schema` member.
 */
export const quotaSchema: TypertSchema<QuotaSnapshotWire> = { parse: parseQuotaSnapshot }

/** The one invocation descriptor, shared by the Host registration and the Client mount. */
export const QUOTA_DESCRIPTOR: InvocationDescriptor = {
  id: `${REMOTE_PACKAGE}#${QUOTA_ENDPOINT}`,
  service: REMOTE_SERVICE,
  namespace: REMOTE_NAMESPACE,
  method: 'quota',
  invocation: { kind: 'direct' },
  parameters: [],
  result: { mode: 'strict', typeSymbol: `${REMOTE_PACKAGE}#QuotaSnapshotWire`, create: () => quotaSchema },
}

/** The Host-face contribution registered on `ctx.typert`. */
export const QUOTA_HOST_CONTRIBUTION = {
  package: REMOTE_PACKAGE,
  face: 'host' as const,
  schemas: [],
  // Every Host contribution must carry its reflection model. This hand-written
  // Remote has no generated reflection exports, so use the official empty-model
  // form rather than leaving registry inspection with `model: undefined`.
  model: { services: [], events: [], objects: [] },
  invocations: [QUOTA_DESCRIPTOR],
}

/** The Client-face contribution mounted on `ctx.remote`. */
export const QUOTA_REMOTE_CONTRIBUTION: TypertRemoteContribution = {
  package: REMOTE_PACKAGE,
  descriptors: [QUOTA_DESCRIPTOR],
}
