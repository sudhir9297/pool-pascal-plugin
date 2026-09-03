import { describe, expect, test } from 'bun:test'
import { SlabNode } from '@pascal-app/core'
import { poolDefinition } from '../core/definition'
import { PoolNode } from '../core/schema'
import { PoolSharedJointNode } from '../shared-joint/core/schema'
import { syncPoolGroundOpenings, syncPoolSlabOpenings } from './opening-sync'

describe('swimming pool floor openings', () => {
  test('creates a recessed helper for the site and shadow receiver', () => {
    const pool = PoolNode.parse({
      ...poolDefinition.defaults(),
      id: 'pool_ground-opening',
      parentId: 'level_ground',
    })

    const changes = syncPoolGroundOpenings({ [pool.id]: pool })
    const helper = changes.create[0]

    expect(helper?.recessed).toBe(true)
    expect(helper?.holes).toHaveLength(1)
    expect(helper?.metadata).toMatchObject({ poolGroundOpeningFor: pool.id })
  })

  test('adds the pool construction opening to its host slab', () => {
    const slab = SlabNode.parse({
      id: 'slab_pool-deck',
      parentId: 'level_ground',
      polygon: [[-12, -8], [12, -8], [12, 8], [-12, 8]],
    })
    const pool = PoolNode.parse({
      ...poolDefinition.defaults(),
      id: 'pool_slab-opening',
      parentId: 'level_ground',
      supportSlabId: slab.id,
    })

    const updates = syncPoolSlabOpenings({ [pool.id]: pool, [slab.id]: slab })

    expect(updates).toHaveLength(1)
    expect(updates[0]?.id).toBe(slab.id)
    expect(updates[0]?.data.holes).toHaveLength(1)
  })

  test('creates a recessed helper for a submerged pool connection', () => {
    const connection = PoolSharedJointNode.parse({
      id: 'pool-shared-joint_pool_a_pool_b',
      parentId: 'level_ground',
      poolIds: ['pool_a', 'pool_b'],
      position: [2.25, 0, 0],
      length: 0.85,
      width: 3,
    })

    const changes = syncPoolGroundOpenings({ [connection.id]: connection })
    const helper = changes.create[0]

    expect(helper?.recessed).toBe(true)
    expect(helper?.polygon).toHaveLength(4)
    expect(helper?.metadata).toMatchObject({
      poolGroundOpeningFor: `pool-connection:${connection.id}`,
    })
  })

  test('adds the connection opening to the host slab', () => {
    const slab = SlabNode.parse({
      id: 'slab_connection-deck',
      parentId: 'level_ground',
      polygon: [[-12, -8], [12, -8], [12, 8], [-12, 8]],
    })
    const connection = PoolSharedJointNode.parse({
      id: 'pool-shared-joint_pool_c_pool_d',
      parentId: 'level_ground',
      poolIds: ['pool_c', 'pool_d'],
      position: [2.25, 0, 0],
      length: 0.85,
      width: 3,
    })

    const updates = syncPoolSlabOpenings({ [slab.id]: slab, [connection.id]: connection })

    expect(updates).toHaveLength(1)
    expect(updates[0]?.data.holes).toHaveLength(1)
  })
})
