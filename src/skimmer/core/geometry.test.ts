import { describe, expect, test } from 'bun:test'
import { Mesh } from 'three'
import { buildSkimmerGeometry } from './geometry'
import { PoolSkimmerNode } from './schema'

describe('pool skimmer geometry', () => {
  test('contains the visible faceplate, weir, waterline, outlet neck, and PVC socket', () => {
    const group = buildSkimmerGeometry(PoolSkimmerNode.parse({ id: 'pool-skimmer_geometry' }))
    const meshes = group.children.filter((child) => child instanceof Mesh)

    expect(meshes).toHaveLength(10)
    expect(group.position.toArray()).toEqual([0, 0, 0])
  })
})
