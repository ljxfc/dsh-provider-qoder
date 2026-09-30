/**
 * Copy for Qoder's plans & quota surfaces — the sidebar footer card and the
 * middle-column panel. Both register with {@link PANEL_LOCALE_NS}, which is
 * what binds the `t` seat the renderer hands them; a language switch mints a
 * new `t` identity and re-renders both.
 *
 * The `lang` key is part of the contract: the panel needs a language code for
 * number and date formatting, and reading it back out of the same translator
 * keeps the whole panel on one language source.
 *
 * @module dsh-provider-qoder/client/copy
 */

/** The locale namespace both quota slots bind their `t` seat to. */
export const PANEL_LOCALE_NS = 'panel.qoder'

/** Every key the quota surfaces resolve. */
export interface QoderPanelText {
  /** Language code (`zh` or `en`) used for date and number formatting. */
  lang: string
  /** Sidebar footer card label. */
  cardTitle: string
  /** Sidebar footer card tooltip. */
  cardHint: string
  /** Middle-column panel heading. */
  panelTitle: string
  /** Close button accessible name. */
  close: string
  /** Close button tooltip. */
  closeHint: string
  /** Manual refresh button. */
  refresh: string
  /** In-flight read. */
  loading: string
  /** No quota remote in this profile. */
  unavailable: string
  /** No PAT stored yet. */
  notConfigured: string
  /** Read failed; retry affordance. */
  error: string
  /** Plan tier row label. */
  plan: string
  /** Account kind row label. */
  account: string
  /** Organization row label. */
  organization: string
  /** Organization role row label. */
  role: string
  /** Billing window row label. */
  billingCycle: string
  /** Personal plan pool heading. */
  personalPool: string
  /** Organization resource package heading. */
  organizationPool: string
  /** Purchased/gifted add-on credits heading. */
  addOnPool: string
  /** Consumed amount label. */
  used: string
  /** Remaining amount label. */
  remaining: string
  /** Reset / expiry row label. */
  resetAt: string
  /** Shown when the account reports no deadline. */
  noDeadline: string
  /** Pool is present but not currently drawn on. */
  dormant: string
  /** Quota exhausted banner. */
  exceeded: string
  /** Upgrade link label. */
  upgrade: string
  /** Last successful read label. */
  refreshedAt: string
  /** Fallback when the read time is unknown. */
  never: string
  /** Settings toggle label. */
  settingsToggle: string
  /** Settings toggle hint. */
  settingsToggleHint: string
  /** Settings toggle read/write failure. */
  settingsToggleFailed: string
}

/** Chinese copy (Qoder CN's own language). */
export const PANEL_TEXT_ZH: QoderPanelText = {
  lang: 'zh',
  cardTitle: '额度',
  cardHint: '查看 Qoder CN 套餐与额度',
  panelTitle: 'Qoder CN 套餐与额度',
  close: '返回会话',
  closeHint: '关闭此面板并返回当前会话',
  refresh: '刷新',
  loading: '读取中…',
  unavailable: '当前 profile 未挂载额度服务。',
  notConfigured: '尚未配置 PAT，无法读取额度。',
  error: '额度读取失败',
  plan: '套餐',
  account: '账户类型',
  organization: '组织',
  role: '角色',
  billingCycle: '计费周期',
  personalPool: '个人套餐额度',
  organizationPool: '组织资源包',
  addOnPool: '购买 / 赠送额度',
  used: '已用',
  remaining: '剩余',
  resetAt: '重置时间',
  noDeadline: '未提供',
  dormant: '当前未启用',
  exceeded: '额度已用尽',
  upgrade: '升级套餐',
  refreshedAt: '更新于',
  never: '尚未读取',
  settingsToggle: '在侧边栏显示额度卡片',
  settingsToggleHint: '默认关闭；关闭时左侧栏不渲染卡片，也不会后台刷新额度。',
  settingsToggleFailed: '开关写入失败，请重试。',
}

/** English copy. */
export const PANEL_TEXT_EN: QoderPanelText = {
  lang: 'en',
  cardTitle: 'Usage',
  cardHint: 'Qoder CN plan and quota',
  panelTitle: 'Qoder CN plan & quota',
  close: 'Back to conversation',
  closeHint: 'Close this panel and return to the current conversation',
  refresh: 'Refresh',
  loading: 'Loading…',
  unavailable: 'The quota service is not mounted in this profile.',
  notConfigured: 'No PAT is configured yet, so quota cannot be read.',
  error: 'Could not read the quota',
  plan: 'Plan',
  account: 'Account',
  organization: 'Organization',
  role: 'Role',
  billingCycle: 'Billing cycle',
  personalPool: 'Personal plan credits',
  organizationPool: 'Organization package',
  addOnPool: 'Purchased / gifted credits',
  used: 'Used',
  remaining: 'Remaining',
  resetAt: 'Resets',
  noDeadline: 'Not reported',
  dormant: 'Not currently drawn on',
  exceeded: 'Quota exhausted',
  upgrade: 'Upgrade plan',
  refreshedAt: 'Updated',
  never: 'Never',
  settingsToggle: 'Show the quota card in the sidebar',
  settingsToggleHint: 'Off by default; while off the sidebar renders no card and no background quota refresh runs.',
  settingsToggleFailed: 'The toggle could not be stored. Try again.',
}

/** Resolve the one table a raw `t` seat asks for. */
export function qoderPanelText(t: (key: string) => string): QoderPanelText {
  const key = t('lang')
  return key === 'zh' ? PANEL_TEXT_ZH : PANEL_TEXT_EN
}
