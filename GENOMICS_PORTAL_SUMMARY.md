# Genomics Portal — Requirements & Implementation Summary

Reference summary of the `docs/superpowers/` planning artifacts (one spec, three phase plans, one smoke-test checklist) and the resulting code in this branch (`feat/genomics-phase1`).

- **Spec:** `docs/superpowers/specs/2026-05-23-genomics-case-run-management-design.md`
- **Phase 1 plan:** `docs/superpowers/plans/2026-05-23-genomics-phase1-foundation.md`
- **Phase 2 plan:** `docs/superpowers/plans/2026-05-23-genomics-phase2-shell-screens.md`
- **Phase 3 plan:** `docs/superpowers/plans/2026-05-23-genomics-phase3-report-canvas.md`
- **Smoke test:** `docs/superpowers/checklists/2026-05-24-genomics-phase3-smoke-test.md`

---

## 1. What the project is

Hermes Workspace is the React 19 + TanStack Start control panel for a Hermes Agent gateway. The Hermes Agent runs on a local Parabricks GPU server and has 100+ skills (VCF interpretation, OncoKB/CIViC lookup, clinical-trial matching, 12-section Molecular Pathology report writing).

The Genomics Portal extends this workspace **in place** with a clinical-genomics control surface for two user groups:

- **Bioinformatics team** — pipeline operators (technical)
- **Clinical users** — oncologists / genetic counsellors who review and sign reports

The portal introduces four domain concepts:

| Entity | Meaning |
|---|---|
| **Case** | Patient umbrella entity: demographics, samples, linked Runs, clinical reports |
| **Run** | A secondary-analysis Parabricks job, tracked stage by stage |
| **Protocol** | A versioned, assay-specific "recipe" (skill sequence + prompt template + variables) for reproducible report generation — analogous to the existing Clear Labs liquid-handling Protocols |
| **Report** | 12-section Molecular Pathology & Precision Oncology report, parsed from agent-written markdown, editable section by section, then signed |

---

## 2. Design system requirement

- **Clear Labs Design System V3.0**, light theme — visually distinct from the existing dark workspace UI.
- Tokens (brand/gray scales, semantic green/yellow/red, spacing, radii, motion easing/durations) shipped as CSS custom properties.
- Imported **only** in the `/genomics` layout — never globally — so existing dark screens stay unchanged.
- Patterns: 56px white title bar, 48px tab toolbar with brand underline, status-stripe cards, pipeline-stage chevrons, brand-500 primary buttons, MICRO 11px Bold UPPERCASE labels.
- Font: Helvetica Neue / Condensed variant for pipeline chips.

---

## 3. Architecture requirement

```
Browser
  → TanStack Router (file-based, /genomics/* routes)
    → /api/genomics/** TanStack Start API routes
      → src/server/genomics/* stores + better-sqlite3 (~/.hermes/genomics.db)
      → /api/send-stream (existing) → Hermes Agent gateway via WebSocket
      → fs.watch on GENOMICS_REPORT_WATCH_PATH (report-watcher)
```

Decisions baked into the spec:

- **In-place extension** of hermes-workspace — root `/` redirects to `/genomics`; existing routes (`/chat`, `/dashboard`, `/terminal`, `/agents`) remain.
- **SQLite via `better-sqlite3`**, schema runs on startup, store functions accept an explicit `db` param for testability (in-memory DB in tests).
- **Files stay on NAS.** The DB stores only metadata + paths, never file contents.
- **Auth reuse:** every new route is wrapped in `requireLocalOrAuth`.
- **Chat reuse:** the genomics Report & Review chat uses the existing `/api/send-stream` SSE pipeline with a dedicated `genomics-case-<caseId>` session key.

### New env vars

| Variable | Default | Purpose |
|---|---|---|
| `GENOMICS_DB_PATH` | `~/.hermes/genomics.db` | SQLite DB location |
| `GENOMICS_REPORT_WATCH_PATH` | — | Directory watched for new agent-written `*.md` reports |
| `GENOMICS_NAS_BASE` | — | Base path prefix for NAS file resolution (figure serve) |

---

## 4. Data model (SQLite)

Tables defined in `src/server/genomics/schema.ts`:

- `cases` — patient + diagnosis + `assay_type` (used by GenerateReportModal to filter protocols) + status
- `case_samples` — tumor/normal/germline FASTQ + VCF paths
- `runs` — pipeline (e.g. `wgs-mutect2`), reference, FASTQ/output paths, status, `pbrun_command`
- `run_stages` — stage name, status, started/finished timestamps, `log_tail`
- `case_runs` — many-to-many link
- `protocols` — name, version, assay_type, prompt_template, JSON `skills[]`, JSON `variables[]`, `is_active`
- `reports` — case_id, **`protocol_id` + `protocol_version` snapshot** for auditability, version, status (`draft`|`signed`), JSON sections + figures, `signed_by`, `signed_at`

