'use client'

import { EDITOR_LAYER } from '@pascal-app/editor'
import { useEffect, useMemo } from 'react'
import type { Material } from 'three'
import { generatePool, poolSpecOf } from './geometry'
import type { PoolNode } from './schema'
import { naturalHeight } from './variant-utils'

/**
 * Translucent placement ghost — a single the procedural geometry dependency (not instanced) scaled to the
 * node's height, following the cursor. Clones each material for the see-through
 * look and disables raycast so the ghost never intercepts the cursor ray (which
 * would freeze `grid:move`).
 */
export default function PoolPreview({ node }: { node: PoolNode }) {
  const built = useMemo(() => {
    const pool = generatePool(poolSpecOf(node))
    pool.scale.setScalar(node.height / naturalHeight(pool))
    // Overlay layer keeps the ghost out of export/snapshot passes. Layers
    // don't inherit, so every object in the built pool needs it.
    pool.traverse((obj) => obj.layers.set(EDITOR_LAYER))
    return pool
  }, [node])

  useEffect(() => {
    const cloned: Material[] = []
    built.traverse((obj) => {
      ;(obj as unknown as { raycast: () => void }).raycast = () => {}
      const mesh = obj as { material?: Material | Material[] }
      if (!mesh.material) return
      const ghost = (mat: Material): Material => {
        const c = mat.clone()
        c.transparent = true
        c.opacity = 0.5
        c.depthWrite = false
        cloned.push(c)
        return c
      }
      mesh.material = Array.isArray(mesh.material) ? mesh.material.map(ghost) : ghost(mesh.material)
    })
    return () => {
      for (const c of cloned) c.dispose()
    }
  }, [built])

  return <primitive object={built} />
}
