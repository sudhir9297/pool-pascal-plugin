import type { BufferGeometry, Group, Material, Mesh } from 'three'

type WaterfallEffect = {
  material: Material
  dispose: () => void
}

export function disposeWaterfallVisual(root: Group) {
  const effects = new Set<WaterfallEffect>()
  const effectMaterials = new Set<Material>()
  const geometries = new Set<BufferGeometry>()
  const materials = new Set<Material>()

  root.traverse((child) => {
    const mesh = child as Mesh
    if (!mesh.isMesh) return
    geometries.add(mesh.geometry)
    const effect = mesh.userData.waterfallEffect as WaterfallEffect | undefined
    if (effect) effects.add(effect)
    const values = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    for (const material of values) materials.add(material)
  })

  for (const effect of effects) {
    effectMaterials.add(effect.material)
    effect.dispose()
  }
  for (const geometry of geometries) geometry.dispose()
  for (const material of materials) {
    if (!effectMaterials.has(material)) material.dispose()
  }
}
