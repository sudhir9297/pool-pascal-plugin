import { Box3, BoxGeometry, type Group, type Material, Mesh } from 'three'
import { Brush, Evaluator, SUBTRACTION } from 'three-bvh-csg'
import type { SpilloverNotch } from '../design/spillover-notch'

/** Cut only the upper shell and coping; leave the water and floor untouched. */
export function cutPoolSpilloverNotches(group: Group, notches: SpilloverNotch[], shellFacesInward: boolean) {
  if (notches.length === 0) return
  const evaluator = new Evaluator()
  group.updateMatrixWorld(true)
  const targets: Mesh[] = []
  for (const child of group.children) {
    if (child.name !== 'pool-shell-walls' && !child.name.includes('coping')) continue
    child.traverse((object) => { if (object instanceof Mesh) targets.push(object) })
  }
  for (const mesh of targets) {
    let inwardShell = mesh.name === 'pool-shell-walls' && shellFacesInward
    for (const notch of notches) {
      const cutterGeometry = new BoxGeometry(notch.depth, notch.top - notch.bottom, notch.width)
      const material = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as Material
      const cutter = new Brush(cutterGeometry, material)
      cutter.position.set(notch.center[0], (notch.top + notch.bottom) / 2, notch.center[1])
      cutter.rotation.y = notch.rotation
      cutter.updateMatrixWorld(true)
      if (!new Box3().setFromObject(mesh).intersectsBox(new Box3().setFromObject(cutter))) {
        cutterGeometry.dispose()
        continue
      }
      const inputGeometry = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld)
      if (inwardShell) {
        // Counterclockwise outlines produce inward shell faces; clockwise
        // outlines already face outward. CSG needs outward faces in both cases.
        const count = inputGeometry.getAttribute('position').count
        inputGeometry.setIndex(Array.from({ length: count }, (_, index) =>
          index % 3 === 1 ? index + 1 : index % 3 === 2 ? index - 1 : index))
        inputGeometry.computeVertexNormals()
      }
      const input = new Brush(inputGeometry, mesh.material)
      input.updateMatrixWorld(true)
      const result = evaluator.evaluate(input, cutter, SUBTRACTION)
      result.geometry.applyMatrix4(mesh.matrixWorld.clone().invert())
      mesh.geometry.dispose()
      mesh.geometry = result.geometry
      inwardShell = false
      mesh.material = result.material
      input.disposeCacheData()
      cutter.disposeCacheData()
      inputGeometry.dispose()
      cutterGeometry.dispose()
    }
  }
}
