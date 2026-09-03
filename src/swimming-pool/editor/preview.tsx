'use client'

import { useEffect, useMemo } from 'react'
import { useScene } from '@pascal-app/core'
import type { Material, Mesh } from 'three'
import { buildPoolGeometry } from '../core/geometry'
import type { PoolNode } from '../core/schema'
import { getPoolConnectionRegions } from '../design/shared-joint'

const NO_RAYCAST = () => {}

export default function PoolPreview({ node }: { node: PoolNode }) {
  const sceneNodes = useScene((state) => state.nodes)
  const pool = useMemo(() => {
    const group = buildPoolGeometry(node, {
      removeWallRegions: getPoolConnectionRegions(node, sceneNodes),
      removeFloorRegions: getPoolConnectionRegions(node, sceneNodes),
      removeWaterRegions: getPoolConnectionRegions(node, sceneNodes),
    })
    group.traverse((child) => {
      const mesh = child as Mesh
      if (!mesh.isMesh) return
      mesh.raycast = NO_RAYCAST
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      mesh.material = materials.map((material) => {
        const clone = material.clone()
        clone.transparent = true
        clone.opacity = 0.45
        clone.depthWrite = false
        return clone
      })
      for (const material of materials) material.dispose()
    })
    return group
  }, [node, sceneNodes])

  useEffect(() => () => {
    pool.traverse((child) => {
      const mesh = child as Mesh
      if (!mesh.isMesh) return
      mesh.geometry.dispose()
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      for (const material of materials as Material[]) material.dispose()
    })
  }, [pool])

  return <primitive object={pool} />
}
