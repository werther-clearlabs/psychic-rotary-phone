# Genomics Portal — Phase 1: Foundation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Install deps, create SQLite schema + store layer, and wire all API routes for Case, Run, Protocol, and Report entities.

**Architecture:** `better-sqlite3` singleton at `src/server/genomics/db.ts`. Schema runs on startup. Store functions accept an explicit `db` param (default = singleton) for testability. API routes at `src/routes/api/genomics/` use `requireLocalOrAuth` and call store functions. No frontend changes in this phase.

**Tech Stack:** better-sqlite3, Node.js fs.watch, TanStack file-based API routes, Vitest, Puppeteer (PDF, already installed)

**Spec:** `docs/superpowers/specs/2026-05-23-genomics-case-run-management-design.md`

---

### Task 1: Install dependency + env vars

**Files:**
- Modify: `package.json` (via pnpm)
- Modify: `.env.example`

- [ ] **Step 1: Install better-sqlite3**

```bash
pnpm add better-sqlite3
pnpm add -D @types/better-sqlite3
```

Expected: `better-sqlite3` appears in `package.json` dependencies.

- [ ] **Step 2: Add env vars to .env.example**

Append to `.env.example`:
```
# Genomics portal
GENOMICS_DB_PATH=          # default: ~/.hermes/genomics.db
GENOMICS_REPORT_WATCH_PATH=  # directory where agent writes markdown reports
GENOMICS_NAS_BASE=           # base path prefix for NAS file display in UI
```

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml .env.example
git commit -m "feat: add better-sqlite3 dep and genomics env vars"
```

---

### Task 2: DB singleton + schema

**Files:**
- Create: `src/server/genomics/db.ts`
- Create: `src/server/genomics/schema.ts`

- [ ] **Step 1: Write `db.ts`**

```typescript
// src/server/genomics/db.ts
import Database from 'better-sqlite3'
import { mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

export function openDb(path: string): Database.Database {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true })
  const db = new Database(path)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  return db
}

const dbPath =
  process.env.GENOMICS_DB_PATH ??
  join(
    process.env.HERMES_HOME ?? join(homedir(), '.hermes'),
    'genomics.db',
  )

export const db = openDb(dbPath)
```

- [ ] **Step 2: Write `schema.ts`**

```typescript
// src/server/genomics/schema.ts
import type Database from 'better-sqlite3'

