import { describe, expect, test } from 'bun:test'
import type { AnyNode } from '@pascal-app/core'
import { PoolNode } from '../core/schema'
import {
  countPools,
  getPoolGeometrySignature,
  getPoolResizePreviewTransform,
  getPoolWaterResolution,
  shouldAdvancePoolWater,
  selectPoolRenderNodes,
} from './pool-render-state'

function pool(id: string) {
  return PoolNode.parse({ id, type: 'pool:pool' }) as unknown as AnyNode
}

describe('pool render state', () => {
  test('does not run nested water render passes during immersive XR', () => {
    expect(shouldAdvancePoolWater(true, true)).toBe(false)
    expect(shouldAdvancePoolWater(false, true)).toBe(true)
    expect(shouldAdvancePoolWater(false, false)).toBe(false)
  })

  test('ignores unrelated scene nodes but retains connected pools and connections', () => {
    const first = pool('pool_first')
    const second = pool('pool_second')
    const unrelated = pool('pool_unrelated')
    const spillover = {
      id: 'pool-spillover_link',
      type: 'pool:spillover',
      sourcePoolId: first.id,
      targetPoolId: second.id,
    } as unknown as AnyNode
    const nodes = Object.fromEntries(
      [first, second, unrelated, spillover].map((node) => [node.id, node]),
    ) as Record<string, AnyNode>

    expect(selectPoolRenderNodes(nodes, first.id)).toEqual([second, spillover])
  })

  test('does not rebuild geometry for water-only changes', () => {
    const original = PoolNode.parse({})
    const waterEdit = PoolNode.parse({ ...original, rain: 0.8, waterColor: '#123456' })
    const geometryEdit = PoolNode.parse({ ...original, depth: 2.2 })

    expect(getPoolGeometrySignature(waterEdit)).toBe(getPoolGeometrySignature(original))
    expect(getPoolGeometrySignature(geometryEdit)).not.toBe(getPoolGeometrySignature(original))
  })

  test('does not rebuild geometry when only the pool transform changes', () => {
    const original = PoolNode.parse({})
    const moved = PoolNode.parse({
      ...original,
      position: [4, 0, -3],
      rotation: [0, Math.PI / 3, 0],
    })

    expect(getPoolGeometrySignature(moved)).toBe(getPoolGeometrySignature(original))
  })

  test('turns an in-flight outline resize into a cheap mesh transform', () => {
    const committed = PoolNode.parse({
      shape: 'custom',
      polygon: [[1, 2], [9, 2], [9, 6], [1, 6]],
      outlineControlPoints: [[1, 2], [9, 2], [9, 6], [1, 6]],
      length: 8,
      width: 4,
    })
    const preview = PoolNode.parse({
      ...committed,
      polygon: [[-1, 1], [11, 1], [11, 7], [-1, 7]],
      outlineControlPoints: [[-1, 1], [11, 1], [11, 7], [-1, 7]],
      length: 12,
      width: 6,
    })

    expect(getPoolResizePreviewTransform(committed, preview)).toEqual({
      position: [-2.5, 0, -2],
      scale: [1.5, 1, 1.5],
    })
  })

  test('reduces water resolution as the visible pool count grows', () => {
    expect(getPoolWaterResolution(1)).toBe(256)
    expect(getPoolWaterResolution(1, 'low')).toBe(64)
    expect(getPoolWaterResolution(1, 'medium')).toBe(128)
    expect(getPoolWaterResolution(1, 'ultra')).toBe(384)
    expect(getPoolWaterResolution(3)).toBe(128)
    expect(getPoolWaterResolution(12)).toBe(64)
    expect(countPools({ one: pool('pool_one'), two: pool('pool_two') })).toBe(2)
  })

  test('rebuilds the compiled water graph when its quality changes', () => {
    const original = PoolNode.parse({ waterQuality: 'high' })
    const ultra = PoolNode.parse({ ...original, waterQuality: 'ultra' })
    expect(getPoolGeometrySignature(original)).not.toBe(getPoolGeometrySignature(ultra))
  })

})
