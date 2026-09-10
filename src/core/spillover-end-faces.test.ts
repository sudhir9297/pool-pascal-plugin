import { expect, test } from 'bun:test'
import { Mesh, Raycaster, Vector3, type Group } from 'three'
import { PoolNode } from './schema'
import { buildPoolGeometry } from './geometry'
import { getPoolSpilloverNotches } from '../design/spillover-notch'
import { getPoolOverlaps } from '../design/pool-overlap'
import { PoolSpilloverNode } from '../spillover/core/schema'
import fixture from './fixtures/curved-spillover-scene.json'

function dispose(group: Group) {
  group.userData.waterEffect.dispose()
  group.traverse(object => {
    if (!(object instanceof Mesh)) return
    object.geometry.dispose()
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) material.dispose()
  })
}

for (const storedPolygon of [true, false]) {
  test(`spillover rock ends have solid faces, stored=${storedPolygon}`, () => {
    const upper = PoolNode.parse({
      ...fixture.circle, id: 'pool_circle', parentId: 'level_test',
      polygon: storedPolygon ? fixture.circle.polygon : undefined,
    })
    const lower = PoolNode.parse({
      ...fixture.roman, id: 'pool_roman', parentId: 'level_test',
      polygon: storedPolygon ? fixture.roman.polygon : undefined,
    })
    const connection = PoolSpilloverNode.parse({ sourcePoolId: upper.id, targetPoolId: lower.id, width: 2 })
    const nodes = { [upper.id]: upper, [lower.id]: lower, [connection.id]: connection }
    const notches = getPoolSpilloverNotches(upper, nodes as never)
    const notch = notches[0]!
    const before = buildPoolGeometry(upper)
    const after = buildPoolGeometry(upper, {
      spilloverNotches: notches, overlaps: getPoolOverlaps(upper, nodes as never),
    })
    try {
      before.updateMatrixWorld(true)
      after.updateMatrixWorld(true)
      let checked = 0
      // Downward rays alone miss this regression: the rock tops remain while
      // every cut end is open. Probe horizontally from the water opening at
      // several heights through the original stone's solid cross section.
      for (const side of [-1, 1]) {
        for (let along = -0.65; along <= 0.65; along += 0.01) {
          const across = side * (notch.width / 2 + 0.0001)
          const x = notch.center[0] + along * Math.cos(notch.rotation) + across * Math.sin(notch.rotation)
          const z = notch.center[1] - along * Math.sin(notch.rotation) + across * Math.cos(notch.rotation)
          const top = new Raycaster(new Vector3(x, 1, z), new Vector3(0, -1, 0))
            .intersectObject(before.getObjectByName('pool-coping')!, true)[0]
          if (!top) continue
          for (let y = 0.02; y < Math.min(0.06, top.point.y - 0.01); y += 0.01) {
            const direction = new Vector3(side * Math.sin(notch.rotation), 0, side * Math.cos(notch.rotation))
            const origin = new Vector3(x, y, z).addScaledVector(direction, -0.02)
            const hit = new Raycaster(origin, direction, 0, 0.04)
              .intersectObject(after.getObjectByName('pool-coping')!, true)[0]
            expect(hit, `end face at ${x}, ${y}, ${z}`).toBeDefined()
            expect(hit!.distance).toBeCloseTo(0.0199, 4)
            checked++
          }
        }
      }
      expect(checked).toBeGreaterThan(100)
    } finally {
      dispose(before)
      dispose(after)
    }
  })
}
