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

// `getProtocol` is imported as part of the test surface even though it isn't called directly
void getProtocol
