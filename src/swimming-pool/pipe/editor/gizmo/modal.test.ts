import { describe, expect, test } from 'bun:test'
import { pipeDirectionalSnap45, pipeRotationSnap, PIPE_ROTATION_SNAP_DEGREES } from './modal'

describe('PVC gizmo rotation snapping', () => {
  test('snaps rotations to 45 degree increments', () => {
    expect(PIPE_ROTATION_SNAP_DEGREES).toBe(45)
    expect(pipeRotationSnap((20 * Math.PI) / 180)).toBe(0)
    expect(pipeRotationSnap((24 * Math.PI) / 180)).toBe((45 * Math.PI) / 180)
    expect(pipeRotationSnap((68 * Math.PI) / 180)).toBe((90 * Math.PI) / 180)
    expect(pipeRotationSnap((-24 * Math.PI) / 180)).toBe((-45 * Math.PI) / 180)
  })

  test('allows a custom snap step for other axis increments', () => {
    expect(pipeRotationSnap((20 * Math.PI) / 180, 90)).toBe(0)
    expect(pipeRotationSnap((50 * Math.PI) / 180, 90)).toBe((90 * Math.PI) / 180)
  })

  test('snaps free movement to the nearest 45 degree direction', () => {
    const diagonal = pipeDirectionalSnap45([1, 0, 0.9], 'xz')
    expect(Math.abs(diagonal[0] - diagonal[2])).toBeLessThan(0.001)
    expect(pipeDirectionalSnap45([1, 0, 0], 'xz')).toEqual([1, 0, 0])
  })
})
