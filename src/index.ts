/**
 * Register a {@link QoderAdapter} for the `qoder-cn` provider route on
 * `ctx.llm`. Connection facts resolve per request instead of freezing at load:
 * the plugin layers its `cordis.yml` entry config under the optional
 * `llm-qoder` user-settings section (`ctx.settings`) and resolves the Qoder CN
 * PAT through the optional credential seam (`ctx.credentials`), so a changed
 * endpoint, VPC instance, or key reaches the very next request without
 * restarting anything, while an in-flight stream keeps the facts it started
 * with.
 * @module dsh-provider-qoder
 */

import type { Context, Volatile } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { assertUsableApiKey, LlmError, resolveRetryPolicy, RetryPolicySchema } from '@deepseek-ai/dsh-llm'
import type { RetryPolicyConfig } from '@deepseek-ai/dsh-llm'
import { credentialRef } from '@deepseek-ai/dsh-credentials'
import { launchEnvironmentOf, type LaunchEnvironmentSnapshot } from '@deepseek-ai/dsh-launch-environment'
import type {} from '@deepseek-ai/dsh-settings'
import { MAX_TIMER_DELAY_MS } from '@deepseek-ai/dsh-timeout'
import { deepEqualJson } from '@deepseek-ai/dsh-util-values'
import { dshHomePath } from '@deepseek-ai/dsh-home-paths'
import {
  DEFAULT_CONTEXT_WINDOW,
  DEFAULT_MAX_TOKENS,
  DEFAULT_STREAM_IDLE_TIMEOUT_MS,
  QoderAdapter,
} from './adapter.ts'
import type { QoderCatalogModel, QoderConnectionOptions } from './adapter.ts'
import { getMachineId, isQoderPatValue, parseVpcInstanceFromEnvironment, qoderCnEndpoints } from './cosy.ts'
import { applyUsageRemote } from './usage-remote.ts'
import type { QoderLang } from './annotate.ts'

export {
  DEFAULT_CONTEXT_WINDOW,
  DEFAULT_MAX_TOKENS,
  DEFAULT_STREAM_IDLE_TIMEOUT_MS,
  parseQoderModelCatalog,
  QoderAdapter,
} from './adapter.ts'
export type { QoderAdapterOptions, QoderCatalogModel, QoderConnectionOptions } from './adapter.ts'
export { qoderEncodeBody } from './qoder-encoding.ts'
export { serializeMessages, serializeRequest, systemTextOf } from './serialize.ts'
export type { QoderMessage, QoderSerializedRequest } from './serialize.ts'
export { mapFinishReason, mapUsage } from './translate.ts'
export { parseQoderSse, parseEnvelope, DONE } from './sse.ts'
export {
  buildQoderAuthHeaders,
  getQoderCNDirectModel,
  getQoderCNFriendlyModelInfo,
  qoderCnEndpoints,
} from './cosy.ts'
export { exchangeJobToken, refreshJobToken, fetchUserInfo } from './pat.ts'
export { fetchQoderQuota, parseQuotaPool, QUOTA_TIMEOUT_MS } from './usage.ts'
export type { QoderQuotaPool, QoderUsageReport } from './usage.ts'
export { parseQuotaSnapshot, QUOTA_ENDPOINT } from './usage-wire.ts'
export type { QuotaPoolWire, QuotaSnapshotWire } from './usage-wire.ts'
export {
  compareModelsForSelector,
  formatContextWindow,
  formatPriceFactor,
  localizedText,
  modelAnnotationParts,
  modelDescription,
  modelSelectorLabel,
  parsePromotion,
} from './annotate.ts'
export type { AnnotatableModel, QoderLang, QoderLocalizedText, QoderModelPromotion } from './annotate.ts'

export const name = 'llm-qoder'
export const inject = ['llm']

const NS = 'llm-qoder'
const DEFAULT_API_KEY_ENV = 'QODERCN_PERSONAL_ACCESS_TOKEN'
/** The single provider route this plugin owns. */
const PROVIDER = 'qoder-cn'
/** The label 设置 → 模型 shows for that route. */
const DISPLAY_NAME = 'Qoder CN'

/**
 * One stored provider profile. The profile fields stay plain because the
 * parent `providers` dictionary is the volatile settings boundary in the
 * dsh-v0.1.7 contract.
 */
