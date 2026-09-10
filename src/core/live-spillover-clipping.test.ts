import { expect, test } from 'bun:test'
import { Box3, Mesh, Raycaster, Vector3, type Group } from 'three'
import { PoolNode } from './schema'
import { buildPoolGeometry } from './geometry'
import { getPoolOverlaps } from '../design/pool-overlap'
import { getPoolSpilloverNotches } from '../design/spillover-notch'
import { PoolSpilloverNode } from '../spillover/core/schema'
import fixture from './fixtures/curved-spillover-scene.json'

function contains(point: [number, number], polygon: [number, number][]) {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i]!, b = polygon[j]!
    if ((a[1] > point[1]) !== (b[1] > point[1]) &&
        point[0] < (b[0] - a[0]) * (point[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside
  }
  return inside
}

function dispose(group: Group) {
  group.userData.waterEffect.dispose()
  group.traverse(object => {
    if (!(object instanceof Mesh)) return
    object.geometry.dispose()
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) material.dispose()
  })
}

// Saved coordinates are rounded; regenerating the same shapes produces subtly
// different CSG intersections. Both previously broke the top/bevel material groups.
for (const storedPolygon of [true, false]) {
  const lower = PoolNode.parse({
    ...fixture.roman, id: 'pool_roman', parentId: 'level_test',
    polygon: storedPolygon ? fixture.roman.polygon : undefined,
  })
  const upper = PoolNode.parse({
    ...fixture.circle, id: 'pool_circle', parentId: 'level_test',
    polygon: storedPolygon ? fixture.circle.polygon : undefined,
  })
  const connection = PoolSpilloverNode.parse({ sourcePoolId: upper.id, targetPoolId: lower.id, width: 2 })
  const nodes = { [upper.id]: upper, [lower.id]: lower, [connection.id]: connection }

  for (const pool of [upper, lower]) {
    test(`circle/Roman spillover keeps rock faces intact, ${pool.shape}, stored=${storedPolygon}`, () => {
      const notches = getPoolSpilloverNotches(pool, nodes as never)
      const notch = notches[0]!
      const overlaps = getPoolOverlaps(pool, nodes as never)
      const expected = buildPoolGeometry(pool)
      let actual: Group | undefined
      try {
        actual = buildPoolGeometry(pool, {
          spilloverNotches: notches,
          overlaps,
        })
        expected.updateMatrixWorld(true)
        actual.updateMatrixWorld(true)
        const coping = actual.getObjectByName('pool-coping')!
        coping.traverse(object => {
          if (!(object instanceof Mesh)) return
          const before = expected.getObjectByName(object.name)!
          const originalBounds = new Box3().setFromObject(before).expandByScalar(0.0001)
          expect(originalBounds.containsBox(new Box3().setFromObject(object)), object.name).toBe(true)
        })

        let checked = 0
        for (let x = -4.9; x <= 4.9; x += 0.035) {
          for (let z = -3.5; z <= 3.5; z += 0.035) {
            const dx = x - notch.center[0], dz = z - notch.center[1]
            const across = dx * Math.sin(notch.rotation) + dz * Math.cos(notch.rotation)
            if (Math.abs(across) <= notch.width / 2 + 0.002) continue
            // Lower coping inside the raised basin must disappear, otherwise
            // it protrudes through the upper water. Only compare exposed rim.
            const removedByOverlap = overlaps.some(overlap => (overlap.copingFootprints ?? [overlap.footprint])
              .some(polygon => contains([x, z], polygon)))
            const ray = new Raycaster(new Vector3(x, 1, z), new Vector3(0, -1, 0), 0, 2)
            const before = ray.intersectObject(expected.getObjectByName('pool-coping')!, true)
            if (!before.length) continue
            checked++
            const after = ray.intersectObject(coping, true)
            if (removedByOverlap) {
              expect(after, `submerged rock at ${x}, ${z}`).toHaveLength(0)
              continue
            }
            expect(after.length, `rock at ${x}, ${z}`).toBeGreaterThan(0)
            expect(after[0]!.distance, `rock at ${x}, ${z}`).toBeCloseTo(before[0]!.distance, 4)
          }
        }
        expect(checked).toBeGreaterThan(100)
      } finally {
        dispose(expected)
        if (actual) dispose(actual)
      }
    })
  }
}
