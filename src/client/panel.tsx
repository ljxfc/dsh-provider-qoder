/**
 * The two quota surfaces:
 *
 * - `QoderQuotaFooterEntry` — a row in `sidebar.footer.action`, rendered
 *   directly above the Settings seat. It returns `null` unless the
 *   `showSidebarQuota` toggle is on, and the background refresh starts only
 *   while that same flag is true, so a hidden card costs nothing.
 * - `QoderQuotaPanel` — the middle-column dashboard registered under the same
 *   id in the `main` keyed slot. Its `×` calls `close()`, which selects the
 *   Conversation again without touching the current Session.
 *
 * Both register with `panel.qoder`, which binds the `t` seat here.
 *
 * @module dsh-provider-qoder/client/panel
 */

import * as React from 'react'
import { useEffect } from 'react'
import type { QuotaSnapshotWire, QuotaSpendWire, QuotaSpendWindowWire } from '../usage-wire.ts'
import { PANEL_TEXT_EN, qoderPanelText, spendWindowLabel, type QoderPanelText } from './copy.ts'
import type { QuotaController, QuotaSnapshot } from './quota.ts'
import type { QoderQuotaSettingsFace, QoderQuotaSettingsSnapshot } from './settings.ts'

/** The `main` key the footer card selects and the panel occupies. */
export const QUOTA_PANEL_ID = 'qoder-quota-panel'

/** What the two registrations inject into their components. */
export interface QoderQuotaInjected {
  hooks: {
    quota: QuotaController
    quotaSettings: QoderQuotaSettingsFace
  }
  refresh(): void
  /** Refcounted; the returned function stops this caller's polling. */
  startAutoRefresh(): () => void
  open(): void
  close(): void
}

/** Props both surfaces read; the hook seats arrive from `inject.hooks`. */
export interface QoderQuotaSurfaceProps {
  t?: (key: string) => string
  useQuota?: <T>(selector: (snapshot: QuotaSnapshot) => T) => T
  useQuotaSettings?: <T>(selector: (snapshot: QoderQuotaSettingsSnapshot) => T) => T
  refresh?: () => void
  startAutoRefresh?: () => () => void
  open?: () => void
  close?: () => void
}

/** Everything the board draws, resolved once per render. */
interface QuotaView {
  t: QoderPanelText
  snapshot: QuotaSnapshot
  report?: QuotaSnapshotWire
}

function formatCredits(value: number): string {
  const rounded = Math.round(value * 100) / 100
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2)
}

function formatRatio(ratio: number): string {
  return `${String(Math.round(Math.max(0, Math.min(1, ratio)) * 100))}%`
}

function formatMoment(ms: number | undefined, lang: string): string | undefined {
  if (ms === undefined || !Number.isFinite(ms)) return undefined
  try {
    return new Date(ms).toLocaleString(lang === 'zh' ? 'zh-CN' : 'en-US', {
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    })
  } catch {
    return new Date(ms).toISOString()
  }
}

/** One thin progress bar with an accessible value. */
function QuotaBar(props: { ratio: number; label: string }): React.ReactElement {
  const percent = Math.round(Math.max(0, Math.min(1, props.ratio)) * 100)
  return (
    <div
      role="progressbar"
      aria-label={props.label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      style={{ height: '6px', borderRadius: '3px', background: 'rgba(127,127,127,0.28)', overflow: 'hidden' }}
    >
      <div style={{ width: `${String(percent)}%`, height: '100%', background: percent >= 100 ? '#d9534f' : 'currentColor' }} />
    </div>
  )
}

function QuotaRow(props: { label: string; value: string }): React.ReactElement {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
      <span style={{ opacity: 0.7 }}>{props.label}</span>
      <span>{props.value}</span>
    </div>
  )
}

