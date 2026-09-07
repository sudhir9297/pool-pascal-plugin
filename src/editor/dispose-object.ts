import { type Material, type Mesh, type Object3D } from 'three'

/** Disposes each shared geometry and material exactly once. */
export function disposeObject3D(root: Object3D) {
  const geometries = new Set<Mesh['geometry']>()
  const materials = new Set<Material>()
  root.traverse((child) => {
    const mesh = child as Mesh
    if (!mesh.isMesh) return
    geometries.add(mesh.geometry)
    const values = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    for (const material of values as Material[]) materials.add(material)
  })
  for (const geometry of geometries) geometry.dispose()
  for (const material of materials) material.dispose()
}
