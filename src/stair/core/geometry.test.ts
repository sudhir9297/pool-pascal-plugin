import { describe, expect, test } from 'bun:test'
import { buildPoolStairGeometry } from './geometry'
import { PoolStairNode } from './schema'
import { Box3 } from 'three'

describe('pool stair geometry', () => {
  test('builds treads, side rails, anchors, and handrails', () => {
    const node = PoolStairNode.parse({ stepCount: 4 })
    const geometry = buildPoolStairGeometry(node)
    const meshes: unknown[] = []
    geometry.traverse((child) => { if ((child as { isMesh?: boolean }).isMesh) meshes.push(child) })
    expect(meshes.length).toBeGreaterThan(20)
    expect(geometry.position.toArray()).toHaveLength(3)
  })

  test('supports the reference ladder with a different tread count', () => {
    const node = PoolStairNode.parse({ stepCount: 3 })
    expect(() => buildPoolStairGeometry(node)).not.toThrow()
  })

  test('keeps every tread vertical against the wall for all four reference options', () => {
    for (const variant of ['extended', 'classic', 'square', 'compact'] as const) {
      const geometry = buildPoolStairGeometry(PoolStairNode.parse({ variant }))
      const treads = geometry.children.filter((child) => /^pool-stair-tread-\d+$/.test(child.name))
      expect(treads).toHaveLength(PoolStairNode.parse({ variant }).stepCount)
      expect(new Set(treads.map((tread) => tread.position.z)).size).toBe(1)
      expect(geometry.getObjectByName('pool-stair-left-rail')).toBeDefined()
      expect(geometry.getObjectByName('pool-stair-right-rail')).toBeDefined()
    }
  })

  test('gives every option a visibly different top height', () => {
    const heights = (['extended', 'classic', 'square', 'compact'] as const).map((variant) => {
      const geometry = buildPoolStairGeometry(PoolStairNode.parse({ variant }))
      const rail = geometry.getObjectByName('pool-stair-left-rail')
      expect(rail).toBeDefined()
      return new Box3().setFromObject(rail!).max.y
    })
    expect(heights[0]!).toBeGreaterThan(heights[1]!)
    expect(heights[1]!).toBeGreaterThan(heights[2]!)
    expect(heights[2]!).toBeGreaterThan(heights[3]!)
  })
})
