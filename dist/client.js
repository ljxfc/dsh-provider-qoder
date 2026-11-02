window.__ModuleLoader__.load({ id: "dsh-provider-qoder", factory: (require) => { var module = { exports: {} }; var exports = module.exports;
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.ts
var index_exports = {};
__export(index_exports, {
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(index_exports);

// src/usage-wire.ts
var REMOTE_PACKAGE = "dsh-provider-qoder";
var REMOTE_SERVICE = "qoderUsage";
var REMOTE_NAMESPACE = "qoder";
var QUOTA_ENDPOINT = "qoder/quota";
function reject(field) {
  throw new TypeError(`qoder/quota result: invalid ${field}`);
}
function record(value, field) {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value : reject(field);
}
function stringField(source, key) {
  const value = source[key];
  return typeof value === "string" ? value : reject(key);
}
function numberField(source, key) {
  const value = source[key];
  return typeof value === "number" && Number.isFinite(value) ? value : reject(key);
}
function booleanField(source, key) {
  const value = source[key];
  return typeof value === "boolean" ? value : reject(key);
}
function parsePool(value, field) {
  const source = record(value, field);
  return {
    total: numberField(source, "total"),
    used: numberField(source, "used"),
    remaining: numberField(source, "remaining"),
    percentage: numberField(source, "percentage"),
    unit: stringField(source, "unit"),
    available: booleanField(source, "available")
  };
}
function parseQuotaSnapshot(value) {
  const source = record(value, "result");
  const snapshot = {
    planTierName: stringField(source, "planTierName"),
    userType: stringField(source, "userType"),
    isPaidPlan: booleanField(source, "isPaidPlan"),
    isHighestTier: booleanField(source, "isHighestTier"),
    organizationName: stringField(source, "organizationName"),
    organizationRole: stringField(source, "organizationRole"),
    periodStart: numberField(source, "periodStart"),
    periodEnd: numberField(source, "periodEnd"),
    personal: parsePool(source.personal, "personal"),
    usageType: stringField(source, "usageType"),
    totalPercentage: numberField(source, "totalPercentage"),
    isQuotaExceeded: booleanField(source, "isQuotaExceeded"),
    expiresAt: numberField(source, "expiresAt")
  };
  if (source.organizationPool !== void 0) {
    snapshot.organizationPool = parsePool(source.organizationPool, "organizationPool");
  }
  if (source.addOnPool !== void 0) {
    snapshot.addOnPool = parsePool(source.addOnPool, "addOnPool");
  }
  if (source.upgradeUrl !== void 0) {
    snapshot.upgradeUrl = stringField(source, "upgradeUrl");
  }
  return snapshot;
}
var quotaSchema = { parse: parseQuotaSnapshot };
var QUOTA_DESCRIPTOR = {
  id: `${REMOTE_PACKAGE}#${QUOTA_ENDPOINT}`,
  service: REMOTE_SERVICE,
  namespace: REMOTE_NAMESPACE,
  method: "quota",
  invocation: { kind: "direct" },
  parameters: [],
  result: { mode: "strict", typeSymbol: `${REMOTE_PACKAGE}#QuotaSnapshotWire`, create: () => quotaSchema }
};
var MODELS_ENDPOINT = "qoder/models";
function parseModelCapacities(value) {
  const fail = (field) => {
    throw new TypeError(`qoder/models result: invalid ${field}`);
  };
  const integer = (value2, field) => typeof value2 === "number" && Number.isSafeInteger(value2) && value2 > 0 ? value2 : fail(field);
  if (!Array.isArray(value)) return fail("result");
  return value.map((entry, index) => {
    if (entry === null || typeof entry !== "object" || Array.isArray(entry)) return fail(String(index));
    if (typeof entry.id !== "string" || !entry.id || typeof entry.name !== "string") return fail("id/name");
    if (!Array.isArray(entry.contextWindows)) return fail("contextWindows");
    return {
      id: entry.id,
      name: entry.name,
      ...entry.contextWindow === void 0 ? {} : { contextWindow: integer(entry.contextWindow, "contextWindow") },
      ...entry.maxTokens === void 0 ? {} : { maxTokens: integer(entry.maxTokens, "maxTokens") },
      contextWindows: entry.contextWindows.map((value2) => integer(value2, "contextWindows")),
      effectiveContextWindow: integer(entry.effectiveContextWindow, "effectiveContextWindow"),
      effectiveMaxTokens: integer(entry.effectiveMaxTokens, "effectiveMaxTokens")
    };
  });
}
var MODELS_DESCRIPTOR = {
  id: `${REMOTE_PACKAGE}#${MODELS_ENDPOINT}`,
  service: REMOTE_SERVICE,
  namespace: REMOTE_NAMESPACE,
  method: "models",
  invocation: { kind: "direct" },
  parameters: [],
  result: { mode: "strict", typeSymbol: `${REMOTE_PACKAGE}#ModelCapacityWire[]`, create: () => ({ parse: parseModelCapacities }) }
};
var QUOTA_REMOTE_CONTRIBUTION = {
  package: REMOTE_PACKAGE,
  descriptors: [QUOTA_DESCRIPTOR, MODELS_DESCRIPTOR]
};

// src/quota-styles.ts
var QUOTA_CSS_ID = "dsh-provider-qoder/QuotaSurfaces.module.css";
var QUOTA_CSS = `
/* ------------------------------------------------- sidebar footer entry */
/* LOAD-BEARING (and the only unqualified rule here): the shell stacks this
   list ABOVE the Settings seat and lays the list itself out as a flex ROW. An
   occupant that declares a full-width line cannot shrink, so as a row it
   overflows the column \u2014 measured on 0.2.0-rc.2 in the collapsed rail: the row
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

/* Expanded column: deliberately quiet \u2014 a surface beside Settings should read
   as part of the column \u2014 with one hover step and a hairline border. */
.qcp-foot{box-sizing:border-box;display:flex;flex:0 0 auto;flex-direction:column;gap:6px;width:100%;min-width:0;margin:0 0 4px;padding:8px;font:inherit;color:var(--dsw-alias-label-secondary,#61666b);text-align:left;cursor:pointer;background:0 0;border:1px solid transparent;border-radius:10px}
.qcp-foot:hover{color:var(--dsw-alias-label-primary,#0f1115);background:var(--dsw-alias-interactive-bg-hover,#2631480f);border-color:var(--dsw-alias-border-l2,#0000001a)}
.qcp-foot:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#0f1115);outline-offset:1px}
.qcp-top{display:flex;align-items:center;gap:8px;min-width:0}
.qcp-glyph{display:inline-flex;flex:0 0 auto;align-items:center;justify-content:center;color:var(--dsw-alias-brand-primary,#0f1115)}
.qcp-name{flex:0 1 auto;min-width:0;overflow:hidden;color:var(--dsw-alias-label-primary,#0f1115);font-size:13px;font-weight:500;line-height:20px;text-overflow:ellipsis;white-space:nowrap}
.qcp-spacer{flex:1 1 auto;min-width:0}
.qcp-badge{flex:0 0 auto;max-width:52%;overflow:hidden;padding:1px 8px;color:var(--dsw-alias-brand-primary,#0f1115);font-size:11px;font-weight:600;line-height:16px;text-overflow:ellipsis;white-space:nowrap;background:var(--dsw-alias-bg-module-platform,#f5f6f7);border-radius:999px}
.qcp-badgeWarn{color:var(--dsw-alias-state-error-primary,#ec1313)}

/* One usage line: the label and its figures on a head row, the bar UNDER it \u2014
   stacking the two lets the card show the credits without squeezing the bar
   into whatever is left beside them. */
.qcp-row{display:flex;flex-direction:column;gap:4px;min-width:0}
.qcp-rowHead{display:flex;flex-wrap:wrap;align-items:baseline;gap:8px;min-width:0}
.qcp-rowLabel{flex:1 1 auto;min-width:5em;overflow:hidden;color:var(--dsw-alias-label-tertiary,#81858c);font-size:11px;line-height:16px;text-overflow:ellipsis;white-space:nowrap}
.qcp-rowAmount{flex:0 0 auto;margin-left:auto;color:var(--dsw-alias-label-secondary,#61666b);font-size:11px;line-height:16px;font-variant-numeric:tabular-nums;white-space:nowrap}
.qcp-rowPct{flex:0 0 auto;width:34px;color:var(--dsw-alias-label-secondary,#61666b);font-size:11px;line-height:16px;font-variant-numeric:tabular-nums;text-align:right}
/* display:block is load-bearing: the card's markup stays PHRASING content (it
   renders inside a button), so these are spans \u2014 and an inline box ignores
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
`;
function injectQuotaStyles(id = QUOTA_CSS_ID, css = QUOTA_CSS) {
  if (typeof document === "undefined") return () => {
  };
  if (document.querySelector(`style[data-plugin-css="${id}"]`) !== null) return () => {
  };
  const tag = document.createElement("style");
  tag.dataset.plugin = "dsh-provider-qoder";
  tag.dataset.pluginCss = id;
  tag.textContent = css;
  document.head.appendChild(tag);
  return () => {
    tag.remove();
  };
}

// src/client/card.tsx
var React2 = __toESM(require("react"), 1);
var import_react2 = require("react");

// src/client/capacity.tsx
var React = __toESM(require("react"), 1);
var import_react = require("react");

// src/capacity.ts
function assertCapacity(value, field) {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`llm-qoder: ${field} must be a positive safe integer`);
  }
}
function validateCapacitySettings(settings) {
  for (const key of ["contextWindowOverride", "maxOutputTokens"]) {
    if (settings[key] !== void 0) assertCapacity(settings[key], key);
    if (key === "contextWindowOverride" && settings[key] === 1) throw new Error("llm-qoder: contextWindowOverride must leave room for input and output");
  }
  const modelLimits = /* @__PURE__ */ Object.create(null);
  if (settings.modelLimits !== void 0 && (typeof settings.modelLimits !== "object" || settings.modelLimits === null || Array.isArray(settings.modelLimits))) throw new Error("llm-qoder: modelLimits must be an object");
  for (const [id, limit] of Object.entries(settings.modelLimits ?? {})) {
    if (!id.trim() || limit === null || typeof limit !== "object" || Array.isArray(limit)) throw new Error("llm-qoder: invalid modelLimits entry");
    for (const key of ["contextWindow", "maxTokens"]) if (limit[key] !== void 0) assertCapacity(limit[key], `modelLimits.${id}.${key}`);
    if (limit.contextWindow === 1) throw new Error(`llm-qoder: modelLimits.${id}.contextWindow must leave room for input and output`);
    modelLimits[id] = { ...limit };
  }
  return { contextWindowOverride: settings.contextWindowOverride, maxOutputTokens: settings.maxOutputTokens, ...settings.modelLimits === void 0 ? {} : { modelLimits } };
}
function mergeModelLimits(root, profile) {
  if (root === void 0 && profile === void 0) return void 0;
  const lower = validateCapacitySettings({ modelLimits: root }).modelLimits ?? {};
  const upper = validateCapacitySettings({ modelLimits: profile }).modelLimits ?? {};
  return Object.fromEntries([.../* @__PURE__ */ new Set([...Object.keys(lower), ...Object.keys(upper)])].map((id) => {
    const contextWindow = upper[id]?.contextWindow ?? lower[id]?.contextWindow;
    const maxTokens = upper[id]?.maxTokens ?? lower[id]?.maxTokens;
    return [id, {
      ...contextWindow === void 0 ? {} : { contextWindow },
      ...maxTokens === void 0 ? {} : { maxTokens }
    }];
  }));
}

// src/client/settings.ts
var SETTINGS_NS = "llm-qoder";
var SHOW_SIDEBAR_QUOTA_FIELD = "showSidebarQuota";
function recordOf(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value : void 0;
}
function validCapacity(value) {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}
function createSettingsFaces(resolve) {
  let snapshot = {
    enabled: false,
    loading: true,
    writable: false,
    failed: false,
    values: {},
    ownValues: {},
    layer: "root",
    busy: false,
    saved: false
  };
  let revision;
  let document2 = {};
  let generation = 0;
  const listeners = /* @__PURE__ */ new Set();
  const publish = () => {
    for (const listener of listeners) listener();
  };
  const refresh = async () => {
    const ticket = ++generation;
    snapshot = { ...snapshot, loading: true };
    publish();
    try {
      const remote = resolve();
      if (!remote) throw new Error("Settings service unavailable");
      const response = await remote.describe();
      if (!response.ok)
        throw new Error(response.error?.message ?? "Settings read failed");
      if (ticket !== generation) return;
      const row = response.value.namespaces?.find(
        (entry) => entry.ns === SETTINGS_NS
      );
      revision = row?.revision;
      const root = recordOf(row?.value) ?? {};
      document2 = root;
      const profile = recordOf(recordOf(root.providers)?.["qoder-cn"]);
      const values = {
        ...root,
        ...profile,
        modelLimits: mergeModelLimits(root.modelLimits, profile?.modelLimits)
      };
      snapshot = {
        ...snapshot,
        values,
        ownValues: profile ?? root,
        layer: profile ? "providers.qoder-cn" : "root",
        enabled: root.showSidebarQuota === true,
        loading: false,
        writable: response.value.writable !== false,
        failed: false,
        error: void 0
      };
    } catch (error) {
      if (ticket !== generation) return;
      revision = void 0;
      snapshot = {
        ...snapshot,
        loading: false,
        writable: false,
        failed: true,
        error: error instanceof Error ? error.message : String(error)
      };
    }
    publish();
  };
  const write = async (makeOps) => {
    if (snapshot.loading || snapshot.busy || !snapshot.writable || snapshot.failed)
      return false;
    snapshot = { ...snapshot, busy: true, saved: false, error: void 0 };
    publish();
    try {
      const remote = resolve();
      if (!remote) throw new Error("Settings service unavailable");
      let ops = makeOps();
      let response = await remote.mutate(SETTINGS_NS, ops, revision);
      if (!response.ok && /revision|conflict/i.test(
        `${response.error?.code ?? ""} ${response.error?.message ?? ""}`
      )) {
        await refresh();
        if (snapshot.failed || !snapshot.writable)
          throw new Error(snapshot.error ?? "Settings reread failed");
        ops = makeOps();
        response = await remote.mutate(SETTINGS_NS, ops, revision);
      }
      if (!response.ok)
        throw new Error(response.error?.message ?? "Settings write rejected");
      await refresh();
      if (snapshot.failed) return false;
      for (const op of ops) {
        const observed = op.path.reduce(
          (value, key) => recordOf(value)?.[key],
          document2
        );
        if (op.op === "set" ? observed !== op.value : observed !== void 0)
          throw new Error("Host readback did not match the saved setting");
      }
      snapshot = { ...snapshot, saved: true };
      return true;
    } catch (error) {
      snapshot = {
        ...snapshot,
        error: error instanceof Error ? error.message : String(error),
        saved: false
      };
      return false;
    } finally {
      snapshot = { ...snapshot, busy: false };
      publish();
    }
  };
  const prefix = () => snapshot.layer === "root" ? [] : ["providers", "qoder-cn"];
  const pathFor = (field, model) => [
    ...prefix(),
    ...model === void 0 ? [field] : [
      "modelLimits",
      model,
      field === "contextWindowOverride" ? "contextWindow" : "maxTokens"
    ]
  ];
  const subscribe = (listener) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };
  const capacity = {
    getSnapshot: () => snapshot,
    subscribe,
    refresh,
    set: async (field, value, model) => {
      if (value !== void 0 && (!validCapacity(value) || field === "contextWindowOverride" && value < 2)) {
        snapshot = {
          ...snapshot,
          error: "Use a positive safe integer token count",
          saved: false
        };
        publish();
        return false;
      }
      const limits = model === void 0 ? void 0 : snapshot.values.modelLimits?.[model];
      const context = field === "contextWindowOverride" ? value : limits?.contextWindow ?? snapshot.values.contextWindowOverride;
      const output = field === "maxOutputTokens" ? value : limits?.maxTokens ?? snapshot.values.maxOutputTokens;
      if (context !== void 0 && output !== void 0 && output >= context) {
        snapshot = {
          ...snapshot,
          error: "Output must be smaller than the context window",
          saved: false
        };
        publish();
        return false;
      }
      return write(() => {
        const current = model === void 0 ? void 0 : snapshot.values.modelLimits?.[model];
        const nextContext = field === "contextWindowOverride" ? value : current?.contextWindow ?? snapshot.values.contextWindowOverride;
        const nextOutput = field === "maxOutputTokens" ? value : current?.maxTokens ?? snapshot.values.maxOutputTokens;
        if (nextContext !== void 0 && nextOutput !== void 0 && nextOutput >= nextContext)
          throw new Error("Output must be smaller than the context window");
        return [
          value === void 0 ? { op: "unset", path: pathFor(field, model) } : { op: "set", path: pathFor(field, model), value }
        ];
      });
    },
    reset: (model) => write(() => [
      { op: "unset", path: pathFor("contextWindowOverride", model) },
      { op: "unset", path: pathFor("maxOutputTokens", model) }
    ])
  };
  const quota = {
    getSnapshot: () => snapshot,
    subscribe,
    refresh,
    set: (value) => write(() => [{ op: "set", path: [SHOW_SIDEBAR_QUOTA_FIELD], value }])
  };
  void refresh();
  return { capacity, quota };
}
function modelOverrideInfo(state, id, contextWindows) {
  const own = (state.ownValues ?? state.values).modelLimits?.[id];
  const effective = state.values.modelLimits?.[id];
  const source = (field) => own?.[field] !== void 0 ? "modelSource" : effective?.[field] !== void 0 ? "inheritedModelSource" : state.values[field === "contextWindow" ? "contextWindowOverride" : "maxOutputTokens"] !== void 0 ? "providerSource" : "catalogSource";
  const chosenContext = effective?.contextWindow ?? state.values.contextWindowOverride;
  return {
    chosenContext,
    contextSource: source("contextWindow"),
    outputSource: source("maxTokens"),
    unsupported: chosenContext !== void 0 && !contextWindows.includes(chosenContext)
  };
}

// src/client/capacity.tsx
function createModelsFace(resolve) {
  let snapshot = { loading: false, models: [] };
  let generation = 0;
  const listeners = /* @__PURE__ */ new Set();
  const publish = () => {
    for (const listener of listeners) listener();
  };
  return {
    getSnapshot: () => snapshot,
    subscribe: (fn) => {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    refresh: async () => {
      const ticket = ++generation;
      snapshot = { ...snapshot, loading: true };
      publish();
      try {
        const remote = resolve();
        if (!remote) throw new Error("Model catalog unavailable");
        const result = await remote.models();
        if (!result.ok)
          throw new Error(result.error?.message ?? "Model catalog read failed");
        if (ticket === generation)
          snapshot = { loading: false, models: result.value };
      } catch (error) {
        if (ticket === generation)
          snapshot = {
            ...snapshot,
            loading: false,
            error: error instanceof Error ? error.message : String(error)
          };
      }
      if (ticket === generation) publish();
    }
  };
}
var CAPACITY_EN = {
  capacity: "Model capacity",
  defaults: "Provider defaults",
  context: "Context window",
  output: "Maximum output",
  auto: "Automatic / inherit",
  custom: "Custom",
  reset: "Restore automatic",
  saved: "Saved and read back from Host. Automatic inherits any parent override.",
  capacityHint: "Context controls conversation history. Output limits one response. K = 1,000; M = 1,000,000.",
  layer: "Settings layer",
  models: "Per-model overrides",
  effective: "Effective context / output",
  server: "Catalog context / output",
  tiers: "Available context tiers",
  unsupported: "Local budget override: this value is not a declared server tier. Saving does not expand server capacity.",
  supported: "Advertised tiers are negotiated with Qoder; other values change the local budget only.",
  source: "Override source",
  providerSource: "Provider default",
  modelSource: "This model",
  inheritedModelSource: "Inherited model override",
  catalogSource: "Automatic / catalog",
  unknown: "Unknown",
  capacityReadOnly: "Settings are unavailable or read-only.",
  retry: "Retry",
  readFailed: "Read failed",
  changePat: "Replace PAT",
  credentialHint: "Configured indicates stored credentials; connection has not been verified.",
  quota: "Quota overview",
  refresh: "Refresh",
  details: "View details",
  used: "Used / total",
  period: "Billing period",
  updated: "Last successful update",
  noQuota: "Refresh to load account quota.",
  stale: "Last successful data; refresh failed."
};
var CAPACITY_ZH = {
  capacity: "\u6A21\u578B\u4E0E\u5BB9\u91CF",
  defaults: "\u63D0\u4F9B\u5546\u9ED8\u8BA4\u8BBE\u7F6E",
  context: "\u4E0A\u4E0B\u6587\u7A97\u53E3",
  output: "\u6700\u5927\u8F93\u51FA",
  auto: "\u81EA\u52A8 / \u7EE7\u627F\u4E0A\u5C42",
  custom: "\u81EA\u5B9A\u4E49",
  reset: "\u6062\u590D\u81EA\u52A8",
  saved: "\u5DF2\u4FDD\u5B58\uFF0C\u5E76\u4ECE Host \u91CD\u65B0\u8BFB\u53D6\u3002\u81EA\u52A8\u6A21\u5F0F\u4F1A\u7EE7\u627F\u4E0A\u5C42\u5DF2\u6709\u8986\u76D6\u3002",
  capacityHint: "\u4E0A\u4E0B\u6587\u63A7\u5236\u5BF9\u8BDD\u5386\u53F2\u9884\u7B97\uFF0C\u8F93\u51FA\u9650\u5236\u5355\u6B21\u56DE\u7B54\u3002K = 1,000\uFF1BM = 1,000,000\u3002",
  layer: "\u751F\u6548\u914D\u7F6E\u5C42",
  models: "\u6309\u6A21\u578B\u8986\u76D6",
  effective: "\u6709\u6548\u4E0A\u4E0B\u6587 / \u8F93\u51FA",
  server: "\u76EE\u5F55\u4E0A\u4E0B\u6587 / \u8F93\u51FA",
  tiers: "\u76EE\u5F55\u652F\u6301\u7684\u4E0A\u4E0B\u6587\u6863\u4F4D",
  unsupported: "\u672C\u5730\u9884\u7B97\u8986\u76D6\uFF1A\u6B64\u503C\u4E0D\u662F\u76EE\u5F55\u58F0\u660E\u7684\u670D\u52A1\u7AEF\u6863\u4F4D\u3002\u4FDD\u5B58\u4E0D\u4F1A\u6269\u5927\u670D\u52A1\u7AEF\u5BB9\u91CF\u3002",
  supported: "\u76EE\u5F55\u58F0\u660E\u7684\u6863\u4F4D\u4F1A\u4E0E Qoder \u534F\u5546\uFF1B\u5176\u4ED6\u6570\u503C\u4EC5\u4FEE\u6539\u672C\u5730\u9884\u7B97\u3002",
  source: "\u8986\u76D6\u6765\u6E90",
  providerSource: "\u63D0\u4F9B\u5546\u9ED8\u8BA4",
  modelSource: "\u5F53\u524D\u6A21\u578B",
  inheritedModelSource: "\u7EE7\u627F\u4E0A\u5C42\u6A21\u578B\u8986\u76D6",
  catalogSource: "\u81EA\u52A8 / \u6A21\u578B\u76EE\u5F55",
  unknown: "\u672A\u77E5",
  capacityReadOnly: "\u8BBE\u7F6E\u6682\u4E0D\u53EF\u7528\u6216\u5F53\u524D\u914D\u7F6E\u53EA\u8BFB\u3002",
  retry: "\u91CD\u8BD5",
  readFailed: "\u8BFB\u53D6\u5931\u8D25",
  changePat: "\u66F4\u6362 PAT",
  credentialHint: "\u5DF2\u914D\u7F6E\u8868\u793A\u51ED\u636E\u5DF2\u5B58\u50A8\uFF0C\u4E0D\u4EE3\u8868\u8FDE\u63A5\u9A8C\u8BC1\u6210\u529F\u3002",
  quota: "\u989D\u5EA6\u6982\u89C8",
  refresh: "\u5237\u65B0",
  details: "\u67E5\u770B\u8BE6\u60C5",
  used: "\u5DF2\u7528 / \u603B\u989D",
  period: "\u8D26\u671F",
  updated: "\u4E0A\u6B21\u6210\u529F\u66F4\u65B0",
  noQuota: "\u70B9\u51FB\u5237\u65B0\u8BFB\u53D6\u8D26\u6237\u989D\u5EA6\u3002",
  stale: "\u5F53\u524D\u663E\u793A\u4E0A\u6B21\u6210\u529F\u6570\u636E\uFF1B\u672C\u6B21\u5237\u65B0\u5931\u8D25\u3002"
};
var CONTEXT = [128e3, 2e5, 256e3, 5e5, 1e6];
var OUTPUT = [8192, 16384, 32768, 65536, 131072];
function CapacityInput({
  label,
  value,
  output,
  disabled,
  t,
  onSave
}) {
  const presets = output ? OUTPUT : CONTEXT;
  const [mode, setMode] = (0, import_react.useState)(
    value === void 0 ? "auto" : presets.includes(value) ? String(value) : "custom"
  );
  const [draft, setDraft] = (0, import_react.useState)(value === void 0 ? "" : String(value));
  (0, import_react.useEffect)(() => {
    setMode(
      value === void 0 ? "auto" : presets.includes(value) ? String(value) : "custom"
    );
    setDraft(value === void 0 ? "" : String(value));
  }, [value]);
  const valid = /^\d+$/.test(draft) && Number.isSafeInteger(Number(draft)) && Number(draft) > 0;
  return /* @__PURE__ */ React.createElement("div", { className: "qoder-capacity-input" }, /* @__PURE__ */ React.createElement("label", null, /* @__PURE__ */ React.createElement("span", null, label), /* @__PURE__ */ React.createElement(
    "select",
    {
      "aria-label": label,
      value: mode,
      disabled,
      onChange: (event) => {
        const next = event.target.value;
        setMode(next);
        if (next !== "custom")
          void onSave(next === "auto" ? void 0 : Number(next)).then(
            (ok) => {
              if (!ok)
                setMode(
                  value === void 0 ? "auto" : presets.includes(value) ? String(value) : "custom"
                );
            }
          );
      }
    },
    /* @__PURE__ */ React.createElement("option", { value: "auto" }, t("auto")),
    presets.map((number) => /* @__PURE__ */ React.createElement("option", { key: number, value: number }, output ? number.toLocaleString("en-US") : number === 1e6 ? "1M \xB7 1,000,000" : `${number / 1e3}K \xB7 ${number.toLocaleString("en-US")}`)),
    /* @__PURE__ */ React.createElement("option", { value: "custom" }, t("custom"))
  )), mode === "custom" ? /* @__PURE__ */ React.createElement("div", { className: "qoder-inline" }, /* @__PURE__ */ React.createElement(
    "input",
    {
      "aria-label": `${label} \xB7 ${t("custom")}`,
      inputMode: "numeric",
      value: draft,
      disabled,
      onChange: (event) => setDraft(event.target.value)
    }
  ), /* @__PURE__ */ React.createElement(
    "button",
    {
      type: "button",
      disabled: disabled || !valid,
      onClick: () => {
        void onSave(Number(draft));
      }
    },
    t("save")
  )) : null, /* @__PURE__ */ React.createElement("small", null, value === void 0 ? t("auto") : `${value.toLocaleString("en-US")} tokens`));
}
function CapacitySection({
  face,
  catalog,
  t
}) {
  const [state, setState] = (0, import_react.useState)(
    () => face.getSnapshot()
  );
  const [models, setModels] = (0, import_react.useState)(() => catalog.getSnapshot());
  (0, import_react.useEffect)(() => {
    const dispose = face.subscribe(() => setState(face.getSnapshot()));
    setState(face.getSnapshot());
    return dispose;
  }, [face]);
  (0, import_react.useEffect)(() => {
    const dispose = catalog.subscribe(() => setModels(catalog.getSnapshot()));
    setModels(catalog.getSnapshot());
    return dispose;
  }, [catalog]);
  const disabled = state.loading || state.busy || !state.writable || state.failed;
  const editor = (model) => {
    const own = state.ownValues ?? state.values;
    const override = model ? own.modelLimits?.[model.id] : void 0;
    const context = model ? override?.contextWindow : own.contextWindowOverride;
    const output = model ? override?.maxTokens : own.maxOutputTokens;
    const info = model ? modelOverrideInfo(state, model.id, model.contextWindows) : void 0;
    return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", { className: "qoder-capacity-grid" }, /* @__PURE__ */ React.createElement(
      CapacityInput,
      {
        label: t("context"),
        value: context,
        disabled,
        t,
        onSave: (value) => face.set("contextWindowOverride", value, model?.id).then(async (ok) => {
          if (ok) await catalog.refresh();
          return ok;
        })
      }
    ), /* @__PURE__ */ React.createElement(
      CapacityInput,
      {
        label: t("output"),
        output: true,
        value: output,
        disabled,
        t,
        onSave: (value) => face.set("maxOutputTokens", value, model?.id).then(async (ok) => {
          if (ok) await catalog.refresh();
          return ok;
        })
      }
    )), model ? /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("dl", { className: "qoder-facts" }, /* @__PURE__ */ React.createElement("dt", null, t("source")), /* @__PURE__ */ React.createElement("dd", null, t(info.contextSource), " / ", t(info.outputSource)), /* @__PURE__ */ React.createElement("dt", null, t("effective")), /* @__PURE__ */ React.createElement("dd", null, model.effectiveContextWindow.toLocaleString("en-US"), " /", " ", model.effectiveMaxTokens.toLocaleString("en-US")), /* @__PURE__ */ React.createElement("dt", null, t("server")), /* @__PURE__ */ React.createElement("dd", null, model.contextWindow?.toLocaleString("en-US") ?? t("unknown"), " /", " ", model.maxTokens?.toLocaleString("en-US") ?? t("unknown")), /* @__PURE__ */ React.createElement("dt", null, t("tiers")), /* @__PURE__ */ React.createElement("dd", null, model.contextWindows.map((value) => value.toLocaleString("en-US")).join(" \xB7 ") || t("unknown"))), info?.unsupported ? /* @__PURE__ */ React.createElement("p", { className: "qoder-warning", role: "status" }, t("unsupported")) : null) : null, /* @__PURE__ */ React.createElement(
      "button",
      {
        type: "button",
        className: "qoder-subtle",
        disabled,
        onClick: () => {
          void face.reset(model?.id).then((ok) => {
            if (ok) void catalog.refresh();
          });
        }
      },
      t("reset")
    ));
  };
  return /* @__PURE__ */ React.createElement("section", { className: "qoder-section" }, /* @__PURE__ */ React.createElement("div", { className: "qoder-section-heading" }, /* @__PURE__ */ React.createElement("h3", null, t("capacity")), /* @__PURE__ */ React.createElement(
    "button",
    {
      type: "button",
      disabled: state.loading || state.busy || models.loading,
      onClick: () => {
        void face.refresh();
        void catalog.refresh();
      }
    },
    t("refresh")
  )), /* @__PURE__ */ React.createElement("p", { className: "qoder-muted" }, t("capacityHint")), /* @__PURE__ */ React.createElement("small", null, t("supported")), /* @__PURE__ */ React.createElement("div", { className: "qoder-layer" }, t("layer"), ": ", /* @__PURE__ */ React.createElement("code", null, state.layer)), /* @__PURE__ */ React.createElement("h4", null, t("defaults")), editor(), state.saved ? /* @__PURE__ */ React.createElement("p", { role: "status", className: "qoder-success" }, t("saved")) : null, state.error ? /* @__PURE__ */ React.createElement("p", { role: "alert", className: "qoder-warning" }, state.error) : null, !state.writable && !state.loading ? /* @__PURE__ */ React.createElement("p", { className: "qoder-muted" }, t("capacityReadOnly")) : null, /* @__PURE__ */ React.createElement("details", { className: "qoder-models" }, /* @__PURE__ */ React.createElement("summary", null, t("models"), " ", /* @__PURE__ */ React.createElement("span", null, models.models.length)), models.error ? /* @__PURE__ */ React.createElement("p", { role: "alert" }, models.error) : null, models.loading ? /* @__PURE__ */ React.createElement("p", { role: "status" }, t("loading")) : null, models.models.map((model) => /* @__PURE__ */ React.createElement("details", { key: model.id, className: "qoder-model" }, /* @__PURE__ */ React.createElement("summary", null, model.name, /* @__PURE__ */ React.createElement("small", null, model.id)), editor(model)))));
}

