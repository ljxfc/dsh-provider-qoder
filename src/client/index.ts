/**
 * Browser half of dsh-provider-qoder.
 *
 * Three surfaces, one settings namespace:
 * - the Models-page PAT card (`settings.models.provider-card`), which also
 *   carries the `showSidebarQuota` toggle;
 * - the sidebar footer quota card (`sidebar.footer.action`);
 * - the middle-column quota panel (`main`, keyed `qoder-quota-panel`).
 */

import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import { QUOTA_REMOTE_CONTRIBUTION } from '../usage-wire.ts'
import { injectQuotaStyles } from '../quota-styles.ts'
import { QoderProviderCard, type QoderCredentialFace, type QoderCredentialSnapshot } from './card.tsx'
import { PANEL_LOCALE_NS, PANEL_TEXT_EN, PANEL_TEXT_ZH } from './copy.ts'
import { QoderQuotaFooterEntry, QoderQuotaPanel, QUOTA_PANEL_ID, type QoderQuotaInjected } from './panel.tsx'
import { createQuotaController, startQuotaAutoRefresh, type QoderQuotaNamespace } from './quota.ts'
import { createQuotaSettingsFace, SETTINGS_NS, type SettingsWriteRemote } from './settings.ts'

const PROVIDER = 'qoder-cn'
const DEFAULT_REF = 'QODERCN_PERSONAL_ACCESS_TOKEN'

type RemoteResult<T> = { ok: true; value: T } | { ok: false; error?: { message?: string } }

interface CredentialsRemote {
  describe(refs: string[]): Promise<RemoteResult<Record<string, { configured?: boolean; writable?: boolean }>>>
  set(ref: string, value: string): Promise<RemoteResult<void>>
}

