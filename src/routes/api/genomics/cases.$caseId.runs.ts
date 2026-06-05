import { createFileRoute } from '@tanstack/react-router'
import { requireLocalOrAuth } from '../../../server/auth-middleware'
import { listRunsForCase } from '../../../server/genomics/runs-store'

export const Route = createFileRoute('/api/genomics/cases/$caseId/runs')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        if (!requireLocalOrAuth(request)) return Response.json({ error: 'Unauthorized' }, { status: 401 })
        return Response.json({ runs: listRunsForCase(undefined, params.caseId) })
      },
    },
  },
})
