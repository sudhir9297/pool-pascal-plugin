import { describe, expect, test } from 'bun:test'
import { disposeObject3D } from '../editor/dispose-object'
import { buildSubmergedFeatureCopingGeometry } from './feature-coping'

const options = {
  width: 0.4,
  thickness: 0.12,
  stoneLength: 1,
  irregularity: 0.35,
  seed: 7311,
  color: '#64748b',
  topDepth: 0.45,
}

describe('submerged feature coping', () => {
  test('returns an empty group for a zero-length run', () => {
    const geometry = buildSubmergedFeatureCopingGeometry([1, 1], [1, 1], options)
    expect(geometry.name).toBe('pool-submerged-feature-coping')
    expect(geometry.children).toHaveLength(0)
  })

  test('fills the run with deterministic named stones below the waterline', () => {
    const first = buildSubmergedFeatureCopingGeometry([0, 0], [3, 0], options)
    const second = buildSubmergedFeatureCopingGeometry([0, 0], [3, 0], options)

    expect(first.children).toHaveLength(3)
    expect(first.children.map((stone) => stone.name)).toEqual([
      'pool-submerged-feature-rock-1',
      'pool-submerged-feature-rock-2',
      'pool-submerged-feature-rock-3',
    ])
    expect(first.children.every((stone) => stone.position.y < -options.topDepth)).toBe(true)
    expect(first.children[0]!.position.toArray()).toEqual(second.children[0]!.position.toArray())
    disposeObject3D(first)
    disposeObject3D(second)
  })
})
