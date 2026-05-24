// src/routes/api/genomics/protocols.$protocolId.preview.ts
import { createFileRoute } from '@tanstack/react-router'
import { requireLocalOrAuth } from '../../../server/auth-middleware'
import { getProtocol, renderTemplate, resolveVariables } from '../../../server/genomics/protocols-store'
import { getCase } from '../../../server/genomics/cases-store'

export const Route = createFileRoute('/api/genomics/protocols/$protocolId/preview')({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        if (!requireLocalOrAuth(request)) return Response.json({ error: 'Unauthorized' }, { status: 401 })
        const body = await request.json() as { case_id?: string; overrides?: Record<string, string> }
        const protocol = getProtocol(undefined, params.protocolId)
        if (!protocol) return Response.json({ error: 'Not found' }, { status: 404 })
        const caseData = body.case_id ? (getCase(undefined, body.case_id) ?? {}) : {}
        const vars = resolveVariables(protocol, caseData as Record<string, unknown>, body.overrides ?? {})
        const rendered = renderTemplate(protocol.prompt_template, vars)
        return Response.json({ rendered, vars })
      },
    },
  },
})