Domain types live in `src/server/genomics/types.ts`.

---

## 5. What was implemented

The implementation tracks the plans commit-by-commit on branch `feat/genomics-phase1`. Verified on disk:

### Phase 1 — Foundation (server only)

`src/server/genomics/`:

- `db.ts` — `better-sqlite3` singleton, WAL + FK pragmas, auto-mkdir
- `schema.ts` — `runMigrations` creating all tables (idempotent)
- `types.ts` — `Case`, `Run`, `RunStage`, `Protocol`, `ProtocolVariable`, `Report`, `ReportFigure`, plus status unions
- `cases-store.ts` (+ `.test.ts`) — `listCases`, `getCase`, `createCase`, `updateCase`, `listSamples`, `addSample`
- `runs-store.ts` (+ `.test.ts`) — `listRuns`, `getRun`, `createRun`, `updateRun`, `listStages`, `upsertStage`, `linkRunToCase`, `listRunsForCase`
- `protocols-store.ts` (+ `.test.ts`) — CRUD + `renderTemplate({{var}})` + `resolveVariables` (reads `case.*` sources, applies overrides)
- `reports-store.ts` (+ `.test.ts`) — `getLatestReport`, `getReport`, `createReport`, `patchSection` (refuses to modify signed reports), `signReport`, `upsertReportFromFile`
- `report-watcher.ts` (+ `.test.ts`) — `parseMarkdownReport` (splits on `## N.` headings 1–12, extracts `![caption](path)` figures with section attribution) + `startReportWatcher` (Node `fs.watch`)

`src/routes/api/genomics/`:

- `cases.ts`, `cases.$caseId.ts` — list/create, get/update
- `runs.ts`, `runs.$runId.ts`, `runs.$runId.log.ts`, `runs.$runId.link.$caseId.ts` — including **SSE log stream** of `log_tail`
- `protocols.ts`, `protocols.$protocolId.ts`, `protocols.$protocolId.preview.ts` — preview resolves vars from a case + overrides and renders the template
- `cases.$caseId.report.ts` — GET latest report, PUT to patch section OR `action: 'sign'`
- `cases.$caseId.report.generate.ts` — resolves protocol vars, renders prompt, dispatches via `/api/send-stream` with `sessionKey = genomics-case-<caseId>` (fire-and-forget; watcher upserts when the agent writes the markdown)
- `cases.$caseId.report.export-pdf.ts` — Puppeteer renders the 12 sections to a downloadable PDF

`package.json` gained `better-sqlite3` (+ `@types/better-sqlite3`) and pnpm `onlyBuiltDependencies` allowance for `better-sqlite3` + `puppeteer`.

### Phase 2 — Shell & Screens

- `src/styles/genomics/tokens.css` — full CL V3.0 token sheet + utility classes (`cl-page`, `cl-title-bar`, `cl-toolbar`, `cl-tab`, `cl-card`, `cl-status-stripe.*`, `cl-btn-*`, `cl-table`, `cl-badge-*`, `cl-stage-row.*`, `cl-stats-row`)
- `src/stores/genomics-store.ts` — Zustand store (active case/run/report, per-run log lines, `editingSection`, Generate-modal state)
- Sidebar (`src/screens/chat/components/chat-sidebar.tsx`) — new **Clinical** section above Workspace items (Genomics / Cases / Runs / Protocols), data-driven `NavItemDef[]`, persisted collapse state, all icons already imported
- `src/routes/index.tsx` — root redirect to `/genomics`
- `src/routes/genomics.tsx` — layout wrapper that loads `tokens.css` via TanStack Start `head.links`
- Routes & screens:
  - `/genomics` → `dashboard-screen.tsx` (stats row + Recent Cases + Active Runs tables)
  - `/genomics/cases` → `case-list-screen.tsx` (filter input, inline `+ New Case` form, clickable rows)
  - `/genomics/cases/$caseId` → `case-detail-screen.tsx` (header bar, 5 tabs: Overview, Report & Review, Files, Runs, History)
  - `/genomics/runs`, `/genomics/runs/$runId` → list with inline new-run form; detail with stage list (left) + SSE-streamed live log + metrics (right)
  - `/genomics/protocols`, `/genomics/protocols/$protocolId` → list with inline create form; detail with skill chain, prompt template, variable table

A follow-up fix `ab7e7372` un-nested detail routes using TanStack's trailing-underscore convention.

### Phase 3 — Report Canvas

