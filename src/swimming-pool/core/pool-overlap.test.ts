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
