import { expect, test } from 'bun:test'
import { Raycaster, Vector3, type Mesh } from 'three'
import { PoolNode } from './schema'
import { buildPoolGeometry } from './geometry'
import { PoolSpilloverNode } from '../spillover/core/schema'
import { getPoolSpilloverNotches } from '../design/spillover-notch'

test.each(['continuous', 'natural-stone', 'rock'] as const)('cuts %s coping and the upper wall without cutting the floor or lower wall', (copingStyle) => {
  const upper = PoolNode.parse({ id: 'pool_upper', parentId: 'level_a', polygon: [[-2,-2],[2,-2],[2,2],[-2,2]], position: [0,1,0], designWaterElevation: -0.1, copingStyle, coveRadius: 0 })
  const lower = PoolNode.parse({ ...upper, id: 'pool_lower', position: [5,0,0] })
  const spillover = PoolSpilloverNode.parse({ sourcePoolId: upper.id, targetPoolId: lower.id, width: 1, connectionStyle: 'direct-spillover' })
  const nodes = { [upper.id]: upper, [lower.id]: lower, [spillover.id]: spillover }
  const notches = getPoolSpilloverNotches(upper, nodes as never)
  expect(notches).toHaveLength(1)
  expect(notches[0]!.width).toBe(1)
  expect(getPoolSpilloverNotches(lower, nodes as never)).toHaveLength(1)
  const reversed = { ...lower, position: [5, 2, 0] as [number, number, number] }
  const reversedNodes = { ...nodes, [lower.id]: reversed }
  expect(getPoolSpilloverNotches(upper, reversedNodes as never)).toHaveLength(1)
  expect(getPoolSpilloverNotches(reversed, reversedNodes as never)).toHaveLength(1)
  const normal = buildPoolGeometry(upper)
  const cut = buildPoolGeometry(upper, { spilloverNotches: notches })
  const receivingNotches = getPoolSpilloverNotches(lower, nodes as never)
  const receivingCut = buildPoolGeometry(lower, { spilloverNotches: receivingNotches })
  cut.updateMatrixWorld(true)
  receivingCut.updateMatrixWorld(true)
  const walls = cut.getObjectByName('pool-shell-walls')!
  const ray = new Raycaster(new Vector3(3,-0.05,0), new Vector3(-1,0,0), 0, 2)
  expect(ray.intersectObject(walls).length).toBe(0)
  ray.ray.origin.y = -0.5
  expect(ray.intersectObject(walls).length).toBeGreaterThan(0)
  const receivingWalls = receivingCut.getObjectByName('pool-shell-walls')!
  const receivingRay = new Raycaster(new Vector3(-3,-0.05,0), new Vector3(1,0,0), 0, 2)
  expect(receivingRay.intersectObject(receivingWalls).length).toBe(0)
  receivingRay.ray.origin.y = -0.5
  expect(receivingRay.intersectObject(receivingWalls).length).toBeGreaterThan(0)
  ray.ray.origin.set(3,-0.05,0.6)
  expect(ray.intersectObject(walls).length).toBeGreaterThan(0)
  ray.ray.origin.set(2.1,1,0)
  ray.ray.direction.set(0,-1,0)
  expect(ray.intersectObject(cut.getObjectByName('pool-coping')!, true).length).toBe(0)
  expect(ray.intersectObject(walls).length).toBeGreaterThan(0)
  const floor = (root: typeof cut) => (root.getObjectByName('pool-shell-floor') as Mesh).geometry.getAttribute('position').array
  expect(floor(cut)).toEqual(floor(normal))
  for (const root of [normal,cut,receivingCut]) {
    root.userData.waterEffect.dispose()
    root.traverse((object) => { const mesh = object as Mesh; if (mesh.isMesh) mesh.geometry.dispose() })
  }
})

test('cuts a same-level channel opening to the full support-plane width', () => {
  const first = PoolNode.parse({
    id: 'pool_same_level_first', parentId: 'level_a',
    position: [0, 0, 0], polygon: [[-2, -1.5], [2, -1.5], [2, 1.5], [-2, 1.5]],
    coveRadius: 0,
  })
  const second = PoolNode.parse({
    id: 'pool_same_level_second', parentId: 'level_a',
    position: [5.25, 0, 0], polygon: [[-2, -1.5], [2, -1.5], [2, 1.5], [-2, 1.5]],
    coveRadius: 0,
  })
  const spillover = PoolSpilloverNode.parse({
    sourcePoolId: first.id,
    targetPoolId: second.id,
    width: 1,
    connectionStyle: 'watercourse',
  })
  const nodes = { [first.id]: first, [second.id]: second, [spillover.id]: spillover }
  const notches = getPoolSpilloverNotches(first, nodes as never)
  expect(notches[0]?.width).toBeCloseTo(1)

  const geometry = buildPoolGeometry(first, { spilloverNotches: notches })
  geometry.updateMatrixWorld(true)
  const walls = geometry.getObjectByName('pool-shell-walls')!
  for (const z of [-0.49, 0, 0.49]) {
    const ray = new Raycaster(new Vector3(2.3, -0.05, z), new Vector3(-1, 0, 0), 0, 1)
    expect(ray.intersectObject(walls)).toHaveLength(0)
  }
  const edgeRay = new Raycaster(new Vector3(2.3, -0.05, 0.6), new Vector3(-1, 0, 0), 0, 1)
  expect(edgeRay.intersectObject(walls).length).toBeGreaterThan(0)

  geometry.userData.waterEffect.dispose()
  geometry.traverse((object) => {
    const mesh = object as Mesh
    if (mesh.isMesh) mesh.geometry.dispose()
  })
})

test.each([false, true])('does not create cutout faces inside a freeform basin, clockwise=%s', (clockwise) => {
  const polygon: [number, number][] = Array.from({length:64}, (_, i) => [2*Math.cos(i*Math.PI/32),2*Math.sin(i*Math.PI/32)])
  if (clockwise) polygon.reverse()
  const pool = PoolNode.parse({polygon, coveRadius:0.15, designWaterElevation:-0.1})
  const cut = buildPoolGeometry(pool, {spilloverNotches:[{center:[2,0],rotation:0,width:1,depth:1.5,bottom:-0.125,top:2}]})
  cut.updateMatrixWorld(true)
  const walls = cut.getObjectByName('pool-shell-walls')!
  for (const direction of [-1,1]) {
    const ray = new Raycaster(new Vector3(1.5,-0.05,0),new Vector3(0,0,direction),0,0.8)
    expect(ray.intersectObject(walls)).toHaveLength(0)
  }
  const opening = new Raycaster(new Vector3(3,-0.05,0),new Vector3(-1,0,0),0,2)
  expect(opening.intersectObject(walls)).toHaveLength(0)
  opening.ray.origin.y = -0.5
  expect(opening.intersectObject(walls).length).toBeGreaterThan(0)
  const sill = new Raycaster(new Vector3(2.05,1,0),new Vector3(0,-1,0),0,2)
  expect(sill.intersectObject(walls).length).toBeGreaterThan(0)
  cut.userData.waterEffect.dispose()
  cut.traverse((object) => {const mesh = object as Mesh; if(mesh.isMesh) mesh.geometry.dispose()})
})
