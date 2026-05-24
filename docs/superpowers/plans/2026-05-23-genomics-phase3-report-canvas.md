# Genomics Portal — Phase 3: Report Canvas

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Report & Review tab — watcher startup wiring, Generate Report 3-step modal, Monaco-editor section canvas, Sign & Finalize, Export PDF, and embedded AI chat panel with Case context.

**Prerequisites:** Phase 1 (`2026-05-23-genomics-phase1-foundation.md`) and Phase 2 (`2026-05-23-genomics-phase2-shell-screens.md`) complete.

**Architecture:** All backend API routes and store functions exist from Phase 1. The `case-detail-screen.tsx` stub (`Report & Review — see Phase 3 plan`) is replaced with a split canvas. Three new screen components are extracted to separate files. The `report-watcher` is started once via a server-side `watcher-init.ts` module imported in the generate route. The AI chat panel is self-contained: it POSTs to `/api/send-stream` and reads the streaming response body directly (no dependency on the full chat-screen infrastructure).

**Tech Stack:** `@monaco-editor/react` (already in deps), `puppeteer` (already in deps), TanStack Query, Zustand (`genomics-store.ts`), React 19

**Spec:** `docs/superpowers/specs/2026-05-23-genomics-case-run-management-design.md`

---

### File Structure

| Action | Path | Responsibility |
|---|---|---|
| Create | `src/server/genomics/watcher-init.ts` | Side-effect module: starts `fs.watch` on `GENOMICS_REPORT_WATCH_PATH` |
| Modify | `src/routes/api/genomics/cases.$caseId.report.generate.ts` | Import `watcher-init` so watcher is running when first report is generated |
| Create | `src/screens/genomics/components/generate-report-modal.tsx` | 3-step wizard: Protocol selector → Variable review → Confirm |
| Create | `src/screens/genomics/components/report-canvas.tsx` | Section nav pills, Monaco editor blocks, figures, Sign, Export PDF |
| Create | `src/screens/genomics/components/report-chat-panel.tsx` | Embedded chat: POST `/api/send-stream`, stream response |
| Modify | `src/screens/genomics/case-detail-screen.tsx` | Replace stub with `<ReportAndReviewTab>` that composes the three components |

---

### Task 1: Watcher startup module

**Files:**
- Create: `src/server/genomics/watcher-init.ts`
- Modify: `src/routes/api/genomics/cases.$caseId.report.generate.ts`

The watcher must be running before a report is generated. Because TanStack Start is a Node.js server, server-only modules are evaluated once on first import. Importing `watcher-init.ts` from the generate route ensures the watcher starts the first time `/report/generate` is called — which is always before a report can appear on disk.

- [ ] **Step 1: Create `watcher-init.ts`**

```typescript
// src/server/genomics/watcher-init.ts
import { startReportWatcher } from './report-watcher'
import { upsertReportFromFile } from './reports-store'
import { listCases } from './cases-store'

const watchPath = process.env.GENOMICS_REPORT_WATCH_PATH

let started = false

if (watchPath && !started) {
  started = true
  startReportWatcher(watchPath, (filePath, parsed) => {
    // Match file to a case by looking for a case_id embedded in the filename.
    // Convention: agent writes files as {case_id}-report.md or {case_id}.md
    const filename = filePath.split('/').pop() ?? ''
    const cases = listCases()
    const matchedCase = cases.find((c) => filename.includes(c.id))
    if (!matchedCase) {
      console.warn('[genomics watcher] could not match report file to a case:', filename)
      return
    }
    upsertReportFromFile(undefined, matchedCase.id, filePath, parsed.sections, parsed.figures)
    console.log(`[genomics watcher] imported report for case ${matchedCase.id} from ${filePath}`)
  })
  console.log(`[genomics watcher] watching ${watchPath} for markdown reports`)
}
```

- [ ] **Step 2: Import watcher-init in generate route**

Open `src/routes/api/genomics/cases.$caseId.report.generate.ts` and add this import at the top (after the existing imports):

```typescript
// Ensure the file watcher is running before the first report is generated.
import '../../../server/genomics/watcher-init'
```

The full file with the added import line at the top:

```typescript
// src/routes/api/genomics/cases.$caseId.report.generate.ts
import { createFileRoute } from '@tanstack/react-router'
import { requireLocalOrAuth } from '../../../server/auth-middleware'
import { getCase } from '../../../server/genomics/cases-store'
import { getProtocol, resolveVariables, renderTemplate } from '../../../server/genomics/protocols-store'
import { gateway } from '../../../server/gateway'
// Ensure the file watcher is running before the first report is generated.
import '../../../server/genomics/watcher-init'

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

        await gateway.request('sessions.send_message', {
          message: prompt,
          context: {
            case_id: params.caseId,
            protocol_id: protocol.id,
            protocol_version: protocol.version,
          },
        })

        return Response.json({ ok: true, prompt_length: prompt.length })
      },
    },
  },
})
```

