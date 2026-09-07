import { describe, expect, test } from 'bun:test'
import { PoolNode } from '../../core/schema'
import { PoolInletNode } from '../core/schema'
import { resolveMountedInlet } from './placement'

describe('pool inlet mounting', () => {
  test('keeps an inlet attached when its pool moves and rotates', () => {
    const pool = PoolNode.parse({
      id: 'pool_inlet_host',
      position: [3, 1, -2],
      rotation: [0, Math.PI / 2, 0],
      length: 8,
      width: 4,
    })
    const inlet = PoolInletNode.parse({
      id: 'pool-inlet_mounted',
      poolId: pool.id,
      wallIndex: 0,
      wallT: 0.25,
    })
    const mounted = resolveMountedInlet(inlet, pool)

    expect(mounted).not.toBe(inlet)
    expect(mounted.position).not.toEqual(inlet.position)
    expect(mounted.rotation[1]).not.toBe(inlet.rotation[1])
    expect(mounted.poolId).toBe(pool.id)
  })

  test('leaves standalone and mismatched inlets untouched', () => {
    const pool = PoolNode.parse({ id: 'pool_other' })
    const inlet = PoolInletNode.parse({ id: 'pool-inlet_standalone', poolId: null })

    expect(resolveMountedInlet(inlet, pool)).toBe(inlet)
    expect(resolveMountedInlet(inlet, null)).toBe(inlet)
  })
})
