'use client'

import { useScene } from '@pascal-app/core'
import { useEffect, useMemo } from 'react'
import type { Material, Mesh } from 'three'
import { getPoolNode } from '../../editor/scene-nodes'
import { buildPoolStairGeometry } from '../core/geometry'
import type { PoolStairNode } from '../core/schema'
import { resolvePoolStairMounting } from '../design/mounting'
import type { PoolStairAttachment } from '../design/placement'

export default function PoolStairGhost({ node, placement }: {
  node: PoolStairNode
  placement: PoolStairAttachment
}) {
  const pool = useScene((state) => getPoolNode(state.nodes, placement.poolId))
  const geometry = useMemo(() => {
    const group = buildPoolStairGeometry(node, resolvePoolStairMounting(node, pool))
    group.traverse((child) => {
      const mesh = child as Mesh
      if (!mesh.isMesh) return
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      for (const material of materials as Material[]) {
        material.transparent = true
        material.opacity = 0.42
        material.depthWrite = false
      }
    })
    return group
  }, [node, pool])

  useEffect(() => () => {
    const materials = new Set<Material>()
    geometry.traverse((child) => {
      const mesh = child as Mesh
      if (!mesh.isMesh) return
      mesh.geometry.dispose()
      const values = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      for (const material of values as Material[]) materials.add(material)
    })
    for (const material of materials) material.dispose()
  }, [geometry])

  return <primitive object={geometry} position={placement.position} rotation={placement.rotation} />
}
