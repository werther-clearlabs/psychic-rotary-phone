import { createFileRoute } from '@tanstack/react-router'
import { requireLocalOrAuth } from '../../../server/auth-middleware'
import { listRuns, createRun } from '../../../server/genomics/runs-store'

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
        const r = createRun(undefined, body)
        return Response.json({ run: r }, { status: 201 })
      },
    },
  },
})
