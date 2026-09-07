import type { PoolNode } from '../core/schema'

/** Leave room for irregular stones that overhang the nominal basin edge. */
export function getPoolWaterLandingInset(pool: PoolNode) {
  if (pool.copingStyle === 'rock') {
    return Math.max(pool.copingWidth * 1.5, pool.copingStoneLength * 0.65) + 0.15
  }
  if (pool.copingStyle === 'natural-stone') {
    return Math.max(pool.copingWidth, pool.copingStoneLength * 0.3) + 0.12
  }
  return 0.12
}
