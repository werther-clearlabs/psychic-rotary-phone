# Run Integration — Manual E2E Test Plan

Tests must be run on the parabricks GPU server after pushing the `feature/run-creation-monitoring`
branch. They cannot be run locally because they require Docker, the parabricks image, and the NAS
test data.

---

## Prerequisites

### 1. Deploy to server

```bash
git push
# On the GPU server:
git pull origin feature/run-creation-monitoring
pnpm install
pnpm build
pnpm start   # or restart the existing service
```

### 2. Verify environment

```bash
echo $HERMES_API_TOKEN    # must be set
echo $PORT                # should be 3000 (or your configured port)
docker images | grep clara-parabricks   # 4.7.0-1 must be present
ls /mnt/storage/parabricks_test/ref/Homo_sapiens_assembly38.fasta   # reference must exist
ls /mnt/storage/parabricks_test/data/pillar_test_data/onc089eec2c-SIP0001_S*_L001_R1_001.fastq.gz
```

### 3. Test data paths

| Variable    | Expected path                                                                   |
| ----------- | ------------------------------------------------------------------------------- |
| INDIR       | `/mnt/storage/parabricks_test/data/pillar_test_data/onc089eec2c`                |
| Sample glob | `${INDIR}-${SAMPLE}_S*_L001_R{1,2}_001.fastq.gz`                                |
| Output      | Create a writable dir, e.g. `/mnt/storage/parabricks_test/results/e2e-test-001` |

### 4. Create a test case (if none exists)

```bash
curl -sf -X POST http://localhost:3001/api/genomics/cases \
  -H "Authorization: Bearer $HERMES_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"patient_id":"E2E-001","patient_name":"E2E Test Patient","status":"active"}' | jq .
```

Save the returned `id` as `$CASE_ID` for use in tests below.

---

## Test Cases

---

### T1 — Schema migration runs cleanly

**Goal:** Verify the DB migration applies without error on a fresh or existing database.

**Steps:**

1. Start (or restart) the workspace server
2. Check server logs for migration errors

**Expected:**

- Server starts without SQLite errors
- No `table already exists` or `duplicate column` errors

**Verify (optional — direct DB inspection):**

```bash
sqlite3 ~/.hermes/genomics.db ".schema runs" | grep -E "run_config|output_dir|log_dir|num_gpus|case_id"
sqlite3 ~/.hermes/genomics.db ".schema run_stages" | grep log_file_path
```

All 6 new columns should be present.

**Pass / Fail:** \_\_\_

---

### T2 — Run creation fails without case_id

**Goal:** Confirm the new validation on `POST /api/genomics/runs`.

**Steps:**

```bash
curl -sf -X POST http://localhost:3001/api/genomics/runs \
  -H "Authorization: Bearer $HERMES_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"no-case","pipeline":"batch-somatic-tumor","status":"queued"}' | jq .
```

**Expected:**

```json
{ "error": "case_id is required" }
```

HTTP 400.

**Pass / Fail:** \_\_\_

---

### T3 — Run creation success via API

**Goal:** Create a queued run with all required fields and verify DB row.

**Steps:**

```bash
curl -sf -X POST http://localhost:3001/api/genomics/runs \
  -H "Authorization: Bearer $HERMES_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"e2e-somatic-01\",
    \"pipeline\": \"batch-somatic-tumor\",
    \"reference\": \"GRCh38\",
    \"case_id\": \"$CASE_ID\",
    \"output_dir\": \"/mnt/storage/parabricks_test/results/e2e-test-001\",
    \"log_dir\": \"/mnt/storage/parabricks_test/results/e2e-test-001/logs\",
    \"num_gpus\": 1,
    \"status\": \"queued\",
    \"run_config\": \"{\\\"mode\\\":\\\"batch-somatic-tumor\\\",\\\"input_dir\\\":\\\"/mnt/storage/parabricks_test/data/pillar_test_data/onc089eec2c\\\",\\\"samples\\\":[\\\"SIP0001\\\",\\\"SIP0002\\\"],\\\"num_gpus_per_sample\\\":1}\"
  }" | jq .
```

Save the returned `run.id` as `$RUN_ID`.

**Expected:**

- HTTP 201
- Response has `run.id`, `run.status === "queued"`, `run.run_config` is non-null
- `case_runs` junction row created:
  ```bash
  sqlite3 ~/.hermes/genomics.db "SELECT * FROM case_runs WHERE run_id='$RUN_ID';"
  ```

**Pass / Fail:** \_\_\_

---

### T4 — Run creation via UI form

**Goal:** Verify the structured form in the browser creates a run and navigates to the detail page.

**Steps:**

