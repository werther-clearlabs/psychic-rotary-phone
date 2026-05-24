import { randomUUID } from 'node:crypto'
import type Database from 'better-sqlite3'
import { db as defaultDb } from './db'
import type { Case, CaseSample } from './types'

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
