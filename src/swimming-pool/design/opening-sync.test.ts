import { describe, expect, test } from 'bun:test'
import { SlabNode } from '@pascal-app/core'
import { poolDefinition } from '../core/definition'
import { PoolNode } from '../core/schema'
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
})
