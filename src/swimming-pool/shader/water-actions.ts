export type PoolWaterAction = 'splash' | 'calm' | 'storm' | 'reset'
export type PoolWaterImpact = { u: number; v: number; strength: number }

type WaterActionListener = (action: PoolWaterAction) => void

const listeners = new Map<string, Set<WaterActionListener>>()
const impactListeners = new Map<string, Set<(impact: PoolWaterImpact) => void>>()

export function triggerPoolWaterAction(poolId: string, action: PoolWaterAction) {
  for (const listener of listeners.get(poolId) ?? []) listener(action)
}

export function subscribePoolWaterActions(poolId: string, listener: WaterActionListener) {
  const poolListeners = listeners.get(poolId) ?? new Set<WaterActionListener>()
  poolListeners.add(listener)
  listeners.set(poolId, poolListeners)
  return () => {
    poolListeners.delete(listener)
    if (poolListeners.size === 0) listeners.delete(poolId)
  }
}

export function triggerPoolWaterImpact(poolId: string, impact: PoolWaterImpact) {
  for (const listener of impactListeners.get(poolId) ?? []) listener(impact)
}

export function subscribePoolWaterImpacts(poolId: string, listener: (impact: PoolWaterImpact) => void) {
  const poolListeners = impactListeners.get(poolId) ?? new Set<(impact: PoolWaterImpact) => void>()
  poolListeners.add(listener)
  impactListeners.set(poolId, poolListeners)
  return () => {
    poolListeners.delete(listener)
    if (poolListeners.size === 0) impactListeners.delete(poolId)
  }
}
