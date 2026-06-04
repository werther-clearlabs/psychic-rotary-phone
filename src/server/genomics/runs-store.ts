import { randomUUID } from 'node:crypto'
import type Database from 'better-sqlite3'
import { db as defaultDb } from './db'
import type { Run, RunConfig, RunStage, RunStatus, StageStatus } from './types'

const UPDATABLE_RUN_FIELDS = new Set<keyof Run>([
  'name', 'pipeline', 'reference', 'fastq_path', 'output_path', 'status', 'pbrun_command',
  'run_config', 'output_dir', 'log_dir', 'num_gpus', 'case_id',
])

const UPDATABLE_STAGE_FIELDS = new Set<keyof RunStage>([
  'status', 'started_at', 'finished_at', 'log_tail', 'log_file_path',
])

type CreateRunInput = Partial<Omit<Run, 'id' | 'created_at' | 'updated_at'>> &
  Pick<Run, 'name' | 'pipeline' | 'status'>

export function getRunConfig(run: Run): RunConfig | null {
  if (!run.run_config) return null
  try { return JSON.parse(run.run_config) as RunConfig } catch { return null }
}

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
    INSERT INTO runs (
      id, name, pipeline, reference, fastq_path, output_path, status, pbrun_command,
      run_config, output_dir, log_dir, num_gpus, case_id,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, input.name, input.pipeline, input.reference ?? null,
    input.fastq_path ?? null, input.output_path ?? null,
    input.status, input.pbrun_command ?? null,
    input.run_config ?? null, input.output_dir ?? null, input.log_dir ?? null,
    input.num_gpus ?? 1, input.case_id ?? null,
    now, now,
  )
  return getRun(db, id)!
}

export function updateRun(
  db: Database.Database = defaultDb,
  id: string,
  patch: Partial<Omit<Run, 'id' | 'created_at' | 'updated_at'>>,
): Run | null {
  const fields = (Object.keys(patch) as (keyof typeof patch)[]).filter(
    (f) => UPDATABLE_RUN_FIELDS.has(f as keyof Run),
  )
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
    const fields = (Object.keys(patch) as (keyof typeof patch)[]).filter(
      (f) => UPDATABLE_STAGE_FIELDS.has(f as keyof RunStage),
    )
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
