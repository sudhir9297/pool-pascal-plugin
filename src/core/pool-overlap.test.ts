import { expect, test } from 'bun:test'
import { Raycaster, Vector3, Mesh, type Group } from 'three'
import { PoolNode, type PoolPoint } from './schema'
import { buildPoolGeometry } from './geometry'
import { PoolSpilloverNode } from '../spillover/core/schema'
import { getPoolOverlaps } from '../design/pool-overlap'

function dispose(group:Group) {
  group.userData.waterEffect.dispose()
  group.traverse(object => {
    const mesh=object as Mesh
    if(!mesh.isMesh) return
    mesh.geometry.dispose()
    for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material]) material.dispose()
  })
}

function closestVertexDistance(mesh: Mesh, x: number, z: number) {
  const positions = mesh.geometry.getAttribute('position')
  let closest = Number.POSITIVE_INFINITY
  for (let index = 0; index < positions.count; index += 1) {
    closest = Math.min(closest, Math.hypot(positions.getX(index) - x, positions.getZ(index) - z))
  }
  return closest
}

test.each([[false,0],[true,0],[false,Math.PI/3],[true,Math.PI/3]] as const)('preserves the higher basin and trims the lower overlap, curved=%s, rotation=%s', (curved,angle) => {
  const polygon:PoolPoint[]=curved?Array.from({length:64},(_,i)=>[2*Math.cos(i*Math.PI/32),2*Math.sin(i*Math.PI/32)]):[[-2,-2],[2,-2],[2,2],[-2,2]]
  const upper=PoolNode.parse({id:'pool_upper',parentId:'level_a',polygon,position:[0,1,0],rotation:[0,angle,0],depth:1,coveRadius:0})
  const lower=PoolNode.parse({id:'pool_lower',parentId:'level_a',polygon,position:[3*Math.cos(angle),0,-3*Math.sin(angle)],rotation:[0,angle,0],depth:2,coveRadius:0})
  const connection=PoolSpilloverNode.parse({sourcePoolId:upper.id,targetPoolId:lower.id,width:1})
  const nodes={[upper.id]:upper,[lower.id]:lower,[connection.id]:connection}
  expect(getPoolOverlaps(upper,nodes as never)[0]?.trimBasin).toBe(false)
  const overlaps=getPoolOverlaps(lower,nodes as never)
  expect(overlaps).toHaveLength(1)
  const group=buildPoolGeometry(lower,{overlaps})
  group.updateMatrixWorld(true)
  const ray=new Raycaster(new Vector3(-1.5,3,0),new Vector3(0,-1,0),0,8)
  // Water deliberately disables pointer picking; inspect its triangles directly.
  const water=group.getObjectByName('pool-water') as Mesh
  water.raycast=Mesh.prototype.raycast
  expect(ray.intersectObject(water)).toHaveLength(0)
  expect(ray.intersectObject(group.getObjectByName('pool-shell-floor')!)).toHaveLength(0)
  const floorEdgeRay = new Raycaster(new Vector3(-2.5, -2 - lower.floorThickness / 2, 0), new Vector3(1, 0, 0), 0, 0.8)
  expect(floorEdgeRay.intersectObject(group.getObjectByName('pool-shell-floor')!)).toHaveLength(0)
  floorEdgeRay.ray.origin.x = 2.5
  floorEdgeRay.ray.direction.x = -1
  expect(floorEdgeRay.intersectObject(group.getObjectByName('pool-shell-floor')!).length).toBeGreaterThan(0)
  ray.ray.origin.x=-2
  expect(ray.intersectObject(group.getObjectByName('pool-coping')!,true)).toHaveLength(0)
  ray.ray.origin.x=0
  expect(ray.intersectObject(water).length).toBeGreaterThan(0)
  expect(ray.intersectObject(group.getObjectByName('pool-shell-floor')!).length).toBeGreaterThan(0)
  const separator=group.getObjectByName('pool-overlap-separating-wall')!
  expect(separator).toBeDefined()
  ray.ray.origin.set(0,-1,0)
  ray.ray.direction.set(-1,0,0)
  const hits=ray.intersectObject(separator)
  expect(hits.length).toBeGreaterThan(0)
  expect(hits[0]!.point.x).toBeCloseTo(-0.8,1)
  const reversed={...lower,position:[3*Math.cos(angle),2,-3*Math.sin(angle)] as [number,number,number]}
  const changed={...nodes,[lower.id]:reversed}
  expect(getPoolOverlaps(reversed,changed as never)[0]?.trimBasin).toBe(false)
  expect(getPoolOverlaps(upper,changed as never)).toHaveLength(1)
  const moved={...lower,position:[8*Math.cos(angle),0,-8*Math.sin(angle)] as [number,number,number]}
  expect(getPoolOverlaps(moved,{...nodes,[lower.id]:moved} as never)).toEqual([])
  dispose(group)
})

