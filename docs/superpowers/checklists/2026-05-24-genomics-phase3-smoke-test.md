# Genomics Portal — Phase 3 Manual Smoke Test

**Scope:** Verify the Report & Review tab end-to-end after Phase 3 lands. Covers watcher ingestion, Generate modal, canvas editing, signing, PDF export, AI chat, and security/state-isolation safeguards.

**Branch:** `feat/genomics-phase1` (Phase 3 commits 294904f9..254b343f).

**Prereqs:**
- Node ≥22, pnpm ≥10.24
- Local dev DB (will be created/migrated automatically on first run)
- Hermes agent gateway running on `127.0.0.1:8642` (for chat panel + report generation dispatch — chat will surface "Error: could not reach Hermes" if missing)

---

## 0. Setup

- [ ] `mkdir -p /tmp/genomics-reports`
- [ ] Start dev server with watcher path set:
  ```bash
  GENOMICS_REPORT_WATCH_PATH=/tmp/genomics-reports pnpm dev
  ```
- [ ] Server log shows: `[genomics watcher] watching /tmp/genomics-reports for markdown reports`
- [ ] Open browser to `http://localhost:3000` → redirects to `/genomics` dashboard, no console errors

---

## 1. Seed data

- [ ] Create a Protocol:
  ```bash
  curl -s -X POST http://localhost:3000/api/genomics/protocols \
    -H "Content-Type: application/json" \
    -d '{
      "name": "WGS Oncology Report",
      "version": "2.1",
      "assay_type": "WGS",
      "description": "Full somatic WGS report",
      "prompt_template": "Generate a 12-section Molecular Pathology report for patient {{patient_name}} with diagnosis {{diagnosis}}. VCF: {{vcf_path}}.",
      "skills": ["vcf-interpretation","oncokb-lookup","civic-lookup","trial-matcher","report-writer-12section"],
      "variables": [
        {"name":"patient_name","label":"Patient Name","source":"case.patient_name","editable":false},
        {"name":"diagnosis","label":"Diagnosis","source":"case.diagnosis","editable":true},
        {"name":"vcf_path","label":"VCF Path","source":"manual","editable":true}
      ]
    }'
  ```
- [ ] Create a Case (note the returned `id` — needed below as `CASE_ID`):
  ```bash
  curl -s -X POST http://localhost:3000/api/genomics/cases \
    -H "Content-Type: application/json" \
    -d '{"patient_name":"Jane Doe","diagnosis":"Melanoma","stage":"IIIa","assay_type":"WGS","status":"active"}'
  ```
- [ ] Set `CASE_ID=<id-from-above>` in your shell for reuse

---

## 2. Empty-state Report & Review tab

- [ ] Navigate to `http://localhost:3000/genomics/cases/$CASE_ID`
- [ ] Click **Report & Review** tab
- [ ] Empty state renders: hex glyph (⬡), "No report generated yet" headline, descriptive paragraph, `Generate Report` button
- [ ] No console errors

---

## 3. Generate Report 3-step modal

- [ ] Click **Generate Report** — modal appears, header reads "Generate Report", step indicator highlights step 1
- [ ] **Step 1 — SELECT PROTOCOL**
  - [ ] "WGS Oncology Report v2.1" card visible with ACTIVE badge, description, and skill chips
  - [ ] Header says `Available Protocols · Filtered for WGS` (proves `assay_type` query-param filter is wired)
  - [ ] Click the card — border turns brand-color, radio fills in
  - [ ] `Next →` button enables
- [ ] **Step 2 — REVIEW VARIABLES**
  - [ ] Click `Next →`
  - [ ] Table renders three rows: Patient Name, Diagnosis, VCF Path
  - [ ] Patient Name resolved to "Jane Doe" as plain text (read-only)
  - [ ] Diagnosis resolved to "Melanoma" as an editable input
  - [ ] VCF Path is empty editable input with source "manual"
  - [ ] Type into VCF Path repeatedly — **network tab should NOT show a POST to `/protocols/$id/preview` on every keystroke** (debounce/refetch fix)
  - [ ] If you reload protocols by reopening modal: stale step-2 fallback message ("Protocol not found. Go back and reselect.") appears only when `selectedProtocol` is null
