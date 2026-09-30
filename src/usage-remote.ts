/**
 * Host half of the Qoder quota Remote (`qoder/quota`).
 *
 * The panel needs facts the browser cannot fetch for itself — it never holds
 * the PAT — so this module exposes them through the Typert Gateway: a
 * `TypertRemoteService` provides the receiver the Gateway resolves, and the
 * shared strict descriptor (`src/usage-wire.ts`) is registered on the `typert`
 * registry so the Gateway claims the endpoint.
 *
 * The whole wiring rides an optional `ctx.inject(['typert'], …)` fiber: a
 * profile without the web stack (no Typert registry, no Gateway) simply never
 * activates it and the sidebar card reports "unavailable" instead of hanging.
 *
 * @module dsh-provider-qoder/usage-remote
 */

import type { Context } from '@deepseek-ai/cordis'
import { TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import type { QoderAdapter } from './adapter.ts'
import type { QoderUsageReport } from './usage.ts'
import {
  QUOTA_HOST_CONTRIBUTION,
  REMOTE_NAMESPACE,
  REMOTE_SERVICE,
  type QuotaSnapshotWire,
} from './usage-wire.ts'

/** Everything the quota service needs beyond its Cordis context. */
export interface QoderUsageDeps {
  /** The live adapter, which already owns the job-token cache and PAT resolution. */
  adapter: QoderAdapter
}

/** Project an internal report onto the wire shape, dropping undefined members. */
export function toQuotaSnapshot(report: QoderUsageReport): QuotaSnapshotWire {
  const snapshot: QuotaSnapshotWire = {
    planTierName: report.planTierName,
    userType: report.userType,
    isPaidPlan: report.isPaidPlan,
    isHighestTier: report.isHighestTier,
    organizationName: report.organization?.name ?? '',
    organizationRole: report.organization?.role ?? '',
    periodStart: report.periodStart,
    periodEnd: report.periodEnd,
    personal: report.personal,
    usageType: report.usageType,
    totalPercentage: report.totalPercentage,
    isQuotaExceeded: report.isQuotaExceeded,
    expiresAt: report.expiresAt,
  }
  if (report.organizationPool !== undefined) snapshot.organizationPool = report.organizationPool
  if (report.addOnPool !== undefined) snapshot.addOnPool = report.addOnPool
  if (report.upgradeUrl !== undefined) snapshot.upgradeUrl = report.upgradeUrl
  // Locally measured rolling spend rides the same snapshot so one read fills
  // both halves of the panel; absent means this Host recorded none.
  if (report.spend !== undefined) snapshot.spend = report.spend
  return snapshot
}

/**
 * The Remote receiver: a Cordis service the Gateway resolves by key
 * (`qoderUsage`) and binds to the wire namespace (`qoder`). The base class
 * stamps the `typertRemote` binding the Gateway validates on every dispatch;
 * no decorators are needed because the descriptor is registered explicitly
 * (strict path) rather than discovered from source markers.
 */
export class QoderUsageService extends TypertRemoteService {
  constructor(ctx: Context, private readonly deps: QoderUsageDeps) {
    super(ctx, REMOTE_SERVICE, { namespace: REMOTE_NAMESPACE })
  }

  /**
   * The account's plan, billing window, and credit pools. Throws when the PAT
   * cannot be resolved or Qoder is unreachable, which the Gateway folds into
   * the failure branch the panel renders as a hint.
   */
  async quota(): Promise<QuotaSnapshotWire> {
    return toQuotaSnapshot(await this.deps.adapter.getUsage())
  }
}

/** The registry surface this module needs; structurally typed so nothing is imported. */
interface TypertContributionRegistry {
  register(contribution: unknown): () => void
}

/**
 * Provide the quota service and register its Remote descriptor. The registry
 * contribution is tied to this fiber's lifetime: the registry's own
 * `register()` effect would otherwise outlive the plugin.
 */
export function applyUsageRemote(ctx: Context, deps: QoderUsageDeps): void {
  ctx.inject(['typert'], (remoteCtx) => {
    new QoderUsageService(remoteCtx, deps)
    const registry = (remoteCtx as unknown as { typert: TypertContributionRegistry }).typert
    const unregister = registry.register(QUOTA_HOST_CONTRIBUTION)
    // The registry's own effect would outlive this fiber; withdraw the
    // contribution when the plugin unloads.
    remoteCtx.effect(() => () => void unregister(), 'dsh-provider-qoder: usage remote')
  })
}
