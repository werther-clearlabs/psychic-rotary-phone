import { createFileRoute } from '@tanstack/react-router'
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync, chmodSync } from 'node:fs'
import { requireLocalOrAuth } from '../../../server/auth-middleware'
import { getRun, updateRun, upsertStage, linkRunToCase, getRunConfig } from '../../../server/genomics/runs-store'
import { generateShellScript } from '../../../server/genomics/shell-generator'

export const Route = createFileRoute('/api/genomics/runs/$runId/start')({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        if (!requireLocalOrAuth(request)) return Response.json({ error: 'Unauthorized' }, { status: 401 })

        const run = getRun(undefined, params.runId)
        if (!run) return Response.json({ error: 'Not found' }, { status: 404 })
        if (run.status !== 'queued') {
          return Response.json({ error: `Run is already ${run.status}` }, { status: 409 })
        }

        const config = getRunConfig(run)
        if (!config) return Response.json({ error: 'Run has no run_config' }, { status: 400 })

        const port = process.env.PORT ?? '3000'
        const ingestUrl = `http://127.0.0.1:${port}/api/genomics/runs/${run.id}/ingest`
        const apiToken = process.env.HERMES_API_TOKEN ?? process.env.CLAUDE_API_TOKEN ?? ''

        const logDir = run.log_dir ?? run.output_dir ?? `/tmp/pbrun-${run.id}`
        mkdirSync(logDir, { recursive: true })

        // Create one pending stage per sample
        if ('samples' in config) {
          for (const sample of config.samples) {
            upsertStage(undefined, run.id, sample, {
              status: 'pending',
              log_file_path: `${logDir}/${sample}.log`,
            })
          }
        }

        // Ensure case link exists
        if (run.case_id) linkRunToCase(undefined, run.id, run.case_id)

        // Generate and write script
        const script = generateShellScript(run, ingestUrl, apiToken)
        const scriptPath = `${logDir}/script.sh`
        writeFileSync(scriptPath, script, 'utf8')
        chmodSync(scriptPath, 0o755)

        // Mark running before spawn so UI reflects state immediately
        updateRun(undefined, run.id, { status: 'running' })

        // Detach so the process outlives the HTTP response
        const child = spawn('bash', [scriptPath], {
          detached: true,
          stdio: 'ignore',
          cwd: logDir,
        })
        child.unref()

        const updated = getRun(undefined, run.id)
        return Response.json({ run: updated }, { status: 202 })
      },
    },
  },
})
