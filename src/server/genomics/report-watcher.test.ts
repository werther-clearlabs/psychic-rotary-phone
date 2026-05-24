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
