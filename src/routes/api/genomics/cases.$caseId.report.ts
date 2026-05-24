import { createFileRoute } from '@tanstack/react-router'
import { requireLocalOrAuth } from '../../../server/auth-middleware'
import { getLatestReport, patchSection, signReport } from '../../../server/genomics/reports-store'

export const Route = createFileRoute('/api/genomics/cases/$caseId/report')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        if (!requireLocalOrAuth(request)) return Response.json({ error: 'Unauthorized' }, { status: 401 })
        const report = getLatestReport(undefined, params.caseId)
        return Response.json({ report })
      },
      // PATCH a single section: body = { section: "8", content: "..." }
      PUT: async ({ request, params }) => {
        if (!requireLocalOrAuth(request)) return Response.json({ error: 'Unauthorized' }, { status: 401 })
        const body = await request.json() as { section: string; content: string; signed_by?: string; action?: string }
        const report = getLatestReport(undefined, params.caseId)
        if (!report) return Response.json({ error: 'No report found' }, { status: 404 })

        if (body.action === 'sign') {
          const signed = signReport(undefined, report.id, body.signed_by ?? 'unknown')
          return Response.json({ report: signed })
        }

        const updated = patchSection(undefined, report.id, body.section, body.content)
        return Response.json({ report: updated })
      },
    },
  },
})