export function runMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS cases (
      id TEXT PRIMARY KEY,
      patient_id TEXT,
      patient_name TEXT,
      dob TEXT,
      diagnosis TEXT,
      stage TEXT,
      assay_type TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      ehr_summary TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS case_samples (
      id TEXT PRIMARY KEY,
      case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
      sample_id TEXT,
      sample_type TEXT,
      fastq_path TEXT,
      vcf_path TEXT,
      added_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS runs (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      pipeline TEXT NOT NULL,
      reference TEXT,
      fastq_path TEXT,
      output_path TEXT,
      status TEXT NOT NULL DEFAULT 'queued',
      pbrun_command TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS run_stages (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      started_at INTEGER,
      finished_at INTEGER,
      log_tail TEXT
    );

    CREATE TABLE IF NOT EXISTS case_runs (
      case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
      run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
      PRIMARY KEY (case_id, run_id)
    );

    CREATE TABLE IF NOT EXISTS protocols (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      version TEXT NOT NULL,
      assay_type TEXT NOT NULL,
      description TEXT,
      prompt_template TEXT NOT NULL,
      skills TEXT NOT NULL DEFAULT '[]',
      variables TEXT NOT NULL DEFAULT '[]',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY,
      case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
      protocol_id TEXT REFERENCES protocols(id),
      protocol_version TEXT,
      version INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'draft',
      sections TEXT NOT NULL DEFAULT '{}',
      figures TEXT NOT NULL DEFAULT '[]',
      source_path TEXT,
      signed_by TEXT,
      signed_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `)
}
```

- [ ] **Step 3: Call migrations from db.ts**

Add to the bottom of `src/server/genomics/db.ts`:

```typescript
import { runMigrations } from './schema'
runMigrations(db)
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors in `src/server/genomics/`.

- [ ] **Step 5: Commit**

```bash
git add src/server/genomics/db.ts src/server/genomics/schema.ts
git commit -m "feat: SQLite db singleton and genomics schema"
```

---

### Task 3: Shared types

**Files:**
- Create: `src/server/genomics/types.ts`

- [ ] **Step 1: Write types**

```typescript
// src/server/genomics/types.ts
export type CaseStatus = 'active' | 'closed' | 'pending'
export type RunStatus = 'queued' | 'running' | 'completed' | 'failed'
export type StageStatus = 'pending' | 'running' | 'completed' | 'failed'
export type ReportStatus = 'draft' | 'signed'

export interface Case {
  id: string
  patient_id: string | null
  patient_name: string | null
  dob: string | null
  diagnosis: string | null
  stage: string | null
  assay_type: string | null      // e.g. 'WGS' | 'targeted-panel' | 'RNA-seq' — used by GenerateReportModal to filter protocols
  status: CaseStatus
  ehr_summary: string | null
  created_at: number
  updated_at: number
}

export interface CaseSample {
  id: string
  case_id: string
  sample_id: string | null
  sample_type: 'tumor' | 'normal' | 'germline' | null
  fastq_path: string | null
  vcf_path: string | null
  added_at: number
}

export interface Run {
  id: string
  name: string
  pipeline: string
  reference: string | null
  fastq_path: string | null
  output_path: string | null
  status: RunStatus
  pbrun_command: string | null
  created_at: number
  updated_at: number
}

export interface RunStage {
  id: string
  run_id: string
  name: string
  status: StageStatus
  started_at: number | null
  finished_at: number | null
  log_tail: string | null
}

export interface Protocol {
  id: string
  name: string
  version: string
  assay_type: string
  description: string | null
  prompt_template: string
  skills: string[]
  variables: ProtocolVariable[]
  is_active: number
  created_at: number
  updated_at: number
}

export interface ProtocolVariable {
  name: string
  label: string
  source: string   // 'case.vcf_path' | 'case.diagnosis' | 'manual' | etc.
  editable: boolean
}

export interface Report {
  id: string
  case_id: string
  protocol_id: string | null
  protocol_version: string | null
  version: number
  status: ReportStatus
  sections: Record<string, string>   // { "1": "...", "2": "..." }
  figures: ReportFigure[]
  source_path: string | null
  signed_by: string | null
  signed_at: number | null
  created_at: number
  updated_at: number
}

export interface ReportFigure {
  section: string
  path: string
  caption: string
}
```

- [ ] **Step 2: Commit**

```bash
git add src/server/genomics/types.ts
git commit -m "feat: genomics domain types"
```

---

### Task 4: cases-store

**Files:**
- Create: `src/server/genomics/cases-store.ts`
- Create: `src/server/genomics/cases-store.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/server/genomics/cases-store.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { openDb } from './db'
import { runMigrations } from './schema'
import {
  listCases, getCase, createCase, updateCase,
  listSamples, addSample,
} from './cases-store'
import type Database from 'better-sqlite3'

let testDb: Database.Database

beforeEach(() => {
  testDb = openDb(':memory:')
  runMigrations(testDb)
})

describe('cases-store', () => {
  it('creates and retrieves a case', () => {
    const c = createCase(testDb, {
      patient_id: 'PT-001',
      patient_name: 'Jane Doe',
      dob: '1970-05-01',
      diagnosis: 'NSCLC',
      stage: 'IIIa',
      status: 'active',
      ehr_summary: null,
    })
    expect(c.id).toHaveLength(36) // UUID
    expect(c.patient_name).toBe('Jane Doe')

    const found = getCase(testDb, c.id)
    expect(found?.patient_id).toBe('PT-001')
  })

  it('lists cases', () => {
    createCase(testDb, { patient_name: 'A', status: 'active' })
    createCase(testDb, { patient_name: 'B', status: 'closed' })
    expect(listCases(testDb)).toHaveLength(2)
  })

  it('updates a case', () => {
    const c = createCase(testDb, { patient_name: 'A', status: 'active' })
    const updated = updateCase(testDb, c.id, { status: 'closed' })
    expect(updated?.status).toBe('closed')
  })

  it('adds and lists samples', () => {
    const c = createCase(testDb, { patient_name: 'A', status: 'active' })
    addSample(testDb, {
      case_id: c.id,
      sample_id: 'COLO829',
      sample_type: 'tumor',
      fastq_path: '/nas/runs/042/tumor.fastq.gz',
      vcf_path: null,
    })
    const samples = listSamples(testDb, c.id)
    expect(samples).toHaveLength(1)
    expect(samples[0].sample_type).toBe('tumor')
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
pnpm test src/server/genomics/cases-store.test.ts
```

Expected: FAIL — `cases-store` not found.

- [ ] **Step 3: Write `cases-store.ts`**

```typescript
// src/server/genomics/cases-store.ts
import { randomUUID } from 'node:crypto'
import type Database from 'better-sqlite3'
import { db as defaultDb } from './db'
import type { Case, CaseSample, CaseStatus } from './types'

type CreateCaseInput = Partial<Omit<Case, 'id' | 'created_at' | 'updated_at'>> &
  Pick<Case, 'status'>

function deserialize(row: Record<string, unknown>): Case {
  return row as Case
}

export function listCases(db: Database.Database = defaultDb): Case[] {
  return db
    .prepare('SELECT * FROM cases ORDER BY created_at DESC')
    .all() as Case[]
}

export function getCase(
  db: Database.Database = defaultDb,
  id: string,
): Case | null {
  return (
    (db.prepare('SELECT * FROM cases WHERE id = ?').get(id) as Case) ?? null
  )
}

export function createCase(
  db: Database.Database = defaultDb,
  input: CreateCaseInput,
): Case {
  const now = Date.now()
  const id = randomUUID()
  db.prepare(`
    INSERT INTO cases (id, patient_id, patient_name, dob, diagnosis, stage, assay_type, status, ehr_summary, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    input.patient_id ?? null,
    input.patient_name ?? null,
    input.dob ?? null,
    input.diagnosis ?? null,
    input.stage ?? null,
    input.assay_type ?? null,
    input.status,
    input.ehr_summary ?? null,
    now,
    now,
  )
  return getCase(db, id)!
}

export function updateCase(
  db: Database.Database = defaultDb,
  id: string,
  patch: Partial<Omit<Case, 'id' | 'created_at' | 'updated_at'>>,
): Case | null {
  const fields = Object.keys(patch) as (keyof typeof patch)[]
  if (fields.length === 0) return getCase(db, id)
  const setClauses = fields.map((f) => `${f} = ?`).join(', ')
  const values = fields.map((f) => patch[f] ?? null)
  db.prepare(`UPDATE cases SET ${setClauses}, updated_at = ? WHERE id = ?`).run(
    ...values,
    Date.now(),
    id,
  )
  return getCase(db, id)
}

export function listSamples(
  db: Database.Database = defaultDb,
  caseId: string,
): CaseSample[] {
  return db
    .prepare('SELECT * FROM case_samples WHERE case_id = ? ORDER BY added_at ASC')
    .all(caseId) as CaseSample[]
}

export function addSample(
  db: Database.Database = defaultDb,
  input: Omit<CaseSample, 'id' | 'added_at'>,
): CaseSample {
  const id = randomUUID()
  const now = Date.now()
  db.prepare(`
    INSERT INTO case_samples (id, case_id, sample_id, sample_type, fastq_path, vcf_path, added_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, input.case_id, input.sample_id ?? null, input.sample_type ?? null, input.fastq_path ?? null, input.vcf_path ?? null, now)
  return db.prepare('SELECT * FROM case_samples WHERE id = ?').get(id) as CaseSample
}
```

- [ ] **Step 4: Run test — expect PASS**

```bash
pnpm test src/server/genomics/cases-store.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/server/genomics/cases-store.ts src/server/genomics/cases-store.test.ts
git commit -m "feat: cases-store with CRUD and samples"
```

---

### Task 5: runs-store

**Files:**
- Create: `src/server/genomics/runs-store.ts`
- Create: `src/server/genomics/runs-store.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/server/genomics/runs-store.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { openDb } from './db'
import { runMigrations } from './schema'
import {
  listRuns, getRun, createRun, updateRun,
  listStages, upsertStage, linkRunToCase, listRunsForCase,
} from './runs-store'
import { createCase } from './cases-store'
import type Database from 'better-sqlite3'

let testDb: Database.Database

beforeEach(() => {
  testDb = openDb(':memory:')
  runMigrations(testDb)
})

describe('runs-store', () => {
  it('creates and retrieves a run', () => {
    const r = createRun(testDb, {
      name: 'WGS-2024-001',
      pipeline: 'wgs-mutect2',
      reference: 'GRCh38',
      status: 'queued',
    })
    expect(r.id).toHaveLength(36)
    expect(getRun(testDb, r.id)?.pipeline).toBe('wgs-mutect2')
  })

  it('updates run status', () => {
    const r = createRun(testDb, { name: 'R1', pipeline: 'wgs-mutect2', status: 'queued' })
    const updated = updateRun(testDb, r.id, { status: 'running' })
    expect(updated?.status).toBe('running')
  })

  it('upserts stages', () => {
    const r = createRun(testDb, { name: 'R1', pipeline: 'wgs-mutect2', status: 'queued' })
    upsertStage(testDb, r.id, 'FASTQ QC', { status: 'running', started_at: Date.now() })
    upsertStage(testDb, r.id, 'BWA-MEM Align', { status: 'pending' })
    expect(listStages(testDb, r.id)).toHaveLength(2)
    upsertStage(testDb, r.id, 'FASTQ QC', { status: 'completed' })
    const stages = listStages(testDb, r.id)
    expect(stages.find(s => s.name === 'FASTQ QC')?.status).toBe('completed')
  })

  it('links run to case', () => {
    const c = createCase(testDb, { status: 'active' })
    const r = createRun(testDb, { name: 'R1', pipeline: 'wgs-mutect2', status: 'queued' })
    linkRunToCase(testDb, r.id, c.id)
    const linked = listRunsForCase(testDb, c.id)
    expect(linked).toHaveLength(1)
    expect(linked[0].id).toBe(r.id)
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
pnpm test src/server/genomics/runs-store.test.ts
```

- [ ] **Step 3: Write `runs-store.ts`**

```typescript
// src/server/genomics/runs-store.ts
import { randomUUID } from 'node:crypto'
import type Database from 'better-sqlite3'
import { db as defaultDb } from './db'
import type { Run, RunStage, RunStatus, StageStatus } from './types'

type CreateRunInput = Partial<Omit<Run, 'id' | 'created_at' | 'updated_at'>> &
  Pick<Run, 'name' | 'pipeline' | 'status'>

export function listRuns(db: Database.Database = defaultDb): Run[] {
  return db.prepare('SELECT * FROM runs ORDER BY created_at DESC').all() as Run[]
}

export function getRun(db: Database.Database = defaultDb, id: string): Run | null {
  return (db.prepare('SELECT * FROM runs WHERE id = ?').get(id) as Run) ?? null
}

export function createRun(db: Database.Database = defaultDb, input: CreateRunInput): Run {
  const id = randomUUID()
  const now = Date.now()
  db.prepare(`
    INSERT INTO runs (id, name, pipeline, reference, fastq_path, output_path, status, pbrun_command, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, input.name, input.pipeline, input.reference ?? null, input.fastq_path ?? null, input.output_path ?? null, input.status, input.pbrun_command ?? null, now, now)
  return getRun(db, id)!
}

export function updateRun(
  db: Database.Database = defaultDb,
  id: string,
  patch: Partial<Omit<Run, 'id' | 'created_at' | 'updated_at'>>,
): Run | null {
  const fields = Object.keys(patch) as (keyof typeof patch)[]
  if (fields.length === 0) return getRun(db, id)
  const setClauses = fields.map((f) => `${f} = ?`).join(', ')
  const values = fields.map((f) => (patch[f] as unknown) ?? null)
  db.prepare(`UPDATE runs SET ${setClauses}, updated_at = ? WHERE id = ?`).run(...values, Date.now(), id)
  return getRun(db, id)
}

export function listStages(db: Database.Database = defaultDb, runId: string): RunStage[] {
  return db.prepare('SELECT * FROM run_stages WHERE run_id = ?').all(runId) as RunStage[]
}

export function upsertStage(
  db: Database.Database = defaultDb,
  runId: string,
  name: string,
  patch: Partial<Omit<RunStage, 'id' | 'run_id' | 'name'>>,
): RunStage {
  const existing = db.prepare('SELECT * FROM run_stages WHERE run_id = ? AND name = ?').get(runId, name) as RunStage | undefined
  if (existing) {
    const fields = Object.keys(patch) as (keyof typeof patch)[]
    if (fields.length > 0) {
      const setClauses = fields.map((f) => `${f} = ?`).join(', ')
      const values = fields.map((f) => (patch[f] as unknown) ?? null)
      db.prepare(`UPDATE run_stages SET ${setClauses} WHERE run_id = ? AND name = ?`).run(...values, runId, name)
    }
    return db.prepare('SELECT * FROM run_stages WHERE run_id = ? AND name = ?').get(runId, name) as RunStage
  }
  const id = randomUUID()
  db.prepare(`
    INSERT INTO run_stages (id, run_id, name, status, started_at, finished_at, log_tail)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, runId, name, patch.status ?? 'pending', patch.started_at ?? null, patch.finished_at ?? null, patch.log_tail ?? null)
  return db.prepare('SELECT * FROM run_stages WHERE id = ?').get(id) as RunStage
}

export function linkRunToCase(db: Database.Database = defaultDb, runId: string, caseId: string): void {
  db.prepare('INSERT OR IGNORE INTO case_runs (case_id, run_id) VALUES (?, ?)').run(caseId, runId)
}

export function listRunsForCase(db: Database.Database = defaultDb, caseId: string): Run[] {
  return db.prepare(`
    SELECT r.* FROM runs r
    INNER JOIN case_runs cr ON cr.run_id = r.id
    WHERE cr.case_id = ?
    ORDER BY r.created_at DESC
  `).all(caseId) as Run[]
}
```

- [ ] **Step 4: Run test — expect PASS**

```bash
pnpm test src/server/genomics/runs-store.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/server/genomics/runs-store.ts src/server/genomics/runs-store.test.ts
git commit -m "feat: runs-store with stages and case linking"
```

---

### Task 6: protocols-store

**Files:**
- Create: `src/server/genomics/protocols-store.ts`
- Create: `src/server/genomics/protocols-store.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/server/genomics/protocols-store.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { openDb } from './db'
import { runMigrations } from './schema'
import { createProtocol, listProtocols, getProtocol, renderTemplate } from './protocols-store'
import type Database from 'better-sqlite3'

let testDb: Database.Database

beforeEach(() => {
  testDb = openDb(':memory:')
  runMigrations(testDb)
})

describe('protocols-store', () => {
  it('creates and lists protocols', () => {
    createProtocol(testDb, {
      name: 'WGS Oncology Report',
      version: '2.1',
      assay_type: 'WGS',
      description: 'Full somatic WGS report',
      prompt_template: 'Interpret {{vcf_path}} for {{diagnosis}}',
      skills: ['vcf-interpretation', 'oncokb-lookup', 'report-writer-12section'],
      variables: [
        { name: 'vcf_path', label: 'VCF Path', source: 'case.vcf_path', editable: false },
        { name: 'diagnosis', label: 'Diagnosis', source: 'case.diagnosis', editable: true },
      ],
    })
    const list = listProtocols(testDb)
    expect(list).toHaveLength(1)
    expect(list[0].name).toBe('WGS Oncology Report')
    expect(list[0].skills).toEqual(['vcf-interpretation', 'oncokb-lookup', 'report-writer-12section'])
  })

  it('filters by assay_type', () => {
    createProtocol(testDb, { name: 'WGS Report', version: '1.0', assay_type: 'WGS', prompt_template: 'p', skills: [], variables: [] })
    createProtocol(testDb, { name: 'RNA Report', version: '1.0', assay_type: 'RNA-seq', prompt_template: 'p', skills: [], variables: [] })
    expect(listProtocols(testDb, { assay_type: 'WGS' })).toHaveLength(1)
  })

  it('renders template with variable substitution', () => {
    const p = createProtocol(testDb, {
      name: 'Test', version: '1.0', assay_type: 'WGS',
      prompt_template: 'Analyze {{vcf_path}} for patient {{patient_name}} with {{diagnosis}}',
      skills: [], variables: [],
    })
    const rendered = renderTemplate(p.prompt_template, {
      vcf_path: '/nas/colo829.vcf',
      patient_name: 'Jane Doe',
      diagnosis: 'Melanoma',
    })
    expect(rendered).toBe('Analyze /nas/colo829.vcf for patient Jane Doe with Melanoma')
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
pnpm test src/server/genomics/protocols-store.test.ts
```

- [ ] **Step 3: Write `protocols-store.ts`**

```typescript
// src/server/genomics/protocols-store.ts
import { randomUUID } from 'node:crypto'
import type Database from 'better-sqlite3'
import { db as defaultDb } from './db'
import type { Protocol, ProtocolVariable } from './types'

type CreateProtocolInput = Omit<Protocol, 'id' | 'is_active' | 'created_at' | 'updated_at'>

function deserializeProtocol(row: Record<string, unknown>): Protocol {
  return {
    ...row,
    skills: JSON.parse(row.skills as string),
    variables: JSON.parse(row.variables as string),
  } as Protocol
}

export function listProtocols(
  db: Database.Database = defaultDb,
  filter?: { assay_type?: string; active_only?: boolean },
): Protocol[] {
  let sql = 'SELECT * FROM protocols WHERE 1=1'
  const params: unknown[] = []
  if (filter?.active_only !== false) { sql += ' AND is_active = 1'; }
  if (filter?.assay_type) { sql += ' AND assay_type = ?'; params.push(filter.assay_type) }
  sql += ' ORDER BY name, version DESC'
  return (db.prepare(sql).all(...params) as Record<string, unknown>[]).map(deserializeProtocol)
}

export function getProtocol(db: Database.Database = defaultDb, id: string): Protocol | null {
  const row = db.prepare('SELECT * FROM protocols WHERE id = ?').get(id) as Record<string, unknown> | undefined
  return row ? deserializeProtocol(row) : null
}

export function createProtocol(db: Database.Database = defaultDb, input: CreateProtocolInput): Protocol {
  const id = randomUUID()
  const now = Date.now()
  db.prepare(`
    INSERT INTO protocols (id, name, version, assay_type, description, prompt_template, skills, variables, is_active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
  `).run(id, input.name, input.version, input.assay_type, input.description ?? null, input.prompt_template, JSON.stringify(input.skills), JSON.stringify(input.variables), now, now)
  return getProtocol(db, id)!
}

export function updateProtocol(
  db: Database.Database = defaultDb,
  id: string,
  patch: Partial<Omit<Protocol, 'id' | 'created_at' | 'updated_at'>>,
): Protocol | null {
  const serialized: Record<string, unknown> = { ...patch }
  if (patch.skills) serialized.skills = JSON.stringify(patch.skills)
  if (patch.variables) serialized.variables = JSON.stringify(patch.variables)
  const fields = Object.keys(serialized)
  if (fields.length === 0) return getProtocol(db, id)
  const setClauses = fields.map((f) => `${f} = ?`).join(', ')
  const values = fields.map((f) => serialized[f] ?? null)
  db.prepare(`UPDATE protocols SET ${setClauses}, updated_at = ? WHERE id = ?`).run(...values, Date.now(), id)
  return getProtocol(db, id)
}

export function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`)
}

export function resolveVariables(
  protocol: Protocol,
  caseData: Record<string, unknown>,
  overrides: Record<string, string> = {},
): Record<string, string> {
  const resolved: Record<string, string> = {}
  for (const v of protocol.variables) {
    if (overrides[v.name] !== undefined) {
      resolved[v.name] = overrides[v.name]
    } else if (v.source.startsWith('case.')) {
      const field = v.source.slice(5)
      resolved[v.name] = String(caseData[field] ?? '')
    } else {
      resolved[v.name] = ''
    }
  }
  return resolved
}
```

- [ ] **Step 4: Run test — expect PASS**

```bash
pnpm test src/server/genomics/protocols-store.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/server/genomics/protocols-store.ts src/server/genomics/protocols-store.test.ts
git commit -m "feat: protocols-store with template rendering"
```

---

### Task 7: reports-store

**Files:**
- Create: `src/server/genomics/reports-store.ts`
- Create: `src/server/genomics/reports-store.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/server/genomics/reports-store.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { openDb } from './db'
import { runMigrations } from './schema'
import { createReport, getLatestReport, patchSection, signReport } from './reports-store'
import { createCase } from './cases-store'
import type Database from 'better-sqlite3'

let testDb: Database.Database

beforeEach(() => {
  testDb = openDb(':memory:')
  runMigrations(testDb)
})

describe('reports-store', () => {
  it('creates a report and retrieves it', () => {
    const c = createCase(testDb, { status: 'active' })
    const r = createReport(testDb, {
      case_id: c.id,
      sections: { '1': 'Header content', '3': 'Summary content' },
      figures: [],
      source_path: '/nas/reports/colo829.md',
    })
    expect(r.status).toBe('draft')
    expect(r.sections['1']).toBe('Header content')

    const found = getLatestReport(testDb, c.id)
    expect(found?.id).toBe(r.id)
  })

  it('patches a single section', () => {
    const c = createCase(testDb, { status: 'active' })
    const r = createReport(testDb, { case_id: c.id, sections: { '1': 'old' }, figures: [] })
    const updated = patchSection(testDb, r.id, '1', 'new content')
    expect(updated?.sections['1']).toBe('new content')
  })

  it('signs a report and locks it', () => {
    const c = createCase(testDb, { status: 'active' })
    const r = createReport(testDb, { case_id: c.id, sections: {}, figures: [] })
    const signed = signReport(testDb, r.id, 'dr.smith')
    expect(signed?.status).toBe('signed')
    expect(signed?.signed_by).toBe('dr.smith')
    expect(signed?.signed_at).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
pnpm test src/server/genomics/reports-store.test.ts
```

- [ ] **Step 3: Write `reports-store.ts`**

```typescript
// src/server/genomics/reports-store.ts
import { randomUUID } from 'node:crypto'
import type Database from 'better-sqlite3'
import { db as defaultDb } from './db'
import type { Report, ReportFigure } from './types'

type CreateReportInput = {
  case_id: string
  protocol_id?: string
  protocol_version?: string
  sections: Record<string, string>
  figures: ReportFigure[]
  source_path?: string
}

function deserializeReport(row: Record<string, unknown>): Report {
  return {
    ...row,
    sections: JSON.parse(row.sections as string),
    figures: JSON.parse(row.figures as string),
  } as Report
}

export function getLatestReport(db: Database.Database = defaultDb, caseId: string): Report | null {
  const row = db.prepare(
    'SELECT * FROM reports WHERE case_id = ? ORDER BY version DESC LIMIT 1'
  ).get(caseId) as Record<string, unknown> | undefined
  return row ? deserializeReport(row) : null
}

export function getReport(db: Database.Database = defaultDb, id: string): Report | null {
  const row = db.prepare('SELECT * FROM reports WHERE id = ?').get(id) as Record<string, unknown> | undefined
  return row ? deserializeReport(row) : null
}

export function createReport(db: Database.Database = defaultDb, input: CreateReportInput): Report {
  const id = randomUUID()
  const now = Date.now()
  db.prepare(`
    INSERT INTO reports (id, case_id, protocol_id, protocol_version, version, status, sections, figures, source_path, created_at, updated_at)
    VALUES (?, ?, ?, ?, 1, 'draft', ?, ?, ?, ?, ?)
  `).run(
    id, input.case_id, input.protocol_id ?? null, input.protocol_version ?? null,
    JSON.stringify(input.sections), JSON.stringify(input.figures),
    input.source_path ?? null, now, now,
  )
  return getReport(db, id)!
}

export function patchSection(
  db: Database.Database = defaultDb,
  reportId: string,
  sectionKey: string,
  content: string,
): Report | null {
  const report = getReport(db, reportId)
  if (!report || report.status === 'signed') return report
  const sections = { ...report.sections, [sectionKey]: content }
  db.prepare('UPDATE reports SET sections = ?, updated_at = ? WHERE id = ?')
    .run(JSON.stringify(sections), Date.now(), reportId)
  return getReport(db, reportId)
}

export function signReport(
  db: Database.Database = defaultDb,
  reportId: string,
  signedBy: string,
): Report | null {
  const now = Date.now()
  db.prepare(
    'UPDATE reports SET status = ?, signed_by = ?, signed_at = ?, updated_at = ? WHERE id = ?'
  ).run('signed', signedBy, now, now, reportId)
  return getReport(db, reportId)
}

export function upsertReportFromFile(
  db: Database.Database = defaultDb,
  caseId: string,
  sourcePath: string,
  sections: Record<string, string>,
  figures: ReportFigure[],
  protocolId?: string,
  protocolVersion?: string,
): Report {
  const existing = getLatestReport(db, caseId)
  if (existing && existing.status === 'draft') {
    db.prepare('UPDATE reports SET sections = ?, figures = ?, source_path = ?, updated_at = ? WHERE id = ?')
      .run(JSON.stringify(sections), JSON.stringify(figures), sourcePath, Date.now(), existing.id)
    return getReport(db, existing.id)!
  }
  return createReport(db, { case_id: caseId, protocol_id: protocolId, protocol_version: protocolVersion, sections, figures, source_path: sourcePath })
}
```

- [ ] **Step 4: Run test — expect PASS**

```bash
pnpm test src/server/genomics/reports-store.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/server/genomics/reports-store.ts src/server/genomics/reports-store.test.ts
git commit -m "feat: reports-store with section patching and signing"
```

---

### Task 8: report-watcher

**Files:**
- Create: `src/server/genomics/report-watcher.ts`
- Create: `src/server/genomics/report-watcher.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/server/genomics/report-watcher.test.ts
import { describe, it, expect } from 'vitest'
import { parseMarkdownReport } from './report-watcher'

const SAMPLE_REPORT = `
# Molecular Pathology and Precision Oncology Report

## 1. Header / Specimen Information

Sample ID: COLO829
Report Date: May 19, 2026

## 2. Test Methodology and Limitations

Pipeline: FASTQ -> BWA-MEM -> Mutect2

## 3. Results Summary

COLO829 demonstrates a hypermutated profile.

- BRAF V600E (Tier I)

## 4. Tier I - Variants of Strong Clinical Significance

BRAF p.V600E

![Mutational Signature Decomposition](/nas/reports/figures/sig.png)

## 5. Tier II - Variants of Potential Clinical Significance

TERT Promoter C228T
`

describe('parseMarkdownReport', () => {
  it('extracts sections by heading number', () => {
    const { sections, figures } = parseMarkdownReport(SAMPLE_REPORT)
    expect(sections['1']).toContain('Sample ID: COLO829')
    expect(sections['2']).toContain('BWA-MEM')
    expect(sections['3']).toContain('BRAF V600E')
    expect(sections['4']).toContain('BRAF p.V600E')
    expect(sections['5']).toContain('TERT')
  })

  it('extracts figures with path and caption', () => {
    const { figures } = parseMarkdownReport(SAMPLE_REPORT)
    expect(figures).toHaveLength(1)
    expect(figures[0].path).toBe('/nas/reports/figures/sig.png')
    expect(figures[0].caption).toBe('Mutational Signature Decomposition')
    expect(figures[0].section).toBe('4')
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
pnpm test src/server/genomics/report-watcher.test.ts
```

- [ ] **Step 3: Write `report-watcher.ts`**

```typescript
// src/server/genomics/report-watcher.ts
import { watch } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join, extname } from 'node:path'
import type { ReportFigure } from './types'

export interface ParsedReport {
  sections: Record<string, string>
  figures: ReportFigure[]
}

export function parseMarkdownReport(markdown: string): ParsedReport {
  const sections: Record<string, string> = {}
  const figures: ReportFigure[] = []

  // Split on ## N. headings (1–12)
  const sectionRegex = /^## (\d+)\./m
  const parts = markdown.split(/(?=^## \d+\.)/m)

  let currentSection = ''
  for (const part of parts) {
    const match = part.match(sectionRegex)
    if (match) {
      currentSection = match[1]
      const body = part.replace(/^## \d+\.[^\n]*\n/, '').trim()
      sections[currentSection] = body

      // Extract figures within this section
      const figureRegex = /!\[([^\]]*)\]\(([^)]+)\)/g
      let fig: RegExpExecArray | null
      while ((fig = figureRegex.exec(body)) !== null) {
        figures.push({ caption: fig[1], path: fig[2], section: currentSection })
      }
    }
  }

  return { sections, figures }
}

export function startReportWatcher(
  watchPath: string,
  onReport: (filePath: string, parsed: ParsedReport) => void,
): () => void {
  const watcher = watch(watchPath, { recursive: false }, async (event, filename) => {
    if (!filename || extname(filename) !== '.md') return
    const filePath = join(watchPath, filename)
    try {
      const content = await readFile(filePath, 'utf8')
      const parsed = parseMarkdownReport(content)
      if (Object.keys(parsed.sections).length > 0) {
        onReport(filePath, parsed)
      }
    } catch {
      // file may have been deleted or not yet fully written — ignore
    }
  })
  return () => watcher.close()
}
```

- [ ] **Step 4: Run test — expect PASS**

```bash
pnpm test src/server/genomics/report-watcher.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/server/genomics/report-watcher.ts src/server/genomics/report-watcher.test.ts
git commit -m "feat: report-watcher markdown parser and fs.watch integration"
```

---

### Task 9: API routes — Cases

**Files:**
- Create: `src/routes/api/genomics/cases.ts`
- Create: `src/routes/api/genomics/cases.$caseId.ts`

- [ ] **Step 1: Write `cases.ts` (list + create)**

```typescript
// src/routes/api/genomics/cases.ts
import { createFileRoute } from '@tanstack/react-router'
import { requireLocalOrAuth } from '../../../server/auth-middleware'
import { listCases, createCase } from '../../../server/genomics/cases-store'

export const Route = createFileRoute('/api/genomics/cases')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!requireLocalOrAuth(request)) return Response.json({ error: 'Unauthorized' }, { status: 401 })
        return Response.json({ cases: listCases() })
      },
      POST: async ({ request }) => {
        if (!requireLocalOrAuth(request)) return Response.json({ error: 'Unauthorized' }, { status: 401 })
        const body = await request.json() as Parameters<typeof createCase>[1]
        const c = createCase(undefined, body)
        return Response.json({ case: c }, { status: 201 })
      },
    },
  },
})
```

- [ ] **Step 2: Write `cases.$caseId.ts` (get + update)**

```typescript
// src/routes/api/genomics/cases.$caseId.ts
import { createFileRoute } from '@tanstack/react-router'
import { requireLocalOrAuth } from '../../../server/auth-middleware'
import { getCase, updateCase, listSamples, addSample } from '../../../server/genomics/cases-store'

export const Route = createFileRoute('/api/genomics/cases/$caseId')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        if (!requireLocalOrAuth(request)) return Response.json({ error: 'Unauthorized' }, { status: 401 })
        const c = getCase(undefined, params.caseId)
        if (!c) return Response.json({ error: 'Not found' }, { status: 404 })
        const samples = listSamples(undefined, params.caseId)
        return Response.json({ case: c, samples })
      },
      PUT: async ({ request, params }) => {
        if (!requireLocalOrAuth(request)) return Response.json({ error: 'Unauthorized' }, { status: 401 })
        const body = await request.json() as Record<string, unknown>
        const updated = updateCase(undefined, params.caseId, body as Parameters<typeof updateCase>[2])
        if (!updated) return Response.json({ error: 'Not found' }, { status: 404 })
        return Response.json({ case: updated })
      },
    },
  },
})
```

- [ ] **Step 3: Verify dev server starts without errors**

```bash
pnpm dev
```

Open `http://localhost:3000/api/genomics/cases` — expect `{"cases":[]}` (empty array, not a 500).

- [ ] **Step 4: Commit**

```bash
git add src/routes/api/genomics/
git commit -m "feat: genomics cases API routes"
```

---

### Task 10: API routes — Runs + SSE log

**Files:**
- Create: `src/routes/api/genomics/runs.ts`
- Create: `src/routes/api/genomics/runs.$runId.ts`
- Create: `src/routes/api/genomics/runs.$runId.log.ts`
- Create: `src/routes/api/genomics/runs.$runId.link.$caseId.ts`

- [ ] **Step 1: Write `runs.ts`**

```typescript
// src/routes/api/genomics/runs.ts
import { createFileRoute } from '@tanstack/react-router'
import { requireLocalOrAuth } from '../../../server/auth-middleware'
import { listRuns, createRun } from '../../../server/genomics/runs-store'

export const Route = createFileRoute('/api/genomics/runs')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!requireLocalOrAuth(request)) return Response.json({ error: 'Unauthorized' }, { status: 401 })
        return Response.json({ runs: listRuns() })
      },
      POST: async ({ request }) => {
        if (!requireLocalOrAuth(request)) return Response.json({ error: 'Unauthorized' }, { status: 401 })
        const body = await request.json() as Parameters<typeof createRun>[1]
        const r = createRun(undefined, body)
        return Response.json({ run: r }, { status: 201 })
      },
    },
  },
})
```

- [ ] **Step 2: Write `runs.$runId.ts`**

```typescript
// src/routes/api/genomics/runs.$runId.ts
import { createFileRoute } from '@tanstack/react-router'
import { requireLocalOrAuth } from '../../../server/auth-middleware'
import { getRun, updateRun, listStages } from '../../../server/genomics/runs-store'

export const Route = createFileRoute('/api/genomics/runs/$runId')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        if (!requireLocalOrAuth(request)) return Response.json({ error: 'Unauthorized' }, { status: 401 })
        const r = getRun(undefined, params.runId)
        if (!r) return Response.json({ error: 'Not found' }, { status: 404 })
        const stages = listStages(undefined, params.runId)
        return Response.json({ run: r, stages })
      },
      PUT: async ({ request, params }) => {
        if (!requireLocalOrAuth(request)) return Response.json({ error: 'Unauthorized' }, { status: 401 })
        const body = await request.json() as Parameters<typeof updateRun>[2]
        const updated = updateRun(undefined, params.runId, body)
        if (!updated) return Response.json({ error: 'Not found' }, { status: 404 })
        return Response.json({ run: updated })
      },
    },
  },
})
```

- [ ] **Step 3: Write `runs.$runId.log.ts` (SSE stream of log_tail)**

```typescript
// src/routes/api/genomics/runs.$runId.log.ts
import { createFileRoute } from '@tanstack/react-router'
import { requireLocalOrAuth } from '../../../server/auth-middleware'
import { listStages } from '../../../server/genomics/runs-store'

export const Route = createFileRoute('/api/genomics/runs/$runId/log')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        if (!requireLocalOrAuth(request)) return Response.json({ error: 'Unauthorized' }, { status: 401 })
        const encoder = new TextEncoder()
        const stream = new ReadableStream({
          start(controller) {
            const send = (data: string) =>
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ line: data })}\n\n`))

            // Send current log_tail immediately
            const stages = listStages(undefined, params.runId)
            for (const stage of stages) {
              if (stage.log_tail) {
                for (const line of stage.log_tail.split('\n')) send(line)
              }
            }

            // Poll every 2s for new log lines
            const interval = setInterval(() => {
              const updated = listStages(undefined, params.runId)
              for (const stage of updated) {
                if (stage.log_tail) {
                  const lines = stage.log_tail.split('\n')
                  send(lines[lines.length - 1] ?? '')
                }
              }
            }, 2000)

            request.signal.addEventListener('abort', () => {
              clearInterval(interval)
              controller.close()
            })
          },
        })

        return new Response(stream, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
          },
        })
      },
    },
  },
})
```

- [ ] **Step 4: Write `runs.$runId.link.$caseId.ts`**

```typescript
// src/routes/api/genomics/runs.$runId.link.$caseId.ts
import { createFileRoute } from '@tanstack/react-router'
import { requireLocalOrAuth } from '../../../server/auth-middleware'
import { linkRunToCase } from '../../../server/genomics/runs-store'

export const Route = createFileRoute('/api/genomics/runs/$runId/link/$caseId')({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        if (!requireLocalOrAuth(request)) return Response.json({ error: 'Unauthorized' }, { status: 401 })
        linkRunToCase(undefined, params.runId, params.caseId)
        return Response.json({ ok: true })
      },
    },
  },
})
```

- [ ] **Step 5: Verify dev server starts, test case endpoint**

```bash
pnpm dev
# In another terminal:
curl http://localhost:3000/api/genomics/runs
# expect: {"runs":[]}
```

- [ ] **Step 6: Commit**

```bash
git add src/routes/api/genomics/runs.ts src/routes/api/genomics/runs.$runId.ts src/routes/api/genomics/runs.$runId.log.ts src/routes/api/genomics/runs.$runId.link.$caseId.ts
git commit -m "feat: genomics runs API routes with SSE log"
```

---

### Task 11: API routes — Protocols

**Files:**
- Create: `src/routes/api/genomics/protocols.ts`
- Create: `src/routes/api/genomics/protocols.$protocolId.ts`
- Create: `src/routes/api/genomics/protocols.$protocolId.preview.ts`

- [ ] **Step 1: Write `protocols.ts`**

```typescript
// src/routes/api/genomics/protocols.ts
import { createFileRoute } from '@tanstack/react-router'
import { requireLocalOrAuth } from '../../../server/auth-middleware'
import { listProtocols, createProtocol } from '../../../server/genomics/protocols-store'

export const Route = createFileRoute('/api/genomics/protocols')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!requireLocalOrAuth(request)) return Response.json({ error: 'Unauthorized' }, { status: 401 })
        const url = new URL(request.url)
        const assay_type = url.searchParams.get('assay_type') ?? undefined
        return Response.json({ protocols: listProtocols(undefined, { assay_type }) })
      },
      POST: async ({ request }) => {
        if (!requireLocalOrAuth(request)) return Response.json({ error: 'Unauthorized' }, { status: 401 })
        const body = await request.json() as Parameters<typeof createProtocol>[1]
        const p = createProtocol(undefined, body)
        return Response.json({ protocol: p }, { status: 201 })
      },
    },
  },
})
```

- [ ] **Step 2: Write `protocols.$protocolId.ts`**

```typescript
// src/routes/api/genomics/protocols.$protocolId.ts
import { createFileRoute } from '@tanstack/react-router'
import { requireLocalOrAuth } from '../../../server/auth-middleware'
import { getProtocol, updateProtocol } from '../../../server/genomics/protocols-store'

