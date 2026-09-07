import { describe, expect, test } from 'bun:test'
import { PoolNode } from '../../core/schema'
import { poolStairDefinition } from '../core/definition'
import { PoolStairNode } from '../core/schema'
import {
  findNearestPoolStairAttachment,
  poolStairAttachmentPatch,
  resolveMountedPoolStair,
} from './placement'

describe('pool stair placement and movement', () => {
  test('routes later drags through the wall-constrained move tool', () => {
    expect(poolStairDefinition.affordanceTools?.move).toBeDefined()
  })

  test('follows the nearest wall and turns around pool corners', () => {
    const pool = PoolNode.parse({ position: [2, 0, 3], finishedDeckElevation: 0.12 })
    const first = findNearestPoolStairAttachment([2, 0.12, 0.8], [pool])
    const second = findNearestPoolStairAttachment([6.2, 0.12, 3], [pool])

    expect(first?.wallIndex).toBe(0)
    expect(first?.localRotation[1]).toBeCloseTo(0)
    expect(second?.wallIndex).toBe(1)
    expect(second?.localRotation[1]).toBeCloseTo(-Math.PI / 2)
  })

  test('stores the stair in its pool-local frame as a pool child', () => {
    const pool = PoolNode.parse({ position: [10, 1, 20], rotation: [0, Math.PI / 2, 0] })
    const attachment = findNearestPoolStairAttachment([7.8, 1, 20], [pool])
    expect(attachment).not.toBeNull()

    const patch = poolStairAttachmentPatch(attachment!)
    expect(patch.parentId).toBe(pool.id)
    expect(patch.poolId).toBe(pool.id)
    expect(patch.position).toEqual([0, pool.finishedDeckElevation, -2])
    expect(patch.rotation[1]).toBeCloseTo(0)
    expect(attachment!.position).toEqual([8, 1, 20])
    expect(attachment!.rotation[1]).toBeCloseTo(Math.PI / 2)
  })

  test('renders a pool child from wall attachment fields', () => {
    const pool = PoolNode.parse({ finishedDeckElevation: 0.2 })
    const stair = PoolStairNode.parse({
      parentId: pool.id,
      poolId: pool.id,
      wallIndex: 2,
      wallT: 0.25,
    })
    const mounted = resolveMountedPoolStair(stair, pool)
    expect(mounted.position).toEqual([2, 0.2, 2])
    expect(Math.abs(mounted.rotation[1])).toBeCloseTo(Math.PI)
  })
})