export interface QoderProviderProfile {
  /** Credential reference resolved per request; defaults to `QODERCN_PERSONAL_ACCESS_TOKEN`. */
  apiKeyEnv?: string
  /** Enterprise VPC tenant instance (`<instance>.vpc.qoder.com.cn`); absent selects the public cloud. */
  vpcInstance?: string
  /** Gateway origin override (`https://gateway.qoder.com.cn` default, or VPC-derived). */
  baseURL?: string
  /** OpenAPI origin override (`https://openapi.qoder.com.cn` default, or VPC-derived). */
  openApiUrl?: string
  /** Default per-request output cap (default 32,768); a model's own cap and explicit request values win. */
  maxTokens?: number
  /** Positive context capacity used when the selected model has no exact value (default 1,000,000). */
  defaultContextWindow?: number
  /** Optional complete static catalog override; absence discovers Qoder's live catalog. */
  models?: QoderCatalogModel[]
  /** Maximum provider idle time while one stream read is outstanding (default five minutes). */
  streamIdleTimeoutMs?: number
  /** Provider-owned model-request retry policy; omission uses normal defaults. */
  retryPolicy?: RetryPolicyConfig
}

/**
 * Resolved plugin configuration in dsh-v0.1.7: editable fields are volatile
 * references, so the running plugin can observe Models-page writes without a
 * remount. The plain values are read through {@link plainConfig} below.
 */
export interface Config {
  apiKeyEnv: Volatile<string>
  vpcInstance: Volatile<string | undefined>
  baseURL: Volatile<string | undefined>
  openApiUrl: Volatile<string | undefined>
  maxTokens: Volatile<number>
  defaultContextWindow: Volatile<number>
  models: Volatile<QoderCatalogModel[] | undefined>
  streamIdleTimeoutMs: Volatile<number>
  retryPolicy: Volatile<RetryPolicyConfig | undefined>
  /**
   * Whether the Web sidebar shows the plans & quota card
   * (`sidebar.footer.action`). Defaults to false, so an unset document mounts
   * no sidebar quota surface and starts no background usage poll for it; the
   * `main`-slot panel behind it stays registered. Read by the browser client;
   * the adapter ignores it.
   */
  showSidebarQuota: Volatile<boolean>
  /**
   * Hand-maintained `{ modelId: planTierName }` map feeding the model
   * selector's minimum-plan annotation, plus `annotationLanguage`'s sibling
   * for the annotation copy. Qoder CN reports no per-model tier anywhere, so
   * this map — not a hard-coded guess — is the only truthful source for that
   * one label and an unmapped model simply carries none.
   */
  modelPlans: Volatile<Record<string, string>>
  /** Annotation language for the picker's generated description (`zh` | `en`). */
  annotationLanguage: Volatile<QoderLang | undefined>
  /** User-added `qoder-cn` profile; absence keeps the route in Add provider. */
  providers: Volatile<Record<string, QoderProviderProfile>>
}

/** Plain form accepted by the resolver and by tests outside a Loader runtime. */
export interface QoderConfigValues extends QoderProviderProfile {
  providers?: Record<string, QoderProviderProfile>
  /** `{ modelId: planTierName }` feeding the selector's plan annotation. */
  modelPlans?: Record<string, string>
  /** Annotation copy language (`zh` | `en`). */
  annotationLanguage?: QoderLang
}

const catalogModel: z<QoderCatalogModel> = z.object({
  id: z.string().required(),
  name: z.string(),
  description: z.string(),
  contextWindow: z.number().step(1).min(1),
  maxTokens: z.number().step(1).min(1),
  inputModalities: z.array(z.union(['text', 'image'])),
  reasoning: z.boolean(),
})

const connectionFields = {
  apiKeyEnv: z.string().role('credential-ref').default(DEFAULT_API_KEY_ENV),
  vpcInstance: z.string(),
  baseURL: z.string(),
  openApiUrl: z.string(),
  maxTokens: z.number().step(1).min(1).max(Number.MAX_SAFE_INTEGER).default(DEFAULT_MAX_TOKENS),
  defaultContextWindow: z.number().step(1).min(1).default(DEFAULT_CONTEXT_WINDOW),
  // Schemastery arrays otherwise materialize [], which would disable live discovery.
  models: z.array(catalogModel).default(undefined as never),
  streamIdleTimeoutMs: z.number().min(Number.MIN_VALUE).max(MAX_TIMER_DELAY_MS).default(DEFAULT_STREAM_IDLE_TIMEOUT_MS),
  retryPolicy: RetryPolicySchema,
  // Qoder CN reports no per-model plan tier, so the selector's plan label is a
  // hand-maintained map; an unmapped model carries no label rather than a guess.
  modelPlans: z.dict(z.string()).default({}),
  annotationLanguage: z.union(['zh', 'en']),
}

