import { createFileRoute } from '@tanstack/react-router'
import { requireLocalOrAuth } from '../../../server/auth-middleware'
import { getCase, updateCase, listSamples, addSample } from '../../../server/genomics/cases-store'

export const Route = createFileRoute('/api/genomics/cases/$caseId')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        if (!requireLocalOrAuth(request)) return Response.json({ error: 'Unauthorized' }, { status: 401 })
        const c = getCase(undefined, params.caseId)
        if (!c) return Response.json({ error: 'Not found' }, { status: 404 })
        const samples = listSamples(undefined, params.caseId)
        return Response.json({ case: c, samples })
      },
      PUT: async ({ request, params }) => {
        if (!requireLocalOrAuth(request)) return Response.json({ error: 'Unauthorized' }, { status: 401 })
        const body = await request.json() as Record<string, unknown>
        const updated = updateCase(undefined, params.caseId, body as Parameters<typeof updateCase>[2])
        if (!updated) return Response.json({ error: 'Not found' }, { status: 404 })
        return Response.json({ case: updated })
      },
    },
  },
})
