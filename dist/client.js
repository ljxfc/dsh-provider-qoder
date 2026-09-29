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

// src/client/card.tsx
var React = __toESM(require("react"), 1);
var import_react = require("react");
var HIDDEN_STYLE = { display: "none" };
var CARD_SLOT = "settings.models.provider-card";
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
    saveFailed: "The PAT could not be stored. Try again."
  }[key] ?? key;
}
function adjacentEditorCard(wrapper) {
  if (wrapper === null) return null;
  for (const sibling of [wrapper.previousElementSibling, wrapper.nextElementSibling]) {
    if (sibling === null || typeof sibling !== "object") continue;
    const candidate = sibling;
    if (typeof candidate.className === "string" && candidate.className.includes("editor")) return candidate;
  }
  return null;
}
function QoderProviderCard(props) {
  const t = props.t ?? defaultText;
  const [snapshot, setSnapshot] = (0, import_react.useState)(() => props.credential.getSnapshot());
  const [draft, setDraft] = (0, import_react.useState)("");
  const [saving, setSaving] = (0, import_react.useState)(false);
  const [failed, setFailed] = (0, import_react.useState)(false);
  const [editorOpen, setEditorOpen] = (0, import_react.useState)(false);
  const rootRef = (0, import_react.useRef)(null);
  (0, import_react.useEffect)(() => {
    setSnapshot(props.credential.getSnapshot());
    return props.credential.subscribe(() => setSnapshot(props.credential.getSnapshot()));
  }, [props.credential]);
  (0, import_react.useEffect)(() => {
    const root = rootRef.current;
    if (root === null || typeof MutationObserver === "undefined") return void 0;
    const wrapper = root.closest(`[data-slot="${CARD_SLOT}"]`) ?? root.parentElement;
    const row = wrapper?.parentElement;
    if (wrapper === null || wrapper === void 0 || row === null || row === void 0) {
      setEditorOpen(true);
      return void 0;
    }
    let hiddenEditor = null;
    const sync = () => {
      const editor = adjacentEditorCard(wrapper);
      setEditorOpen(editor !== null);
      if (editor !== null && "style" in editor && editor.style !== void 0) {
        editor.style.display = "none";
        hiddenEditor = editor;
      }
    };
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(row, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      if (hiddenEditor?.style !== void 0) hiddenEditor.style.display = "";
    };
  }, []);
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
  return /* @__PURE__ */ React.createElement(
    "div",
    {
      ref: rootRef,
      "data-qoder-models-card": "true",
      style: editorOpen ? void 0 : HIDDEN_STYLE
    },
    editorOpen ? /* @__PURE__ */ React.createElement("div", { style: { padding: "12px 0", display: "grid", gap: "8px" } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", justifyContent: "space-between", gap: "8px" } }, /* @__PURE__ */ React.createElement("strong", null, t("title")), /* @__PURE__ */ React.createElement("span", null, snapshot.loading ? t("loading") : configured ? t("configured") : t("notConfigured"))), /* @__PURE__ */ React.createElement("label", { style: { display: "grid", gap: "4px" } }, /* @__PURE__ */ React.createElement("span", null, t("patLabel")), /* @__PURE__ */ React.createElement(
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
    )), /* @__PURE__ */ React.createElement("small", null, snapshot.writable ? t("patHint") : t("readOnly")), snapshot.error !== void 0 ? /* @__PURE__ */ React.createElement("small", { role: "status" }, snapshot.error) : null, failed ? /* @__PURE__ */ React.createElement("small", { role: "alert" }, t("saveFailed")) : null, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("button", { type: "button", disabled: disabled || draft.trim().length === 0, onClick: () => {
      void save();
    } }, saving ? t("saving") : t("save")))) : null
  );
}

// src/client/index.ts
var SETTINGS_NS = "llm-qoder";
var PROVIDER = "qoder-cn";
var DEFAULT_REF = "QODERCN_PERSONAL_ACCESS_TOKEN";
function recordOf(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value : void 0;
}
function stringAt(value, key) {
  const record = recordOf(value);
  const candidate = record?.[key];
  return typeof candidate === "string" && candidate.trim().length > 0 ? candidate.trim() : void 0;
}
async function apiKeyRef(settings) {
  if (settings === void 0) return DEFAULT_REF;
  try {
    const response = await settings.describe();
    if (!response.ok) return DEFAULT_REF;
    const namespace = response.value.namespaces?.find((entry) => entry.ns === SETTINGS_NS);
    const root = namespace?.value;
    const providers = recordOf(recordOf(root)?.providers);
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
    saveFailed: "PAT \u5199\u5165\u5931\u8D25\uFF0C\u8BF7\u91CD\u8BD5\u3002"
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
    saveFailed: "The PAT could not be stored. Try again."
  }
};
function apply(ctx) {
  ctx.effect(() => ctx.locale.register("settings.qoder", locale));
  ctx.inject(["remote.credentials"], (credentialsCtx) => {
    const credentials = credentialsCtx.remote.credentials;
    let settings;
    const face = createCredentialFace(credentials, () => settings);
    ctx.inject(["remote.settings"], (settingsCtx) => {
      settings = settingsCtx.remote.settings;
      void face.refresh();
      settingsCtx.effect(() => () => {
        settings = void 0;
      });
    });
    ctx.slots.inject("settings.models.provider-card", () => ctx.slots.register({
      name: "settings.models.provider-card",
      key: SETTINGS_NS,
      locale: "settings.qoder",
      inject: () => ({ credential: face })
    }, QoderProviderCard));
  });
}
var inject = ["slots", "locale", "remote"];
return module.exports; } });
