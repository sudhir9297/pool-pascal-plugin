import { expect, test } from 'bun:test'
import { Raycaster, Vector3, type BoxGeometry, type Mesh } from 'three'
import { buildPoolGeometry } from '../../core/geometry'
import { PoolNode, type PoolPoint } from '../../core/schema'
import { buildPoolSpilloverGeometry } from '../core/geometry'
import { PoolSpilloverNode } from '../core/schema'
import { resolvePoolSpillover } from './placement'
import { getPoolSpilloverNotches } from '../../design/spillover-notch'
import { disposePoolSpilloverVisual } from '../editor/dispose-visual'

function roundPolygon(count: number): PoolPoint[] {
  return Array.from({length: count}, (_, index) => [2 * Math.cos(index / count * Math.PI * 2), 2 * Math.sin(index / count * Math.PI * 2)])
}

test.each([32, 128, 256])('connects a curved pool across multiple short edges at resolution %s', (count) => {
  const upper = PoolNode.parse({id:'pool_upper', parentId:'level_a', polygon:roundPolygon(count), position:[0,1,0]})
  const lower = PoolNode.parse({...upper, id:'pool_lower', position:[5,0,0]})
  const placement = resolvePoolSpillover(upper, lower, 'watercourse', 1.5)
  expect(placement).not.toBeNull()
  expect(placement!.width).toBeCloseTo(1.5)
  expect(placement!.length).toBeCloseTo(1)
  expect(placement!.sourceEdge).toHaveLength(41)
  expect(placement!.sourceEdge[0]![1]).toBeLessThan(-0.1)
  const node = PoolSpilloverNode.parse(placement)
  const geometry = buildPoolSpilloverGeometry(node)
  const sheet = geometry.getObjectByName('pool-spillover-water-sheet') as Mesh
  sheet.updateMatrixWorld(true)
  const positions = sheet.geometry.getAttribute('position')
  // The first row must start on the curved upper pool, not its tangent line.
  for (let index = 0; index <= 40; index++) {
    const point = new Vector3().fromBufferAttribute(positions, index).applyMatrix4(sheet.matrixWorld)
    point.x += node.position[0]
    point.z += node.position[2]
    expect(Math.hypot(point.x,point.z)).toBeCloseTo(2, 1)
  }
  const notches = getPoolSpilloverNotches(upper, {[upper.id]:upper,[lower.id]:lower,[node.id]:node} as never)
  expect(notches).toHaveLength(1)
  expect(notches[0]!.edgeProfile!.map(([across]) => across)).toEqual(node.sourceEdge.map(([across]) => across))
  // Border endpoints must coincide with the curved containment wall, rather
  // than protrude beyond it as straight rails.
  for (const side of ['left', 'right']) {
    const border = geometry.getObjectByName(`pool-spillover-channel-outer-border-${side}`) as Mesh
    const wall = geometry.getObjectByName(`pool-spillover-channel-wall-${side}`) as Mesh
    const borderPoints = border.geometry.getAttribute('position')
    const wallPoints = wall.geometry.getAttribute('position')
    for (let i = 0; i < borderPoints.count; i++) {
      expect(borderPoints.getX(i)).toBeCloseTo(wallPoints.getX(i), 5)
      expect(borderPoints.getZ(i)).toBeCloseTo(wallPoints.getZ(i), 5)
    }
  }
  // The opening cutter stays tight to the shell; curved edge offsets deform
  // the water sheet and must not enlarge the wall notch.
  expect(notches[0]!.depth).toBeCloseTo(upper.copingWidth * 6 + 0.2)
  disposePoolSpilloverVisual(geometry)
})

test('preserves the curved profile after rotation and a reversal in pool height', () => {
  const angle = Math.PI / 3
  const upper = PoolNode.parse({id:'pool_upper', parentId:'level_a', polygon:roundPolygon(128), position:[0,1,0],rotation:[0,angle,0]})
  const lower = PoolNode.parse({...upper,id:'pool_lower',position:[5*Math.cos(angle),2,-5*Math.sin(angle)]})
  const placement = resolvePoolSpillover(upper,lower,'direct-spillover',1.2)!
  expect(placement.sourcePoolId).toBe(lower.id)
  expect(placement.width).toBeCloseTo(1.2)
  expect(placement.sourceEdge[0]![1]).toBeGreaterThan(0)
  expect(placement.targetEdge[0]![1]).toBeLessThan(0)
})

test('connects concave freeform outlines and rejects a connection beyond the distance limit', () => {
  const polygon: PoolPoint[] = [[-3,-2],[2,-2],[2.2,-1],[1.7,0],[2.2,1],[2,2],[-3,2],[-2,0]]
  const upper = PoolNode.parse({id:'pool_freeform',parentId:'level_a',polygon,position:[0,1,0]})
  const lower = PoolNode.parse({id:'pool_round',parentId:'level_a',polygon:roundPolygon(128),position:[6,0,0]})
  const placement = resolvePoolSpillover(upper,lower,'watercourse',1.5)
  expect(placement).not.toBeNull()
  expect(placement!.sourceEdge).toHaveLength(41)
  expect(placement!.sourceEdge[0]![1]).toBeGreaterThan(0.2)
  expect(resolvePoolSpillover(upper,{...lower,position:[30,0,0]},'watercourse',1.5)).toBeNull()
})

