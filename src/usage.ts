/**
 * Qoder CN plan and quota facts.
 *
 * Qoder CN exposes three read-only account endpoints, all of which accept a
 * plain job token bearer (COSY signing is only required on the `/algo/...`
 * gateway routes):
 *
 * - `GET {gateway}/api/v2/user/plan`   — subscription tier + organisation
 * - `GET {gateway}/api/v2/quota/usage` — credit pools + billing window
 * - `GET {openapi}/api/v1/me/usage`    — add-on (purchased/gifted) credits
 *
 * There is deliberately no five-hour or weekly rolling window on this service:
 * a bounded sweep of the neighbouring paths answers ALB 503, so the panel is
 * built from the pools Qoder actually reports — the personal plan credits
 * (`userQuota`), the organization resource package (`orgResourcePackage`), and
 * the add-on credits (`addOnQuota`, which Qoder omits entirely while the
 * account owns none).
 *
 * @module dsh-provider-qoder/usage
 */

import type { QuotaSpendWire } from './usage-wire.ts'

/** One credit pool as Qoder reports it. */
export interface QoderQuotaPool {
  /** Whole size of the pool in `unit`. */
  total: number
  /** Consumed amount. */
  used: number
  /** Amount still available. */
  remaining: number
  /** Fraction consumed, 0–1 (not a percentage). */
  percentage: number
  /** Display unit, e.g. `credits`. */
  unit: string
  /**
   * Whether this pool currently contributes spendable credits. The
   * organization package reports `available: false` for a member who draws on
   * their personal plan first, which is why an unavailable pool renders as a
   * dormant row rather than a full one.
   */
  available: boolean
}

/** The account's plan, billing window, and credit pools. */
export interface QoderUsageReport {
  /** Account kind Qoder reported (`teams`, `personal`, …). */
  userType: string
  /** Subscription tier display name (`Teams`, `Pro`, …). */
  planTierName: string
  /** Whether Qoder considers this a paid subscription. */
  isPaidPlan: boolean
  /** Whether this is the highest tier Qoder offers. */
  isHighestTier: boolean
  /** Organization facts, present only for a team subscription. */
  organization?: { id: string; name: string; role: string; suspended: boolean }
  /** Billing window start (epoch millis), 0 when unreported. */
  periodStart: number
  /** Billing window end (epoch millis), 0 when unreported. */
  periodEnd: number
  /** The personal plan credit pool. */
  personal: QoderQuotaPool
  /** The organization resource package, present only when the account has one. */
  organizationPool?: QoderQuotaPool
  /**
   * Purchased or gifted credits, present only once the account owns some:
   * Qoder omits `addOnQuota` entirely while the balance is zero, which is why
   * this is optional rather than a zeroed pool.
   */
  addOnPool?: QoderQuotaPool
  /** Qoder's own usage metric (`credits`, `tokens`, …). */
  usageType: string
  /** Overall consumption fraction, 0–1. */
  totalPercentage: number
  /** Whether the account is out of quota right now. */
  isQuotaExceeded: boolean
  /** When the current pool assignment expires (epoch millis), 0 when unreported. */
  expiresAt: number
  /** Qoder's own upgrade link, when it sent one. */
  upgradeUrl?: string
  /**
   * Rolling spend measured on this machine. Qoder publishes no rolling window,
   * so this member is not read from any endpoint: the adapter attaches it from
   * the local ledger (`src/usage-ledger.ts`) after the server reads resolve.
   */
  spend?: QuotaSpendWire
}

/** Endpoints the quota reads need. */
export interface QoderUsageEndpoints {
  /** Gateway origin (`https://gateway.qoder.com.cn`). */
  gateway: string
  /**
   * OpenAPI origin (`https://openapi.qoder.com.cn`). Only the `/api/v1/me/*`
   * reads need it, and it is the one origin that answers a truthful 404, so it
   * is also the only place a missing capability can be proven missing.
   */
  openapi?: string
}

