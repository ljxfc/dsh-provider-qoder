import { mergeModelLimits } from '../capacity.ts'
export const SETTINGS_NS = 'llm-qoder'
export const SHOW_SIDEBAR_QUOTA_FIELD = 'showSidebarQuota'
type RemoteResult<T> =
  | { ok: true; value: T }
  | { ok: false; error?: { message?: string; code?: string } }
export type SettingsPathOp =
  | { op: 'set'; path: string[]; value: unknown }
  | { op: 'unset'; path: string[] }
export interface SettingsNamespaceRow {
  ns?: unknown
  value?: unknown
  revision?: number
}
export interface SettingsWriteRemote {
  describe(): Promise<
    RemoteResult<{ writable?: boolean; namespaces?: SettingsNamespaceRow[] }>
  >
  mutate(
    ns: string,
    ops: SettingsPathOp[],
    expectedRevision?: number,
  ): Promise<RemoteResult<SettingsNamespaceRow>>
}
export interface QoderQuotaSettingsSnapshot {
  enabled: boolean
  loading: boolean
  writable: boolean
  failed: boolean
}
export interface QoderQuotaSettingsFace {
  getSnapshot(): QoderQuotaSettingsSnapshot
  subscribe(listener: () => void): () => void
  refresh(): Promise<void>
  set(value: boolean): Promise<boolean>
}
export interface CapacityValues {
  contextWindowOverride?: number
  maxOutputTokens?: number
  modelLimits?: Record<string, { contextWindow?: number; maxTokens?: number }>
}
export interface CapacitySettingsSnapshot extends QoderQuotaSettingsSnapshot {
  values: CapacityValues
  ownValues: CapacityValues
  layer: 'root' | 'providers.qoder-cn'
  busy: boolean
  error?: string
  saved: boolean
}
export interface CapacitySettingsFace {
  getSnapshot(): CapacitySettingsSnapshot
  subscribe(listener: () => void): () => void
  refresh(): Promise<void>
  set(
    field: 'contextWindowOverride' | 'maxOutputTokens',
    value?: number,
    model?: string,
  ): Promise<boolean>
  reset(model?: string): Promise<boolean>
}
export function recordOf(value: unknown): Record<string, any> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, any>)
    : undefined
}
export function validCapacity(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
}
/** One transaction coordinator prevents concurrent edits and fences stale reads. */
export function createSettingsFaces(
  resolve: () => SettingsWriteRemote | undefined,
): { capacity: CapacitySettingsFace; quota: QoderQuotaSettingsFace } {
  let snapshot: CapacitySettingsSnapshot = {
    enabled: false,
    loading: true,
    writable: false,
    failed: false,
    values: {},
    ownValues: {},
    layer: 'root',
    busy: false,
    saved: false,
  }
  let revision: number | undefined
  let document: Record<string, any> = {}
  let generation = 0
  const listeners = new Set<() => void>()
  const publish = () => {
    for (const listener of listeners) listener()
  }
  const refresh = async (): Promise<void> => {
    const ticket = ++generation
    snapshot = { ...snapshot, loading: true }
    publish()
    try {
      const remote = resolve()
      if (!remote) throw new Error('Settings service unavailable')
      const response = await remote.describe()
      if (!response.ok)
        throw new Error(response.error?.message ?? 'Settings read failed')
      if (ticket !== generation) return
      const row = response.value.namespaces?.find(
        (entry) => entry.ns === SETTINGS_NS,
      )
      revision = row?.revision
      const root = recordOf(row?.value) ?? {}
      document = root
      const profile = recordOf(recordOf(root.providers)?.['qoder-cn'])
      // The Host merges a present provider profile over root defaults.
      const values = {
        ...root,
        ...profile,
        modelLimits: mergeModelLimits(root.modelLimits, profile?.modelLimits),
      } as CapacityValues
      snapshot = {
        ...snapshot,
        values,
        ownValues: (profile ?? root) as CapacityValues,
        layer: profile ? 'providers.qoder-cn' : 'root',
        enabled: root.showSidebarQuota === true,
        loading: false,
        writable: response.value.writable !== false,
        failed: false,
        error: undefined,
      }
    } catch (error) {
      if (ticket !== generation) return
      revision = undefined
      snapshot = {
        ...snapshot,
        loading: false,
        writable: false,
        failed: true,
        error: error instanceof Error ? error.message : String(error),
      }
    }
    publish()
  }
  const write = async (makeOps: () => SettingsPathOp[]): Promise<boolean> => {
    if (
      snapshot.loading ||
      snapshot.busy ||
      !snapshot.writable ||
      snapshot.failed
    )
      return false
    snapshot = { ...snapshot, busy: true, saved: false, error: undefined }
    publish()
    try {
      const remote = resolve()
      if (!remote) throw new Error('Settings service unavailable')
      let ops = makeOps()
      let response = await remote.mutate(SETTINGS_NS, ops, revision)
      if (
        !response.ok &&
        /revision|conflict/i.test(
          `${response.error?.code ?? ''} ${response.error?.message ?? ''}`,
        )
      ) {
        await refresh()
        if (snapshot.failed || !snapshot.writable)
          throw new Error(snapshot.error ?? 'Settings reread failed')
        ops = makeOps()
        response = await remote.mutate(SETTINGS_NS, ops, revision)
      }
      if (!response.ok)
        throw new Error(response.error?.message ?? 'Settings write rejected')
      await refresh()
      if (snapshot.failed) return false
      for (const op of ops) {
        const observed = op.path.reduce<unknown>(
          (value, key) => recordOf(value)?.[key],
          document,
        )
        if (op.op === 'set' ? observed !== op.value : observed !== undefined)
          throw new Error('Host readback did not match the saved setting')
      }
      snapshot = { ...snapshot, saved: true }
      return true
    } catch (error) {
      snapshot = {
        ...snapshot,
        error: error instanceof Error ? error.message : String(error),
        saved: false,
      }
      return false
    } finally {
      snapshot = { ...snapshot, busy: false }
      publish()
    }
  }
  const prefix = () =>
    snapshot.layer === 'root' ? [] : ['providers', 'qoder-cn']
  const pathFor = (
    field: 'contextWindowOverride' | 'maxOutputTokens',
    model?: string,
  ) => [
    ...prefix(),
    ...(model === undefined
      ? [field]
      : [
          'modelLimits',
          model,
          field === 'contextWindowOverride' ? 'contextWindow' : 'maxTokens',
        ]),
  ]
  const subscribe = (listener: () => void) => {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }
  const capacity: CapacitySettingsFace = {
    getSnapshot: () => snapshot,
    subscribe,
    refresh,
    set: async (field, value, model) => {
      if (
        value !== undefined &&
        (!validCapacity(value) ||
          (field === 'contextWindowOverride' && value < 2))
      ) {
        snapshot = {
          ...snapshot,
          error: 'Use a positive safe integer token count',
          saved: false,
        }
        publish()
        return false
      }
      const limits =
        model === undefined ? undefined : snapshot.values.modelLimits?.[model]
      const context =
        field === 'contextWindowOverride'
          ? value
          : (limits?.contextWindow ?? snapshot.values.contextWindowOverride)
      const output =
        field === 'maxOutputTokens'
          ? value
          : (limits?.maxTokens ?? snapshot.values.maxOutputTokens)
      if (context !== undefined && output !== undefined && output >= context) {
        snapshot = {
          ...snapshot,
          error: 'Output must be smaller than the context window',
          saved: false,
        }
        publish()
        return false
      }
      return write(() => {
        const current =
          model === undefined ? undefined : snapshot.values.modelLimits?.[model]
        const nextContext =
          field === 'contextWindowOverride'
            ? value
            : (current?.contextWindow ?? snapshot.values.contextWindowOverride)
        const nextOutput =
          field === 'maxOutputTokens'
            ? value
            : (current?.maxTokens ?? snapshot.values.maxOutputTokens)
        if (
          nextContext !== undefined &&
          nextOutput !== undefined &&
          nextOutput >= nextContext
        )
          throw new Error('Output must be smaller than the context window')
        return [
          value === undefined
            ? { op: 'unset', path: pathFor(field, model) }
            : { op: 'set', path: pathFor(field, model), value },
        ]
      })
    },
    reset: (model) =>
      write(() => [
        { op: 'unset', path: pathFor('contextWindowOverride', model) },
        { op: 'unset', path: pathFor('maxOutputTokens', model) },
      ]),
  }
  const quota: QoderQuotaSettingsFace = {
    getSnapshot: () => snapshot,
    subscribe,
    refresh,
    set: (value) =>
      write(() => [{ op: 'set', path: [SHOW_SIDEBAR_QUOTA_FIELD], value }]),
  }
  void refresh()
  return { capacity, quota }
}
export function createQuotaSettingsFace(
  resolve: () => SettingsWriteRemote | undefined,
): QoderQuotaSettingsFace {
  return createSettingsFaces(resolve).quota
}

/** Field-specific source and selected context, including inherited model limits. */
export function modelOverrideInfo(
  state: CapacitySettingsSnapshot,
  id: string,
  contextWindows: number[],
) {
  const own = (state.ownValues ?? state.values).modelLimits?.[id]
  const effective = state.values.modelLimits?.[id]
  const source = (field: 'contextWindow' | 'maxTokens') =>
    own?.[field] !== undefined
      ? 'modelSource'
      : effective?.[field] !== undefined
        ? 'inheritedModelSource'
        : state.values[
              field === 'contextWindow'
                ? 'contextWindowOverride'
                : 'maxOutputTokens'
            ] !== undefined
          ? 'providerSource'
          : 'catalogSource'
  const chosenContext =
    effective?.contextWindow ?? state.values.contextWindowOverride
  return {
    chosenContext,
    contextSource: source('contextWindow'),
    outputSource: source('maxTokens'),
    unsupported:
      chosenContext !== undefined && !contextWindows.includes(chosenContext),
  }
}
