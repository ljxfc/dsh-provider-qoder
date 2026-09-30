/**
 * The one stylesheet both quota surfaces wear.
 *
 * Returned as a string rather than injected here, so importing this module has
 * no DOM side effect: `./client/index.ts` installs it once under
 * {@link QUOTA_CSS_ID} and the fiber removes it again.
 *
 * These rules are GLOBAL CSS, so containment is a contract: every selector is
 * qualified by one of our own `qcp-` classes except the sidebar anchor below,
 * which carries its justification in place. `test/quota-surfaces.test.mjs`
 * parses this string and enforces that, which is why the module sits beside the
 * host entry (`./index.ts` re-exports it) instead of under `./client/`: the
 * browser half imports it, the host build only carries the string, and the
 * containment test can therefore read the real stylesheet without a DOM.
 * Colours are harness theme aliases
 * with neutral fallbacks — measured against dsh 0.2.0-rc.2, where the aliases
 * resolve on `body` and inherit (`label-primary #0f1115`, `label-secondary
 * #61666b`, `label-tertiary #81858c`, `brand-primary #0f1115`, `border-l2
 * #0000001a`, `interactive-bg-hover #2631480f`, `bg-module-platform #f5f6f7`,
 * `state-error-primary #ec1313`) — so a missing alias degrades to a value that
 * still reads in either theme. Bars mix `currentColor` rather than naming a
 * grey, which keeps the track legible when the theme flips to dark.
 *
 * @module dsh-provider-qoder/quota-styles
 */

/**
 * Stylesheet id — the `data-plugin-css` value that makes injection idempotent.
 * It must stay distinct from any other sheet this package installs, since a
 * shared id would make the second injection a no-op.
 */
export const QUOTA_CSS_ID = 'dsh-provider-qoder/QuotaSurfaces.module.css'

