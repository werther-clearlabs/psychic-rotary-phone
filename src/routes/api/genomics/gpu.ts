// src/routes/api/genomics/gpu.ts
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { createFileRoute } from '@tanstack/react-router'
import { requireLocalOrAuth } from '../../../server/auth-middleware'

const execFileAsync = promisify(execFile)

type Gpu = {
  index: number
  uuid: string
  name: string
  utilization_pct: number
  memory_used_mib: number
  memory_total_mib: number
  power_draw_w: number
}

type ComputeApp = {
  gpu_uuid: string
  pid: number
  process_name: string
  used_memory_mib: number
}

type GpuTelemetry = {
  gpus: Array<Gpu>
  processes: Array<ComputeApp>
  captured_at: string
}

let cache: { value: GpuTelemetry; expiresAt: number } | null = null
const CACHE_MS = 2000

function parseCsv(stdout: string): Array<Array<string>> {
  return stdout
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => line.split(',').map((s) => s.trim()))
}

async function queryNvidiaSmi(): Promise<GpuTelemetry> {
  const [gpuRes, appRes] = await Promise.all([
    execFileAsync('nvidia-smi', [
      '--query-gpu=index,uuid,name,utilization.gpu,memory.used,memory.total,power.draw',
      '--format=csv,noheader,nounits',
    ]),
    execFileAsync('nvidia-smi', [
      '--query-compute-apps=gpu_uuid,pid,process_name,used_memory',
      '--format=csv,noheader,nounits',
    ]),
  ])

  const gpus: Array<Gpu> = parseCsv(gpuRes.stdout).map(
    ([index, uuid, name, util, used, total, power]) => ({
      index: Number(index),
      uuid,
      name,
      utilization_pct: Number(util),
      memory_used_mib: Number(used),
      memory_total_mib: Number(total),
      power_draw_w: Number(power),
    }),
  )

  const processes: Array<ComputeApp> = parseCsv(appRes.stdout).map(
    ([gpu_uuid, pid, process_name, used_memory]) => ({
      gpu_uuid,
      pid: Number(pid),
      process_name,
      used_memory_mib: Number(used_memory),
    }),
  )

  return { gpus, processes, captured_at: new Date().toISOString() }
}

// Mirrors the production Parabricks host (2x RTX PRO 6000 Blackwell, vLLM on GPU 1).
// Light jitter so the dashboard's poll interval is visible while iterating locally.
function mockTelemetry(): GpuTelemetry {
  const jitter = (base: number, spread: number) =>
    Math.max(0, base + (Math.random() - 0.5) * spread)
  const gpu1Util = Math.round(jitter(35, 60))
  return {
    gpus: [
      {
        index: 0,
        uuid: 'GPU-mock-00000000-0000-0000-0000-000000000000',
        name: 'NVIDIA RTX PRO 6000 Blackwell Server Edition',
        utilization_pct: Math.round(jitter(3, 6)),
        memory_used_mib: Math.round(jitter(14, 4)),
        memory_total_mib: 97887,
        power_draw_w: Number(jitter(32, 4).toFixed(2)),
      },
      {
        index: 1,
        uuid: 'GPU-mock-00000000-0000-0000-0000-000000000001',
        name: 'NVIDIA RTX PRO 6000 Blackwell Server Edition',
        utilization_pct: gpu1Util,
        memory_used_mib: Math.round(jitter(63338, 200)),
        memory_total_mib: 97887,
        power_draw_w: Number((80 + gpu1Util * 3.5).toFixed(2)),
      },
    ],
    processes: [
      {
        gpu_uuid: 'GPU-mock-00000000-0000-0000-0000-000000000000',
        pid: 5055,
        process_name: '/usr/lib/xorg/Xorg',
        used_memory_mib: 4,
      },
      {
        gpu_uuid: 'GPU-mock-00000000-0000-0000-0000-000000000001',
        pid: 5055,
        process_name: '/usr/lib/xorg/Xorg',
        used_memory_mib: 4,
      },
      {
        gpu_uuid: 'GPU-mock-00000000-0000-0000-0000-000000000001',
        pid: 3894416,
        process_name: 'VLLM::EngineCore',
        used_memory_mib: 63316,
      },
    ],
    captured_at: new Date().toISOString(),
  }
}

export const Route = createFileRoute('/api/genomics/gpu')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!requireLocalOrAuth(request))
          return Response.json({ error: 'Unauthorized' }, { status: 401 })

        const now = Date.now()
        if (cache && cache.expiresAt > now) {
          return Response.json(cache.value)
        }

        try {
          const value = await queryNvidiaSmi()
          cache = { value, expiresAt: now + CACHE_MS }
          return Response.json(value)
        } catch (err) {
          // In dev, fall back to mock data so the panel is iterable without a GPU host.
          // Prod still surfaces a real 503 if nvidia-smi fails (driver crash, etc.).
          if (process.env.NODE_ENV !== 'production') {
            const value = mockTelemetry()
            cache = { value, expiresAt: now + CACHE_MS }
            return Response.json(value)
          }
          const message = err instanceof Error ? err.message : String(err)
          return Response.json(
            { error: 'GPU telemetry unavailable', detail: message },
            { status: 503 },
          )
        }
      },
    },
  },
})
