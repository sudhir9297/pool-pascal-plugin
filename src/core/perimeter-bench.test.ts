import { expect, test } from 'bun:test'
import { createPerimeterBenchGeometry, perimeterBenchBoundaries } from './geometry'
import type { PoolPoint } from './schema'

test('perimeter follows the circular cutout rather than the original rectangular end', () => {
  const rectangle: PoolPoint[] = [[-4, -2], [4, -2], [4, 2], [-4, 2]]
  const circle: PoolPoint[] = Array.from({ length: 64 }, (_, i) => [4 + 2 * Math.cos(i * Math.PI / 32), 2 * Math.sin(i * Math.PI / 32)])
  const boundaries = perimeterBenchBoundaries(rectangle, [circle])
  expect(boundaries).toHaveLength(1)
  expect(boundaries[0]!.length).toBeGreaterThan(20)
  expect(boundaries[0]!.some(([x, z]) => Math.abs(x - 2) < 1e-5 && Math.abs(z) < 1e-5)).toBe(true)
  expect(boundaries[0]!.some(([x, z]) => x > 3 && Math.abs(z) < 1)).toBe(false)
  const geometry = createPerimeterBenchGeometry(boundaries[0]!, () => 2, 0.5, 0.4)
  const positions = geometry.getAttribute('position')
  for (let i = 0; i < positions.count; i++) expect(Number.isFinite(positions.getX(i))).toBe(true)
  geometry.dispose()
})

test('rectangular perimeter bench has equal width on every wall in either winding', () => {
  const rectangle: PoolPoint[] = [[-4, -2], [4, -2], [4, 2], [-4, 2]]
  for (const points of [rectangle, [...rectangle].reverse()]) {
    const geometry = createPerimeterBenchGeometry(points, () => 1.5, 0.5, 0.4)
    const positions = geometry.getAttribute('position')
    const corners = new Set<string>()
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i), z = positions.getZ(i)
      if (Math.abs(x) < 4 && Math.abs(z) < 2) {
        expect(Math.abs(x)).toBeCloseTo(3.5)
        expect(Math.abs(z)).toBeCloseTo(1.5)
        corners.add(`${x},${z}`)
      }
    }
    expect(corners.size).toBe(4)
    // Four joined seat quads, four inner faces, four outer faces, no overlays.
    expect(positions.count).toBe(72)
    geometry.dispose()
  }
})
