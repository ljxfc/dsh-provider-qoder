# Provider Settings Implementation Plan

> Execute tasks in this session with subagent-driven-development and review the integrated diff.

**Goal:** Implement the approved capacity controls and Qoder UI redesign.
**Architecture:** Keep DSH slots, credentials and settings services; share capacity resolution between model info and generation. Preserve existing fallback fields. Add a read-only models remote for displaying server capabilities and effective settings.
**Tech Stack:** TypeScript, React 18, Schemastery, Typert, esbuild, node:test.

## Global constraints

- No new runtime dependencies. Keep `qoder-cn`, `llm-qoder`, DSH ^0.2.0-rc.2 contracts.
- PAT remains in Host credentials. Auto mode preserves existing behavior.
- Decimal context presets include 500000 and 1000000; output presets show exact numbers.
- Keep dynamic discovery and unknown configuration fields.

## Task 1 — Capacity resolution and models remote

Files: `src/capacity.ts`, `src/adapter.ts`, `src/index.ts`, `src/usage-wire.ts`, `src/usage-remote.ts`, `test/capacity.test.mjs`.

Public configuration: `contextWindowOverride?: number`, `maxOutputTokens?: number`, `modelLimits?: Record<string, {contextWindow?: number; maxTokens?: number}>` at root and provider profile.
Model catalog adds `contextWindows?: number[]`. Models remote returns `{id,name,contextWindow?,maxTokens?,contextWindows:number[],effectiveContextWindow,effectiveMaxTokens}[]` using strict validation.

- [x] Inspect installed CLI/official sources for gateway context tier serialization; never infer it from SDK API naming.
- [x] Write tests with catalog default 200000, tiers [200000,1000000], explicit overrides 500000/1000000, model precedence, integer validation and output request clamping.
- [x] Preserve old no-override behavior; resolve explicit model override → explicit provider override → legacy catalog/built-in/fallback. Generation and resolveModel must agree on explicit output caps.
- [x] Expose capability/effective values via read-only `qoder/models` remote alongside quota.
- [x] Build and run targeted tests; record exact protocol evidence and unverified limitations.

## Task 2 — Settings controller and frontend

Files: `src/client/settings.ts`, `src/client/card.tsx`, `src/client/index.ts`, new client capacity UI and scoped styles, settings tests.

- [x] Add a revision-fenced capacity settings face; target the effective provider layer, preserve unrelated fields, re-read before conflict retry, disable writes on failed reads.
- [x] Build account header, compact PAT editor, provider defaults, expandable model overrides with automatic/preset/custom inputs and effective capability/source information.
- [x] Fetch read-only model capability remote; show unsupported preset warning without claiming backend support.
- [x] Include quota summary/manual refresh and detail panel action. Keep the sidebar toggle behavior.
- [x] Use scoped theme-aware responsive styles, bilingual copy, labelled controls, busy/error/success states and restore-auto.

## Task 3 — Quota resilience and integrated verification

Files: `src/client/quota.ts`, `src/client/panel.tsx`, `src/client/copy.ts`, tests, README files, validation notes.

- [x] Preserve last report on refresh failure and label stale data with successful timestamp; test first failure, retained report, latest response wins.
- [x] Review integrated implementation against approved spec and fix consequential defects.
- [x] Run `npm test`, `npm pack --dry-run`; inspect actual rendered UI in browser at light/dark and narrow/wide sizes and exercise save/reset flows.
- [x] Inspect local Desktop availability and perform runtime checks possible without disrupting user sessions; distinguish fixture UI from live Host/gateway verification.
- [x] Update both READMEs with configuration semantics and limits; leave reproducible validation evidence.
