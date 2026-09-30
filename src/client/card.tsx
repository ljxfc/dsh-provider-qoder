/**
 * Qoder's provider card for 设置 → 模型.
 *
 * Two blocks, mirroring how the Command Code provider presents itself:
 *
 * - `账户` — the PAT editor. dsh renders an unknown provider family with a
 *   generic editor that has no API-key field, so this keyed provider-card slot
 *   supplies that one control and writes the PAT through the Host credentials
 *   service. The PAT is never put into the settings document or echoed back
 *   into the input.
 * - `集成与显示` — the `showSidebarQuota` toggle. It is the only switch for the
 *   sidebar quota card, and the same flag gates the background refresh.
 *
 * The card renders unconditionally: the row it sits in is owned by the Models
 * page, so nothing here may depend on the shape of its neighbours.
 */

import * as React from 'react'
import { useEffect, useRef, useState } from 'react'
import type { QoderQuotaSettingsFace, QoderQuotaSettingsSnapshot } from './settings.ts'

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
  /** The `showSidebarQuota` toggle; absent when the settings remote is unmounted. */
  quotaSettings?: QoderQuotaSettingsFace
  provider?: { active?: boolean }
  keyConfigured?: boolean
}

const SECTION_STYLE = { display: 'grid', gap: '8px', padding: '12px 0' } as const

function defaultText(key: string): string {
  return ({
    title: 'Qoder CN',
    configured: 'PAT configured',
    notConfigured: 'PAT not configured',
    patLabel: 'Qoder PAT',
    patHint: 'Paste a pt-... Personal Access Token. It is stored in the DSH credentials service.',
    save: 'Save',
    saving: 'Saving…',
    loading: 'Loading…',
    readOnly: 'Credentials are read-only in this profile.',
    saveFailed: 'The PAT could not be stored. Try again.',
    integrations: 'Integrations & display',
    quotaToggle: 'Show the quota card in the sidebar',
    quotaToggleHint: 'Off by default; while off the sidebar renders no card and no background quota refresh runs.',
    quotaToggleFailed: 'The toggle could not be stored. Try again.',
  } as Record<string, string>)[key] ?? key
}

/** Render one Qoder Models-card occurrence. */
export function QoderProviderCard(props: QoderProviderCardProps): React.ReactElement {
  const t = props.t ?? defaultText
  const quota = props.quotaSettings
  const [snapshot, setSnapshot] = useState(() => props.credential.getSnapshot())
  const [quotaSnapshot, setQuotaSnapshot] = useState<QoderQuotaSettingsSnapshot | undefined>(
    () => quota?.getSnapshot(),
  )
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState(false)
  const [quotaBusy, setQuotaBusy] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    setSnapshot(props.credential.getSnapshot())
    return props.credential.subscribe(() => setSnapshot(props.credential.getSnapshot()))
  }, [props.credential])

  useEffect(() => {
    if (quota === undefined) return undefined
    setQuotaSnapshot(quota.getSnapshot())
    return quota.subscribe(() => setQuotaSnapshot(quota.getSnapshot()))
  }, [quota])

  const configured = snapshot.loading ? props.keyConfigured === true : snapshot.configured
  const disabled = saving || !snapshot.writable
  const save = async (): Promise<void> => {
    const value = draft.trim()
    if (value.length === 0 || disabled) return
    setSaving(true)
    setFailed(false)
    try {
      const ok = await props.credential.set(value)
      if (ok) setDraft('')
      else setFailed(true)
    } catch {
      setFailed(true)
    } finally {
      setSaving(false)
    }
  }

  const quotaEnabled = quotaSnapshot?.enabled === true
  const quotaReadOnly = quotaSnapshot === undefined
    || quotaSnapshot.loading
    || !quotaSnapshot.writable
  const toggleQuota = async (next: boolean): Promise<void> => {
    if (quota === undefined || quotaReadOnly || quotaBusy) return
    setQuotaBusy(true)
    try {
      await quota.set(next)
    } catch {
      // `set` reports its own failure through the snapshot; nothing to add.
    } finally {
      setQuotaBusy(false)
    }
  }

  return (
    <div ref={rootRef} data-qoder-models-card="true">
      <div style={SECTION_STYLE}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
          <strong>{t('title')}</strong>
          <span>{snapshot.loading ? t('loading') : configured ? t('configured') : t('notConfigured')}</span>
        </div>
        <label style={{ display: 'grid', gap: '4px' }}>
          <span>{t('patLabel')}</span>
          <input
            type="password"
            autoComplete="new-password"
            spellCheck={false}
            value={draft}
            disabled={disabled}
            onChange={(event) => { setDraft(event.target.value); setFailed(false) }}
          />
        </label>
        <small>{snapshot.writable ? t('patHint') : t('readOnly')}</small>
        {snapshot.error !== undefined ? <small role="status">{snapshot.error}</small> : null}
        {failed ? <small role="alert">{t('saveFailed')}</small> : null}
        <div style={{ paddingBottom: '12px', borderBottom: '1px solid rgba(127,127,127,0.28)' }}>
          <button type="button" disabled={disabled || draft.trim().length === 0} onClick={() => { void save() }}>
            {saving ? t('saving') : t('save')}
          </button>
        </div>
      </div>

      {quota === undefined ? null : (
        <section data-qoder-integrations="true" style={{ display: 'grid', gap: '6px', paddingBottom: '12px' }}>
          <strong>{t('integrations')}</strong>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="checkbox"
              data-qoder-quota-toggle="true"
              checked={quotaEnabled}
              disabled={quotaReadOnly || quotaBusy}
              onChange={(event) => { void toggleQuota(event.target.checked) }}
            />
            <span>{t('quotaToggle')}</span>
          </label>
          <small style={{ opacity: 0.75 }}>{t('quotaToggleHint')}</small>
          {quotaSnapshot?.failed === true ? <small role="alert">{t('quotaToggleFailed')}</small> : null}
        </section>
      )}
    </div>
  )
}