1. Open `http://localhost:3001/genomics/runs` in browser
2. Click **+ New Run**
3. Fill in:
   - Run Name: `ui-test-01`
   - Case: select the test case created in prerequisites
   - Reference: GRCh38
   - Input Dir: `/mnt/storage/parabricks_test/data/pillar_test_data/onc089eec2c`
   - Sample IDs: `SIP0001, SIP0002`
   - Output Dir: `/mnt/storage/parabricks_test/results/e2e-ui-001`
   - GPUs / sample: `1`
4. Click **Create Run**

**Expected:**

- No error message shown
- Browser navigates to `/genomics/runs/$newRunId`
- Title bar shows run name + **queued** badge
- **▶ Start Run** button is visible
- Stage list shows "No stages recorded"

**Pass / Fail:** \_\_\_

---

### T5 — Start run: script generation and spawn

**Goal:** Verify the start endpoint generates the script and marks the run `running`.

**Steps:**

```bash
curl -sf -X POST http://localhost:3001/api/genomics/runs/$RUN_ID/start \
  -H "Authorization: Bearer $HERMES_API_TOKEN" | jq .run.status
```

**Expected immediately:**

- HTTP 202
- `run.status === "running"`

**Verify on disk:**

```bash
ls -la /mnt/storage/parabricks_test/results/e2e-test-001/logs/
# Should contain: script.sh
cat /mnt/storage/parabricks_test/results/e2e-test-001/logs/script.sh
```

Expected script content checks:

- `pbrun somatic` command present
- `INDIR=` matches the input_dir you provided
- `SAMPLES=("SIP0001" "SIP0002")`
- `NUM_GPUS=1`
- `curl ... /api/genomics/runs/$RUN_ID/ingest` calls present
- `tee "${LOGDIR}/${SAMPLE}.log"` present

**Verify stages created in DB:**

```bash
sqlite3 ~/.hermes/genomics.db "SELECT name, status, log_file_path FROM run_stages WHERE run_id='$RUN_ID';"
```

Should show SIP0001 and SIP0002 rows with `status=pending` and `log_file_path` set.

**Pass / Fail:** \_\_\_

---

### T6 — Start run: cannot start twice

**Goal:** Verify 409 on double-start.

**Steps:**

```bash
# With the run already running:
curl -sf -X POST http://localhost:3001/api/genomics/runs/$RUN_ID/start \
  -H "Authorization: Bearer $HERMES_API_TOKEN" | jq .
```

**Expected:**

```json
{ "error": "Run is already running" }
```

HTTP 409.

**Pass / Fail:** \_\_\_

---

### T7 — Ingest webhook: manual stage_start

**Goal:** Verify the ingest endpoint updates stage status correctly (can be tested before a full run).

**Steps (use a fresh queued run with stages pre-created via /start, or test on a running run):**

```bash
curl -sf -X POST http://localhost:3001/api/genomics/runs/$RUN_ID/ingest \
  -H "Authorization: Bearer $HERMES_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"event":"stage_start","stage":"SIP0001"}' | jq .
```

**Expected:**

```json
{ "ok": true }
```

**Verify:**

```bash
sqlite3 ~/.hermes/genomics.db \
  "SELECT name, status, started_at FROM run_stages WHERE run_id='$RUN_ID' AND name='SIP0001';"
```

`status=running`, `started_at` is non-null.

Repeat with `stage_complete`:

```bash
curl -sf -X POST http://localhost:3001/api/genomics/runs/$RUN_ID/ingest \
  -H "Authorization: Bearer $HERMES_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"event":"stage_complete","stage":"SIP0001","exit_code":0}' | jq .
```

Check `status=completed`, `finished_at` non-null.

**Pass / Fail:** \_\_\_

---

### T8 — Ingest webhook: auth rejection

**Goal:** Verify unauthorized requests are rejected.

**Steps:**

```bash
curl -i -X POST http://localhost:3001/api/genomics/runs/$RUN_ID/ingest \
  -H "Authorization: Bearer wrong-token" \
  -H "Content-Type: application/json" \
  -d '{"event":"run_complete"}'
```

**Expected:** HTTP 401.

**Pass / Fail:** \_\_\_

---

### T9 — Live stage monitoring in UI during run

**Goal:** Watch stage status badges update in the browser as the script runs.

**Steps:**

1. Create a new run via the UI form with samples `SIP0001, SIP0002`
2. Navigate to the run detail page
3. Click **▶ Start Run**
4. Observe the left-side stage list without refreshing

**Expected progression (poll every 3s, so changes visible within ~3s of each event):**

| Time                                 | SIP0001     | SIP0002     |
| ------------------------------------ | ----------- | ----------- |
| After start                          | ○ pending   | ○ pending   |
| ~seconds                             | ⟳ running   | ○ pending   |
| After SIP0001 completes (~20–60 min) | ✓ completed | ⟳ running   |
| After SIP0002 completes              | ✓ completed | ✓ completed |