/** One credit pool: heading, numbers, bar and reset time. */
function QuotaPool(props: {
  t: QoderPanelText
  title: string
  pool: QuotaSnapshotWire['personal']
  expiresAt?: number
  dormant?: boolean
}): React.ReactElement {
  const { t, pool } = props
  const ratio = pool.total > 0 ? pool.used / pool.total : pool.percentage
  const reset = formatMoment(props.expiresAt, t.lang) ?? t.noDeadline
  return (
    <div style={{ display: 'grid', gap: '6px', padding: '10px 12px', border: '1px solid rgba(127,127,127,0.3)', borderRadius: '8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
        <strong>{props.title}</strong>
        {props.dormant === true ? <em>{t.dormant}</em> : <span>{formatRatio(ratio)}</span>}
      </div>
      <QuotaBar ratio={ratio} label={props.title} />
      <QuotaRow label={t.used} value={`${formatCredits(pool.used)} / ${formatCredits(pool.total)} ${pool.unit}`} />
      <QuotaRow label={t.remaining} value={`${formatCredits(pool.remaining)} ${pool.unit}`} />
      <QuotaRow label={t.resetAt} value={reset} />
    </div>
  )
}

function useView(props: QoderQuotaSurfaceProps): QuotaView {
  const t = qoderPanelText(props.t ?? ((key: string) => PANEL_TEXT_EN[key as keyof QoderPanelText] ?? key))
  const snapshot = props.useQuota?.((state) => state) ?? { status: 'idle' as const }
  return { t, snapshot, report: snapshot.report }
}

/** The shortest and the longest window, which is all the sidebar line needs. */
function windowExtremes(spend: QuotaSpendWire): {
  short?: QuotaSpendWindowWire
  long?: QuotaSpendWindowWire
} {
  let short: QuotaSpendWindowWire | undefined
  let long: QuotaSpendWindowWire | undefined
  for (const window of spend.windows) {
    if (short === undefined || window.spanMs < short.spanMs) short = window
    if (long === undefined || window.spanMs > long.spanMs) long = window
  }
  return {
    ...short === undefined ? {} : { short },
    ...long === undefined ? {} : { long },
  }
}

/**
 * The sidebar's one-line rolling summary: the shortest and the longest window
 * the Host reports, which is the five-hour and weekly pair it publishes today.
 * The two ends are picked by span rather than by index, so a Host that adds a
 * window cannot silently change what the line means.
 */
function spendBrief(spend: QuotaSpendWire, t: QoderPanelText): string | undefined {
  const { short, long } = windowExtremes(spend)
  if (short === undefined || long === undefined) return undefined
  const windows = short.spanMs === long.spanMs ? [short] : [short, long]
  const parts = windows.map(
    (window) => `${spendWindowLabel(window.spanMs, t, true)} ${formatCredits(window.credits)}`,
  )
  return `${parts.join(' · ')} ${t.creditsUnit}`
}

/** Locally measured rolling spend: one row per window, plus the disclaimer. */
function SpendSection(props: { t: QoderPanelText; spend: QuotaSpendWire }): React.ReactElement {
  const { t, spend } = props
  return (
    <section
      data-qoder-spend="true"
      style={{ display: 'grid', gap: '8px', padding: '10px 12px', border: '1px solid rgba(127,127,127,0.3)', borderRadius: '8px' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
        <strong>{t.spendTitle}</strong>
        <small style={{ opacity: 0.75 }}>
          {spend.updatedAt === undefined ? t.spendNever : formatMoment(spend.updatedAt, t.lang) ?? t.spendNever}
        </small>
      </div>
      {spend.windows.map((window) => (
        <div key={window.spanMs} style={{ display: 'grid', gap: '2px' }}>
          <QuotaRow
            label={spendWindowLabel(window.spanMs, t)}
            value={`${formatCredits(window.credits)} ${t.creditsUnit}`}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', opacity: 0.7 }}>
            <small>{`${t.spendRequests} ${String(window.requests)}`}</small>
            {window.resetsAt === undefined ? null : (
              <small>{`${t.resetAt} ${formatMoment(window.resetsAt, t.lang) ?? t.noDeadline}`}</small>
            )}
          </div>
        </div>
      ))}
      <small style={{ opacity: 0.7 }}>{t.spendHint}</small>
    </section>
  )
}

/** Sidebar footer row: hidden unless the toggle is on. */
export function QoderQuotaFooterEntry(props: QoderQuotaSurfaceProps): React.ReactElement | null {
  const enabled = props.useQuotaSettings?.((state) => state.enabled) ?? false
  const { t, snapshot, report } = useView(props)
  const startAutoRefresh = props.startAutoRefresh

  useEffect(() => {
    if (!enabled || startAutoRefresh === undefined) return undefined
    return startAutoRefresh()
  }, [enabled, startAutoRefresh])

  if (!enabled) return null

  const summary = report === undefined
    ? snapshot.status === 'loading' ? t.loading : t.error
    : `${report.planTierName} · ${formatRatio(report.totalPercentage)}`
  const brief = report?.spend === undefined ? undefined : spendBrief(report.spend, t)

  return (
    <button
      type="button"
      data-qoder-quota-card="true"
      title={t.cardHint}
      onClick={() => { props.open?.() }}
      style={{
        display: 'grid', gap: '4px',
        width: '100%', padding: '8px 10px', border: '1px solid rgba(127,127,127,0.35)',
        borderRadius: '8px', background: 'transparent', color: 'inherit', cursor: 'pointer',
        font: 'inherit', textAlign: 'left',
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
        <span>{t.cardTitle}</span>
        <small style={{ opacity: 0.75 }}>{summary}</small>
      </span>
      {/* The rolling totals are the part of "how much have I used" the monthly
          pool cannot answer, so the card carries them on their own line. */}
      {brief === undefined ? null : <small style={{ opacity: 0.6 }}>{brief}</small>}
    </button>
  )
}

/** Middle-column dashboard. */
export function QoderQuotaPanel(props: QoderQuotaSurfaceProps): React.ReactElement {
  const { t, snapshot, report } = useView(props)
  const enabled = props.useQuotaSettings?.((state) => state.enabled) ?? false
  const startAutoRefresh = props.startAutoRefresh

  useEffect(() => {
    if (startAutoRefresh === undefined) return undefined
    return startAutoRefresh()
  }, [startAutoRefresh])

  const refreshed = snapshot.fetchedAt === undefined
    ? t.never
    : formatMoment(snapshot.fetchedAt, t.lang) ?? t.never

  const personal = report?.personal
  const organization = report?.organizationPool
  const organizationActive = organization !== undefined && organization.available !== false

  return (
    <section
      data-qoder-quota-panel="true"
      style={{ display: 'grid', gap: '12px', alignContent: 'start', padding: '16px 20px', overflow: 'auto', height: '100%' }}
    >
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
        <h2 style={{ margin: 0, fontSize: '1.1em' }}>{t.panelTitle}</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button type="button" onClick={() => { props.refresh?.() }} disabled={snapshot.status === 'loading'}>
            {snapshot.status === 'loading' ? t.loading : t.refresh}
          </button>
          {/* The panel replaces the Conversation in the center column and the
              sidebar card only re-selects it, so without this exit the user
              could not get back to the session. The glyph is the whole
              content, so the name and tooltip carry the words. */}
          <button
            type="button"
            aria-label={t.close}
            title={t.closeHint}
            onClick={() => { props.close?.() }}
            style={{ border: 'none', background: 'transparent', color: 'inherit', cursor: 'pointer', fontSize: '1.2em', lineHeight: 1 }}
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>
      </header>

      {report?.isQuotaExceeded === true ? (
        <div role="alert" style={{ padding: '8px 12px', border: '1px solid #d9534f', borderRadius: '8px' }}>
          {t.exceeded}
        </div>
      ) : null}

      {snapshot.status === 'error' ? (
        <div role="alert" style={{ display: 'grid', gap: '6px' }}>
          <span>{t.error}</span>
          {snapshot.error !== undefined ? <small style={{ opacity: 0.7 }}>{snapshot.error}</small> : null}
        </div>
      ) : null}

      {report === undefined ? null : (
        <div style={{ display: 'grid', gap: '6px' }}>
          <QuotaRow label={t.plan} value={report.planTierName} />
          <QuotaRow label={t.account} value={report.userType} />
          {report.organizationName === undefined ? null : (
            <QuotaRow label={t.organization} value={report.organizationName} />
          )}
          {report.organizationRole === undefined ? null : (
            <QuotaRow label={t.role} value={report.organizationRole} />
          )}
          <QuotaRow
            label={t.billingCycle}
            value={`${formatMoment(report.periodStart, t.lang) ?? t.noDeadline} → ${formatMoment(report.periodEnd, t.lang) ?? t.noDeadline}`}
          />
        </div>
      )}

      {personal === undefined ? null : (
        <QuotaPool t={t} title={t.personalPool} pool={personal} expiresAt={report?.expiresAt} />
      )}

      {organization === undefined ? null : (
        <QuotaPool
          t={t}
          title={t.organizationPool}
          pool={organization}
          expiresAt={report?.expiresAt}
          {...(organizationActive ? {} : { dormant: true })}
        />
      )}

      {report?.addOnPool === undefined ? null : (
        <QuotaPool t={t} title={t.addOnPool} pool={report.addOnPool} expiresAt={report.expiresAt} />
      )}

      {report?.spend === undefined ? null : <SpendSection t={t} spend={report.spend} />}

      <footer style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', opacity: 0.7 }}>
        <small>{`${t.refreshedAt} ${refreshed}`}</small>
        {report?.upgradeUrl === undefined ? null : (
          <a href={report.upgradeUrl} target="_blank" rel="noreferrer">{t.upgrade}</a>
        )}
      </footer>

      {enabled ? null : <small style={{ opacity: 0.7 }}>{t.settingsToggleHint}</small>}
    </section>
  )
}