/** The panel / sidebar stylesheet. */
export const QUOTA_CSS = `
/* ------------------------------------------------- sidebar footer entry */
/* LOAD-BEARING (and the only unqualified rule here): the shell stacks this
   list ABOVE the Settings seat and lays the list itself out as a flex ROW. An
   occupant that declares a full-width line cannot shrink, so as a row it
   overflows the column — measured on 0.2.0-rc.2 in the collapsed rail: the row
   was 76px wide at x=-10.5 inside a 35px foot area, which is why the card used
   to hang off the left edge of the sidebar. The ANCHOR is load-bearing too:
   "footerActions" is not a stem this shell owns alone (dsh-client-ui-user-questions
   renders a dialog's button row under the same stem, and an unqualified rule
   would stack that row's side-by-side buttons on every page), so it is
   qualified by "footArea", which the sidebar declares alone. The descendant
   combinator survives a wrapper element appearing between the two. */
[class*="_footArea"] [class*="_footerActions"]{flex-direction:column}

/* The 56px rail: one icon button carrying the ring, matching the shell's own
   rail geometry (its Settings seat measures 36px). */
.qcp-rail{box-sizing:border-box;display:inline-flex;flex:0 0 auto;align-items:center;justify-content:center;width:36px;height:36px;margin:0 0 4px;padding:0;font:inherit;color:var(--dsw-alias-label-secondary,#61666b);cursor:pointer;background:0 0;border:1px solid transparent;border-radius:8px}
.qcp-rail:hover{color:var(--dsw-alias-label-primary,#0f1115);background:var(--dsw-alias-interactive-bg-hover,#2631480f)}
.qcp-rail:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#0f1115);outline-offset:1px}

/* Expanded column: deliberately quiet — a surface beside Settings should read
   as part of the column — with one hover step and a hairline border. */
.qcp-foot{box-sizing:border-box;display:flex;flex:0 0 auto;flex-direction:column;gap:6px;width:100%;min-width:0;margin:0 0 4px;padding:8px;font:inherit;color:var(--dsw-alias-label-secondary,#61666b);text-align:left;cursor:pointer;background:0 0;border:1px solid transparent;border-radius:10px}
.qcp-foot:hover{color:var(--dsw-alias-label-primary,#0f1115);background:var(--dsw-alias-interactive-bg-hover,#2631480f);border-color:var(--dsw-alias-border-l2,#0000001a)}
.qcp-foot:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#0f1115);outline-offset:1px}
.qcp-top{display:flex;align-items:center;gap:8px;min-width:0}
.qcp-glyph{display:inline-flex;flex:0 0 auto;align-items:center;justify-content:center;color:var(--dsw-alias-brand-primary,#0f1115)}
.qcp-name{flex:0 1 auto;min-width:0;overflow:hidden;color:var(--dsw-alias-label-primary,#0f1115);font-size:13px;font-weight:500;line-height:20px;text-overflow:ellipsis;white-space:nowrap}
.qcp-spacer{flex:1 1 auto;min-width:0}
.qcp-badge{flex:0 0 auto;max-width:52%;overflow:hidden;padding:1px 8px;color:var(--dsw-alias-brand-primary,#0f1115);font-size:11px;font-weight:600;line-height:16px;text-overflow:ellipsis;white-space:nowrap;background:var(--dsw-alias-bg-module-platform,#f5f6f7);border-radius:999px}
.qcp-badgeWarn{color:var(--dsw-alias-state-error-primary,#ec1313)}

/* One usage line: the label and its figures on a head row, the bar UNDER it —
   stacking the two lets the card show the credits without squeezing the bar
   into whatever is left beside them. */
.qcp-row{display:flex;flex-direction:column;gap:4px;min-width:0}
.qcp-rowHead{display:flex;flex-wrap:wrap;align-items:baseline;gap:8px;min-width:0}
.qcp-rowLabel{flex:1 1 auto;min-width:5em;overflow:hidden;color:var(--dsw-alias-label-tertiary,#81858c);font-size:11px;line-height:16px;text-overflow:ellipsis;white-space:nowrap}
.qcp-rowAmount{flex:0 0 auto;margin-left:auto;color:var(--dsw-alias-label-secondary,#61666b);font-size:11px;line-height:16px;font-variant-numeric:tabular-nums;white-space:nowrap}
.qcp-rowPct{flex:0 0 auto;width:34px;color:var(--dsw-alias-label-secondary,#61666b);font-size:11px;line-height:16px;font-variant-numeric:tabular-nums;text-align:right}
/* display:block is load-bearing: the card's markup stays PHRASING content (it
   renders inside a button), so these are spans — and an inline box ignores
   width, which would collapse the fill to 0x0 and show no usage at all. */
.qcp-bar{display:block;height:5px;overflow:hidden;background:rgba(127,127,127,.22);background:color-mix(in srgb,currentColor 14%,transparent);border-radius:999px}
.qcp-barLg{display:block;height:8px;overflow:hidden;background:rgba(127,127,127,.22);background:color-mix(in srgb,currentColor 14%,transparent);border-radius:999px}
.qcp-fill{display:block;height:100%;background:var(--dsw-alias-brand-primary,#0f1115);border-radius:999px;transition:width .3s ease}
.qcp-fillWarn{background:var(--dsw-alias-state-error-primary,#ec1313)}
.qcp-caption{display:block;min-width:0;overflow:hidden;color:var(--dsw-alias-label-tertiary,#81858c);font-size:11px;line-height:16px;text-overflow:ellipsis;white-space:nowrap}

/* ------------------------------------------------------------- the panel */
.qcp-main{box-sizing:border-box;height:100%;overflow:auto}
.qcp-inner{box-sizing:border-box;display:flex;flex-direction:column;gap:14px;max-width:720px;margin:0 auto;padding:24px 20px 40px}
.qcp-head{display:flex;flex-wrap:wrap;align-items:flex-start;gap:12px}
.qcp-headText{display:flex;flex-direction:column;gap:2px;min-width:0}
.qcp-title{margin:0;color:var(--dsw-alias-label-primary,#0f1115);font-size:18px;font-weight:600;line-height:26px}
.qcp-sub{color:var(--dsw-alias-label-tertiary,#81858c);font-size:12px;line-height:18px}
.qcp-actions{display:flex;flex:0 0 auto;flex-wrap:wrap;align-items:center;justify-content:flex-end;gap:6px;margin-left:auto}
.qcp-meta{color:var(--dsw-alias-label-tertiary,#81858c);font-size:11px;line-height:16px;font-variant-numeric:tabular-nums;white-space:nowrap}
.qcp-button{box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;height:28px;padding:0 12px;font:inherit;font-size:12px;line-height:20px;color:var(--dsw-alias-label-secondary,#61666b);white-space:nowrap;cursor:pointer;background:0 0;border:1px solid var(--dsw-alias-border-l2,#0000001a);border-radius:999px}
.qcp-button:hover:not(:disabled){color:var(--dsw-alias-label-primary,#0f1115);background:var(--dsw-alias-interactive-bg-hover,#2631480f)}
.qcp-button:disabled{cursor:default;opacity:.5}
.qcp-button:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#0f1115);outline-offset:1px}
.qcp-iconButton{box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;padding:0;font:inherit;font-size:16px;line-height:1;color:var(--dsw-alias-label-secondary,#61666b);cursor:pointer;background:0 0;border:1px solid transparent;border-radius:8px}
.qcp-iconButton:hover{color:var(--dsw-alias-label-primary,#0f1115);background:var(--dsw-alias-interactive-bg-hover,#2631480f)}
.qcp-iconButton:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#0f1115);outline-offset:1px}
.qcp-card{box-sizing:border-box;display:flex;flex-direction:column;gap:14px;padding:16px 18px;background:var(--dsw-alias-bg-layer-1,#fff);border:1px solid var(--dsw-alias-border-l2,#0000001a);border-radius:14px}
.qcp-identity{display:flex;align-items:center;gap:10px;min-width:0}
.qcp-avatar{display:inline-flex;flex:0 0 auto;align-items:center;justify-content:center;width:28px;height:28px;color:var(--dsw-alias-brand-primary,#0f1115);font-size:12px;font-weight:600;background:var(--dsw-alias-bg-module-platform,#f5f6f7);border-radius:50%}
.qcp-idText{display:flex;flex-direction:column;gap:1px;min-width:0}
.qcp-planName{overflow:hidden;color:var(--dsw-alias-label-primary,#0f1115);font-size:13px;font-weight:600;line-height:20px;text-overflow:ellipsis;white-space:nowrap}
.qcp-planOwner{overflow:hidden;color:var(--dsw-alias-label-tertiary,#81858c);font-size:11px;line-height:16px;text-overflow:ellipsis;white-space:nowrap}
.qcp-divider{height:1px;flex:0 0 auto;background:var(--dsw-alias-border-l2,#0000001a)}
.qcp-block{display:flex;flex-direction:column;gap:8px;min-width:0}
.qcp-blockTitle{color:var(--dsw-alias-label-tertiary,#81858c);font-size:11px;font-weight:600;line-height:16px;letter-spacing:.04em}
.qcp-window{display:flex;flex-direction:column;gap:6px;min-width:0}
/* Both figure rows WRAP rather than starve their own label. Measured in a 220px
   center column, a label with min-width:0 shrank to nothing and the line read as
   two bare numbers; wrapping instead pushes the figures onto a second line,
   right-aligned by the auto margin, which still says what the numbers are. */
.qcp-windowHead{display:flex;flex-wrap:wrap;align-items:baseline;gap:8px;min-width:0}
.qcp-windowLabel{flex:1 1 auto;min-width:6em;overflow:hidden;color:var(--dsw-alias-label-secondary,#61666b);font-size:12px;line-height:18px;text-overflow:ellipsis;white-space:nowrap}
.qcp-windowValue{flex:0 0 auto;margin-left:auto;color:var(--dsw-alias-label-secondary,#61666b);font-size:12px;line-height:18px;font-variant-numeric:tabular-nums;white-space:nowrap}
.qcp-windowPct{flex:0 0 auto;min-width:38px;color:var(--dsw-alias-label-primary,#0f1115);font-size:12px;font-weight:600;line-height:18px;font-variant-numeric:tabular-nums;text-align:right}
.qcp-tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px}
.qcp-tile{box-sizing:border-box;display:flex;flex-direction:column;gap:2px;min-width:0;padding:8px 10px;background:var(--dsw-alias-bg-layer-1,#fff);border:1px solid var(--dsw-alias-border-l2,#0000001a);border-radius:8px}
.qcp-tileLabel{color:var(--dsw-alias-label-tertiary,#81858c);font-size:11px;line-height:16px}
.qcp-tileValue{overflow:hidden;color:var(--dsw-alias-label-primary,#0f1115);font-size:15px;font-weight:600;line-height:22px;font-variant-numeric:tabular-nums;text-overflow:ellipsis;white-space:nowrap}
.qcp-tileValueSm{font-size:12px;line-height:18px}
.qcp-tileSub{overflow:hidden;color:var(--dsw-alias-label-tertiary,#81858c);font-size:11px;line-height:16px;text-overflow:ellipsis;white-space:nowrap}
.qcp-alert{box-sizing:border-box;display:flex;flex-direction:column;gap:4px;padding:10px 12px;color:var(--dsw-alias-state-error-primary,#ec1313);font-size:12px;line-height:18px;background:rgba(236,19,19,.06);border:1px solid var(--dsw-alias-state-error-primary,#ec1313);border-radius:12px}
.qcp-alertDetail{color:var(--dsw-alias-label-secondary,#61666b);font-size:11px;line-height:16px;word-break:break-word}
.qcp-note{color:var(--dsw-alias-label-tertiary,#81858c);font-size:11px;line-height:16px}
.qcp-panelFoot{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:2px}
.qcp-link{color:var(--dsw-alias-label-secondary,#61666b);font-size:12px;line-height:18px;text-decoration:none;border-bottom:1px solid var(--dsw-alias-border-l2,#0000001a)}
.qcp-link:hover{color:var(--dsw-alias-label-primary,#0f1115);border-bottom-color:currentColor}

@media (prefers-reduced-motion:reduce){.qcp-fill{transition:none}}
`

/** Install one stylesheet by id; the returned disposer removes it. */
export function injectQuotaStyles(id: string = QUOTA_CSS_ID, css: string = QUOTA_CSS): () => void {
  if (typeof document === 'undefined') return () => {}
  if (document.querySelector(`style[data-plugin-css="${id}"]`) !== null) return () => {}
  const tag = document.createElement('style')
  tag.dataset.plugin = 'dsh-provider-qoder'
  tag.dataset.pluginCss = id
  tag.textContent = css
  document.head.appendChild(tag)
  return () => { tag.remove() }
}
