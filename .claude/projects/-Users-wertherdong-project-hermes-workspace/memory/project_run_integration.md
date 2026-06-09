---
name: project-run-integration
description: Parabricks run integration plan — decisions, phases, and current status
metadata:
  type: project
---

Plan to hook parabricks pipeline jobs into the workspace UI run creation and monitoring.

Full plan: `docs/plan-run-integration.md`

**Decisions made:**
1. Launch: `child_process.spawn` of shell script on same host (Phase 1), Nextflow (Phase 2)
2. Run config: JSON blob (`run_config TEXT` column)
3. Phase 1: `batch-somatic-tumor` (pillar panel) only; Phase 2: all 3 pipelines via Nextflow
4. Serial execution only
5. Case required at run creation
6. Logs written to file; path stored in `run_stages.log_file_path`
7. GPU-to-run correlation: out of scope until Phase 2+

**Phase 1 — 10 steps (not yet started):**
1. Schema migration (new columns on `runs` + `run_stages`)
2. Update `types.ts` (RunConfig union type, extend Run/RunStage interfaces)
3. Update `runs-store.ts` (CRUD for new fields)
4. New `shell-generator.ts` (parameterized script from run_config)
5. New `runs.$runId.start.ts` (spawn endpoint)
6. New `runs.$runId.ingest.ts` (webhook receiver)
7. Update `runs.$runId.log.ts` (file-based SSE streaming)
8. Update `runs.ts` (accept case_id + run_config, auto-link case)
9. Update `run-list-screen.tsx` (structured form)
10. Update `run-detail-screen.tsx` (Start Run button)

**Phase 2 — Nextflow:**
Replace shell-generator + spawn with `nextflow run pipelines/X.nf -with-weblog $ingestUrl`.
Add `batch-germline.nf`, `paired-somatic.nf`, `batch-somatic-tumor.nf`.
DB schema and ingest endpoint carry forward unchanged.

**Why:** Parabricks 4-hour GPU jobs need UI monitoring with per-sample stage tracking,
live log streaming (SSE from file), and webhook-based status callbacks from the running process.
