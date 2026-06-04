# Run Integration Plan

## Decisions

| # | Decision |
|---|---|
| 1 | Launch: `child_process.spawn` of shell script (Phase 1) → Nextflow (Phase 2) |
| 2 | Run config: JSON blob (`run_config TEXT`) |
| 3 | Phase 1: `batch-somatic-tumor` only; Phase 2: all 3 pipelines via Nextflow |
| 4 | Serial execution only |
| 5 | Case required at run creation |
| 6 | Logs written to file; path stored in `run_stages.log_file_path` |
| 7 | GPU-to-run correlation: out of scope (Phase 2+) |

---

## Phase 1 — Shell + Webhook Integration

Target pipeline: **batch-somatic-tumor** (pillar panel, N samples tumor-only, serial loop).
Reference script: `docs/ref-sh/01-pbrun-somatic-5tngs.sh`.

### Step 1 — Schema migration

File: `src/server/genomics/schema.ts`

Add an `ALTER TABLE` migration block after the `CREATE TABLE IF NOT EXISTS` block.
SQLite requires one `ALTER TABLE … ADD COLUMN` per statement.

New columns on `runs`:
```sql
ALTER TABLE runs ADD COLUMN run_config TEXT;       -- JSON blob (mode-specific inputs)
ALTER TABLE runs ADD COLUMN output_dir TEXT;       -- NAS output directory
ALTER TABLE runs ADD COLUMN log_dir TEXT;          -- host path where log files are written
ALTER TABLE runs ADD COLUMN num_gpus INTEGER NOT NULL DEFAULT 1;
ALTER TABLE runs ADD COLUMN case_id TEXT REFERENCES cases(id);  -- required at creation
```

New column on `run_stages`:
```sql
ALTER TABLE run_stages ADD COLUMN log_file_path TEXT;  -- absolute path to per-stage log file
```

Existing columns (`fastq_path`, `output_path`, `pbrun_command`) are kept as-is for backwards
compatibility. `pbrun_command` gets repurposed: server writes the *generated* command there for
audit, not user input.

Migration guard: wrap each `ALTER TABLE` in a try/catch (SQLite throws if column already exists).

```ts
function addColumnIfMissing(db, table, column, definition) {
  try { db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`) } catch {}
}
```

---

### Step 2 — Update types

File: `src/server/genomics/types.ts`

Add to `Run` interface:
```ts
run_config: string | null    // JSON — see RunConfig below
output_dir: string | null
log_dir: string | null
num_gpus: number
case_id: string | null
```

Add to `RunStage` interface:
```ts
log_file_path: string | null
```

Add new exported types:
```ts
export type PipelineMode = 'batch-somatic-tumor' | 'batch-germline' | 'paired-somatic'

export interface BatchSomaticTumorConfig {
  mode: 'batch-somatic-tumor'
  input_dir: string        // NAS base dir; script globs R1/R2 per sample
  samples: string[]        // e.g. ['SIP0001', 'SIP0002']
  num_gpus_per_sample: number
}

// Phase 2 additions (defined now for forward reference):
export interface BatchGermlineConfig {
  mode: 'batch-germline'
  input_dir: string
  samples: string[]
  num_gpus_per_sample: number
}

export interface PairedSomaticConfig {
  mode: 'paired-somatic'
  normal: { sample_id: string; r1: string; r2: string }
  tumor:  { sample_id: string; r1: string; r2: string }
}

