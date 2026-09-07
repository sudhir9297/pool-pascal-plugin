import { Box3, BoxGeometry, ExtrudeGeometry, Shape, type BufferGeometry, type Group, type Material, Mesh } from 'three'
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
      // Curved shell cuts need the sampled rim profile. Coping is a solid
      // finished strip, so use the rectangular opening there; feeding the
      // curved prism into coping CSG can leave a detached triangular cap.
      const cutterGeometry = buildNotchCutterGeometry(
        mesh.name === 'pool-shell-walls' ? notch : { ...notch, edgeProfile: undefined },
      )
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
      let result: Brush
      try {
        result = evaluator.evaluate(input, cutter, SUBTRACTION) as unknown as Brush
      } catch {
        // Live transforms can briefly expose an incomplete CSG mesh. Keep the
        // last valid shell instead of allowing that transient state to crash
        // the editor; the committed sync will rebuild the opening afterward.
        input.disposeCacheData()
        cutter.disposeCacheData()
        inputGeometry.dispose()
        cutterGeometry.dispose()
        continue
      }
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

function buildNotchCutterGeometry(notch: SpilloverNotch): BufferGeometry {
  const profile = notch.edgeProfile
  if (!profile || profile.length < 2) {
    return new BoxGeometry(notch.depth, notch.top - notch.bottom, notch.width)
  }

  // Build one closed prism whose near side follows the sampled curved rim.
  // ExtrudeGeometry starts in X/Y; with this rotation its Y coordinate maps
  // to local Z and its extrusion maps to local Y. Keep the geometry centred
  // vertically because the cutter mesh receives the notch midpoint position.
  const shape = new Shape()
  const halfDepth = notch.depth / 2
  const first = profile[0]!
  shape.moveTo(first[1] - halfDepth, -first[0])
  for (const [across, along] of profile.slice(1)) shape.lineTo(along - halfDepth, -across)
  for (const [across, along] of [...profile].reverse()) shape.lineTo(along + halfDepth, -across)
  shape.closePath()
  const height = notch.top - notch.bottom
  const geometry = new ExtrudeGeometry(shape, {
    bevelEnabled: false,
    curveSegments: 1,
    depth: height,
    steps: 1,
  })
  geometry.rotateX(-Math.PI / 2)
  geometry.translate(0, -height / 2, 0)
  return geometry
}
