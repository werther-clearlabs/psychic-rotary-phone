# Genomics Case & Run Management — Design Spec

**Date:** 2026-05-23
**Status:** Approved for implementation

---

## Context

Hermes Workspace is a generic AI chat frontend connected to a Hermes Agent backend running on a local Parabricks GPU server. The agent has specialized skills for controlling Parabricks pipelines (`pbrun`), VCF interpretation, variant annotation (OncoKB/CIViC), and generating structured 12-section Molecular Pathology & Precision Oncology reports (as markdown + figures, optionally compiled to PDF via LaTeX).

The goal is to extend hermes-workspace with two new domain entities:

- **Case** — patient umbrella entity holding sample paths, EHR info, linked Runs, and clinical reports
- **Run** — secondary analysis job entity tracking Parabricks pipeline execution stage by stage

Two user groups: **bioinformatics team** (technical, pipeline operators) and **clinical users** (oncologists, genetic counselors reviewing and signing reports).

---

## Architecture

### Approach

Extend hermes-workspace in-place. Add a new `/genomics` route group with its own screens alongside the existing chat/swarm/dashboard routes. The existing gateway, auth, SSE streaming, and agent chat are reused as-is.

### Route Structure (new)

```
/                          → redirect to /genomics
/genomics                  → Genomics Dashboard (new landing page)
/genomics/cases            → Case list
/genomics/cases/$caseId    → Case detail (tabbed)
/genomics/runs             → Run list
/genomics/runs/$runId      → Run detail
```

Existing routes (`/chat`, `/dashboard`, `/terminal`, `/agents`, etc.) remain unchanged and accessible from the sidebar Workspace section.

### Storage

**SQLite database** (`~/.hermes/genomics.db` or configurable via `GENOMICS_DB_PATH` env var) managed server-side via `better-sqlite3`. Chosen for zero-infrastructure PoC simplicity.

**Files stay on NAS.** The DB stores only metadata and paths, never file contents.

Schema (key tables):

```sql
cases (
  id TEXT PRIMARY KEY,          -- UUID
  patient_id TEXT,
  patient_name TEXT,
  dob TEXT,
  diagnosis TEXT,
  stage TEXT,
  status TEXT,                  -- 'active' | 'closed' | 'pending'
  ehr_summary TEXT,             -- free-text or JSON
  created_at INTEGER,
  updated_at INTEGER
)

runs (
  id TEXT PRIMARY KEY,          -- UUID
  name TEXT,
  pipeline TEXT,                -- e.g. 'wgs-mutect2', 'rnaseq'
  reference TEXT,               -- e.g. 'GRCh38'
  fastq_path TEXT,              -- NAS path
  output_path TEXT,             -- NAS path for VCF/outputs
  status TEXT,                  -- 'queued'|'running'|'completed'|'failed'
  pbrun_command TEXT,
  created_at INTEGER,
  updated_at INTEGER
)

case_runs (                     -- many-to-many link
  case_id TEXT REFERENCES cases(id),
  run_id TEXT REFERENCES runs(id),
  PRIMARY KEY (case_id, run_id)
)

case_samples (
  id TEXT PRIMARY KEY,
  case_id TEXT REFERENCES cases(id),
  sample_id TEXT,
  sample_type TEXT,             -- 'tumor' | 'normal' | 'germline'
  fastq_path TEXT,
  vcf_path TEXT,
  added_at INTEGER
)

reports (
  id TEXT PRIMARY KEY,
  case_id TEXT REFERENCES cases(id),
  version INTEGER DEFAULT 1,
  status TEXT,                  -- 'draft' | 'signed'
  sections TEXT,                -- JSON: { "1": "...", "2": "...", ... }
  figures TEXT,                 -- JSON: [{ section, path, caption }]
  source_path TEXT,             -- original markdown file path on NAS
  signed_by TEXT,
  signed_at INTEGER,
  created_at INTEGER,
  updated_at INTEGER
)

run_stages (
  id TEXT PRIMARY KEY,
  run_id TEXT REFERENCES runs(id),
  name TEXT,                    -- 'FASTQ QC' | 'BWA-MEM Align' | etc.
  status TEXT,                  -- 'pending'|'running'|'completed'|'failed'
  started_at INTEGER,
  finished_at INTEGER,
  log_tail TEXT                 -- last N lines of pbrun output
)
```

### New Server Files

All new server-side code lives under `src/server/genomics/`:

- `db.ts` — SQLite connection singleton (`better-sqlite3`, needs `pnpm add better-sqlite3`)
- `cases-store.ts` — CRUD for cases and samples
- `runs-store.ts` — CRUD for runs and stages
- `reports-store.ts` — Report read/write, section patching
- `report-watcher.ts` — Node.js `fs.watch` on configured report output directory; parses new markdown reports, extracts 12 sections by heading, upserts into `reports` table

### New API Routes

Under `src/routes/api/genomics/`:

```
GET/POST   /api/genomics/cases
GET/PUT    /api/genomics/cases/$caseId
GET        /api/genomics/cases/$caseId/report        — latest report
PUT        /api/genomics/cases/$caseId/report/section — patch one section
POST       /api/genomics/cases/$caseId/report/sign
GET/POST   /api/genomics/runs
GET/PUT    /api/genomics/runs/$runId
GET        /api/genomics/runs/$runId/log             — SSE stream of live pbrun log
POST       /api/genomics/runs/$runId/link/$caseId
```

---

## Navigation & App Shell

### Sidebar change (`src/components/sidebar` or equivalent)

Add a **Clinical** section above the existing Workspace section:

```
CLINICAL
  ⬡ Dashboard      /genomics
  ⬡ Cases          /genomics/cases
  ⬡ Runs           /genomics/runs

WORKSPACE
  ⬡ Chat
  ⬡ Terminal
  ⬡ Agents
  ...
```