/** How long one quota read may take before it is abandoned. */
export const QUOTA_TIMEOUT_MS = 20_000

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined
}

function num(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function bool(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback
}

/**
 * Normalise a reported consumption value to a 0–1 fraction. The two Qoder
 * backends disagree by a factor of 100 (`totalUsagePercentage` is `0.03`,
 * `total_usage_percentage` is `3`) and the wire cannot tell them apart below 1,
 * so anything above 1 is read as a percentage.
 */
function fraction(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined
  return value > 1 ? value / 100 : value
}

/**
 * Read one credit pool. `percentage` is normalised to a 0–1 fraction whether
 * Qoder sent a fraction (`0.03`) or a percent (`3`) — the two are
 * indistinguishable above 1, and a pool can never be more than 100% consumed,
 * so a value above 1 is read as a percentage.
 */
export function parseQuotaPool(value: unknown): QoderQuotaPool | undefined {
  const source = asRecord(value)
  if (source === undefined) return undefined
  const raw = num(source.percentage)
  return {
    total: num(source.total),
    used: num(source.used),
    remaining: num(source.remaining),
    percentage: raw > 1 ? raw / 100 : raw,
    unit: str(source.unit, 'credits'),
    // Absent means "no such posture reported" and reads as spendable, so an
    // older gateway that omits the flag still renders the pool.
    available: bool(source.available, true),
  }
}

function parsePlan(payload: unknown): Partial<QoderUsageReport> {
  const root = asRecord(payload)
  if (root === undefined) return {}
  const organization = asRecord(root.organization)
  const report: Partial<QoderUsageReport> = {
    userType: str(root.user_type),
    planTierName: str(root.plan_tier_name),
    isPaidPlan: bool(root.is_paid_plan),
    isHighestTier: bool(root.is_highest_tier),
    periodStart: num(root.start_date),
    periodEnd: num(root.end_date),
  }
  if (organization !== undefined) {
    report.organization = {
      id: str(organization.org_id),
      name: str(organization.org_name),
      role: str(organization.role_name),
      suspended: bool(organization.is_suspended),
    }
  }
  return report
}

function parseUsage(payload: unknown): Partial<QoderUsageReport> {
  const root = asRecord(payload)
  if (root === undefined) return {}
  const personal = parseQuotaPool(root.userQuota)
  const pool = parseQuotaPool(root.orgResourcePackage)
  const addOn = parseQuotaPool(root.addOnQuota)
  const report: Partial<QoderUsageReport> = {
    usageType: str(root.usageType, 'credits'),
    isQuotaExceeded: bool(root.isQuotaExceeded),
    expiresAt: num(root.expiresAt),
  }
  const total = fraction(root.totalUsagePercentage)
  if (total !== undefined) report.totalPercentage = total
  if (personal !== undefined) report.personal = personal
  if (pool !== undefined) report.organizationPool = pool
  if (addOn !== undefined) report.addOnPool = addOn
  const upgradeUrl = root.upgradeUrl
  if (typeof upgradeUrl === 'string' && upgradeUrl.length > 0) report.upgradeUrl = upgradeUrl
  return report
}

/**
 * The snake_case `/api/v1/me/*` shape. It reports the same two pools as the
 * gateway plus the add-on balance, so it is read both as a fallback for the
 * plan fields and as the only source of `addOnQuota`. Only non-empty fields are
 * returned, so a merge can never let this read blank out a richer gateway one.
 */
function parseOpenApiUsage(payload: unknown): Partial<QoderUsageReport> {
  const root = asRecord(payload)
  if (root === undefined) return {}
  const report: Partial<QoderUsageReport> = {}
  const userType = str(root.user_type)
  if (userType.length > 0) report.userType = userType
  const planTierName = str(root.plan_tier_name)
  if (planTierName.length > 0) report.planTierName = planTierName
  if (typeof root.is_highest_tier === 'boolean') report.isHighestTier = root.is_highest_tier
  if (typeof root.expires_at === 'number') report.expiresAt = root.expires_at
  const total = fraction(root.total_usage_percentage)
  if (total !== undefined) report.totalPercentage = total
  if (typeof root.is_quota_exceeded === 'boolean') report.isQuotaExceeded = root.is_quota_exceeded
  const personal = parseQuotaPool(root.user_quota)
  if (personal !== undefined) report.personal = personal
  const shared = parseQuotaPool(root.shared_quota)
  if (shared !== undefined) report.organizationPool = shared
  const addOn = parseQuotaPool(root.add_on_quota ?? root.addOnQuota)
  if (addOn !== undefined) report.addOnPool = addOn
  const upgradeUrl = root.upgrade_url
  if (typeof upgradeUrl === 'string' && upgradeUrl.length > 0) report.upgradeUrl = upgradeUrl
  return report
}

async function getJson(url: string, jobToken: string, signal?: AbortSignal): Promise<unknown> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), QUOTA_TIMEOUT_MS)
  const abort = (): void => controller.abort()
  signal?.addEventListener('abort', abort, { once: true })
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${jobToken}`,
        Accept: 'application/json',
        // The desktop injects HTTP_PROXY, and the proxy can answer without the
        // content-encoding header — an identity body is the only reliably
        // decodable form (same reason the model catalog asks for identity).
        'Accept-Encoding': 'identity',
      },
      signal: controller.signal,
    })
    if (!response.ok) {
      throw new Error(`Qoder CN quota request to ${url} failed with HTTP ${response.status}`)
    }
    return await response.json()
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', abort)
  }
}

function emptyPool(): QoderQuotaPool {
  return { total: 0, used: 0, remaining: 0, percentage: 0, unit: 'credits', available: true }
}

/**
 * Read the account's plan and quota. Every read runs together; one failing
 * endpoint still yields a usable report, because the plan, the gateway pools,
 * and the add-on balance degrade independently (a team member can read usage
 * while the plan call is rate-limited). Only a total failure throws.
 *
 * @param jobToken - live job token (never the PAT).
 * @param endpoints - the gateway and openapi origins to read from.
 * @param signal - optional caller cancellation.
 * @returns the merged report.
 */
export async function fetchQoderQuota(
  jobToken: string,
  endpoints: QoderUsageEndpoints,
  signal?: AbortSignal,
): Promise<QoderUsageReport> {
  const gateway = endpoints.gateway.replace(/\/+$/, '')
  const openapi = (endpoints.openapi ?? endpoints.gateway).replace(/\/+$/, '')
  const [plan, usage, account] = await Promise.allSettled([
    getJson(`${gateway}/api/v2/user/plan`, jobToken, signal),
    getJson(`${gateway}/api/v2/quota/usage`, jobToken, signal),
    getJson(`${openapi}/api/v1/me/usage`, jobToken, signal),
  ])
  if (plan.status === 'rejected' && usage.status === 'rejected' && account.status === 'rejected') {
    throw plan.reason instanceof Error ? plan.reason : new Error(String(plan.reason))
  }
  const base: QoderUsageReport = {
    userType: '',
    planTierName: '',
    isPaidPlan: false,
    isHighestTier: false,
    periodStart: 0,
    periodEnd: 0,
    personal: emptyPool(),
    usageType: 'credits',
    totalPercentage: 0,
    isQuotaExceeded: false,
    expiresAt: 0,
  }
  // The openapi read goes first so the gateway's richer camelCase answers win
  // every field they share; `addOnPool` exists only here and always survives.
  return {
    ...base,
    ...(account.status === 'fulfilled' ? parseOpenApiUsage(account.value) : {}),
    ...(plan.status === 'fulfilled' ? parsePlan(plan.value) : {}),
    ...(usage.status === 'fulfilled' ? parseUsage(usage.value) : {}),
  }
}
