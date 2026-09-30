/**
 * Selector annotations for the Qoder CN model catalog.
 *
 * Qoder's `/algo/api/v2/model/list` already carries every fact the harness
 * model picker can render: a free flag, a relative price factor, vision
 * support, a default context window, and an optional time-windowed off-peak
 * promotion with localized copy. This module turns those server facts into the
 * selector label and decides the picker order (free models first).
 *
 * The DSH 0.2.0 model selector renders model NAMES only: its own README states
 * the `/model` popup shows "provider names as group headings and model names as
 * rows, without repeating the provider on each row or showing catalog
 * descriptions". So the annotations ride `name` — otherwise they would never be
 * displayed — and the same text is also published as `description` for any
 * surface that does read it.
 *
 * The annotation line is deliberately a Chinese/English pair rather than
 * hard-coded English: `promotion.badge` arrives localized from Qoder, so the
 * caller passes the harness display language through.
 * @module dsh-provider-qoder/annotate
 */

/** One localized string pair as Qoder sends it. */
export interface QoderLocalizedText {
  zh?: string
  en?: string
}

/** A time-windowed discount on one model. */
export interface QoderModelPromotion {
  /**
   * Whether the discount is running right now. Qoder publishes the block for
   * the whole day, so an off-peak promotion reads `false` during peak hours —
   * the label still shows it, marked as not yet in effect.
   */
  active?: boolean
  /** Short localized badge, e.g. `错峰2折` / `Off-Peak 80% off`. */
  badge: QoderLocalizedText
  /** One-line localized explanation, when Qoder sends one. */
  description?: QoderLocalizedText
  /** Local wall-clock start of the off-peak window, e.g. `22:00`. */
  windowStart?: string
  /** Local wall-clock end of the off-peak window, e.g. `08:00`. */
  windowEnd?: string
  /** IANA zone the window is expressed in, e.g. `Asia/Shanghai`. */
  timezone?: string
  /** Price multiplier during the window (0.2 = 20% of the list price). */
  discountFactor?: number
}

/** Display language the harness is currently using. */
export type QoderLang = 'zh' | 'en'

/** The catalog fields the selector annotations read. */
export interface AnnotatableModel {
  /** Deployment-facing model id. */
  id: string
  /** Selector label. */
  name?: string
  /** Known context capacity, in tokens. */
  contextWindow?: number
  /** Accepted request modalities; absent means text only. */
  inputModalities?: readonly ('text' | 'image')[]
  /** Model costs no credits. */
  free?: boolean
  /** Relative credit cost per token. */
  priceFactor?: number
  /** Active off-peak promotion. */
  promotion?: QoderModelPromotion
  /**
   * The plan tier this model needs, supplied by the operator's own map: Qoder
   * CN decides model availability server-side and publishes no per-model tier,
   * so this label is never guessed — an unmapped model simply carries none.
   */
  plan?: string
  /** A hand-written description, which replaces the generated annotation line. */
  description?: string
}

function recordOf(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined
}

function trimmed(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined
}

function positiveNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined
}

function readLocalized(value: unknown): QoderLocalizedText | undefined {
  const record = recordOf(value)
  if (record === undefined) return undefined
  const zh = trimmed(record.zh)
  const en = trimmed(record.en)
  return zh === undefined && en === undefined ? undefined : { ...zh === undefined ? {} : { zh }, ...en === undefined ? {} : { en } }
}

/** Pick the localized string for one language, falling back to the other. */
export function localizedText(value: QoderLocalizedText | undefined, lang: QoderLang): string | undefined {
  if (value === undefined) return undefined
  return lang === 'zh' ? value.zh ?? value.en : value.en ?? value.zh
}

/**
 * Read Qoder's `promotion` block. A block is kept whenever it names a discount
 * or a window, whether or not it is in effect right now: the copy the user
 * asked for is the advertised discount itself, and Qoder sends `active: false`
 * for every off-peak promotion outside its own window — dropping those hid
 * exactly the discounts worth showing.
 * @param raw - the raw `promotion` field of one model entry.
 * @returns the normalized promotion, or `undefined` when there is none to show.
 */
export function parsePromotion(raw: unknown): QoderModelPromotion | undefined {
  const record = recordOf(raw)
  if (record === undefined) return undefined
  const badge = readLocalized(record.badge)
  const description = readLocalized(record.description)
  const windowStart = trimmed(record.window_start)
  const windowEnd = trimmed(record.window_end)
  if (badge === undefined && (windowStart === undefined || windowEnd === undefined)) return undefined
  return {
    ...typeof record.active === 'boolean' ? { active: record.active } : {},
    badge: badge ?? {},
    ...description === undefined ? {} : { description },
    ...windowStart === undefined ? {} : { windowStart },
    ...windowEnd === undefined ? {} : { windowEnd },
    ...trimmed(record.timezone) === undefined ? {} : { timezone: trimmed(record.timezone) as string },
    ...positiveNumber(record.discount_factor) === undefined
      ? {}
      : { discountFactor: positiveNumber(record.discount_factor) as number },
  }
}

