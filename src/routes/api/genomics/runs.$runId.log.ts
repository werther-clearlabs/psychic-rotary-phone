import { createFileRoute } from '@tanstack/react-router'
import { requireLocalOrAuth } from '../../../server/auth-middleware'
import { listStages } from '../../../server/genomics/runs-store'

export const Route = createFileRoute('/api/genomics/runs/$runId/log')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        if (!requireLocalOrAuth(request)) return Response.json({ error: 'Unauthorized' }, { status: 401 })
        const encoder = new TextEncoder()
        const stream = new ReadableStream({
          start(controller) {
            const send = (data: string) =>
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ line: data })}\n\n`))

            // Track how many characters of each stage's log_tail we've already sent
            const cursors: Record<string, number> = {}

            // Initial flush: send everything currently available
            const stages = listStages(undefined, params.runId)
            for (const stage of stages) {
              if (stage.log_tail) {
                for (const line of stage.log_tail.split('\n')) send(line)
                cursors[stage.id] = stage.log_tail.length
              }
            }

            // Poll every 2s and send only new content per stage
            const interval = setInterval(() => {
              for (const stage of listStages(undefined, params.runId)) {
                const log = stage.log_tail ?? ''
                const prev = cursors[stage.id] ?? 0
                if (log.length > prev) {
                  const newContent = log.slice(prev)
                  for (const line of newContent.split('\n')) if (line) send(line)
                  cursors[stage.id] = log.length
                } else if (log.length < prev) {
                  // log got rotated/truncated — reset
                  cursors[stage.id] = log.length
                }
              }
            }, 2000)

            request.signal.addEventListener('abort', () => {
              clearInterval(interval)
              controller.close()
            })
          },
        })

        return new Response(stream, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
            'X-Accel-Buffering': 'no',
          },
        })
      },
    },
  },
})
