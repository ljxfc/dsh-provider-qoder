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
  /** Locally measured rolling-spend section heading. */
  spendTitle: string
  /** Locally measured rolling-spend disclaimer. */
  spendHint: string
  /** Shown when the ledger holds nothing yet. */
  spendNever: string
  /** Billed-request count label inside one rolling window. */
  spendRequests: string
  /** Credit unit used by the rolling totals. */
  creditsUnit: string
  /** Five-hour rolling window label. */
  window5h: string
  /** Day-long rolling window label. */
  window24h: string
  /** Weekly rolling window label. */
  window7d: string
  /** Five-hour label for the compact sidebar line. */
  window5hShort: string
  /** Day-long label for the compact sidebar line. */
  window24hShort: string
  /** Weekly label for the compact sidebar line. */
  window7dShort: string
  /** Hour unit for an unrecognised short window. */
  hoursUnit: string
  /** Day unit for an unrecognised window. */
  daysUnit: string
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
  spendTitle: '滚动用量',
  spendHint: '本地统计：由本机已完成的请求累计，Qoder 本身不提供 5 小时 / 每周窗口；月度额度以上方套餐池为准。',
  spendNever: '尚无本地记录',
  spendRequests: '请求',
  creditsUnit: '积分',
  window5h: '5 小时',
  window24h: '24 小时',
  window7d: '7 天',
  window5hShort: '5h',
  window24hShort: '24h',
  window7dShort: '7d',
  hoursUnit: '小时',
  daysUnit: '天',
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
  spendTitle: 'Rolling usage',
  spendHint: 'Measured locally from completed requests on this machine — Qoder reports no five-hour or weekly window itself; the monthly pools above stay authoritative.',
  spendNever: 'No local records yet',
  spendRequests: 'Requests',
  creditsUnit: 'credits',
  window5h: '5 hours',
  window24h: '24 hours',
  window7d: '7 days',
  window5hShort: '5h',
  window24hShort: '24h',
  window7dShort: '7d',
  hoursUnit: 'hours',
  daysUnit: 'days',
}

/** One hour, in milliseconds; the window labels are keyed by these spans. */
const HOUR_MS = 60 * 60 * 1000

/**
 * Label one rolling window.
 *
 * The three spans the Host publishes have their own words in both languages; an
 * unrecognised span — a Host that adds or changes a window — falls back to a
 * computed duration, so the surface stays truthful instead of printing a raw
 * millisecond count at the user.
 * @param spanMs - the window length in milliseconds.
 * @param t - the resolved copy table.
 * @param compact - whether the sidebar's short form is wanted.
 * @returns the window label.
 */
export function spendWindowLabel(spanMs: number, t: QoderPanelText, compact = false): string {
  switch (spanMs) {
    case 5 * HOUR_MS: return compact ? t.window5hShort : t.window5h
    case 24 * HOUR_MS: return compact ? t.window24hShort : t.window24h
    case 7 * 24 * HOUR_MS: return compact ? t.window7dShort : t.window7d
    default: break
  }
  const days = spanMs / (24 * HOUR_MS)
  if (Number.isInteger(days) && days >= 1) return `${String(days)} ${t.daysUnit}`
  const hours = Math.max(1, Math.round(spanMs / HOUR_MS))
  return `${String(hours)} ${t.hoursUnit}`
}

/** Resolve the one table a raw `t` seat asks for. */
export function qoderPanelText(t: (key: string) => string): QoderPanelText {
  const key = t('lang')
  return key === 'zh' ? PANEL_TEXT_ZH : PANEL_TEXT_EN
}
