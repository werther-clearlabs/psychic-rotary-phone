import { createFileRoute } from '@tanstack/react-router'
import { requireLocalOrAuth } from '../../../server/auth-middleware'
import { getCase } from '../../../server/genomics/cases-store'
import { getProtocol, resolveVariables, renderTemplate } from '../../../server/genomics/protocols-store'

export const Route = createFileRoute('/api/genomics/cases/$caseId/report/generate')({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        if (!requireLocalOrAuth(request)) return Response.json({ error: 'Unauthorized' }, { status: 401 })
        const body = await request.json() as { protocol_id: string; overrides?: Record<string, string> }

        const caseRecord = getCase(undefined, params.caseId)
        if (!caseRecord) return Response.json({ error: 'Case not found' }, { status: 404 })

        const protocol = getProtocol(undefined, body.protocol_id)
        if (!protocol) return Response.json({ error: 'Protocol not found' }, { status: 404 })

        const vars = resolveVariables(protocol, caseRecord as unknown as Record<string, unknown>, body.overrides ?? {})
        const prompt = renderTemplate(protocol.prompt_template, vars)

        // Dispatch via the workspace chat pipeline. The agent executes the
        // Protocol's skills and writes the markdown report to
        // GENOMICS_REPORT_WATCH_PATH; report-watcher upserts it into the
        // reports table. Fire-and-forget — runs can take several minutes.
        const sessionKey = `genomics-case-${params.caseId}`
        const sendStreamUrl = new URL('/api/send-stream', request.url)
        const cookie = request.headers.get('cookie') ?? ''
        const authHeader = request.headers.get('authorization') ?? ''

        void fetch(sendStreamUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(cookie ? { cookie } : {}),
            ...(authHeader ? { authorization: authHeader } : {}),
          },
          body: JSON.stringify({
            message: prompt,
            sessionKey,
            friendlyId: sessionKey,
          }),
        }).catch((err) => {
          console.error('[genomics generate] dispatch failed:', err)
        })

        return Response.json({
          ok: true,
          prompt_length: prompt.length,
          session_key: sessionKey,
        })
      },
    },
  },
})