- `src/server/genomics/watcher-init.ts` — side-effect module that starts the watcher once. Imported by `cases.$caseId.report.generate.ts` so it boots on first generate. Filename → case match is **anchored** (rejects partial matches like `other-<caseId>-stuff.md`).
- `src/screens/genomics/components/generate-report-modal.tsx` — 3-step wizard:
  1. **SELECT PROTOCOL** — radio cards filtered by `?assay_type=<case.assay_type>`
  2. **REVIEW VARIABLES** — table of resolved vars; `editable: false` are read-only, `source: "manual"` (or `editable: true`) are inputs; preview is debounced/refetched at step 3 entry rather than on every keystroke
  3. **CONFIRM** — rendered prompt preview, Generate button POSTs to `/report/generate`
- `src/screens/genomics/components/report-canvas.tsx` — section nav pills §1–§12, collapsible Monaco editor (markdown), figures inline (`<img src="/api/genomics/figure?path=...">`), toolbar with **Export PDF** (Puppeteer download) and **Sign & Finalize** (locks the report, hides Edit buttons). Section writes are debounced (~400ms). Editor callback is stabilised to keep typing latency flat.
- `src/screens/genomics/components/report-chat-panel.tsx` — self-contained chat panel using the same `genomics-case-<caseId>` session key as the generate dispatch (so report-writing runs appear in the same conversation). Sends a context primer on mount (patient, diagnosis, EHR summary, report status). Parses named SSE events directly from `/api/send-stream`; `chunk.text` is treated as **full accumulated text** (replace, not append).
- `src/routes/api/genomics/figure.ts` — figure-serve route. **Fail-closed**: returns 503 if neither `GENOMICS_REPORT_WATCH_PATH` nor `GENOMICS_NAS_BASE` are set; 403 on path traversal; uses `Readable.toWeb` to bridge the file stream.
- `src/screens/genomics/case-detail-screen.tsx` — replaces the Phase 2 stub with `<ReportAndReviewTab>`:
  - **No report** → empty state with hex glyph, "No report generated yet", Generate Report button
  - **Report exists** → split layout: canvas on the left, chat panel on the right (380px column), plus a Regenerate button while status=`draft`
  - Generate-modal state is cleared when the tab is left (fix `cb37c3c8`); editor state cleared on case switch (fix `254b343f`)

---

## 6. End-to-end flow (the requirement, now wired)

1. User picks a Protocol in the Generate Modal → variables resolve from the Case row (+ user overrides) → template rendered.
2. `POST /api/genomics/cases/$caseId/report/generate` → server fans out to `/api/send-stream` with `sessionKey = genomics-case-$caseId` → Hermes agent executes the Protocol's skills.
3. Agent writes a 12-section markdown report (and figures) to `GENOMICS_REPORT_WATCH_PATH`.
4. `report-watcher` notices the new `*.md`, parses sections + figures, calls `upsertReportFromFile` (still `draft`).
5. Report & Review tab's React Query observer re-fetches → split canvas + chat panel render.
6. Clinician edits sections inline (Monaco, debounced PUT) and/or asks the chat panel — chat shares the same session, so subsequent agent edits stream into the same conversation.
7. **Export PDF** → Puppeteer renders the 12 sections + RESEARCH-USE-ONLY disclaimer.
8. **Sign & Finalize** → status flips to `signed`, `signed_by` + `signed_at` recorded, all Edit buttons disappear, `patchSection` becomes a no-op server-side.

---

## 7. Verification

Phase 3 ships with a manual smoke-test checklist (`docs/superpowers/checklists/2026-05-24-genomics-phase3-smoke-test.md`) covering 10 sections:

0. Watcher boot log present
1. Seed Protocol + Case via curl
2. Empty-state Report & Review renders
3. 3-step modal: protocol filter, variable resolution, debounced preview, dispatch
4. Watcher ingestion + anchored filename match
5. Canvas: section pills, Monaco edit, debounced PUT, editor isolation across tabs/cases
6. PDF export across browsers
7. Sign & Finalize lock + persistence
8. AI chat: primer hidden, streaming chunks accumulate, Shift+Enter, error path
9. State isolation + figure-route security (503 unconfigured / 403 traversal) + watcher fault tolerance on non-markdown files
10. Acceptance / sign-off

Plus the automated bar from Phase 1: `pnpm test`, `pnpm lint`, `npx tsc --noEmit` all clean.

---

## 8. Out of scope (deliberate)

- Protocol versioning UI (diff history table) — schema supports it, UI shows latest only.
- Multi-user auth / RBAC — Phase 4 (see auto-memory `deployment-model.md`).
- Live `pbrun` orchestration — Run model stores commands + stage status, but actual job dispatch is not part of this work.
- LaTeX-graphics PDF pipeline — the existing agent-side LaTeX path remains; the new Puppeteer export covers standard reports.