test('uses curved edge samples for overlapping round pools', () => {
  const upper = PoolNode.parse({id:'pool_overlap_upper',parentId:'level_a',polygon:roundPolygon(128),position:[0,1,0]})
  const lower = PoolNode.parse({...upper,id:'pool_overlap_lower',position:[3.5,0,0]})
  const placement = resolvePoolSpillover(upper,lower,'auto',1.2)
  expect(placement).not.toBeNull()
  expect(placement!.sourceEdge).toHaveLength(41)
  expect(placement!.width).toBeCloseTo(1.2)
  expect(placement!.connectionMode).toBe('overlap')
  expect(placement!.targetEdge).toEqual(placement!.sourceEdge)
})


test('opens the curved source rim while preserving the wall beneath it', () => {
  const upper = PoolNode.parse({id:'pool_curved_cut',parentId:'level_a',polygon:roundPolygon(64),position:[0,1,0],designWaterElevation:-0.1})
  const lower = PoolNode.parse({...upper,id:'pool_curved_receiver',position:[5,0,0]})
  const connection = PoolSpilloverNode.parse({sourcePoolId:upper.id,targetPoolId:lower.id,width:1.5,connectionStyle:'direct-spillover'})
  const notches = getPoolSpilloverNotches(upper,{[upper.id]:upper,[lower.id]:lower,[connection.id]:connection} as never)
  const geometry = buildPoolGeometry(upper,{spilloverNotches:notches})
  geometry.updateMatrixWorld(true)
  const walls = geometry.getObjectByName('pool-shell-walls')!
  for (const z of [-0.65,0,0.65]) {
    const ray = new Raycaster(new Vector3(3,-0.05,z),new Vector3(-1,0,0),0,2)
    expect(ray.intersectObject(walls)).toHaveLength(0)
    ray.ray.origin.y = -0.5
    expect(ray.intersectObject(walls).length).toBeGreaterThan(0)
  }
  const side = new Raycaster(new Vector3(3,-0.05,0.9),new Vector3(-1,0,0),0,2)
  expect(side.intersectObject(walls).length).toBeGreaterThan(0)
  geometry.userData.waterEffect.dispose()
  geometry.traverse((object) => {
    const mesh = object as Mesh
    if (!mesh.isMesh) return
    mesh.geometry.dispose()
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) material.dispose()
  })
})


test('a nested higher pool spills outward across its own rim', () => {
  const upper = PoolNode.parse({id:'pool_nested_upper',parentId:'level_a',polygon:roundPolygon(64),position:[0,1,0]})
  const lower = PoolNode.parse({id:'pool_nested_lower',parentId:'level_a',polygon:roundPolygon(64).map(([x,z])=>[x*2,z*2]),position:[0,0,0]})
  const placement = resolvePoolSpillover(upper,lower,'auto',1)!
  expect(placement).not.toBeNull()
  expect(placement.connectionMode).toBe('overlap')
  expect(placement.connectionPath[0]![0]).toBeCloseTo(2)
  expect(placement.connectionPath[1]![0]).toBeCloseTo(2)
  expect(placement.sourceSide).toBe(-1)
  const node = PoolSpilloverNode.parse(placement)
  const visual = buildPoolSpilloverGeometry(node)
  expect(visual.getObjectByName('pool-spillover-water-sheet')).toBeDefined()
  const bed = visual.getObjectByName('pool-spillover-overlap-bed') as Mesh<BoxGeometry>
  expect(bed).toBeDefined()
  expect(bed.geometry.parameters.width).toBeCloseTo(0.4)
  expect(visual.getObjectByName('pool-spillover-overlap-bed-wall-left')).toBeDefined()
  expect(visual.getObjectByName('pool-spillover-overlap-bed-wall-right')).toBeDefined()
  expect(visual.getObjectByName('pool-spillover-overlap-surface')).toBeUndefined()
  const notches = getPoolSpilloverNotches(upper, {
    [upper.id]: upper,
    [lower.id]: lower,
    [node.id]: node,
  } as never)
  const upperGeometry = buildPoolGeometry(upper, { spilloverNotches: notches })
  upperGeometry.updateMatrixWorld(true)
  const supportingWall = upperGeometry.getObjectByName('pool-shell-walls')!
  const supportRay = new Raycaster(new Vector3(3, -0.5, 0), new Vector3(-1, 0, 0), 0, 2)
  expect(supportRay.intersectObject(supportingWall).length).toBeGreaterThan(0)
  upperGeometry.userData.waterEffect.dispose()
  upperGeometry.traverse((object) => {
    const mesh = object as Mesh
    if (!mesh.isMesh) return
    mesh.geometry.dispose()
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) material.dispose()
  })
  disposePoolSpilloverVisual(visual)
})

test('connects a same-level nested basin across the containing rim', () => {
  const inner = PoolNode.parse({ id: 'pool_nested_same_inner', parentId: 'level_a', polygon: roundPolygon(64), position: [0, 0, 0] })
  const outer = PoolNode.parse({ id: 'pool_nested_same_outer', parentId: 'level_a', polygon: roundPolygon(64).map(([x, z]) => [x * 2, z * 2]), position: [0, 0, 0] })
  const placement = resolvePoolSpillover(inner, outer)
  expect(placement).not.toBeNull()
  expect(placement!.connectionMode).toBe('overlap')
  expect(placement!.intersection.length).toBeGreaterThan(0)
})
