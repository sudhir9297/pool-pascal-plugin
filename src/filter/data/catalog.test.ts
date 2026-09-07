import { describe, expect, test } from 'bun:test'
import { PoolFilterNode } from '../core/schema'
import { getPoolFilterData, POOL_FILTER_CATALOG } from './catalog'

describe('pool filter catalog', () => {
  test('provides complete geometry data for every filter', () => {
    for (const filter of POOL_FILTER_CATALOG) {
      expect(filter.tank.diameter).toBeGreaterThan(0)
      expect(filter.tank.bodyHeight).toBeGreaterThan(0)
      expect(filter.connectionDiameter).toBeGreaterThan(0)
      expect(() => PoolFilterNode.parse({
        filterId: filter.id,
        technology: filter.technology,
        diameter: filter.tank.diameter,
        bodyHeight: filter.tank.bodyHeight,
        portDiameter: filter.connectionDiameter,
      })).not.toThrow()
    }
  })

  test('matches the default node to the compact reference model', () => {
    const node = PoolFilterNode.parse({})
    const filter = getPoolFilterData(node.filterId)
    expect(filter).toBeDefined()
    expect(node.diameter).toBe(filter!.tank.diameter)
    expect(node.bodyHeight).toBe(filter!.tank.bodyHeight)
    expect(node.portDiameter).toBe(filter!.connectionDiameter)
  })
})
