import { describe, expect, test } from 'bun:test'
import { Box3 } from 'three'
import { buildPoolGeometry } from '../../core/geometry'
import { PoolNode } from '../../core/schema'
import { buildPoolStairGeometry } from '../core/geometry'
import { PoolStairNode } from '../core/schema'
import { getPoolStairPreset, POOL_STAIR_VARIANTS } from '../data/catalog'
import { resolvePoolStairMounting } from './mounting'

describe('pool stair rock-coping clearance', () => {
  test('keeps every coping rock in place', () => {
    const pool = PoolNode.parse({ copingStyle: 'rock', copingWidth: 0.6, copingSeed: 7 })
    const before = buildPoolGeometry(pool).getObjectByName('pool-coping')
    const stair = PoolStairNode.parse({ poolId: pool.id, variant: 'compact' })
    resolvePoolStairMounting(stair, pool)
    const after = buildPoolGeometry(pool).getObjectByName('pool-coping')
    expect(after?.children).toHaveLength(before?.children.length ?? 0)
  })

  test('moves every stair option around a wide rock border', () => {
    const pool = PoolNode.parse({ copingStyle: 'rock', copingWidth: 0.6, copingThickness: 0.2 })
    for (const variant of POOL_STAIR_VARIANTS) {
      const stair = PoolStairNode.parse({ variant })
      const preset = getPoolStairPreset(variant)
      const mounting = resolvePoolStairMounting(stair, pool)
      expect(mounting.deckReach).toBeGreaterThan(preset.deckReach)
      expect(mounting.innerOffset).toBeGreaterThan(preset.innerOffset)

      const geometry = buildPoolStairGeometry(stair, mounting)
      const anchors = geometry.children.filter((child) => child.name === 'pool-stair-outer-anchor')
      expect(anchors).toHaveLength(2)
      expect(anchors.every((anchor) => anchor.position.z === -mounting.deckReach)).toBe(true)
      const rail = geometry.getObjectByName('pool-stair-left-rail')
      expect(new Box3().setFromObject(rail!).max.y).toBeGreaterThanOrEqual(mounting.railHeight)
    }
  })

  test('preserves the photo-based dimensions on non-rock coping', () => {
    const pool = PoolNode.parse({ copingStyle: 'continuous' })
    for (const variant of POOL_STAIR_VARIANTS) {
      const stair = PoolStairNode.parse({ variant })
      const preset = getPoolStairPreset(variant)
      expect(resolvePoolStairMounting(stair, pool)).toEqual({
        deckReach: preset.deckReach,
        innerOffset: preset.innerOffset,
        railHeight: preset.railHeight,
      })
    }
  })
})
