/**
 * Presentation math shared by the two quota surfaces, kept free of React and
 * of the DOM so it can be unit-tested from the host build (`./index.ts`
 * re-exports this module) instead of only through the bundled browser half.
 *
 * Everything here is total: a missing or non-finite number yields a drawable
 * value rather than `NaN`, because these figures feed `width:` and
 * `stroke-dashoffset`, where one `NaN` silently blanks the whole bar or ring.
 *
 * @module dsh-provider-qoder/quota-view
 */

/** SVG geometry of the ring. A 20-unit box with r=7.25 leaves room for the stroke. */
export const RING_RADIUS = 7.25

/** Arc length a full ring draws, i.e. the `stroke-dasharray` both circles use. */
export const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS

/** Clamp a 0–100 percentage; non-finite input reads as 0. */
export function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(100, Math.max(0, value))
}

/** A 0–1 ratio as a rounded whole percentage. */
export function percentOf(ratio: number): number {
  return Math.round(clampPercent(ratio * 100))
}

/**
 * The `stroke-dashoffset` that leaves `percent` of the ring drawn. Rounded to
 * three decimals so the attribute text stays stable between renders.
 */
export function ringDashOffset(percent: number, circumference: number = RING_CIRCUMFERENCE): number {
  return Math.round(circumference * (1 - clampPercent(percent) / 100) * 1e3) / 1e3
}

/**
 * Used-over-cap as a 0–1 ratio, falling back to the account's own reported
 * percentage when the cap is unknown (`≤ 0`) or the pair is not finite — an
 * unknown cap must not paint as a full bar.
 */
export function usedRatio(used: number, total: number, fallback = 0): number {
  const usable = Number.isFinite(used) && Number.isFinite(total) && total > 0 ? used / total : fallback
  if (!Number.isFinite(usable)) return 0
  return Math.min(1, Math.max(0, usable))
}

/** Credits, trimmed of float noise and of trailing zeros: `229`, `0.26`, `12.5`. */
export function formatCredits(value: number): string {
  if (!Number.isFinite(value)) return '—'
  // Rounding to currency precision is also what removes binary-float noise, so
  // 0.1 + 0.2 prints as `0.3` rather than `0.30000000000000004`.
  return String(Math.round(value * 100) / 100)
}

function locale(lang: string): string {
  return lang === 'zh' ? 'zh-CN' : 'en-US'
}

/** Full date and time, or undefined when the account reports no deadline. */
export function formatMoment(ms: number | undefined, lang: string): string | undefined {
  if (ms === undefined || !Number.isFinite(ms)) return undefined
  try {
    return new Date(ms).toLocaleString(locale(lang), {
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    })
  } catch {
    return new Date(ms).toISOString()
  }
}

/** Year, month and day only — for a tile that has one line to spend. */
export function formatDay(ms: number | undefined, lang: string): string | undefined {
  if (ms === undefined || !Number.isFinite(ms)) return undefined
  try {
    return new Date(ms).toLocaleDateString(locale(lang), { year: 'numeric', month: '2-digit', day: '2-digit' })
  } catch {
    return new Date(ms).toISOString().slice(0, 10)
  }
}

/** Month and day only — half of a cycle range, which must fit one tile line. */
export function formatShortDay(ms: number | undefined, lang: string): string | undefined {
  if (ms === undefined || !Number.isFinite(ms)) return undefined
  try {
    return new Date(ms).toLocaleDateString(locale(lang), { month: '2-digit', day: '2-digit' })
  } catch {
    return new Date(ms).toISOString().slice(5, 10)
  }
}

/**
 * The year(s) a cycle falls in: `2026`, or `2026 → 2027` when it straddles new
 * year — a bare start year would misdate the far end of a December cycle.
 */
export function formatYearSpan(start: number | undefined, end: number | undefined): string | undefined {
  const from = yearOf(start)
  if (from === undefined) return undefined
  const to = yearOf(end)
  return to === undefined || to === from ? from : `${from} → ${to}`
}

function yearOf(ms: number | undefined): string | undefined {
  if (ms === undefined || !Number.isFinite(ms)) return undefined
  return String(new Date(ms).getFullYear())
}

/**
 * Whole days from `now` until `until`, or undefined once the moment has passed
 * (a reset that is due is not "in 0 days" — the surface drops the caption).
 */
export function daysUntil(until: number | undefined, now: number): number | undefined {
  if (until === undefined || !Number.isFinite(until) || until <= now) return undefined
  return Math.ceil((until - now) / 86_400_000)
}

/** Join the parts of a subtitle, dropping the ones the account did not report. */
export function joinParts(parts: readonly (string | undefined)[], separator = ' · '): string {
  return parts.filter((part): part is string => part !== undefined && part !== '').join(separator)
}
