// src/screens/genomics/components/report-canvas.tsx
import { useState, useCallback, useRef, useEffect } from 'react'
import MonacoEditor from '@monaco-editor/react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useGenomicsStore } from '../../../stores/genomics-store'
import type { Report, ReportFigure } from '../../../server/genomics/types'

const SECTION_LABELS: Record<string, string> = {
  '1': 'Header / Specimen',
  '2': 'Test Methodology',
  '3': 'Results Summary',
  '4': 'Tier I Variants',
  '5': 'Tier II Variants',
  '6': 'Biomarker Signatures',
  '7': 'Tier III / VUS',
  '8': 'Therapy Recommendations',
  '9': 'Clinical Trials',
  '10': 'Methodology Appendix',
  '11': 'References',
  '12': 'Disclaimers',
}

async function patchSection(caseId: string, section: string, content: string): Promise<void> {
  const res = await fetch(`/api/genomics/cases/${caseId}/report`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ section, content }),
  })
  if (!res.ok) throw new Error('Failed to save section')
}

async function signReport(caseId: string, signedBy: string): Promise<void> {
  const res = await fetch(`/api/genomics/cases/${caseId}/report`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'sign', signed_by: signedBy }),
  })
  if (!res.ok) throw new Error('Failed to sign report')
}

async function exportPdf(caseId: string): Promise<void> {
  const res = await fetch(`/api/genomics/cases/${caseId}/report/export-pdf`, { method: 'POST' })
  if (!res.ok) throw new Error('Export failed')
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `report-${caseId}.pdf`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 100)
}

interface Props {
  report: Report
  caseId: string
}

