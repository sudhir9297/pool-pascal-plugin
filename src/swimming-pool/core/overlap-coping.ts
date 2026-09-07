import { Box3, ExtrudeGeometry, Shape, Vector2, Mesh, type Group } from 'three'
import { Brush, Evaluator, SUBTRACTION } from 'three-bvh-csg'
import type { PoolOverlap } from '../design/pool-overlap'

export function cutOverlapCoping(group: Group, overlaps: PoolOverlap[]) {
  if (!overlaps.length) return
  group.updateMatrixWorld(true)
  const evaluator = new Evaluator()
  const targets: Mesh[] = []
  group.getObjectByName('pool-coping')?.traverse(object => {if(object instanceof Mesh) targets.push(object)})
  for (const mesh of targets) {
    for (const overlap of overlaps) {
      const footprints = overlap.copingFootprints ?? [overlap.footprint]
      for (const footprint of footprints) {
      const bounds = new Box3().setFromObject(mesh)
      const shape = new Shape(footprint.map(([x,z])=>new Vector2(x,-z)))
      const cutterGeometry = new ExtrudeGeometry(shape,{depth:bounds.max.y-bounds.min.y+2,bevelEnabled:false})
      cutterGeometry.rotateX(-Math.PI/2)
      cutterGeometry.translate(0,bounds.min.y-1,0)
      const material = Array.isArray(mesh.material) ? mesh.material[0]! : mesh.material
      const cutter = new Brush(cutterGeometry,material)
      cutter.updateMatrixWorld(true)
      if (!bounds.intersectsBox(new Box3().setFromObject(cutter))) {cutterGeometry.dispose();continue}
      const inputGeometry = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld)
      const input = new Brush(inputGeometry,mesh.material)
      input.updateMatrixWorld(true)
      const result = evaluator.evaluate(input,cutter,SUBTRACTION)
      result.geometry.applyMatrix4(mesh.matrixWorld.clone().invert())
      mesh.geometry.dispose()
      mesh.geometry=result.geometry
      mesh.material=result.material
      input.disposeCacheData()
      cutter.disposeCacheData()
      inputGeometry.dispose()
      cutterGeometry.dispose()
      }
    }
  }
}
