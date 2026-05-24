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