test('merges a partial same-level overlap across its exact footprint', () => {
  const first = PoolNode.parse({ id: 'pool_same_a', parentId: 'level_a', polygon: [[-2,-2],[2,-2],[2,2],[-2,2]] })
  const second = PoolNode.parse({ id: 'pool_same_b', parentId: 'level_a', polygon: [[-2,-2],[2,-2],[2,2],[-2,2]], position: [2,0,0] })
  const connection = PoolSpilloverNode.parse({ sourcePoolId: first.id, targetPoolId: second.id, width: 1 })
  const nodes = { [first.id]: first, [second.id]: second, [connection.id]: connection }
  const firstOverlap = getPoolOverlaps(first, nodes as never)[0]!
  const secondOverlap = getPoolOverlaps(second, nodes as never)[0]!
  expect(firstOverlap.trimBasin).toBe(true)
  expect(secondOverlap.trimBasin).toBe(true)
  expect(firstOverlap.suppressSeparator).toBe(true)
  expect(firstOverlap.preserveWater).toBe(true)
  expect(firstOverlap.regions).toEqual([])
  expect(secondOverlap.preserveWater).toBe(false)
  expect(secondOverlap.regions.length).toBeGreaterThan(0)
  const group = buildPoolGeometry(first, { overlaps: [firstOverlap] })
  expect(group.getObjectByName('pool-overlap-separating-wall')).toBeUndefined()
  group.updateMatrixWorld(true)
  const water = group.getObjectByName('pool-water') as Mesh
  water.raycast = Mesh.prototype.raycast
  const ray = new Raycaster(new Vector3(1, 3, 0), new Vector3(0, -1, 0), 0, 8)
  expect(ray.intersectObject(water).length).toBeGreaterThan(0)
  dispose(group)
})

test('renders one continuous floor and water surface across a same-level rectangular overlap', () => {
  const first = PoolNode.parse({
    id: 'pool_overlap_owner_a',
    parentId: 'level_a',
    polygon: [[-2,-2],[2,-2],[2,2],[-2,2]],
    depth: 1.5,
    coveRadius: 0,
  })
  const second = PoolNode.parse({
    id: 'pool_overlap_owner_b',
    parentId: 'level_a',
    polygon: [[-2,-2],[2,-2],[2,2],[-2,2]],
    position: [2,0,0],
    depth: 1.5,
    coveRadius: 0,
  })
  const connection = PoolSpilloverNode.parse({
    id: 'pool-spillover_overlap_owner',
    sourcePoolId: first.id,
    targetPoolId: second.id,
    width: 1,
  })
  const nodes = { [second.id]: second, [connection.id]: connection, [first.id]: first }
  const firstGroup = buildPoolGeometry(first, { overlaps: getPoolOverlaps(first, nodes as never) })
  const secondGroup = buildPoolGeometry(second, { overlaps: getPoolOverlaps(second, nodes as never) })
  firstGroup.updateMatrixWorld(true)
  secondGroup.updateMatrixWorld(true)

  // World x=1 lies in the shared rectangle. It is local x=1 in the first
  // pool and local x=-1 in the translated second pool. Exactly one assembly
  // must own each coplanar surface: zero floors creates the black hole, while
  // two water faces create the bright seam and z-fighting seen in the editor.
  const floorHits = [
    new Raycaster(new Vector3(1, 3, 0), new Vector3(0, -1, 0), 0, 8)
      .intersectObject(firstGroup.getObjectByName('pool-shell-floor')!).length,
    new Raycaster(new Vector3(-1, 3, 0), new Vector3(0, -1, 0), 0, 8)
      .intersectObject(secondGroup.getObjectByName('pool-shell-floor')!).length,
  ]
  const firstWater = firstGroup.getObjectByName('pool-water') as Mesh
  const secondWater = secondGroup.getObjectByName('pool-water') as Mesh
  firstWater.raycast = Mesh.prototype.raycast
  secondWater.raycast = Mesh.prototype.raycast
  const waterHits = [
    new Raycaster(new Vector3(1, 3, 0), new Vector3(0, -1, 0), 0, 8).intersectObject(firstWater).length,
    new Raycaster(new Vector3(-1, 3, 0), new Vector3(0, -1, 0), 0, 8).intersectObject(secondWater).length,
  ]
  expect(floorHits.filter(Boolean)).toHaveLength(1)
  expect(waterHits.filter(Boolean)).toHaveLength(1)

  // The former facing rims at world x=2 and x=0 are internal to the merged
  // basin. Neither pool may leave a wall or coping strip at those seams.
  const firstWallRay = new Raycaster(new Vector3(1, -0.5, 0), new Vector3(1, 0, 0), 0, 2)
  const secondWallRay = new Raycaster(new Vector3(-1, -0.5, 0), new Vector3(-1, 0, 0), 0, 2)
  expect(firstWallRay.intersectObject(firstGroup.getObjectByName('pool-shell-walls')!).length).toBe(0)
  expect(secondWallRay.intersectObject(secondGroup.getObjectByName('pool-shell-walls')!).length).toBe(0)
  const firstCopingRay = new Raycaster(new Vector3(2, 3, 0), new Vector3(0, -1, 0), 0, 8)
  const secondCopingRay = new Raycaster(new Vector3(-2, 3, 0), new Vector3(0, -1, 0), 0, 8)
  expect(firstCopingRay.intersectObject(firstGroup.getObjectByName('pool-coping')!, true).length).toBe(0)
  expect(secondCopingRay.intersectObject(secondGroup.getObjectByName('pool-coping')!, true).length).toBe(0)

  // Along the exterior z=2 edge, the two original perimeters overlap between
  // world x=0 and x=2. One assembly must retain that outside wall and coping;
  // deleting both is the open side gap shown at the ends of the connection.
  const exteriorWallHits = [
    new Raycaster(new Vector3(1, -0.5, 1), new Vector3(0, 0, 1), 0, 2)
      .intersectObject(firstGroup.getObjectByName('pool-shell-walls')!).length,
    new Raycaster(new Vector3(-1, -0.5, 1), new Vector3(0, 0, 1), 0, 2)
      .intersectObject(secondGroup.getObjectByName('pool-shell-walls')!).length,
  ]
  const exteriorCopingHits = [
    new Raycaster(new Vector3(1, 3, 2.15), new Vector3(0, -1, 0), 0, 8)
      .intersectObject(firstGroup.getObjectByName('pool-coping')!, true).length,
    new Raycaster(new Vector3(-1, 3, 2.15), new Vector3(0, -1, 0), 0, 8)
      .intersectObject(secondGroup.getObjectByName('pool-coping')!, true).length,
  ]
  expect(exteriorWallHits.filter(Boolean)).toHaveLength(1)
  expect(exteriorCopingHits.filter(Boolean)).toHaveLength(1)

  dispose(firstGroup)
  dispose(secondGroup)
})

