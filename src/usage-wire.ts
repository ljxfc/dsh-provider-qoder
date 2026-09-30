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
 * Parse one untrusted boundary value into a {@link QuotaSnapshotWire}. Every
 * required field is shape-checked so a malformed frame fails the boundary
 * instead of rendering garbage; the two genuinely optional members (the
 * organization pool and the upgrade link) stay optional, and a PRESENT but
 * malformed value is still a contract violation rather than a silent drop.
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
