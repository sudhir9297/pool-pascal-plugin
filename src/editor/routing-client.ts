import type { routePipe } from '../design/pipe-route'

export function createRoutingClient() {
  // Static Worker + URL syntax lets the host bundler transpile the worker too.
  const worker = new Worker(new URL('./routing-worker.ts', import.meta.url), { type: 'module' })
  let nextId = 0
  const pending = new Map<number, { resolve: (value: ReturnType<typeof routePipe>) => void; reject: (error: Error) => void }>()
  let queued: { id: number; args: Parameters<typeof routePipe>; resolve: (value: ReturnType<typeof routePipe>) => void; reject: (error: Error) => void } | null = null
  let failed = false
  let ready = false
  const flush = () => {
    if (!queued || !ready || pending.size) return
    const next = queued
    queued = null
    pending.set(next.id, next)
    worker.postMessage({ id: next.id, args: next.args })
  }
  worker.onmessage = ({ data }) => {
    if (data.ready) { ready = true; clearTimeout(startupTimeout); flush(); return }
    const request = pending.get(data.id)
    if (!request) return
    pending.delete(data.id)
    if (data.error) request.reject(new Error(data.error))
    else request.resolve(data.result)
    flush()
  }
  const fail = () => {
    failed = true
    clearTimeout(startupTimeout)
    for (const request of pending.values()) request.reject(new Error('Pipe routing worker failed'))
    pending.clear()
    queued?.reject(new Error('Pipe routing worker failed'))
    queued = null
  }
  const startupTimeout = setTimeout(fail, 10000)
  worker.onerror = fail
  return {
    route(args: Parameters<typeof routePipe>) {
      return new Promise<ReturnType<typeof routePipe>>((resolve, reject) => {
        if (failed) { reject(new Error('Pipe routing worker unavailable')); return }
        const id = ++nextId
        if (!ready || pending.size) {
          queued?.reject(new DOMException('Superseded pipe route', 'AbortError'))
          queued = { id, args, resolve, reject }
          return
        }
        pending.set(id, { resolve, reject })
        worker.postMessage({ id, args })
      })
    },
    dispose() {
      failed = true
      clearTimeout(startupTimeout)
      worker.terminate()
      for (const request of pending.values()) request.reject(new Error('Pipe routing cancelled'))
      pending.clear()
      queued?.reject(new DOMException('Pipe routing cancelled', 'AbortError'))
      queued = null
    },
  }
}
