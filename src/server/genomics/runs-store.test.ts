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
