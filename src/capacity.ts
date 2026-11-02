/** Shared explicit capacity policy. Unset fields retain legacy defaults. */
export interface ModelLimit { contextWindow?: number; maxTokens?: number }
export interface CapacitySettings {
  contextWindowOverride?: number
  maxOutputTokens?: number
  modelLimits?: Record<string, ModelLimit>
}
export interface CapacityModel { id: string; contextWindow?: number; maxTokens?: number }
export function assertCapacity(value: unknown, field: string): asserts value is number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`llm-qoder: ${field} must be a positive safe integer`)
  }
}
export function validateCapacitySettings(settings: CapacitySettings): CapacitySettings {
  for (const key of ['contextWindowOverride', 'maxOutputTokens'] as const) {
    if (settings[key] !== undefined) assertCapacity(settings[key], key)
    if (key === 'contextWindowOverride' && settings[key] === 1) throw new Error('llm-qoder: contextWindowOverride must leave room for input and output')
  }
  const modelLimits: Record<string, ModelLimit> = Object.create(null)
  if (settings.modelLimits !== undefined && (typeof settings.modelLimits !== 'object' || settings.modelLimits === null || Array.isArray(settings.modelLimits))) throw new Error('llm-qoder: modelLimits must be an object')
  for (const [id, limit] of Object.entries(settings.modelLimits ?? {})) {
    if (!id.trim() || limit === null || typeof limit !== 'object' || Array.isArray(limit)) throw new Error('llm-qoder: invalid modelLimits entry')
    for (const key of ['contextWindow', 'maxTokens'] as const) if (limit[key] !== undefined) assertCapacity(limit[key], `modelLimits.${id}.${key}`)
    if (limit.contextWindow === 1) throw new Error(`llm-qoder: modelLimits.${id}.contextWindow must leave room for input and output`)
    modelLimits[id] = { ...limit }
  }
  return { contextWindowOverride: settings.contextWindowOverride, maxOutputTokens: settings.maxOutputTokens, ...(settings.modelLimits === undefined ? {} : { modelLimits }) }
}
export function resolveCapacity(
  settings: CapacitySettings & { defaultContextWindow: number; maxTokens: number },
  model: CapacityModel,
  known?: CapacityModel,
  requestMaxTokens?: number,
): { contextWindow: number; maxTokens: number } {
  const limit = settings.modelLimits?.[model.id]
  const contextWindow = limit?.contextWindow ?? settings.contextWindowOverride ?? model.contextWindow ?? known?.contextWindow ?? settings.defaultContextWindow
  const explicitOutput = limit?.maxTokens ?? settings.maxOutputTokens
  let maxTokens = requestMaxTokens ?? explicitOutput ?? model.maxTokens ?? settings.maxTokens
  assertCapacity(contextWindow, 'contextWindow')
  assertCapacity(maxTokens, 'maxTokens')
  if (contextWindow < 2) throw new Error('llm-qoder: contextWindow must leave room for input and output (at least 2 tokens)')
  // Legacy automatic values remain unchanged; explicit settings/requests obey hard caps.
  if (requestMaxTokens !== undefined || explicitOutput !== undefined || limit?.contextWindow !== undefined || settings.contextWindowOverride !== undefined) {
    maxTokens = Math.min(maxTokens, model.maxTokens ?? known?.maxTokens ?? Number.MAX_SAFE_INTEGER, contextWindow - 1)
  }
  return { contextWindow, maxTokens }
}

/** CLI 1.1.64 ub(): supported explicit windows become parameters.context_length. */
export function selectedGatewayContext(settings: CapacitySettings, model: CapacityModel & { contextWindows?: number[] }): number | undefined {
  const selected = settings.modelLimits?.[model.id]?.contextWindow ?? settings.contextWindowOverride
  if (selected === undefined) return undefined
  assertCapacity(selected, 'contextWindow')
  // Require an advertised tier: max_input_tokens alone is not proof of selectable tiers.
  return model.contextWindows?.includes(selected) ? selected : undefined
}

/** Layer only defined model fields; resetting a profile field restores root inheritance. */
export function mergeModelLimits(
  root?: Record<string, ModelLimit>,
  profile?: Record<string, ModelLimit>,
): Record<string, ModelLimit> | undefined {
  if (root === undefined && profile === undefined) return undefined
  const lower = validateCapacitySettings({ modelLimits: root }).modelLimits ?? {}
  const upper = validateCapacitySettings({ modelLimits: profile }).modelLimits ?? {}
  return Object.fromEntries([...new Set([...Object.keys(lower), ...Object.keys(upper)])].map(id => {
    const contextWindow = upper[id]?.contextWindow ?? lower[id]?.contextWindow
    const maxTokens = upper[id]?.maxTokens ?? lower[id]?.maxTokens
    return [id, {
      ...(contextWindow === undefined ? {} : { contextWindow }),
      ...(maxTokens === undefined ? {} : { maxTokens }),
    }]
  }))
}