- [ ] **Step 3: Commit**

```bash
git add src/server/genomics/watcher-init.ts src/routes/api/genomics/cases.$caseId.report.generate.ts
git commit -m "feat: wire report-watcher startup in generate route"
```

---

### Task 2: Generate Report modal

**Files:**
- Create: `src/screens/genomics/components/generate-report-modal.tsx`

A 3-step wizard modal rendered over the Report & Review tab.

- **Step 1 — SELECT PROTOCOL**: Lists protocols from `/api/genomics/protocols?assay_type=<case.assay_type>`. Radio-select one.
- **Step 2 — REVIEW VARIABLES**: Shows resolved variables from `/api/genomics/protocols/$id/preview` (POST with case_id). `editable: false` vars are read-only. `source: "manual"` vars are `<input>` fields. Overrides stored in `genomics-store.generateVariableOverrides`.
- **Step 3 — CONFIRM**: Shows the rendered prompt from the preview response. "Generate" button POSTs to `/api/genomics/cases/$caseId/report/generate`.

- [ ] **Step 1: Write `generate-report-modal.tsx`**

```tsx
// src/screens/genomics/components/generate-report-modal.tsx
import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useGenomicsStore } from '../../../stores/genomics-store'
import type { Protocol, ProtocolVariable } from '../../../server/genomics/types'

const SECTION_LABELS = [
  'SELECT PROTOCOL', 'REVIEW VARIABLES', 'CONFIRM',
] as const

async function fetchProtocols(assayType?: string | null): Promise<Protocol[]> {
  const url = assayType
    ? `/api/genomics/protocols?assay_type=${encodeURIComponent(assayType)}`
    : '/api/genomics/protocols'
  const res = await fetch(url)
  if (!res.ok) throw new Error('Failed to fetch protocols')
  return ((await res.json()) as { protocols: Protocol[] }).protocols
}

async function previewProtocol(
  protocolId: string,
  caseId: string,
  overrides: Record<string, string>,
): Promise<{ rendered: string; vars: Record<string, string> }> {
  const res = await fetch(`/api/genomics/protocols/${protocolId}/preview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ case_id: caseId, overrides }),
  })
  if (!res.ok) throw new Error('Failed to preview protocol')
  return res.json() as Promise<{ rendered: string; vars: Record<string, string> }>
}

