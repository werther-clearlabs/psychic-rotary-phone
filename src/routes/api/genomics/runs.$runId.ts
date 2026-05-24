import { createFileRoute } from '@tanstack/react-router'
import { requireLocalOrAuth } from '../../../server/auth-middleware'
import { getRun, updateRun, listStages } from '../../../server/genomics/runs-store'

export const Route = createFileRoute('/api/genomics/runs/$runId')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        if (!requireLocalOrAuth(request)) return Response.json({ error: 'Unauthorized' }, { status: 401 })
        const r = getRun(undefined, params.runId)
        if (!r) return Response.json({ error: 'Not found' }, { status: 404 })
        const stages = listStages(undefined, params.runId)
        return Response.json({ run: r, stages })
      },
      PUT: async ({ request, params }) => {
        if (!requireLocalOrAuth(request)) return Response.json({ error: 'Unauthorized' }, { status: 401 })
        const body = await request.json() as Parameters<typeof updateRun>[2]
        const updated = updateRun(undefined, params.runId, body)
        if (!updated) return Response.json({ error: 'Not found' }, { status: 404 })
        return Response.json({ run: updated })
      },
    },
  },
})
