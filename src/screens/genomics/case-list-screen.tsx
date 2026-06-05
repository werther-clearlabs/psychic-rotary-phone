import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import type { Case } from '../../server/genomics/types'

async function fetchCases(): Promise<Case[]> {
  const res = await fetch('/api/genomics/cases')
  if (!res.ok) throw new Error('Failed to fetch cases')
  return ((await res.json()) as { cases: Case[] }).cases
}

async function createCase(body: Partial<Case>): Promise<Case> {
  const res = await fetch('/api/genomics/cases', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error('Failed to create case')
  return ((await res.json()) as { case: Case }).case
}

function StatusBadge({ status }: { status: string }) {
  return <span className={`cl-badge cl-badge-${status}`}>{status}</span>
}

export function CaseListScreen() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { data: cases = [], isLoading } = useQuery({
    queryKey: ['genomics', 'cases'],
    queryFn: fetchCases,
  })
  const [filter, setFilter] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    patient_name: '',
    patient_id: '',
    diagnosis: '',
    stage: '',
    status: 'active' as const,
  })

  const mutation = useMutation({
    mutationFn: createCase,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['genomics', 'cases'] })
      setShowForm(false)
    },
  })

  const filtered = cases.filter(
    (c) =>
      !filter ||
      (c.patient_name ?? '').toLowerCase().includes(filter.toLowerCase()) ||
      (c.diagnosis ?? '').toLowerCase().includes(filter.toLowerCase()),
  )

  return (
    <div>
      <div className="cl-title-bar">
        <h1>Cases</h1>
        <div
          style={{
            marginLeft: 'auto',
            display: 'flex',
            gap: 'var(--cl-space-2)',
          }}
        >
          <input
            placeholder="Search…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            style={{
              border: '1px solid var(--gray-400)',
              borderRadius: 'var(--cl-radius-sm)',
              padding: '4px 10px',
              fontSize: 12,
              width: 200,
            }}
          />
          <button
            className="cl-btn cl-btn-primary cl-btn-sm"
            onClick={() => setShowForm(true)}
          >
            + New Case
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
            gap: 'var(--cl-space-3)',
            alignItems: 'flex-end',
          }}
        >
          {(
            [
              { key: 'patient_name', label: 'Patient Name' },
              { key: 'patient_id', label: 'Patient ID' },
              { key: 'diagnosis', label: 'Diagnosis' },
              { key: 'stage', label: 'Stage' },
            ] as const
          ).map(({ key, label }) => (
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
                  width: 140,
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
                <th>Patient</th>
                <th>Patient ID</th>
                <th>Diagnosis</th>
                <th>Stage</th>
                <th>Report Status</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td
                    colSpan={6}
                    style={{ textAlign: 'center', color: 'var(--gray-500)' }}
                  >
                    Loading…
                  </td>
                </tr>
              )}
              {!isLoading && filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    style={{
                      textAlign: 'center',
                      color: 'var(--gray-500)',
                      padding: 32,
                    }}
                  >
                    No cases found
                  </td>
                </tr>
              )}
              {filtered.map((c) => (
                <tr
                  key={c.id}
                  onClick={() =>
                    navigate({
                      to: '/genomics/cases/$caseId',
                      params: { caseId: c.id },
                    })
                  }
                >
                  <td style={{ fontWeight: 700 }}>{c.patient_name ?? '—'}</td>
                  <td style={{ color: 'var(--gray-700)' }}>
                    {c.patient_id ?? '—'}
                  </td>
                  <td>{c.diagnosis ?? '—'}</td>
                  <td style={{ color: 'var(--gray-700)' }}>{c.stage ?? '—'}</td>
                  <td>
                    {c.report_status ? <StatusBadge status={c.report_status} /> : '—'}
                  </td>
                  <td style={{ color: 'var(--gray-600)', fontSize: 11 }}>
                    {new Date(c.created_at).toLocaleDateString()}
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
