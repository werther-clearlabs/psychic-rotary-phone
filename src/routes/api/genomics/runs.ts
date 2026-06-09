import { createFileRoute } from '@tanstack/react-router'
import { requireLocalOrAuth } from '../../../server/auth-middleware'
import { listRuns, createRun, linkRunToCase } from '../../../server/genomics/runs-store'
import { getCase } from '../../../server/genomics/cases-store'

export const Route = createFileRoute('/api/genomics/runs')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!requireLocalOrAuth(request)) return Response.json({ error: 'Unauthorized' }, { status: 401 })
        return Response.json({ runs: listRuns() })
      },
      POST: async ({ request }) => {
        if (!requireLocalOrAuth(request)) return Response.json({ error: 'Unauthorized' }, { status: 401 })
        const body = await request.json() as Parameters<typeof createRun>[1]

        if (!body.case_id) return Response.json({ error: 'case_id is required' }, { status: 400 })
        const c = getCase(undefined, body.case_id)
        if (!c) return Response.json({ error: 'Case not found' }, { status: 404 })

        const r = createRun(undefined, body)
        linkRunToCase(undefined, r.id, body.case_id)
        return Response.json({ run: r }, { status: 201 })
      },
    },
  },
})
