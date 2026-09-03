import { describe, expect, test } from 'bun:test'
import { PoolNode } from '../../core/schema'
import { resolvePoolSpillover } from './placement'

const rectangle = [[-2, -1.5], [2, -1.5], [2, 1.5], [-2, 1.5]]

describe('pool spillover placement', () => {
  test('uses the higher pool as the source and carries the real water drop', () => {
    const upper = PoolNode.parse({ id: 'pool_upper', parentId: 'level_a', position: [0, 1, 0], polygon: rectangle })
    const lower = PoolNode.parse({ id: 'pool_lower', parentId: 'level_a', position: [3.5, 0, 0], polygon: rectangle })
    const placement = resolvePoolSpillover(lower, upper)
    expect(placement?.sourcePoolId).toBe(upper.id)
    expect(placement?.targetPoolId).toBe(lower.id)
    expect(placement?.dropHeight).toBeCloseTo(1)
    expect(placement?.intersection.length).toBeGreaterThan(0)
    expect(placement?.width).toBeCloseTo(3)
  })

  test('rejects pools on different levels', () => {
    const first = PoolNode.parse({ id: 'pool_a', parentId: 'level_a', polygon: rectangle })
    const second = PoolNode.parse({ id: 'pool_b', parentId: 'level_b', position: [3.5, 0, 0], polygon: rectangle })
    expect(resolvePoolSpillover(first, second)).toBeNull()
  })

  test('connects adjacent pools across a small construction gap', () => {
    const upper = PoolNode.parse({ id: 'pool_upper_gap', parentId: 'level_a', position: [0, 1, 0], polygon: rectangle })
    const lower = PoolNode.parse({ id: 'pool_lower_gap', parentId: 'level_a', position: [4.4, 0, 0], polygon: rectangle })
    const placement = resolvePoolSpillover(upper, lower)
    expect(placement).not.toBeNull()
    expect(placement?.sourcePoolId).toBe(upper.id)
    expect(placement?.length).toBeCloseTo(0.4)
    expect(placement?.intersection).toHaveLength(1)
  })
})
