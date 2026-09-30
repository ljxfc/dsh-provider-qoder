/**
 * Browser half of the Qoder quota Remote: mounts the `qoder/quota`
 * contribution on `ctx.remote` and holds the one cached snapshot every quota
 * surface reads.
 *
 * The controller collapses concurrent reads onto one in-flight request and
 * drops stale generations, so a manual refresh racing the background tick
 * cannot paint an older answer over a newer one.
 *
 * @module dsh-provider-qoder/client/quota
 */

import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import { QUOTA_REMOTE_CONTRIBUTION, type QuotaSnapshotWire } from '../usage-wire.ts'

declare module '@deepseek-ai/dsh-typert-protocol' {
  interface TypertRemoteMap {
    'qoder/quota': () => Promise<RemoteResult<QuotaSnapshotWire>>
  }
  interface TypertRemoteNamespaceMap {
    qoder: {
      quota: () => Promise<RemoteResult<QuotaSnapshotWire>>
    }
  }
}

/** The mounted `remote.qoder` namespace, structurally typed so nothing is imported. */
export interface QoderQuotaNamespace {
  quota(): Promise<RemoteResult<QuotaSnapshotWire>>
}

/** Absent namespace resolution: the remote has not mounted (or never will). */
export type QoderQuotaResolver = () => QoderQuotaNamespace | undefined

/** How often a mounted surface re-reads the quota. */
export const QUOTA_AUTO_REFRESH_MS = 120_000

/**
 * The message this controller reports when the browser half has no
 * `remote.qoder` namespace to call. The surfaces match on it to name that state
 * ("the quota service is not mounted") instead of echoing the sentence, so the
 * two spellings must stay in step.
 */
export const QUOTA_REMOTE_UNMOUNTED_ERROR = 'the qoder/quota remote is not mounted'

/** One controller state. */
export interface QuotaSnapshot {
  status: 'idle' | 'loading' | 'ready' | 'error'
  report?: QuotaSnapshotWire
  error?: string
  fetchedAt?: number
}

/** The read surface the React components subscribe to. */
export interface QuotaController {
  getSnapshot(): QuotaSnapshot
  subscribe(listener: () => void): () => void
  /** Force a read; concurrent calls share one in-flight request. */
  refresh(): Promise<void>
}

/**
 * Build the single shared quota controller.
 * @param resolve - the inject-captured `remote.qoder` namespace, or undefined.
 */
export function createQuotaController(resolve: QoderQuotaResolver): QuotaController {
  let snapshot: QuotaSnapshot = { status: 'idle' }
  let inFlight: Promise<void> | undefined
  let generation = 0
  const listeners = new Set<() => void>()
  const publish = (): void => { for (const listener of listeners) listener() }

  const load = async (): Promise<void> => {
    const ticket = ++generation
    snapshot = { ...snapshot, status: 'loading' }
    publish()
    const namespace = resolve()
    if (namespace === undefined) {
      if (ticket !== generation) return
      snapshot = {
        status: 'error',
        error: QUOTA_REMOTE_UNMOUNTED_ERROR,
        ...(snapshot.fetchedAt === undefined ? {} : { fetchedAt: snapshot.fetchedAt }),
      }
      publish()
      return
    }
    try {
      const response = await namespace.quota()
      if (ticket !== generation) return
      snapshot = response.ok
        ? { status: 'ready', report: response.value, fetchedAt: Date.now() }
        : {
            status: 'error',
            error: response.error?.message ?? 'the quota read failed',
            ...(snapshot.fetchedAt === undefined ? {} : { fetchedAt: snapshot.fetchedAt }),
          }
    } catch (error: unknown) {
      if (ticket !== generation) return
      snapshot = {
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
        ...(snapshot.fetchedAt === undefined ? {} : { fetchedAt: snapshot.fetchedAt }),
      }
    }
    publish()
  }

  return {
    getSnapshot: () => snapshot,
    subscribe: (listener) => { listeners.add(listener); return () => listeners.delete(listener) },
    refresh: () => {
      inFlight ??= load().finally(() => { inFlight = undefined })
      return inFlight
    },
  }
}

/** Timer seam so tests drive the poll without waiting. */
export interface QuotaTimer {
  set(callback: () => void, ms: number): unknown
  clear(handle: unknown): void
}

const REAL_TIMER: QuotaTimer = {
  set: (callback, ms) => setTimeout(callback, ms),
  clear: (handle) => { clearTimeout(handle as ReturnType<typeof setTimeout>) },
}

/**
 * Start the background quota poll, refcounted across the sidebar card and the
 * panel (both can be mounted at once). Only the first start fetches, and only
 * the last stop clears the timer.
 *
 * @param controller - the shared controller.
 * @param isVisible - reads the live toggle; a hidden surface stops the poll.
 * @param timer - timer seam for tests.
 * @returns the stop function for this caller.
 */
export function startQuotaAutoRefresh(
  controller: QuotaController,
  isVisible: () => boolean,
  timer: QuotaTimer = REAL_TIMER,
): () => void {
  references += 1
  const ticket = ++ticketSeq
  const tick = (): void => {
    if (activeTicket !== ticket) return
    if (isVisible()) void controller.refresh()
    handle = timer.set(tick, QUOTA_AUTO_REFRESH_MS)
  }
  if (activeTicket === undefined) {
    activeTicket = ticket
    handle = timer.set(tick, QUOTA_AUTO_REFRESH_MS)
    if (isVisible()) void controller.refresh()
  }
  return () => {
    references -= 1
    if (references > 0 || activeTicket !== ticket) return
    activeTicket = undefined
    if (handle !== undefined) timer.clear(handle)
    handle = undefined
  }
}

let references = 0
let ticketSeq = 0
let activeTicket: number | undefined
let handle: unknown

/**
 * The contribution the client entry mounts. Re-exported here so the browser
 * half names the wire contract exactly once.
 */
export const QUOTA_CONTRIBUTION = QUOTA_REMOTE_CONTRIBUTION
