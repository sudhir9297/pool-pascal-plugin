import { describe, expect, test } from 'bun:test'
import { TorusGeometry } from 'three'
import { createPipeRotationHitGeometry } from './handles'

describe('PVC rotation handle hit geometry', () => {
  test('tracks only the rendered rotation arc instead of surrounding the pivot', () => {
    const arc = Math.PI / 2
    const geometry = createPipeRotationHitGeometry(0.5, 0.06, arc)

    expect(geometry).toBeInstanceOf(TorusGeometry)
    expect(geometry.parameters.arc).toBe(arc)
    geometry.dispose()
  })
})
