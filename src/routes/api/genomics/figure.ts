// src/routes/api/genomics/figure.ts
import { createFileRoute } from '@tanstack/react-router'
import { requireLocalOrAuth } from '../../../server/auth-middleware'
import { createReadStream, existsSync } from 'node:fs'
import { extname, resolve as resolvePath } from 'node:path'
import { Readable } from 'node:stream'

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
        const rawPath = url.searchParams.get('path')
        if (!rawPath) return Response.json({ error: 'path required' }, { status: 400 })

        // Normalize first to collapse any `..` segments, then anchor against the NAS base.
        const absPath = resolvePath(rawPath)
        // Anchor figure paths to GENOMICS_NAS_BASE, falling back to GENOMICS_REPORT_WATCH_PATH
        // so the route is never an unrestricted filesystem read.
        const rawBase = process.env.GENOMICS_NAS_BASE ?? process.env.GENOMICS_REPORT_WATCH_PATH ?? ''
        if (!rawBase) {
          return Response.json({ error: 'Figure serving not configured' }, { status: 503 })
        }
        const nasBase = resolvePath(rawBase)
        const baseWithSlash = nasBase.endsWith('/') ? nasBase : `${nasBase}/`
        if (!absPath.startsWith(baseWithSlash) && absPath !== nasBase) {
          return Response.json({ error: 'Forbidden' }, { status: 403 })
        }

        if (!existsSync(absPath)) {
          return Response.json({ error: 'Not found' }, { status: 404 })
        }

        const ext = extname(absPath).toLowerCase()
        const contentType = MIME[ext] ?? 'application/octet-stream'

        const stream = createReadStream(absPath)
        return new Response(Readable.toWeb(stream) as ReadableStream, {
          headers: { 'Content-Type': contentType },
        })
      },
    },
  },
})
