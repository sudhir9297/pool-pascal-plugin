type WaterfallAnimationListener = (delta: number) => void

const listeners = new Set<WaterfallAnimationListener>()
let frame = 0
let previous = 0

function tick(now: number) {
  const delta = previous === 0 ? 0 : Math.min(0.1, Math.max(0, (now - previous) / 1000))
  previous = now
  if (typeof document === 'undefined' || document.visibilityState !== 'hidden') {
    for (const listener of listeners) listener(delta)
  }
  if (listeners.size > 0) frame = requestAnimationFrame(tick)
  else frame = 0
}

export function subscribeWaterfallAnimation(listener: WaterfallAnimationListener) {
  listeners.add(listener)
  if (listeners.size === 1 && frame === 0) {
    previous = 0
    frame = requestAnimationFrame(tick)
  }
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0 && frame !== 0) {
      cancelAnimationFrame(frame)
      frame = 0
      previous = 0
    }
  }
}