- [ ] **Step 3 — CONFIRM**
  - [ ] Click `Next →`
  - [ ] Network tab shows a `POST /api/genomics/protocols/$id/preview` fire (the refetch-on-step-3 effect)
  - [ ] Rendered prompt preview shows substituted values: patient name "Jane Doe", diagnosis "Melanoma", VCF Path = whatever you typed
- [ ] Click `Generate Report`
  - [ ] Button shows "Dispatching…"
  - [ ] Modal closes
  - [ ] Server log shows the dispatch (and after ~3s the empty state may invalidate; expected behavior since the agent hasn't returned yet)

---

## 4. Watcher ingestion

Without restarting the dev server, drop a markdown report file:

- [ ] Run:
  ```bash
  cat > /tmp/genomics-reports/${CASE_ID}-report.md << 'EOF'
  # Molecular Pathology and Precision Oncology Report

  ## 1. Header / Specimen Information
  Patient: Jane Doe
  Sample ID: COLO829
  Report Date: 2026-05-24

  ## 2. Test Methodology and Limitations
  Whole Genome Sequencing at 30× coverage. Parabricks GPU pipeline.

  ## 3. Results Summary
  Hypermutated profile. BRAF V600E detected (Tier I).

  ## 4. Tier I - Variants of Strong Clinical Significance
  BRAF p.V600E — Pathogenic, Tier I. Vemurafenib/dabrafenib indicated.

  ## 5. Tier II - Variants of Potential Clinical Significance
  TERT Promoter C228T — Tier II.

  ## 6. Biomarker Signatures
  TMB: 48 mut/Mb (High). MSS.

  ## 7. Tier III - Variants of Uncertain Significance
  None identified.

  ## 8. Therapy Recommendations
  BRAF-targeted therapy (vemurafenib). Consider immunotherapy given high TMB.

  ## 9. Matched Clinical Trials
  NCT04972369 — BRAF V600E melanoma trial (nearby site).

  ## 10. Methodology Appendix
  BWA-MEM v2, Mutect2 v4.3, OncoKB API v3.7.

  ## 11. References
  1. Davies H et al. Nature 2002. 2. OncoKB knowledgebase 2026.

  ## 12. Disclaimers
  RESEARCH USE ONLY. Not for clinical decision-making.
  EOF
  ```
- [ ] Server log shows: `[genomics watcher] imported report for case <CASE_ID> from /tmp/genomics-reports/<CASE_ID>-report.md`
- [ ] **Filename anchor check**: try also `cp /tmp/genomics-reports/${CASE_ID}-report.md /tmp/genomics-reports/other-${CASE_ID}-stuff.md` — watcher log should say "could not match report file to a case" for the second file (anchored matcher rejects unanchored prefix)
- [ ] Reload the Case Report & Review tab in the browser
- [ ] Layout switches to split canvas: report on the left, AI chat panel on the right (380px column)

---

## 5. Report Canvas

- [ ] Toolbar shows "Molecular Pathology & Precision Oncology Report" header strip and a `Regenerate` button (status=draft)
- [ ] Section pills §1–§12 render; clicking each pill changes the active section content
- [ ] Read view of each section renders the markdown content as pre-wrap text
- [ ] Click **Edit** on section §4
  - [ ] Monaco editor opens with markdown content (~400px height)
  - [ ] Edit some text
  - [ ] **Debounce check**: open DevTools → Network → filter PUT. Type continuously for 1 second. Only ONE `PUT /api/genomics/cases/$caseId/report` fires (400ms after you stop typing)
  - [ ] Click **Close Editor** — content reverts to read view, with your edit preserved
  - [ ] Reload the page → §4 still shows your edited content (server-side persistence)
- [ ] **Editor state isolation check**: leave §4 editor open, switch to **Overview** tab, switch back to **Report & Review** — editor is closed (cleanup effect fires on unmount)
- [ ] **Cross-case check**: open §4 editor, navigate back to Cases list, open a different case → Report & Review of that case has NO section in edit mode (fix from final review)

---

## 6. Export PDF

- [ ] Click **Export PDF** in toolbar — button shows "Exporting…"
- [ ] Browser triggers a file download named `report-$CASE_ID.pdf`
- [ ] **Cross-browser check**: open the file. PDF contains all 12 sections rendered (Puppeteer pipeline)
- [ ] **Memory check**: no warning in DevTools console about revoked blob URL or download failure (Safari/Firefox shouldn't blank-download due to the setTimeout-revoke fix)

---

## 7. Sign & Finalize

- [ ] Click **Sign & Finalize** in toolbar
- [ ] Dialog modal appears with: "Sign & Finalize Report" headline, "This will lock all sections" description, name input, and red "RESEARCH USE ONLY" disclaimer
- [ ] `Sign Report` button is disabled until you enter a name
- [ ] Type "Dr. Smith" → click `Sign Report`
- [ ] Toolbar now shows green **SIGNED · Dr. Smith** badge
- [ ] **Sign & Finalize** button is gone
- [ ] All section **Edit** buttons are gone — sections are read-only
- [ ] Reload the page → SIGNED state persists, sections still locked

---

## 8. AI Chat Panel

- [ ] Right column of Report & Review tab is the chat panel
- [ ] Header reads "AI Assistant · Jane Doe"
- [ ] **Context primer**: shortly after the tab mounts, an assistant message bubble appears containing the case primer (or the agent's reply to it). The user-side primer message is hidden (only assistant reply visible)
- [ ] Type a question in the textarea: "What is the significance of BRAF V600E?"
- [ ] Hit Enter — message appears as right-aligned user bubble; new empty assistant bubble starts streaming
- [ ] SSE `chunk` events update the assistant bubble — text accumulates (verify by watching mid-response: text grows, doesn't disappear)
- [ ] Shift+Enter inserts a newline in the textarea (no send)
- [ ] If Hermes is down/unreachable: bubble shows "Error: could not reach Hermes." (no infinite spinner)

---

## 9. State isolation & error paths

- [ ] **Modal state isolation**:
  - [ ] Open Generate modal in Case A → switch to Overview tab → switch back to Report & Review → modal is CLOSED (not still open from before)
- [ ] **Figure route security** (only run if you want to verify the fail-closed guard):
  - [ ] Stop dev server, restart WITHOUT `GENOMICS_REPORT_WATCH_PATH` and WITHOUT `GENOMICS_NAS_BASE`:
    ```bash
    unset GENOMICS_REPORT_WATCH_PATH GENOMICS_NAS_BASE
    pnpm dev
    ```
  - [ ] `curl -i http://localhost:3000/api/genomics/figure?path=/etc/passwd` → 503 with `{"error":"Figure serving not configured"}`
  - [ ] Restart with `GENOMICS_REPORT_WATCH_PATH=/tmp/genomics-reports pnpm dev`
  - [ ] `curl -i http://localhost:3000/api/genomics/figure?path=/etc/passwd` → 403 Forbidden
  - [ ] `curl -i 'http://localhost:3000/api/genomics/figure?path=/tmp/genomics-reports/../../etc/passwd'` → 403 (path-traversal guard)
- [ ] **Watcher fault tolerance**: drop a non-markdown file into `/tmp/genomics-reports/` (e.g., `touch /tmp/genomics-reports/garbage.bin`) — server does not crash; watcher logs may complain but the process stays alive (try/catch wrapper)

---

## 10. Acceptance

- [ ] All boxes above checked, or unchecked items have documented reasons (e.g., Hermes gateway offline → Step 8 streaming skipped)
- [ ] No regressions observed in other workspace screens (Dashboard, Cases list, Run list)
- [ ] Server console clean of unexpected errors

---

**Sign-off:**

| Date | Tester | Notes |
|---|---|---|
| | | |
