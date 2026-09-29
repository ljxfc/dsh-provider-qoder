/** Browser half of dsh-provider-qoder: a PAT card in the dsh 0.1.7 Models page. */

import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import { QoderProviderCard, type QoderCredentialFace, type QoderCredentialSnapshot } from './card.tsx'

const SETTINGS_NS = 'llm-qoder'
const PROVIDER = 'qoder-cn'
const DEFAULT_REF = 'QODERCN_PERSONAL_ACCESS_TOKEN'

type RemoteResult<T> = { ok: true; value: T } | { ok: false; error?: { message?: string } }

interface CredentialsRemote {
  describe(refs: string[]): Promise<RemoteResult<Record<string, { configured?: boolean; writable?: boolean }>>>
  set(ref: string, value: string): Promise<RemoteResult<void>>
}

interface SettingsRemote {
  describe(): Promise<RemoteResult<{ namespaces?: Array<{ ns?: unknown; value?: unknown }> }>>
}

function recordOf(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined
}

function stringAt(value: unknown, key: string): string | undefined {
  const record = recordOf(value)
  const candidate = record?.[key]
  return typeof candidate === 'string' && candidate.trim().length > 0 ? candidate.trim() : undefined
}

async function apiKeyRef(settings: SettingsRemote | undefined): Promise<string> {
  if (settings === undefined) return DEFAULT_REF
  try {
    const response = await settings.describe()
    if (!response.ok) return DEFAULT_REF
    const namespace = response.value.namespaces?.find((entry) => entry.ns === SETTINGS_NS)
    const root = namespace?.value
    const providers = recordOf(recordOf(root)?.providers)
    return stringAt(providers?.[PROVIDER], 'apiKeyEnv')
      ?? stringAt(root, 'apiKeyEnv')
      ?? DEFAULT_REF
  } catch {
    return DEFAULT_REF
  }
}

function createCredentialFace(
  credentials: CredentialsRemote,
  settings: () => SettingsRemote | undefined,
): QoderCredentialFace {
  let snapshot: QoderCredentialSnapshot = {
    ref: DEFAULT_REF,
    configured: false,
    writable: true,
    loading: true,
  }
  const listeners = new Set<() => void>()
  const publish = (): void => { for (const listener of listeners) listener() }
  const refresh = async (): Promise<void> => {
    const ref = await apiKeyRef(settings())
    try {
      const response = await credentials.describe([ref])
      if (response.ok) {
        const state = response.value[ref]
        snapshot = {
          ref,
          configured: state?.configured === true,
          writable: state?.writable !== false,
          loading: false,
        }
      } else {
        snapshot = {
          ref,
          configured: false,
          writable: true,
          loading: false,
          error: response.error?.message ?? 'credential status unavailable',
        }
      }
    } catch (error) {
      snapshot = {
        ref,
        configured: false,
        writable: true,
        loading: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
    publish()
  }
  void refresh()
  return {
    getSnapshot: () => snapshot,
    subscribe: (listener) => { listeners.add(listener); return () => listeners.delete(listener) },
    refresh,
    set: async (value) => {
      const ref = await apiKeyRef(settings())
      let response: RemoteResult<void>
      try {
        response = await credentials.set(ref, value)
      } catch {
        await refresh()
        return false
      }
      await refresh()
      return response.ok && snapshot.configured
    },
  }
}

const locale = {
  zh: {
    title: 'Qoder CN', configured: 'PAT 已配置', notConfigured: '尚未配置 PAT', patLabel: 'Qoder PAT',
    patHint: '粘贴 pt-... Personal Access Token。密钥会写入 DSH 凭据服务。', save: '保存', saving: '保存中…',
    loading: '读取中…', readOnly: '当前 profile 的凭据不可写。', saveFailed: 'PAT 写入失败，请重试。',
  },
  en: {
    title: 'Qoder CN', configured: 'PAT configured', notConfigured: 'PAT not configured', patLabel: 'Qoder PAT',
    patHint: 'Paste a pt-... Personal Access Token. It is stored in the DSH credentials service.', save: 'Save', saving: 'Saving…',
    loading: 'Loading…', readOnly: 'Credentials are read-only in this profile.', saveFailed: 'The PAT could not be stored. Try again.',
  },
}

export function apply(ctx: Context): void {
  ctx.effect(() => ctx.locale.register('settings.qoder', locale))
  ctx.inject(['remote.credentials'], (credentialsCtx) => {
    const credentials = (credentialsCtx.remote as unknown as { credentials: CredentialsRemote }).credentials
    let settings: SettingsRemote | undefined
    const face = createCredentialFace(credentials, () => settings)
    ctx.inject(['remote.settings'], (settingsCtx) => {
      settings = (settingsCtx.remote as unknown as { settings: SettingsRemote }).settings
      void face.refresh()
      settingsCtx.effect(() => () => { settings = undefined })
    })
    ctx.slots.inject('settings.models.provider-card', () => ctx.slots.register({
      name: 'settings.models.provider-card',
      key: SETTINGS_NS,
      locale: 'settings.qoder',
      inject: () => ({ credential: face }),
    }, QoderProviderCard))
  })
}

export const inject: readonly string[] = ['slots', 'locale', 'remote']
