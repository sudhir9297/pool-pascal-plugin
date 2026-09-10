import { expect, test } from 'bun:test'
import { Box3, Mesh, Raycaster, Vector3 } from 'three'
import { PoolNode } from './schema'
import { buildPoolGeometry } from './geometry'
import { getPoolOverlaps } from '../design/pool-overlap'
import { getPoolSpilloverNotches } from '../design/spillover-notch'
import { PoolSpilloverNode } from '../spillover/core/schema'

for (const copingStyle of ['continuous', 'natural-stone', 'rock'] as const) {
  for (const angle of [0, Math.PI / 3]) for (const width of [1, 2]) {
    test(`overlapping curved pools preserve ${copingStyle} outside the spillover mouth, rotation=${angle}, width=${width}`, () => {
      const polygon = Array.from({ length: 64 }, (_, i): [number, number] =>
        [2 * Math.cos(i * Math.PI / 32), 2 * Math.sin(i * Math.PI / 32)])
      const upper = PoolNode.parse({ id: 'pool_upper', parentId: 'level_a', polygon,
        position: [0, 1, 0], rotation: [0, angle, 0], copingStyle, designWaterElevation: -0.1 })
      const lower = PoolNode.parse({ ...upper, id: 'pool_lower', position: [3 * Math.cos(angle), 0, -3 * Math.sin(angle)] })
      const connection = PoolSpilloverNode.parse({ sourcePoolId: upper.id, targetPoolId: lower.id, width })
      const nodes = { [upper.id]: upper, [lower.id]: lower, [connection.id]: connection }
      const pool = upper
      const notches = getPoolSpilloverNotches(pool, nodes as never)
      const expected = buildPoolGeometry(pool)
      const actual = buildPoolGeometry(pool, { spilloverNotches: notches, overlaps: getPoolOverlaps(pool, nodes as never) })
      expected.updateMatrixWorld(true)
      actual.updateMatrixWorld(true)
      try {
        const coping = actual.getObjectByName('pool-coping')!
        // The lower basin must not shave the raised rim outside the mouth.
        // Sample both sides of the opening, including the stones inside the overlap.
        let sampled = 0
        for (let z = -1.5; z <= 1.5; z += 0.04) {
          if (Math.abs(z) < width / 2 + 0.005) continue
          for (let x = 1; x < 2.5; x += 0.04) {
            const ray = new Raycaster(new Vector3(x, 2, z), new Vector3(0, -1, 0), 0, 3)
            const before = ray.intersectObject(expected.getObjectByName('pool-coping')!, true)
            if (!before.length) continue
            sampled++
            const after = ray.intersectObject(coping, true)
            expect(after.length).toBeGreaterThan(0)
            expect(after[0]!.distance).toBeCloseTo(before[0]!.distance, 5)
          }
        }
        expect(sampled).toBeGreaterThan(20)
        const mouth = new Raycaster(new Vector3(2.05, 2, 0), new Vector3(0, -1, 0), 0, 3)
        expect(mouth.intersectObject(coping, true)).toHaveLength(0)
        const walls = actual.getObjectByName('pool-shell-walls')!
        const wallRay = new Raycaster(new Vector3(3, -0.05, 0), new Vector3(-1, 0, 0), 0, 1.5)
        expect(wallRay.intersectObject(walls)).toHaveLength(0)
        wallRay.ray.origin.y = -0.5
        expect(wallRay.intersectObject(walls).length).toBeGreaterThan(0)
        // No subtraction result may sprout a triangle beyond its original stone.
        coping.traverse(object => {
          if (!(object instanceof Mesh)) return
          const original = expected.getObjectByName(object.name) as Mesh
          const bounds = new Box3().setFromObject(original).expandByScalar(1e-5)
          expect(bounds.containsBox(new Box3().setFromObject(object))).toBe(true)
        })
      } finally {
        for (const group of [expected, actual]) {
          group.userData.waterEffect.dispose()
          group.traverse(object => {
            if (!(object instanceof Mesh)) return
            object.geometry.dispose()
            for (const material of Array.isArray(object.material) ? object.material : [object.material]) material.dispose()
          })
        }
      }
    })
  }
}
