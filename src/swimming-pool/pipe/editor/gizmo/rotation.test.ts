import { describe, expect, test } from 'bun:test'
import { Quaternion, Vector3 } from 'three'
import { createPipeRotationFrame, pipeRotationDelta } from './rotation'

describe('PVC pivot rotation frame', () => {
  test('uses the fitting as origin and the selected branch as the radial direction', () => {
    const frame = createPipeRotationFrame(new Vector3(0, 1, 0), new Vector3(2, 0, 0))
    expect(frame.radial.toArray()).toEqual([1, 0, 0])
    expect(frame.tangent.x).toBeCloseTo(0)
    expect(frame.tangent.z).toBeCloseTo(-1)

    const delta = pipeRotationDelta(
      new Vector3(4, 2, 3),
      frame.radial,
      frame.tangent,
      new Vector3(5, 2, 3),
      new Vector3(4, 2, 2),
    )
    expect(delta).toBeCloseTo(Math.PI / 2)
  })

  test('is invariant when the whole PVC network is rotated in world space', () => {
    const local = createPipeRotationFrame(new Vector3(0, 1, 0), new Vector3(1, 0, 0))
    const worldTurn = new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), Math.PI / 3)
    const origin = new Vector3(2, 4, -3)
    const radial = local.radial.clone().applyQuaternion(worldTurn)
    const tangent = local.tangent.clone().applyQuaternion(worldTurn)
    const start = origin.clone().add(radial)
    const current = origin.clone().add(tangent)

    expect(pipeRotationDelta(origin, radial, tangent, start, current)).toBeCloseTo(Math.PI / 2)
  })

  test('keeps a valid basis when the branch direction is parallel to the axis', () => {
    const frame = createPipeRotationFrame(new Vector3(0, 1, 0), new Vector3(0, 2, 0))
    expect(frame.radial.length()).toBeCloseTo(1)
    expect(frame.tangent.length()).toBeCloseTo(1)
    expect(frame.radial.dot(frame.normal)).toBeCloseTo(0)
  })

  test('does not jump by a full turn when the cursor crosses the angle seam', () => {
    const origin = new Vector3()
    const radial = new Vector3(1, 0, 0)
    const tangent = new Vector3(0, 0, -1)
    const startAngle = (179 * Math.PI) / 180
    const currentAngle = (-179 * Math.PI) / 180
    const point = (angle: number) => radial.clone().multiplyScalar(Math.cos(angle)).addScaledVector(tangent, Math.sin(angle))

    expect(pipeRotationDelta(origin, radial, tangent, point(startAngle), point(currentAngle))).toBeCloseTo((2 * Math.PI) / 180)
  })
})