async function generateReport(
  caseId: string,
  protocolId: string,
  overrides: Record<string, string>,
): Promise<void> {
  const res = await fetch(`/api/genomics/cases/${caseId}/report/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ protocol_id: protocolId, overrides }),
  })
  if (!res.ok) throw new Error('Failed to dispatch report generation')
}

interface Props {
  caseId: string
  assayType?: string | null
  onClose: () => void
  onDispatched: () => void
}

export function GenerateReportModal({ caseId, assayType, onClose, onDispatched }: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const { generateProtocolId, generateVariableOverrides, setGenerateProtocolId, setVariableOverride } =
    useGenomicsStore()

  const { data: protocols = [] } = useQuery({
    queryKey: ['genomics', 'protocols', assayType],
    queryFn: () => fetchProtocols(assayType),
  })

  const selectedProtocol = protocols.find((p) => p.id === generateProtocolId) ?? null

  const previewQuery = useQuery({
    queryKey: ['genomics', 'protocol-preview', generateProtocolId, caseId, generateVariableOverrides],
    queryFn: () =>
      selectedProtocol
        ? previewProtocol(selectedProtocol.id, caseId, generateVariableOverrides)
        : null,
    enabled: step >= 2 && !!selectedProtocol,
  })

  const generateMutation = useMutation({
    mutationFn: () =>
      generateReport(caseId, generateProtocolId!, generateVariableOverrides),
    onSuccess: () => {
      onDispatched()
      onClose()
    },
  })

  const stepLabel = (n: number) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, opacity: step === n ? 1 : 0.4 }}>
      <div style={{
        width: 20, height: 20, borderRadius: '50%',
        background: step === n ? 'var(--brand-500)' : 'var(--gray-400)',
        color: '#fff', fontSize: 9, fontWeight: 700,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>{n}</div>
      <span style={{ fontSize: 10, fontWeight: 700, color: step === n ? 'var(--brand-500)' : 'var(--gray-600)', textTransform: 'uppercase', letterSpacing: '0.44px' }}>
        {SECTION_LABELS[n - 1]}
      </span>
    </div>
  )

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: '#fff', borderRadius: 5, width: 580, maxHeight: '85vh',
        boxShadow: '0px 6px 16px 0px rgba(0,0,0,0.18)', display: 'flex', flexDirection: 'column',
        overflow: 'hidden', fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
      }}>
        {/* Header */}
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--gray-200)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--gray-900)' }}>Generate Report</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--gray-500)', cursor: 'pointer', fontSize: 16 }}>✕</button>
        </div>

        {/* Step indicators */}
        <div style={{ padding: '10px 20px', borderBottom: '1px solid var(--gray-200)', background: '#fafafa', display: 'flex', alignItems: 'center', gap: 0 }}>
          {stepLabel(1)}
          <div style={{ flex: 1, height: 1, background: 'var(--gray-300)', margin: '0 10px', maxWidth: 40 }} />
          {stepLabel(2)}
          <div style={{ flex: 1, height: 1, background: 'var(--gray-300)', margin: '0 10px', maxWidth: 40 }} />
          {stepLabel(3)}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          {step === 1 && (
            <Step1ProtocolSelector
              protocols={protocols}
              assayType={assayType}
              selectedId={generateProtocolId}
              onSelect={setGenerateProtocolId}
            />
          )}
          {step === 2 && selectedProtocol && (
            <Step2Variables
              protocol={selectedProtocol}
              resolvedVars={previewQuery.data?.vars ?? {}}
              overrides={generateVariableOverrides}
              onOverride={setVariableOverride}
            />
          )}
          {step === 3 && (
            <Step3Confirm
              rendered={previewQuery.data?.rendered ?? ''}
              loading={previewQuery.isLoading}
              dispatching={generateMutation.isPending}
              error={generateMutation.error?.message ?? null}
            />
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '10px 20px', borderTop: '1px solid var(--gray-200)', background: '#fafafa', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            onClick={onClose}
            style={{ padding: '6px 16px', borderRadius: 3, fontSize: 11, fontWeight: 700, color: 'var(--gray-900)', background: 'none', border: '1px solid var(--gray-300)', cursor: 'pointer' }}
          >
            Cancel
          </button>
          {step > 1 && (
            <button
              onClick={() => setStep((s) => (s - 1) as 1 | 2 | 3)}
              style={{ padding: '6px 16px', borderRadius: 3, fontSize: 11, fontWeight: 700, color: 'var(--brand-500)', background: 'none', border: '1px solid var(--brand-500)', cursor: 'pointer' }}
            >
              ← Back
            </button>
          )}
          {step < 3 ? (
            <button
              disabled={step === 1 && !generateProtocolId}
              onClick={() => setStep((s) => (s + 1) as 2 | 3)}
              style={{
                padding: '6px 16px', borderRadius: 3, fontSize: 11, fontWeight: 700,
                background: step === 1 && !generateProtocolId ? 'var(--gray-400)' : 'var(--brand-500)',
                color: '#fff', border: 'none', cursor: step === 1 && !generateProtocolId ? 'not-allowed' : 'pointer',
              }}
            >
              Next →
            </button>
          ) : (
            <button
              disabled={generateMutation.isPending}
              onClick={() => generateMutation.mutate()}
              style={{
                padding: '6px 16px', borderRadius: 3, fontSize: 11, fontWeight: 700,
                background: generateMutation.isPending ? 'var(--gray-400)' : 'var(--brand-500)',
                color: '#fff', border: 'none', cursor: generateMutation.isPending ? 'not-allowed' : 'pointer',
              }}
            >
              {generateMutation.isPending ? 'Dispatching…' : 'Generate Report'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function Step1ProtocolSelector({
  protocols, assayType, selectedId, onSelect,
}: {
  protocols: Protocol[]
  assayType?: string | null
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  if (protocols.length === 0) {
    return <p style={{ color: 'var(--gray-500)', fontSize: 13 }}>No protocols found{assayType ? ` for ${assayType}` : ''}.</p>
  }
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.44px', color: 'var(--gray-700)', marginBottom: 10 }}>
        Available Protocols{assayType ? ` · Filtered for ${assayType}` : ''}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {protocols.map((p) => {
          const selected = p.id === selectedId
          return (
            <div
              key={p.id}
              onClick={() => onSelect(p.id)}
              style={{
                border: selected ? '2px solid var(--brand-500)' : '1px solid var(--gray-200)',
                borderRadius: 5, padding: '10px 14px',
                background: selected ? 'oklch(0.97 0.01 237)' : '#fff',
                cursor: 'pointer', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10,
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--gray-900)' }}>{p.name}</span>
                  <span style={{ background: 'var(--gray-200)', color: 'var(--gray-700)', fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 3 }}>v{p.version}</span>
                  {p.is_active ? (
                    <span style={{ background: 'var(--color-green-100)', color: 'var(--color-green-600)', fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 3 }}>ACTIVE</span>
                  ) : (
                    <span style={{ background: 'var(--gray-200)', color: 'var(--gray-600)', fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 3 }}>RETIRED</span>
                  )}
                </div>
                {p.description && <div style={{ fontSize: 10, color: 'var(--gray-600)', marginBottom: 6 }}>{p.description}</div>}
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {p.skills.slice(0, 5).map((skill) => (
                    <span key={skill} style={{ background: 'var(--gray-100)', color: 'var(--gray-700)', fontSize: 9, padding: '1px 6px', borderRadius: 3 }}>{skill}</span>
                  ))}
                  {p.skills.length > 5 && <span style={{ fontSize: 9, color: 'var(--gray-500)' }}>+{p.skills.length - 5} more</span>}
                </div>
              </div>
              <div style={{
                width: 16, height: 16, borderRadius: '50%', flexShrink: 0, marginTop: 2,
                border: `2px solid ${selected ? 'var(--brand-500)' : 'var(--gray-400)'}`,
                background: selected ? 'var(--brand-500)' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {selected && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff' }} />}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Step2Variables({
  protocol, resolvedVars, overrides, onOverride,
}: {
  protocol: Protocol
  resolvedVars: Record<string, string>
  overrides: Record<string, string>
  onOverride: (name: string, value: string) => void
}) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.44px', color: 'var(--gray-700)', marginBottom: 10 }}>
        Variables for {protocol.name} v{protocol.version}
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr>
            {['Variable', 'Source', 'Value'].map((h) => (
              <th key={h} style={{ textAlign: 'left', padding: '6px 8px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.44px', color: 'var(--gray-700)', borderBottom: '1px solid var(--gray-200)' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(protocol.variables as ProtocolVariable[]).map((v) => {
            const resolved = overrides[v.name] ?? resolvedVars[v.name] ?? ''
            const isManual = v.source === 'manual' || v.editable
            return (
              <tr key={v.name} style={{ borderBottom: '1px solid var(--gray-100)' }}>
                <td style={{ padding: '8px', color: 'var(--gray-900)', fontWeight: 600 }}>{v.label}</td>
                <td style={{ padding: '8px', color: 'var(--gray-600)', fontSize: 11 }}>
                  {v.source === 'manual' ? 'manual' : <code style={{ fontSize: 10, background: 'var(--gray-100)', padding: '1px 4px', borderRadius: 2 }}>{v.source}</code>}
                </td>
                <td style={{ padding: '8px' }}>
                  {isManual ? (
                    <input
                      type="text"
                      value={overrides[v.name] ?? resolved}
                      onChange={(e) => onOverride(v.name, e.target.value)}
                      style={{ width: '100%', border: '1px solid var(--gray-300)', borderRadius: 3, padding: '4px 8px', fontSize: 12, color: 'var(--gray-900)' }}
                    />
                  ) : (
                    <span style={{ color: resolved ? 'var(--gray-900)' : 'var(--color-red-500)' }}>
                      {resolved || <em style={{ color: 'var(--color-red-500)' }}>not resolved</em>}
                    </span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function Step3Confirm({
  rendered, loading, dispatching, error,
}: {
  rendered: string
  loading: boolean
  dispatching: boolean
  error: string | null
}) {
  if (loading) return <p style={{ color: 'var(--gray-500)', fontSize: 13 }}>Resolving variables…</p>
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.44px', color: 'var(--gray-700)', marginBottom: 8 }}>
        Rendered Prompt Preview
      </div>
      <pre style={{
        background: 'var(--gray-100)', border: '1px solid var(--gray-200)', borderRadius: 4,
        padding: 12, fontSize: 11, lineHeight: '18px', color: 'var(--gray-800)',
        maxHeight: 280, overflowY: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
      }}>
        {rendered}
      </pre>
      {error && <p style={{ color: 'var(--color-red-500)', fontSize: 12, marginTop: 8 }}>{error}</p>}
      {dispatching && (
        <p style={{ color: 'var(--gray-600)', fontSize: 12, marginTop: 8 }}>
          Dispatching to Hermes agent… The report will appear in the canvas when the agent finishes writing the markdown file.
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/screens/genomics/components/generate-report-modal.tsx
git commit -m "feat: generate report 3-step modal (protocol selector, variables, confirm)"
```

---

### Task 3: Report canvas component

**Files:**
- Create: `src/screens/genomics/components/report-canvas.tsx`

Section nav pills §1–§12, collapsible Monaco editor blocks, figure embedding, Export PDF button, Sign & Finalize button.

- [ ] **Step 1: Write `report-canvas.tsx`**

```tsx
// src/screens/genomics/components/report-canvas.tsx
import { useState, useCallback } from 'react'
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
  a.click()
  URL.revokeObjectURL(url)
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

  const handleEditorChange = useCallback(
    (value: string | undefined) => {
      if (!editingSection || value === undefined) return
      patchMutation.mutate({ section: editingSection, content: value })
    },
    [editingSection, patchMutation],
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
```

- [ ] **Step 2: Commit**

```bash
git add src/screens/genomics/components/report-canvas.tsx
git commit -m "feat: report canvas with Monaco editor, section nav, sign, export PDF"
```

---

### Task 4: Figure serve API route

**Files:**
- Create: `src/routes/api/genomics/figure.ts`

The report canvas loads figures via `/api/genomics/figure?path=<nas-path>`. This route reads the file from the NAS path and streams it back. Without this, `<img>` tags referencing absolute NAS paths would fail.

- [ ] **Step 1: Create figure route**

```typescript
// src/routes/api/genomics/figure.ts
import { createFileRoute } from '@tanstack/react-router'
import { requireLocalOrAuth } from '../../../server/auth-middleware'
import { createReadStream, existsSync } from 'node:fs'
import { extname } from 'node:path'

const MIME: Record<string, string> = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.svg': 'image/svg+xml', '.webp': 'image/webp',
}

export const Route = createFileRoute('/api/genomics/figure')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!requireLocalOrAuth(request)) return Response.json({ error: 'Unauthorized' }, { status: 401 })
        const url = new URL(request.url)
        const filePath = url.searchParams.get('path')
        if (!filePath) return Response.json({ error: 'path required' }, { status: 400 })

        // Validate path is under NAS base (prevent directory traversal)
        const nasBase = process.env.GENOMICS_NAS_BASE ?? ''
        if (nasBase && !filePath.startsWith(nasBase)) {
          return Response.json({ error: 'Forbidden' }, { status: 403 })
        }

        if (!existsSync(filePath)) {
          return Response.json({ error: 'Not found' }, { status: 404 })
        }

        const ext = extname(filePath).toLowerCase()
        const contentType = MIME[ext] ?? 'application/octet-stream'

        const stream = createReadStream(filePath)
        return new Response(stream as unknown as ReadableStream, {
          headers: { 'Content-Type': contentType },
        })
      },
    },
  },
})
```

- [ ] **Step 2: Commit**

```bash
git add src/routes/api/genomics/figure.ts
git commit -m "feat: NAS figure serve route for report canvas"
```

---

### Task 5: AI chat panel

**Files:**
- Create: `src/screens/genomics/components/report-chat-panel.tsx`

A self-contained chat interface scoped to a genomics session. Uses a dedicated session key (`genomics-case-${caseId}`) so conversations are isolated from the main workspace chat. On mount, if the session is fresh, it sends an automatic context primer with the Case's patient info and key variants.

The implementation POSTs to `/api/send-stream` (the same endpoint the main chat uses) and reads the streaming response body directly. Response chunks are SSE-formatted; we extract `delta` text events.

- [ ] **Step 1: Write `report-chat-panel.tsx`**

```tsx
// src/screens/genomics/components/report-chat-panel.tsx
import { useState, useRef, useEffect, useCallback } from 'react'
import type { Case, Report } from '../../../server/genomics/types'

interface Message {
  id: string
  role: 'user' | 'assistant'
  text: string
}

function buildContextPrimer(c: Case, report: Report | null): string {
  const parts = [
    `You are assisting with clinical genomics report review for patient: ${c.patient_name ?? 'unknown'}.`,
    `Diagnosis: ${c.diagnosis ?? 'unknown'}.`,
    c.stage ? `Stage: ${c.stage}.` : '',
    c.ehr_summary ? `EHR summary: ${c.ehr_summary}` : '',
    report ? `A ${report.status} report exists with ${Object.keys(report.sections as object).length} sections.` : '',
    'You can help review variants, suggest edits, find clinical trials, or answer clinical genomics questions.',
  ]
  return parts.filter(Boolean).join(' ')
}

interface Props {
  caseId: string
  caseData: Case
  report: Report | null
}

export function ReportChatPanel({ caseId, caseData, report }: Props) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [contextSent, setContextSent] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const sessionKey = `genomics-case-${caseId}`

  const appendMessage = useCallback((msg: Message) => {
    setMessages((prev) => {
      const existing = prev.find((m) => m.id === msg.id)
      if (existing) {
        return prev.map((m) => m.id === msg.id ? { ...m, text: m.text + msg.text } : m)
      }
      return [...prev, msg]
    })
  }, [])

  // Send context primer on first mount
  useEffect(() => {
    if (contextSent) return
    setContextSent(true)
    const primer = buildContextPrimer(caseData, report)
    void sendToStream(primer, 'system-primer', true)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  async function sendToStream(text: string, msgId: string, silent = false): Promise<void> {
    if (!silent) {
      appendMessage({ id: msgId, role: 'user', text })
    }

    const assistantId = `${msgId}-reply`
    appendMessage({ id: assistantId, role: 'assistant', text: '' })

    try {
      const res = await fetch('/api/send-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, sessionKey, friendlyId: sessionKey }),
      })
      if (!res.ok || !res.body) {
        appendMessage({ id: assistantId, role: 'assistant', text: 'Error: could not reach Hermes.' })
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const raw = line.slice(6).trim()
          if (!raw || raw === '[DONE]') continue
          try {
            const evt = JSON.parse(raw) as Record<string, unknown>
            // Extract text delta from common event shapes
            const delta =
              (evt.delta as string | undefined) ??
              ((evt.payload as Record<string, unknown>)?.delta as string | undefined) ??
              null
            if (typeof delta === 'string' && delta) {
              appendMessage({ id: assistantId, role: 'assistant', text: delta })
            }
          } catch {
            // non-JSON SSE line (e.g. heartbeat) — ignore
          }
        }
      }
    } catch (err) {
      appendMessage({ id: assistantId, role: 'assistant', text: `Error: ${err instanceof Error ? err.message : String(err)}` })
    }
  }

  const handleSend = useCallback(async () => {
    const text = input.trim()
    if (!text || sending) return
    setInput('')
    setSending(true)
    const id = crypto.randomUUID()
    await sendToStream(text, id)
    setSending(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input, sending])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleSend()
    }
  }

  const visibleMessages = messages.filter((m) => {
    // Hide the system primer user message; show its response
    return !(m.role === 'user' && m.id === 'system-primer')
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#fff', borderLeft: '1px solid var(--gray-200)', fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}>
      {/* Header */}
      <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--gray-200)', background: '#fafafa' }}>
        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.44px', color: 'var(--gray-700)' }}>
          AI Assistant · {caseData.patient_name ?? caseId}
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {visibleMessages.length === 0 && (
          <p style={{ color: 'var(--gray-400)', fontSize: 12, fontStyle: 'italic', textAlign: 'center', marginTop: 24 }}>
            Loading case context…
          </p>
        )}
        {visibleMessages.map((msg) => (
          <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div style={{
              maxWidth: '85%', padding: '8px 12px', borderRadius: msg.role === 'user' ? '12px 12px 3px 12px' : '12px 12px 12px 3px',
              background: msg.role === 'user' ? 'var(--brand-500)' : 'var(--gray-100)',
              color: msg.role === 'user' ? '#fff' : 'var(--gray-900)',
              fontSize: 13, lineHeight: '20px', whiteSpace: 'pre-wrap',
            }}>
              {msg.text || <span style={{ opacity: 0.5 }}>…</span>}
            </div>
          </div>
        ))}
      </div>

      {/* Input */}
      <div style={{ padding: '10px 12px', borderTop: '1px solid var(--gray-200)', display: 'flex', gap: 8, background: '#fafafa' }}>
        <textarea
          rows={2}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about variants, trials, or ask AI to update a section…"
          disabled={sending}
          style={{
            flex: 1, resize: 'none', border: '1px solid var(--gray-300)', borderRadius: 4,
            padding: '8px 10px', fontSize: 12, lineHeight: '18px', color: 'var(--gray-900)',
            fontFamily: 'inherit', background: sending ? 'var(--gray-100)' : '#fff',
          }}
        />
        <button
          onClick={() => void handleSend()}
          disabled={!input.trim() || sending}
          style={{
            padding: '0 14px', borderRadius: 4, fontSize: 11, fontWeight: 700,
            background: !input.trim() || sending ? 'var(--gray-300)' : 'var(--brand-500)',
            color: '#fff', border: 'none',
            cursor: !input.trim() || sending ? 'not-allowed' : 'pointer',
            alignSelf: 'flex-end', height: 36,
          }}
        >
          {sending ? '…' : 'Send'}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/screens/genomics/components/report-chat-panel.tsx
git commit -m "feat: embedded AI chat panel for Report & Review tab"
```

---

### Task 6: Wire Report & Review tab in case detail screen

**Files:**
- Modify: `src/screens/genomics/case-detail-screen.tsx`

Replace the `Report & Review — see Phase 3 plan` stub with the composed tab. When no report exists, show an empty state with Generate Report button. When a report exists, show the split canvas.

- [ ] **Step 1: Add imports to `case-detail-screen.tsx`**

Open `src/screens/genomics/case-detail-screen.tsx`. Add these imports near the top (after the existing import block):

```typescript
import { useGenomicsStore } from '../../stores/genomics-store'
import { GenerateReportModal } from './components/generate-report-modal'
import { ReportCanvas } from './components/report-canvas'
import { ReportChatPanel } from './components/report-chat-panel'
```

- [ ] **Step 2: Replace the Report & Review stub**

Locate this line in `case-detail-screen.tsx`:

```typescript
        {activeTab === 'Report & Review' && (
          <div style={{ color: 'var(--gray-500)' }}>Report & Review — see Phase 3 plan</div>
        )}
```

Replace it with:

```tsx
        {activeTab === 'Report & Review' && (
          <ReportAndReviewTab c={c} caseId={caseId} report={report ?? null} />
        )}
```

- [ ] **Step 3: Add the `ReportAndReviewTab` function to the same file**

Add this function after the `HistoryTab` function at the bottom of `case-detail-screen.tsx`:

```tsx
function ReportAndReviewTab({ c, caseId, report }: { c: Case; caseId: string; report: Report | null }) {
  const { generateModalOpen, openGenerateModal, closeGenerateModal } = useGenomicsStore()
  const qc = useQueryClient()

  if (!report) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--gray-600)' }}>
        <div style={{ fontSize: 48, marginBottom: 16, color: 'var(--gray-300)' }}>⬡</div>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--gray-800)', marginBottom: 8 }}>
          No report generated yet
        </h3>
        <p style={{ fontSize: 13, color: 'var(--gray-600)', marginBottom: 24, maxWidth: 380, margin: '0 auto 24px' }}>
          Select a Protocol to dispatch the AI agent. The report will appear here once the agent finishes.
        </p>
        <button
          onClick={() => openGenerateModal()}
          style={{ padding: '8px 24px', borderRadius: 3, fontSize: 13, fontWeight: 700, background: 'var(--brand-500)', color: '#fff', border: 'none', cursor: 'pointer' }}
        >
          Generate Report
        </button>
        {generateModalOpen && (
          <GenerateReportModal
            caseId={caseId}
            assayType={c.assay_type ?? null}
            onClose={closeGenerateModal}
            onDispatched={() => {
              closeGenerateModal()
              // Poll for report availability after dispatch
              setTimeout(() => {
                void qc.invalidateQueries({ queryKey: ['genomics', 'case', caseId, 'report'] })
              }, 3000)
            }}
          />
        )}
      </div>
    )
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', height: 'calc(100vh - 200px)', overflow: 'hidden' }}>
      {/* Left: report canvas */}
      <div style={{ overflowY: 'auto', borderRight: '1px solid var(--gray-200)' }}>
        <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--gray-200)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fafafa' }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--gray-900)' }}>
            Molecular Pathology & Precision Oncology Report
          </span>
          {report.status === 'draft' && (
            <button
              onClick={() => openGenerateModal()}
              style={{ padding: '4px 12px', borderRadius: 3, fontSize: 11, border: '1px solid var(--gray-300)', color: 'var(--gray-700)', background: 'none', cursor: 'pointer' }}
            >
              Regenerate
            </button>
          )}
        </div>
        <ReportCanvas report={report} caseId={caseId} />
      </div>

      {/* Right: AI chat panel */}
      <ReportChatPanel caseId={caseId} caseData={c} report={report} />

      {/* Generate modal (for regenerate) */}
      {generateModalOpen && (
        <GenerateReportModal
          caseId={caseId}
          assayType={c.assay_type ?? null}
          onClose={closeGenerateModal}
          onDispatched={() => {
            closeGenerateModal()
            void qc.invalidateQueries({ queryKey: ['genomics', 'case', caseId, 'report'] })
          }}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 4: Add `assay_type` field to Case type and schema**

The `GenerateReportModal` uses `c.assay_type` to pre-filter protocols. This field is not in the Phase 1 schema. Add it now:

In `src/server/genomics/types.ts`, add `assay_type?: string | null` to the `Case` interface:

```typescript
export interface Case {
  id: string
  patient_id?: string | null
  patient_name?: string | null
  dob?: string | null
  diagnosis?: string | null
  stage?: string | null
  assay_type?: string | null      // e.g. 'WGS' | 'targeted-panel' | 'RNA-seq'
  status: 'active' | 'closed' | 'pending'
  ehr_summary?: string | null
  created_at: number
  updated_at: number
}
```

In `src/server/genomics/schema.ts`, add `assay_type TEXT` to the `cases` table. Find this line in `runMigrations`:

```sql
  patient_id TEXT,
  patient_name TEXT,
```

And replace the cases table definition with:

```sql
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
)
```

Note: if the DB already exists from testing, drop and recreate or run: `ALTER TABLE cases ADD COLUMN assay_type TEXT`.

- [ ] **Step 5: Verify in browser**

```bash
pnpm dev
```

1. Navigate to `http://localhost:3000/genomics` → should redirect to genomics dashboard
2. Create a case:
```bash
curl -X POST http://localhost:3000/api/genomics/cases \
  -H "Content-Type: application/json" \
  -d '{"patient_name":"Jane Doe","diagnosis":"Melanoma","stage":"IIIa","assay_type":"WGS","status":"active"}'
```
3. Navigate to the case detail page → Report & Review tab → should show "No report generated yet" empty state with Generate Report button
4. Click Generate Report — should open the 3-step modal

- [ ] **Step 6: Commit**

```bash
git add src/screens/genomics/case-detail-screen.tsx src/server/genomics/types.ts src/server/genomics/schema.ts
git commit -m "feat: Report & Review tab — generate modal, canvas, chat panel wired in case detail"
```

---

### Task 7: End-to-end smoke test

**Files:**
- No new files; verify the full flow works.

- [ ] **Step 1: Create a test Protocol**

```bash
curl -X POST http://localhost:3000/api/genomics/protocols \
  -H "Content-Type: application/json" \
  -d '{
    "name": "WGS Oncology Report",
    "version": "2.1",
    "assay_type": "WGS",
    "description": "Full somatic WGS report",
    "prompt_template": "Generate a 12-section Molecular Pathology report for patient {{patient_name}} with diagnosis {{diagnosis}}. VCF: {{vcf_path}}.",
    "skills": ["vcf-interpretation","oncokb-lookup","civic-lookup","trial-matcher","report-writer-12section"],
    "variables": [
      {"name":"patient_name","label":"Patient Name","source":"case.patient_name","editable":false},
      {"name":"diagnosis","label":"Diagnosis","source":"case.diagnosis","editable":true},
      {"name":"vcf_path","label":"VCF Path","source":"manual","editable":true}
    ]
  }'
```

- [ ] **Step 2: Open Generate Report modal**

Navigate to the case created in Task 6, go to Report & Review tab, click Generate Report.

Expected:
- Step 1 shows "WGS Oncology Report v2.1" protocol card with radio button
- Step 2 shows variables table: Patient Name auto-resolved, Diagnosis auto-resolved, VCF Path editable input
- Step 3 shows the rendered prompt with substituted values

- [ ] **Step 3: Place a test markdown report file**

```bash
mkdir -p /tmp/genomics-reports

# Get the case ID from previous curl output
CASE_ID="<replace-with-actual-case-id>"

cat > /tmp/genomics-reports/${CASE_ID}-report.md << 'EOF'
# Molecular Pathology and Precision Oncology Report

## 1. Header / Specimen Information

Patient: Jane Doe
Sample ID: COLO829
Report Date: 2026-05-23

## 2. Test Methodology and Limitations

Whole Genome Sequencing at 30× coverage. Parabricks GPU pipeline.

## 3. Results Summary

Hypermutated profile. BRAF V600E detected (Tier I).

## 4. Tier I - Variants of Strong Clinical Significance

BRAF p.V600E — Pathogenic, Tier I. Vemurafenib/dabrafenib indicated.

## 5. Tier II - Variants of Potential Clinical Significance

TERT Promoter C228T — Tier II.

## 6. Biomarker Signatures

TMB: 48 mut/Mb (High). MSS.

## 7. Tier III - Variants of Uncertain Significance

None identified.

## 8. Therapy Recommendations

BRAF-targeted therapy (vemurafenib). Consider immunotherapy given high TMB.

## 9. Matched Clinical Trials

NCT04972369 — BRAF V600E melanoma trial (nearby site).

## 10. Methodology Appendix

BWA-MEM v2, Mutect2 v4.3, OncoKB API v3.7.

## 11. References

1. Davies H et al. Nature 2002. 2. OncoKB knowledgebase 2026.

## 12. Disclaimers

RESEARCH USE ONLY. Not for clinical decision-making.
EOF
```

- [ ] **Step 4: Set watch path and verify report detection**

Stop the dev server, set the env var, restart:

```bash
GENOMICS_REPORT_WATCH_PATH=/tmp/genomics-reports pnpm dev
```

The watcher should log: `[genomics watcher] imported report for case <id> from /tmp/genomics-reports/<id>-report.md`

Reload the Case Report & Review tab — the 12-section report should now appear in the canvas.

- [ ] **Step 5: Test section edit**

Click any section's Edit button → Monaco editor should open → Edit some text → Close editor → Section content should update and persist on page reload.

- [ ] **Step 6: Test Export PDF**

Click Export PDF — browser should download a PDF with all 12 sections rendered.

- [ ] **Step 7: Test Sign & Finalize**

Click Sign & Finalize → enter a name → confirm → sections should lock (Edit buttons hidden), SIGNED badge appears in toolbar.

- [ ] **Step 8: Run full test suite**

```bash
pnpm test
```

Expected: all tests pass (Phase 1 store tests + any existing workspace tests).

- [ ] **Step 9: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 10: Final commit**

```bash
git add .
git commit -m "chore: Phase 3 complete — report canvas, generate modal, AI chat panel"
```

---

**Phase 3 complete.** The Report & Review tab is fully functional: watcher ingests agent-written reports, the 3-step modal dispatches generation via Hermes gateway, Monaco editor enables section-by-section editing, Sign & Finalize locks the report, Export PDF streams a Puppeteer-rendered PDF, and the AI chat panel provides case-contextualized assistance alongside the canvas.

To run the full portal end-to-end:
1. `GENOMICS_REPORT_WATCH_PATH=/path/to/watch pnpm dev`
2. Navigate to `/genomics`
3. Create a Case, add a Protocol, generate a report, edit, sign, export
