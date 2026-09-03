import { describe, expect, test } from 'bun:test'
import { PoolSpilloverNode } from './schema'
import { buildPoolSpilloverGeometry } from './geometry'

describe('pool spillover geometry', () => {
  test('builds a crest, falling sheet, and receiving impact', () => {
    const geometry = buildPoolSpilloverGeometry(PoolSpilloverNode.parse({
      sourcePoolId: 'pool-upper',
      targetPoolId: 'pool-lower',
      width: 2.4,
      dropHeight: 0.6,
    }))
    expect(geometry.children.map((child) => child.name)).toEqual([
      'pool-spillover-crest',
      'pool-spillover-water-sheet',
      'pool-spillover-impact',
    ])
    expect(geometry.userData.waterEffects).toHaveLength(2)
    geometry.traverse((child) => {
      if ('geometry' in child && child.geometry && typeof child.geometry === 'object' && 'dispose' in child.geometry) {
        (child.geometry as { dispose: () => void }).dispose()
      }
      if ('material' in child) {
        const material = child.material as unknown
        if (Array.isArray(material)) material.forEach((item) => { if (item && typeof item === 'object' && 'dispose' in item) (item as { dispose: () => void }).dispose() })
        else if (material && typeof material === 'object' && 'dispose' in material) (material as { dispose: () => void }).dispose()
      }
    })
  })
})
