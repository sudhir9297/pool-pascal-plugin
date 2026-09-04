import { describe, expect, test } from 'bun:test'
import type { Mesh } from 'three'
import { buildPoolSpilloverGeometry } from './geometry'
import { poolSpilloverFloorplan } from './definition'
import { PoolSpilloverNode } from './schema'
import { poolSpilloverParametrics } from '../editor/parametrics'

describe('pool spillover definition compatibility', () => {
  test('loads and renders a node saved before endpoint paths were introduced', () => {
    const legacy = PoolSpilloverNode.parse({
      id: 'pool-spillover_legacy',
      parentId: 'level_a',
      sourcePoolId: 'pool_a',
      targetPoolId: 'pool_b',
      intersection: [[[0, -1], [1, -1], [1, 1], [0, 1]]],
      sourceSide: 1,
      width: 1.2,
      length: 0.6,
      dropHeight: 0.4,
    })
    const geometry = buildPoolSpilloverGeometry(legacy)

    expect(legacy.connectionPath).toEqual([])
    expect(legacy.sourceOpening).toEqual([])
    expect(legacy.targetOpening).toEqual([])
    expect(legacy.effectiveWidth).toBeNull()
    expect(geometry.getObjectByName('pool-spillover-water-sheet')).toBeDefined()
    expect(poolSpilloverFloorplan(legacy).kind).toBe('group')

    geometry.traverse((child) => {
      const mesh = child as Mesh
      if (mesh.isMesh) mesh.geometry.dispose()
    })
  })

  test('exposes all three connection styles as a segmented control', () => {
    const field = poolSpilloverParametrics.groups[0]?.fields.find((candidate) => candidate.key === 'connectionStyle')
    expect(field).toEqual({
      key: 'connectionStyle',
      kind: 'enum',
      options: ['auto', 'direct-spillover', 'watercourse'],
      display: 'segmented',
    })
  })
})
