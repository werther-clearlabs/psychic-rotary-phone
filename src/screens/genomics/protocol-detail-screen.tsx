import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from '@tanstack/react-router'
import { useState } from 'react'
import type { Protocol, ProtocolVariable } from '../../server/genomics/types'

async function fetchProtocol(id: string): Promise<Protocol> {
  const res = await fetch(`/api/genomics/protocols/${id}`)
  if (!res.ok) throw new Error('Not found')
  return ((await res.json()) as { protocol: Protocol }).protocol
}

async function updateProtocol(
  id: string,
  patch: Partial<Omit<Protocol, 'id' | 'created_at' | 'updated_at'>>,
): Promise<Protocol> {
  const res = await fetch(`/api/genomics/protocols/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  })
  if (!res.ok) throw new Error('Update failed')
  return ((await res.json()) as { protocol: Protocol }).protocol
}

const LABEL_STYLE = {
  fontSize: 11,
  fontWeight: 700,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.44px',
  color: 'var(--gray-700)',
  marginBottom: 6,
}

const INPUT_STYLE = {
  width: '100%',
  fontSize: 13,
  padding: '5px 8px',
  border: '1px solid var(--gray-300)',
  borderRadius: 'var(--cl-radius-xs)',
  background: 'var(--gray-50)',
  color: 'var(--gray-900)',
  boxSizing: 'border-box' as const,
}

type EditState = {
  name: string
  version: string
  assay_type: string
  description: string
  prompt_template: string
  skills: Array<string>
  variables: Array<ProtocolVariable>
  is_active: number
}

function buildEditState(p: Protocol): EditState {
  return {
    name: p.name,
    version: p.version,
    assay_type: p.assay_type,
    description: p.description ?? '',
    prompt_template: p.prompt_template,
    skills: [...p.skills],
    variables: p.variables.map((v) => ({ ...v })),
    is_active: p.is_active,
  }
}

const CELL_INPUT = {
  ...INPUT_STYLE,
  fontSize: 12,
  padding: '3px 6px',
}

type InstalledSkillsResponse = { skills: Array<{ name: string; slug: string }> }

function SkillsEditor({
  skills,
  onChange,
}: {
  skills: Array<string>
  onChange: (s: Array<string>) => void
}) {
  const [newSkill, setNewSkill] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)

  const installedQuery = useQuery({
    queryKey: ['skills-browser', 'installed-names'],
    queryFn: async (): Promise<InstalledSkillsResponse> => {
      const res = await fetch('/api/skills?tab=installed&limit=200&sort=name')
      if (!res.ok) throw new Error('Failed to fetch skills')
      return res.json() as Promise<InstalledSkillsResponse>
    },
    staleTime: 60_000,
  })

  const suggestions = (() => {
    const q = newSkill.trim().toLowerCase()
    if (!q || !installedQuery.data) return []
    return installedQuery.data.skills
      .filter((s) => !skills.includes(s.slug) && !skills.includes(s.name))
      .filter((s) => s.name.toLowerCase().includes(q) || s.slug.toLowerCase().includes(q))
      .slice(0, 7)
  })()

  function move(i: number, dir: -1 | 1) {
    const next = [...skills]
    const j = i + dir
    if (j < 0 || j >= next.length) return
    ;[next[i], next[j]] = [next[j], next[i]]
    onChange(next)
  }

  function add(value = newSkill) {
    const trimmed = value.trim()
    if (!trimmed) return
    onChange([...skills, trimmed])
    setNewSkill('')
    setShowSuggestions(false)
  }

  return (
    <div>
      {skills.map((s, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <span
            style={{
              flex: 1,
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
          <button
            type="button"
            onClick={() => move(i, -1)}
            disabled={i === 0}
            style={{ background: 'none', border: 'none', cursor: i === 0 ? 'not-allowed' : 'pointer', opacity: i === 0 ? 0.3 : 1, fontSize: 12, padding: '2px 4px', color: 'var(--gray-600)' }}
          >↑</button>
          <button
            type="button"
            onClick={() => move(i, 1)}
            disabled={i === skills.length - 1}
            style={{ background: 'none', border: 'none', cursor: i === skills.length - 1 ? 'not-allowed' : 'pointer', opacity: i === skills.length - 1 ? 0.3 : 1, fontSize: 12, padding: '2px 4px', color: 'var(--gray-600)' }}
          >↓</button>
          <button
            type="button"
            onClick={() => onChange(skills.filter((_, idx) => idx !== i))}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, padding: '2px 4px', color: 'var(--gray-400)' }}
          >×</button>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 6, marginTop: 6, position: 'relative' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <input
            value={newSkill}
            onChange={(e) => { setNewSkill(e.target.value); setShowSuggestions(true) }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 120)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); add() }
              if (e.key === 'Escape') setShowSuggestions(false)
            }}
            placeholder="Add skill…"
            style={{ ...INPUT_STYLE }}
          />
          {showSuggestions && suggestions.length > 0 && (
            <div style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              zIndex: 50,
              marginTop: 2,
              background: 'var(--gray-0, #fff)',
              border: '1px solid var(--gray-300)',
              borderRadius: 'var(--cl-radius-sm)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              overflow: 'hidden',
            }}>
              {suggestions.map((s) => (
                <button
                  key={s.slug}
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); add(s.slug) }}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    padding: '6px 10px',
                    fontSize: 12,
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--gray-800)',
                    borderBottom: '1px solid var(--gray-100)',
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--brand-50)' }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'none' }}
                >
                  <span style={{ fontFamily: "'Helvetica Condensed',Helvetica,sans-serif", color: 'var(--brand-700)' }}>{s.name}</span>
                  {s.slug !== s.name && (
                    <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--gray-500)' }}>{s.slug}</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => add()}
          style={{ padding: '4px 10px', fontSize: 12, border: '1px solid var(--brand-500)', borderRadius: 'var(--cl-radius-xs)', background: 'var(--brand-50)', color: 'var(--brand-600)', cursor: 'pointer', whiteSpace: 'nowrap' }}
        >
          Add
        </button>
      </div>
    </div>
  )
}

export function ProtocolDetailScreen() {
  const { protocolId } = useParams({ from: '/genomics/protocols_/$protocolId' })
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<EditState | null>(null)

  const { data: protocol, isLoading } = useQuery({
    queryKey: ['genomics', 'protocol', protocolId],
    queryFn: () => fetchProtocol(protocolId),
  })

  const mutation = useMutation({
    mutationFn: (patch: EditState) =>
      updateProtocol(protocolId, {
        ...patch,
        description: patch.description || null,
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData(['genomics', 'protocol', protocolId], updated)
      setEditing(false)
      setDraft(null)
    },
  })

  function startEdit() {
    if (!protocol) return
    setDraft(buildEditState(protocol))
    setEditing(true)
  }

  function cancelEdit() {
    setEditing(false)
    setDraft(null)
    mutation.reset()
  }

  function set<TKey extends keyof EditState>(key: TKey, value: EditState[TKey]) {
    setDraft((d) => (d ? { ...d, [key]: value } : d))
  }

  function setVariable(i: number, field: keyof ProtocolVariable, value: string | boolean) {
    setDraft((d) => {
      if (!d) return d
      const vars = d.variables.map((v, idx) => (idx === i ? { ...v, [field]: value } : v))
      return { ...d, variables: vars }
    })
  }

  function addVariable() {
    setDraft((d) => {
      if (!d) return d
      return {
        ...d,
        variables: [...d.variables, { name: '', label: '', source: '', editable: false }],
      }
    })
  }

  function removeVariable(i: number) {
    setDraft((d) => {
      if (!d) return d
      return { ...d, variables: d.variables.filter((_, idx) => idx !== i) }
    })
  }

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

  const p = editing && draft ? { ...protocol, ...draft } : protocol

  return (
    <div>
      <div className="cl-title-bar">
        <Link
          to="/genomics/protocols"
          style={{ color: 'var(--brand-600)', fontSize: 12, marginRight: 8 }}
        >
          ← Protocols
        </Link>
        {editing && draft ? (
          <input
            value={draft.name}
            onChange={(e) => set('name', e.target.value)}
            style={{ ...INPUT_STYLE, width: 220, marginRight: 8, fontSize: 15, fontWeight: 600 }}
          />
        ) : (
          <h1 style={{ marginRight: 12 }}>{protocol.name}</h1>
        )}
        {editing && draft ? (
          <input
            value={draft.version}
            onChange={(e) => set('version', e.target.value)}
            placeholder="version"
            style={{ ...INPUT_STYLE, width: 70, marginRight: 8 }}
          />
        ) : (
          <span className="cl-badge cl-badge-closed" style={{ marginRight: 8 }}>
            v{protocol.version}
          </span>
        )}
        {editing && draft ? (
          <input
            value={draft.assay_type}
            onChange={(e) => set('assay_type', e.target.value)}
            placeholder="assay type"
            style={{ ...INPUT_STYLE, width: 130, marginRight: 8 }}
          />
        ) : (
          <span className="cl-badge cl-badge-closed">{protocol.assay_type}</span>
        )}
        {editing && draft ? (
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              marginLeft: 8,
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={draft.is_active === 1}
              onChange={(e) => set('is_active', e.target.checked ? 1 : 0)}
            />
            Active
          </label>
        ) : (
          <span
            className={`cl-badge ${protocol.is_active ? 'cl-badge-active' : 'cl-badge-closed'}`}
            style={{ marginLeft: 8 }}
          >
            {protocol.is_active ? 'Active' : 'Retired'}
          </span>
        )}

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          {editing ? (
            <>
              <button
                className="cl-btn cl-btn-sm cl-btn-secondary"
                onClick={cancelEdit}
                disabled={mutation.isPending}
              >
                Cancel
              </button>
              <button
                className="cl-btn cl-btn-sm cl-btn-primary"
                onClick={() => draft && mutation.mutate(draft)}
                disabled={mutation.isPending || !draft}
              >
                {mutation.isPending ? 'Saving…' : 'Save'}
              </button>
            </>
          ) : (
            <button className="cl-btn cl-btn-sm cl-btn-secondary" onClick={startEdit}>
              Edit
            </button>
          )}
        </div>
      </div>

      {mutation.isError && (
        <div
          style={{
            padding: '8px 16px',
            background: 'var(--color-red-50)',
            color: 'var(--color-red-600)',
            fontSize: 12,
          }}
        >
          Save failed — please try again.
        </div>
      )}

      <div className="cl-content">
        {(editing && draft ? true : !!protocol.description) && (
          <div className="cl-card" style={{ padding: 'var(--cl-space-4)' }}>
            <div style={LABEL_STYLE}>Description</div>
            {editing && draft ? (
              <textarea
                value={draft.description}
                onChange={(e) => set('description', e.target.value)}
                placeholder="Optional description…"
                rows={3}
                style={{ ...INPUT_STYLE, resize: 'vertical', lineHeight: '20px' }}
              />
            ) : (
              <p style={{ margin: 0, fontSize: 13, color: 'var(--gray-700)', lineHeight: '22px' }}>
                {protocol.description}
              </p>
            )}
          </div>
        )}

        <div className="cl-card" style={{ padding: 'var(--cl-space-4)' }}>
          <div style={{ ...LABEL_STYLE, marginBottom: 8 }}>
            Skill Sequence ({p.skills.length} skills)
          </div>
          {editing && draft ? (
            <SkillsEditor skills={draft.skills} onChange={(s) => set('skills', s)} />
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
              {p.skills.map((s, i) => (
                <span key={s} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
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
                  {i < p.skills.length - 1 && (
                    <span style={{ color: 'var(--gray-500)' }}>→</span>
                  )}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="cl-card" style={{ padding: 'var(--cl-space-4)' }}>
          <div style={{ ...LABEL_STYLE, marginBottom: 8 }}>Prompt Template</div>
          {editing && draft ? (
            <textarea
              value={draft.prompt_template}
              onChange={(e) => set('prompt_template', e.target.value)}
              rows={12}
              style={{
                ...INPUT_STYLE,
                fontFamily: 'monospace',
                fontSize: 12,
                resize: 'vertical',
                lineHeight: '20px',
              }}
            />
          ) : (
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
          )}
        </div>

        {(editing && draft ? draft.variables.length > 0 : protocol.variables.length > 0) && (
          <div className="cl-card">
            <table className="cl-table">
              <thead>
                <tr>
                  <th>Variable</th>
                  <th>Label</th>
                  <th>Source</th>
                  <th>Editable</th>
                  {editing && <th />}
                </tr>
              </thead>
              <tbody>
                {(editing && draft ? draft.variables : protocol.variables).map((v, i) =>
                  editing && draft ? (
                    <tr key={i}>
                      <td>
                        <input
                          value={v.name}
                          onChange={(e) => setVariable(i, 'name', e.target.value)}
                          placeholder="name"
                          style={{ ...CELL_INPUT, fontFamily: 'monospace' }}
                        />
                      </td>
                      <td>
                        <input
                          value={v.label}
                          onChange={(e) => setVariable(i, 'label', e.target.value)}
                          placeholder="label"
                          style={CELL_INPUT}
                        />
                      </td>
                      <td>
                        <input
                          value={v.source}
                          onChange={(e) => setVariable(i, 'source', e.target.value)}
                          placeholder="case.field or manual"
                          style={CELL_INPUT}
                        />
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={v.editable}
                          onChange={(e) => setVariable(i, 'editable', e.target.checked)}
                        />
                      </td>
                      <td>
                        <button
                          type="button"
                          onClick={() => removeVariable(i)}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: 14,
                            color: 'var(--gray-400)',
                            padding: '0 4px',
                          }}
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  ) : (
                    <tr key={v.name}>
                      <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{`{{${v.name}}}`}</td>
                      <td>{v.label}</td>
                      <td style={{ color: 'var(--gray-700)', fontSize: 12 }}>{v.source}</td>
                      <td>{v.editable ? '✓' : '—'}</td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        )}

        {editing && draft && (
          <button
            type="button"
            className="cl-btn cl-btn-sm cl-btn-secondary"
            onClick={addVariable}
            style={{ marginTop: 4 }}
          >
            + Add Variable
          </button>
        )}
      </div>
    </div>
  )
}