/** Root fields are individually editable in the generic settings form. */
const volatileConnectionFields = {
  apiKeyEnv: z.string().role('credential-ref').default(DEFAULT_API_KEY_ENV).volatile(),
  vpcInstance: z.string().volatile(),
  baseURL: z.string().volatile(),
  openApiUrl: z.string().volatile(),
  maxTokens: z.number().step(1).min(1).max(Number.MAX_SAFE_INTEGER).default(DEFAULT_MAX_TOKENS).volatile(),
  defaultContextWindow: z.number().step(1).min(1).default(DEFAULT_CONTEXT_WINDOW).volatile(),
  // Keep an omitted catalog distinguishable from an empty catalog so live
  // discovery remains the default.
  models: z.array(catalogModel).default(undefined as never).volatile(),
  streamIdleTimeoutMs: z.number().min(Number.MIN_VALUE).max(MAX_TIMER_DELAY_MS).default(DEFAULT_STREAM_IDLE_TIMEOUT_MS).volatile(),
  retryPolicy: RetryPolicySchema.volatile(),
  showSidebarQuota: z.boolean().default(false).volatile(),
  modelPlans: z.dict(z.string()).default({}).volatile(),
  annotationLanguage: z.union(['zh', 'en']).volatile(),
}

export const Config: z<Config> = z.object({
  ...volatileConnectionFields,
  providers: z.dict(z.object(connectionFields)).default({}).volatile(),
})

/** Public gateway origin; used when no override and no VPC instance are configured. */
export const PUBLIC_GATEWAY_URL = 'https://gateway.qoder.com.cn'

/** Resolve, validate, and detach an optional static model-catalog override. */
function resolveModels(
  models: readonly QoderCatalogModel[] | undefined,
): QoderCatalogModel[] | undefined {
  if (models === undefined) return undefined
  const seen = new Set<string>()
  return models.map((model) => {
    if (model.id.length === 0) throw new Error('llm-qoder: catalog model ids must be non-empty')
    if (model.name !== undefined && model.name.length === 0) {
      throw new Error(`llm-qoder: catalog model "${model.id}" has an empty name`)
    }
    if (model.contextWindow !== undefined
      && (!Number.isInteger(model.contextWindow) || model.contextWindow <= 0)) {
      throw new Error(
        `llm-qoder: catalog model "${model.id}" contextWindow must be a positive integer`,
      )
    }
    if (model.maxTokens !== undefined
      && (!Number.isInteger(model.maxTokens) || model.maxTokens <= 0)) {
      throw new Error(
        `llm-qoder: catalog model "${model.id}" maxTokens must be a positive integer`,
      )
    }
    if (seen.has(model.id)) throw new Error(`llm-qoder: duplicate catalog model "${model.id}"`)
    seen.add(model.id)
    return {
      id: model.id,
      ...model.name === undefined ? {} : { name: model.name },
      ...model.description === undefined ? {} : { description: model.description },
      ...model.contextWindow === undefined ? {} : { contextWindow: model.contextWindow },
      ...model.maxTokens === undefined ? {} : { maxTokens: model.maxTokens },
      ...model.inputModalities === undefined ? {} : { inputModalities: [...model.inputModalities] },
      ...model.reasoning === undefined ? {} : { reasoning: model.reasoning },
    }
  })
}

/** One resolution's complete request facts. */
export type ResolvedQoderOptions = QoderConnectionOptions

/** Read either a Loader-owned volatile reference or a plain test value. */
function readConfigValue<T>(value: T | Volatile<T> | undefined): T | undefined {
  if (value !== null && typeof value === 'object') {
    const candidate = value as { get?: unknown }
    if (typeof candidate.get === 'function') return (candidate.get as () => T)()
  }
  return value as T | undefined
}

/** Detach one immutable plain snapshot from the live Config references. */
function plainConfig(config: Config | QoderConfigValues): QoderConfigValues {
  return {
    apiKeyEnv: readConfigValue(config.apiKeyEnv),
    vpcInstance: readConfigValue(config.vpcInstance),
    baseURL: readConfigValue(config.baseURL),
    openApiUrl: readConfigValue(config.openApiUrl),
    maxTokens: readConfigValue(config.maxTokens),
    defaultContextWindow: readConfigValue(config.defaultContextWindow),
    models: readConfigValue(config.models),
    streamIdleTimeoutMs: readConfigValue(config.streamIdleTimeoutMs),
    retryPolicy: readConfigValue(config.retryPolicy),
    modelPlans: readConfigValue(config.modelPlans),
    annotationLanguage: readConfigValue(config.annotationLanguage),
    providers: readConfigValue(config.providers),
  }
}