export const Route = createFileRoute('/api/genomics/protocols/$protocolId')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        if (!requireLocalOrAuth(request)) return Response.json({ error: 'Unauthorized' }, { status: 401 })
        const p = getProtocol(undefined, params.protocolId)
        if (!p) return Response.json({ error: 'Not found' }, { status: 404 })
        return Response.json({ protocol: p })
      },
      PUT: async ({ request, params }) => {
        if (!requireLocalOrAuth(request)) return Response.json({ error: 'Unauthorized' }, { status: 401 })
        const body = await request.json() as Parameters<typeof updateProtocol>[2]
        const updated = updateProtocol(undefined, params.protocolId, body)
        if (!updated) return Response.json({ error: 'Not found' }, { status: 404 })
        return Response.json({ protocol: updated })
      },
    },
  },
})
```

- [ ] **Step 3: Write `protocols.$protocolId.preview.ts`**

```typescript
// src/routes/api/genomics/protocols.$protocolId.preview.ts
import { createFileRoute } from '@tanstack/react-router'
import { requireLocalOrAuth } from '../../../server/auth-middleware'
import { getProtocol, renderTemplate, resolveVariables } from '../../../server/genomics/protocols-store'
import { getCase } from '../../../server/genomics/cases-store'

export const Route = createFileRoute('/api/genomics/protocols/$protocolId/preview')({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        if (!requireLocalOrAuth(request)) return Response.json({ error: 'Unauthorized' }, { status: 401 })
        const body = await request.json() as { case_id?: string; overrides?: Record<string, string> }
        const protocol = getProtocol(undefined, params.protocolId)
        if (!protocol) return Response.json({ error: 'Not found' }, { status: 404 })
        const caseData = body.case_id ? (getCase(undefined, body.case_id) ?? {}) : {}
        const vars = resolveVariables(protocol, caseData as Record<string, unknown>, body.overrides ?? {})
        const rendered = renderTemplate(protocol.prompt_template, vars)
        return Response.json({ rendered, vars })
      },
    },
  },
})
```

- [ ] **Step 4: Commit**

```bash
git add src/routes/api/genomics/protocols.ts src/routes/api/genomics/protocols.$protocolId.ts src/routes/api/genomics/protocols.$protocolId.preview.ts
git commit -m "feat: genomics protocols API routes"
```

---

### Task 12: API routes — Reports (get, patch, sign, generate, export-pdf)

**Files:**
- Create: `src/routes/api/genomics/cases.$caseId.report.ts`
- Create: `src/routes/api/genomics/cases.$caseId.report.generate.ts`
- Create: `src/routes/api/genomics/cases.$caseId.report.export-pdf.ts`

- [ ] **Step 1: Write `cases.$caseId.report.ts`**

```typescript
// src/routes/api/genomics/cases.$caseId.report.ts
import { createFileRoute } from '@tanstack/react-router'
import { requireLocalOrAuth } from '../../../server/auth-middleware'
import { getLatestReport, patchSection, signReport } from '../../../server/genomics/reports-store'

