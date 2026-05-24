// src/server/genomics/protocols-store.ts
import { randomUUID } from 'node:crypto'
import type Database from 'better-sqlite3'
import { db as defaultDb } from './db'
import type { Protocol, ProtocolVariable } from './types'

type CreateProtocolInput = Omit<Protocol, 'id' | 'is_active' | 'created_at' | 'updated_at'>

function deserializeProtocol(row: Record<string, unknown>): Protocol {
  return {
    ...row,
    skills: JSON.parse(row.skills as string),
    variables: JSON.parse(row.variables as string),
  } as Protocol
}

export function listProtocols(
  db: Database.Database = defaultDb,
  filter?: { assay_type?: string; active_only?: boolean },
): Protocol[] {
  let sql = 'SELECT * FROM protocols WHERE 1=1'
  const params: unknown[] = []
  if (filter?.active_only !== false) { sql += ' AND is_active = 1'; }
  if (filter?.assay_type) { sql += ' AND assay_type = ?'; params.push(filter.assay_type) }
  sql += ' ORDER BY name, version DESC'
  return (db.prepare(sql).all(...params) as Record<string, unknown>[]).map(deserializeProtocol)
}

export function getProtocol(db: Database.Database = defaultDb, id: string): Protocol | null {
  const row = db.prepare('SELECT * FROM protocols WHERE id = ?').get(id) as Record<string, unknown> | undefined
  return row ? deserializeProtocol(row) : null
}

export function createProtocol(db: Database.Database = defaultDb, input: CreateProtocolInput): Protocol {
  const id = randomUUID()
  const now = Date.now()
  db.prepare(`
    INSERT INTO protocols (id, name, version, assay_type, description, prompt_template, skills, variables, is_active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
  `).run(id, input.name, input.version, input.assay_type, input.description ?? null, input.prompt_template, JSON.stringify(input.skills), JSON.stringify(input.variables), now, now)
  return getProtocol(db, id)!
}

export function updateProtocol(
  db: Database.Database = defaultDb,
  id: string,
  patch: Partial<Omit<Protocol, 'id' | 'created_at' | 'updated_at'>>,
): Protocol | null {
  const serialized: Record<string, unknown> = { ...patch }
  if (patch.skills) serialized.skills = JSON.stringify(patch.skills)
  if (patch.variables) serialized.variables = JSON.stringify(patch.variables)
  const fields = Object.keys(serialized)
  if (fields.length === 0) return getProtocol(db, id)
  const setClauses = fields.map((f) => `${f} = ?`).join(', ')
  const values = fields.map((f) => serialized[f] ?? null)
  db.prepare(`UPDATE protocols SET ${setClauses}, updated_at = ? WHERE id = ?`).run(...values, Date.now(), id)
  return getProtocol(db, id)
}

export function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`)
}

export function resolveVariables(
  protocol: Protocol,
  caseData: Record<string, unknown>,
  overrides: Record<string, string> = {},
): Record<string, string> {
  const resolved: Record<string, string> = {}
  for (const v of protocol.variables) {
    if (overrides[v.name] !== undefined) {
      resolved[v.name] = overrides[v.name]
    } else if (v.source.startsWith('case.')) {
      const field = v.source.slice(5)
      resolved[v.name] = String(caseData[field] ?? '')
    } else {
      resolved[v.name] = ''
    }
  }
  return resolved
}

// Touch the type-only import so TS `verbatimModuleSyntax` doesn't error
export type { ProtocolVariable }