/**
 * The one explicit resolve step from raw config to validated connection
 * facts. Endpoint overrides and the VPC instance resolve from configuration
 * first, then the trusted environment layers, then the public CN cloud.
 * @param config - raw plugin config or resolved settings snapshot.
 * @param environment - this run's environment layers, or `undefined` outside
 *   the product CLI.
 * @returns validated connection facts plus the credential reference.
 */
export function resolveAdapterOptions(
  config: Config | QoderConfigValues,
  environment?: LaunchEnvironmentSnapshot,
): ResolvedQoderOptions {
  let values = plainConfig(config)
  const profile = values.providers?.[PROVIDER]
  if (profile !== undefined) {
    values = { ...values, ...profile }
  }
  if (values.defaultContextWindow !== undefined
    && (!Number.isInteger(values.defaultContextWindow) || values.defaultContextWindow <= 0)) {
    throw new Error('llm-qoder: defaultContextWindow must be a positive integer')
  }
  if (values.maxTokens !== undefined
    && (!Number.isSafeInteger(values.maxTokens) || values.maxTokens <= 0)) {
    throw new Error('llm-qoder: maxTokens must be a positive safe integer')
  }
  const streamIdleTimeoutMs = values.streamIdleTimeoutMs ?? DEFAULT_STREAM_IDLE_TIMEOUT_MS
  if (!Number.isFinite(streamIdleTimeoutMs)
    || streamIdleTimeoutMs <= 0
    || streamIdleTimeoutMs > MAX_TIMER_DELAY_MS) {
    throw new Error(
      `llm-qoder: streamIdleTimeoutMs must be a positive finite number no greater than ${MAX_TIMER_DELAY_MS}`,
    )
  }

  const get = (name: string): { value: string } | undefined => environment?.get(name)
  const vpcInstance = values.vpcInstance
    ?? parseVpcInstanceFromEnvironment(get)
  const endpoints = qoderCnEndpoints(vpcInstance)
  const finalEndpoints = {
    gateway: values.baseURL?.replace(/\/+$/, '') ?? endpoints.gateway,
    openapi: values.openApiUrl?.replace(/\/+$/, '') ?? endpoints.openapi,
    manage: endpoints.manage,
  }

  return {
    endpoints: finalEndpoints,
    apiKeyEnv: credentialRef(values.apiKeyEnv ?? DEFAULT_API_KEY_ENV),
    maxTokens: values.maxTokens ?? DEFAULT_MAX_TOKENS,
    defaultContextWindow: values.defaultContextWindow ?? DEFAULT_CONTEXT_WINDOW,
    models: resolveModels(values.models),
    streamIdleTimeoutMs,
    retryPolicy: resolveRetryPolicy(values.retryPolicy, 'llm-qoder: retryPolicy'),
    machineId: getMachineId(dshHomePath()),
    annotationLanguage: values.annotationLanguage,
    annotationPlans: values.modelPlans,
  }
}

