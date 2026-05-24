import { useQuery } from '@tanstack/react-query'
import { useParams, Link } from '@tanstack/react-router'
import { useState } from 'react'
import type { Case, CaseSample, Report } from '../../server/genomics/types'

async function fetchCase(
  id: string,
): Promise<{ case: Case; samples: CaseSample[] }> {
  const res = await fetch(`/api/genomics/cases/${id}`)
  if (!res.ok) throw new Error('Failed to fetch case')
  return res.json() as Promise<{ case: Case; samples: CaseSample[] }>
}

async function fetchReport(caseId: string): Promise<Report | null> {
  const res = await fetch(`/api/genomics/cases/${caseId}/report`)
  if (!res.ok) return null
  const data = (await res.json()) as { report: Report | null }
  return data.report
}

function StatusBadge({ status }: { status: string }) {
  return <span className={`cl-badge cl-badge-${status}`}>{status}</span>
}

const TABS = [
  'Overview',
  'Report & Review',
  'Files',
  'Runs',
  'History',
] as const
type Tab = (typeof TABS)[number]

export function CaseDetailScreen() {
  const { caseId } = useParams({ from: '/genomics/cases_/$caseId' })
  const [activeTab, setActiveTab] = useState<Tab>('Overview')

  const { data, isLoading } = useQuery({
    queryKey: ['genomics', 'case', caseId],
    queryFn: () => fetchCase(caseId),
  })
  const { data: report } = useQuery({
    queryKey: ['genomics', 'case', caseId, 'report'],
    queryFn: () => fetchReport(caseId),
  })

  if (isLoading)
    return (
      <div className="cl-content" style={{ color: 'var(--gray-500)' }}>
        Loading…
      </div>
    )
  if (!data)
    return (
      <div className="cl-content" style={{ color: 'var(--color-red-600)' }}>
        Case not found
      </div>
    )

  const { case: c, samples } = data

  return (
    <div>
      {/* Title bar */}
      <div className="cl-title-bar">
        <Link
          to="/genomics/cases"
          style={{ color: 'var(--brand-600)', fontSize: 12, marginRight: 8 }}
        >
          ← Cases
        </Link>
        <h1 style={{ marginRight: 12 }}>
          {c.patient_name ?? c.patient_id ?? 'Case'}
        </h1>
        <StatusBadge status={c.status} />
        {c.diagnosis && (
          <span
            style={{ fontSize: 13, color: 'var(--gray-700)', marginLeft: 8 }}
          >
            {c.diagnosis}
            {c.stage ? ` · ${c.stage}` : ''}
          </span>
        )}
      </div>

      {/* Tabs */}
      <div className="cl-toolbar">
        {TABS.map((t) => (
          <button
            key={t}
            className={`cl-tab${activeTab === t ? ' active' : ''}`}
            aria-selected={activeTab === t}
            onClick={() => setActiveTab(t)}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="cl-content">
        {activeTab === 'Overview' && (
          <OverviewTab c={c} samples={samples} report={report} />
        )}
        {activeTab === 'Report & Review' && (
          <div style={{ color: 'var(--gray-500)' }}>
            Report & Review — see Phase 3 plan
          </div>
        )}
        {activeTab === 'Files' && <FilesTab samples={samples} />}
        {activeTab === 'Runs' && <RunsTab caseId={caseId} />}
        {activeTab === 'History' && <HistoryTab report={report} />}
      </div>
    </div>
  )
}

function OverviewTab({
  c,
  samples,
  report,
}: {
  c: Case
  samples: CaseSample[]
  report: Report | null
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        gap: 'var(--cl-space-4)',
      }}
    >
      <div className="cl-card" style={{ padding: 'var(--cl-space-4)' }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.44px',
            color: 'var(--gray-700)',
            marginBottom: 8,
          }}
        >
          Patient
        </div>
        <dl
          style={{
            margin: 0,
            display: 'grid',
            gridTemplateColumns: '80px 1fr',
            gap: '4px 8px',
            fontSize: 13,
          }}
        >
          <dt style={{ color: 'var(--gray-600)' }}>Name</dt>
          <dd style={{ margin: 0 }}>{c.patient_name ?? '—'}</dd>
          <dt style={{ color: 'var(--gray-600)' }}>ID</dt>
          <dd style={{ margin: 0 }}>{c.patient_id ?? '—'}</dd>
          <dt style={{ color: 'var(--gray-600)' }}>DOB</dt>
          <dd style={{ margin: 0 }}>{c.dob ?? '—'}</dd>
          <dt style={{ color: 'var(--gray-600)' }}>Diagnosis</dt>
          <dd style={{ margin: 0 }}>{c.diagnosis ?? '—'}</dd>
          <dt style={{ color: 'var(--gray-600)' }}>Stage</dt>
          <dd style={{ margin: 0 }}>{c.stage ?? '—'}</dd>
        </dl>
      </div>

      <div className="cl-card" style={{ padding: 'var(--cl-space-4)' }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.44px',
            color: 'var(--gray-700)',
            marginBottom: 8,
          }}
        >
          Samples
        </div>
        {samples.length === 0 && (
          <p style={{ color: 'var(--gray-500)', fontSize: 13 }}>
            No samples added
          </p>
        )}
        {samples.map((s) => (
          <div key={s.id} style={{ fontSize: 13, marginBottom: 6 }}>
            <span style={{ fontWeight: 700 }}>{s.sample_id ?? 'Sample'}</span>
            {s.sample_type && (
              <span style={{ color: 'var(--gray-600)', marginLeft: 6 }}>
                ({s.sample_type})
              </span>
            )}
            {s.fastq_path && (
              <div
                style={{
                  fontSize: 11,
                  color: 'var(--brand-600)',
                  marginTop: 2,
                  wordBreak: 'break-all',
                }}
              >
                {s.fastq_path}
              </div>
            )}
            {s.vcf_path && (
              <div
                style={{
                  fontSize: 11,
                  color: 'var(--brand-600)',
                  marginTop: 2,
                  wordBreak: 'break-all',
                }}
              >
                {s.vcf_path}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="cl-card" style={{ padding: 'var(--cl-space-4)' }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.44px',
            color: 'var(--gray-700)',
            marginBottom: 8,
          }}
        >
          Report Status
        </div>
        {report ? (
          <div>
            <span className={`cl-badge cl-badge-${report.status}`}>
              {report.status}
            </span>
            {report.protocol_version && (
              <div
                style={{ fontSize: 12, color: 'var(--gray-600)', marginTop: 6 }}
              >
                Protocol v{report.protocol_version}
              </div>
            )}
            {report.signed_by && (
              <div
                style={{
                  fontSize: 12,
                  color: 'var(--color-green-600)',
                  marginTop: 4,
                }}
              >
                Signed by {report.signed_by}
              </div>
            )}
          </div>
        ) : (
          <p style={{ color: 'var(--gray-500)', fontSize: 13 }}>
            No report generated
          </p>
        )}
      </div>

      {c.ehr_summary && (
        <div
          className="cl-card"
          style={{ padding: 'var(--cl-space-4)', gridColumn: '1 / -1' }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.44px',
              color: 'var(--gray-700)',
              marginBottom: 8,
            }}
          >
            EHR Summary
          </div>
          <p
            style={{
              margin: 0,
              fontSize: 13,
              color: 'var(--gray-700)',
              lineHeight: '22px',
            }}
          >
            {c.ehr_summary}
          </p>
        </div>
      )}
    </div>
  )
}

function FilesTab({ samples }: { samples: CaseSample[] }) {
  const files = samples
    .flatMap((s) => [
      s.fastq_path
        ? { path: s.fastq_path, type: 'FASTQ', sample: s.sample_id }
        : null,
      s.vcf_path
        ? { path: s.vcf_path, type: 'VCF', sample: s.sample_id }
        : null,
    ])
    .filter(Boolean) as { path: string; type: string; sample: string | null }[]

  return (
    <div className="cl-card">
      <table className="cl-table">
        <thead>
          <tr>
            <th>Type</th>
            <th>Sample</th>
            <th>Path</th>
          </tr>
        </thead>
        <tbody>
          {files.length === 0 && (
            <tr>
              <td
                colSpan={3}
                style={{
                  color: 'var(--gray-500)',
                  textAlign: 'center',
                  padding: 24,
                }}
              >
                No files linked
              </td>
            </tr>
          )}
          {files.map((f, i) => (
            <tr key={i}>
              <td>
                <span className="cl-badge cl-badge-closed">{f.type}</span>
              </td>
              <td style={{ color: 'var(--gray-700)' }}>{f.sample ?? '—'}</td>
              <td
                style={{
                  fontSize: 11,
                  color: 'var(--brand-600)',
                  wordBreak: 'break-all',
                }}
              >
                {f.path}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function RunsTab({ caseId }: { caseId: string }) {
  const { data: allRuns = [] } = useQuery({
    queryKey: ['genomics', 'runs'],
    queryFn: async () => {
      const res = await fetch('/api/genomics/runs')
      return (
        (await res.json()) as {
          runs: import('../../server/genomics/types').Run[]
        }
      ).runs
    },
  })
  return (
    <div className="cl-card">
      <table className="cl-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Pipeline</th>
            <th>Reference</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {allRuns.length === 0 && (
            <tr>
              <td
                colSpan={4}
                style={{
                  color: 'var(--gray-500)',
                  textAlign: 'center',
                  padding: 24,
                }}
              >
                No linked runs
              </td>
            </tr>
          )}
          {allRuns.map((r) => (
            <tr key={r.id}>
              <td style={{ fontWeight: 700 }}>{r.name}</td>
              <td>{r.pipeline}</td>
              <td style={{ color: 'var(--gray-700)' }}>{r.reference ?? '—'}</td>
              <td>
                <span className={`cl-badge cl-badge-${r.status}`}>
                  {r.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function HistoryTab({ report }: { report: Report | null }) {
  if (!report)
    return (
      <div style={{ color: 'var(--gray-500)', padding: 24 }}>
        No report history
      </div>
    )
  return (
    <div className="cl-card" style={{ padding: 'var(--cl-space-4)' }}>
      <div style={{ fontSize: 13 }}>
        <div>
          Report created:{' '}
          <strong>{new Date(report.created_at).toLocaleString()}</strong>
        </div>
        {report.protocol_version && (
          <div style={{ marginTop: 4 }}>
            Generated with Protocol v<strong>{report.protocol_version}</strong>
          </div>
        )}
        {report.signed_by && (
          <div style={{ marginTop: 4, color: 'var(--color-green-600)' }}>
            Signed by <strong>{report.signed_by}</strong> at{' '}
            {new Date(report.signed_at!).toLocaleString()}
          </div>
        )}
        {!report.signed_by && (
          <div style={{ marginTop: 4, color: 'var(--gray-500)' }}>
            Not yet signed
          </div>
        )}
      </div>
    </div>
  )
}
