import { expect, test } from 'bun:test'
import { Mesh, Raycaster, Vector3, type Group } from 'three'
import { buildPoolGeometry } from '../core/geometry'
import { PoolNode, type PoolPoint } from '../core/schema'
import { buildPoolSpilloverGeometry } from '../spillover/core/geometry'
import { PoolSpilloverNode } from '../spillover/core/schema'
import { resolvePoolSpillover } from '../spillover/design/placement'
import { getPoolOverlaps } from './pool-overlap'
import { getPoolIntersectionRegions } from './shared-joint'

function area(polygon: PoolPoint[]) {
  return Math.abs(polygon.reduce((sum, point, index) => {
    const next = polygon[(index + 1) % polygon.length]!
    return sum + point[0] * next[1] - next[0] * point[1]
  }, 0) / 2)
}

function contains(point: PoolPoint, polygon: PoolPoint[]) {
  let inside = false
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
    const current = polygon[index]!
    const prior = polygon[previous]!
    if ((current[1] > point[1]) !== (prior[1] > point[1])
      && point[0] < (prior[0] - current[0]) * (point[1] - current[1])
        / (prior[1] - current[1]) + current[0]) inside = !inside
  }
  return inside
}

function dispose(group: Group) {
  group.userData.waterEffect?.dispose?.()
  group.traverse((object) => {
    const mesh = object as Mesh
    if (!mesh.isMesh) return
    mesh.geometry.dispose()
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) material.dispose()
  })
}

function downwardHits(group: Group, name: string, x: number, z: number) {
  const mesh = group.getObjectByName(name) as Mesh
  if (name === 'pool-water') mesh.raycast = Mesh.prototype.raycast
  return new Raycaster(new Vector3(x, 3, z), new Vector3(0, -1, 0), 0, 8)
    .intersectObject(mesh).length
}

function degenerateTriangleCount(group: Group, name: string) {
  const positions = (group.getObjectByName(name) as Mesh).geometry.getAttribute('position')
  let count = 0
  for (let index = 0; index < positions.count; index += 3) {
    const first = new Vector3().fromBufferAttribute(positions, index)
    const second = new Vector3().fromBufferAttribute(positions, index + 1)
    const third = new Vector3().fromBufferAttribute(positions, index + 2)
    const doubledArea = second.sub(first).cross(third.sub(first)).length()
    if (doubledArea <= 1e-10) count += 1
  }
  return count
}

test('does not bridge a freeform concavity while cutting a same-level overlap', () => {
  const first = PoolNode.parse({
    id: 'pool_freeform_overlap_a',
    parentId: 'level_a',
    shape: 'custom',
    polygon: [[-4, -3], [4, -3], [4, 3], [-4, 3]],
  })
  // A C-shaped pool whose open mouth intersects the first pool's right wall.
  // The point [3, 0] lies in that mouth, so clipping it would create the large
  // triangular void seen when a convex hull is used for a concave overlap.
  const second = PoolNode.parse({
    id: 'pool_freeform_overlap_b',
    parentId: 'level_a',
    shape: 'custom',
    polygon: [[-2, -2], [2, -2], [2, -1], [-1, -1], [-1, 1], [2, 1], [2, 2], [-2, 2]],
    position: [3, 0, 0],
  })
  const connection = PoolSpilloverNode.parse({
    sourcePoolId: first.id,
    targetPoolId: second.id,
  })
  const nodes = { [first.id]: first, [second.id]: second, [connection.id]: connection }

  const regions = getPoolIntersectionRegions(first, second)
  expect(regions.reduce((sum, region) => sum + area(region), 0)).toBeCloseTo(8, 6)
  for (const region of regions) {
    expect(region.length).toBeGreaterThanOrEqual(3)
    for (let index = 0; index < region.length; index += 1) {
      const previous = region[(index - 1 + region.length) % region.length]!
      const point = region[index]!
      const next = region[(index + 1) % region.length]!
      expect(Math.hypot(point[0] - previous[0], point[1] - previous[1])).toBeGreaterThan(1e-6)
      expect(Math.abs(
        (point[0] - previous[0]) * (next[1] - point[1])
        - (point[1] - previous[1]) * (next[0] - point[0]),
      )).toBeGreaterThan(1e-6)
    }
  }

  const overlap = getPoolOverlaps(first, nodes as never)[0]!
  expect(overlap.wallRegions).toBeDefined()
  expect(overlap.wallRegions!.some((region) => contains([3, 0], region))).toBe(false)
  expect(overlap.copingFootprints!.some((region) => contains([3, 0], region))).toBe(false)

  const placement = resolvePoolSpillover(first, second)
  expect(placement?.mergedSurface).toBe(true)
  const connector = buildPoolSpilloverGeometry(PoolSpilloverNode.parse(placement))
  expect(connector.children).toHaveLength(0)
  dispose(connector)
})

