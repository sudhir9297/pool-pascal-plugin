import type { BufferGeometry, Group, Material, Mesh } from 'three'

type WaterEffect = {
  material?: Material
  dispose: () => void
}

export function disposePoolSpilloverVisual(root: Group) {
  const effectMaterials = new Set<Material>()
  for (const effect of (root.userData.waterEffects ?? []) as WaterEffect[]) {
    if (effect.material) effectMaterials.add(effect.material)
    effect.dispose()
  }

  const geometries = new Set<BufferGeometry>()
  const materials = new Set<Material>()
  root.traverse((child) => {
    const mesh = child as Mesh
    if (!mesh.isMesh) return
    geometries.add(mesh.geometry)
    const values = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    for (const material of values) materials.add(material)
  })
  for (const geometry of geometries) geometry.dispose()
  for (const material of materials) {
    if (!effectMaterials.has(material)) material.dispose()
  }
}