export function ReportCanvas({ report, caseId }: Props) {
  const [activeSection, setActiveSection] = useState<string>('1')
  const [signerName, setSignerName] = useState('')
  const [showSignDialog, setShowSignDialog] = useState(false)
  const { editingSection, setEditingSection } = useGenomicsStore()
  const qc = useQueryClient()
  const signed = report.status === 'signed'

  const patchMutation = useMutation({
    mutationFn: ({ section, content }: { section: string; content: string }) =>
      patchSection(caseId, section, content),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['genomics', 'case', caseId, 'report'] }),
  })

  const signMutation = useMutation({
    mutationFn: () => signReport(caseId, signerName || 'Clinician'),
    onSuccess: () => {
      setShowSignDialog(false)
      qc.invalidateQueries({ queryKey: ['genomics', 'case', caseId, 'report'] })
    },
  })

  const exportMutation = useMutation({ mutationFn: () => exportPdf(caseId) })

  const patchMutationRef = useRef(patchMutation)
  useEffect(() => {
    patchMutationRef.current = patchMutation
  })

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  const handleEditorChange = useCallback(
    (value: string | undefined) => {
      if (!editingSection || value === undefined) return
      if (debounceRef.current) clearTimeout(debounceRef.current)
      const sectionKey = editingSection
      debounceRef.current = setTimeout(() => {
        patchMutationRef.current.mutate({ section: sectionKey, content: value })
      }, 400)
    },
    [editingSection],
  )

  const sectionKeys = Object.keys(SECTION_LABELS)
  const figures = report.figures as ReportFigure[]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Toolbar */}
      <div style={{
        padding: '8px 16px', borderBottom: '1px solid var(--gray-200)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: '#fff', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {signed && (
            <span style={{ background: 'var(--color-green-100)', color: 'var(--color-green-600)', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 3, textTransform: 'uppercase', letterSpacing: '0.44px' }}>
              SIGNED · {report.signed_by}
            </span>
          )}
          {report.protocol_version && (
            <span style={{ fontSize: 11, color: 'var(--gray-600)' }}>
              Protocol v{report.protocol_version}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => exportMutation.mutate()}
            disabled={exportMutation.isPending}
            style={{ padding: '5px 12px', borderRadius: 3, fontSize: 11, fontWeight: 700, border: '1px solid var(--brand-500)', color: 'var(--brand-500)', background: 'none', cursor: 'pointer' }}
          >
            {exportMutation.isPending ? 'Exporting…' : 'Export PDF'}
          </button>
          {!signed && (
            <button
              onClick={() => setShowSignDialog(true)}
              style={{ padding: '5px 12px', borderRadius: 3, fontSize: 11, fontWeight: 700, background: 'var(--brand-500)', color: '#fff', border: 'none', cursor: 'pointer' }}
            >
              Sign & Finalize
            </button>
          )}
        </div>
      </div>

      {/* Section nav pills */}
      <div style={{
        padding: '8px 16px', borderBottom: '1px solid var(--gray-200)',
        display: 'flex', gap: 4, flexWrap: 'wrap', background: '#fafafa', flexShrink: 0,
      }}>
        {sectionKeys.map((k) => (
          <button
            key={k}
            onClick={() => setActiveSection(k)}
            style={{
              padding: '3px 10px', borderRadius: 12, fontSize: 10, fontWeight: 700,
              border: `1px solid ${activeSection === k ? 'var(--brand-500)' : 'var(--gray-200)'}`,
              background: activeSection === k ? 'var(--brand-500)' : '#fff',
              color: activeSection === k ? '#fff' : 'var(--gray-700)',
              cursor: 'pointer',
            }}
          >
            §{k}
          </button>
        ))}
      </div>

      {/* Section content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {sectionKeys.map((k) => {
          if (k !== activeSection) return null
          const content = (report.sections as Record<string, string>)[k] ?? ''
          const sectionFigures = figures.filter((f) => f.section === k)
          const isEditing = editingSection === k

          return (
            <div key={k}>
              {/* Section header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div>
                  <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.44px', color: 'var(--gray-600)' }}>
                    Section {k}
                  </span>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--gray-900)' }}>
                    {SECTION_LABELS[k]}
                  </h3>
                </div>
                {!signed && (
                  <button
                    onClick={() => setEditingSection(isEditing ? null : k)}
                    style={{
                      padding: '4px 12px', borderRadius: 3, fontSize: 11, fontWeight: 700,
                      border: `1px solid ${isEditing ? 'var(--gray-400)' : 'var(--brand-500)'}`,
                      color: isEditing ? 'var(--gray-600)' : 'var(--brand-500)',
                      background: 'none', cursor: 'pointer',
                    }}
                  >
                    {isEditing ? 'Close Editor' : 'Edit'}
                  </button>
                )}
              </div>

              {/* Editor or read view */}
              {isEditing ? (
                <div style={{ border: '1px solid var(--brand-200)', borderRadius: 4, overflow: 'hidden', height: 400 }}>
                  <MonacoEditor
                    height="400px"
                    defaultLanguage="markdown"
                    value={content}
                    onChange={handleEditorChange}
                    options={{
                      minimap: { enabled: false },
                      wordWrap: 'on',
                      lineNumbers: 'off',
                      scrollBeyondLastLine: false,
                      theme: 'vs',
                      fontSize: 13,
                    }}
                  />
                </div>
              ) : (
                <div style={{
                  background: '#fff', border: '1px solid var(--gray-200)', borderRadius: 4,
                  padding: 16, fontSize: 14, lineHeight: '22px', color: 'var(--gray-900)',
                  whiteSpace: 'pre-wrap', minHeight: 120,
                }}>
                  {content || <span style={{ color: 'var(--gray-400)', fontStyle: 'italic' }}>No content for this section.</span>}
                </div>
              )}

              {/* Figures for this section */}
              {sectionFigures.map((fig, i) => (
                <div key={i} style={{ marginTop: 16, border: '1px solid var(--gray-200)', borderRadius: 4, overflow: 'hidden' }}>
                  <img
                    src={`/api/genomics/figure?path=${encodeURIComponent(fig.path)}`}
                    alt={fig.caption}
                    style={{ maxWidth: '100%', display: 'block' }}
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                  />
                  {fig.caption && (
                    <div style={{ padding: '6px 12px', fontSize: 11, color: 'var(--gray-600)', background: '#fafafa', borderTop: '1px solid var(--gray-200)' }}>
                      {fig.caption}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
        })}
      </div>

      {/* Sign dialog */}
      {showSignDialog && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1100,
          background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{ background: '#fff', borderRadius: 5, padding: 24, width: 360, boxShadow: '0 6px 16px rgba(0,0,0,0.18)', fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 700, color: 'var(--gray-900)' }}>Sign & Finalize Report</h3>
            <p style={{ fontSize: 13, color: 'var(--gray-700)', marginBottom: 16 }}>
              This will lock all sections. Enter your name to confirm.
            </p>
            <input
              type="text"
              placeholder="Your name"
              value={signerName}
              onChange={(e) => setSignerName(e.target.value)}
              style={{ width: '100%', boxSizing: 'border-box', border: '1px solid var(--gray-300)', borderRadius: 3, padding: '8px 10px', fontSize: 13, marginBottom: 12 }}
            />
            <p style={{ fontSize: 10, color: 'var(--color-red-500)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.44px', marginBottom: 16 }}>
              RESEARCH USE ONLY — NOT FOR CLINICAL DECISION-MAKING
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                onClick={() => setShowSignDialog(false)}
                style={{ padding: '6px 14px', borderRadius: 3, fontSize: 11, fontWeight: 700, border: '1px solid var(--gray-300)', background: 'none', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                disabled={!signerName.trim() || signMutation.isPending}
                onClick={() => signMutation.mutate()}
                style={{
                  padding: '6px 14px', borderRadius: 3, fontSize: 11, fontWeight: 700,
                  background: !signerName.trim() ? 'var(--gray-400)' : 'var(--brand-500)',
                  color: '#fff', border: 'none',
                  cursor: !signerName.trim() ? 'not-allowed' : 'pointer',
                }}
              >
                {signMutation.isPending ? 'Signing…' : 'Sign Report'}
              </button>
            </div>
            {signMutation.error && (
              <p style={{ color: 'var(--color-red-500)', fontSize: 12, marginTop: 8 }}>
                {signMutation.error.message}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
