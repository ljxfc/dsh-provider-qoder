/** Styles stay inside the provider card and use DSH theme tokens with safe fallbacks. */
export const PROVIDER_CSS = `
[data-qoder-models-card] { --qoder-line:var(--dsw-alias-border-l2,rgba(127,127,127,.24)); --qoder-bg:var(--dsw-alias-bg-module-platform,rgba(127,127,127,.055)); color:var(--dsw-alias-label-primary,inherit); font-size:13px; line-height:1.5; width:100%; min-width:0; border:1px solid var(--qoder-line); border-radius:16px; overflow:hidden; background:var(--dsw-alias-bg-module,transparent); }
[data-qoder-models-card] * { box-sizing:border-box; }
[data-qoder-models-card] .qoder-header { padding:22px 24px; display:flex; justify-content:space-between; gap:16px; align-items:center; background:var(--qoder-bg); border-bottom:1px solid var(--qoder-line); }
[data-qoder-models-card] .qoder-brand { display:flex; align-items:center; gap:12px; }
[data-qoder-models-card] .qoder-monogram { background:var(--dsw-alias-brand-primary,#4d6bfe); color:#fff; border-radius:12px; height:42px; width:42px; display:grid; place-items:center; font-size:25px; font-weight:700; }
[data-qoder-models-card] .qoder-title { font-size:18px; font-weight:650; letter-spacing:-.4px; }
[data-qoder-models-card] .qoder-status { border:1px solid var(--qoder-line); border-radius:20px; padding:4px 10px; font-size:12px; }
[data-qoder-models-card] .qoder-section { padding:22px 24px; border-bottom:1px solid var(--qoder-line); display:grid; gap:12px; }
[data-qoder-models-card] .qoder-section:last-child { border-bottom:0; }
[data-qoder-models-card] .qoder-section-heading { display:flex; gap:12px; align-items:center; justify-content:space-between; }
[data-qoder-models-card] h3,[data-qoder-models-card] h4,[data-qoder-models-card] p { margin:0; }
[data-qoder-models-card] h3 { font-size:14px; font-weight:650; }
[data-qoder-models-card] h4 { font-size:12px; opacity:.75; text-transform:uppercase; letter-spacing:.04em; }
[data-qoder-models-card] .qoder-muted,[data-qoder-models-card] small { opacity:.7; font-size:12px; }
[data-qoder-models-card] .qoder-inline { display:flex; gap:8px; align-items:center; }
[data-qoder-models-card] input:not([type=checkbox]),[data-qoder-models-card] select { min-width:0; width:100%; color:inherit; background:var(--qoder-bg); border:1px solid var(--qoder-line); padding:9px 10px; border-radius:8px; font:inherit; }
[data-qoder-models-card] select { color-scheme:light; }
[data-qoder-models-card] select option { color:#20242b; background-color:#fff; }
[data-qoder-models-card] input:focus-visible,[data-qoder-models-card] select:focus-visible,[data-qoder-models-card] button:focus-visible,[data-qoder-models-card] summary:focus-visible { outline:2px solid var(--dsw-alias-brand-primary,#5476de); outline-offset:3px; }
[data-qoder-models-card] button { color:inherit; border:1px solid var(--qoder-line); background:var(--qoder-bg); padding:7px 12px; border-radius:8px; font:inherit; cursor:pointer; white-space:nowrap; }
[data-qoder-models-card] button:hover:not(:disabled) { background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.15)); }
[data-qoder-models-card] :disabled { opacity:.45; cursor:not-allowed; }
[data-qoder-models-card] .qoder-capacity-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:16px; }
[data-qoder-models-card] .qoder-capacity-input,[data-qoder-models-card] label:not(.qoder-toggle) { display:grid; gap:6px; }
[data-qoder-models-card] .qoder-layer { font-size:11px; opacity:.65; }
[data-qoder-models-card] .qoder-subtle { justify-self:start; background:transparent; font-size:12px; }
[data-qoder-models-card] details { border:1px solid var(--qoder-line); border-radius:9px; }
[data-qoder-models-card] summary { padding:11px 12px; cursor:pointer; font-weight:550; }
[data-qoder-models-card] summary small { display:block; font-weight:400; overflow-wrap:anywhere; }
[data-qoder-models-card] .qoder-model { margin:0 12px 12px; padding:0 12px 12px; }
[data-qoder-models-card] .qoder-model>summary { margin:0 -12px 12px; }
[data-qoder-models-card] .qoder-facts { display:grid; grid-template-columns:auto 1fr; gap:6px 14px; font-size:11px; padding:12px 0; margin:0; }
[data-qoder-models-card] dt { opacity:.65; }
[data-qoder-models-card] dd { margin:0; overflow-wrap:anywhere; text-align:right; font-variant-numeric:tabular-nums; }
[data-qoder-models-card] .qoder-warning { color:var(--dsw-alias-state-warning-primary,#b87925); padding:9px 11px; border-left:2px solid currentColor; background:var(--qoder-bg); font-size:12px; }
[data-qoder-models-card] .qoder-success { color:var(--dsw-alias-state-success-primary,#36896a); font-size:12px; }
[data-qoder-models-card] .qoder-toggle { display:flex; gap:10px; align-items:center; }
[data-qoder-models-card] .qoder-quota-number { font-size:25px; font-weight:650; font-variant-numeric:tabular-nums; letter-spacing:-.7px; }
@media(max-width:540px) { [data-qoder-models-card] .qoder-capacity-grid { grid-template-columns:1fr; } [data-qoder-models-card] .qoder-header,[data-qoder-models-card] .qoder-section { padding:16px; } [data-qoder-models-card] .qoder-header { align-items:flex-start; flex-wrap:wrap; } [data-qoder-models-card] .qoder-facts { grid-template-columns:1fr; } [data-qoder-models-card] dd { text-align:left; } }
`
export function injectProviderStyles(): () => void {
  if (typeof document === 'undefined') return () => {}
  const existing = document.getElementById('qoder-provider-styles')
  if (existing) return () => {}
  const style = document.createElement('style')
  style.id = 'qoder-provider-styles'
  style.textContent = PROVIDER_CSS
  document.head.appendChild(style)
  return () => style.remove()
}