test('removes the full coping strip where same-level boundaries cross', () => {
  const first = PoolNode.parse({
    id: 'pool_crossing_coping_owner',
    parentId: 'level_a',
    polygon: [[-2,-2],[2,-2],[2,2],[-2,2]],
    coveRadius: 0,
  })
  const second = PoolNode.parse({
    id: 'pool_crossing_coping_clipped',
    parentId: 'level_a',
    polygon: [[-2,-2],[2,-2],[2,2],[-2,2]],
    position: [1,0,0],
    rotation: [0, Math.PI / 4, 0],
    coveRadius: 0,
  })
  const connection = PoolSpilloverNode.parse({
    id: 'pool-spillover_crossing_coping',
    sourcePoolId: first.id,
    targetPoolId: second.id,
  })
  const nodes = { [first.id]: first, [second.id]: second, [connection.id]: connection }
  const overlaps = getPoolOverlaps(first, nodes as never)
  expect(overlaps[0]?.copingMiterKeeps?.length).toBeGreaterThan(0)
  const group = buildPoolGeometry(first, { overlaps })
  group.updateMatrixWorld(true)
  const coping = group.getObjectByName('pool-coping')!
  const walls = group.getObjectByName('pool-shell-walls') as Mesh
  expect(group.getObjectByName('pool-coping-junctions')).toBeUndefined()
  for (const triangle of overlaps[0]!.copingMiterKeeps!) {
    const center = triangle.reduce((sum, point) => [sum[0] + point[0] / 3, sum[1] + point[1] / 3] as PoolPoint, [0, 0] as PoolPoint)
    expect(new Raycaster(new Vector3(center[0], 3, center[1]), new Vector3(0, -1, 0), 0, 8)
      .intersectObject(coping, true).length).toBeGreaterThan(0)
  }

  // Near the crossing point, this lies on the outward half of the owner's
  // coping strip. It is outside the other basin but belongs to an internal
  // boundary run, so the wider coping footprint must still remove it.
  expect(new Raycaster(new Vector3(1.75, 3, 2.15), new Vector3(0, -1, 0), 0, 8)
    .intersectObject(coping, true)).toHaveLength(0)
  expect(new Raycaster(new Vector3(1.75, 3, 2.1), new Vector3(0, -1, 0), 0, 8)
    .intersectObject(walls, true)).toHaveLength(0)
  expect(new Raycaster(new Vector3(-1, 3, 2.15), new Vector3(0, -1, 0), 0, 8)
    .intersectObject(coping, true).length).toBeGreaterThan(0)

  // The tiled wall must terminate at the exact basin intersection. Cutting
  // it with the wider coping footprint shifts this endpoint and creates the
  // vertical black slit between the two pool walls.
  expect(closestVertexDistance(walls, 2 * Math.SQRT2 - 1, 2)).toBeLessThan(1e-5)

  dispose(group)
})

