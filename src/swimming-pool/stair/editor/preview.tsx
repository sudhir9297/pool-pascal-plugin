'use client'

import { useRegistry, useScene, type AnyNode } from '@pascal-app/core'
import { useNodeEvents } from '@pascal-app/viewer'
import { useEffect, useMemo, useRef } from 'react'
import type { Group, Material, Mesh } from 'three'
import { buildPoolStairGeometry } from '../core/geometry'
import type { PoolStairNode } from '../core/schema'
import type { PoolNode } from '../../core/schema'
import { placementOnPoolWall } from '../../skimmer/design/placement'

export default function PoolStairPreview({ node }: { node: PoolStairNode }) {
  const rootRef = useRef<Group>(null!)
  const handlers = useNodeEvents(node as unknown as AnyNode, node.type as never)
  const pool = useScene((state) => node.poolId ? (state.nodes as unknown as Record<string, PoolNode>)[node.poolId] : undefined)
  const mounted = useMemo<PoolStairNode>(() => {
    if (!pool || pool.id !== node.poolId) return node
    const placement = placementOnPoolWall(pool, node.wallIndex, node.wallT)
    return placement ? { ...node, position: [placement.position[0], pool.position[1] + pool.finishedDeckElevation, placement.position[2]] as [number, number, number], rotation: placement.rotation } : node
  }, [node, pool])
  useRegistry(node.id, node.type, rootRef)
  const geometry = useMemo(() => buildPoolStairGeometry(mounted), [mounted])
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
  return <group ref={rootRef} position={mounted.position} rotation={mounted.rotation} {...handlers}><primitive object={geometry} /></group>
}
