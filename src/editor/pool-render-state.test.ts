import { describe, expect, test } from 'bun:test'
import type { AnyNode } from '@pascal-app/core'
import { PoolNode } from '../core/schema'
import {
  countPools,
  getPoolGeometrySignature,
  getPoolRippleUv,
  getPoolWaterResolution,
  selectPoolRenderNodes,
} from './pool-render-state'

function pool(id: string) {
  return PoolNode.parse({ id, type: 'pool:pool' }) as unknown as AnyNode
}

describe('pool render state', () => {
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

  test('reduces water resolution as the visible pool count grows', () => {
    expect(getPoolWaterResolution(1)).toBe(256)
    expect(getPoolWaterResolution(3)).toBe(128)
    expect(getPoolWaterResolution(12)).toBe(64)
    expect(countPools({ one: pool('pool_one'), two: pool('pool_two') })).toBe(2)
  })

  test('maps floor hits into the water simulation while ignoring coping hits', () => {
    const polygon: Array<[number, number]> = [[-4, -2], [4, -2], [4, 2], [-4, 2]]
    expect(getPoolRippleUv('pool-shell-floor', [0, 0], polygon)).toEqual([0.5, 0.5])
    expect(getPoolRippleUv('pool-shell-floor', [4, 2], polygon)).toEqual([1, 1])
    expect(getPoolRippleUv('pool-coping', [0, 0], polygon)).toBeNull()
  })
})
