import { describe, expect, test } from 'bun:test'
import { PoolNode } from '../../core/schema'
import { findNearestPoolWall } from './placement'

describe('pool skimmer placement', () => {
  test('snaps to the nearest pool wall and aims into the basin', () => {
    const pool = PoolNode.parse({ id: 'pool_placement', position: [2, 0, 3], length: 8, width: 4 })
    const placement = findNearestPoolWall([5.8, 3], [pool])

    expect(placement?.position).toEqual([6, -0.12, 3])
    expect(placement?.rotation).toEqual([0, -Math.PI / 2, 0])
  })

  test('keeps a flat wall orientation constant along the wall', () => {
    const pool = PoolNode.parse({ id: 'pool_flat_wall', position: [0, 0, 0], length: 8, width: 4 })
    const nearLeft = findNearestPoolWall([-4.2, -1], [pool])
    const nearLeftCorner = findNearestPoolWall([-4.2, 1], [pool])

    expect(nearLeft?.rotation).toEqual([0, Math.PI / 2, 0])
    expect(nearLeftCorner?.rotation).toEqual([0, Math.PI / 2, 0])
  })

})
