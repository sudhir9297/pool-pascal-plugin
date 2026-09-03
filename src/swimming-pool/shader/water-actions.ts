export type PoolWaterAction = 'splash' | 'calm' | 'storm' | 'reset'

type WaterActionListener = (action: PoolWaterAction) => void

const listeners = new Map<string, Set<WaterActionListener>>()

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
