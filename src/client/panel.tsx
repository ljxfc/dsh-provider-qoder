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
 * Two layout facts drive the markup, both measured against dsh 0.2.0-rc.2:
 *
 * - `sidebar.footer.action` hands the entry a `wide` prop naming the sidebar
 *   form it is rendering into, and in the collapsed rail that prop is `false`.
 *   The rail is 56px wide with a 35px footer list, so a full-width card there
 *   overflows its column — it measured 76px wide at x=-10.5, hanging off the
 *   left edge and wrapping mid-word. The rail branch below renders the ring
 *   alone, sized to the shell's own 36px rail controls.
 * - The expanded branch only fits because `../quota-styles.ts` stacks the
 *   shell's footer list; as a row its occupants cannot shrink.
 *
 * Neither surface animates anything but a bar width, and the panel is only
 * mounted while it is open — the card stays a dozen elements.
 *
 * @module dsh-provider-qoder/client/panel
 */

import * as React from 'react'
import { useEffect } from 'react'
import {
  daysUntil,
  formatCredits,
  formatDay,
  formatMoment,
  formatShortDay,
  formatYearSpan,
  joinParts,
  percentOf,
  ringDashOffset,
  RING_CIRCUMFERENCE,
  RING_RADIUS,
  usedRatio,
} from '../quota-view.ts'
import type { QuotaSnapshotWire } from '../usage-wire.ts'
import { PANEL_TEXT_EN, qoderPanelText, type QoderPanelText } from './copy.ts'
import { QUOTA_REMOTE_UNMOUNTED_ERROR, type QuotaController, type QuotaSnapshot } from './quota.ts'
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
  /**
   * Which sidebar form this entry is rendering into. `false` is the collapsed
   * rail, where only the ring fits; anything else (including a shell that does
   * not send the prop) is the expanded column.
   */
  wide?: boolean
}

/** Everything a surface draws, resolved once per render. */
interface QuotaView {
  t: QoderPanelText
  snapshot: QuotaSnapshot
  report?: QuotaSnapshotWire
}

/**
 * The progress ring. Two circles on one arc: a track at 40% opacity and the
 * arc itself, rotated a quarter turn so it grows from twelve o'clock. The dash
 * array is the full circumference, so the offset is a plain percentage of it.
 */
function QuotaRing(props: { percent: number; warn: boolean; size: number }): React.ReactElement {
  return (
    <span className="qcp-glyph" aria-hidden="true">
      <svg viewBox="0 0 20 20" width={props.size} height={props.size} focusable="false">
        <circle cx={10} cy={10} r={RING_RADIUS} fill="none" stroke="currentColor" strokeWidth={1.5} opacity={0.4} />
        <circle
          cx={10}
          cy={10}
          r={RING_RADIUS}
          fill="none"
          stroke={props.warn ? 'var(--dsw-alias-state-error-primary, #ec1313)' : 'currentColor'}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeDasharray={RING_CIRCUMFERENCE}
          strokeDashoffset={ringDashOffset(props.percent)}
          transform="rotate(-90 10 10)"
        />
      </svg>
    </span>
  )
}

/**
 * One progress bar. Both boxes are spans — the card renders inside a button,
 * so its markup must stay phrasing content and `display:block` in the
 * stylesheet is what gives them a box at all.
 */
