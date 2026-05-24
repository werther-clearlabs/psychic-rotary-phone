import { useQuery } from '@tanstack/react-query'
import { useParams, Link } from '@tanstack/react-router'
import { useEffect, useRef } from 'react'
import { useGenomicsStore } from '../../stores/genomics-store'
import type { Run, RunStage } from '../../server/genomics/types'

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

export function RunDetailScreen() {
  const { runId } = useParams({ from: '/genomics/runs_/$runId' })
  const appendRunLog = useGenomicsStore((s) => s.appendRunLog)
  const clearRunLog = useGenomicsStore((s) => s.clearRunLog)
  const logLines = useGenomicsStore((s) => s.runLogs[runId] ?? [])
  const logRef = useRef<HTMLDivElement>(null)

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['genomics', 'run', runId],
    queryFn: () => fetchRun(runId),
    refetchInterval: 3000, // poll every 3s while run may be active
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
      </div>

      <div className="cl-content">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '280px 1fr',
            gap: 'var(--cl-space-4)',
            alignItems: 'start',
          }}
        >
          {/* Left: pipeline stages */}
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
                  style={{ color: 'var(--gray-500)', fontSize: 12, padding: 8 }}
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

            {run.fastq_path && (
              <div className="cl-card" style={{ padding: 'var(--cl-space-3)' }}>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.44px',
                    color: 'var(--gray-700)',
                    marginBottom: 4,
                  }}
                >
                  FASTQ Path
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: 'var(--brand-600)',
                    wordBreak: 'break-all',
                  }}
                >
                  {run.fastq_path}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
