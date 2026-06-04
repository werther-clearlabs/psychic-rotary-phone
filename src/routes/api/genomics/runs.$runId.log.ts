import { createFileRoute } from '@tanstack/react-router'
import { statSync, createReadStream } from 'node:fs'
import { requireLocalOrAuth } from '../../../server/auth-middleware'
import { listStages } from '../../../server/genomics/runs-store'

function fileSizeOrNull(path: string): number | null {
  try { return statSync(path).size } catch { return null }
}

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

            // Track read positions: file-based stages use byte offsets, DB stages use char counts
            const fileOffsets: Record<string, number> = {}  // stageId → bytes read
            const dbCursors: Record<string, number> = {}    // stageId → chars read

            // Initial flush of all currently available content
            for (const stage of listStages(undefined, params.runId)) {
              if (stage.log_file_path) {
                const size = fileSizeOrNull(stage.log_file_path)
                if (size && size > 0) {
                  // Read existing file content synchronously for the initial flush
                  const rs = createReadStream(stage.log_file_path, { encoding: 'utf8' })
                  let buf = ''
                  rs.on('data', (chunk) => { buf += chunk })
                  rs.on('end', () => {
                    for (const line of buf.split('\n')) if (line) send(line)
                    fileOffsets[stage.id] = size
                  })
                } else {
                  fileOffsets[stage.id] = 0
                }
              } else if (stage.log_tail) {
                for (const line of stage.log_tail.split('\n')) if (line) send(line)
                dbCursors[stage.id] = stage.log_tail.length
              }
            }

            // Poll every 2s and send only new content
            const interval = setInterval(() => {
              for (const stage of listStages(undefined, params.runId)) {
                if (stage.log_file_path) {
                  const size = fileSizeOrNull(stage.log_file_path)
                  if (size === null) continue
                  const prev = fileOffsets[stage.id] ?? 0
                  if (size <= prev) continue
                  const rs = createReadStream(stage.log_file_path, { start: prev, encoding: 'utf8' })
                  let buf = ''
                  rs.on('data', (chunk) => { buf += chunk })
                  rs.on('end', () => {
                    for (const line of buf.split('\n')) if (line) send(line)
                    fileOffsets[stage.id] = size
                  })
                } else {
                  // Fallback: DB log_tail
                  const log = stage.log_tail ?? ''
                  const prev = dbCursors[stage.id] ?? 0
                  if (log.length > prev) {
                    const newContent = log.slice(prev)
                    for (const line of newContent.split('\n')) if (line) send(line)
                    dbCursors[stage.id] = log.length
                  } else if (log.length < prev) {
                    dbCursors[stage.id] = log.length
                  }
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
