import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import type { Case, Run } from '../../server/genomics/types'

async function fetchCases(): Promise<Case[]> {
  const res = await fetch('/api/genomics/cases')
  if (!res.ok) throw new Error('Failed to fetch cases')
  const data = await res.json() as { cases: Case[] }
  return data.cases
}

async function fetchRuns(): Promise<Run[]> {
  const res = await fetch('/api/genomics/runs')
  if (!res.ok) throw new Error('Failed to fetch runs')
  const data = await res.json() as { runs: Run[] }
  return data.runs
}

function StatusBadge({ status }: { status: string }) {
  return <span className={`cl-badge cl-badge-${status}`}>{status}</span>
}

export function GenomicsDashboard() {
  const { data: cases = [] } = useQuery({ queryKey: ['genomics', 'cases'], queryFn: fetchCases })
  const { data: runs = [] } = useQuery({ queryKey: ['genomics', 'runs'], queryFn: fetchRuns })

  const openCases = cases.filter((c) => c.status === 'active').length
  const activeRuns = runs.filter((r) => r.status === 'running' || r.status === 'queued').length
  const recentCases = cases.slice(0, 5)
  const activeRunsList = runs.filter((r) => r.status === 'running' || r.status === 'queued').slice(0, 5)

  return (
    <div>
      <div className="cl-title-bar">
        <h1>Genomics Dashboard</h1>
      </div>

      <div className="cl-content">
        {/* Stats */}
        <div className="cl-stats-row">
          {[
            { label: 'Open Cases', value: openCases },
            { label: 'Active Runs', value: activeRuns },
            { label: 'Total Cases', value: cases.length },
            { label: 'Total Runs', value: runs.length },
          ].map((s) => (
            <div key={s.label} className="cl-card cl-stat-card">
              <div className="label">{s.label}</div>
              <div className="value">{s.value}</div>
            </div>
          ))}
        </div>

        {/* Two columns */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--cl-space-4)' }}>
          {/* Recent Cases */}
          <div className="cl-card">
            <div style={{ padding: 'var(--cl-space-4)', borderBottom: '1px solid var(--gray-200)', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 700, fontSize: 14 }}>Recent Cases</span>
              <Link to="/genomics/cases" style={{ fontSize: 12, color: 'var(--brand-600)' }}>View all →</Link>
            </div>
            <table className="cl-table">
              <thead><tr><th>Patient</th><th>Diagnosis</th><th>Status</th></tr></thead>
              <tbody>
                {recentCases.length === 0 && (
                  <tr><td colSpan={3} style={{ color: 'var(--gray-500)', textAlign: 'center' }}>No cases yet</td></tr>
                )}
                {recentCases.map((c) => (
                  <tr key={c.id} onClick={() => window.location.href = `/genomics/cases/${c.id}`}>
                    <td>{c.patient_name ?? '—'}</td>
                    <td style={{ color: 'var(--gray-700)' }}>{c.diagnosis ?? '—'}</td>
                    <td><StatusBadge status={c.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Active Runs */}
          <div className="cl-card">
            <div style={{ padding: 'var(--cl-space-4)', borderBottom: '1px solid var(--gray-200)', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 700, fontSize: 14 }}>Active Runs</span>
              <Link to="/genomics/runs" style={{ fontSize: 12, color: 'var(--brand-600)' }}>View all →</Link>
            </div>
            <table className="cl-table">
              <thead><tr><th>Name</th><th>Pipeline</th><th>Status</th></tr></thead>
              <tbody>
                {activeRunsList.length === 0 && (
                  <tr><td colSpan={3} style={{ color: 'var(--gray-500)', textAlign: 'center' }}>No active runs</td></tr>
                )}
                {activeRunsList.map((r) => (
                  <tr key={r.id} onClick={() => window.location.href = `/genomics/runs/${r.id}`}>
                    <td>{r.name}</td>
                    <td style={{ color: 'var(--gray-700)' }}>{r.pipeline}</td>
                    <td><StatusBadge status={r.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

