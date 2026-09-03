import { describe, expect, test } from 'bun:test'
import { LOW_POLY_ROCK_PROFILES, createLowPolyRockGeometry } from './low-poly-rock'

describe('low-poly rock geometry', () => {
  test('builds every profile as closed faceted geometry with face colors', () => {
    const vertexCounts = new Set<number>()
    for (const [index, profile] of LOW_POLY_ROCK_PROFILES.entries()) {
      const geometry = createLowPolyRockGeometry(1.2, 0.8, 0.9, 100 + index, profile, '#817c72')
      const position = geometry.getAttribute('position')
      const normal = geometry.getAttribute('normal')
      const color = geometry.getAttribute('color')
      expect(position.count).toBeGreaterThan(80)
      expect(normal.count).toBe(position.count)
      expect(color.count).toBe(position.count)
      expect(geometry.boundingBox).not.toBeNull()
      expect(geometry.userData.rockProfile).toBe(profile)
      vertexCounts.add(position.count)
      geometry.dispose()
    }
    expect(vertexCounts.size).toBeGreaterThanOrEqual(3)
  })

  test('is deterministic for a seed and changes shape for another seed', () => {
    const first = createLowPolyRockGeometry(1, 1, 1, 7311, 'boulder')
    const repeated = createLowPolyRockGeometry(1, 1, 1, 7311, 'boulder')
    const changed = createLowPolyRockGeometry(1, 1, 1, 7312, 'boulder')
    const firstPositions = Array.from(first.getAttribute('position').array)
    expect(Array.from(repeated.getAttribute('position').array)).toEqual(firstPositions)
    expect(Array.from(changed.getAttribute('position').array)).not.toEqual(firstPositions)
    first.dispose()
    repeated.dispose()
    changed.dispose()
  })

  test('colors individual faces instead of tinting the whole rock uniformly', () => {
    const geometry = createLowPolyRockGeometry(1, 1, 1, 42, 'wedge', '#817c72')
    const colors = geometry.getAttribute('color')
    const uniqueRedValues = new Set<number>()
    for (let index = 0; index < colors.count; index += 3) {
      uniqueRedValues.add(Number(colors.getX(index).toFixed(4)))
    }
    expect(uniqueRedValues.size).toBeGreaterThan(4)
    geometry.dispose()
  })
})
