/**
 * Qoder's credential editor for the dsh 0.1.7 Models page.
 *
 * dsh 0.1.7 renders an unknown provider family with a generic editor that has
 * no API-key field. This keyed provider-card slot supplies that one missing
 * control and writes the PAT through the Host credentials service. The PAT is
 * never put into the settings document or echoed back into the input.
 */

import * as React from 'react'
import { useEffect, useRef, useState } from 'react'

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
  provider?: { active?: boolean }
  keyConfigured?: boolean
}

const HIDDEN_STYLE = { display: 'none' } as const
const CARD_SLOT = 'settings.models.provider-card'

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
  } as Record<string, string>)[key] ?? key
}

/** Find the official unknown-family editor beside this slot outlet. */
export function adjacentEditorCard(wrapper: { previousElementSibling?: unknown; nextElementSibling?: unknown } | null): { style?: { display?: string }; className?: unknown } | null {
  if (wrapper === null) return null
  for (const sibling of [wrapper.previousElementSibling, wrapper.nextElementSibling]) {
    if (sibling === null || typeof sibling !== 'object') continue
    const candidate = sibling as { className?: unknown }
    if (typeof candidate.className === 'string' && candidate.className.includes('editor')) return candidate
  }
  return null
}

/** Render one Qoder Models-card occurrence. */
export function QoderProviderCard(props: QoderProviderCardProps): React.ReactElement {
  const t = props.t ?? defaultText
  const [snapshot, setSnapshot] = useState(() => props.credential.getSnapshot())
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState(false)
  const [editorOpen, setEditorOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    setSnapshot(props.credential.getSnapshot())
    return props.credential.subscribe(() => setSnapshot(props.credential.getSnapshot()))
  }, [props.credential])

  useEffect(() => {
    const root = rootRef.current
    if (root === null || typeof MutationObserver === 'undefined') return undefined
    const wrapper = root.closest(`[data-slot="${CARD_SLOT}"]`) ?? root.parentElement
    const row = wrapper?.parentElement
    if (wrapper === null || wrapper === undefined || row === null || row === undefined) {
      setEditorOpen(true)
      return undefined
    }
    let hiddenEditor: { style?: { display?: string } } | null = null
    const sync = () => {
      const editor = adjacentEditorCard(wrapper)
      setEditorOpen(editor !== null)
      if (editor !== null && 'style' in editor && editor.style !== undefined) {
        editor.style.display = 'none'
        hiddenEditor = editor
      }
    }
    sync()
    const observer = new MutationObserver(sync)
    observer.observe(row, { childList: true, subtree: true })
    return () => {
      observer.disconnect()
      if (hiddenEditor?.style !== undefined) hiddenEditor.style.display = ''
    }
  }, [])

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

  return (
    <div
      ref={rootRef}
      data-qoder-models-card="true"
      style={editorOpen ? undefined : HIDDEN_STYLE}
    >
      {editorOpen ? (
        <div style={{ padding: '12px 0', display: 'grid', gap: '8px' }}>
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
          <div>
            <button type="button" disabled={disabled || draft.trim().length === 0} onClick={() => { void save() }}>
              {saving ? t('saving') : t('save')}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
