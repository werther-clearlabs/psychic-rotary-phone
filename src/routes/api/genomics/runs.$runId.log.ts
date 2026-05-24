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

            // Send current log_tail immediately
            const stages = listStages(undefined, params.runId)
            for (const stage of stages) {
              if (stage.log_tail) {
                for (const line of stage.log_tail.split('\n')) send(line)
              }
            }

            // Poll every 2s for new log lines
            const interval = setInterval(() => {
              const updated = listStages(undefined, params.runId)
              for (const stage of updated) {
                if (stage.log_tail) {
                  const lines = stage.log_tail.split('\n')
                  send(lines[lines.length - 1] ?? '')
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
          },
        })
      },
    },
  },
})