The root `/` redirects to `/genomics`. Existing workspace routes are unchanged.

---

## Screens

### 1. Genomics Dashboard (`/genomics`)

Stats row: open Cases, active Runs, reports pending sign-off, recent variants flagged.

Two columns below:
- **Recent Cases** — last 5 cases with status badge and top variant
- **Active Runs** — running/queued Runs with pipeline stage progress bar

### 2. Case List (`/genomics/cases`)

Filterable table: Patient ID, Name, Diagnosis, Status, Last Run, Report Status. Click row → Case detail.

### 3. Case Detail (`/genomics/cases/$caseId`) — Tabbed

**Header bar (persistent):** Case ID · Patient name · Diagnosis · Status badge

**Tabs:**

- **Overview** — 3-column card grid: Patient info, Samples (fastQ/VCF paths), Linked Runs, EHR Summary. Edit button per card.
- **Report & Review** — Half-and-half: Report canvas left, AI chat right (detail below)
- **Files** — List of fastQ and VCF files with NAS paths, sizes, checksums
- **Runs** — Table of linked Runs with status; "Link existing Run" and "New Run" actions
- **History** — Audit log of report versions, edits, sign-offs

### 4. Report & Review Tab

**Left — Report Canvas:**
- Section nav pills: §1 Header through §12 Disclaimers
- Each section renders as a collapsible block with an inline edit button
- Active edit: section opens in a Monaco Editor instance (markdown mode — `@monaco-editor/react` already in deps)
- Figures (PNG/SVG from agent) embedded inline at the correct section
- Toolbar: `Export PDF` (Puppeteer) · `Sign & Finalize` (locks all sections, records `signed_by` + timestamp)

**Right — AI Chat:**
- Existing Hermes chat interface reused, session pre-loaded with Case context: patient info, VCF findings, linked run outputs
- Chat messages can reference report sections ("update §8", "add a trial for BRAF V600E")
- Agent edits received as structured responses → diff applied to target section → canvas re-renders
- Freeform chat also available for clinical questions not tied to the report

**Technical flow:**
```
Agent skill writes markdown report → NAS path
    ↓
report-watcher.ts detects file → parses 12 sections by ## heading → upserts reports table
    ↓
Report & Review tab loads sections from /api/genomics/cases/$id/report
    ↓
Clinician edits inline or asks AI via chat panel
    ↓
AI chat → Hermes gateway → agent skill → structured edit response
    ↓
PATCH /api/genomics/cases/$id/report/section → updates sections JSON in DB
    ↓
Canvas section re-renders
    ↓
Sign & Finalize → status = 'signed', locked
    ↓
Export PDF → Puppeteer renders canvas HTML → downloads PDF
```

### 5. Run List (`/genomics/runs`)

Table: Run ID, Pipeline, Reference, Status, Created, Linked Case. Filter by status.

### 6. Run Detail (`/genomics/runs/$runId`)

**Header:** Run ID · Pipeline · Reference · Status badge

**Two-column layout:**

- **Left — Pipeline stages** (vertical list):
  - Each stage: status icon (✓ done / ⟳ running / ○ pending / ✗ failed), name, elapsed time
  - Stages defined per pipeline type (WGS: FASTQ QC → BWA-MEM Align → HaplotypeCaller → VCF Annotation → QC Report)
  - Clicking a stage scrolls the log to that stage's output

- **Right — Live log + metrics:**
  - SSE-streamed pbrun log (`/api/genomics/runs/$runId/log`), auto-scrolling, monospace
  - QC metrics panel below log: Coverage, GPU utilization, elapsed time
  - "Link to Case" action when Run completes

---

## State Management

New Zustand store: `src/stores/genomics-store.ts`

Holds: active Case, active Run, streaming log lines, report section edit state.

Existing `chat-store` reused for the chat panel in Report & Review — no changes needed.

---

## Report Parsing

The agent writes markdown with `## N. Section Title` headings. `report-watcher.ts` splits on these headings to extract sections 1–12 into a JSON map. Figures are referenced in the markdown as `![caption](path)` and extracted into the `figures` array with their absolute NAS paths.

---

## PDF Export

`Export PDF` button calls `POST /api/genomics/cases/$caseId/report/export-pdf`. Server-side handler uses Puppeteer (already in `package.json`) to render the report canvas HTML with all sections expanded and figures embedded, then streams the PDF back as a download. No LaTeX required for standard exports; the existing LaTeX pipeline remains available for agent-side generation of graphics-heavy reports.

---

## Environment Variables (new)

| Variable | Default | Purpose |
|---|---|---|
| `GENOMICS_DB_PATH` | `~/.hermes/genomics.db` | SQLite DB location |
| `GENOMICS_REPORT_WATCH_PATH` | — | Directory to watch for new agent-written markdown reports |
| `GENOMICS_NAS_BASE` | — | Base path for NAS file resolution in the UI |

---

## Verification

1. Start dev server (`pnpm dev`), navigate to `/` — should redirect to `/genomics` dashboard
2. Create a Case, add patient info, verify it persists in SQLite
3. Create a Run, verify stage list renders and status updates
4. Place a markdown report file in `GENOMICS_REPORT_WATCH_PATH` — verify it appears in the Case Report & Review tab with all 12 sections parsed
5. Edit a section inline — verify the change saves and persists on reload
6. Send a chat message in the Report & Review panel — verify Hermes agent responds with Case context
7. Click "Export PDF" — verify Puppeteer generates a valid PDF with all sections and figures
8. Click "Sign & Finalize" — verify sections lock and the History tab records the sign-off
9. Run `pnpm test` — all existing tests pass
10. Run `pnpm lint` and `npx tsc --noEmit` — no errors
