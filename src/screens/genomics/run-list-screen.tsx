import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import type { Run } from '../../server/genomics/types'
import type { Case } from '../../server/genomics/types'

async function fetchRuns(): Promise<Run[]> {
  const res = await fetch('/api/genomics/runs')
  return ((await res.json()) as { runs: Run[] }).runs
}

async function fetchCases(): Promise<Case[]> {
  const res = await fetch('/api/genomics/cases')
  return ((await res.json()) as { cases: Case[] }).cases
}

async function createRun(body: object): Promise<Run> {
  const res = await fetch('/api/genomics/runs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json() as { error: string }
    throw new Error(err.error ?? 'Failed to create run')
  }
  return ((await res.json()) as { run: Run }).run
}

const REFERENCE_OPTIONS = [
  { value: 'GRCh38', label: 'GRCh38 (hg38)' },
  { value: 'hg19',   label: 'hg19' },
]

const inputStyle: React.CSSProperties = {
  border: '1px solid var(--gray-400)',
  borderRadius: 'var(--cl-radius-sm)',
  padding: '4px 8px',
  fontSize: 12,
}

const labelStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  fontSize: 11,
}

const labelTextStyle: React.CSSProperties = {
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.44px',
  color: 'var(--gray-700)',
}

export function RunListScreen() {
  const navigate = useNavigate()
  const qc = useQueryClient()

  const { data: runs = [], isLoading } = useQuery({
    queryKey: ['genomics', 'runs'],
    queryFn: fetchRuns,
  })

  const { data: cases = [] } = useQuery({
    queryKey: ['genomics', 'cases'],
    queryFn: fetchCases,
  })

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    name: '',
    case_id: '',
    reference: 'GRCh38',
    input_dir: '',
    samples: '',         // comma-separated
    output_dir: '',
    num_gpus: '1',
  })

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }))

  const mutation = useMutation({
    mutationFn: createRun,
    onSuccess: (run) => {
      qc.invalidateQueries({ queryKey: ['genomics', 'runs'] })
      setShowForm(false)
      navigate({ to: '/genomics/runs/$runId', params: { runId: run.id } })
    },
  })

  const handleSubmit = () => {
    const samples = form.samples
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    if (!form.name || !form.case_id || !form.input_dir || !form.output_dir || samples.length === 0) return

    const numGpus = parseInt(form.num_gpus, 10) || 1
    mutation.mutate({
      name: form.name,
      pipeline: 'batch-somatic-tumor',
      reference: form.reference,
      case_id: form.case_id,
      output_dir: form.output_dir,
      log_dir: form.output_dir + '/logs',
      num_gpus: numGpus,
      status: 'queued',
      run_config: JSON.stringify({
        mode: 'batch-somatic-tumor',
        input_dir: form.input_dir,
        samples,
        num_gpus_per_sample: numGpus,
      }),
    })
  }

  return (
    <div>
      <div className="cl-title-bar">
        <h1>Runs</h1>
        <div style={{ marginLeft: 'auto' }}>
          <button
            className="cl-btn cl-btn-primary cl-btn-sm"
            onClick={() => setShowForm(true)}
          >
            + New Run
          </button>
        </div>
      </div>

      {showForm && (
        <div
          style={{
            background: 'var(--white)',
            borderBottom: '1px solid var(--gray-200)',
            padding: 'var(--cl-space-4) var(--cl-space-6)',
          }}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--cl-space-3)', alignItems: 'flex-end' }}>

            {/* Pipeline label — fixed for Phase 1 */}
            <label style={labelStyle}>
              <span style={labelTextStyle}>Pipeline</span>
              <input
                value="Somatic Tumor-Only (Panel)"
                disabled
                style={{ ...inputStyle, width: 200, color: 'var(--gray-600)', background: 'var(--gray-50)' }}
              />
            </label>

            <label style={labelStyle}>
              <span style={labelTextStyle}>Run Name</span>
              <input value={form.name} onChange={set('name')} style={{ ...inputStyle, width: 180 }} />
            </label>

            <label style={labelStyle}>
              <span style={labelTextStyle}>Case <span style={{ color: 'var(--red-600)' }}>*</span></span>
              <select value={form.case_id} onChange={set('case_id')} style={{ ...inputStyle, width: 200 }}>
                <option value="">— select case —</option>
                {cases.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.patient_name ?? c.patient_id ?? c.id}
                  </option>
                ))}
              </select>
            </label>

            <label style={labelStyle}>
              <span style={labelTextStyle}>Reference</span>
              <select value={form.reference} onChange={set('reference')} style={{ ...inputStyle, width: 140 }}>
                {REFERENCE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </label>

            <label style={labelStyle}>
              <span style={labelTextStyle}>Input Dir (NAS)</span>
              <input
                value={form.input_dir}
                onChange={set('input_dir')}
                placeholder="/mnt/storage/…/onc089eec2c"
                style={{ ...inputStyle, width: 260 }}
              />
            </label>

            <label style={labelStyle}>
              <span style={labelTextStyle}>Sample IDs (comma-separated)</span>
              <input
                value={form.samples}
                onChange={set('samples')}
                placeholder="SIP0001, SIP0002, SIP0003"
                style={{ ...inputStyle, width: 260 }}
              />
            </label>

            <label style={labelStyle}>
              <span style={labelTextStyle}>Output Dir (NAS)</span>
              <input
                value={form.output_dir}
                onChange={set('output_dir')}
                placeholder="/mnt/storage/…/results"
                style={{ ...inputStyle, width: 240 }}
              />
            </label>

            <label style={labelStyle}>
              <span style={labelTextStyle}>GPUs / sample</span>
              <input
                type="number"
                min={1}
                max={8}
                value={form.num_gpus}
                onChange={set('num_gpus')}
                style={{ ...inputStyle, width: 72 }}
              />
            </label>

          </div>

          {mutation.isError && (
            <p style={{ color: 'var(--red-600)', fontSize: 12, marginTop: 8 }}>
              {(mutation.error as Error).message}
            </p>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button
              className="cl-btn cl-btn-primary cl-btn-sm"
              onClick={handleSubmit}
              disabled={mutation.isPending}
            >
              {mutation.isPending ? 'Creating…' : 'Create Run'}
            </button>
            <button
              className="cl-btn cl-btn-tertiary cl-btn-sm"
              onClick={() => { setShowForm(false); mutation.reset() }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="cl-content">
        <div className="cl-card">
          <table className="cl-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Pipeline</th>
                <th>Reference</th>
                <th>Status</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', color: 'var(--gray-500)' }}>
                    Loading…
                  </td>
                </tr>
              )}
              {!isLoading && runs.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', color: 'var(--gray-500)', padding: 32 }}>
                    No runs yet
                  </td>
                </tr>
              )}
              {runs.map((r) => (
                <tr
                  key={r.id}
                  onClick={() => navigate({ to: '/genomics/runs/$runId', params: { runId: r.id } })}
                  style={{ cursor: 'pointer' }}
                >
                  <td style={{ fontWeight: 700 }}>{r.name}</td>
                  <td>{r.pipeline}</td>
                  <td style={{ color: 'var(--gray-700)' }}>{r.reference ?? '—'}</td>
                  <td>
                    <span className={`cl-badge cl-badge-${r.status}`}>{r.status}</span>
                  </td>
                  <td style={{ color: 'var(--gray-600)', fontSize: 11 }}>
                    {new Date(r.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
