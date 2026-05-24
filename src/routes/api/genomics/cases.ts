import { createFileRoute } from '@tanstack/react-router'
import { requireLocalOrAuth } from '../../../server/auth-middleware'
import { listCases, createCase } from '../../../server/genomics/cases-store'

export const Route = createFileRoute('/api/genomics/cases')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!requireLocalOrAuth(request)) return Response.json({ error: 'Unauthorized' }, { status: 401 })
        return Response.json({ cases: listCases() })
      },
      POST: async ({ request }) => {
        if (!requireLocalOrAuth(request)) return Response.json({ error: 'Unauthorized' }, { status: 401 })
        const body = await request.json() as Parameters<typeof createCase>[1]
        const c = createCase(undefined, body)
        return Response.json({ case: c }, { status: 201 })
      },
    },
  },
})
