import { createSolidSubtractor } from './solid-subtraction'
import { Box3, ExtrudeGeometry, Shape, Vector2, Mesh, type Group } from 'three'
import { Brush } from 'three-bvh-csg'
import type { PoolOverlap } from '../design/pool-overlap'

export function cutOverlapCoping(group: Group, overlaps: PoolOverlap[]) {
  if (!overlaps.length) return
  group.updateMatrixWorld(true)
  const subtract = createSolidSubtractor()
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
      let cutter = new Brush(cutterGeometry,material)
      cutter.updateMatrixWorld(true)
      if (!bounds.intersectsBox(new Box3().setFromObject(cutter))) {cutterGeometry.dispose();continue}
      // Remove the retained half of each miter from the cutter, rather than
      // adding a flat replacement over the stone/rock geometry afterwards.
      for (const keep of overlap.copingMiterKeeps ?? []) {
        const keepGeometry = new ExtrudeGeometry(new Shape(keep.map(([x,z]) => new Vector2(x,-z))), {
          depth: bounds.max.y - bounds.min.y + 4, bevelEnabled: false,
        })
        keepGeometry.rotateX(-Math.PI / 2)
        keepGeometry.translate(0, bounds.min.y - 2, 0)
        const keepBrush = new Brush(keepGeometry, material)
        keepBrush.updateMatrixWorld(true)
        const trimmed = subtract(cutter, keepBrush)
        cutter.disposeCacheData()
        if (cutter.geometry !== cutterGeometry) cutter.geometry.dispose()
        keepBrush.disposeCacheData()
        keepGeometry.dispose()
        cutter = trimmed
        cutter.updateMatrixWorld(true)
      }
      const inputGeometry = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld)
      const input = new Brush(inputGeometry,mesh.material)
      input.updateMatrixWorld(true)
      const result = subtract(input, cutter)
      result.geometry.applyMatrix4(mesh.matrixWorld.clone().invert())
      mesh.geometry.dispose()
      mesh.geometry=result.geometry
      mesh.material=result.material
      input.disposeCacheData()
      cutter.disposeCacheData()
      if (cutter.geometry !== cutterGeometry) cutter.geometry.dispose()
      inputGeometry.dispose()
      cutterGeometry.dispose()
      }
    }
  }
}
