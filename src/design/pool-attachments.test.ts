import { describe, expect, test } from 'bun:test'
import { useScene, type AnyNode } from '@pascal-app/core'
import { Euler, Vector3 } from 'three'
import { PoolNode } from '../core/schema'
import { PoolDrainNode } from '../drain/core/schema'
import { PoolInletNode } from '../inlet/core/schema'
import { PoolSkimmerNode } from '../skimmer/core/schema'
import { PoolWaterfallNode } from '../water-feature/waterfall/core/schema'
import { createPoolPluginNode } from '../editor/scene-nodes'
import { poolInletDefinition } from '../inlet/core/definition'
import { placementOnPoolWall } from '../skimmer/design/placement'
import { poolAttachmentUpdates, resolvePoolAttachment } from './pool-attachments'

describe('pool child attachments', () => {
  test('preserves wall fraction and local orientation during pool resize and rotation', () => {
    const pool = PoolNode.parse({ id: 'pool_attached', position: [10, 2, -5], rotation: [0, 0.7, 0], length: 8, width: 4 })
    const placement = placementOnPoolWall(pool, 0, 0.25)!
    const node = PoolSkimmerNode.parse({ ...placement, poolId: pool.id, parentId: 'level_test' })
    const child = resolvePoolAttachment(node, pool)!
    expect(child.parentId).toBe(pool.id)
    const world = new Vector3(...child.position).applyEuler(new Euler(...pool.rotation)).add(new Vector3(...pool.position))
    expect(world.distanceTo(new Vector3(...placement.position))).toBeLessThan(1e-8)
    const resized = PoolNode.parse({ ...pool, length: 16, width: 8, polygon: [[-8, -4], [8, -4], [8, 4], [-8, 4]], position: [20, 3, 2], rotation: [0, 1.2, 0] })
    const moved = resolvePoolAttachment(child, resized)!
    expect(moved.position).toEqual([-4, pool.designWaterElevation, -4])
    expect(moved.rotation).toEqual(child.rotation)
  })

  test('keeps floor station while changing pool size and depth', () => {
    const pool = PoolNode.parse({ id: 'pool_floor', length: 8, width: 4, depth: 1.5 })
    const drain = PoolDrainNode.parse({ poolId: pool.id, position: [2, -1.5, 1] })
    const child = resolvePoolAttachment(drain, pool)!
    expect(child.type === 'pool:drain' && child.floorAnchor).toEqual([0.75, 0.75])
    const resized = PoolNode.parse({ ...pool, length: 16, width: 8, polygon: [[-8, -4], [8, -4], [8, 4], [-8, 4]], depth: 2.5 })
    expect(resolvePoolAttachment(child, resized)?.position).toEqual([4, -2.5, 2])
  })

  test('passes the pool parent to scene creation and keeps pipe ports in level coordinates', () => {
    const before = useScene.getState()
    const pool = PoolNode.parse({ id: 'pool_scene_children', position: [10, 2, -5], rotation: [0, Math.PI / 2, 0], parentId: 'level_test' })
    try {
      let created: unknown
      let createdParent: unknown
      useScene.setState({ nodes: { [pool.id]: pool } as unknown as Record<string, AnyNode>, createNode: (node, parentId) => { created = node; createdParent = parentId } })
      const inlet = PoolInletNode.parse({ id: 'pool-inlet_child', poolId: pool.id, wallIndex: 0, wallT: 0.25 })
      createPoolPluginNode(inlet, 'level_test')
      const stored = PoolInletNode.parse(created)
      expect(stored.parentId).toBe(pool.id)
      expect(createdParent).toBe(pool.id)
      const port = poolInletDefinition.ports!(stored)[0]!
      const expected = new Vector3(0, stored.verticalOffset, -stored.bodyDepth - 0.0375)
        .applyEuler(new Euler(...stored.rotation)).add(new Vector3(...stored.position))
        .applyEuler(new Euler(...pool.rotation)).add(new Vector3(...pool.position))
      expect(new Vector3(...port.position).distanceTo(expected)).toBeLessThan(1e-8)
      expect(poolAttachmentUpdates({ [pool.id]: pool, [stored.id]: stored })).toEqual([])
    } finally {
      useScene.setState(before)
    }
  })

  test('adopts existing attachments, includes mounted waterfalls, and leaves standalone items alone', () => {
    const pool = PoolNode.parse({ id: 'pool_migrate', parentId: 'level_test' })
    const skimmer = PoolSkimmerNode.parse({ poolId: pool.id, parentId: 'level_test' })
    const waterfall = PoolWaterfallNode.parse({ poolId: pool.id, parentId: 'level_test' })
    const standalone = PoolWaterfallNode.parse({ poolId: null, parentId: 'level_test' })
    const nodes = { [pool.id]: pool, [skimmer.id]: skimmer, [waterfall.id]: waterfall, [standalone.id]: standalone }
    const updates = poolAttachmentUpdates(nodes)
    expect(updates).toHaveLength(2)
    expect(updates.every((update) => update.data.parentId === pool.id)).toBe(true)
    const resolved = { ...nodes } as Record<string, unknown>
    for (const update of updates) resolved[update.id] = { ...nodes[update.id as keyof typeof nodes], ...update.data }
    expect(poolAttachmentUpdates(resolved)).toEqual([])
  })
})
