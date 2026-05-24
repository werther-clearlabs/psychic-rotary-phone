import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import type { Protocol } from '../../server/genomics/types'

async function fetchProtocols(): Promise<Array<Protocol>> {
  const res = await fetch('/api/genomics/protocols')
  return ((await res.json()) as { protocols: Array<Protocol> }).protocols
}

async function createProtocol(
  body: Omit<Protocol, 'id' | 'is_active' | 'created_at' | 'updated_at'>,
): Promise<Protocol> {
  const res = await fetch('/api/genomics/protocols', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return ((await res.json()) as { protocol: Protocol }).protocol
}

export function ProtocolListScreen() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { data: protocols = [], isLoading } = useQuery({
    queryKey: ['genomics', 'protocols'],
    queryFn: fetchProtocols,
  })
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    name: '',
    version: '1.0',
    assay_type: 'WGS',
    description: '',
    prompt_template: '',
    skills: '',
    variables: '[]',
  })

  const mutation = useMutation({
    mutationFn: (f: typeof form) =>
      createProtocol({
        ...f,
        skills: f.skills
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        variables: JSON.parse(f.variables) as Protocol['variables'],
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['genomics', 'protocols'] })
      setShowForm(false)
    },
  })

  return (
    <div>
      <div className="cl-title-bar">
        <h1>Protocols</h1>
        <div style={{ marginLeft: 'auto' }}>
          <button
            className="cl-btn cl-btn-primary cl-btn-sm"
            onClick={() => setShowForm(true)}
          >
            + New Protocol
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
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 'var(--cl-space-3)',
              alignItems: 'flex-end',
              marginBottom: 'var(--cl-space-3)',
            }}
          >
            {(
              [
                { key: 'name', label: 'Protocol Name', width: 200 },
                { key: 'version', label: 'Version', width: 80 },
                { key: 'assay_type', label: 'Assay Type', width: 120 },
                { key: 'description', label: 'Description', width: 280 },
                {
                  key: 'skills',
                  label: 'Skills (comma-separated)',
                  width: 320,
                },
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
          </div>
          <label
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              fontSize: 11,
              marginBottom: 'var(--cl-space-3)',
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
              Prompt Template (use {'{{variable}}'} syntax)
            </span>
            <textarea
              value={form.prompt_template}
              onChange={(e) =>
                setForm((f) => ({ ...f, prompt_template: e.target.value }))
              }
              rows={4}
              style={{
                border: '1px solid var(--gray-400)',
                borderRadius: 'var(--cl-radius-sm)',
                padding: '6px 8px',
                fontSize: 12,
                width: '100%',
                fontFamily: 'monospace',
              }}
            />
          </label>
          <div style={{ display: 'flex', gap: 'var(--cl-space-2)' }}>
            <button
              className="cl-btn cl-btn-primary cl-btn-sm"
              onClick={() => mutation.mutate(form)}
              disabled={mutation.isPending}
            >
              {mutation.isPending ? 'Saving…' : 'Create Protocol'}
            </button>
            <button
              className="cl-btn cl-btn-tertiary cl-btn-sm"
              onClick={() => setShowForm(false)}
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
                <th>Version</th>
                <th>Assay Type</th>
                <th>Skills</th>
                <th>Status</th>
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
              {!isLoading && protocols.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    style={{
                      textAlign: 'center',
                      color: 'var(--gray-500)',
                      padding: 32,
                    }}
                  >
                    No protocols yet
                  </td>
                </tr>
              )}
              {protocols.map((p) => (
                <tr
                  key={p.id}
                  onClick={() =>
                    navigate({
                      to: '/genomics/protocols/$protocolId',
                      params: { protocolId: p.id },
                    })
                  }
                >
                  <td style={{ fontWeight: 700 }}>{p.name}</td>
                  <td style={{ color: 'var(--gray-700)' }}>v{p.version}</td>
                  <td>
                    <span className="cl-badge cl-badge-closed">
                      {p.assay_type}
                    </span>
                  </td>
                  <td style={{ color: 'var(--gray-600)', fontSize: 11 }}>
                    {p.skills.length} skills
                  </td>
                  <td>
                    <span
                      className={`cl-badge ${p.is_active ? 'cl-badge-active' : 'cl-badge-closed'}`}
                    >
                      {p.is_active ? 'Active' : 'Retired'}
                    </span>
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
