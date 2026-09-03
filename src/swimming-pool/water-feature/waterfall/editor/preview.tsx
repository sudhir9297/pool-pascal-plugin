'use client'

import { useRegistry, useScene, type AnyNode } from '@pascal-app/core'
import { useNodeEvents } from '@pascal-app/viewer'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Group, Material, Mesh } from 'three'
import { resolvePoolPolygon, type PoolNode } from '../../../core/schema'
import { triggerPoolWaterImpact } from '../../../shader/water-actions'
import type {
  WaterfallMistEffect,
  WaterfallPoolEffect,
  WaterfallWaterEffect,
} from '../../../shader/waterfall-effect'
import { buildWaterfallGeometry, getWaterfallImpactLocalPoint } from '../core/geometry'
import type { PoolWaterfallNode } from '../core/schema'
import { resolveMountedWaterfall } from '../design/placement'

type WaterfallEffect =
  | WaterfallWaterEffect
  | WaterfallMistEffect
  | WaterfallPoolEffect

export default function PoolWaterfallPreview({ node }: { node: PoolWaterfallNode }) {
  const [, redraw] = useState(0)
  const rootRef = useRef<Group>(null!)
  const impactClock = useRef(0)
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
      if (pool && mounted.poolId && mounted.showFlow) {
        impactClock.current += delta
        const interval = Math.max(0.12, 0.42 / mounted.flowStrength)
        if (impactClock.current >= interval) {
          impactClock.current %= interval
          const impact = getWaterfallImpactLocalPoint(mounted)
          const angle = mounted.rotation[1]
          const worldX = mounted.position[0] + impact[0] * Math.cos(angle) + impact[1] * Math.sin(angle)
          const worldZ = mounted.position[2] - impact[0] * Math.sin(angle) + impact[1] * Math.cos(angle)
          const poolAngle = pool.rotation[1]
          const dx = worldX - pool.position[0]
          const dz = worldZ - pool.position[2]
          const localX = dx * Math.cos(poolAngle) - dz * Math.sin(poolAngle)
          const localZ = dx * Math.sin(poolAngle) + dz * Math.cos(poolAngle)
          const polygon = resolvePoolPolygon(pool)
          const xs = polygon.map(([x]) => x)
          const zs = polygon.map(([, z]) => z)
          const u = (localX - Math.min(...xs)) / Math.max(0.001, Math.max(...xs) - Math.min(...xs))
          const v = (localZ - Math.min(...zs)) / Math.max(0.001, Math.max(...zs) - Math.min(...zs))
          triggerPoolWaterImpact(pool.id, {
            u: Math.max(0, Math.min(1, u)),
            v: Math.max(0, Math.min(1, v)),
            strength: Math.min(0.22, 0.035 * mounted.flowStrength),
          })
        }
      }
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