export type RunConfig = BatchSomaticTumorConfig | BatchGermlineConfig | PairedSomaticConfig
```

---

### Step 3 — Update runs-store

File: `src/server/genomics/runs-store.ts`

- Add `run_config`, `output_dir`, `log_dir`, `num_gpus`, `case_id` to `CreateRunInput`
- Add them to the `INSERT` statement in `createRun`
- Add them to `UPDATABLE_RUN_FIELDS`
- Add `log_file_path` to `UPDATABLE_STAGE_FIELDS` and `upsertStage`
- Add helper: `getRunConfig(run: Run): RunConfig | null` — parses `run.run_config` JSON

---

### Step 4 — Shell script generator

New file: `src/server/genomics/shell-generator.ts`

Accepts a `Run` (with `run_config`) and a `runId`, returns a bash script string.

```ts
export function generateBatchSomaticTumorScript(run: Run, ingestUrl: string): string
```

The generated script mirrors `01-pbrun-somatic-5tngs.sh` with additions:
- `RUN_ID` and `INGEST_URL` env vars baked in
- `curl -sf -X POST $INGEST_URL` calls at each stage boundary:
  - Before Docker run: `{"event":"stage_start","stage":"$SAMPLE"}`
  - After success: `{"event":"stage_complete","stage":"$SAMPLE","exit_code":0}`
  - On failure (trap ERR): `{"event":"stage_failed","stage":"$SAMPLE","exit_code":$?}`
  - After final sample: `{"event":"run_complete"}`
- `set -euo pipefail` with an `ERR` trap that fires the `stage_failed` + `run_failed` callbacks
- `2>&1 | tee "$LOG_DIR/$SAMPLE.log"` on each Docker run (writes log to file)
- Use `HERMES_API_TOKEN` from environment for ingest auth header

Script is written to a temp file in `log_dir` (`script.sh`), made executable, then spawned.

---

### Step 5 — Start endpoint

New file: `src/routes/api/genomics/runs.$runId.start.ts`

`POST /api/genomics/runs/$runId/start`

Server handler:
1. Auth check
2. `getRun(runId)` — 404 if not found
3. Check `run.status === 'queued'` — 409 if already running/complete
4. Parse `run.run_config` — 400 if missing or invalid
5. Create per-sample stages via `upsertStage` (status `pending`) from `config.samples`
6. `updateRun(runId, { status: 'running' })`
7. Ensure `run.log_dir` exists (`fs.mkdirSync(logDir, { recursive: true })`)
8. Generate script: `generateBatchSomaticTumorScript(run, ingestUrl)`
9. Write script to `${logDir}/script.sh`, `chmod +x`
10. `child_process.spawn('bash', [scriptPath], { detached: true, stdio: 'ignore' })` + `.unref()`
    — detached so the process outlives the HTTP response; stdio ignored (logs go to tee files)
11. Return `{ run, stages }`

`ingestUrl` = `http://127.0.0.1:${PORT}/api/genomics/runs/${runId}/ingest`
(loopback — script runs on same host)

---

### Step 6 — Ingest endpoint (webhook)

New file: `src/routes/api/genomics/runs.$runId.ingest.ts`

`POST /api/genomics/runs/$runId/ingest`

Auth: check `Authorization: Bearer $HERMES_API_TOKEN` header.

Payload shape:
```ts
type IngestEvent =
  | { event: 'stage_start';    stage: string }
  | { event: 'stage_complete'; stage: string; exit_code: number }
  | { event: 'stage_failed';   stage: string; exit_code: number }
  | { event: 'run_complete' }
  | { event: 'run_failed' }
```

Handler logic per event:
- `stage_start` → `upsertStage(runId, stage, { status: 'running', started_at: Date.now(), log_file_path })`
  where `log_file_path = path.join(run.log_dir, stage + '.log')`
- `stage_complete` → `upsertStage(runId, stage, { status: 'completed', finished_at: Date.now() })`
- `stage_failed` → `upsertStage(runId, stage, { status: 'failed', finished_at: Date.now() })`
                  + `updateRun(runId, { status: 'failed' })`
- `run_complete` → `updateRun(runId, { status: 'completed' })`
- `run_failed`   → `updateRun(runId, { status: 'failed' })`

Returns `{ ok: true }`.

---

### Step 7 — Log streaming update

File: `src/routes/api/genomics/runs.$runId.log.ts`

Current implementation polls `run_stages.log_tail` (DB). Change to read from
`run_stages.log_file_path` (file) when available, fall back to `log_tail` otherwise.

SSE stream logic per stage:
- Track byte offset per stage (`cursors[stageId] = 0`)
- Every 2s: `fs.stat(log_file_path)` to check size; if grown, `fs.createReadStream` from offset
- Send new lines as SSE events
- On stage `completed`/`failed`: do one final read, then stop polling that stage

This keeps the existing SSE contract intact — `RunDetailScreen` subscribes and appends lines to
Zustand `runLogs[runId]`. No UI change needed for the log panel.

---

### Step 8 — API route: create run (update)

File: `src/routes/api/genomics/runs.ts`

POST handler: accept `case_id`, `run_config`, `output_dir`, `log_dir`, `num_gpus` in body.
Validate `case_id` is present and case exists (404 if not).
Auto-insert `case_runs` row after creating run (so run is always linked to its case at creation).

---

### Step 9 — Form update

File: `src/screens/genomics/run-list-screen.tsx`

Replace the 6 flat text inputs with a structured form:

