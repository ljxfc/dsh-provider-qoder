/**
 * The `showSidebarQuota` toggle, read and written through the Host settings
 * service. The browser holds no settings document of its own: it mirrors the
 * `llm-qoder` namespace row and writes single-field ops back to the Host,
 * which is also where the adapter reads the same flag.
 *
 * @module dsh-provider-qoder/client/settings
 */

export const SETTINGS_NS = 'llm-qoder'
export const SHOW_SIDEBAR_QUOTA_FIELD = 'showSidebarQuota'

type RemoteResult<T> = { ok: true; value: T } | { ok: false; error?: { message?: string } }

/** One field write, exactly the op union `remote.settings.mutate` accepts. */
export type SettingsPathOp =
  | { op: 'set'; path: string[]; value: unknown }
  | { op: 'unset'; path: string[] }

/** One namespace row from `remote.settings.describe()`. */
export interface SettingsNamespaceRow {
  ns?: unknown
  value?: unknown
  revision?: number
}

/** The slice of `remote.settings` this plugin uses. */
export interface SettingsWriteRemote {
  describe(): Promise<RemoteResult<{ writable?: boolean; namespaces?: SettingsNamespaceRow[] }>>
  mutate(
    ns: string,
    ops: SettingsPathOp[],
    expectedRevision?: number,
  ): Promise<RemoteResult<SettingsNamespaceRow>>
}

/** What the toggle row renders. */
export interface QoderQuotaSettingsSnapshot {
  /** Stored/effective value — the only gate on rendering and background polling. */
  enabled: boolean
  loading: boolean
  writable: boolean
  failed: boolean
}

export interface QoderQuotaSettingsFace {
  getSnapshot(): QoderQuotaSettingsSnapshot
  subscribe(listener: () => void): () => void
  refresh(): Promise<void>
  /** Write the flag; returns whether the Host accepted it. */
  set(value: boolean): Promise<boolean>
}

function recordOf(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined
}

function rowFor(
  response: { ok: true; value: { namespaces?: SettingsNamespaceRow[] } } | { ok: false },
): SettingsNamespaceRow | undefined {
  if (!response.ok) return undefined
  return response.value.namespaces?.find((entry) => entry.ns === SETTINGS_NS)
}

/**
 * Build the toggle face.
 * @param resolve - the mounted `remote.settings` service, or undefined.
 */
export function createQuotaSettingsFace(
  resolve: () => SettingsWriteRemote | undefined,
): QoderQuotaSettingsFace {
  let snapshot: QoderQuotaSettingsSnapshot = { enabled: false, loading: true, writable: true, failed: false }
  let revision: number | undefined
  const listeners = new Set<() => void>()
  const publish = (): void => { for (const listener of listeners) listener() }

  const refresh = async (): Promise<void> => {
    const settings = resolve()
    if (settings === undefined) {
      snapshot = { enabled: false, loading: false, writable: false, failed: false }
      publish()
      return
    }
    try {
      const response = await settings.describe()
      const row = rowFor(response)
      if (row !== undefined && typeof row.revision === 'number') revision = row.revision
      const value = recordOf(row?.value)
      snapshot = {
        enabled: value?.[SHOW_SIDEBAR_QUOTA_FIELD] === true,
        loading: false,
        writable: response.ok ? response.value.writable !== false : false,
        failed: false,
      }
    } catch {
      snapshot = { ...snapshot, loading: false, writable: false, failed: true }
    }
    publish()
  }
  void refresh()

  return {
    getSnapshot: () => snapshot,
    subscribe: (listener) => { listeners.add(listener); return () => listeners.delete(listener) },
    refresh,
    set: async (value) => {
      const settings = resolve()
      if (settings === undefined) {
        snapshot = { ...snapshot, failed: true }
        publish()
        return false
      }
      try {
        // A rejected write is usually a revision conflict: re-read the row and
        // retry once before reporting failure, so a concurrent settings edit
        // does not leave the toggle stuck.
        let response = await settings.mutate(
          SETTINGS_NS,
          [{ op: 'set', path: [SHOW_SIDEBAR_QUOTA_FIELD], value }],
          revision,
        )
        if (!response.ok) {
          await refresh()
          response = await settings.mutate(
            SETTINGS_NS,
            [{ op: 'set', path: [SHOW_SIDEBAR_QUOTA_FIELD], value }],
            revision,
          )
        }
        await refresh()
        const accepted = response.ok
        snapshot = { ...snapshot, failed: !accepted, enabled: accepted ? value : snapshot.enabled }
        publish()
        return accepted
      } catch {
        snapshot = { ...snapshot, failed: true }
        publish()
        return false
      }
    },
  }
}
