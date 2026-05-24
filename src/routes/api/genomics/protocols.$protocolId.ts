// src/routes/api/genomics/protocols.$protocolId.ts
import { createFileRoute } from '@tanstack/react-router'
import { requireLocalOrAuth } from '../../../server/auth-middleware'
import { getProtocol, updateProtocol } from '../../../server/genomics/protocols-store'

export const Route = createFileRoute('/api/genomics/protocols/$protocolId')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        if (!requireLocalOrAuth(request)) return Response.json({ error: 'Unauthorized' }, { status: 401 })
        const p = getProtocol(undefined, params.protocolId)
        if (!p) return Response.json({ error: 'Not found' }, { status: 404 })
        return Response.json({ protocol: p })
      },
      PUT: async ({ request, params }) => {
        if (!requireLocalOrAuth(request)) return Response.json({ error: 'Unauthorized' }, { status: 401 })
        const body = await request.json() as Parameters<typeof updateProtocol>[2]
        const updated = updateProtocol(undefined, params.protocolId, body)
        if (!updated) return Response.json({ error: 'Not found' }, { status: 404 })
        return Response.json({ protocol: updated })
      },
    },
  },
})