export const Route = createFileRoute('/api/genomics/cases/$caseId/report')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        if (!requireLocalOrAuth(request)) return Response.json({ error: 'Unauthorized' }, { status: 401 })
        const report = getLatestReport(undefined, params.caseId)
        return Response.json({ report })
      },
      // PATCH a single section: body = { section: "8", content: "..." }
      PUT: async ({ request, params }) => {
        if (!requireLocalOrAuth(request)) return Response.json({ error: 'Unauthorized' }, { status: 401 })
        const body = await request.json() as { section: string; content: string; signed_by?: string; action?: string }
        const report = getLatestReport(undefined, params.caseId)
        if (!report) return Response.json({ error: 'No report found' }, { status: 404 })

        if (body.action === 'sign') {
          const signed = signReport(undefined, report.id, body.signed_by ?? 'unknown')
          return Response.json({ report: signed })
        }

        const updated = patchSection(undefined, report.id, body.section, body.content)
        return Response.json({ report: updated })
      },
    },
  },
})
```

- [ ] **Step 2: Write `cases.$caseId.report.generate.ts`**

**Note on dispatch path:** the workspace gateway WebSocket has no `sessions.send_message` RPC — chat messages flow through the HTTP route `/api/send-stream` (see `src/routes/api/send-stream.ts`). This handler dispatches by POSTing to that route internally, with a `genomics-case-<caseId>` session key so the Report & Review tab's chat panel can later attach to the same conversation. We fire-and-forget the request (agent runs may take minutes); the `report-watcher` upserts the resulting markdown when it lands on disk.

```typescript
// src/routes/api/genomics/cases.$caseId.report.generate.ts
import { createFileRoute } from '@tanstack/react-router'
import { requireLocalOrAuth } from '../../../server/auth-middleware'
import { getCase } from '../../../server/genomics/cases-store'
import { getProtocol, resolveVariables, renderTemplate } from '../../../server/genomics/protocols-store'

