import { describe, expect, test } from 'bun:test'
import { Box3, Euler, Vector3 } from 'three'
import { buildPumpGeometry, getPumpPortLocalPositions, getPumpPortPositions } from './geometry'
import { PoolPumpNode } from './schema'

function expectVectorClose(actual: Vector3, expected: Vector3) {
  expect(actual.x).toBeCloseTo(expected.x, 8)
  expect(actual.y).toBeCloseTo(expected.y, 8)
  expect(actual.z).toBeCloseTo(expected.z, 8)
}

describe('pool pump geometry', () => {
  test('keeps inlet first and centers both visible port faces on their hotspots', () => {
    const pump = PoolPumpNode.parse({})
    const ports = getPumpPortLocalPositions(pump)
    const geometry = buildPumpGeometry(pump)

    expect(geometry.userData.portOrder).toEqual(['inlet', 'outlet'])
    expect(ports).toHaveLength(2)
    expect(ports[0]!.z).toBeGreaterThan(pump.bodyDepth / 2)
    expect(ports[1]!.y).toBeGreaterThan(ports[0]!.y)

    geometry.updateMatrixWorld(true)
    const inletFace = geometry.getObjectByName('pump-port-inlet-face')
    const outletFace = geometry.getObjectByName('pump-port-outlet-face')
    expect(inletFace?.userData.role).toBe('port-face')
    expect(outletFace?.userData.role).toBe('port-face')
    expectVectorClose(inletFace!.getWorldPosition(new Vector3()), ports[0]!)
    expectVectorClose(outletFace!.getWorldPosition(new Vector3()), ports[1]!)
  })

  test('keeps transformed pipe positions aligned with the visible port faces', () => {
    const pump = PoolPumpNode.parse({
      position: [1.4, 0.2, -0.7],
      rotation: [0.14, -0.65, 0.08],
    })
    const rotation = new Euler(...pump.rotation, 'XYZ')
    const translation = new Vector3(...pump.position)
    const geometry = buildPumpGeometry(pump)
    geometry.updateMatrixWorld(true)

    const visibleFaces = ['pump-port-inlet-face', 'pump-port-outlet-face'].map((name) => {
      const face = geometry.getObjectByName(name)
      expect(face).toBeDefined()
      return face!.getWorldPosition(new Vector3()).applyEuler(rotation).add(translation)
    })

    getPumpPortPositions(pump).forEach((port, index) => expectVectorClose(port, visibleFaces[index]!))
  })

  test('keeps the default model on or above the host floor', () => {
    const geometry = buildPumpGeometry(PoolPumpNode.parse({}))
    geometry.updateMatrixWorld(true)
    const bounds = new Box3().setFromObject(geometry)

    expect(bounds.min.y).toBeGreaterThanOrEqual(-1e-8)
    expect(bounds.max.y).toBeGreaterThan(0)
  })
})
