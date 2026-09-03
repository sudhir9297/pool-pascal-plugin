'use client'

import { useRegistry, useScene, type AnyNode } from '@pascal-app/core'
import { useNodeEvents } from '@pascal-app/viewer'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Group, Material, Mesh } from 'three'
import type { PoolNode } from '../../../core/schema'
import type {
  WaterfallMistEffect,
  WaterfallPoolEffect,
  WaterfallWaterEffect,
} from '../../../shader/waterfall-effect'
import { buildWaterfallGeometry } from '../core/geometry'
import type { PoolWaterfallNode } from '../core/schema'
import { resolveMountedWaterfall } from '../design/placement'

type WaterfallEffect =
  | WaterfallWaterEffect
  | WaterfallMistEffect
  | WaterfallPoolEffect

export default function PoolWaterfallPreview({ node }: { node: PoolWaterfallNode }) {
  const [, redraw] = useState(0)
  const rootRef = useRef<Group>(null!)
  const handlers = useNodeEvents(node as unknown as AnyNode, node.type as never)
  const pool = useScene((state) => {
    if (!node.poolId) return undefined
    const candidate = (state.nodes as unknown as Record<string, PoolNode>)[node.poolId]
    return candidate?.type === 'pool:pool' ? candidate : undefined
  })
  const mounted = useMemo(() => resolveMountedWaterfall(node, pool), [node, pool])
  useRegistry(node.id, node.type, rootRef)
  const geometry = useMemo(() => buildWaterfallGeometry(mounted), [mounted])
  const effects = useMemo(() => {
    const result = [] as WaterfallEffect[]
    geometry.traverse((child) => {
      const effect = (child as Mesh).userData.waterfallEffect
      if (effect) result.push(effect)
    })
    return result
  }, [geometry])
  // Do not use `useFrame` here. Plugins can be transpiled from a separate
  // package tree in development, which can load a second R3F context and make
  // an otherwise valid hook fail with "Hooks can only be used within Canvas".
  // A local RAF keeps the effect animation self-contained and also gives React
  // a render invalidation without coupling this plugin to the host's R3F copy.
  useEffect(() => {
    let frame = 0
    let previous = performance.now()
    const tick = (now: number) => {
      const delta = Math.min(0.1, Math.max(0, (now - previous) / 1000))
      previous = now
      for (const effect of effects) effect.update(delta)
      redraw((value) => (value + 1) % 1000000)
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [effects])
  useEffect(() => () => {
    for (const effect of effects) effect.dispose()
    geometry.traverse((child) => {
      const mesh = child as Mesh
      if (!mesh.isMesh) return
      mesh.geometry.dispose()
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      for (const material of materials as Material[]) {
        if (!effects.some((effect) => effect.material === material)) material.dispose()
      }
    })
  }, [geometry, effects])
  return <group position={mounted.position} rotation={mounted.rotation} ref={rootRef} {...handlers}><primitive object={geometry} /></group>
}