test('keeps one freeform overlap floor without cutting across its open concavity', () => {
  const first = PoolNode.parse({
    id: 'pool_freeform_surface_owner',
    parentId: 'level_a',
    shape: 'custom',
    polygon: [[-4, -3], [4, -3], [4, 3], [-4, 3]],
    coveRadius: 0,
  })
  const second = PoolNode.parse({
    id: 'pool_freeform_surface_clipped',
    parentId: 'level_a',
    shape: 'custom',
    polygon: [[-2, -2], [2, -2], [2, -1], [-1, -1], [-1, 1], [2, 1], [2, 2], [-2, 2]],
    position: [3, 0, 0],
    coveRadius: 0,
  })
  const connection = PoolSpilloverNode.parse({
    sourcePoolId: first.id,
    targetPoolId: second.id,
  })
  const nodes = { [first.id]: first, [second.id]: second, [connection.id]: connection }
  const firstGroup = buildPoolGeometry(first, { overlaps: getPoolOverlaps(first, nodes as never) })
  const secondGroup = buildPoolGeometry(second, { overlaps: getPoolOverlaps(second, nodes as never) })
  firstGroup.updateMatrixWorld(true)
  secondGroup.updateMatrixWorld(true)

  // World [3, -1.5] is shared by the bottom bar of the C. One pool owns the
  // floor and water there, avoiding both a black hole and coplanar surfaces.
  const sharedFloorHits = [
    downwardHits(firstGroup, 'pool-shell-floor', 3, -1.5),
    downwardHits(secondGroup, 'pool-shell-floor', 0, -1.5),
  ]
  const sharedWaterHits = [
    downwardHits(firstGroup, 'pool-water', 3, -1.5),
    downwardHits(secondGroup, 'pool-water', 0, -1.5),
  ]
  expect(sharedFloorHits.filter(Boolean)).toHaveLength(1)
  expect(sharedWaterHits.filter(Boolean)).toHaveLength(1)

  // World [3, 0] sits in the open mouth, outside the second pool. The first
  // pool's floor, water, wall, and coping must remain intact at that point.
  expect(downwardHits(firstGroup, 'pool-shell-floor', 3, 0)).toBeGreaterThan(0)
  expect(downwardHits(firstGroup, 'pool-water', 3, 0)).toBeGreaterThan(0)
  expect(new Raycaster(new Vector3(3, -0.5, 0), new Vector3(1, 0, 0), 0, 2)
    .intersectObject(firstGroup.getObjectByName('pool-shell-walls')!).length).toBeGreaterThan(0)
  expect(downwardHits(firstGroup, 'pool-coping', 4, 0)).toBeGreaterThan(0)

  expect(degenerateTriangleCount(firstGroup, 'pool-shell-floor')).toBe(0)
  expect(degenerateTriangleCount(secondGroup, 'pool-shell-floor')).toBe(0)
  expect(degenerateTriangleCount(firstGroup, 'pool-water')).toBe(0)
  expect(degenerateTriangleCount(secondGroup, 'pool-water')).toBe(0)

  dispose(firstGroup)
  dispose(secondGroup)
})
