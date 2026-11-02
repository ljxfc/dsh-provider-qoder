import * as React from 'react'
import { useEffect, useState, useId } from 'react'
import { CapacitySection, CAPACITY_EN, type ModelsFace } from './capacity.tsx'
import type {
  CapacitySettingsFace,
  QoderQuotaSettingsFace,
} from './settings.ts'
import type { QuotaController } from './quota.ts'
export interface QoderCredentialSnapshot {
  ref: string
  configured: boolean
  writable: boolean
  loading: boolean
  error?: string
}
export interface QoderCredentialFace {
  getSnapshot(): QoderCredentialSnapshot
  subscribe(listener: () => void): () => void
  refresh(): Promise<void>
  set(value: string): Promise<boolean>
}
export interface QoderProviderCardProps {
  t?: (key: string) => string
  credential: QoderCredentialFace
  quotaSettings?: QoderQuotaSettingsFace
  capacitySettings?: CapacitySettingsFace
  models?: ModelsFace
  quota?: QuotaController
  openQuota?: () => void
  provider?: { active?: boolean }
  keyConfigured?: boolean
}
const EN: Record<string, string> = {
  ...CAPACITY_EN,
  title: 'Qoder CN',
  configured: 'PAT configured',
  notConfigured: 'PAT not configured',
  patLabel: 'Qoder PAT',
  patHint:
    'Paste a pt-... Personal Access Token. Stored securely in DSH credentials.',
  save: 'Save',
  saving: 'Saving…',
  loading: 'Loading…',
  readOnly: 'Credentials are read-only.',
  saveFailed: 'The PAT could not be stored. Try again.',
  integrations: 'Integrations & display',
  quotaToggle: 'Show quota in the sidebar',
  quotaToggleHint: 'Off by default. No sidebar background refresh while off.',
  quotaToggleFailed: 'Settings could not be stored. Try again.',
}
export function QoderProviderCard(
  props: QoderProviderCardProps,
): React.ReactElement {
  const patId = useId()
  const t = props.t ?? ((key: string) => EN[key] ?? key)
  const [credential, setCredential] = useState(() =>
    props.credential.getSnapshot(),
  )
  const [settings, setSettings] = useState(() =>
    props.quotaSettings?.getSnapshot(),
  )
  const [quota, setQuota] = useState(() => props.quota?.getSnapshot())
  const [draft, setDraft] = useState('')
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState(false)
  const [toggleBusy, setToggleBusy] = useState(false)
  useEffect(() => {
    const dispose = props.credential.subscribe(() =>
      setCredential(props.credential.getSnapshot()),
    )
    setCredential(props.credential.getSnapshot())
    return dispose
  }, [props.credential])
  useEffect(() => {
    const dispose = props.quotaSettings?.subscribe(() =>
      setSettings(props.quotaSettings?.getSnapshot()),
    )
    setSettings(props.quotaSettings?.getSnapshot())
    return dispose
  }, [props.quotaSettings])
  useEffect(() => {
    const dispose = props.quota?.subscribe(() =>
      setQuota(props.quota?.getSnapshot()),
    )
    setQuota(props.quota?.getSnapshot())
    return dispose
  }, [props.quota])
  const disabled =
    saving || credential.loading || !credential.writable || !!credential.error
  const save = async () => {
    if (disabled || !draft.trim()) return
    setSaving(true)
    setFailed(false)
    try {
      if (await props.credential.set(draft.trim())) {
        setDraft('')
        setEditing(false)
      } else setFailed(true)
    } catch {
      setFailed(true)
    } finally {
      setSaving(false)
    }
  }
  const report = quota?.report
  const date = (value: number) =>
    new Date(value < 100000000000 ? value * 1000 : value).toLocaleDateString()
  return (
    <div data-qoder-models-card="true">
      <header className="qoder-header">
        <div className="qoder-brand">
          <span className="qoder-monogram" aria-hidden="true">
            Q
          </span>
          <div>
            <div className="qoder-title">{t('title')}</div>
            <small>Qoder · China</small>
          </div>
        </div>
        <span className="qoder-status" role="status">
          {credential.loading
            ? t('loading')
            : credential.error
              ? t('readFailed')
              : credential.configured
                ? t('configured')
                : t('notConfigured')}
        </span>
      </header>
      <section className="qoder-section">
        <div className="qoder-section-heading">
          <h3>{t('patLabel')}</h3>
          {credential.configured && !editing ? (
            <button
              disabled={disabled}
              type="button"
              onClick={() => setEditing(true)}
            >
              {t('changePat')}
            </button>
          ) : null}
        </div>
        <p className="qoder-muted">{t('credentialHint')}</p>
        {!credential.configured || editing ? (
          <>
            <div>
              <label htmlFor={patId}>{t('patLabel')}</label>
              <div className="qoder-inline">
                <input
                  id={patId}
                  type="password"
                  autoComplete="new-password"
                  spellCheck={false}
                  value={draft}
                  disabled={disabled}
                  onChange={(event) => {
                    setDraft(event.target.value)
                    setFailed(false)
                  }}
                />
                <button
                  type="button"
                  disabled={disabled || !draft.trim()}
                  onClick={() => {
                    void save()
                  }}
                >
                  {saving ? t('saving') : t('save')}
                </button>
              </div>
            </div>
            <small>{credential.writable ? t('patHint') : t('readOnly')}</small>
          </>
        ) : null}
        {credential.error ? (
          <div className="qoder-inline">
            <p className="qoder-warning" role="alert">
              {t('readFailed')}
            </p>
            <button
              type="button"
              disabled={credential.loading}
              onClick={() => {
                void props.credential.refresh()
              }}
            >
              {t('retry')}
            </button>
          </div>
        ) : null}
        {failed ? (
          <p className="qoder-warning" role="alert">
            {t('saveFailed')}
          </p>
        ) : null}
      </section>
      {props.capacitySettings && props.models ? (
        <CapacitySection
          face={props.capacitySettings}
          catalog={props.models}
          t={t}
        />
      ) : null}
      {props.quota ? (
        <section className="qoder-section">
          <div className="qoder-section-heading">
            <h3>{t('quota')}</h3>
            <button
              type="button"
              disabled={quota?.status === 'loading'}
              onClick={() => {
                void props.quota?.refresh()
              }}
            >
              {quota?.status === 'loading' ? t('loading') : t('refresh')}
            </button>
          </div>
          {report ? (
            <>
              <div>
                <small>
                  {report.planTierName || t('unknown')} ·{' '}
                  {report.organizationName || report.userType}
                </small>
              </div>
              <div>
                <div className="qoder-quota-number">
                  {report.personal.available
                    ? `${report.personal.used.toLocaleString()} / ${report.personal.total.toLocaleString()}`
                    : t('unknown')}
                </div>
                <small>
                  {t('used')} · {report.personal.unit}
                </small>
              </div>
              <dl className="qoder-facts">
                <dt>{t('period')}</dt>
                <dd>
                  {report.periodStart && report.periodEnd
                    ? `${date(report.periodStart)} – ${date(report.periodEnd)}`
                    : t('unknown')}
                </dd>
                <dt>{t('updated')}</dt>
                <dd>
                  {quota?.fetchedAt
                    ? new Date(quota.fetchedAt).toLocaleString()
                    : t('unknown')}
                </dd>
              </dl>
            </>
          ) : (
            <p className="qoder-muted">{t('noQuota')}</p>
          )}
          {quota?.status === 'error' ? (
            <p className="qoder-warning" role="alert">
              {report ? t('stale') : t('readFailed')}
            </p>
          ) : null}
          <button
            className="qoder-subtle"
            type="button"
            onClick={props.openQuota}
          >
            {t('details')}
          </button>
        </section>
      ) : null}
      {props.quotaSettings ? (
        <section className="qoder-section" data-qoder-integrations="true">
          <h3>{t('integrations')}</h3>
          <label className="qoder-toggle">
            <input
              type="checkbox"
              data-qoder-quota-toggle="true"
              checked={settings?.enabled === true}
              disabled={
                !settings ||
                settings.loading ||
                !settings.writable ||
                settings.failed ||
                toggleBusy
              }
              onChange={(event) => {
                setToggleBusy(true)
                void props.quotaSettings
                  ?.set(event.target.checked)
                  .finally(() => setToggleBusy(false))
              }}
            />
            <span>{t('quotaToggle')}</span>
          </label>
          <small>{t('quotaToggleHint')}</small>
          {settings?.failed ? (
            <div className="qoder-inline">
              <p role="alert" className="qoder-warning">
                {t('quotaToggleFailed')}
              </p>
              <button
                type="button"
                onClick={() => {
                  void props.quotaSettings?.refresh()
                }}
              >
                {t('retry')}
              </button>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  )
}
