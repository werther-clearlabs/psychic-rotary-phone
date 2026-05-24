# Genomics Case & Run Management — Design Spec

**Date:** 2026-05-23
**Status:** Approved for implementation

---

## Context

Hermes Workspace is a generic AI chat frontend connected to a Hermes Agent backend running on a local Parabricks GPU server. The agent has 100+ loaded skills (e.g. from ClawBio) covering VCF interpretation, OncoKB/CIViC lookup, clinical trial matching, and structured 12-section Molecular Pathology & Precision Oncology report generation. Through experimentation, the team has identified which skill combinations produce reliable reports for each assay type.

The goal is to extend hermes-workspace with four new domain entities:

- **Case** — patient umbrella entity holding sample paths, EHR info, linked Runs, and clinical reports
- **Run** — secondary analysis job entity tracking Parabricks pipeline execution stage by stage
- **Protocol** — versioned, assay-specific recipe that captures the known-working AI skill sequence and prompt template for reproducible report generation. Analogous to the liquid-handling Protocols in the existing Clear Labs product — same concept, different domain.

Two user groups: **bioinformatics team** (technical, pipeline operators) and **clinical users** (oncologists, genetic counselors reviewing and signing reports).

---

## Design System

The genomics portal uses the **Clear Labs Design System V3.0** (light theme). This is visually distinct from the existing hermes-workspace dark UI — the genomics screens are a light-theme portal layered on top of the same application shell.

### Setup

1. Add `DESIGN.MD` and `colors_and_type.css` to `src/styles/genomics/` (source of truth for all tokens)
2. Import `colors_and_type.css` only in genomics route layouts — not globally — so existing dark workspace screens are unaffected
3. Page background: `--gray-100` (`oklch(0.985 0.002 247.839)`) — near-white
4. Card surfaces: `--white`, `border: 1px solid var(--gray-200)`, `border-radius: var(--cl-radius-md)` (5px)

### Key tokens used throughout

| Role | Token | Value |
|---|---|---|
| Brand primary | `--brand-500` | `oklch(0.559 0.122 237)` — blue |
| Brand hover / links | `--brand-600` | `oklch(0.476 0.103 236.1)` |
| Primary text | `--gray-900` | `oklch(0.308 0.02 260.6)` |
| Secondary text | `--gray-700` | `oklch(0.551 0.035 263.4)` |
| Sidebar background | `--gray-900` | same dark gray |
| Sidebar active | `--gray-950` | `oklch(0.28 0.0062 258.36)` |
| Success | `--color-green-500` / `--color-green-100` | status stripes, complete states |
| Warning | `--color-yellow-500` / `--color-yellow-100` | |
| Error | `--color-red-500` / `--color-red-100` | |

### Typography

- Font: `'Helvetica Neue', Helvetica, Arial, sans-serif` (font files in `/fonts/`)
- UI uses Regular (400) and Bold (700) only
- Section labels, table headers, status chips: **H6/MICRO — 11px Bold UPPERCASE, 0.44px letter-spacing**
- Page titles: H2 Regular, 18px, Title Case
- Card body text: Paragraph — 14px Regular, 22px line height
- Condensed variant (`Helvetica Condensed`) for pipeline stage chips and compact chrome

### Component patterns from CL Design System

**Sidebar** (adapted — wider than the 60px icon-only CL sidebar to accommodate text labels per the approved nav mockup):
- Background: `--gray-900`; active item: `--gray-950`
- Section dividers: `--gray-800`
- Active item left stripe: 3px, `--brand-500`

**Title bar** — 56px, `--white` background, H2 Bold left-aligned at 24px padding, `1px solid --gray-200` bottom edge, right-aligned action buttons

**Toolbar / tabs** — 48px, tab labels MICRO Bold UPPERCASE, active tab `--brand-500` bottom underline

**Run / Status cards** — 4px left status stripe: `--color-green-500` (complete), `--color-red-500` (failed), `--gray-400` (pending/queued), `--brand-500` (running)

**Pipeline stage chevrons** — Complete: `--color-green-100` fill / `--color-green-600` border; In Progress: `--brand-100` / `--brand-500`; Pending: `--gray-300` / `--gray-400`

