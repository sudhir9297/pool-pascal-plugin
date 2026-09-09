import { expect, test } from 'bun:test'
import { Euler, Vector3 } from 'three'
import { rotatePlanPoint } from './placement-rotation'

test('pool outline turns match equipment yaw in the level plane', () => {
  for (const turns of [0, 1, 2, 3, 4]) {
    const yaw = turns * Math.PI / 2
    const expected = new Vector3(3, 0, 2).applyEuler(new Euler(0, yaw, 0))
    const point = rotatePlanPoint([3, 2], yaw)
    expect(point[0]).toBeCloseTo(expected.x)
    expect(point[1]).toBeCloseTo(expected.z)
  }
})
