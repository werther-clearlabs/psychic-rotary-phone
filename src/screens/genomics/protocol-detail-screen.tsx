import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from '@tanstack/react-router'
import type { Protocol } from '../../server/genomics/types'

async function fetchProtocol(id: string): Promise<Protocol> {
  const res = await fetch(`/api/genomics/protocols/${id}`)
  if (!res.ok) throw new Error('Not found')
  return ((await res.json()) as { protocol: Protocol }).protocol
}

export function ProtocolDetailScreen() {
  const { protocolId } = useParams({ from: '/genomics/protocols/$protocolId' })
  const { data: protocol, isLoading } = useQuery({
    queryKey: ['genomics', 'protocol', protocolId],
    queryFn: () => fetchProtocol(protocolId),
  })

  if (isLoading)
    return (
      <div className="cl-content" style={{ color: 'var(--gray-500)' }}>
        Loading…
      </div>
    )
  if (!protocol)
    return (
      <div className="cl-content" style={{ color: 'var(--color-red-600)' }}>
        Protocol not found
      </div>
    )

  return (
    <div>
      <div className="cl-title-bar">
        <Link
          to="/genomics/protocols"
          style={{ color: 'var(--brand-600)', fontSize: 12, marginRight: 8 }}
        >
          ← Protocols
        </Link>
        <h1 style={{ marginRight: 12 }}>{protocol.name}</h1>
        <span className="cl-badge cl-badge-closed" style={{ marginRight: 8 }}>
          v{protocol.version}
        </span>
        <span className="cl-badge cl-badge-closed">{protocol.assay_type}</span>
        <span
          className={`cl-badge ${protocol.is_active ? 'cl-badge-active' : 'cl-badge-closed'}`}
          style={{ marginLeft: 8 }}
        >
          {protocol.is_active ? 'Active' : 'Retired'}
        </span>
      </div>

      <div className="cl-content">
        {protocol.description && (
          <div className="cl-card" style={{ padding: 'var(--cl-space-4)' }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.44px',
                color: 'var(--gray-700)',
                marginBottom: 6,
              }}
            >
              Description
            </div>
            <p
              style={{
                margin: 0,
                fontSize: 13,
                color: 'var(--gray-700)',
                lineHeight: '22px',
              }}
            >
              {protocol.description}
            </p>
          </div>
        )}

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
            Skill Sequence ({protocol.skills.length} skills)
          </div>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 6,
              alignItems: 'center',
            }}
          >
            {protocol.skills.map((s, i) => (
              <span
                key={s}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <span
                  style={{
                    background: 'var(--brand-100)',
                    color: 'var(--brand-700)',
                    padding: '3px 8px',
                    borderRadius: 'var(--cl-radius-xs)',
                    fontSize: 11,
                    fontFamily: "'Helvetica Condensed',Helvetica,sans-serif",
                  }}
                >
                  {s}
                </span>
                {i < protocol.skills.length - 1 && (
                  <span style={{ color: 'var(--gray-500)' }}>→</span>
                )}
              </span>
            ))}
          </div>
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
            Prompt Template
          </div>
          <pre
            style={{
              margin: 0,
              fontSize: 12,
              color: 'var(--gray-800)',
              background: 'var(--gray-100)',
              padding: 12,
              borderRadius: 'var(--cl-radius-sm)',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              lineHeight: '20px',
            }}
          >
            {protocol.prompt_template}
          </pre>
        </div>

        {protocol.variables.length > 0 && (
          <div className="cl-card">
            <table className="cl-table">
              <thead>
                <tr>
                  <th>Variable</th>
                  <th>Label</th>
                  <th>Source</th>
                  <th>Editable</th>
                </tr>
              </thead>
              <tbody>
                {protocol.variables.map((v) => (
                  <tr key={v.name}>
                    <td
                      style={{ fontFamily: 'monospace', fontSize: 12 }}
                    >{`{{${v.name}}}`}</td>
                    <td>{v.label}</td>
                    <td style={{ color: 'var(--gray-700)', fontSize: 12 }}>
                      {v.source}
                    </td>
                    <td>{v.editable ? '✓' : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