- Title bar badge changes from **running** → **completed** after final ingest event
- **▶ Start Run** button disappears once status is no longer `queued`

**Pass / Fail:** \_\_\_

---

### T10 — Log streaming in UI

**Goal:** Verify parabricks log output appears in the live log panel.

**Steps:**

1. On a running run detail page, watch the dark log panel on the right
2. Wait for SIP0001 to start (ingest `stage_start` fires)
3. Check that log lines are appearing

**Expected:**

- Log lines from `$LOGDIR/SIP0001.log` stream into the panel
- New lines appear within ~2s of being written by the Docker container
- Older lines visible from the initial flush when the page loads

**Also verify the log file is being written:**

```bash
tail -f /mnt/storage/parabricks_test/results/e2e-test-001/logs/SIP0001.log
```

**Pass / Fail:** \_\_\_

---

### T11 — Run failure propagates correctly

**Goal:** Verify that a Docker failure sets stage and run to `failed` in the UI.

**Steps:**

1. Create a run with an intentionally bad sample ID (one that has no matching FASTQ files),
   e.g. Sample IDs: `DOESNOTEXIST`
2. Start the run
3. Observe run detail page

**Expected:**

- Stage `DOESNOTEXIST` transitions to ○ pending → ⟳ running → ✗ failed
- Run status badge changes from **running** → **failed**
- Log panel shows the error output from the failed `ls` glob or Docker exit

**Verify in DB:**

```bash
sqlite3 ~/.hermes/genomics.db \
  "SELECT name, status, finished_at FROM run_stages WHERE run_id='$BAD_RUN_ID';"
sqlite3 ~/.hermes/genomics.db \
  "SELECT status FROM runs WHERE id='$BAD_RUN_ID';"
```

**Pass / Fail:** \_\_\_

---

### T12 — Full 2-sample run (smoke test)

**Goal:** End-to-end run with real parabricks execution on the smallest available samples.

**Steps:**

1. Via UI form, create run:
   - Run Name: `full-e2e-SIP0001-SIP0002`
   - Case: test case
   - Input Dir: `/mnt/storage/parabricks_test/data/pillar_test_data/onc089eec2c`
   - Samples: `SIP0001, SIP0002`
   - Output Dir: `/mnt/storage/parabricks_test/results/full-e2e-001`
   - GPUs / sample: `1`
2. Click **▶ Start Run**
3. Monitor the detail page; also watch GPU dashboard for utilization

**Expected timeline (approximate — depends on data size):**

- Both stages cycle through pending → running → completed
- Run status reaches **completed**
- Output files exist on NAS:
  ```bash
  ls /mnt/storage/parabricks_test/results/full-e2e-001/
  # SIP0001.bam  SIP0001.somatic.vcf  SIP0002.bam  SIP0002.somatic.vcf
  ```
- Log files exist:
  ```bash
  ls /mnt/storage/parabricks_test/results/full-e2e-001/logs/
  # script.sh  SIP0001.log  SIP0002.log
  ```
- GPU utilization card on dashboard shows activity during run

**Pass / Fail:** \_\_\_

---

## Regression Checks

Verify existing features still work after the migration:

| Check                                                  | Expected                                  |
| ------------------------------------------------------ | ----------------------------------------- |
| `/genomics/cases` list loads                           | ✓                                         |
| Existing runs (pre-migration) still appear in run list | ✓ (columns nullable; old rows unaffected) |
| Case detail page loads                                 | ✓                                         |
| Dashboard GPU card still refreshes                     | ✓                                         |
| `/genomics/runs` page loads (no form open)             | ✓                                         |

---

## Notes for Debugging

**Check server logs for ingest calls:**

```bash
# If using pnpm start with stdout logging:
journalctl -u hermes-workspace -f | grep ingest
```

**Manually fire all ingest events for a run (useful for UI testing without waiting for pbrun):**

```bash
RUN_ID=<your-run-id>
BASE="http://localhost:3001/api/genomics/runs/$RUN_ID/ingest"
AUTH="-H 'Authorization: Bearer $HERMES_API_TOKEN' -H 'Content-Type: application/json'"

for SAMPLE in SIP0001 SIP0002; do
  curl -sf -X POST $BASE $AUTH -d "{\"event\":\"stage_start\",\"stage\":\"$SAMPLE\"}"
  sleep 5
  curl -sf -X POST $BASE $AUTH -d "{\"event\":\"stage_complete\",\"stage\":\"$SAMPLE\",\"exit_code\":0}"
done
curl -sf -X POST $BASE $AUTH -d '{"event":"run_complete"}'
```

**Check generated script for correctness before running:**

```bash
bash -n /path/to/log_dir/script.sh   # syntax check without executing
```