```
Run Name          [text]
Pipeline          [select: "Somatic Tumor-Only (Panel)"]   ← single option Phase 1
Case              [select: fetched from /api/genomics/cases, required]
Reference         [select: "GRCh38 (hg38)" | "hg19"]      ← maps to known NAS paths
Input Dir (NAS)   [text]                                   ← base dir for sample glob
Sample IDs        [text, comma-separated]                  ← "SIP0001, SIP0002, ..."
Output Dir (NAS)  [text]
GPUs / sample     [number, default 1]
Log Dir           [text, default auto-filled from output dir]
```

On submit: POST `/api/genomics/runs` with:
```json
{
  "name": "...",
  "pipeline": "batch-somatic-tumor",
  "reference": "GRCh38",
  "case_id": "...",
  "output_dir": "...",
  "log_dir": "...",
  "num_gpus": 1,
  "run_config": {
    "mode": "batch-somatic-tumor",
    "input_dir": "...",
    "samples": ["SIP0001", "SIP0002"],
    "num_gpus_per_sample": 1
  },
  "status": "queued"
}
```

After successful create: navigate directly to run detail page (`/genomics/runs/$runId`).

---

### Step 10 — Run detail UI update

File: `src/screens/genomics/run-detail-screen.tsx`

**Add "Start Run" button** — shown only when `run.status === 'queued'`.
On click: `POST /api/genomics/runs/$runId/start`. On success: invalidate run query.

**Stage list** — already renders per-stage. No structural change needed; stage names will now be
sample IDs (e.g. `SIP0001`) rather than pipeline step names. Labels render as-is.

**Status badge** — already uses `run.status`. No change.

**Log panel** — already subscribes to SSE endpoint. No change needed once Step 7 (file-based
log streaming) is in place.

---

## Phase 1 file index

| File | Action |
|---|---|
| `src/server/genomics/schema.ts` | Add `addColumnIfMissing` migration for new columns |
| `src/server/genomics/types.ts` | Add `RunConfig` types; extend `Run` and `RunStage` interfaces |
| `src/server/genomics/runs-store.ts` | Add new fields to CRUD; add `getRunConfig` helper |
| `src/server/genomics/shell-generator.ts` | **New** — generates parameterized bash script |
| `src/routes/api/genomics/runs.ts` | Accept `case_id` + `run_config`; auto-link to case |
| `src/routes/api/genomics/runs.$runId.start.ts` | **New** — spawns the shell script |
| `src/routes/api/genomics/runs.$runId.ingest.ts` | **New** — webhook receiver |
| `src/routes/api/genomics/runs.$runId.log.ts` | Change log source from DB to file |
| `src/screens/genomics/run-list-screen.tsx` | Structured form; navigate to detail on create |
| `src/screens/genomics/run-detail-screen.tsx` | Add "Start Run" button |

---

## Phase 2 — Nextflow

### What changes from Phase 1

| Area | Phase 1 | Phase 2 |
|---|---|---|
| Launch | `spawn('bash', [scriptPath])` | `spawn('nextflow', ['run', 'pipelines/X.nf', '-with-weblog', ingestUrl, ...params])` |
| Script generation | `shell-generator.ts` | Removed — replaced by `.nf` files |
| Webhook callbacks | Manually added `curl` in generated script | Native `-with-weblog` flag |
| Pipeline options | `batch-somatic-tumor` only | All 3: + `batch-germline`, `paired-somatic` |
| Form | Single pipeline option | Full dropdown with conditional field sets |
| Stage names | Sample IDs | Nextflow process names (e.g. `PARABRICKS_SOMATIC`) |
| Resume | Not supported | `-resume` flag → "Resume" button in detail UI |

### New files in Phase 2

```
pipelines/
  batch-somatic-tumor.nf    # wraps pbrun somatic loop; uses nf-core/parabricks PARABRICKS_SOMATIC
  batch-germline.nf         # wraps pbrun germline loop; PARABRICKS_GERMLINE
  paired-somatic.nf         # fq2bam_normal → fq2bam_tumor → deepsomatic; 3 PARABRICKS modules
  nextflow.config           # Docker profile, GPU resource labels, process cpus/memory
```

### Ingest endpoint in Phase 2

Nextflow weblog payload format differs from the Phase 1 shell callbacks.
Update `runs.$runId.ingest.ts` to handle both schemas (detect by presence of `runName` field
in Nextflow payload vs `event` field in Phase 1 payload). Or add a separate
`/api/genomics/runs/$runId/nf-ingest` endpoint.

### What carries forward unchanged

- DB schema (no new migrations needed)
- `runs-store.ts` CRUD
- SSE log endpoint (file-based, same contract)
- Run detail UI (stage list, log panel, status badges)
- Case-required-at-creation constraint