export const Route = createFileRoute('/api/genomics/cases/$caseId/report/generate')({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        if (!requireLocalOrAuth(request)) return Response.json({ error: 'Unauthorized' }, { status: 401 })
        const body = await request.json() as { protocol_id: string; overrides?: Record<string, string> }

        const caseRecord = getCase(undefined, params.caseId)
        if (!caseRecord) return Response.json({ error: 'Case not found' }, { status: 404 })

        const protocol = getProtocol(undefined, body.protocol_id)
        if (!protocol) return Response.json({ error: 'Protocol not found' }, { status: 404 })

        const vars = resolveVariables(protocol, caseRecord as unknown as Record<string, unknown>, body.overrides ?? {})
        const prompt = renderTemplate(protocol.prompt_template, vars)

        // Dispatch via the workspace chat pipeline. The agent executes the
        // Protocol's skills and writes the markdown report to
        // GENOMICS_REPORT_WATCH_PATH; report-watcher upserts it into the
        // reports table. Fire-and-forget — runs can take several minutes.
        const sessionKey = `genomics-case-${params.caseId}`
        const sendStreamUrl = new URL('/api/send-stream', request.url)
        const cookie = request.headers.get('cookie') ?? ''
        const authHeader = request.headers.get('authorization') ?? ''

        void fetch(sendStreamUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(cookie ? { cookie } : {}),
            ...(authHeader ? { authorization: authHeader } : {}),
          },
          body: JSON.stringify({
            message: prompt,
            sessionKey,
            friendlyId: sessionKey,
          }),
        }).catch((err) => {
          console.error('[genomics generate] dispatch failed:', err)
        })

        return Response.json({
          ok: true,
          prompt_length: prompt.length,
          session_key: sessionKey,
        })
      },
    },
  },
})
```

- [ ] **Step 3: Write `cases.$caseId.report.export-pdf.ts`**

```typescript
// src/routes/api/genomics/cases.$caseId.report.export-pdf.ts
import { createFileRoute } from '@tanstack/react-router'
import { requireLocalOrAuth } from '../../../server/auth-middleware'
import { getLatestReport } from '../../../server/genomics/reports-store'
import { getCase } from '../../../server/genomics/cases-store'
import puppeteer from 'puppeteer'

