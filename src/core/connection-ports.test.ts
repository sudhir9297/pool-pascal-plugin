import { describe, expect, test } from 'bun:test'
import { Euler, Vector3 } from 'three'
import { connectionPorts, rotateVectorXYZ } from './connection-ports'

describe('pool connection ports', () => {
  test('uses the same XYZ rotation convention as Three.js', () => {
    const vector = [0.3, -0.2, 0.8] as const
    const rotation = [0.4, -0.7, 1.1] as const
    const expected = new Vector3(...vector).applyEuler(new Euler(...rotation, 'XYZ'))

    expect(rotateVectorXYZ(vector, rotation)[0]).toBeCloseTo(expected.x)
    expect(rotateVectorXYZ(vector, rotation)[1]).toBeCloseTo(expected.y)
    expect(rotateVectorXYZ(vector, rotation)[2]).toBeCloseTo(expected.z)
  })

  test('returns level-local positions and converts metric diameters to inches', () => {
    const [port] = connectionPorts(
      { position: [4, 2, -3], rotation: [0, Math.PI / 2, 0] },
      [{ id: 'outlet', position: [0, 0, 1], direction: [0, 0, 1], diameterM: 0.0508, system: 'waste' }],
    )

    expect(port?.position[0]).toBeCloseTo(5)
    expect(port?.position[1]).toBeCloseTo(2)
    expect(port?.position[2]).toBeCloseTo(-3)
    expect(port?.direction[0]).toBeCloseTo(1)
    expect(port?.diameter).toBeCloseTo(2)
  })
})
