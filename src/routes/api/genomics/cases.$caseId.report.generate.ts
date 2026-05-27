import { join } from 'node:path'
import { createFileRoute } from '@tanstack/react-router'
// Ensure the file watcher is running before the first report is generated.
import '../../../server/genomics/watcher-init'
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

        const watchPath = process.env.GENOMICS_REPORT_WATCH_PATH
        if (!watchPath) {
          return Response.json(
            { error: 'GENOMICS_REPORT_WATCH_PATH not configured — cannot dispatch report generation' },
            { status: 503 },
          )
        }

        const vars = resolveVariables(protocol, caseRecord as unknown as Record<string, unknown>, body.overrides ?? {})
        const renderedPrompt = renderTemplate(protocol.prompt_template, vars)

        // Append output requirements so the agent persists the report to the
        // watcher directory with the case-id prefix filename convention. The
        // watcher (watcher-init.ts) matches files by `{case_id}-report.md` or
        // `{case_id}.md`; without these instructions the agent only streams
        // into chat and no report row is ever inserted.
        const outputFilename = `${params.caseId}-report.md`
        const outputPath = join(watchPath, outputFilename)
        const prompt = `${renderedPrompt}

---
OUTPUT REQUIREMENTS (mandatory — the workspace ingests the report via this file):
- When the report is complete, use the Write tool to save the full markdown report to this exact path:
  ${outputPath}
- The filename MUST be exactly "${outputFilename}" (the case-id prefix is how the workspace matches the file to this case).
- Use "## 1. …" through "## 12. …" section headings so the parser can split sections.
- Do not modify or delete other files in ${watchPath}.`

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
          output_path: outputPath,
        })
      },
    },
  },
})
