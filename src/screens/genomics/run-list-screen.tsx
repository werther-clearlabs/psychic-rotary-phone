import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import type { Run } from '../../server/genomics/types'

async function fetchRuns(): Promise<Run[]> {
  const res = await fetch('/api/genomics/runs')
  return ((await res.json()) as { runs: Run[] }).runs
}

async function createRun(
  body: Partial<Run> & { name: string; pipeline: string },
): Promise<Run> {
  const res = await fetch('/api/genomics/runs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, status: 'queued' }),
  })
  return ((await res.json()) as { run: Run }).run
}

export function RunListScreen() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { data: runs = [], isLoading } = useQuery({
    queryKey: ['genomics', 'runs'],
    queryFn: fetchRuns,
  })
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    name: '',
    pipeline: 'wgs-mutect2',
    reference: 'GRCh38',
    fastq_path: '',
    output_path: '',
    pbrun_command: '',
  })

  const mutation = useMutation({
    mutationFn: createRun,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['genomics', 'runs'] })
      setShowForm(false)
    },
  })

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
            display: 'flex',
            flexWrap: 'wrap',
            gap: 'var(--cl-space-3)',
            alignItems: 'flex-end',
          }}
        >
          {(
            [
              { key: 'name', label: 'Run Name', width: 160 },
              { key: 'pipeline', label: 'Pipeline', width: 140 },
              { key: 'reference', label: 'Reference', width: 100 },
              { key: 'fastq_path', label: 'FASTQ Path (NAS)', width: 220 },
              { key: 'output_path', label: 'Output Path (NAS)', width: 220 },
              { key: 'pbrun_command', label: 'pbrun Command', width: 220 },
            ] as const
          ).map(({ key, label, width }) => (
            <label
              key={key}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                fontSize: 11,
              }}
            >
              <span
                style={{
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.44px',
                  color: 'var(--gray-700)',
                }}
              >
                {label}
              </span>
              <input
                value={form[key]}
                onChange={(e) =>
                  setForm((f) => ({ ...f, [key]: e.target.value }))
                }
                style={{
                  border: '1px solid var(--gray-400)',
                  borderRadius: 'var(--cl-radius-sm)',
                  padding: '4px 8px',
                  fontSize: 12,
                  width,
                }}
              />
            </label>
          ))}
          <button
            className="cl-btn cl-btn-primary cl-btn-sm"
            onClick={() => mutation.mutate(form)}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? 'Saving…' : 'Create'}
          </button>
          <button
            className="cl-btn cl-btn-tertiary cl-btn-sm"
            onClick={() => setShowForm(false)}
          >
            Cancel
          </button>
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
                  <td
                    colSpan={5}
                    style={{ textAlign: 'center', color: 'var(--gray-500)' }}
                  >
                    Loading…
                  </td>
                </tr>
              )}
              {!isLoading && runs.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    style={{
                      textAlign: 'center',
                      color: 'var(--gray-500)',
                      padding: 32,
                    }}
                  >
                    No runs yet
                  </td>
                </tr>
              )}
              {runs.map((r) => (
                <tr
                  key={r.id}
                  onClick={() =>
                    navigate({
                      to: '/genomics/runs/$runId',
                      params: { runId: r.id },
                    })
                  }
                >
                  <td style={{ fontWeight: 700 }}>{r.name}</td>
                  <td>{r.pipeline}</td>
                  <td style={{ color: 'var(--gray-700)' }}>
                    {r.reference ?? '—'}
                  </td>
                  <td>
                    <span className={`cl-badge cl-badge-${r.status}`}>
                      {r.status}
                    </span>
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
