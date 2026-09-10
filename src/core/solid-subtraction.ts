import { Brush, Evaluator, HOLLOW_INTERSECTION, HOLLOW_SUBTRACTION } from 'three-bvh-csg'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

/** Preserve beveled surfaces with CDT, then close the cut with solid end faces. */
export function createSolidSubtractor() {
  // In CSG 0.0.18, CDT treats closed intersection loops inside a cutter
  // triangle as holes. That preserves the rock surface but omits its cap.
  // The legacy splitter handles those caps, but damages thin beveled rock
  // faces. Evaluate each surface separately with the appropriate splitter.
  const surfaceEvaluator = Object.assign(new Evaluator(), {
    consolidateGroups: false, useCDTClipping: true,
  })
  const capEvaluator = Object.assign(new Evaluator(), { consolidateGroups: false })

  return (solid: Brush, cutter: Brush): Brush => {
    const surface = surfaceEvaluator.evaluate(solid, cutter, HOLLOW_SUBTRACTION)
    let cap: Brush
    try {
      cap = capEvaluator.evaluate(cutter, solid, HOLLOW_INTERSECTION)
    } catch (error) {
      surface.geometry.dispose()
      throw error
    }
    // Both outputs are in their first operand's local frame. Put the cutter
    // faces in the solid's frame and turn them inward to close the subtraction.
    cap.geometry.applyMatrix4(solid.matrixWorld.clone().invert().multiply(cutter.matrixWorld))
    const capIndex = cap.geometry.index!
    for (let i = 0; i < capIndex.count; i += 3) {
      const first = capIndex.getX(i)
      capIndex.setX(i, capIndex.getX(i + 2))
      capIndex.setX(i + 2, first)
    }
    const normals = cap.geometry.getAttribute('normal')
    for (let i = 0; i < normals.count; i++) {
      normals.setXYZ(i, -normals.getX(i), -normals.getY(i), -normals.getZ(i))
    }
    const surfaceMaterials = Array.isArray(surface.material) ? surface.material : [surface.material]
    const capMaterials = Array.isArray(cap.material) ? cap.material : [cap.material]
    const geometry = mergeGeometries([surface.geometry, cap.geometry])!
    for (const group of surface.geometry.groups) {
      geometry.addGroup(group.start, group.count, group.materialIndex)
    }
    const offset = surface.geometry.index!.count
    for (const group of cap.geometry.groups) {
      geometry.addGroup(offset + group.start, group.count, surfaceMaterials.length + (group.materialIndex ?? 0))
    }
    surface.geometry.dispose()
    cap.geometry.dispose()
    surface.geometry = geometry
    surface.material = [...surfaceMaterials, ...capMaterials]
    return surface
  }
}
