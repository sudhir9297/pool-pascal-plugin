import { describe, expect, test } from 'bun:test'
import { PoolNode } from '../core/schema'
import { buildSharedJointGeometry } from '../shared-joint/core/geometry'
import { PoolSharedJointNode } from '../shared-joint/core/schema'
import { PoolSpilloverNode } from '../spillover/core/schema'
import { resolvePoolSpillover } from '../spillover/design/placement'
import { findSharedPoolJoint, getPoolConnectionPoints, getPoolConnectionRegions, syncSharedPoolJoints } from './shared-joint'

describe('shared pool joints', () => {
  test('detects a side-by-side pool pair and sizes one joint bridge', () => {
    const rectangle = [[-2, -1.5], [2, -1.5], [2, 1.5], [-2, 1.5]]
    const first = PoolNode.parse({ position: [0, 0, 0], polygon: rectangle })
    const second = PoolNode.parse({ position: [3.5, 0, 0], polygon: rectangle })
    const joint = findSharedPoolJoint(first, second)
    expect(joint).not.toBeNull()
    expect(joint?.position).toEqual([1.75, 0, 0])
    expect(joint?.width).toBeCloseTo(3)
    expect(joint?.length).toBeCloseTo(0.5)
  })

  test('does not join pools that are too far apart', () => {
    const rectangle = [[-2, -1.5], [2, -1.5], [2, 1.5], [-2, 1.5]]
    const first = PoolNode.parse({ position: [0, 0, 0], polygon: rectangle })
    const second = PoolNode.parse({ position: [6, 0, 0], polygon: rectangle })
    expect(findSharedPoolJoint(first, second)).toBeNull()
  })

  test('does not generate a full-depth joint for intersecting pools', () => {
    const rectangle = [[-2, -1.5], [2, -1.5], [2, 1.5], [-2, 1.5]]
    const first = PoolNode.parse({ id: 'pool_intersecting_a', parentId: 'level_a', position: [0, 0, 0], polygon: rectangle })
    const second = PoolNode.parse({ id: 'pool_intersecting_b', parentId: 'level_a', position: [3.5, 0, 0], polygon: rectangle })

    const changes = syncSharedPoolJoints({
      [first.id]: first,
      [second.id]: second,
    } as never)

    expect(changes.create).toEqual([])
  })

  test('detects the same joint when the second pool is on the opposite side', () => {
    const rectangle = [[-2, -1.5], [2, -1.5], [2, 1.5], [-2, 1.5]]
    const first = PoolNode.parse({ position: [3.5, 0, 0], polygon: rectangle })
    const second = PoolNode.parse({ position: [0, 0, 0], polygon: rectangle })
    expect(findSharedPoolJoint(first, second)?.position).toEqual([1.75, 0, 0])
  })

  test('uses the actual rotated pool edges rather than an axis-aligned box', () => {
    const rectangle = [[-2, -1.5], [2, -1.5], [2, 1.5], [-2, 1.5]]
    const first = PoolNode.parse({ position: [0, 0, 0], polygon: rectangle, rotation: [0, Math.PI / 4, 0] })
    const second = PoolNode.parse({ position: [4, 0, 0], polygon: rectangle, rotation: [0, Math.PI / 4, 0] })
    const joint = findSharedPoolJoint(first, second, 1)
    expect(joint).not.toBeNull()
    expect(Math.abs(joint?.rotation[1] ?? 0)).toBeCloseTo(Math.PI / 4)
    expect(joint?.width).toBeGreaterThan(0.1)
  })

  test('uses the connection position for coping removal on each pool', () => {
    const first = PoolNode.parse({ position: [0, 0, 0] })
    const second = PoolNode.parse({ position: [4.5, 0, 0] })
    const connection = PoolSharedJointNode.parse({
      id: 'pool-shared-joint_pool_a_pool_b',
      poolIds: [first.id, second.id],
      position: [2.25, 0, 0],
    })
    const nodes = { [first.id]: first, [second.id]: second, [connection.id]: connection }
    expect(getPoolConnectionPoints(first, nodes as never)).toEqual([[2.25, 0]])
    expect(getPoolConnectionPoints(second, nodes as never)).toEqual([[-2.25, 0]])
  })

  test.each(['auto', 'direct-spillover', 'watercourse'] as const)(
    'keeps both pool basins intact for a %s spillover',
    (connectionStyle) => {
      const rectangle = [[-2, -1.5], [2, -1.5], [2, 1.5], [-2, 1.5]]
      const upper = PoolNode.parse({ id: 'pool_opening_upper', parentId: 'level_a', position: [0, 1, 0], polygon: rectangle })
      const lower = PoolNode.parse({ id: 'pool_opening_lower', parentId: 'level_a', position: [3.5, 0, 0], polygon: rectangle })
      const placement = resolvePoolSpillover(upper, lower, connectionStyle)
      expect(placement).not.toBeNull()
      const spillover = PoolSpilloverNode.parse({
        id: 'pool-spillover_openings',
        parentId: 'level_a',
        ...placement,
      })
      for (const connection of [spillover, { ...spillover, sourceOpening: [], targetOpening: [] }]) {
        const nodes = { [upper.id]: upper, [lower.id]: lower, [connection.id]: connection }
        expect(getPoolConnectionRegions(upper, nodes as never)).toEqual([])
        expect(getPoolConnectionRegions(lower, nodes as never)).toEqual([])
      }
    },
  )

  test('preserves full-depth openings for shared pool joints', () => {
    const pool = PoolNode.parse({ id: 'pool_shared_opening', position: [3, 1, 2] })
    const joint = PoolSharedJointNode.parse({
      poolIds: [pool.id, 'pool_other'],
      intersection: [[[3, 2], [4, 2], [4, 3], [3, 3]]],
    })
    expect(getPoolConnectionRegions(pool, { [joint.id]: joint } as never))
      .toEqual([[[0, 0], [1, 0], [1, 1], [0, 1]]])
  })

  test('tracks the lower finished deck height', () => {
    const rectangle = [[-2, -1.5], [2, -1.5], [2, 1.5], [-2, 1.5]]
    const first = PoolNode.parse({
      position: [0, 0.4, 0],
      finishedDeckElevation: 0.2,
      polygon: rectangle,
    })
    const second = PoolNode.parse({
      position: [3.5, 0.8, 0],
      finishedDeckElevation: 0.1,
      polygon: rectangle,
    })
    expect(findSharedPoolJoint(first, second)?.position[1]).toBeCloseTo(0.6)
  })

  test('removes an automatic joint when an explicit spillover connects the same pools', () => {
    const rectangle = [[-2, -1.5], [2, -1.5], [2, 1.5], [-2, 1.5]]
    const first = PoolNode.parse({ id: 'pool_joint_a', parentId: 'level_a', position: [0, 1, 0], polygon: rectangle })
    const second = PoolNode.parse({ id: 'pool_joint_b', parentId: 'level_a', position: [3.5, 0, 0], polygon: rectangle })
    const jointId = 'pool-shared-joint_pool_joint_a_pool_joint_b'
    const joint = PoolSharedJointNode.parse({
      id: jointId,
      parentId: 'level_a',
      poolIds: [first.id, second.id],
    })
    const spillover = PoolSpilloverNode.parse({
      parentId: 'level_a',
      sourcePoolId: first.id,
      targetPoolId: second.id,
    })

    const changes = syncSharedPoolJoints({
      [first.id]: first,
      [second.id]: second,
      [joint.id]: joint,
      [spillover.id]: spillover,
    } as never)

    expect(changes.create).toEqual([])
    expect(changes.delete).toEqual([jointId])
  })

  test('does not carve a stale shared joint when a spillover owns the pair', () => {
    const first = PoolNode.parse({ id: 'pool_stale_joint_a', parentId: 'level_a', position: [0, 0, 0] })
    const second = PoolNode.parse({ id: 'pool_stale_joint_b', parentId: 'level_a', position: [3.5, 0, 0] })
    const joint = PoolSharedJointNode.parse({
      id: 'pool-shared-joint_pool_stale_joint_a_pool_stale_joint_b',
      poolIds: [first.id, second.id],
      intersection: [[[1.5, -1.5], [2, -1.5], [2, 1.5], [1.5, 1.5]]],
    })
    const spillover = PoolSpilloverNode.parse({
      parentId: 'level_a',
      sourcePoolId: first.id,
      targetPoolId: second.id,
    })

    expect(getPoolConnectionRegions(first, {
      [joint.id]: joint,
      [spillover.id]: spillover,
    } as never)).toEqual([])
  })

  test('renders a water passage, submerged shelf, and seam rocks', () => {
    const geometry = buildSharedJointGeometry(PoolSharedJointNode.parse({
      poolIds: ['pool_a', 'pool_b'],
      length: 0.85,
      width: 3,
      position: [1.75, 0, 0],
      intersection: [[[1.5, -1.5], [2, -1.5], [2, 1.5], [1.5, 1.5]]],
    }))

    expect(geometry.children.map((child) => child.name)).toEqual([
      'pool-connection-common-floor',
      'pool-connection-water-passage',
      'pool-connection-continuous-border',
      'pool-connection-submerged-shelf',
    ])
    expect(geometry.children[0]?.children).toHaveLength(1)
  })

})
