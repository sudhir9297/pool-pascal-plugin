import { routePipe } from '../design/pipe-route'

self.onmessage = (event: MessageEvent<{ id: number; args: Parameters<typeof routePipe> }>) => {
  const { id, args } = event.data
  try {
    self.postMessage({ id, result: routePipe(...args) })
  } catch (error) {
    self.postMessage({ id, error: String(error) })
  }
}
self.postMessage({ ready: true })