function QuotaBar(props: { percent: number; warn: boolean; large?: boolean; label: string }): React.ReactElement {
  return (
    <span
      className={props.large === true ? 'qcp-barLg' : 'qcp-bar'}
      role="progressbar"
      aria-label={props.label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={props.percent}
    >
      <span className={props.warn ? 'qcp-fill qcp-fillWarn' : 'qcp-fill'} style={{ width: `${String(props.percent)}%` }} />
    </span>
  )
}

/** One credit pool as a labelled bar with its figures and reset moment. */
function QuotaWindow(props: {
  t: QoderPanelText
  label: string
  pool: QuotaSnapshotWire['personal']
  expiresAt?: number
  warn: boolean
}): React.ReactElement {
  const { t, pool } = props
  const percent = percentOf(usedRatio(pool.used, pool.total, pool.percentage))
  return (
    <div className="qcp-window">
      <div className="qcp-windowHead">
        <span className="qcp-windowLabel">{props.label}</span>
        <span className="qcp-windowValue">{`${formatCredits(pool.used)} / ${formatCredits(pool.total)} ${pool.unit}`}</span>
        <span className="qcp-windowPct">{`${String(percent)}%`}</span>
      </div>
      <QuotaBar large percent={percent} warn={props.warn} label={props.label} />
      <span className="qcp-caption">{`${t.resetAt} ${formatMoment(props.expiresAt, t.lang) ?? t.noDeadline}`}</span>
    </div>
  )
}

/** One figure that has a whole tile line each. */
function QuotaTile(props: { label: string; value: string; sub?: string; small?: boolean }): React.ReactElement {
  return (
    <div className="qcp-tile">
      <span className="qcp-tileLabel">{props.label}</span>
      <span className={props.small === true ? 'qcp-tileValue qcp-tileValueSm' : 'qcp-tileValue'}>{props.value}</span>
      {props.sub === undefined ? null : <span className="qcp-tileSub" title={props.sub}>{props.sub}</span>}
    </div>
  )
}

function useView(props: QoderQuotaSurfaceProps): QuotaView {
  const t = qoderPanelText(props.t ?? ((key: string) => PANEL_TEXT_EN[key as keyof QoderPanelText] ?? key))
  const snapshot = props.useQuota?.((state) => state) ?? { status: 'idle' as const }
  return { t, snapshot, report: snapshot.report }
}

/**
 * The host reports a missing remote and a missing PAT as prose, so the surfaces
 * name those two states instead of echoing the message; any other failure keeps
 * the host's own words, which are the actionable part.
 */
function statusHeadline(t: QoderPanelText, error: string): { title: string; detail?: string } {
  if (error === QUOTA_REMOTE_UNMOUNTED_ERROR) return { title: t.unavailable }
  if (/no PAT|personal access token/i.test(error)) return { title: t.notConfigured, detail: error }
  return { title: t.error, detail: error }
}

/** The headline pool: the personal one, else whatever the account does hold. */
function headlineOf(report: QuotaSnapshotWire | undefined): { pool: QuotaSnapshotWire['personal']; label: string } | undefined {
  if (report?.personal !== undefined) return { pool: report.personal, label: 'personal' }
  if (report?.addOnPool !== undefined) return { pool: report.addOnPool, label: 'addOn' }
  return undefined
}

/** Sidebar footer row: the ring alone in the rail, a full card when expanded. */
export function QoderQuotaFooterEntry(props: QoderQuotaSurfaceProps): React.ReactElement | null {
  const enabled = props.useQuotaSettings?.((state) => state.enabled) ?? false
  const { t, snapshot, report } = useView(props)
  const startAutoRefresh = props.startAutoRefresh

  useEffect(() => {
    if (!enabled || startAutoRefresh === undefined) return undefined
    return startAutoRefresh()
  }, [enabled, startAutoRefresh])

  if (!enabled) return null

  const headline = headlineOf(report)
  const percent = headline === undefined
    ? 0
    : percentOf(usedRatio(headline.pool.used, headline.pool.total, headline.pool.percentage))
  const warn = report?.isQuotaExceeded === true || percent >= 100
  const open = (): void => { props.open?.() }

  // The rail: the shell passes `wide: false` here. Only the ring fits, so the
  // words move into the tooltip and the accessible name.
  if (props.wide === false) {
    return (
      <button
        type="button"
        className="qcp-rail"
        data-qoder-quota-card="true"
        aria-label={t.cardHint}
        title={t.cardHint}
        onClick={open}
      >
        <QuotaRing percent={percent} warn={warn} size={18} />
      </button>
    )
  }

  const badge = report?.planTierName
  return (
    <button
      type="button"
      className="qcp-foot"
      data-qoder-quota-card="true"
      aria-label={t.cardHint}
      title={t.cardHint}
      onClick={open}
    >
      <span className="qcp-top">
        <QuotaRing percent={percent} warn={warn} size={16} />
        <span className="qcp-name">{t.cardName}</span>
        <span className="qcp-spacer" />
        {warn
          ? <span className="qcp-badge qcp-badgeWarn">{t.exceededShort}</span>
          : badge === undefined ? null : <span className="qcp-badge">{badge}</span>}
      </span>
      {headline === undefined ? (
        <span className="qcp-caption">{snapshot.status === 'error' ? t.error : t.loading}</span>
      ) : (
        <span className="qcp-row">
          <span className="qcp-rowHead">
            <span className="qcp-rowLabel">
              {headline.label === 'personal' ? t.personalPool : t.addOnPool}
            </span>
            <span className="qcp-rowAmount">
              {`${formatCredits(headline.pool.used)} / ${formatCredits(headline.pool.total)}`}
            </span>
            <span className="qcp-rowPct">{`${String(percent)}%`}</span>
          </span>
          <QuotaBar percent={percent} warn={warn} label={t.personalPool} />
          <span className="qcp-caption">
            {`${t.resetAt} ${formatMoment(report?.expiresAt, t.lang) ?? t.noDeadline}`}
          </span>
        </span>
      )}
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

  const now = Date.now()
  const refreshed = snapshot.fetchedAt === undefined
    ? t.never
    : formatMoment(snapshot.fetchedAt, t.lang) ?? t.never

  const personal = report?.personal
  const organization = report?.organizationPool
  const organizationActive = organization !== undefined && organization.available !== false

  const percent = personal === undefined
    ? percentOf(report?.totalPercentage ?? 0)
    : percentOf(usedRatio(personal.used, personal.total, personal.percentage))
  const exceeded = report?.isQuotaExceeded === true || (personal !== undefined && percent >= 100)
  const failure = snapshot.status === 'error' && snapshot.error !== undefined
    ? statusHeadline(t, snapshot.error)
    : undefined

  const cycleStart = formatShortDay(report?.periodStart, t.lang)
  const cycleEnd = formatShortDay(report?.periodEnd, t.lang)
  const days = daysUntil(report?.expiresAt, now)
  // Plan tier is the identity headline, so this line carries what qualifies it:
  // the account kind (a Teams seat reads differently from a personal one), the
  // organization, and the role inside it.
  const owner = joinParts([report?.userType, report?.organizationName, report?.organizationRole])

  return (
    <section className="qcp-main" data-qoder-quota-panel="true">
      <div className="qcp-inner">
        <header className="qcp-head">
          <div className="qcp-headText">
            <h2 className="qcp-title">{t.panelTitle}</h2>
            <span className="qcp-sub">{t.panelSubtitle}</span>
          </div>
          <div className="qcp-actions">
            <span className="qcp-meta">{`${t.refreshedAt} ${refreshed}`}</span>
            <button
              type="button"
              className="qcp-button"
              onClick={() => { props.refresh?.() }}
              disabled={snapshot.status === 'loading'}
            >
              {snapshot.status === 'loading' ? t.loading : t.refresh}
            </button>
            {/* The panel replaces the Conversation in the center column and the
                sidebar card only re-selects it, so without this exit the user
                could not get back to the session. The glyph is the whole
                content, so the name and tooltip carry the words. */}
            <button
              type="button"
              className="qcp-iconButton"
              aria-label={t.close}
              title={t.closeHint}
              onClick={() => { props.close?.() }}
            >
              <span aria-hidden="true">×</span>
            </button>
          </div>
        </header>

        {exceeded ? (
          <div className="qcp-alert" role="alert">
            <strong>{t.exceeded}</strong>
            <span className="qcp-alertDetail">{t.exceededHint}</span>
          </div>
        ) : null}

        {failure === undefined ? null : (
          <div className="qcp-alert" role="alert">
            <strong>{failure.title}</strong>
            {failure.detail === undefined
              ? null
              : <span className="qcp-alertDetail">{failure.detail}</span>}
          </div>
        )}

        {report === undefined ? (
          <div className="qcp-card">
            <span className="qcp-note">{snapshot.status === 'loading' || snapshot.status === 'idle' ? t.loading : t.error}</span>
          </div>
        ) : (
          <div className="qcp-card">
            <div className="qcp-identity">
              <span className="qcp-avatar" aria-hidden="true">Q</span>
              <div className="qcp-idText">
                <span className="qcp-planName">{report.planTierName}</span>
                {owner === '' ? null : <span className="qcp-planOwner">{owner}</span>}
              </div>
              <span className="qcp-spacer" />
              {exceeded ? <span className="qcp-badge qcp-badgeWarn">{t.exceededShort}</span> : null}
            </div>

            <div className="qcp-divider" />

            <div className="qcp-block">
              <span className="qcp-blockTitle">{t.usageBlock}</span>
              {personal === undefined
                ? <span className="qcp-note">{t.noPersonalPool}</span>
                : (
                    <QuotaWindow
                      t={t}
                      label={t.personalPool}
                      pool={personal}
                      {...(report.expiresAt === undefined ? {} : { expiresAt: report.expiresAt })}
                      warn={exceeded}
                    />
                  )}
            </div>

            {personal === undefined ? null : (
              <div className="qcp-tiles">
                <QuotaTile
                  label={t.billingCycle}
                  value={cycleStart === undefined || cycleEnd === undefined
                    ? t.noDeadline
                    : `${cycleStart} → ${cycleEnd}`}
                  {...(formatYearSpan(report.periodStart, report.periodEnd) === undefined
                    ? {}
                    : { sub: formatYearSpan(report.periodStart, report.periodEnd) })}
                  small
                />
                <QuotaTile
                  label={t.used}
                  value={`${formatCredits(personal.used)} ${personal.unit}`}
                  sub={`${t.limit} ${formatCredits(personal.total)} ${personal.unit}`}
                />
                <QuotaTile
                  label={t.remaining}
                  value={`${formatCredits(personal.remaining)} ${personal.unit}`}
                  sub={`${String(Math.max(0, 100 - percent))}%`}
                />
                <QuotaTile
                  label={t.resetAt}
                  value={formatDay(report.expiresAt, t.lang) ?? t.noDeadline}
                  {...(days === undefined ? {} : { sub: `${String(days)} ${t.daysLeftSuffix}` })}
                  small
                />
              </div>
            )}
          </div>
        )}

        {report?.addOnPool === undefined ? null : (
          <div className="qcp-card">
            <div className="qcp-block">
              <span className="qcp-blockTitle">{t.addOnPool}</span>
              <QuotaWindow
                t={t}
                label={t.addOnPool}
                pool={report.addOnPool}
                {...(report.expiresAt === undefined ? {} : { expiresAt: report.expiresAt })}
                warn={false}
              />
            </div>
          </div>
        )}

        {organizationActive ? (
          <div className="qcp-card">
            <div className="qcp-block">
              <span className="qcp-blockTitle">{t.organizationPool}</span>
              <QuotaWindow
                t={t}
                label={t.organizationPool}
                pool={organization}
                {...(report?.expiresAt === undefined ? {} : { expiresAt: report.expiresAt })}
                warn={false}
              />
            </div>
          </div>
        ) : organization === undefined ? null : <span className="qcp-note">{t.orgPoolDormant}</span>}

        <div className="qcp-panelFoot">
          {report?.upgradeUrl === undefined ? null : (
            <a className="qcp-link" href={report.upgradeUrl} target="_blank" rel="noreferrer">{t.upgrade}</a>
          )}
          {enabled ? null : <span className="qcp-note">{t.settingsToggleHint}</span>}
        </div>
      </div>
    </section>
  )
}
