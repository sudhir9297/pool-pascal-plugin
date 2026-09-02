'use client'

import { useEffect, useMemo } from 'react'
import type { Material, MeshStandardMaterial } from 'three'
import { getHotTubVariant } from './hotTub-geometry'
import type { HotTubNode } from './hotTub-schema'

const NO_RAYCAST = () => {}

/** Translucent placement ghost for a hotTub — clones the variant materials so
 * the cursor preview is see-through without mutating the cached originals. */
export default function HotTubPreview({ node }: { node: HotTubNode }) {
  const data = useMemo(() => getHotTubVariant(node), [node])
  const scale = node.height / data.naturalHeight

  const ghosts = useMemo(
    () =>
      data.subMeshes.map((sub) => {
        const base = (
          Array.isArray(sub.material) ? sub.material[0] : sub.material
        ) as MeshStandardMaterial
        const clone = base.clone()
        clone.transparent = true
        clone.opacity = 0.55
        clone.depthWrite = false
        return clone
      }),
    [data],
  )

  useEffect(
    () => () => {
      for (const m of ghosts as Material[]) m.dispose()
    },
    [ghosts],
  )

  return (
    <group scale={scale}>
      {data.subMeshes.map((sub, i) => (
        <mesh
          dispose={null}
          geometry={sub.geometry}
          key={i}
          material={ghosts[i]}
          raycast={NO_RAYCAST}
        />
      ))}
    </group>
  )
}
