import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import type { Case, Run } from '../../server/genomics/types'

type Gpu = {
  index: number
  uuid: string
  name: string
  utilization_pct: number
  memory_used_mib: number
  memory_total_mib: number
  power_draw_w: number
}

type GpuProcess = {
  gpu_uuid: string
  pid: number
  process_name: string
  used_memory_mib: number
}

type GpuTelemetry = {
  gpus: Array<Gpu>
  processes: Array<GpuProcess>
  captured_at: string
}

async function fetchCases(): Promise<Array<Case>> {
  const res = await fetch('/api/genomics/cases')
  if (!res.ok) throw new Error('Failed to fetch cases')
  const data = (await res.json()) as { cases: Array<Case> }
  return data.cases
}

async function fetchRuns(): Promise<Array<Run>> {
  const res = await fetch('/api/genomics/runs')
  if (!res.ok) throw new Error('Failed to fetch runs')
  const data = (await res.json()) as { runs: Array<Run> }
  return data.runs
}

async function fetchGpuTelemetry(): Promise<GpuTelemetry | null> {
  const res = await fetch('/api/genomics/gpu')
  if (res.status === 503) return null
  if (!res.ok) throw new Error('Failed to fetch GPU telemetry')
  return (await res.json()) as GpuTelemetry
}

function StatusBadge({ status }: { status: string }) {
  return <span className={`cl-badge cl-badge-${status}`}>{status}</span>
}

function formatGiB(mib: number): string {
  return `${(mib / 1024).toFixed(1)} GiB`
}

