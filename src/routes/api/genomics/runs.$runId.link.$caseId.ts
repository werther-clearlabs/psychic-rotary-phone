import { createFileRoute } from '@tanstack/react-router'
import { requireLocalOrAuth } from '../../../server/auth-middleware'
import { linkRunToCase } from '../../../server/genomics/runs-store'

export const Route = createFileRoute('/api/genomics/runs/$runId/link/$caseId')({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        if (!requireLocalOrAuth(request)) return Response.json({ error: 'Unauthorized' }, { status: 401 })
        linkRunToCase(undefined, params.runId, params.caseId)
        return Response.json({ ok: true })
      },
    },
  },
})
