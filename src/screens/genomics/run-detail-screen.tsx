import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, Link } from '@tanstack/react-router'
import { useEffect, useRef } from 'react'
import { useGenomicsStore } from '../../stores/genomics-store'
import type { Run, RunStage } from '../../server/genomics/types'

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

async function fetchGpuTelemetry(): Promise<GpuTelemetry | null> {
  const res = await fetch('/api/genomics/gpu')
  if (res.status === 503) return null
  if (!res.ok) throw new Error('Failed to fetch GPU telemetry')
  return (await res.json()) as GpuTelemetry
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
    <div style={{ display: 'grid', gap: 6 }}>
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

async function fetchRun(id: string): Promise<{ run: Run; stages: RunStage[] }> {
  const res = await fetch(`/api/genomics/runs/${id}`)
  if (!res.ok) throw new Error('Failed to fetch run')
  return res.json() as Promise<{ run: Run; stages: RunStage[] }>
}

const STAGE_ICON: Record<string, string> = {
  completed: '✓',
  running: '⟳',
  pending: '○',
  failed: '✗',
}

async function startRun(id: string): Promise<void> {
  const res = await fetch(`/api/genomics/runs/${id}/start`, { method: 'POST' })
  if (!res.ok) {
    const err = (await res.json()) as { error: string }
    throw new Error(err.error ?? 'Failed to start run')
  }
}

export function RunDetailScreen() {
  const { runId } = useParams({ from: '/genomics/runs_/$runId' })
  const appendRunLog = useGenomicsStore((s) => s.appendRunLog)
  const clearRunLog = useGenomicsStore((s) => s.clearRunLog)
  const logLines = useGenomicsStore((s) => s.runLogs[runId] ?? [])
  const logRef = useRef<HTMLDivElement>(null)
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['genomics', 'run', runId],
    queryFn: () => fetchRun(runId),
    refetchInterval: 3000,
  })

  const { data: gpu } = useQuery({
    queryKey: ['genomics', 'gpu'],
    queryFn: fetchGpuTelemetry,
    refetchInterval: 3000,
    retry: false,
  })

  const startMutation = useMutation({
    mutationFn: () => startRun(runId),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['genomics', 'run', runId] }),
  })

  // SSE log stream
  useEffect(() => {
    clearRunLog(runId)
    const es = new EventSource(`/api/genomics/runs/${runId}/log`)
    es.onmessage = (e) => {
      const parsed = JSON.parse(e.data) as { line: string }
      if (parsed.line) appendRunLog(runId, parsed.line)
    }
    return () => es.close()
  }, [runId, appendRunLog, clearRunLog])

  // Auto-scroll log
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [logLines])

  if (isLoading)
    return (
      <div className="cl-content" style={{ color: 'var(--gray-500)' }}>
        Loading…
      </div>
    )
  if (!data)
    return (
      <div className="cl-content" style={{ color: 'var(--color-red-600)' }}>
        Run not found
      </div>
    )

  const { run, stages } = data

  return (
    <div>
      <div className="cl-title-bar">
        <Link
          to="/genomics/runs"
          style={{ color: 'var(--brand-600)', fontSize: 12, marginRight: 8 }}
        >
          ← Runs
        </Link>
        <h1 style={{ marginRight: 12 }}>{run.name}</h1>
        <span className={`cl-badge cl-badge-${run.status}`}>{run.status}</span>
        <span style={{ fontSize: 13, color: 'var(--gray-700)', marginLeft: 8 }}>
          {run.pipeline}
          {run.reference ? ` · ${run.reference}` : ''}
        </span>
        <div
          style={{
            marginLeft: 'auto',
            display: 'flex',
            gap: 8,
            alignItems: 'center',
          }}
        >
          {run.status === 'queued' && (
            <button
              className="cl-btn cl-btn-primary cl-btn-sm"
              onClick={() => startMutation.mutate()}
              disabled={startMutation.isPending}
            >
              {startMutation.isPending ? 'Starting…' : '▶ Start Run'}
            </button>
          )}
          {startMutation.isError && (
            <span style={{ fontSize: 12, color: 'var(--red-600)' }}>
              {(startMutation.error as Error).message}
            </span>
          )}
        </div>
      </div>

      <div className="cl-content">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '2fr 3fr',
            gap: 'var(--cl-space-4)',
            alignItems: 'start',
          }}
        >
          {/* Left: pipeline stages */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--cl-space-3)',
            }}
          >
            <div className="cl-card" style={{ padding: 'var(--cl-space-3)' }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.44px',
                  color: 'var(--gray-700)',
                  marginBottom: 8,
                  padding: '0 var(--cl-space-1)',
                }}
              >
                Pipeline Stages
              </div>
              <div className="cl-stage-list">
                {stages.length === 0 && (
                  <div
                    style={{
                      color: 'var(--gray-500)',
                      fontSize: 12,
                      padding: 8,
                    }}
                  >
                    No stages recorded
                  </div>
                )}
                {stages.map((s) => {
                  const elapsed = s.started_at
                    ? s.finished_at
                      ? `${Math.round((s.finished_at - s.started_at) / 1000)}s`
                      : `${Math.round((Date.now() - s.started_at) / 60000)}m…`
                    : null
                  return (
                    <div key={s.id} className={`cl-stage-row ${s.status}`}>
                      <span
                        style={{
                          fontWeight: 700,
                          width: 14,
                          textAlign: 'center',
                        }}
                      >
                        {STAGE_ICON[s.status] ?? '?'}
                      </span>
                      <span style={{ flex: 1 }}>{s.name}</span>
                      {elapsed && (
                        <span style={{ fontSize: 10, opacity: 0.8 }}>
                          {elapsed}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
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
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.44px',
                      color: 'var(--gray-700)',
                    }}
                  >
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

          {/* Right: live log + metrics */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--cl-space-3)',
            }}
          >
            <div className="cl-card" style={{ padding: 0, overflow: 'hidden' }}>
              <div
                style={{
                  padding: '8px 12px',
                  borderBottom: '1px solid var(--gray-200)',
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.44px',
                  color: 'var(--gray-700)',
                }}
              >
                Live Log
              </div>
              <div
                ref={logRef}
                style={{
                  fontFamily: 'monospace',
                  fontSize: 11,
                  padding: 12,
                  height: 300,
                  overflowY: 'auto',
                  background: 'var(--gray-950)',
                  color: '#4ade80',
                  lineHeight: '18px',
                }}
              >
                {logLines.length === 0 && (
                  <span style={{ color: '#555' }}>Waiting for log output…</span>
                )}
                {logLines.map((line, i) => (
                  <div key={i}>{line}</div>
                ))}
              </div>
            </div>

            {/* Metrics */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 'var(--cl-space-3)',
              }}
            >
              {[
                { label: 'Pipeline', value: run.pipeline },
                { label: 'Reference', value: run.reference ?? '—' },
                { label: 'Status', value: run.status },
              ].map((m) => (
                <div
                  key={m.label}
                  className="cl-card cl-stat-card"
                  style={{ padding: 'var(--cl-space-3)' }}
                >
                  <div className="label">{m.label}</div>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: 'var(--gray-900)',
                    }}
                  >
                    {m.value}
                  </div>
                </div>
              ))}
            </div>

            {run.run_config &&
              (() => {
                const cfg = JSON.parse(run.run_config) as {
                  input_dir?: string
                  samples?: string[]
                  output_dir?: string
                }
                return (
                  <div
                    className="cl-card"
                    style={{ padding: 'var(--cl-space-3)' }}
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
                      Run Config
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 4,
                        fontSize: 12,
                      }}
                    >
                      {cfg.input_dir && (
                        <div>
                          <span style={{ color: 'var(--gray-600)' }}>
                            Input:{' '}
                          </span>
                          {cfg.input_dir}
                        </div>
                      )}
                      {run.output_dir && (
                        <div>
                          <span style={{ color: 'var(--gray-600)' }}>
                            Output:{' '}
                          </span>
                          {run.output_dir}
                        </div>
                      )}
                      {cfg.samples && (
                        <div>
                          <span style={{ color: 'var(--gray-600)' }}>
                            Samples:{' '}
                          </span>
                          {cfg.samples.join(', ')}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })()}
          </div>
        </div>
      </div>
    </div>
  )
}