function buildReportHtml(caseRecord: { patient_name?: string | null }, sections: Record<string, string>): string {
  const sectionLabels: Record<string, string> = {
    '1': 'Header / Specimen Information', '2': 'Test Methodology and Limitations',
    '3': 'Results Summary', '4': 'Tier I — Variants of Strong Clinical Significance',
    '5': 'Tier II — Variants of Potential Clinical Significance', '6': 'Biomarker Signatures',
    '7': 'Tier III — Variants of Uncertain Significance (VUS)', '8': 'Therapy Recommendations',
    '9': 'Matched Clinical Trials', '10': 'Methodology Appendix',
    '11': 'References', '12': 'Disclaimers',
  }
  const body = Object.entries(sections)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([k, v]) => `<section><h2>${k}. ${sectionLabels[k] ?? ''}</h2><div>${v.replace(/\n/g, '<br>')}</div></section>`)
    .join('')
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    body{font-family:Helvetica,Arial,sans-serif;font-size:14px;line-height:22px;color:#2c2c35;padding:40px}
    h1{font-size:22px;text-align:center}h2{font-size:16px;border-bottom:1px solid #ccc;padding-bottom:4px;margin-top:24px}
    section{margin-bottom:16px}
  </style></head><body>
  <h1>Molecular Pathology and Precision Oncology Report</h1>
  <p style="text-align:center;color:red;font-style:italic">RESEARCH USE ONLY — NOT FOR CLINICAL DECISION-MAKING</p>
  ${body}
  </body></html>`
}

export const Route = createFileRoute('/api/genomics/cases/$caseId/report/export-pdf')({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        if (!requireLocalOrAuth(request)) return Response.json({ error: 'Unauthorized' }, { status: 401 })
        const report = getLatestReport(undefined, params.caseId)
        if (!report) return Response.json({ error: 'No report found' }, { status: 404 })
        const caseRecord = getCase(undefined, params.caseId)

        const html = buildReportHtml(caseRecord ?? {}, report.sections)
        const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
        const page = await browser.newPage()
        await page.setContent(html, { waitUntil: 'networkidle0' })
        const pdfBuffer = await page.pdf({ format: 'A4', margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' } })
        await browser.close()

        return new Response(pdfBuffer, {
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="report-${params.caseId}.pdf"`,
          },
        })
      },
    },
  },
})
```

- [ ] **Step 4: Run all existing tests to confirm no regressions**

```bash
pnpm test
```

Expected: all pre-existing tests pass; new store tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/routes/api/genomics/cases.$caseId.report.ts src/routes/api/genomics/cases.$caseId.report.generate.ts src/routes/api/genomics/cases.$caseId.report.export-pdf.ts
git commit -m "feat: report API routes — get, patch, sign, generate, export-pdf"
```

---

**Phase 1 complete.** The full server-side foundation — SQLite schema, store layer, report watcher, and all API routes — is in place and tested. Move to Phase 2 (navigation shell + screens).
