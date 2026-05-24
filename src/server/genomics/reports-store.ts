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