test('clips concave same-level intersections into exact fill regions', () => {
  const concave: PoolPoint[] = [[-3,-2],[2,-2],[2,-1],[0.8,0],[2,1],[2,2],[-3,2]]
  const first = PoolNode.parse({ id: 'pool_concave_same_a', parentId: 'level_a', shape: 'custom', polygon: concave })
  const second = PoolNode.parse({ id: 'pool_concave_same_b', parentId: 'level_a', shape: 'custom', polygon: concave, position: [1.2,0,0] })
  const connection = PoolSpilloverNode.parse({ sourcePoolId: first.id, targetPoolId: second.id, width: 1 })
  const nodes = { [first.id]: first, [second.id]: second, [connection.id]: connection }
  const overlap = getPoolOverlaps(second, nodes as never)[0]!
  expect(overlap.trimBasin).toBe(true)
  expect(overlap.regions.length).toBeGreaterThan(1)
  const group = buildPoolGeometry(first, { overlaps: [overlap] })
  expect(group.getObjectByName('pool-overlap-separating-wall')).toBeUndefined()
  dispose(group)
})

for (const copingStyle of ['continuous', 'natural-stone', 'rock'] as const) {
  test(`miters existing ${copingStyle} borders at rectangular crossings`, () => {
    const first = PoolNode.parse({ id: 'pool_miter_a', parentId: 'level_a',
      polygon: [[-2,-2],[2,-2],[2,2],[-2,2]], copingStyle,
      copingJointWidth: 0.005, copingIrregularity: 0, coveRadius: 0 })
    const second = PoolNode.parse({ ...first, id: 'pool_miter_b', position: [2,0,2] })
    const connection = PoolSpilloverNode.parse({ id: 'pool-spillover_miter', sourcePoolId: first.id, targetPoolId: second.id })
    const nodes = { [first.id]: first, [second.id]: second, [connection.id]: connection }
    for (const pool of [first, second]) {
      const overlaps = getPoolOverlaps(pool, nodes as never)
      const group = buildPoolGeometry(pool, { overlaps })
      group.updateMatrixWorld(true)
      expect(group.getObjectByName('pool-coping-junctions')).toBeUndefined()
      const coping = group.getObjectByName('pool-coping')!
      for (const triangle of overlaps[0]!.copingMiterKeeps!) {
        // Sample inside the retained half, away from the miter seam. Natural
        // stone joints may miss an individual ray, but cannot remove the half.
        let hits = 0
        for (const t of [0.25, 0.4, 0.55, 0.7]) {
          const p = triangle[0]!, r = triangle[1]!, q = triangle[2]!
          const x = p[0] * (1-t) + (r[0]*0.65 + q[0]*0.35)*t
          const z = p[1] * (1-t) + (r[1]*0.65 + q[1]*0.35)*t
          hits += new Raycaster(new Vector3(x,3,z), new Vector3(0,-1,0),0,8).intersectObject(coping,true).length
        }
        expect(hits).toBeGreaterThan(0)
      }
      dispose(group)
    }
  })
}

test('closes both exposed rounded wall ends down to the pool floor', () => {
  const pool = PoolNode.parse({ id: 'pool_cove_caps', polygon: [[-2,-2],[2,-2],[2,2],[-2,2]],
    depth: 2, coveRadius: 0.3 })
  const group = buildPoolGeometry(pool, { removeWallRegions: [[[-0.5,-3],[0.5,-3],[0.5,3],[-0.5,3]]] })
  group.updateMatrixWorld(true)
  const walls = group.getObjectByName('pool-shell-walls')!
  for (const direction of [-1, 1]) {
    for (const z of [-1.9, 1.9]) {
      const hits = new Raycaster(new Vector3(0,-1.9,z), new Vector3(direction,0,0),0,0.6).intersectObject(walls)
      expect(hits.length).toBeGreaterThan(0)
      expect(hits[0]!.distance).toBeGreaterThan(0.4)
      expect(hits[0]!.distance).toBeLessThanOrEqual(0.5)
    }
  }
  dispose(group)
})
