import { describe, expect, test } from 'bun:test'
import { PoolNode } from '../../core/schema'
import { getPoolDrainPlacement } from './pool-placement'

describe('pool drain placement', () => {
  test('snaps an inside click to the flat pool floor', () => {
    const pool = PoolNode.parse({ id: 'pool_drain_flat', position: [2, 0.4, -1], length: 8, width: 4, depth: 1.6 })
    const placement = getPoolDrainPlacement(pool, [2.5, 0, -1.25])

    expect(placement?.poolId).toBe(pool.id)
    expect(placement?.position[0]).toBeCloseTo(2.5)
    expect(placement?.position[1]).toBeCloseTo(-1.2)
    expect(placement?.position[2]).toBeCloseTo(-1.25)
  })

  test('rejects a click outside the pool outline', () => {
    const pool = PoolNode.parse({ id: 'pool_drain_outside', length: 8, width: 4 })

    expect(getPoolDrainPlacement(pool, [5, 0, 0])).toBeNull()
  })
})
