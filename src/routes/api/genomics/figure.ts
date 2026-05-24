// src/routes/api/genomics/figure.ts
import { createFileRoute } from '@tanstack/react-router'
import { requireLocalOrAuth } from '../../../server/auth-middleware'
import { createReadStream, existsSync } from 'node:fs'
import { extname } from 'node:path'

const MIME: Record<string, string> = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.svg': 'image/svg+xml', '.webp': 'image/webp',
}

export const Route = createFileRoute('/api/genomics/figure')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!requireLocalOrAuth(request)) return Response.json({ error: 'Unauthorized' }, { status: 401 })
        const url = new URL(request.url)
        const filePath = url.searchParams.get('path')
        if (!filePath) return Response.json({ error: 'path required' }, { status: 400 })

        // Validate path is under NAS base (prevent directory traversal)
        const nasBase = process.env.GENOMICS_NAS_BASE ?? ''
        if (nasBase && !filePath.startsWith(nasBase)) {
          return Response.json({ error: 'Forbidden' }, { status: 403 })
        }

        if (!existsSync(filePath)) {
          return Response.json({ error: 'Not found' }, { status: 404 })
        }

        const ext = extname(filePath).toLowerCase()
        const contentType = MIME[ext] ?? 'application/octet-stream'

        const stream = createReadStream(filePath)
        return new Response(stream as unknown as ReadableStream, {
          headers: { 'Content-Type': contentType },
        })
      },
    },
  },
})
