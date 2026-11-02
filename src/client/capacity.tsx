import * as React from 'react'
import { useEffect, useState } from 'react'
import { modelOverrideInfo } from './settings.ts'
import type {
  CapacitySettingsFace,
  CapacitySettingsSnapshot,
} from './settings.ts'
export interface ModelCapacity {
  id: string
  name: string
  contextWindow?: number
  maxTokens?: number
  contextWindows: number[]
  effectiveContextWindow: number
  effectiveMaxTokens: number
}
export interface ModelsRemote {
  models(): Promise<
    | { ok: true; value: ModelCapacity[] }
    | { ok: false; error?: { message?: string } }
  >
}
export interface ModelsSnapshot {
  loading: boolean
  models: ModelCapacity[]
  error?: string
}
export interface ModelsFace {
  getSnapshot(): ModelsSnapshot
  subscribe(fn: () => void): () => void
  refresh(): Promise<void>
}
export function createModelsFace(
  resolve: () => ModelsRemote | undefined,
): ModelsFace {
  let snapshot: ModelsSnapshot = { loading: false, models: [] }
  let generation = 0
  const listeners = new Set<() => void>()
  const publish = () => {
    for (const listener of listeners) listener()
  }
  return {
    getSnapshot: () => snapshot,
    subscribe: (fn) => {
      listeners.add(fn)
      return () => {
        listeners.delete(fn)
      }
    },
    refresh: async () => {
      const ticket = ++generation
      snapshot = { ...snapshot, loading: true }
      publish()
      try {
        const remote = resolve()
        if (!remote) throw new Error('Model catalog unavailable')
        const result = await remote.models()
        if (!result.ok)
          throw new Error(result.error?.message ?? 'Model catalog read failed')
        if (ticket === generation)
          snapshot = { loading: false, models: result.value }
      } catch (error) {
        if (ticket === generation)
          snapshot = {
            ...snapshot,
            loading: false,
            error: error instanceof Error ? error.message : String(error),
          }
      }
      if (ticket === generation) publish()
    },
  }
}
export const CAPACITY_EN = {
  capacity: 'Model capacity',
  defaults: 'Provider defaults',
  context: 'Context window',
  output: 'Maximum output',
  auto: 'Automatic / inherit',
  custom: 'Custom',
  reset: 'Restore automatic',
  saved:
    'Saved and read back from Host. Automatic inherits any parent override.',
  capacityHint:
    'Context controls conversation history. Output limits one response. K = 1,000; M = 1,000,000.',
  layer: 'Settings layer',
  models: 'Per-model overrides',
  effective: 'Effective context / output',
  server: 'Catalog context / output',
  tiers: 'Available context tiers',
  unsupported:
    'Local budget override: this value is not a declared server tier. Saving does not expand server capacity.',
  supported:
    'Advertised tiers are negotiated with Qoder; other values change the local budget only.',
  source: 'Override source',
  providerSource: 'Provider default',
  modelSource: 'This model',
  inheritedModelSource: 'Inherited model override',
  catalogSource: 'Automatic / catalog',
  unknown: 'Unknown',
  capacityReadOnly: 'Settings are unavailable or read-only.',
  retry: 'Retry',
  readFailed: 'Read failed',
  changePat: 'Replace PAT',
  credentialHint:
    'Configured indicates stored credentials; connection has not been verified.',
  quota: 'Quota overview',
  refresh: 'Refresh',
  details: 'View details',
  used: 'Used / total',
  period: 'Billing period',
  updated: 'Last successful update',
  noQuota: 'Refresh to load account quota.',
  stale: 'Last successful data; refresh failed.',
}
export const CAPACITY_ZH: Record<keyof typeof CAPACITY_EN, string> = {
  capacity: '模型与容量',
  defaults: '提供商默认设置',
  context: '上下文窗口',
  output: '最大输出',
  auto: '自动 / 继承上层',
  custom: '自定义',
  reset: '恢复自动',
  saved: '已保存，并从 Host 重新读取。自动模式会继承上层已有覆盖。',
  capacityHint:
    '上下文控制对话历史预算，输出限制单次回答。K = 1,000；M = 1,000,000。',
  layer: '生效配置层',
  models: '按模型覆盖',
  effective: '有效上下文 / 输出',
  server: '目录上下文 / 输出',
  tiers: '目录支持的上下文档位',
  unsupported:
    '本地预算覆盖：此值不是目录声明的服务端档位。保存不会扩大服务端容量。',
  supported: '目录声明的档位会与 Qoder 协商；其他数值仅修改本地预算。',
  source: '覆盖来源',
  providerSource: '提供商默认',
  modelSource: '当前模型',
  inheritedModelSource: '继承上层模型覆盖',
  catalogSource: '自动 / 模型目录',
  unknown: '未知',
  capacityReadOnly: '设置暂不可用或当前配置只读。',
  retry: '重试',
  readFailed: '读取失败',
  changePat: '更换 PAT',
  credentialHint: '已配置表示凭据已存储，不代表连接验证成功。',
  quota: '额度概览',
  refresh: '刷新',
  details: '查看详情',
  used: '已用 / 总额',
  period: '账期',
  updated: '上次成功更新',
  noQuota: '点击刷新读取账户额度。',
  stale: '当前显示上次成功数据；本次刷新失败。',
}
const CONTEXT = [128000, 200000, 256000, 500000, 1000000]
const OUTPUT = [8192, 16384, 32768, 65536, 131072]
export function CapacityInput({
  label,
  value,
  output,
  disabled,
  t,
  onSave,
}: {
  label: string
  value?: number
  output?: boolean
  disabled: boolean
  t: (key: string) => string
  onSave(value?: number): Promise<boolean>
}): React.ReactElement {
  const presets = output ? OUTPUT : CONTEXT
  const [mode, setMode] = useState(
    value === undefined
      ? 'auto'
      : presets.includes(value)
        ? String(value)
        : 'custom',
  )
  const [draft, setDraft] = useState(value === undefined ? '' : String(value))
  useEffect(() => {
    setMode(
      value === undefined
        ? 'auto'
        : presets.includes(value)
          ? String(value)
          : 'custom',
    )
    setDraft(value === undefined ? '' : String(value))
  }, [value])
  const valid =
    /^\d+$/.test(draft) &&
    Number.isSafeInteger(Number(draft)) &&
    Number(draft) > 0
  return (
    <div className="qoder-capacity-input">
      <label>
        <span>{label}</span>
        <select
          aria-label={label}
          value={mode}
          disabled={disabled}
          onChange={(event) => {
            const next = event.target.value
            setMode(next)
            if (next !== 'custom')
              void onSave(next === 'auto' ? undefined : Number(next)).then(
                (ok) => {
                  if (!ok)
                    setMode(
                      value === undefined
                        ? 'auto'
                        : presets.includes(value)
                          ? String(value)
                          : 'custom',
                    )
                },
              )
          }}
        >
          <option value="auto">{t('auto')}</option>
          {presets.map((number) => (
            <option key={number} value={number}>
              {output
                ? number.toLocaleString('en-US')
                : number === 1000000
                  ? '1M · 1,000,000'
                  : `${number / 1000}K · ${number.toLocaleString('en-US')}`}
            </option>
          ))}
          <option value="custom">{t('custom')}</option>
        </select>
      </label>
      {mode === 'custom' ? (
        <div className="qoder-inline">
          <input
            aria-label={`${label} · ${t('custom')}`}
            inputMode="numeric"
            value={draft}
            disabled={disabled}
            onChange={(event) => setDraft(event.target.value)}
          />
          <button
            type="button"
            disabled={disabled || !valid}
            onClick={() => {
              void onSave(Number(draft))
            }}
          >
            {t('save')}
          </button>
        </div>
      ) : null}
      <small>
        {value === undefined
          ? t('auto')
          : `${value.toLocaleString('en-US')} tokens`}
      </small>
    </div>
  )
}
export function CapacitySection({
  face,
  catalog,
  t,
}: {
  face: CapacitySettingsFace
  catalog: ModelsFace
  t: (key: string) => string
}): React.ReactElement {
  const [state, setState] = useState<CapacitySettingsSnapshot>(() =>
    face.getSnapshot(),
  )
  const [models, setModels] = useState(() => catalog.getSnapshot())
  useEffect(() => {
    const dispose = face.subscribe(() => setState(face.getSnapshot()))
    setState(face.getSnapshot())
    return dispose
  }, [face])
  useEffect(() => {
    const dispose = catalog.subscribe(() => setModels(catalog.getSnapshot()))
    setModels(catalog.getSnapshot())
    return dispose
  }, [catalog])
  const disabled =
    state.loading || state.busy || !state.writable || state.failed
  const editor = (model?: ModelCapacity) => {
    const own = state.ownValues ?? state.values
    const override = model ? own.modelLimits?.[model.id] : undefined
    const context = model ? override?.contextWindow : own.contextWindowOverride
    const output = model ? override?.maxTokens : own.maxOutputTokens
    const info = model
      ? modelOverrideInfo(state, model.id, model.contextWindows)
      : undefined
    return (
      <>
        <div className="qoder-capacity-grid">
          <CapacityInput
            label={t('context')}
            value={context}
            disabled={disabled}
            t={t}
            onSave={(value) =>
              face
                .set('contextWindowOverride', value, model?.id)
                .then(async (ok) => {
                  if (ok) await catalog.refresh()
                  return ok
                })
            }
          />
          <CapacityInput
            label={t('output')}
            output
            value={output}
            disabled={disabled}
            t={t}
            onSave={(value) =>
              face.set('maxOutputTokens', value, model?.id).then(async (ok) => {
                if (ok) await catalog.refresh()
                return ok
              })
            }
          />
        </div>
        {model ? (
          <>
            <dl className="qoder-facts">
              <dt>{t('source')}</dt>
              <dd>
                {t(info!.contextSource)} / {t(info!.outputSource)}
              </dd>
              <dt>{t('effective')}</dt>
              <dd>
                {model.effectiveContextWindow.toLocaleString('en-US')} /{' '}
                {model.effectiveMaxTokens.toLocaleString('en-US')}
              </dd>
              <dt>{t('server')}</dt>
              <dd>
                {model.contextWindow?.toLocaleString('en-US') ?? t('unknown')} /{' '}
                {model.maxTokens?.toLocaleString('en-US') ?? t('unknown')}
              </dd>
              <dt>{t('tiers')}</dt>
              <dd>
                {model.contextWindows
                  .map((value) => value.toLocaleString('en-US'))
                  .join(' · ') || t('unknown')}
              </dd>
            </dl>
            {info?.unsupported ? (
              <p className="qoder-warning" role="status">
                {t('unsupported')}
              </p>
            ) : null}
          </>
        ) : null}
        <button
          type="button"
          className="qoder-subtle"
          disabled={disabled}
          onClick={() => {
            void face.reset(model?.id).then((ok) => {
              if (ok) void catalog.refresh()
            })
          }}
        >
          {t('reset')}
        </button>
      </>
    )
  }
  return (
    <section className="qoder-section">
      <div className="qoder-section-heading">
        <h3>{t('capacity')}</h3>
        <button
          type="button"
          disabled={state.loading || state.busy || models.loading}
          onClick={() => {
            void face.refresh()
            void catalog.refresh()
          }}
        >
          {t('refresh')}
        </button>
      </div>
      <p className="qoder-muted">{t('capacityHint')}</p>
      <small>{t('supported')}</small>
      <div className="qoder-layer">
        {t('layer')}: <code>{state.layer}</code>
      </div>
      <h4>{t('defaults')}</h4>
      {editor()}
      {state.saved ? (
        <p role="status" className="qoder-success">
          {t('saved')}
        </p>
      ) : null}
      {state.error ? (
        <p role="alert" className="qoder-warning">
          {state.error}
        </p>
      ) : null}
      {!state.writable && !state.loading ? (
        <p className="qoder-muted">{t('capacityReadOnly')}</p>
      ) : null}
      <details className="qoder-models">
        <summary>
          {t('models')} <span>{models.models.length}</span>
        </summary>
        {models.error ? <p role="alert">{models.error}</p> : null}
        {models.loading ? <p role="status">{t('loading')}</p> : null}
        {models.models.map((model) => (
          <details key={model.id} className="qoder-model">
            <summary>
              {model.name}
              <small>{model.id}</small>
            </summary>
            {editor(model)}
          </details>
        ))}
      </details>
    </section>
  )
}
