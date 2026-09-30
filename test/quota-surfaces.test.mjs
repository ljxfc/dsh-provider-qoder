import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import {
  daysUntil,
  formatCredits,
  formatYearSpan,
  joinParts,
  percentOf,
  QUOTA_CSS,
  QUOTA_CSS_ID,
  ringDashOffset,
  RING_CIRCUMFERENCE,
  usedRatio,
} from '../dist/index.js'

/** Strip comments, then split top-level rules by brace matching. */
function rulesOf(source) {
  const css = source.replaceAll(/\/\*[\s\S]*?\*\//g, '')
  const rules = []
  let index = 0
  while (index < css.length) {
    const open = css.indexOf('{', index)
    if (open === -1) break
    let depth = 1
    let cursor = open + 1
    while (cursor < css.length && depth > 0) {
      if (css[cursor] === '{') depth += 1
      else if (css[cursor] === '}') depth -= 1
      cursor += 1
    }
    rules.push({ selector: css.slice(index, open).trim(), body: css.slice(open + 1, cursor - 1) })
    index = cursor
  }
  return rules
}

const SHEET = rulesOf(QUOTA_CSS)
const FLAT = SHEET.flatMap((rule) =>
  rule.selector.startsWith('@media')
    ? rulesOf(rule.body).map((inner) => ({ ...inner, at: rule.selector }))
    : [rule])

test('the stylesheet only reaches our own markup, bar one justified anchor', () => {
  // The sheet is global CSS injected into the shell document. Every selector a
  // rule can win with must therefore be qualified by one of our own classes, or
  // it would restyle harness markup.
  const unqualified = FLAT.flatMap((rule) => rule.selector.split(','))
    .map((selector) => selector.trim())
    .filter((selector) => selector !== '' && !selector.startsWith('.qcp-'))
  assert.deepEqual(unqualified, ['[class*="_footArea"] [class*="_footerActions"]'])
})

test('the one anchor rule stacks the footer list, which is what fits the card', () => {
  const anchor = FLAT.find((rule) => rule.selector.includes('_footerActions'))
  assert.ok(anchor !== undefined)
  assert.equal(anchor.selector, '[class*="_footArea"] [class*="_footerActions"]')
  assert.equal(anchor.body.trim(), 'flex-direction:column')
  // Both halves of the anchor are load-bearing: `_footerActions` alone is a stem
  // dsh-client-ui-user-questions also renders, so qualifying it by `_footArea`
  // is what keeps this rule off every other button row in the app.
  assert.match(anchor.selector, /\[class\*="_footArea"\]/)
})

test('every theme alias carries a fallback', () => {
  // Measured on dsh 0.2.0-rc.2 the aliases resolve on `body`, but a host that
  // renames or drops one must still paint something readable.
  const bare = QUOTA_CSS.match(/var\(\s*--dsw-alias-[a-z0-9-]+\s*\)/g)
  assert.equal(bare, null)
  assert.match(QUOTA_CSS, /var\(--dsw-alias-label-primary,\s*#0f1115\)/)
})

test('the sheet spends its budget on layout, not on effects', () => {
  // The surfaces sit in the sidebar footer, so a paint-heavy sheet would be
  // paid for on every sidebar render, not just while the panel is open.
  assert.doesNotMatch(QUOTA_CSS, /!important/)
  assert.doesNotMatch(QUOTA_CSS, /box-shadow|backdrop-filter|filter:|animation:/)
  // Only a declaration rule counts here; the media query above merely repeats
  // the one selector, and the flattening below inspects it separately.
  const animated = SHEET.filter((rule) => !rule.selector.startsWith('@') && rule.body.includes('transition'))
  assert.deepEqual(animated.map((rule) => rule.selector), ['.qcp-fill'])
  // ...and that one transition is dropped for reduced-motion users.
  const media = SHEET.find((rule) => rule.selector.startsWith('@media'))
  assert.equal(media?.selector, '@media (prefers-reduced-motion:reduce)')
  const reduced = rulesOf(media.body)
  assert.deepEqual(reduced.map((rule) => rule.selector.trim()), ['.qcp-fill'])
  assert.equal(reduced[0].body.trim(), 'transition:none')
})

test('the ring draws from twelve o-clock and closes exactly', () => {
  // The dash array is the full circumference, so an offset of 0 is a closed ring
  // and an offset of the circumference is none of it.
  assert.ok(Math.abs(ringDashOffset(0) - RING_CIRCUMFERENCE) < 1e-3)
  assert.equal(ringDashOffset(100), 0)
  assert.ok(Math.abs(ringDashOffset(50) - RING_CIRCUMFERENCE / 2) < 1e-3)
  assert.equal(ringDashOffset(150), 0)
  assert.equal(ringDashOffset(-5), ringDashOffset(0))
  // A broken figure must paint an empty ring, not a NaN dash that blanks the svg.
  assert.equal(ringDashOffset(Number.NaN), ringDashOffset(0))
  assert.equal(RING_CIRCUMFERENCE, 2 * Math.PI * 7.25)
})

test('an unknown cap never paints as a full pool', () => {
  assert.equal(usedRatio(50, 100), 0.5)
  assert.equal(usedRatio(500, 100), 1)
  assert.equal(usedRatio(-5, 100), 0)
  // No usable cap: the account's own percentage stands in.
  assert.equal(usedRatio(50, 0, 0.3), 0.3)
  assert.equal(usedRatio(50, -1, 0.3), 0.3)
  assert.equal(usedRatio(50, 0), 0)
  assert.equal(usedRatio(Number.NaN, 10, 0.4), 0.4)
  assert.equal(usedRatio(10, Number.NaN, Number.NaN), 0)
})

test('percentages and credits render the way the surfaces print them', () => {
  assert.equal(percentOf(0.084), 8)
  assert.equal(percentOf(0.0849), 8)
  assert.equal(percentOf(1.5), 100)
  assert.equal(percentOf(-1), 0)
  assert.equal(percentOf(Number.NaN), 0)
  assert.equal(formatCredits(229), '229')
  assert.equal(formatCredits(0.256), '0.26')
  assert.equal(formatCredits(12.5), '12.5')
  assert.equal(formatCredits(Number.NaN), '—')
})

test('a due reset drops its caption instead of counting down to zero', () => {
  const day = 86_400_000
  const now = 1_700_000_000_000
  assert.equal(daysUntil(now + day, now), 1)
  assert.equal(daysUntil(now + day * 24, now), 24)
  assert.equal(daysUntil(now, now), undefined)
  assert.equal(daysUntil(now - 1, now), undefined)
  assert.equal(daysUntil(undefined, now), undefined)
  assert.equal(daysUntil(Number.NaN, now), undefined)
})

test('a cycle spanning new year names both years', () => {
  const december = new Date(2026, 11, 28).getTime()
  const january = new Date(2027, 0, 27).getTime()
  assert.equal(formatYearSpan(december, january), '2026 → 2027')
  assert.equal(formatYearSpan(december, new Date(2026, 11, 31).getTime()), '2026')
  assert.equal(formatYearSpan(december, undefined), '2026')
  assert.equal(formatYearSpan(undefined, january), undefined)
  assert.equal(formatYearSpan(Number.NaN, january), undefined)
})

test('a subtitle drops the parts the account did not report', () => {
  assert.equal(joinParts(['teams', undefined, 'Member']), 'teams · Member')
  assert.equal(joinParts(['teams', '', 'Member']), 'teams · Member')
  assert.equal(joinParts([]), '')
  assert.equal(joinParts([undefined, undefined]), '')
})

test('injection is by stylesheet id, so a second apply is a no-op', async () => {
  // The id is the whole idempotence mechanism: two sheets under one id would
  // make the second injection silently skip, and two under different ids would
  // let a disabled plugin leave rules behind.
  const client = await readFile(new URL('../dist/client.js', import.meta.url), 'utf8')
  assert.match(client, /data-plugin-css/)
  assert.ok(client.includes(QUOTA_CSS_ID))
  // The rail and expanded forms both ship, and the rail is selected by `wide`.
  assert.match(client, /qcp-rail/)
  assert.match(client, /qcp-foot/)
  assert.match(client, /wide/)
  // The rolling-window widget is gone, not merely hidden.
  assert.doesNotMatch(client, /spend|usageLedger|5h\b/i)
})
