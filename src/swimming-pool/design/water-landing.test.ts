import { expect, test } from 'bun:test'
import { Raycaster, Vector3, type Mesh, type Group } from 'three'
import { PoolNode } from '../core/schema'
import { buildPoolGeometry } from '../core/geometry'
import { PoolSpilloverNode } from '../spillover/core/schema'
import { resolvePoolSpillover } from '../spillover/design/placement'
import { buildPoolSpilloverGeometry } from '../spillover/core/geometry'
import { disposePoolSpilloverVisual } from '../spillover/editor/dispose-visual'
import { PoolWaterfallNode } from '../water-feature/waterfall/core/schema'
import { resolveMountedWaterfall } from '../water-feature/waterfall/design/placement'
import { getWaterfallImpactLocalPoint } from '../water-feature/waterfall/core/geometry'

function disposePool(group: Group) {
  group.userData.waterEffect.dispose()
  group.traverse((object) => {
    const mesh = object as Mesh
    if (!mesh.isMesh) return
    mesh.geometry.dispose()
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) material.dispose()
  })
}

test.each([[3.5,false],[5,false],[3.5,true],[5,true]] as const)('spillover clears receiving rocks for separation %s, curved=%s', (separation, curved) => {
  const polygon = curved ? Array.from({length:64},(_,index) => [2*Math.cos(index*Math.PI/32),2*Math.sin(index*Math.PI/32)]) : [[-2,-2],[2,-2],[2,2],[-2,2]]
  const upper = PoolNode.parse({id:'pool_upper',parentId:'level_a',polygon,position:[0,1,0]})
  const lower = PoolNode.parse({id:'pool_lower',parentId:'level_a',polygon,position:[separation,0,0],shape:curved ? 'spline' : 'custom',copingStyle:'rock',copingWidth:0.5,copingStoneLength:1.8})
  const placement = resolvePoolSpillover(upper,lower,'watercourse',1.5)!
  const connection = PoolSpilloverNode.parse(placement)
  const visual = buildPoolSpilloverGeometry(connection)
  visual.position.fromArray(connection.position)
  visual.rotation.fromArray([...connection.rotation,'XYZ'])
  visual.updateMatrixWorld(true)
  const receiver = buildPoolGeometry(lower)
  receiver.position.x = separation
  receiver.updateMatrixWorld(true)
  const coping = receiver.getObjectByName('pool-coping')!
  const sheet = visual.getObjectByName('pool-spillover-water-sheet') as Mesh
  const positions = sheet.geometry.getAttribute('position')
  for (let index=positions.count-41; index<positions.count; index++) {
    const point = new Vector3().fromBufferAttribute(positions,index).applyMatrix4(sheet.matrixWorld)
    expect(point.x).toBeGreaterThan(separation-2+0.5)
    expect(point.x).toBeLessThan(separation+2)
    const ray = new Raycaster(new Vector3(point.x,3,point.z),new Vector3(0,-1,0),0,4)
    expect(ray.intersectObject(coping,true)).toHaveLength(0)
  }
  disposePool(receiver)
  disposePoolSpilloverVisual(visual)
})

test.each(['modern','rock-cascade','spillover'] as const)('%s waterfall lands beyond wide pool rocks', (waterfallType) => {
  const pool = PoolNode.parse({id:'pool_rocks',copingStyle:'rock',copingWidth:0.7,copingStoneLength:2,polygon:[[-3,-3],[3,-3],[3,3],[-3,3]]})
  const node = resolveMountedWaterfall(PoolWaterfallNode.parse({poolId:pool.id,wallIndex:0,wallT:0.5,waterfallType,depth:0.4,autoSizeOnPool:false,width:1.2}),pool)
  const receiver = buildPoolGeometry(pool)
  receiver.updateMatrixWorld(true)
  for (const across of [-1,0,1]) {
    const [x,z] = getWaterfallImpactLocalPoint(node,across)
    const angle = node.rotation[1]
    const worldX = node.position[0]+x*Math.cos(angle)+z*Math.sin(angle)
    const worldZ = node.position[2]-x*Math.sin(angle)+z*Math.cos(angle)
    expect(worldZ).toBeGreaterThan(-2)
    expect(worldZ).toBeLessThan(3)
    const ray = new Raycaster(new Vector3(worldX,5,worldZ),new Vector3(0,-1,0),0,6)
    expect(ray.intersectObject(receiver.getObjectByName('pool-coping')!,true)).toHaveLength(0)
  }
  disposePool(receiver)
})
