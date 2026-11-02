// Browser validation fixture: real components/controllers, synthetic remote services.
import * as React from 'react'
import { createRoot } from 'react-dom/client'
import { QoderProviderCard } from '../src/client/card.tsx'
import { CAPACITY_ZH, createModelsFace } from '../src/client/capacity.tsx'
import { createSettingsFaces } from '../src/client/settings.ts'
import { createQuotaController } from '../src/client/quota.ts'
import { PROVIDER_CSS } from '../src/client/provider-styles.ts'
import { QUOTA_CSS } from '../src/quota-styles.ts'
import { QoderQuotaPanel, QoderQuotaFooterEntry } from '../src/client/panel.tsx'
import { PANEL_TEXT_EN, PANEL_TEXT_ZH } from '../src/client/copy.ts'

const params = new URLSearchParams(location.search)
const zh = params.get('lang') !== 'en'
document.documentElement.lang = zh ? 'zh-CN' : 'en'
const dark = params.get('theme') === 'dark'
const background = dark ? '#15171b' : '#ffffff'
const foreground = dark ? '#eceef2' : '#20242b'
const style = document.createElement('style')
style.textContent = `${PROVIDER_CSS}\n${QUOTA_CSS}\nbody{margin:0;background:${dark ? '#0e1013' : '#f5f6f8'};color:${foreground};font-family:system-ui,sans-serif;--dsw-alias-label-primary:${foreground};--dsw-alias-label-secondary:${dark ? '#b1b8c6' : '#61666b'};--dsw-alias-bg-module-platform:${background};--dsw-alias-border-l2:${dark ? '#ffffff28' : '#0000001a'};--dsw-alias-brand-primary:#6486ed;--dsw-alias-interactive-bg-hover:${dark ? '#ffffff12' : '#2631480f'};}main{max-width:820px;margin:36px auto;padding:0 18px 36px;}aside{font-size:12px;opacity:.65;margin-bottom:18px;}#panel{margin-top:24px;}#footer{width:260px;margin-top:24px;}`
document.head.appendChild(style)
let value = JSON.parse(localStorage.getItem('qoder-ui-fixture') ?? '{"providers":{"qoder-cn":{}}}')
let revision = 1
const settings = createSettingsFaces(() => ({
  describe: async () => ({ ok: true, value: { writable: params.get('readonly') !== '1', namespaces: [{ ns: 'llm-qoder', value, revision }] } }),
  mutate: async (_ns, ops, expected) => {
    if (params.get('reject') === '1') return { ok: false, error: { message: 'Fixture write rejection' } }
    if (expected !== revision) return { ok: false, error: { message: 'revision conflict' } }
    for (const op of ops) {
      let node = value
      for (const key of op.path.slice(0, -1)) node = node[key] ??= {}
      const key = op.path.at(-1)!
      if (op.op === 'unset') delete node[key]
      else node[key] = op.value
    }
    revision++
    localStorage.setItem('qoder-ui-fixture', JSON.stringify(value))
    return { ok: true, value: { ns: 'llm-qoder', value, revision } }
  },
}))
const models = createModelsFace(() => ({ models: async () => {
  const profile = { ...value, ...value.providers?.['qoder-cn'] }
  return { ok: true, value: [{ id: 'fixture-model', name: 'Qoder Demo Model', contextWindow: 200000, maxTokens: 32768, contextWindows: [200000, 1000000], effectiveContextWindow: profile.modelLimits?.['fixture-model']?.contextWindow ?? profile.contextWindowOverride ?? 200000, effectiveMaxTokens: Math.min(profile.modelLimits?.['fixture-model']?.maxTokens ?? profile.maxOutputTokens ?? 32768, 32768) }] }
} }))
void models.refresh()
let quotaOffline = params.get('offline') === '1'
Object.assign(window, { qoderFixture: { setQuotaOffline: (value: boolean) => { quotaOffline = value } } })
const quota = createQuotaController(() => ({ quota: async () => quotaOffline
  ? { ok: false, error: { message: 'Fixture network failure' } }
  : { ok: true, value: { planTierName: 'Teams', userType: 'team_member', isPaidPlan: true, isHighestTier: false, organizationName: 'Demo organization', organizationRole: 'Member', periodStart: 1793462400000, periodEnd: 1796054400000, personal: { total: 3000, used: 840, remaining: 2160, percentage: .28, unit: 'credits', available: true }, usageType: 'credits', totalPercentage: .28, isQuotaExceeded: false, expiresAt: 1796054400000 } },
}))
void quota.refresh()
const credential = {
  getSnapshot: () => ({ ref: 'FIXTURE_ONLY', configured: true, writable: true, loading: false }),
  subscribe: () => () => {}, refresh: async () => {}, set: async () => true,
}
const commonZh: Record<string, string> = { title: 'Qoder CN', configured: 'PAT 已配置', notConfigured: '尚未配置 PAT', patLabel: 'Qoder PAT', patHint: '密钥会写入 DSH 凭据服务。', save: '保存', saving: '保存中…', loading: '读取中…', readOnly: '当前配置只读', saveFailed: '保存失败，请重试。', integrations: '集成与显示', quotaToggle: '在侧边栏显示额度卡片', quotaToggleHint: '默认关闭；关闭时不进行侧栏后台刷新。', quotaToggleFailed: '设置写入失败，请重试。' }
const t = zh ? (key: string) => commonZh[key] ?? CAPACITY_ZH[key as keyof typeof CAPACITY_ZH] ?? key : undefined
function App() {
  const [panel, setPanel] = React.useState(false)
  const [quotaState, setQuotaState] = React.useState(quota.getSnapshot())
  const [settingsState, setSettingsState] = React.useState(settings.quota.getSnapshot())
  React.useEffect(() => quota.subscribe(() => setQuotaState(quota.getSnapshot())), [])
  React.useEffect(() => settings.quota.subscribe(() => setSettingsState(settings.quota.getSnapshot())), [])
  const panelText = zh ? PANEL_TEXT_ZH : PANEL_TEXT_EN
  const surface = { t: (key: string) => panelText[key as keyof typeof panelText] ?? key, useQuota: (selector: any) => selector(quotaState), useQuotaSettings: (selector: any) => selector(settingsState), refresh: () => { void quota.refresh() }, close: () => setPanel(false), open: () => setPanel(true) }
  return <main><aside>UI validation fixture · synthetic account · no real credentials</aside>{panel ? <QoderQuotaPanel {...surface} /> : <QoderProviderCard credential={credential} quotaSettings={settings.quota} capacitySettings={settings.capacity} models={models} quota={quota} openQuota={() => setPanel(true)} t={t} />}<div id="footer"><QoderQuotaFooterEntry {...surface} wide={params.get('rail') !== '1'} /></div></main>
}
createRoot(document.getElementById('root')!).render(<App />)