**Buttons** — `border-radius: 3px`; Primary: `--brand-500` bg / white text; Secondary: transparent / `--brand-500` border; importance hierarchy left (low) → right (high)

**Data tables** — Header: 40px, MICRO Bold UPPERCASE `--gray-700`; rows: 48px, H5 Regular `--gray-900`; hover: `--gray-200`

**Motion** — `cubic-bezier(0.4, 0, 0.2, 1)`, 120ms fast / 180ms default / 240ms slow

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

protocols (
  id TEXT PRIMARY KEY,
  name TEXT,                    -- e.g. "WGS Oncology Report"
  version TEXT,                 -- e.g. "2.1" — bumped when prompt/skills change
  assay_type TEXT,              -- e.g. "WGS" | "targeted-panel" | "RNA-seq"
  description TEXT,
  prompt_template TEXT,         -- template with {{variable}} slots
  skills TEXT,                  -- JSON array: skill names in invocation order (documentation + UI display)
  variables TEXT,               -- JSON: [{ name, source, label, editable }]
                                --   source: "case.vcf_path" | "case.diagnosis" | "manual"
  is_active INTEGER DEFAULT 1,  -- soft delete / retire old versions
  created_at INTEGER,
  updated_at INTEGER
)

reports (
  id TEXT PRIMARY KEY,
  case_id TEXT REFERENCES cases(id),
  protocol_id TEXT REFERENCES protocols(id),   -- which Protocol generated this
  protocol_version TEXT,                        -- snapshot of version at generation time
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
- `protocols-store.ts` — Protocol CRUD and template rendering (variable substitution)
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

GET/POST   /api/genomics/protocols
GET/PUT    /api/genomics/protocols/$protocolId
POST       /api/genomics/protocols/$protocolId/preview  — render template with sample vars
POST       /api/genomics/cases/$caseId/report/generate  — resolve Protocol vars from Case, dispatch to Hermes
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
  ⬡ Protocols      /genomics/protocols

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

**When no report exists yet — Generate Report flow:**

The tab shows an empty state with a "Generate Report" button. Clicking it opens a modal:
1. **Protocol selector** — dropdown filtered by assay type matching the Case (e.g. Case is WGS → only WGS protocols shown). Shows name, version, skill count.
2. **Variable review** — table of variables auto-resolved from the Case (VCF path, sample ID, diagnosis, output path). Editable fields for any `"source": "manual"` variables or overrides.
3. **Confirm** — renders the prompt template with resolved variables, sends to Hermes gateway via the existing SSE chat pipeline. Report generation progress shown inline (skill events stream in, same `tool.*` event display as the existing chat).
4. On completion, `report-watcher.ts` detects the written markdown file → canvas populates.

The generated report record stores `protocol_id` + `protocol_version` for full auditability. The History tab shows "Generated with: WGS Oncology Report v2.1 on 2026-05-23."

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
User clicks "Generate Report" → selects Protocol → reviews variables
    ↓
POST /api/genomics/cases/$caseId/report/generate
    → protocols-store resolves template: substitutes {{variables}} from Case record
    → assembled prompt dispatched to Hermes gateway (same SSE path as chat)
    → agent executes skills in Protocol sequence
    → agent writes markdown report + figures → NAS output_path
    ↓
report-watcher.ts detects file → parses 12 sections by ## heading → upserts reports table
    → report record stores protocol_id + protocol_version
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

### 5. Protocol Library (`/genomics/protocols`)

Table: Name, Version, Assay Type, Skills (count), Active/Retired, Last Used. "New Protocol" action.

Each row expands or links to a Protocol detail view showing:
- **Metadata**: name, version, assay type, description
- **Skill sequence**: ordered list of skill names (e.g. `vcf-interpretation → oncokb-lookup → civic-lookup → trial-matcher → report-writer-12section`)
- **Prompt template**: the full template text with `{{variable}}` slots highlighted
- **Variables table**: name, label, auto-source (e.g. `case.vcf_path`), editable override flag
- **Version history**: list of prior versions with diff summary

Protocol editing is technical-team only. Clinical users see Protocols as read-only choices.

### 6. Run List (`/genomics/runs`)

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