// src/client/card.tsx
var EN = {
  ...CAPACITY_EN,
  title: "Qoder CN",
  configured: "PAT configured",
  notConfigured: "PAT not configured",
  patLabel: "Qoder PAT",
  patHint: "Paste a pt-... Personal Access Token. Stored securely in DSH credentials.",
  save: "Save",
  saving: "Saving\u2026",
  loading: "Loading\u2026",
  readOnly: "Credentials are read-only.",
  saveFailed: "The PAT could not be stored. Try again.",
  integrations: "Integrations & display",
  quotaToggle: "Show quota in the sidebar",
  quotaToggleHint: "Off by default. No sidebar background refresh while off.",
  quotaToggleFailed: "Settings could not be stored. Try again."
};
function QoderProviderCard(props) {
  const patId = (0, import_react2.useId)();
  const t = props.t ?? ((key) => EN[key] ?? key);
  const [credential, setCredential] = (0, import_react2.useState)(
    () => props.credential.getSnapshot()
  );
  const [settings, setSettings] = (0, import_react2.useState)(
    () => props.quotaSettings?.getSnapshot()
  );
  const [quota, setQuota] = (0, import_react2.useState)(() => props.quota?.getSnapshot());
  const [draft, setDraft] = (0, import_react2.useState)("");
  const [editing, setEditing] = (0, import_react2.useState)(false);
  const [saving, setSaving] = (0, import_react2.useState)(false);
  const [failed, setFailed] = (0, import_react2.useState)(false);
  const [toggleBusy, setToggleBusy] = (0, import_react2.useState)(false);
  (0, import_react2.useEffect)(() => {
    const dispose = props.credential.subscribe(
      () => setCredential(props.credential.getSnapshot())
    );
    setCredential(props.credential.getSnapshot());
    return dispose;
  }, [props.credential]);
  (0, import_react2.useEffect)(() => {
    const dispose = props.quotaSettings?.subscribe(
      () => setSettings(props.quotaSettings?.getSnapshot())
    );
    setSettings(props.quotaSettings?.getSnapshot());
    return dispose;
  }, [props.quotaSettings]);
  (0, import_react2.useEffect)(() => {
    const dispose = props.quota?.subscribe(
      () => setQuota(props.quota?.getSnapshot())
    );
    setQuota(props.quota?.getSnapshot());
    return dispose;
  }, [props.quota]);
  const disabled = saving || credential.loading || !credential.writable || !!credential.error;
  const save = async () => {
    if (disabled || !draft.trim()) return;
    setSaving(true);
    setFailed(false);
    try {
      if (await props.credential.set(draft.trim())) {
        setDraft("");
        setEditing(false);
      } else setFailed(true);
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  };
  const report = quota?.report;
  const date = (value) => new Date(value < 1e11 ? value * 1e3 : value).toLocaleDateString();
  return /* @__PURE__ */ React2.createElement("div", { "data-qoder-models-card": "true" }, /* @__PURE__ */ React2.createElement("header", { className: "qoder-header" }, /* @__PURE__ */ React2.createElement("div", { className: "qoder-brand" }, /* @__PURE__ */ React2.createElement("span", { className: "qoder-monogram", "aria-hidden": "true" }, "Q"), /* @__PURE__ */ React2.createElement("div", null, /* @__PURE__ */ React2.createElement("div", { className: "qoder-title" }, t("title")), /* @__PURE__ */ React2.createElement("small", null, "Qoder \xB7 China"))), /* @__PURE__ */ React2.createElement("span", { className: "qoder-status", role: "status" }, credential.loading ? t("loading") : credential.error ? t("readFailed") : credential.configured ? t("configured") : t("notConfigured"))), /* @__PURE__ */ React2.createElement("section", { className: "qoder-section" }, /* @__PURE__ */ React2.createElement("div", { className: "qoder-section-heading" }, /* @__PURE__ */ React2.createElement("h3", null, t("patLabel")), credential.configured && !editing ? /* @__PURE__ */ React2.createElement(
    "button",
    {
      disabled,
      type: "button",
      onClick: () => setEditing(true)
    },
    t("changePat")
  ) : null), /* @__PURE__ */ React2.createElement("p", { className: "qoder-muted" }, t("credentialHint")), !credential.configured || editing ? /* @__PURE__ */ React2.createElement(React2.Fragment, null, /* @__PURE__ */ React2.createElement("div", null, /* @__PURE__ */ React2.createElement("label", { htmlFor: patId }, t("patLabel")), /* @__PURE__ */ React2.createElement("div", { className: "qoder-inline" }, /* @__PURE__ */ React2.createElement(
    "input",
    {
      id: patId,
      type: "password",
      autoComplete: "new-password",
      spellCheck: false,
      value: draft,
      disabled,
      onChange: (event) => {
        setDraft(event.target.value);
        setFailed(false);
      }
    }
  ), /* @__PURE__ */ React2.createElement(
    "button",
    {
      type: "button",
      disabled: disabled || !draft.trim(),
      onClick: () => {
        void save();
      }
    },
    saving ? t("saving") : t("save")
  ))), /* @__PURE__ */ React2.createElement("small", null, credential.writable ? t("patHint") : t("readOnly"))) : null, credential.error ? /* @__PURE__ */ React2.createElement("div", { className: "qoder-inline" }, /* @__PURE__ */ React2.createElement("p", { className: "qoder-warning", role: "alert" }, t("readFailed")), /* @__PURE__ */ React2.createElement(
    "button",
    {
      type: "button",
      disabled: credential.loading,
      onClick: () => {
        void props.credential.refresh();
      }
    },
    t("retry")
  )) : null, failed ? /* @__PURE__ */ React2.createElement("p", { className: "qoder-warning", role: "alert" }, t("saveFailed")) : null), props.capacitySettings && props.models ? /* @__PURE__ */ React2.createElement(
    CapacitySection,
    {
      face: props.capacitySettings,
      catalog: props.models,
      t
    }
  ) : null, props.quota ? /* @__PURE__ */ React2.createElement("section", { className: "qoder-section" }, /* @__PURE__ */ React2.createElement("div", { className: "qoder-section-heading" }, /* @__PURE__ */ React2.createElement("h3", null, t("quota")), /* @__PURE__ */ React2.createElement(
    "button",
    {
      type: "button",
      disabled: quota?.status === "loading",
      onClick: () => {
        void props.quota?.refresh();
      }
    },
    quota?.status === "loading" ? t("loading") : t("refresh")
  )), report ? /* @__PURE__ */ React2.createElement(React2.Fragment, null, /* @__PURE__ */ React2.createElement("div", null, /* @__PURE__ */ React2.createElement("small", null, report.planTierName || t("unknown"), " \xB7", " ", report.organizationName || report.userType)), /* @__PURE__ */ React2.createElement("div", null, /* @__PURE__ */ React2.createElement("div", { className: "qoder-quota-number" }, report.personal.available ? `${report.personal.used.toLocaleString()} / ${report.personal.total.toLocaleString()}` : t("unknown")), /* @__PURE__ */ React2.createElement("small", null, t("used"), " \xB7 ", report.personal.unit)), /* @__PURE__ */ React2.createElement("dl", { className: "qoder-facts" }, /* @__PURE__ */ React2.createElement("dt", null, t("period")), /* @__PURE__ */ React2.createElement("dd", null, report.periodStart && report.periodEnd ? `${date(report.periodStart)} \u2013 ${date(report.periodEnd)}` : t("unknown")), /* @__PURE__ */ React2.createElement("dt", null, t("updated")), /* @__PURE__ */ React2.createElement("dd", null, quota?.fetchedAt ? new Date(quota.fetchedAt).toLocaleString() : t("unknown")))) : /* @__PURE__ */ React2.createElement("p", { className: "qoder-muted" }, t("noQuota")), quota?.status === "error" ? /* @__PURE__ */ React2.createElement("p", { className: "qoder-warning", role: "alert" }, report ? t("stale") : t("readFailed")) : null, /* @__PURE__ */ React2.createElement(
    "button",
    {
      className: "qoder-subtle",
      type: "button",
      onClick: props.openQuota
    },
    t("details")
  )) : null, props.quotaSettings ? /* @__PURE__ */ React2.createElement("section", { className: "qoder-section", "data-qoder-integrations": "true" }, /* @__PURE__ */ React2.createElement("h3", null, t("integrations")), /* @__PURE__ */ React2.createElement("label", { className: "qoder-toggle" }, /* @__PURE__ */ React2.createElement(
    "input",
    {
      type: "checkbox",
      "data-qoder-quota-toggle": "true",
      checked: settings?.enabled === true,
      disabled: !settings || settings.loading || !settings.writable || settings.failed || toggleBusy,
      onChange: (event) => {
        setToggleBusy(true);
        void props.quotaSettings?.set(event.target.checked).finally(() => setToggleBusy(false));
      }
    }
  ), /* @__PURE__ */ React2.createElement("span", null, t("quotaToggle"))), /* @__PURE__ */ React2.createElement("small", null, t("quotaToggleHint")), settings?.failed ? /* @__PURE__ */ React2.createElement("div", { className: "qoder-inline" }, /* @__PURE__ */ React2.createElement("p", { role: "alert", className: "qoder-warning" }, t("quotaToggleFailed")), /* @__PURE__ */ React2.createElement(
    "button",
    {
      type: "button",
      onClick: () => {
        void props.quotaSettings?.refresh();
      }
    },
    t("retry")
  )) : null) : null);
}

// src/client/copy.ts
var PANEL_LOCALE_NS = "panel.qoder";
var PANEL_TEXT_ZH = {
  lang: "zh",
  cardName: "Qoder CN",
  cardHint: "\u67E5\u770B Qoder CN \u5957\u9910\u4E0E\u989D\u5EA6",
  panelTitle: "Qoder CN \u5957\u9910\u4E0E\u989D\u5EA6",
  panelSubtitle: "\u6309\u8BA1\u8D39\u5468\u671F\u7EDF\u8BA1\u7684\u79EF\u5206\u7528\u91CF",
  close: "\u8FD4\u56DE\u4F1A\u8BDD",
  closeHint: "\u5173\u95ED\u6B64\u9762\u677F\u5E76\u8FD4\u56DE\u5F53\u524D\u4F1A\u8BDD",
  refresh: "\u5237\u65B0",
  loading: "\u8BFB\u53D6\u4E2D\u2026",
  unavailable: "\u5F53\u524D profile \u672A\u6302\u8F7D\u989D\u5EA6\u670D\u52A1\u3002",
  notConfigured: "\u5C1A\u672A\u914D\u7F6E PAT\uFF0C\u65E0\u6CD5\u8BFB\u53D6\u989D\u5EA6\u3002",
  error: "\u989D\u5EA6\u8BFB\u53D6\u5931\u8D25",
  stale: "\u4E0A\u6B21\u6210\u529F\u6570\u636E\uFF0C\u5F53\u524D\u5237\u65B0\u5931\u8D25",
  usageBlock: "\u989D\u5EA6",
  personalPool: "\u4E2A\u4EBA\u5957\u9910\u989D\u5EA6",
  noPersonalPool: "\u8BE5\u8D26\u6237\u6CA1\u6709\u4E2A\u4EBA\u5957\u9910\u989D\u5EA6\u3002",
  organizationPool: "\u7EC4\u7EC7\u8D44\u6E90\u5305",
  orgPoolDormant: "\u7EC4\u7EC7\u8D44\u6E90\u5305\u5F53\u524D\u672A\u542F\u7528\u3002",
  addOnPool: "\u8D2D\u4E70 / \u8D60\u9001\u989D\u5EA6",
  billingCycle: "\u8BA1\u8D39\u5468\u671F",
  used: "\u5DF2\u7528",
  remaining: "\u5269\u4F59",
  limit: "\u4E0A\u9650",
  resetAt: "\u91CD\u7F6E\u65F6\u95F4",
  noDeadline: "\u672A\u63D0\u4F9B",
  daysLeftSuffix: "\u5929\u540E",
  exceeded: "\u989D\u5EA6\u5DF2\u7528\u5C3D",
  exceededShort: "\u5DF2\u7528\u5C3D",
  exceededHint: "\u672C\u8BA1\u8D39\u5468\u671F\u7684\u79EF\u5206\u5DF2\u7528\u5B8C\uFF0C\u65B0\u7684\u8BF7\u6C42\u53EF\u80FD\u88AB\u62D2\u7EDD\u3002",
  upgrade: "\u5347\u7EA7\u5957\u9910",
  refreshedAt: "\u66F4\u65B0\u4E8E",
  never: "\u5C1A\u672A\u8BFB\u53D6",
  settingsToggle: "\u5728\u4FA7\u8FB9\u680F\u663E\u793A\u989D\u5EA6\u5361\u7247",
  settingsToggleHint: "\u9ED8\u8BA4\u5173\u95ED\uFF1B\u5173\u95ED\u65F6\u5DE6\u4FA7\u680F\u4E0D\u6E32\u67D3\u5361\u7247\uFF0C\u4E5F\u4E0D\u4F1A\u540E\u53F0\u5237\u65B0\u989D\u5EA6\u3002",
  settingsToggleFailed: "\u5F00\u5173\u5199\u5165\u5931\u8D25\uFF0C\u8BF7\u91CD\u8BD5\u3002"
};
var PANEL_TEXT_EN = {
  lang: "en",
  cardName: "Qoder CN",
  cardHint: "Qoder CN plan and quota",
  panelTitle: "Qoder CN plan & quota",
  panelSubtitle: "Credits used in the current billing cycle",
  close: "Back to conversation",
  closeHint: "Close this panel and return to the current conversation",
  refresh: "Refresh",
  loading: "Loading\u2026",
  unavailable: "The quota service is not mounted in this profile.",
  notConfigured: "No PAT is configured yet, so quota cannot be read.",
  error: "Could not read the quota",
  stale: "Last successful data; refresh failed",
  usageBlock: "Usage",
  personalPool: "Personal plan credits",
  noPersonalPool: "This account has no personal plan credits.",
  organizationPool: "Organization package",
  orgPoolDormant: "The organization package is currently not drawn on.",
  addOnPool: "Purchased / gifted credits",
  billingCycle: "Billing cycle",
  used: "Used",
  remaining: "Remaining",
  limit: "Limit",
  resetAt: "Resets",
  noDeadline: "Not reported",
  daysLeftSuffix: "days left",
  exceeded: "Quota exhausted",
  exceededShort: "Exhausted",
  exceededHint: "This billing cycle is spent; new requests may be rejected.",
  upgrade: "Upgrade plan",
  refreshedAt: "Updated",
  never: "Never",
  settingsToggle: "Show the quota card in the sidebar",
  settingsToggleHint: "Off by default; while off the sidebar renders no card and no background quota refresh runs.",
  settingsToggleFailed: "The toggle could not be stored. Try again."
};
function qoderPanelText(t) {
  const key = t("lang");
  return key === "zh" ? PANEL_TEXT_ZH : PANEL_TEXT_EN;
}

// src/client/panel.tsx
var React3 = __toESM(require("react"), 1);
var import_react3 = require("react");

// src/quota-view.ts
var RING_RADIUS = 7.25;
var RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
function clampPercent(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}
function percentOf(ratio) {
  return Math.round(clampPercent(ratio * 100));
}
function ringDashOffset(percent, circumference = RING_CIRCUMFERENCE) {
  return Math.round(circumference * (1 - clampPercent(percent) / 100) * 1e3) / 1e3;
}
function usedRatio(used, total, fallback = 0) {
  const usable = Number.isFinite(used) && Number.isFinite(total) && total > 0 ? used / total : fallback;
  if (!Number.isFinite(usable)) return 0;
  return Math.min(1, Math.max(0, usable));
}
function formatCredits(value) {
  if (!Number.isFinite(value)) return "\u2014";
  return String(Math.round(value * 100) / 100);
}
function locale(lang) {
  return lang === "zh" ? "zh-CN" : "en-US";
}
function formatMoment(ms, lang) {
  if (ms === void 0 || !Number.isFinite(ms)) return void 0;
  try {
    return new Date(ms).toLocaleString(locale(lang), {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch {
    return new Date(ms).toISOString();
  }
}
function formatDay(ms, lang) {
  if (ms === void 0 || !Number.isFinite(ms)) return void 0;
  try {
    return new Date(ms).toLocaleDateString(locale(lang), { year: "numeric", month: "2-digit", day: "2-digit" });
  } catch {
    return new Date(ms).toISOString().slice(0, 10);
  }
}
function formatShortDay(ms, lang) {
  if (ms === void 0 || !Number.isFinite(ms)) return void 0;
  try {
    return new Date(ms).toLocaleDateString(locale(lang), { month: "2-digit", day: "2-digit" });
  } catch {
    return new Date(ms).toISOString().slice(5, 10);
  }
}
function formatYearSpan(start, end) {
  const from = yearOf(start);
  if (from === void 0) return void 0;
  const to = yearOf(end);
  return to === void 0 || to === from ? from : `${from} \u2192 ${to}`;
}
function yearOf(ms) {
  if (ms === void 0 || !Number.isFinite(ms)) return void 0;
  return String(new Date(ms).getFullYear());
}
function daysUntil(until, now) {
  if (until === void 0 || !Number.isFinite(until) || until <= now) return void 0;
  return Math.ceil((until - now) / 864e5);
}
function joinParts(parts, separator = " \xB7 ") {
  return parts.filter((part) => part !== void 0 && part !== "").join(separator);
}

// src/client/quota.ts
var QUOTA_AUTO_REFRESH_MS = 12e4;
var QUOTA_REMOTE_UNMOUNTED_ERROR = "the qoder/quota remote is not mounted";
function createQuotaController(resolve) {
  let snapshot = { status: "idle" };
  let inFlight;
  let generation = 0;
  const listeners = /* @__PURE__ */ new Set();
  const publish = () => {
    for (const listener of listeners) listener();
  };
  const load = async () => {
    const ticket = ++generation;
    snapshot = { ...snapshot, status: "loading" };
    publish();
    const namespace = resolve();
    if (namespace === void 0) {
      if (ticket !== generation) return;
      snapshot = {
        ...snapshot,
        status: "error",
        error: QUOTA_REMOTE_UNMOUNTED_ERROR,
        ...snapshot.fetchedAt === void 0 ? {} : { fetchedAt: snapshot.fetchedAt }
      };
      publish();
      return;
    }
    try {
      const response = await namespace.quota();
      if (ticket !== generation) return;
      snapshot = response.ok ? { status: "ready", report: response.value, fetchedAt: Date.now() } : {
        ...snapshot,
        status: "error",
        error: response.error?.message ?? "the quota read failed",
        ...snapshot.fetchedAt === void 0 ? {} : { fetchedAt: snapshot.fetchedAt }
      };
    } catch (error) {
      if (ticket !== generation) return;
      snapshot = {
        ...snapshot,
        status: "error",
        error: error instanceof Error ? error.message : String(error),
        ...snapshot.fetchedAt === void 0 ? {} : { fetchedAt: snapshot.fetchedAt }
      };
    }
    publish();
  };
  return {
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    refresh: () => {
      inFlight ??= load().finally(() => {
        inFlight = void 0;
      });
      return inFlight;
    }
  };
}
var REAL_TIMER = {
  set: (callback, ms) => setTimeout(callback, ms),
  clear: (handle2) => {
    clearTimeout(handle2);
  }
};
function startQuotaAutoRefresh(controller, isVisible, timer = REAL_TIMER) {
  references += 1;
  visibleNow = isVisible;
  if (activeTimer === void 0) {
    activeTimer = timer;
    const tick = () => {
      if (activeTimer !== timer) return;
      handle = timer.set(tick, QUOTA_AUTO_REFRESH_MS);
      if (visibleNow?.() === true) void controller.refresh();
    };
    handle = timer.set(tick, QUOTA_AUTO_REFRESH_MS);
    if (isVisible()) void controller.refresh();
  }
  let stopped = false;
  return () => {
    if (stopped) return;
    stopped = true;
    references -= 1;
    if (references > 0 || activeTimer === void 0) return;
    if (handle !== void 0) activeTimer.clear(handle);
    handle = void 0;
    activeTimer = void 0;
    visibleNow = void 0;
  };
}
var references = 0;
var activeTimer;
var handle;
var visibleNow;

// src/client/panel.tsx
var QUOTA_PANEL_ID = "qoder-quota-panel";
function QuotaRing(props) {
  return /* @__PURE__ */ React3.createElement("span", { className: "qcp-glyph", "aria-hidden": "true" }, /* @__PURE__ */ React3.createElement("svg", { viewBox: "0 0 20 20", width: props.size, height: props.size, focusable: "false" }, /* @__PURE__ */ React3.createElement("circle", { cx: 10, cy: 10, r: RING_RADIUS, fill: "none", stroke: "currentColor", strokeWidth: 1.5, opacity: 0.4 }), /* @__PURE__ */ React3.createElement(
    "circle",
    {
      cx: 10,
      cy: 10,
      r: RING_RADIUS,
      fill: "none",
      stroke: props.warn ? "var(--dsw-alias-state-error-primary, #ec1313)" : "currentColor",
      strokeWidth: 2.5,
      strokeLinecap: "round",
      strokeDasharray: RING_CIRCUMFERENCE,
      strokeDashoffset: ringDashOffset(props.percent),
      transform: "rotate(-90 10 10)"
    }
  )));
}
function QuotaBar(props) {
  return /* @__PURE__ */ React3.createElement(
    "span",
    {
      className: props.large === true ? "qcp-barLg" : "qcp-bar",
      role: "progressbar",
      "aria-label": props.label,
      "aria-valuemin": 0,
      "aria-valuemax": 100,
      "aria-valuenow": props.percent
    },
    /* @__PURE__ */ React3.createElement("span", { className: props.warn ? "qcp-fill qcp-fillWarn" : "qcp-fill", style: { width: `${String(props.percent)}%` } })
  );
}
function QuotaWindow(props) {
  const { t, pool } = props;
  const percent = percentOf(usedRatio(pool.used, pool.total, pool.percentage));
  return /* @__PURE__ */ React3.createElement("div", { className: "qcp-window" }, /* @__PURE__ */ React3.createElement("div", { className: "qcp-windowHead" }, /* @__PURE__ */ React3.createElement("span", { className: "qcp-windowLabel" }, props.label), /* @__PURE__ */ React3.createElement("span", { className: "qcp-windowValue" }, `${formatCredits(pool.used)} / ${formatCredits(pool.total)} ${pool.unit}`), /* @__PURE__ */ React3.createElement("span", { className: "qcp-windowPct" }, `${String(percent)}%`)), /* @__PURE__ */ React3.createElement(QuotaBar, { large: true, percent, warn: props.warn, label: props.label }), /* @__PURE__ */ React3.createElement("span", { className: "qcp-caption" }, `${t.resetAt} ${formatMoment(props.expiresAt, t.lang) ?? t.noDeadline}`));
}
function QuotaTile(props) {
  return /* @__PURE__ */ React3.createElement("div", { className: "qcp-tile" }, /* @__PURE__ */ React3.createElement("span", { className: "qcp-tileLabel" }, props.label), /* @__PURE__ */ React3.createElement("span", { className: props.small === true ? "qcp-tileValue qcp-tileValueSm" : "qcp-tileValue" }, props.value), props.sub === void 0 ? null : /* @__PURE__ */ React3.createElement("span", { className: "qcp-tileSub", title: props.sub }, props.sub));
}
function useView(props) {
  const t = qoderPanelText(props.t ?? ((key) => PANEL_TEXT_EN[key] ?? key));
  const snapshot = props.useQuota?.((state) => state) ?? { status: "idle" };
  return { t, snapshot, report: snapshot.report };
}
function statusHeadline(t, error) {
  if (error === QUOTA_REMOTE_UNMOUNTED_ERROR) return { title: t.unavailable };
  if (/no PAT|personal access token/i.test(error)) return { title: t.notConfigured, detail: error };
  return { title: t.error, detail: error };
}
function headlineOf(report) {
  if (report?.personal !== void 0) return { pool: report.personal, label: "personal" };
  if (report?.addOnPool !== void 0) return { pool: report.addOnPool, label: "addOn" };
  return void 0;
}
function QoderQuotaFooterEntry(props) {
  const enabled = props.useQuotaSettings?.((state) => state.enabled) ?? false;
  const { t, snapshot, report } = useView(props);
  const startAutoRefresh = props.startAutoRefresh;
  (0, import_react3.useEffect)(() => {
    if (!enabled || startAutoRefresh === void 0) return void 0;
    return startAutoRefresh();
  }, [enabled, startAutoRefresh]);
  if (!enabled) return null;
  const headline = headlineOf(report);
  const percent = headline === void 0 ? 0 : percentOf(usedRatio(headline.pool.used, headline.pool.total, headline.pool.percentage));
  const warn = report?.isQuotaExceeded === true || percent >= 100;
  const open = () => {
    props.open?.();
  };
  if (props.wide === false) {
    return /* @__PURE__ */ React3.createElement(
      "button",
      {
        type: "button",
        className: "qcp-rail",
        "data-qoder-quota-card": "true",
        "aria-label": t.cardHint,
        title: snapshot.status === "error" && report !== void 0 ? `${t.cardHint} \xB7 ${t.stale}` : t.cardHint,
        onClick: open
      },
      /* @__PURE__ */ React3.createElement(QuotaRing, { percent, warn, size: 18 })
    );
  }
  const badge = report?.planTierName;
  return /* @__PURE__ */ React3.createElement(
    "button",
    {
      type: "button",
      className: "qcp-foot",
      "data-qoder-quota-card": "true",
      "aria-label": t.cardHint,
      title: t.cardHint,
      onClick: open
    },
    /* @__PURE__ */ React3.createElement("span", { className: "qcp-top" }, /* @__PURE__ */ React3.createElement(QuotaRing, { percent, warn, size: 16 }), /* @__PURE__ */ React3.createElement("span", { className: "qcp-name" }, t.cardName), /* @__PURE__ */ React3.createElement("span", { className: "qcp-spacer" }), warn ? /* @__PURE__ */ React3.createElement("span", { className: "qcp-badge qcp-badgeWarn" }, t.exceededShort) : badge === void 0 ? null : /* @__PURE__ */ React3.createElement("span", { className: "qcp-badge" }, badge)),
    headline === void 0 ? /* @__PURE__ */ React3.createElement("span", { className: "qcp-caption" }, snapshot.status === "error" ? t.error : t.loading) : /* @__PURE__ */ React3.createElement("span", { className: "qcp-row" }, /* @__PURE__ */ React3.createElement("span", { className: "qcp-rowHead" }, /* @__PURE__ */ React3.createElement("span", { className: "qcp-rowLabel" }, headline.label === "personal" ? t.personalPool : t.addOnPool), /* @__PURE__ */ React3.createElement("span", { className: "qcp-rowAmount" }, `${formatCredits(headline.pool.used)} / ${formatCredits(headline.pool.total)}`), /* @__PURE__ */ React3.createElement("span", { className: "qcp-rowPct" }, `${String(percent)}%`)), /* @__PURE__ */ React3.createElement(QuotaBar, { percent, warn, label: t.personalPool }), /* @__PURE__ */ React3.createElement("span", { className: "qcp-caption" }, snapshot.status === "error" ? t.stale : `${t.resetAt} ${formatMoment(report?.expiresAt, t.lang) ?? t.noDeadline}`))
  );
}
function QoderQuotaPanel(props) {
  const { t, snapshot, report } = useView(props);
  const enabled = props.useQuotaSettings?.((state) => state.enabled) ?? false;
  const startAutoRefresh = props.startAutoRefresh;
  (0, import_react3.useEffect)(() => {
    if (startAutoRefresh === void 0) return void 0;
    return startAutoRefresh();
  }, [startAutoRefresh]);
  const now = Date.now();
  const refreshed = snapshot.fetchedAt === void 0 ? t.never : formatMoment(snapshot.fetchedAt, t.lang) ?? t.never;
  const personal = report?.personal;
  const organization = report?.organizationPool;
  const organizationActive = organization !== void 0 && organization.available !== false;
  const percent = personal === void 0 ? percentOf(report?.totalPercentage ?? 0) : percentOf(usedRatio(personal.used, personal.total, personal.percentage));
  const exceeded = report?.isQuotaExceeded === true || personal !== void 0 && percent >= 100;
  const failure = snapshot.status === "error" && snapshot.error !== void 0 ? statusHeadline(t, snapshot.error) : void 0;
  const cycleStart = formatShortDay(report?.periodStart, t.lang);
  const cycleEnd = formatShortDay(report?.periodEnd, t.lang);
  const days = daysUntil(report?.expiresAt, now);
  const owner = joinParts([report?.userType, report?.organizationName, report?.organizationRole]);
  return /* @__PURE__ */ React3.createElement("section", { className: "qcp-main", "data-qoder-quota-panel": "true" }, /* @__PURE__ */ React3.createElement("div", { className: "qcp-inner" }, /* @__PURE__ */ React3.createElement("header", { className: "qcp-head" }, /* @__PURE__ */ React3.createElement("div", { className: "qcp-headText" }, /* @__PURE__ */ React3.createElement("h2", { className: "qcp-title" }, t.panelTitle), /* @__PURE__ */ React3.createElement("span", { className: "qcp-sub" }, t.panelSubtitle)), /* @__PURE__ */ React3.createElement("div", { className: "qcp-actions" }, /* @__PURE__ */ React3.createElement("span", { className: "qcp-meta", role: "status" }, `${snapshot.status === "error" && report !== void 0 ? t.stale : t.refreshedAt} \xB7 ${refreshed}`), /* @__PURE__ */ React3.createElement(
    "button",
    {
      type: "button",
      className: "qcp-button",
      onClick: () => {
        props.refresh?.();
      },
      disabled: snapshot.status === "loading"
    },
    snapshot.status === "loading" ? t.loading : t.refresh
  ), /* @__PURE__ */ React3.createElement(
    "button",
    {
      type: "button",
      className: "qcp-iconButton",
      "aria-label": t.close,
      title: t.closeHint,
      onClick: () => {
        props.close?.();
      }
    },
    /* @__PURE__ */ React3.createElement("span", { "aria-hidden": "true" }, "\xD7")
  ))), exceeded ? /* @__PURE__ */ React3.createElement("div", { className: "qcp-alert", role: "alert" }, /* @__PURE__ */ React3.createElement("strong", null, t.exceeded), /* @__PURE__ */ React3.createElement("span", { className: "qcp-alertDetail" }, t.exceededHint)) : null, failure === void 0 ? null : /* @__PURE__ */ React3.createElement("div", { className: "qcp-alert", role: "alert" }, /* @__PURE__ */ React3.createElement("strong", null, failure.title), failure.detail === void 0 ? null : /* @__PURE__ */ React3.createElement("span", { className: "qcp-alertDetail" }, failure.detail)), report === void 0 ? /* @__PURE__ */ React3.createElement("div", { className: "qcp-card" }, /* @__PURE__ */ React3.createElement("span", { className: "qcp-note" }, snapshot.status === "loading" || snapshot.status === "idle" ? t.loading : t.error)) : /* @__PURE__ */ React3.createElement("div", { className: "qcp-card" }, /* @__PURE__ */ React3.createElement("div", { className: "qcp-identity" }, /* @__PURE__ */ React3.createElement("span", { className: "qcp-avatar", "aria-hidden": "true" }, "Q"), /* @__PURE__ */ React3.createElement("div", { className: "qcp-idText" }, /* @__PURE__ */ React3.createElement("span", { className: "qcp-planName" }, report.planTierName), owner === "" ? null : /* @__PURE__ */ React3.createElement("span", { className: "qcp-planOwner" }, owner)), /* @__PURE__ */ React3.createElement("span", { className: "qcp-spacer" }), exceeded ? /* @__PURE__ */ React3.createElement("span", { className: "qcp-badge qcp-badgeWarn" }, t.exceededShort) : null), /* @__PURE__ */ React3.createElement("div", { className: "qcp-divider" }), /* @__PURE__ */ React3.createElement("div", { className: "qcp-block" }, /* @__PURE__ */ React3.createElement("span", { className: "qcp-blockTitle" }, t.usageBlock), personal === void 0 ? /* @__PURE__ */ React3.createElement("span", { className: "qcp-note" }, t.noPersonalPool) : /* @__PURE__ */ React3.createElement(
    QuotaWindow,
    {
      t,
      label: t.personalPool,
      pool: personal,
      ...report.expiresAt === void 0 ? {} : { expiresAt: report.expiresAt },
      warn: exceeded
    }
  )), personal === void 0 ? null : /* @__PURE__ */ React3.createElement("div", { className: "qcp-tiles" }, /* @__PURE__ */ React3.createElement(
    QuotaTile,
    {
      label: t.billingCycle,
      value: cycleStart === void 0 || cycleEnd === void 0 ? t.noDeadline : `${cycleStart} \u2192 ${cycleEnd}`,
      ...formatYearSpan(report.periodStart, report.periodEnd) === void 0 ? {} : { sub: formatYearSpan(report.periodStart, report.periodEnd) },
      small: true
    }
  ), /* @__PURE__ */ React3.createElement(
    QuotaTile,
    {
      label: t.used,
      value: `${formatCredits(personal.used)} ${personal.unit}`,
      sub: `${t.limit} ${formatCredits(personal.total)} ${personal.unit}`
    }
  ), /* @__PURE__ */ React3.createElement(
    QuotaTile,
    {
      label: t.remaining,
      value: `${formatCredits(personal.remaining)} ${personal.unit}`,
      sub: `${String(Math.max(0, 100 - percent))}%`
    }
  ), /* @__PURE__ */ React3.createElement(
    QuotaTile,
    {
      label: t.resetAt,
      value: formatDay(report.expiresAt, t.lang) ?? t.noDeadline,
      ...days === void 0 ? {} : { sub: `${String(days)} ${t.daysLeftSuffix}` },
      small: true
    }
  ))), report?.addOnPool === void 0 ? null : /* @__PURE__ */ React3.createElement("div", { className: "qcp-card" }, /* @__PURE__ */ React3.createElement("div", { className: "qcp-block" }, /* @__PURE__ */ React3.createElement("span", { className: "qcp-blockTitle" }, t.addOnPool), /* @__PURE__ */ React3.createElement(
    QuotaWindow,
    {
      t,
      label: t.addOnPool,
      pool: report.addOnPool,
      ...report.expiresAt === void 0 ? {} : { expiresAt: report.expiresAt },
      warn: false
    }
  ))), organizationActive ? /* @__PURE__ */ React3.createElement("div", { className: "qcp-card" }, /* @__PURE__ */ React3.createElement("div", { className: "qcp-block" }, /* @__PURE__ */ React3.createElement("span", { className: "qcp-blockTitle" }, t.organizationPool), /* @__PURE__ */ React3.createElement(
    QuotaWindow,
    {
      t,
      label: t.organizationPool,
      pool: organization,
      ...report?.expiresAt === void 0 ? {} : { expiresAt: report.expiresAt },
      warn: false
    }
  ))) : organization === void 0 ? null : /* @__PURE__ */ React3.createElement("span", { className: "qcp-note" }, t.orgPoolDormant), /* @__PURE__ */ React3.createElement("div", { className: "qcp-panelFoot" }, report?.upgradeUrl === void 0 ? null : /* @__PURE__ */ React3.createElement("a", { className: "qcp-link", href: report.upgradeUrl, target: "_blank", rel: "noreferrer" }, t.upgrade), enabled ? null : /* @__PURE__ */ React3.createElement("span", { className: "qcp-note" }, t.settingsToggleHint))));
}

// src/client/provider-styles.ts
var PROVIDER_CSS = `
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
`;
function injectProviderStyles() {
  if (typeof document === "undefined") return () => {
  };
  const existing = document.getElementById("qoder-provider-styles");
  if (existing) return () => {
  };
  const style = document.createElement("style");
  style.id = "qoder-provider-styles";
  style.textContent = PROVIDER_CSS;
  document.head.appendChild(style);
  return () => style.remove();
}

// src/client/index.ts
var PROVIDER = "qoder-cn";
var DEFAULT_REF = "QODERCN_PERSONAL_ACCESS_TOKEN";
function recordOf2(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value : void 0;
}
function stringAt(value, key) {
  const record2 = recordOf2(value);
  const candidate = record2?.[key];
  return typeof candidate === "string" && candidate.trim().length > 0 ? candidate.trim() : void 0;
}
async function apiKeyRef(settings) {
  if (settings === void 0) throw new Error("Settings service unavailable");
  try {
    const response = await settings.describe();
    if (!response.ok) throw new Error("Settings read failed");
    const namespace = response.value.namespaces?.find(
      (entry) => entry.ns === SETTINGS_NS
    );
    const root = namespace?.value;
    const providers = recordOf2(recordOf2(root)?.providers);
    return stringAt(providers?.[PROVIDER], "apiKeyEnv") ?? stringAt(root, "apiKeyEnv") ?? DEFAULT_REF;
  } catch {
    throw new Error("Settings read failed");
  }
}
function createCredentialFace(credentials, settings) {
  let snapshot = {
    ref: DEFAULT_REF,
    configured: false,
    writable: true,
    loading: true
  };
  let generation = 0;
  const listeners = /* @__PURE__ */ new Set();
  const publish = () => {
    for (const listener of listeners) listener();
  };
  const refresh = async () => {
    const ticket = ++generation;
    snapshot = { ...snapshot, loading: true };
    publish();
    try {
      const ref = await apiKeyRef(settings());
      const response = await credentials.describe([ref]);
      if (ticket !== generation) return;
      if (response.ok) {
        const state = response.value[ref];
        snapshot = {
          ref,
          configured: state?.configured === true,
          writable: state?.writable !== false,
          loading: false
        };
      } else {
        snapshot = {
          ref,
          configured: false,
          writable: false,
          loading: false,
          error: response.error?.message ?? "credential status unavailable"
        };
      }
    } catch (error) {
      if (ticket !== generation) return;
      snapshot = {
        ref: snapshot.ref,
        configured: false,
        writable: false,
        loading: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
    publish();
  };
  void refresh();
  return {
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    refresh,
    set: async (value) => {
      if (snapshot.loading || !snapshot.writable || snapshot.error) return false;
      let response;
      try {
        const ref = await apiKeyRef(settings());
        response = await credentials.set(ref, value);
      } catch {
        await refresh();
        return false;
      }
      await refresh();
      return response.ok && snapshot.configured;
    }
  };
}
function selectPanel(ctx, id) {
  const get = ctx.get;
  const layout = typeof get === "function" ? get.call(ctx, "layout") : void 0;
  layout?.selectPanel(id);
}
var locale2 = {
  zh: {
    ...CAPACITY_ZH,
    title: "Qoder CN",
    configured: "PAT \u5DF2\u914D\u7F6E",
    notConfigured: "\u5C1A\u672A\u914D\u7F6E PAT",
    patLabel: "Qoder PAT",
    patHint: "\u7C98\u8D34 pt-... Personal Access Token\u3002\u5BC6\u94A5\u4F1A\u5199\u5165 DSH \u51ED\u636E\u670D\u52A1\u3002",
    save: "\u4FDD\u5B58",
    saving: "\u4FDD\u5B58\u4E2D\u2026",
    loading: "\u8BFB\u53D6\u4E2D\u2026",
    readOnly: "\u5F53\u524D profile \u7684\u51ED\u636E\u4E0D\u53EF\u5199\u3002",
    saveFailed: "PAT \u5199\u5165\u5931\u8D25\uFF0C\u8BF7\u91CD\u8BD5\u3002",
    integrations: "\u96C6\u6210\u4E0E\u663E\u793A",
    quotaToggle: "\u5728\u4FA7\u8FB9\u680F\u663E\u793A\u989D\u5EA6\u5361\u7247",
    quotaToggleHint: "\u9ED8\u8BA4\u5173\u95ED\uFF1B\u5173\u95ED\u65F6\u5DE6\u4FA7\u680F\u4E0D\u6E32\u67D3\u5361\u7247\uFF0C\u4E5F\u4E0D\u4F1A\u540E\u53F0\u5237\u65B0\u989D\u5EA6\u3002",
    quotaToggleFailed: "\u5F00\u5173\u5199\u5165\u5931\u8D25\uFF0C\u8BF7\u91CD\u8BD5\u3002"
  },
  en: {
    ...CAPACITY_EN,
    title: "Qoder CN",
    configured: "PAT configured",
    notConfigured: "PAT not configured",
    patLabel: "Qoder PAT",
    patHint: "Paste a pt-... Personal Access Token. It is stored in the DSH credentials service.",
    save: "Save",
    saving: "Saving\u2026",
    loading: "Loading\u2026",
    readOnly: "Credentials are read-only in this profile.",
    saveFailed: "The PAT could not be stored. Try again.",
    integrations: "Integrations & display",
    quotaToggle: "Show the quota card in the sidebar",
    quotaToggleHint: "Off by default; while off the sidebar renders no card and no background quota refresh runs.",
    quotaToggleFailed: "The toggle could not be stored. Try again."
  }
};
function apply(ctx) {
  ctx.effect(() => ctx.locale.register("settings.qoder", locale2));
  ctx.effect(
    () => ctx.locale.register(PANEL_LOCALE_NS, {
      zh: PANEL_TEXT_ZH,
      en: PANEL_TEXT_EN
    })
  );
  ctx.effect(() => injectQuotaStyles(), "dsh-provider-qoder: quota styles");
  ctx.effect(
    () => injectProviderStyles(),
    "dsh-provider-qoder: provider styles"
  );
  let settings;
  const { quota: quotaSettings, capacity: capacitySettings } = createSettingsFaces(() => settings);
  let credentialFace;
  let quotaNamespace;
  const quota = createQuotaController(() => quotaNamespace);
  const models = createModelsFace(
    () => quotaNamespace
  );
  void ctx.remote.$mount(QUOTA_REMOTE_CONTRIBUTION).then(
    (dispose) => {
      ctx.effect(
        () => () => {
          void dispose();
        },
        "dsh-provider-qoder: quota remote"
      );
    },
    (error) => {
      console.error(
        "[dsh-provider-qoder] could not mount the quota remote:",
        error
      );
    }
  );
  ctx.inject(["remote.qoder"], (quotaCtx) => {
    quotaNamespace = quotaCtx.remote.qoder;
    void quota.refresh();
    void models.refresh();
    quotaCtx.effect(() => () => {
      quotaNamespace = void 0;
    });
  });
  const panelFace = () => ({
    hooks: { quota, quotaSettings },
    refresh: () => {
      void quota.refresh();
    },
    // `visible` is the only gate on the background poll: while the toggle is
    // off nothing is rendered AND nothing is refreshed.
    startAutoRefresh: () => startQuotaAutoRefresh(quota, () => quotaSettings.getSnapshot().enabled),
    open: () => {
      selectPanel(ctx, QUOTA_PANEL_ID);
    },
    close: () => {
      selectPanel(ctx, null);
    }
  });
  try {
    ctx.slots.inject(
      "main",
      () => ctx.slots.register(
        {
          name: "main",
          key: QUOTA_PANEL_ID,
          locale: PANEL_LOCALE_NS,
          inject: panelFace
        },
        QoderQuotaPanel
      )
    );
  } catch (error) {
    console.error(
      "[dsh-provider-qoder] could not register the quota panel:",
      error
    );
  }
  ctx.inject(["layout"], (layoutCtx) => {
    try {
      layoutCtx.slots.inject(
        "sidebar.footer.action",
        () => layoutCtx.slots.register(
          {
            name: "sidebar.footer.action",
            id: QUOTA_PANEL_ID,
            order: 1,
            locale: PANEL_LOCALE_NS,
            inject: panelFace
          },
          QoderQuotaFooterEntry
        )
      );
    } catch (error) {
      console.error(
        "[dsh-provider-qoder] could not register the sidebar quota card:",
        error
      );
    }
  });
  ctx.inject(["remote.settings"], (settingsCtx) => {
    settings = settingsCtx.remote.settings;
    void capacitySettings.refresh();
    void credentialFace?.refresh();
    settingsCtx.effect(() => () => {
      settings = void 0;
      void capacitySettings.refresh();
      void credentialFace?.refresh();
    });
  });
  ctx.inject(["remote.credentials"], (credentialsCtx) => {
    const credentials = credentialsCtx.remote.credentials;
    const face = createCredentialFace(credentials, () => settings);
    credentialFace = face;
    ctx.slots.inject(
      "settings.models.provider-card",
      () => ctx.slots.register(
        {
          name: "settings.models.provider-card",
          key: SETTINGS_NS,
          locale: "settings.qoder",
          inject: () => ({
            credential: face,
            quotaSettings,
            capacitySettings,
            models,
            quota,
            openQuota: () => {
              selectPanel(ctx, QUOTA_PANEL_ID);
            }
          })
        },
        QoderProviderCard
      )
    );
  });
}
var inject = ["slots", "locale", "remote"];
return module.exports; } });
