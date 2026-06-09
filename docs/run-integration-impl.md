# Run Integration — Implementation Summary

Branch: `feature/run-creation-monitoring`

## What Was Built

Phase 1 of the parabricks pipeline integration. A user can now create a genomics run in the
workspace UI, click **Start Run**, and watch live per-sample stage progress and log output
as a real parabricks job executes on the GPU server.

---

## Architecture

```
UI (browser)
  │
  │  POST /api/genomics/runs           create run record (queued)
  │  POST /api/genomics/runs/:id/start spawn shell script, stages created
  │  GET  /api/genomics/runs/:id       poll run + stages (3s)
  │  GET  /api/genomics/runs/:id/log   SSE — reads log files by byte offset
  │
Workspace server (Node.js, same host as GPU)
  │
  │  child_process.spawn('bash', [scriptPath], {detached: true})
  │
Shell script (generated, written to log_dir/script.sh)
  │
  │  docker run ... pbrun somatic   ← one per sample, serial
  │  2>&1 | tee $LOGDIR/$SAMPLE.log
  │
  │  POST /api/genomics/runs/:id/ingest   stage_start
  │  POST /api/genomics/runs/:id/ingest   stage_complete | stage_failed
  │  POST /api/genomics/runs/:id/ingest   run_complete | run_failed
  │
Parabricks (Docker, GPU)
```

---

## Data Model Changes

### `runs` table — new columns

| Column | Type | Purpose |
|---|---|---|
| `run_config` | TEXT (JSON) | Structured pipeline inputs (mode, samples, paths) |
| `output_dir` | TEXT | NAS output directory |
| `log_dir` | TEXT | Host directory for log files and generated script |
| `num_gpus` | INTEGER DEFAULT 1 | Total GPUs allocated to the run |
| `case_id` | TEXT FK→cases | Required at creation; auto-inserts `case_runs` row |

### `run_stages` table — new column

| Column | Type | Purpose |
|---|---|---|
| `log_file_path` | TEXT | Absolute path to per-stage `.log` file on disk |

### `RunConfig` types (`src/server/genomics/types.ts`)

```ts
type RunConfig =
  | { mode: 'batch-somatic-tumor'; input_dir: string; samples: string[]; num_gpus_per_sample: number }
  | { mode: 'batch-germline';      input_dir: string; samples: string[]; num_gpus_per_sample: number }
  | { mode: 'paired-somatic';      normal: {sample_id, r1, r2}; tumor: {sample_id, r1, r2} }
```

`batch-germline` and `paired-somatic` are defined but not yet shell-generatable (Phase 2).

---

## API Endpoints

### Existing endpoints — updated

| Endpoint | Change |
|---|---|
| `POST /api/genomics/runs` | Now requires `case_id`; validates case exists; auto-links run to case via `case_runs` |
| `GET /api/genomics/runs/:id/log` | SSE now reads from `log_file_path` (byte-offset streaming); falls back to `log_tail` DB field |

### New endpoints

#### `POST /api/genomics/runs/:runId/start`

Spawns the parabricks shell script for a queued run.

**Flow:**
1. Auth check; verify run exists and `status === 'queued'`
2. Parse `run_config` — 400 if missing
3. Create `pending` stage rows for each sample (sets `log_file_path`)
4. `mkdirSync(log_dir)`
5. `generateShellScript(run, ingestUrl, apiToken)` → write to `log_dir/script.sh`, chmod 755
6. `child_process.spawn('bash', [scriptPath], { detached: true, stdio: 'ignore' })` + `.unref()`
7. `updateRun({ status: 'running' })`
8. Returns `{ run }` with HTTP 202

The `ingestUrl` is `http://127.0.0.1:$PORT/api/genomics/runs/:id/ingest` (loopback).

#### `POST /api/genomics/runs/:runId/ingest`

Webhook receiver called by the running shell script at each stage boundary.

**Auth:** `Authorization: Bearer $HERMES_API_TOKEN`. Unauthenticated allowed when no token configured.

**Payload:**

```ts
| { event: 'stage_start';    stage: string }
| { event: 'stage_complete'; stage: string; exit_code?: number }
| { event: 'stage_failed';   stage: string; exit_code?: number }
| { event: 'run_complete' }
| { event: 'run_failed' }
```

**State transitions:**

| Event | DB change |
|---|---|
| `stage_start` | `run_stages.status = 'running'`, `started_at = now` |
| `stage_complete` | `run_stages.status = 'completed'`, `finished_at = now` |
| `stage_failed` | `run_stages.status = 'failed'`, `finished_at = now`; `runs.status = 'failed'` |
| `run_complete` | `runs.status = 'completed'` |
| `run_failed` | `runs.status = 'failed'` |