export function apply(ctx: Context, config: Config): void {
  let lastRaw: QoderConfigValues | undefined
  let lastGood: ResolvedQoderOptions | undefined
  const options = (): ResolvedQoderOptions => {
    const raw = plainConfig(config)
    if (lastGood !== undefined && lastRaw !== undefined && deepEqualJson(raw, lastRaw)) return lastGood
    try {
      const next = resolveAdapterOptions(raw, launchEnvironmentOf(ctx))
      lastRaw = raw
      lastGood = next
      return next
    } catch (error) {
      // Static composition resolves before anything registers, so this branch
      // only sees a live settings snapshot failing a beyond-schema bound:
      // keep serving the last good facts and say so once per bad snapshot.
      if (lastGood === undefined) throw error
      lastRaw = raw
      ctx.logger.error('llm-qoder: keeping the last good configuration after an invalid settings update')
      ctx.logger.error(error)
      return lastGood
    }
  }
  options()

  // dsh-v0.1.7 exposes Qoder's provider editor through Models. Do not also
  // generate a generic Settings page for the same entry.
  ctx.logger.info(`llm-qoder: apply() reached the settings handshake (provider route "${PROVIDER}")`)
  ctx.inject(['settings'], (child) => {
    child.effect(() => child.settings.configure({ auto: false }, ctx.fiber))
  })

  const resolveApiKey = async (connection: ResolvedQoderOptions): Promise<string> => {
    const ref = connection.apiKeyEnv
    const credentials = ctx.get('credentials')
    if (credentials !== undefined) {
      const hit = await credentials.resolve(ref)
      if (hit !== undefined) return assertUsableApiKey(hit.value, 'llm-qoder', ref)
    }
    // Desktop v0.1.7 mounts the credentials service even when no Qoder
    // credential has been stored yet. Keep the documented environment route
    // usable in that composition instead of treating an absent credential
    // record as a terminal miss.
    const ambient = launchEnvironmentOf(ctx).get(ref)
    if (ambient !== undefined && ambient.value.length > 0) {
      return assertUsableApiKey(ambient.value, 'llm-qoder', ref)
    }
    // QODERCN_PAT is an accepted alias. QODER_API_KEY is accepted only when
    // its value is a PAT (`pt-...`), never an opaque job token or other key.
    const patAlias = launchEnvironmentOf(ctx).get('QODERCN_PAT')
    if (patAlias !== undefined && patAlias.value.length > 0) {
      return assertUsableApiKey(patAlias.value, 'llm-qoder', ref)
    }
    const apiKeyAlias = launchEnvironmentOf(ctx).get('QODER_API_KEY')
    if (apiKeyAlias !== undefined && isQoderPatValue(apiKeyAlias.value)) {
      return assertUsableApiKey(apiKeyAlias.value.trim(), 'llm-qoder', ref)
    }
    throw new LlmError(
      `llm-qoder: no PAT for provider route "${PROVIDER}"; store ${ref} through the credentials`
      + ` service (the web Models page writes it), or export ${ref} in the launching environment`,
      'MISSING_CREDENTIAL',
    )
  }

  const adapter = new QoderAdapter({
    options,
    resolveApiKey,
    resolveAttachments: () => ctx.get('attachments'),
  })
  // The sidebar quota card reads its facts over the Typert Gateway, because the
  // browser never holds the PAT. A profile without a Typert registry (a headless
  // client) simply never activates this fiber.
  applyUsageRemote(ctx, { adapter })
  const settingsNs = ctx.fiber.entry?.options.id ?? NS
  // Registration in the llm registry is all-or-nothing, and a refused entry
  // costs the whole Models row, so name the step that failed instead of
  // leaving a plugin that looks loaded but declares nothing.
  try {
    // The Models page renders a provider row only when the row is *configured*,
    // and a row with a non-empty settingsPath counts as configured only once the
    // settings document actually holds that path:
    //
    //   configured = namespace exists && (settingsPath is empty || path resolves)
    //
    // Qoder's route is built in, like the two DeepSeek routes, so it declares no
    // settings path: the namespace itself is the route profile, which is what keeps
    // the row in 设置 → 模型 from the first launch. The `providers.<route>` map stays
    // supported for hand-written multi-route configs.
    ctx.llm.registerConfigurableProviders([
      { provider: PROVIDER, displayName: DISPLAY_NAME, settingsNs, settingsPath: [] },
    ])
  } catch (error) {
    ctx.logger.error(`llm-qoder: the provider directory refused route "${PROVIDER}" (ns "${settingsNs}")`)
    ctx.logger.error(error)
    throw error
  }
  ctx.logger.info(`llm-qoder: declared route "${PROVIDER}" through settings namespace "${settingsNs}"`)
  const registration = ctx.llm.registerAdapter([PROVIDER], adapter)
  ctx.logger.info(`llm-qoder: adapter registered for route "${PROVIDER}"`)
  let registeredPolicy = options().retryPolicy
  const ensureRegistrationFacts = (): void => {
    const policy = options().retryPolicy
    if (deepEqualJson(policy, registeredPolicy)) return
    registration.replace([PROVIDER])
    registeredPolicy = policy
  }

  // Volatile settings are committed into the same Config references. The
  // adapter reads those references on the next operation; only the registry's
  // captured retry policy needs an explicit atomic replacement.
  ctx.on('loader/volatile-update', () => {
    try {
      ensureRegistrationFacts()
    } catch (error) {
      ctx.logger.error('llm-qoder: keeping the last good configuration after an invalid settings update')
      ctx.logger.error(error)
    }
  })
}
