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
function arrayField(source, key) {
  const value = source[key];
  return Array.isArray(value) ? value : reject(key);
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
function parseSpend(value, field) {
  const source = record(value, field);
  const windows = arrayField(source, "windows").map((entry, index) => {
    const window = record(entry, `${field}.windows[${String(index)}]`);
    const parsed = {
      spanMs: numberField(window, "spanMs"),
      credits: numberField(window, "credits"),
      requests: numberField(window, "requests")
    };
    if (window.resetsAt !== void 0) parsed.resetsAt = numberField(window, "resetsAt");
    return parsed;
  });
  const spend = { windows };
  if (source.updatedAt !== void 0) spend.updatedAt = numberField(source, "updatedAt");
  return spend;
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
  if (source.spend !== void 0) {
    snapshot.spend = parseSpend(source.spend, "spend");
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
var QUOTA_REMOTE_CONTRIBUTION = {
  package: REMOTE_PACKAGE,
  descriptors: [QUOTA_DESCRIPTOR]
};

// src/client/card.tsx
var React = __toESM(require("react"), 1);
var import_react = require("react");
var SECTION_STYLE = { display: "grid", gap: "8px", padding: "12px 0" };
function defaultText(key) {
  return {
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
  }[key] ?? key;
}
function QoderProviderCard(props) {
  const t = props.t ?? defaultText;
  const quota = props.quotaSettings;
  const [snapshot, setSnapshot] = (0, import_react.useState)(() => props.credential.getSnapshot());
  const [quotaSnapshot, setQuotaSnapshot] = (0, import_react.useState)(
    () => quota?.getSnapshot()
  );
  const [draft, setDraft] = (0, import_react.useState)("");
  const [saving, setSaving] = (0, import_react.useState)(false);
  const [failed, setFailed] = (0, import_react.useState)(false);
  const [quotaBusy, setQuotaBusy] = (0, import_react.useState)(false);
  const rootRef = (0, import_react.useRef)(null);
  (0, import_react.useEffect)(() => {
    setSnapshot(props.credential.getSnapshot());
    return props.credential.subscribe(() => setSnapshot(props.credential.getSnapshot()));
  }, [props.credential]);
  (0, import_react.useEffect)(() => {
    if (quota === void 0) return void 0;
    setQuotaSnapshot(quota.getSnapshot());
    return quota.subscribe(() => setQuotaSnapshot(quota.getSnapshot()));
  }, [quota]);
  const configured = snapshot.loading ? props.keyConfigured === true : snapshot.configured;
  const disabled = saving || !snapshot.writable;
  const save = async () => {
    const value = draft.trim();
    if (value.length === 0 || disabled) return;
    setSaving(true);
    setFailed(false);
    try {
      const ok = await props.credential.set(value);
      if (ok) setDraft("");
      else setFailed(true);
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  };
  const quotaEnabled = quotaSnapshot?.enabled === true;
  const quotaReadOnly = quotaSnapshot === void 0 || quotaSnapshot.loading || !quotaSnapshot.writable;
  const toggleQuota = async (next) => {
    if (quota === void 0 || quotaReadOnly || quotaBusy) return;
    setQuotaBusy(true);
    try {
      await quota.set(next);
    } catch {
    } finally {
      setQuotaBusy(false);
    }
  };
  return /* @__PURE__ */ React.createElement("div", { ref: rootRef, "data-qoder-models-card": "true" }, /* @__PURE__ */ React.createElement("div", { style: SECTION_STYLE }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", justifyContent: "space-between", gap: "8px" } }, /* @__PURE__ */ React.createElement("strong", null, t("title")), /* @__PURE__ */ React.createElement("span", null, snapshot.loading ? t("loading") : configured ? t("configured") : t("notConfigured"))), /* @__PURE__ */ React.createElement("label", { style: { display: "grid", gap: "4px" } }, /* @__PURE__ */ React.createElement("span", null, t("patLabel")), /* @__PURE__ */ React.createElement(
    "input",
    {
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
  )), /* @__PURE__ */ React.createElement("small", null, snapshot.writable ? t("patHint") : t("readOnly")), snapshot.error !== void 0 ? /* @__PURE__ */ React.createElement("small", { role: "status" }, snapshot.error) : null, failed ? /* @__PURE__ */ React.createElement("small", { role: "alert" }, t("saveFailed")) : null, /* @__PURE__ */ React.createElement("div", { style: { paddingBottom: "12px", borderBottom: "1px solid rgba(127,127,127,0.28)" } }, /* @__PURE__ */ React.createElement("button", { type: "button", disabled: disabled || draft.trim().length === 0, onClick: () => {
    void save();
  } }, saving ? t("saving") : t("save")))), quota === void 0 ? null : /* @__PURE__ */ React.createElement("section", { "data-qoder-integrations": "true", style: { display: "grid", gap: "6px", paddingBottom: "12px" } }, /* @__PURE__ */ React.createElement("strong", null, t("integrations")), /* @__PURE__ */ React.createElement("label", { style: { display: "flex", alignItems: "center", gap: "8px" } }, /* @__PURE__ */ React.createElement(
    "input",
    {
      type: "checkbox",
      "data-qoder-quota-toggle": "true",
      checked: quotaEnabled,
      disabled: quotaReadOnly || quotaBusy,
      onChange: (event) => {
        void toggleQuota(event.target.checked);
      }
    }
  ), /* @__PURE__ */ React.createElement("span", null, t("quotaToggle"))), /* @__PURE__ */ React.createElement("small", { style: { opacity: 0.75 } }, t("quotaToggleHint")), quotaSnapshot?.failed === true ? /* @__PURE__ */ React.createElement("small", { role: "alert" }, t("quotaToggleFailed")) : null));
}

// src/client/copy.ts
var PANEL_LOCALE_NS = "panel.qoder";
var PANEL_TEXT_ZH = {
  lang: "zh",
  cardTitle: "\u989D\u5EA6",
  cardHint: "\u67E5\u770B Qoder CN \u5957\u9910\u4E0E\u989D\u5EA6",
  panelTitle: "Qoder CN \u5957\u9910\u4E0E\u989D\u5EA6",
  close: "\u8FD4\u56DE\u4F1A\u8BDD",
  closeHint: "\u5173\u95ED\u6B64\u9762\u677F\u5E76\u8FD4\u56DE\u5F53\u524D\u4F1A\u8BDD",
  refresh: "\u5237\u65B0",
  loading: "\u8BFB\u53D6\u4E2D\u2026",
  unavailable: "\u5F53\u524D profile \u672A\u6302\u8F7D\u989D\u5EA6\u670D\u52A1\u3002",
  notConfigured: "\u5C1A\u672A\u914D\u7F6E PAT\uFF0C\u65E0\u6CD5\u8BFB\u53D6\u989D\u5EA6\u3002",
  error: "\u989D\u5EA6\u8BFB\u53D6\u5931\u8D25",
  plan: "\u5957\u9910",
  account: "\u8D26\u6237\u7C7B\u578B",
  organization: "\u7EC4\u7EC7",
  role: "\u89D2\u8272",
  billingCycle: "\u8BA1\u8D39\u5468\u671F",
  personalPool: "\u4E2A\u4EBA\u5957\u9910\u989D\u5EA6",
  organizationPool: "\u7EC4\u7EC7\u8D44\u6E90\u5305",
  addOnPool: "\u8D2D\u4E70 / \u8D60\u9001\u989D\u5EA6",
  used: "\u5DF2\u7528",
  remaining: "\u5269\u4F59",
  resetAt: "\u91CD\u7F6E\u65F6\u95F4",
  noDeadline: "\u672A\u63D0\u4F9B",
  dormant: "\u5F53\u524D\u672A\u542F\u7528",
  exceeded: "\u989D\u5EA6\u5DF2\u7528\u5C3D",
  upgrade: "\u5347\u7EA7\u5957\u9910",
  refreshedAt: "\u66F4\u65B0\u4E8E",
  never: "\u5C1A\u672A\u8BFB\u53D6",
  settingsToggle: "\u5728\u4FA7\u8FB9\u680F\u663E\u793A\u989D\u5EA6\u5361\u7247",
  settingsToggleHint: "\u9ED8\u8BA4\u5173\u95ED\uFF1B\u5173\u95ED\u65F6\u5DE6\u4FA7\u680F\u4E0D\u6E32\u67D3\u5361\u7247\uFF0C\u4E5F\u4E0D\u4F1A\u540E\u53F0\u5237\u65B0\u989D\u5EA6\u3002",
  settingsToggleFailed: "\u5F00\u5173\u5199\u5165\u5931\u8D25\uFF0C\u8BF7\u91CD\u8BD5\u3002",
  spendTitle: "\u6EDA\u52A8\u7528\u91CF",
  spendHint: "\u672C\u5730\u7EDF\u8BA1\uFF1A\u7531\u672C\u673A\u5DF2\u5B8C\u6210\u7684\u8BF7\u6C42\u7D2F\u8BA1\uFF0CQoder \u672C\u8EAB\u4E0D\u63D0\u4F9B 5 \u5C0F\u65F6 / \u6BCF\u5468\u7A97\u53E3\uFF1B\u6708\u5EA6\u989D\u5EA6\u4EE5\u4E0A\u65B9\u5957\u9910\u6C60\u4E3A\u51C6\u3002",
  spendNever: "\u5C1A\u65E0\u672C\u5730\u8BB0\u5F55",
  spendRequests: "\u8BF7\u6C42",
  creditsUnit: "\u79EF\u5206",
  window5h: "5 \u5C0F\u65F6",
  window24h: "24 \u5C0F\u65F6",
  window7d: "7 \u5929",
  window5hShort: "5h",
  window24hShort: "24h",
  window7dShort: "7d",
  hoursUnit: "\u5C0F\u65F6",
  daysUnit: "\u5929"
};
var PANEL_TEXT_EN = {
  lang: "en",
  cardTitle: "Usage",
  cardHint: "Qoder CN plan and quota",
  panelTitle: "Qoder CN plan & quota",
  close: "Back to conversation",
  closeHint: "Close this panel and return to the current conversation",
  refresh: "Refresh",
  loading: "Loading\u2026",
  unavailable: "The quota service is not mounted in this profile.",
  notConfigured: "No PAT is configured yet, so quota cannot be read.",
  error: "Could not read the quota",
  plan: "Plan",
  account: "Account",
  organization: "Organization",
  role: "Role",
  billingCycle: "Billing cycle",
  personalPool: "Personal plan credits",
  organizationPool: "Organization package",
  addOnPool: "Purchased / gifted credits",
  used: "Used",
  remaining: "Remaining",
  resetAt: "Resets",
  noDeadline: "Not reported",
  dormant: "Not currently drawn on",
  exceeded: "Quota exhausted",
  upgrade: "Upgrade plan",
  refreshedAt: "Updated",
  never: "Never",
  settingsToggle: "Show the quota card in the sidebar",
  settingsToggleHint: "Off by default; while off the sidebar renders no card and no background quota refresh runs.",
  settingsToggleFailed: "The toggle could not be stored. Try again.",
  spendTitle: "Rolling usage",
  spendHint: "Measured locally from completed requests on this machine \u2014 Qoder reports no five-hour or weekly window itself; the monthly pools above stay authoritative.",
  spendNever: "No local records yet",
  spendRequests: "Requests",
  creditsUnit: "credits",
  window5h: "5 hours",
  window24h: "24 hours",
  window7d: "7 days",
  window5hShort: "5h",
  window24hShort: "24h",
  window7dShort: "7d",
  hoursUnit: "hours",
  daysUnit: "days"
};
var HOUR_MS = 60 * 60 * 1e3;
function spendWindowLabel(spanMs, t, compact = false) {
  switch (spanMs) {
    case 5 * HOUR_MS:
      return compact ? t.window5hShort : t.window5h;
    case 24 * HOUR_MS:
      return compact ? t.window24hShort : t.window24h;
    case 7 * 24 * HOUR_MS:
      return compact ? t.window7dShort : t.window7d;
    default:
      break;
  }
  const days = spanMs / (24 * HOUR_MS);
  if (Number.isInteger(days) && days >= 1) return `${String(days)} ${t.daysUnit}`;
  const hours = Math.max(1, Math.round(spanMs / HOUR_MS));
  return `${String(hours)} ${t.hoursUnit}`;
}
function qoderPanelText(t) {
  const key = t("lang");
  return key === "zh" ? PANEL_TEXT_ZH : PANEL_TEXT_EN;
}

// src/client/panel.tsx
var React2 = __toESM(require("react"), 1);
var import_react2 = require("react");
var QUOTA_PANEL_ID = "qoder-quota-panel";
function formatCredits(value) {
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
}
function formatRatio(ratio) {
  return `${String(Math.round(Math.max(0, Math.min(1, ratio)) * 100))}%`;
}
function formatMoment(ms, lang) {
  if (ms === void 0 || !Number.isFinite(ms)) return void 0;
  try {
    return new Date(ms).toLocaleString(lang === "zh" ? "zh-CN" : "en-US", {
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
function QuotaBar(props) {
  const percent = Math.round(Math.max(0, Math.min(1, props.ratio)) * 100);
  return /* @__PURE__ */ React2.createElement(
    "div",
    {
      role: "progressbar",
      "aria-label": props.label,
      "aria-valuemin": 0,
      "aria-valuemax": 100,
      "aria-valuenow": percent,
      style: { height: "6px", borderRadius: "3px", background: "rgba(127,127,127,0.28)", overflow: "hidden" }
    },
    /* @__PURE__ */ React2.createElement("div", { style: { width: `${String(percent)}%`, height: "100%", background: percent >= 100 ? "#d9534f" : "currentColor" } })
  );
}
function QuotaRow(props) {
  return /* @__PURE__ */ React2.createElement("div", { style: { display: "flex", justifyContent: "space-between", gap: "12px" } }, /* @__PURE__ */ React2.createElement("span", { style: { opacity: 0.7 } }, props.label), /* @__PURE__ */ React2.createElement("span", null, props.value));
}
function QuotaPool(props) {
  const { t, pool } = props;
  const ratio = pool.total > 0 ? pool.used / pool.total : pool.percentage;
  const reset = formatMoment(props.expiresAt, t.lang) ?? t.noDeadline;
  return /* @__PURE__ */ React2.createElement("div", { style: { display: "grid", gap: "6px", padding: "10px 12px", border: "1px solid rgba(127,127,127,0.3)", borderRadius: "8px" } }, /* @__PURE__ */ React2.createElement("div", { style: { display: "flex", justifyContent: "space-between", gap: "12px" } }, /* @__PURE__ */ React2.createElement("strong", null, props.title), props.dormant === true ? /* @__PURE__ */ React2.createElement("em", null, t.dormant) : /* @__PURE__ */ React2.createElement("span", null, formatRatio(ratio))), /* @__PURE__ */ React2.createElement(QuotaBar, { ratio, label: props.title }), /* @__PURE__ */ React2.createElement(QuotaRow, { label: t.used, value: `${formatCredits(pool.used)} / ${formatCredits(pool.total)} ${pool.unit}` }), /* @__PURE__ */ React2.createElement(QuotaRow, { label: t.remaining, value: `${formatCredits(pool.remaining)} ${pool.unit}` }), /* @__PURE__ */ React2.createElement(QuotaRow, { label: t.resetAt, value: reset }));
}
function useView(props) {
  const t = qoderPanelText(props.t ?? ((key) => PANEL_TEXT_EN[key] ?? key));
  const snapshot = props.useQuota?.((state) => state) ?? { status: "idle" };
  return { t, snapshot, report: snapshot.report };
}
function windowExtremes(spend) {
  let short;
  let long;
  for (const window of spend.windows) {
    if (short === void 0 || window.spanMs < short.spanMs) short = window;
    if (long === void 0 || window.spanMs > long.spanMs) long = window;
  }
  return {
    ...short === void 0 ? {} : { short },
    ...long === void 0 ? {} : { long }
  };
}
function spendBrief(spend, t) {
  const { short, long } = windowExtremes(spend);
  if (short === void 0 || long === void 0) return void 0;
  const windows = short.spanMs === long.spanMs ? [short] : [short, long];
  const parts = windows.map(
    (window) => `${spendWindowLabel(window.spanMs, t, true)} ${formatCredits(window.credits)}`
  );
  return `${parts.join(" \xB7 ")} ${t.creditsUnit}`;
}
function SpendSection(props) {
  const { t, spend } = props;
  return /* @__PURE__ */ React2.createElement(
    "section",
    {
      "data-qoder-spend": "true",
      style: { display: "grid", gap: "8px", padding: "10px 12px", border: "1px solid rgba(127,127,127,0.3)", borderRadius: "8px" }
    },
    /* @__PURE__ */ React2.createElement("div", { style: { display: "flex", justifyContent: "space-between", gap: "12px" } }, /* @__PURE__ */ React2.createElement("strong", null, t.spendTitle), /* @__PURE__ */ React2.createElement("small", { style: { opacity: 0.75 } }, spend.updatedAt === void 0 ? t.spendNever : formatMoment(spend.updatedAt, t.lang) ?? t.spendNever)),
    spend.windows.map((window) => /* @__PURE__ */ React2.createElement("div", { key: window.spanMs, style: { display: "grid", gap: "2px" } }, /* @__PURE__ */ React2.createElement(
      QuotaRow,
      {
        label: spendWindowLabel(window.spanMs, t),
        value: `${formatCredits(window.credits)} ${t.creditsUnit}`
      }
    ), /* @__PURE__ */ React2.createElement("div", { style: { display: "flex", justifyContent: "space-between", gap: "12px", opacity: 0.7 } }, /* @__PURE__ */ React2.createElement("small", null, `${t.spendRequests} ${String(window.requests)}`), window.resetsAt === void 0 ? null : /* @__PURE__ */ React2.createElement("small", null, `${t.resetAt} ${formatMoment(window.resetsAt, t.lang) ?? t.noDeadline}`)))),
    /* @__PURE__ */ React2.createElement("small", { style: { opacity: 0.7 } }, t.spendHint)
  );
}
function QoderQuotaFooterEntry(props) {
  const enabled = props.useQuotaSettings?.((state) => state.enabled) ?? false;
  const { t, snapshot, report } = useView(props);
  const startAutoRefresh = props.startAutoRefresh;
  (0, import_react2.useEffect)(() => {
    if (!enabled || startAutoRefresh === void 0) return void 0;
    return startAutoRefresh();
  }, [enabled, startAutoRefresh]);
  if (!enabled) return null;
  const summary = report === void 0 ? snapshot.status === "loading" ? t.loading : t.error : `${report.planTierName} \xB7 ${formatRatio(report.totalPercentage)}`;
  const brief = report?.spend === void 0 ? void 0 : spendBrief(report.spend, t);
  return /* @__PURE__ */ React2.createElement(
    "button",
    {
      type: "button",
      "data-qoder-quota-card": "true",
      title: t.cardHint,
      onClick: () => {
        props.open?.();
      },
      style: {
        display: "grid",
        gap: "4px",
        width: "100%",
        padding: "8px 10px",
        border: "1px solid rgba(127,127,127,0.35)",
        borderRadius: "8px",
        background: "transparent",
        color: "inherit",
        cursor: "pointer",
        font: "inherit",
        textAlign: "left"
      }
    },
    /* @__PURE__ */ React2.createElement("span", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" } }, /* @__PURE__ */ React2.createElement("span", null, t.cardTitle), /* @__PURE__ */ React2.createElement("small", { style: { opacity: 0.75 } }, summary)),
    brief === void 0 ? null : /* @__PURE__ */ React2.createElement("small", { style: { opacity: 0.6 } }, brief)
  );
}
function QoderQuotaPanel(props) {
  const { t, snapshot, report } = useView(props);
  const enabled = props.useQuotaSettings?.((state) => state.enabled) ?? false;
  const startAutoRefresh = props.startAutoRefresh;
  (0, import_react2.useEffect)(() => {
    if (startAutoRefresh === void 0) return void 0;
    return startAutoRefresh();
  }, [startAutoRefresh]);
  const refreshed = snapshot.fetchedAt === void 0 ? t.never : formatMoment(snapshot.fetchedAt, t.lang) ?? t.never;
  const personal = report?.personal;
  const organization = report?.organizationPool;
  const organizationActive = organization !== void 0 && organization.available !== false;
  return /* @__PURE__ */ React2.createElement(
    "section",
    {
      "data-qoder-quota-panel": "true",
      style: { display: "grid", gap: "12px", alignContent: "start", padding: "16px 20px", overflow: "auto", height: "100%" }
    },
    /* @__PURE__ */ React2.createElement("header", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" } }, /* @__PURE__ */ React2.createElement("h2", { style: { margin: 0, fontSize: "1.1em" } }, t.panelTitle), /* @__PURE__ */ React2.createElement("div", { style: { display: "flex", alignItems: "center", gap: "8px" } }, /* @__PURE__ */ React2.createElement("button", { type: "button", onClick: () => {
      props.refresh?.();
    }, disabled: snapshot.status === "loading" }, snapshot.status === "loading" ? t.loading : t.refresh), /* @__PURE__ */ React2.createElement(
      "button",
      {
        type: "button",
        "aria-label": t.close,
        title: t.closeHint,
        onClick: () => {
          props.close?.();
        },
        style: { border: "none", background: "transparent", color: "inherit", cursor: "pointer", fontSize: "1.2em", lineHeight: 1 }
      },
      /* @__PURE__ */ React2.createElement("span", { "aria-hidden": "true" }, "\xD7")
    ))),
    report?.isQuotaExceeded === true ? /* @__PURE__ */ React2.createElement("div", { role: "alert", style: { padding: "8px 12px", border: "1px solid #d9534f", borderRadius: "8px" } }, t.exceeded) : null,
    snapshot.status === "error" ? /* @__PURE__ */ React2.createElement("div", { role: "alert", style: { display: "grid", gap: "6px" } }, /* @__PURE__ */ React2.createElement("span", null, t.error), snapshot.error !== void 0 ? /* @__PURE__ */ React2.createElement("small", { style: { opacity: 0.7 } }, snapshot.error) : null) : null,
    report === void 0 ? null : /* @__PURE__ */ React2.createElement("div", { style: { display: "grid", gap: "6px" } }, /* @__PURE__ */ React2.createElement(QuotaRow, { label: t.plan, value: report.planTierName }), /* @__PURE__ */ React2.createElement(QuotaRow, { label: t.account, value: report.userType }), report.organizationName === void 0 ? null : /* @__PURE__ */ React2.createElement(QuotaRow, { label: t.organization, value: report.organizationName }), report.organizationRole === void 0 ? null : /* @__PURE__ */ React2.createElement(QuotaRow, { label: t.role, value: report.organizationRole }), /* @__PURE__ */ React2.createElement(
      QuotaRow,
      {
        label: t.billingCycle,
        value: `${formatMoment(report.periodStart, t.lang) ?? t.noDeadline} \u2192 ${formatMoment(report.periodEnd, t.lang) ?? t.noDeadline}`
      }
    )),
    personal === void 0 ? null : /* @__PURE__ */ React2.createElement(QuotaPool, { t, title: t.personalPool, pool: personal, expiresAt: report?.expiresAt }),
    organization === void 0 ? null : /* @__PURE__ */ React2.createElement(
      QuotaPool,
      {
        t,
        title: t.organizationPool,
        pool: organization,
        expiresAt: report?.expiresAt,
        ...organizationActive ? {} : { dormant: true }
      }
    ),
    report?.addOnPool === void 0 ? null : /* @__PURE__ */ React2.createElement(QuotaPool, { t, title: t.addOnPool, pool: report.addOnPool, expiresAt: report.expiresAt }),
    report?.spend === void 0 ? null : /* @__PURE__ */ React2.createElement(SpendSection, { t, spend: report.spend }),
    /* @__PURE__ */ React2.createElement("footer", { style: { display: "flex", justifyContent: "space-between", gap: "12px", opacity: 0.7 } }, /* @__PURE__ */ React2.createElement("small", null, `${t.refreshedAt} ${refreshed}`), report?.upgradeUrl === void 0 ? null : /* @__PURE__ */ React2.createElement("a", { href: report.upgradeUrl, target: "_blank", rel: "noreferrer" }, t.upgrade)),
    enabled ? null : /* @__PURE__ */ React2.createElement("small", { style: { opacity: 0.7 } }, t.settingsToggleHint)
  );
}

// src/client/quota.ts
var QUOTA_AUTO_REFRESH_MS = 12e4;
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
        status: "error",
        error: "the qoder/quota remote is not mounted",
        ...snapshot.fetchedAt === void 0 ? {} : { fetchedAt: snapshot.fetchedAt }
      };
      publish();
      return;
    }
    try {
      const response = await namespace.quota();
      if (ticket !== generation) return;
      snapshot = response.ok ? { status: "ready", report: response.value, fetchedAt: Date.now() } : {
        status: "error",
        error: response.error?.message ?? "the quota read failed",
        ...snapshot.fetchedAt === void 0 ? {} : { fetchedAt: snapshot.fetchedAt }
      };
    } catch (error) {
      if (ticket !== generation) return;
      snapshot = {
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
  const ticket = ++ticketSeq;
  const tick = () => {
    if (activeTicket !== ticket) return;
    if (isVisible()) void controller.refresh();
    handle = timer.set(tick, QUOTA_AUTO_REFRESH_MS);
  };
  if (activeTicket === void 0) {
    activeTicket = ticket;
    handle = timer.set(tick, QUOTA_AUTO_REFRESH_MS);
    if (isVisible()) void controller.refresh();
  }
  return () => {
    references -= 1;
    if (references > 0 || activeTicket !== ticket) return;
    activeTicket = void 0;
    if (handle !== void 0) timer.clear(handle);
    handle = void 0;
  };
}
var references = 0;
var ticketSeq = 0;
var activeTicket;
var handle;

// src/client/settings.ts
var SETTINGS_NS = "llm-qoder";
var SHOW_SIDEBAR_QUOTA_FIELD = "showSidebarQuota";
function recordOf(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value : void 0;
}
function rowFor(response) {
  if (!response.ok) return void 0;
  return response.value.namespaces?.find((entry) => entry.ns === SETTINGS_NS);
}
function createQuotaSettingsFace(resolve) {
  let snapshot = { enabled: false, loading: true, writable: true, failed: false };
  let revision;
  const listeners = /* @__PURE__ */ new Set();
  const publish = () => {
    for (const listener of listeners) listener();
  };
  const refresh = async () => {
    const settings = resolve();
    if (settings === void 0) {
      snapshot = { enabled: false, loading: false, writable: false, failed: false };
      publish();
      return;
    }
    try {
      const response = await settings.describe();
      const row = rowFor(response);
      if (row !== void 0 && typeof row.revision === "number") revision = row.revision;
      const value = recordOf(row?.value);
      snapshot = {
        enabled: value?.[SHOW_SIDEBAR_QUOTA_FIELD] === true,
        loading: false,
        writable: response.ok ? response.value.writable !== false : false,
        failed: false
      };
    } catch {
      snapshot = { ...snapshot, loading: false, writable: false, failed: true };
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
      const settings = resolve();
      if (settings === void 0) {
        snapshot = { ...snapshot, failed: true };
        publish();
        return false;
      }
      try {
        let response = await settings.mutate(
          SETTINGS_NS,
          [{ op: "set", path: [SHOW_SIDEBAR_QUOTA_FIELD], value }],
          revision
        );
        if (!response.ok) {
          await refresh();
          response = await settings.mutate(
            SETTINGS_NS,
            [{ op: "set", path: [SHOW_SIDEBAR_QUOTA_FIELD], value }],
            revision
          );
        }
        await refresh();
        const accepted = response.ok;
        snapshot = { ...snapshot, failed: !accepted, enabled: accepted ? value : snapshot.enabled };
        publish();
        return accepted;
      } catch {
        snapshot = { ...snapshot, failed: true };
        publish();
        return false;
      }
    }
  };
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
  if (settings === void 0) return DEFAULT_REF;
  try {
    const response = await settings.describe();
    if (!response.ok) return DEFAULT_REF;
    const namespace = response.value.namespaces?.find((entry) => entry.ns === SETTINGS_NS);
    const root = namespace?.value;
    const providers = recordOf2(recordOf2(root)?.providers);
    return stringAt(providers?.[PROVIDER], "apiKeyEnv") ?? stringAt(root, "apiKeyEnv") ?? DEFAULT_REF;
  } catch {
    return DEFAULT_REF;
  }
}
function createCredentialFace(credentials, settings) {
  let snapshot = {
    ref: DEFAULT_REF,
    configured: false,
    writable: true,
    loading: true
  };
  const listeners = /* @__PURE__ */ new Set();
  const publish = () => {
    for (const listener of listeners) listener();
  };
  const refresh = async () => {
    const ref = await apiKeyRef(settings());
    try {
      const response = await credentials.describe([ref]);
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
          writable: true,
          loading: false,
          error: response.error?.message ?? "credential status unavailable"
        };
      }
    } catch (error) {
      snapshot = {
        ref,
        configured: false,
        writable: true,
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
      const ref = await apiKeyRef(settings());
      let response;
      try {
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
var locale = {
  zh: {
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
  ctx.effect(() => ctx.locale.register("settings.qoder", locale));
  ctx.effect(() => ctx.locale.register(PANEL_LOCALE_NS, { zh: PANEL_TEXT_ZH, en: PANEL_TEXT_EN }));
  let settings;
  const quotaSettings = createQuotaSettingsFace(() => settings);
  let quotaNamespace;
  const quota = createQuotaController(() => quotaNamespace);
  void ctx.remote.$mount(QUOTA_REMOTE_CONTRIBUTION).then(
    (dispose) => {
      ctx.effect(() => () => {
        void dispose();
      }, "dsh-provider-qoder: quota remote");
    },
    (error) => {
      console.error("[dsh-provider-qoder] could not mount the quota remote:", error);
    }
  );
  ctx.inject(["remote.qoder"], (quotaCtx) => {
    quotaNamespace = quotaCtx.remote.qoder;
    void quota.refresh();
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
    ctx.slots.inject("main", () => ctx.slots.register(
      { name: "main", key: QUOTA_PANEL_ID, locale: PANEL_LOCALE_NS, inject: panelFace },
      QoderQuotaPanel
    ));
  } catch (error) {
    console.error("[dsh-provider-qoder] could not register the quota panel:", error);
  }
  ctx.inject(["layout"], (layoutCtx) => {
    try {
      layoutCtx.slots.inject("sidebar.footer.action", () => layoutCtx.slots.register(
        { name: "sidebar.footer.action", id: QUOTA_PANEL_ID, order: 1, locale: PANEL_LOCALE_NS, inject: panelFace },
        QoderQuotaFooterEntry
      ));
    } catch (error) {
      console.error("[dsh-provider-qoder] could not register the sidebar quota card:", error);
    }
  });
  ctx.inject(["remote.settings"], (settingsCtx) => {
    settings = settingsCtx.remote.settings;
    void quotaSettings.refresh();
    settingsCtx.effect(() => () => {
      settings = void 0;
    });
  });
  ctx.inject(["remote.credentials"], (credentialsCtx) => {
    const credentials = credentialsCtx.remote.credentials;
    const face = createCredentialFace(credentials, () => settings);
    ctx.slots.inject("settings.models.provider-card", () => ctx.slots.register({
      name: "settings.models.provider-card",
      key: SETTINGS_NS,
      locale: "settings.qoder",
      inject: () => ({ credential: face, quotaSettings })
    }, QoderProviderCard));
  });
}
var inject = ["slots", "locale", "remote"];
return module.exports; } });