---

## Shell Script Generation (`src/server/genomics/shell-generator.ts`)

`generateShellScript(run, ingestUrl, apiToken)` produces a bash script that mirrors
`docs/ref-sh/01-pbrun-somatic-5tngs.sh` with additions:

- Ingest URL and API token baked in at generation time (no bash variables needed for these)
- `printf '...' "$SAMPLE" | curl ...` pattern for dynamic stage names in JSON payloads
- `tee $LOGDIR/$SAMPLE.log` on each Docker invocation — log written to file + stdout
- `${PIPESTATUS[0]}` checked after each `docker run | tee` pipeline; sends `stage_failed` +
  `run_failed` then exits on non-zero
- Generated script written to `$log_dir/script.sh`; FASTQ glob pattern matches original script

Reference map baked in:
```
GRCh38 → /mnt/storage/parabricks_test/ref/Homo_sapiens_assembly38.fasta
hg19   → /mnt/storage/parabricks_test/ref/ucsc.hg19.fasta
```

---

## UI Changes

### Run List (`src/screens/genomics/run-list-screen.tsx`)

Replaced 6 flat text inputs with a structured form:

| Field | Type | Notes |
|---|---|---|
| Pipeline | Disabled text | Fixed to "Somatic Tumor-Only (Panel)" in Phase 1 |
| Run Name | Text | |
| Case | Select | Fetches `/api/genomics/cases`; required |
| Reference | Select | GRCh38 / hg19 |
| Input Dir (NAS) | Text | Base dir; script globs `$INDIR-$SAMPLE_S*_R{1,2}*.fastq.gz` |
| Sample IDs | Text | Comma-separated; split server-side into `run_config.samples[]` |
| Output Dir (NAS) | Text | Also used as `log_dir` base (`$output_dir/logs`) |
| GPUs / sample | Number | Default 1 |

On successful create: navigates directly to the run detail page.

### Run Detail (`src/screens/genomics/run-detail-screen.tsx`)

- **"▶ Start Run" button** — shown only when `run.status === 'queued'`; calls `POST .../start`;
  invalidates run query on success
- **Run Config card** — shows input dir, output dir, sample list (replaces old FASTQ path card)
- Stage list already renders per-sample (names come from `run_stages.name` = sample ID)

---

## File Index

| File | Type | Summary |
|---|---|---|
| `src/server/genomics/schema.ts` | Modified | `addColumnIfMissing` migrations for 5 new run columns + `log_file_path` |
| `src/server/genomics/types.ts` | Modified | `RunConfig` union; extended `Run` / `RunStage` interfaces |
| `src/server/genomics/runs-store.ts` | Modified | New fields in INSERT; `getRunConfig()` helper; new fields in updatable sets |
| `src/server/genomics/shell-generator.ts` | **New** | Generates parameterized bash script from `run_config` |
| `src/routes/api/genomics/runs.ts` | Modified | Requires `case_id`; validates case; auto-links via `case_runs` |
| `src/routes/api/genomics/runs.$runId.start.ts` | **New** | Spawn endpoint — stages, script, detached process |
| `src/routes/api/genomics/runs.$runId.ingest.ts` | **New** | Webhook receiver — updates stage/run status |
| `src/routes/api/genomics/runs.$runId.log.ts` | Modified | File-based SSE (byte-offset reads); DB fallback |
| `src/screens/genomics/run-list-screen.tsx` | Modified | Structured creation form |
| `src/screens/genomics/run-detail-screen.tsx` | Modified | Start Run button; run config card |

---

## Known Limitations (Phase 1)

- Only `batch-somatic-tumor` pipeline is shell-generatable; other modes return 400 on `/start`
- Log streaming opens a file read stream every 2s per stage — acceptable for a small number of
  concurrent runs; should switch to `fs.watch` or a proper tail library at scale
- Script is spawned from the workspace server process — if the server restarts mid-run, the
  detached bash process continues but the SSE stream drops until reconnect; run status will
  re-sync on the next `/start` poll because the ingest endpoint is still receiving callbacks
- `HERMES_API_TOKEN` is baked into the generated script in plaintext; the script is written
  to `log_dir` which should be on a restricted filesystem path

---

## Phase 2 Preview

Replace `shell-generator.ts` + `child_process.spawn` with:

```bash
nextflow run pipelines/batch-somatic-tumor.nf \
  -with-weblog http://127.0.0.1:$PORT/api/genomics/runs/$runId/ingest \
  --run_id $runId \
  --input_dir ... --samples ...
```

The ingest endpoint, DB schema, and UI are unchanged. Add `batch-germline.nf` and
`paired-somatic.nf` alongside, and extend the form dropdown.
