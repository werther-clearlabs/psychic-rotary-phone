import { createFileRoute } from '@tanstack/react-router'
import { getRun, updateRun, upsertStage } from '../../../server/genomics/runs-store'

type IngestEvent =
  | { event: 'stage_start';    stage: string }
  | { event: 'stage_complete'; stage: string; exit_code?: number }
  | { event: 'stage_failed';   stage: string; exit_code?: number }
  | { event: 'run_complete' }
  | { event: 'run_failed' }

function authorized(request: Request): boolean {
  const token = process.env.HERMES_API_TOKEN ?? process.env.CLAUDE_API_TOKEN ?? ''
  // Allow unauthenticated on loopback when no token is configured
  if (!token) return true
  const header = request.headers.get('Authorization') ?? ''
  return header === `Bearer ${token}`
}

export const Route = createFileRoute('/api/genomics/runs/$runId/ingest')({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        if (!authorized(request)) return Response.json({ error: 'Unauthorized' }, { status: 401 })

        const run = getRun(undefined, params.runId)
        if (!run) return Response.json({ error: 'Not found' }, { status: 404 })

        const body = await request.json() as IngestEvent
        const now = Date.now()

        switch (body.event) {
          case 'stage_start':
            upsertStage(undefined, run.id, body.stage, {
              status: 'running',
              started_at: now,
            })
            break

          case 'stage_complete':
            upsertStage(undefined, run.id, body.stage, {
              status: 'completed',
              finished_at: now,
            })
            break

          case 'stage_failed':
            upsertStage(undefined, run.id, body.stage, {
              status: 'failed',
              finished_at: now,
            })
            updateRun(undefined, run.id, { status: 'failed' })
            break

          case 'run_complete':
            updateRun(undefined, run.id, { status: 'completed' })
            break

          case 'run_failed':
            updateRun(undefined, run.id, { status: 'failed' })
            break
        }

        return Response.json({ ok: true })
      },
    },
  },
})
