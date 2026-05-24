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
