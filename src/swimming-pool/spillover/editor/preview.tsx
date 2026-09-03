'use client'

import { useRegistry, type AnyNode } from '@pascal-app/core'
import { useNodeEvents } from '@pascal-app/viewer'
import { useEffect, useMemo, useRef } from 'react'
import type { Group, Material, Mesh } from 'three'
import type { WebGPURenderer } from 'three/webgpu'
import { buildPoolSpilloverGeometry } from '../core/geometry'
import type { PoolSpilloverNode } from '../core/schema'

export default function PoolSpilloverPreview({ node }: { node: PoolSpilloverNode }) {
  const rootRef = useRef<Group>(null!)
  const handlers = useNodeEvents(node as unknown as AnyNode, node.type as never)
  const geometry = useMemo(() => buildPoolSpilloverGeometry(node), [node])
  useRegistry(node.id, node.type, rootRef)
  useEffect(() => {
    let frame = 0
    let previous = performance.now()
    const tick = (now: number) => {
      const delta = Math.min(0.1, Math.max(0, (now - previous) / 1000))
      previous = now
      const canvas = document.querySelector('canvas') as (HTMLCanvasElement & { __r3f?: { root?: { getState: () => { gl: WebGPURenderer } } } }) | null
      const renderer = canvas?.__r3f?.root?.getState().gl
      for (const effect of geometry.userData.waterEffects ?? []) {
        if (renderer) effect.update(renderer, delta)
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [geometry])
  useEffect(() => () => {
    for (const effect of geometry.userData.waterEffects ?? []) effect.dispose()
    geometry.traverse((child) => {
      const mesh = child as Mesh
      if (!mesh.isMesh) return
      mesh.geometry.dispose()
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      for (const material of materials as Material[]) material.dispose()
    })
  }, [geometry])
  return <group ref={rootRef} position={node.position} rotation={node.rotation} {...handlers}><primitive object={geometry} /></group>
}