function MetricRow({
  label,
  pct,
  value,
}: {
  label: string
  pct: number
  value: string
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        fontSize: 11,
        color: 'var(--gray-600)',
      }}
    >
      <span style={{ width: 28 }}>{label}</span>
      <div
        style={{
          flex: 1,
          height: 4,
          background: 'var(--gray-100)',
          borderRadius: 2,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${Math.min(100, pct)}%`,
            height: '100%',
            background: 'var(--brand-600)',
          }}
        />
      </div>
      <span
        style={{
          fontVariantNumeric: 'tabular-nums',
          color: 'var(--gray-700)',
          textAlign: 'right',
          minWidth: 92,
        }}
      >
        {value}
      </span>
    </div>
  )
}

function GpuCard({
  gpu,
  processes,
}: {
  gpu: Gpu
  processes: Array<GpuProcess>
}) {
  const memPct = (gpu.memory_used_mib / gpu.memory_total_mib) * 100
  return (
    <div
      className="cl-card"
      style={{ padding: 12, display: 'grid', gap: 6 }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          gap: 8,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 6,
            minWidth: 0,
            flex: 1,
          }}
        >
          <span style={{ fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
            GPU {gpu.index}
          </span>
          <span
            style={{
              fontSize: 10,
              color: 'var(--gray-500)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={gpu.name}
          >
            {gpu.name}
          </span>
        </div>
        <span
          style={{
            fontSize: 11,
            color: 'var(--gray-500)',
            fontVariantNumeric: 'tabular-nums',
            flexShrink: 0,
          }}
        >
          {gpu.power_draw_w.toFixed(0)} W
        </span>
      </div>

      <MetricRow
        label="util"
        pct={gpu.utilization_pct}
        value={`${gpu.utilization_pct}%`}
      />
      <MetricRow
        label="mem"
        pct={memPct}
        value={`${formatGiB(gpu.memory_used_mib)} / ${formatGiB(gpu.memory_total_mib)}`}
      />

      {processes.length > 0 && (
        <div
          style={{
            fontSize: 11,
            color: 'var(--gray-700)',
            display: 'grid',
            gap: 2,
            paddingTop: 4,
            borderTop: '1px solid var(--gray-100)',
          }}
        >
          {processes.map((p) => (
            <div
              key={`${p.pid}-${p.process_name}`}
              style={{ display: 'flex', justifyContent: 'space-between' }}
            >
              <span
                style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  marginRight: 8,
                }}
                title={`${p.process_name} (PID ${p.pid})`}
              >
                {p.process_name}
              </span>
              <span
                style={{
                  color: 'var(--gray-500)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {formatGiB(p.used_memory_mib)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function GenomicsDashboard() {
  const { data: cases = [] } = useQuery({
    queryKey: ['genomics', 'cases'],
    queryFn: fetchCases,
  })
  const { data: runs = [] } = useQuery({
    queryKey: ['genomics', 'runs'],
    queryFn: fetchRuns,
  })
  const { data: gpu } = useQuery({
    queryKey: ['genomics', 'gpu'],
    queryFn: fetchGpuTelemetry,
    refetchInterval: 3000,
    retry: false,
  })

  const openCases = cases.filter((c) => c.status === 'active').length
  const activeRuns = runs.filter(
    (r) => r.status === 'running' || r.status === 'queued',
  ).length
  const recentCases = cases.slice(0, 5)
  const activeRunsList = runs
    .filter((r) => r.status === 'running' || r.status === 'queued')
    .slice(0, 5)

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

        {/* Two columns: Recent Cases (left, full height) | stacked Active Runs + GPU Utilization (right) */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 'var(--cl-space-4)',
            alignItems: 'start',
          }}
        >
          {/* Recent Cases */}
          <div className="cl-card">
            <div
              style={{
                padding: 'var(--cl-space-4)',
                borderBottom: '1px solid var(--gray-200)',
                display: 'flex',
                justifyContent: 'space-between',
              }}
            >
              <span style={{ fontWeight: 700, fontSize: 14 }}>
                Recent Cases
              </span>
              <Link
                to="/genomics/cases"
                style={{ fontSize: 12, color: 'var(--brand-600)' }}
              >
                View all →
              </Link>
            </div>
            <table className="cl-table">
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Diagnosis</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentCases.length === 0 && (
                  <tr>
                    <td
                      colSpan={3}
                      style={{ color: 'var(--gray-500)', textAlign: 'center' }}
                    >
                      No cases yet
                    </td>
                  </tr>
                )}
                {recentCases.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() =>
                      (window.location.href = `/genomics/cases/${c.id}`)
                    }
                  >
                    <td>{c.patient_name ?? '—'}</td>
                    <td style={{ color: 'var(--gray-700)' }}>
                      {c.diagnosis ?? '—'}
                    </td>
                    <td>
                      <StatusBadge status={c.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Right column: Active Runs on top, GPU Utilization below */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--cl-space-4)',
              minWidth: 0,
            }}
          >
            <div className="cl-card">
              <div
                style={{
                  padding: 'var(--cl-space-4)',
                  borderBottom: '1px solid var(--gray-200)',
                  display: 'flex',
                  justifyContent: 'space-between',
                }}
              >
                <span style={{ fontWeight: 700, fontSize: 14 }}>Active Runs</span>
                <Link
                  to="/genomics/runs"
                  style={{ fontSize: 12, color: 'var(--brand-600)' }}
                >
                  View all →
                </Link>
              </div>
              <table className="cl-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Pipeline</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {activeRunsList.length === 0 && (
                    <tr>
                      <td
                        colSpan={3}
                        style={{ color: 'var(--gray-500)', textAlign: 'center' }}
                      >
                        No active runs
                      </td>
                    </tr>
                  )}
                  {activeRunsList.map((r) => (
                    <tr
                      key={r.id}
                      onClick={() =>
                        (window.location.href = `/genomics/runs/${r.id}`)
                      }
                    >
                      <td>{r.name}</td>
                      <td style={{ color: 'var(--gray-700)' }}>{r.pipeline}</td>
                      <td>
                        <StatusBadge status={r.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {gpu && gpu.gpus.length > 0 && (
              <div className="cl-card">
                <div
                  style={{
                    padding: 'var(--cl-space-3) var(--cl-space-4)',
                    borderBottom: '1px solid var(--gray-200)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'baseline',
                  }}
                >
                  <span style={{ fontWeight: 700, fontSize: 13 }}>
                    GPU Utilization
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      color: 'var(--gray-500)',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {new Date(gpu.captured_at).toLocaleTimeString()}
                  </span>
                </div>
                <div
                  style={{
                    padding: 'var(--cl-space-3)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 'var(--cl-space-3)',
                  }}
                >
                  {gpu.gpus.map((g) => (
                    <GpuCard
                      key={g.uuid}
                      gpu={g}
                      processes={gpu.processes.filter(
                        (p) => p.gpu_uuid === g.uuid,
                      )}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
