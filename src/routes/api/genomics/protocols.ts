// src/routes/api/genomics/protocols.ts
import { createFileRoute } from '@tanstack/react-router'
import { requireLocalOrAuth } from '../../../server/auth-middleware'
import { listProtocols, createProtocol } from '../../../server/genomics/protocols-store'

export const Route = createFileRoute('/api/genomics/protocols')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!requireLocalOrAuth(request)) return Response.json({ error: 'Unauthorized' }, { status: 401 })
        const url = new URL(request.url)
        const assay_type = url.searchParams.get('assay_type') ?? undefined
        return Response.json({ protocols: listProtocols(undefined, { assay_type }) })
      },
      POST: async ({ request }) => {
        if (!requireLocalOrAuth(request)) return Response.json({ error: 'Unauthorized' }, { status: 401 })
        const body = await request.json() as Parameters<typeof createProtocol>[1]
        const p = createProtocol(undefined, body)
        return Response.json({ protocol: p }, { status: 201 })
      },
    },
  },
})
