import { describe, expect, test } from 'bun:test'
import { Box3, Vector3 } from 'three'
import { disposeObject3D } from '../../editor/dispose-object'
import { buildDrainGeometry, getDrainPortDirection, getDrainPortPosition } from './geometry'
import { PoolDrainNode } from './schema'

describe('pool drain geometry', () => {
  test('builds distinct complete round and square grates', () => {
    const round = buildDrainGeometry(PoolDrainNode.parse({ style: 'round' }))
    const square = buildDrainGeometry(PoolDrainNode.parse({ style: 'square' }))

    expect(round.name).toBe('pool-drain-geometry')
    expect(round.children).toHaveLength(11)
    expect(square.children).toHaveLength(14)
    for (const geometry of [round, square]) {
      const bounds = new Box3().setFromObject(geometry)
      expect(bounds.min.toArray().every(Number.isFinite)).toBe(true)
      expect(bounds.max.toArray().every(Number.isFinite)).toBe(true)
      expect(bounds.max.y).toBeGreaterThan(0)
      expect(bounds.min.y).toBeLessThan(0)
      disposeObject3D(geometry)
    }
  })

  test('rotates and translates the underside pipe connection with the node', () => {
    const node = PoolDrainNode.parse({
      position: [2, 3, 4],
      rotation: [0, 0, Math.PI / 2],
      bodyDepth: 0.2,
    })
    const direction = getDrainPortDirection(node)
    const position = getDrainPortPosition(node)

    expect(direction.distanceTo(new Vector3(1, 0, 0))).toBeLessThan(1e-10)
    expect(position.distanceTo(new Vector3(2.28, 3, 4))).toBeLessThan(1e-10)
  })
})
