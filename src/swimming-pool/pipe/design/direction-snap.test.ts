import { describe, expect, test } from 'bun:test'
import { snapPipePointToDirection, snapPipePointToRay } from './direction-snap'

describe('PVC direction snapping', () => {
  test('chooses the closest cardinal direction', () => {
    const point = snapPipePointToDirection([0, 1, 0], [3, 9, 0.4])
    expect(point[0]).toBeCloseTo(Math.hypot(3, 0.4))
    expect(point[1]).toBe(1)
    expect(point[2]).toBe(0)
  })

  test('chooses a 45-degree diagonal when the cursor points diagonally', () => {
    const point = snapPipePointToDirection([0, 2, 0], [2, 99, 2])
    expect(point[1]).toBe(2)
    expect(point[0]).toBeCloseTo(point[2])
    expect(point[0]).toBeCloseTo(Math.sqrt(8) / Math.sqrt(2))
  })

  test('rounds distance without breaking the chosen direction', () => {
    const point = snapPipePointToDirection([1, 0, 1], [2.2, 4, 2.2], 0.5)
    expect(point[0]).toBeCloseTo(point[2])
    expect(Math.hypot(point[0] - 1, point[2] - 1)).toBeCloseTo(1.5)
  })

  test('chooses the 3D direction closest to the camera ray', () => {
    const point = snapPipePointToRay([0, 0, 0], [3, 3, 5], [0, 0, -1])
    expect(point[0]).toBeCloseTo(point[1])
    expect(point[2]).toBeCloseTo(0)
    expect(point[0]).toBeGreaterThan(0)
  })

})