/** The `layout` service's one method this plugin uses, read reflectively. */
interface LayoutSelectionSeam {
  /** `null` shows the Conversation again; a string selects that `main` key. */
  selectPanel(id: string | null): void
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

async function apiKeyRef(settings: SettingsWriteRemote | undefined): Promise<string> {
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
  settings: () => SettingsWriteRemote | undefined,
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

/** Read `layout` at click time; it is not a dependency of this bundle. */
function selectPanel(ctx: Context, id: string | null): void {
  const get = (ctx as unknown as { get?: (name: string) => unknown }).get
  const layout = typeof get === 'function'
    ? get.call(ctx, 'layout') as LayoutSelectionSeam | undefined
    : undefined
  layout?.selectPanel(id)
}

const locale = {
  zh: {
    title: 'Qoder CN', configured: 'PAT 已配置', notConfigured: '尚未配置 PAT', patLabel: 'Qoder PAT',
    patHint: '粘贴 pt-... Personal Access Token。密钥会写入 DSH 凭据服务。', save: '保存', saving: '保存中…',
    loading: '读取中…', readOnly: '当前 profile 的凭据不可写。', saveFailed: 'PAT 写入失败，请重试。',
    integrations: '集成与显示',
    quotaToggle: '在侧边栏显示额度卡片',
    quotaToggleHint: '默认关闭；关闭时左侧栏不渲染卡片，也不会后台刷新额度。',
    quotaToggleFailed: '开关写入失败，请重试。',
  },
  en: {
    title: 'Qoder CN', configured: 'PAT configured', notConfigured: 'PAT not configured', patLabel: 'Qoder PAT',
    patHint: 'Paste a pt-... Personal Access Token. It is stored in the DSH credentials service.', save: 'Save', saving: 'Saving…',
    loading: 'Loading…', readOnly: 'Credentials are read-only in this profile.', saveFailed: 'The PAT could not be stored. Try again.',
    integrations: 'Integrations & display',
    quotaToggle: 'Show the quota card in the sidebar',
    quotaToggleHint: 'Off by default; while off the sidebar renders no card and no background quota refresh runs.',
    quotaToggleFailed: 'The toggle could not be stored. Try again.',
  },
}

export function apply(ctx: Context): void {
  ctx.effect(() => ctx.locale.register('settings.qoder', locale))
  // The panel's copy is a namespace of its own, but it follows the same active
  // language: declaring `PANEL_LOCALE_NS` on both registrations below is what
  // binds their `t` seat.
  ctx.effect(() => ctx.locale.register(PANEL_LOCALE_NS, { zh: PANEL_TEXT_ZH, en: PANEL_TEXT_EN }))

  // The two quota surfaces are styled by one global sheet, installed on the
  // first `apply` and released with this fiber so a disable or a reload leaves
  // no orphan <style> behind. Injection is idempotent by sheet id, which is what
  // makes the second and later applies no-ops instead of duplicate rules.
  ctx.effect(() => injectQuotaStyles(), 'dsh-provider-qoder: quota styles')

  let settings: SettingsWriteRemote | undefined
  const quotaSettings = createQuotaSettingsFace(() => settings)

  let quotaNamespace: QoderQuotaNamespace | undefined
  const quota = createQuotaController(() => quotaNamespace)

  // The browser never holds the PAT, so quota facts cross the Typert Gateway.
  void ctx.remote.$mount(QUOTA_REMOTE_CONTRIBUTION).then(
    (dispose) => { ctx.effect(() => () => { void dispose() }, 'dsh-provider-qoder: quota remote') },
    (error: unknown) => { console.error('[dsh-provider-qoder] could not mount the quota remote:', error) },
  )
  ctx.inject(['remote.qoder'], (quotaCtx) => {
    quotaNamespace = (quotaCtx.remote as unknown as { qoder: QoderQuotaNamespace }).qoder
    void quota.refresh()
    quotaCtx.effect(() => () => { quotaNamespace = undefined })
  })

  const panelFace = (): QoderQuotaInjected => ({
    hooks: { quota, quotaSettings },
    refresh: () => { void quota.refresh() },
    // `visible` is the only gate on the background poll: while the toggle is
    // off nothing is rendered AND nothing is refreshed.
    startAutoRefresh: () => startQuotaAutoRefresh(quota, () => quotaSettings.getSnapshot().enabled),
    open: () => { selectPanel(ctx, QUOTA_PANEL_ID) },
    close: () => { selectPanel(ctx, null) },
  })

  try {
    ctx.slots.inject('main', () => ctx.slots.register(
      { name: 'main', key: QUOTA_PANEL_ID, locale: PANEL_LOCALE_NS, inject: panelFace },
      QoderQuotaPanel,
    ))
  } catch (error: unknown) {
    console.error('[dsh-provider-qoder] could not register the quota panel:', error)
  }

  ctx.inject(['layout'], (layoutCtx) => {
    try {
      // `order` is the only positional control inside a list slot and the
      // renderer sorts ascending, so 1 lands after the shipped footer chip and
      // immediately above the Settings seat.
      layoutCtx.slots.inject('sidebar.footer.action', () => layoutCtx.slots.register(
        { name: 'sidebar.footer.action', id: QUOTA_PANEL_ID, order: 1, locale: PANEL_LOCALE_NS, inject: panelFace },
        QoderQuotaFooterEntry,
      ))
    } catch (error: unknown) {
      console.error('[dsh-provider-qoder] could not register the sidebar quota card:', error)
    }
  })

  ctx.inject(['remote.settings'], (settingsCtx) => {
    settings = (settingsCtx.remote as unknown as { settings: SettingsWriteRemote }).settings
    void quotaSettings.refresh()
    settingsCtx.effect(() => () => { settings = undefined })
  })

  ctx.inject(['remote.credentials'], (credentialsCtx) => {
    const credentials = (credentialsCtx.remote as unknown as { credentials: CredentialsRemote }).credentials
    const face = createCredentialFace(credentials, () => settings)
    ctx.slots.inject('settings.models.provider-card', () => ctx.slots.register({
      name: 'settings.models.provider-card',
      key: SETTINGS_NS,
      locale: 'settings.qoder',
      inject: () => ({ credential: face, quotaSettings }),
    }, QoderProviderCard))
  })
}

export const inject: readonly string[] = ['slots', 'locale', 'remote']