/**
 * Render a token count the way the picker reads it: `1M`, `400K`, `96K`.
 * @param tokens - a context capacity in tokens.
 * @returns the compact label, or `undefined` when the count is unusable.
 */
export function formatContextWindow(tokens: number | undefined): string | undefined {
  if (tokens === undefined || !Number.isFinite(tokens) || tokens <= 0) return undefined
  if (tokens >= 1_000_000) {
    const millions = tokens / 1_000_000
    return `${Number.isInteger(millions) ? millions : Number(millions.toFixed(1))}M`
  }
  if (tokens >= 1_000) return `${Math.round(tokens / 1_000)}K`
  return String(tokens)
}

/** The off-peak window as `22:00-08:00`, present only when both ends are known. */
function promotionWindow(promotion: QoderModelPromotion): string | undefined {
  if (promotion.windowStart === undefined || promotion.windowEnd === undefined) return undefined
  return `${promotion.windowStart}-${promotion.windowEnd}`
}

/**
 * Render a relative credit price the way the server states it: `0.1`, `0.5`,
 * `1.4`. The value is quoted verbatim instead of being converted to a Chinese
 * 折 figure, because it is the number Qoder's own pricing pages and the account
 * usage panel use.
 * @param factor - the model's `price_factor`.
 * @returns the compact multiplier text.
 */
export function formatPriceFactor(factor: number): string {
  return String(Number(factor.toFixed(3)))
}

/**
 * The selector annotation parts, in picker order: required plan, credit
 * multiplier, FREE badge, off-peak discount, vision support, context window.
 * @param model - one catalog model.
 * @param lang - the harness display language.
 * @returns the non-empty annotation parts.
 */
export function modelAnnotationParts(model: AnnotatableModel, lang: QoderLang): string[] {
  const parts: string[] = []
  const plan = trimmed(model.plan)
  if (plan !== undefined) parts.push(plan)
  const priceFactor = model.priceFactor
  if (priceFactor !== undefined && Number.isFinite(priceFactor) && priceFactor > 0) {
    parts.push(`${formatPriceFactor(priceFactor)}×${lang === 'zh' ? '积分' : ' credits'}`)
  }
  if (model.free === true) parts.push('FREE')
  const promotion = model.promotion
  if (promotion !== undefined) {
    const badge = localizedText(promotion.badge, lang)
      ?? (promotion.discountFactor === undefined
        ? undefined
        : (lang === 'zh' ? '错峰' : 'Off-peak'))
    const window = promotionWindow(promotion)
    const label = badge === undefined ? window : window === undefined ? badge : `${badge}(${window})`
    if (label !== undefined) {
      // `active: false` is the server saying the discount is off right now; an
      // unstated flag is not evidence of that, so it must not be labelled.
      parts.push(promotion.active === false
        ? `${label} ${lang === 'zh' ? '未生效' : 'not in effect'}`
        : label)
    }
  }
  if (model.inputModalities?.includes('image') === true) parts.push(lang === 'zh' ? '图像' : 'Image')
  const context = formatContextWindow(model.contextWindow)
  if (context !== undefined) parts.push(context)
  return parts
}

/**
 * The one-line selector detail for a model: its hand-written description when
 * it has one, otherwise the generated annotation line.
 * @param model - one catalog model.
 * @param lang - the harness display language.
 * @returns the description, or `undefined` when there is nothing to annotate.
 */
export function modelDescription(model: AnnotatableModel, lang: QoderLang): string | undefined {
  const explicit = trimmed(model.description)
  if (explicit !== undefined) return explicit
  const parts = modelAnnotationParts(model, lang)
  return parts.length === 0 ? undefined : parts.join(' · ')
}

/**
 * The selector row label: the model's own name followed by its annotations.
 * The DSH 0.2.0 selector renders names only, so this is the one channel that
 * makes the annotations visible — in the composer seat, the `/model` popup, and
 * the fuzzy search all at once. A model with nothing to annotate keeps its bare
 * name, and an unnamed model falls back to its id.
 * @param model - one catalog model.
 * @param lang - the harness display language.
 * @returns the label to show in the model selector.
 */
export function modelSelectorLabel(model: AnnotatableModel, lang: QoderLang): string {
  const base = trimmed(model.name) ?? model.id
  const parts = modelAnnotationParts(model, lang)
  return parts.length === 0 ? base : `${base} · ${parts.join(' · ')}`
}

/**
 * Picker order: free models first, then by display name, then by id. Free
 * models cost no credits, so they are usable by every account and are the ones
 * a user should meet first.
 * @param a - left model.
 * @param b - right model.
 * @returns a negative, zero, or positive comparison result.
 */
export function compareModelsForSelector(a: AnnotatableModel, b: AnnotatableModel): number {
  const freeDelta = Number(b.free === true) - Number(a.free === true)
  if (freeDelta !== 0) return freeDelta
  const nameDelta = (a.name ?? a.id).localeCompare(b.name ?? b.id)
  if (nameDelta !== 0) return nameDelta
  return a.id.localeCompare(b.id)
}
