// src/screens/genomics/components/generate-report-modal.tsx
import { useState, useEffect } from 'react'
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
    queryKey: ['genomics', 'protocol-preview', generateProtocolId, caseId],
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

  useEffect(() => {
    if (step === 3 && selectedProtocol) {
      void previewQuery.refetch()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])

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
          {step === 2 && (
            selectedProtocol ? (
              <Step2Variables
                protocol={selectedProtocol}
                resolvedVars={previewQuery.data?.vars ?? {}}
                overrides={generateVariableOverrides}
                onOverride={setVariableOverride}
              />
            ) : (
              <p style={{ color: 'var(--color-red-500)', fontSize: 13 }}>
                Protocol not found. Go back and reselect.
              </p>
            )
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
