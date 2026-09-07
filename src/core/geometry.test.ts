import { describe, expect, test } from 'bun:test'
import type { BufferAttribute, Material, Mesh } from 'three'
import { PoolNode } from './schema'
import { buildPoolGeometry } from './geometry'

describe('pool connection wall openings', () => {
  test('uses the requested adaptive water resolution', () => {
    const geometry = buildPoolGeometry(PoolNode.parse({}), { waterResolution: 64 })
    expect(geometry.userData.waterEffect.resolution).toBe(64)
    geometry.userData.waterEffect.dispose()
    geometry.traverse((child) => {
      const mesh = child as Mesh
      if (!mesh.isMesh) return
      mesh.geometry.dispose()
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      for (const material of materials as Material[]) material.dispose()
    })
  })

  test('keeps wall fragments on both sides of a narrow opening', () => {
    const pool = PoolNode.parse({
      polygon: [[-4, -2], [4, -2], [4, 2], [-4, 2]],
      coveRadius: 0,
    })
    const geometry = buildPoolGeometry(pool, {
      removeWallRegions: [[[3.7, -0.3], [4.3, -0.3], [4.3, 0.3], [3.7, 0.3]]],
    })
    const walls = geometry.getObjectByName('pool-shell-walls') as Mesh
    const positions = walls.geometry.getAttribute('position') as BufferAttribute
    const rightWallTriangleCenters: number[] = []
    for (let index = 0; index < positions.count; index += 3) {
      const xs = [positions.getX(index), positions.getX(index + 1), positions.getX(index + 2)]
      if (!xs.every((x) => Math.abs(x - 4) < 1e-6)) continue
      rightWallTriangleCenters.push((positions.getZ(index) + positions.getZ(index + 1) + positions.getZ(index + 2)) / 3)
    }

    expect(rightWallTriangleCenters.some((z) => z < -0.3)).toBe(true)
    expect(rightWallTriangleCenters.some((z) => z > 0.3)).toBe(true)
    expect(rightWallTriangleCenters.every((z) => Math.abs(z) >= 0.3)).toBe(true)

    geometry.traverse((child) => {
      const mesh = child as Mesh
      if (!mesh.isMesh) return
      mesh.geometry.dispose()
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      for (const material of materials as Material[]) material.dispose()
    })
  })

  test('keeps every connected-pool mesh non-empty and UV mapped', () => {
    const pool = PoolNode.parse({
      polygon: [[-4, -2], [4, -2], [4, 2], [-4, 2]],
      coveRadius: 0.2,
    })
    const opening: [number, number][][] = [[[3.7, -0.4], [4.3, -0.4], [4.3, 0.4], [3.7, 0.4]]]
    const geometry = buildPoolGeometry(pool, {
      removeWallRegions: opening,
      removeFloorRegions: opening,
      removeWaterRegions: opening,
    })
    const invalidMeshes: string[] = []
    geometry.traverse((child) => {
      const mesh = child as Mesh
      if (!mesh.isMesh) return
      if ((mesh.geometry.getAttribute('position')?.count ?? 0) === 0 || !mesh.geometry.getAttribute('uv')) {
        invalidMeshes.push(mesh.name || mesh.geometry.type)
      }
    })

    expect(invalidMeshes).toEqual([])

    geometry.traverse((child) => {
      const mesh = child as Mesh
      if (!mesh.isMesh) return
      mesh.geometry.dispose()
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      for (const material of materials as Material[]) material.dispose()
    })
  })
})
