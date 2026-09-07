'use client'

import { useRegistry, useScene, type AnyNode } from '@pascal-app/core'
import { useNodeEvents } from '@pascal-app/viewer'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Group, Material, Mesh } from 'three'
import type { PoolNode } from '../../../core/schema'
import { subscribeWaterfallAnimation } from '../../../shader/waterfall-animation'
import type {
  WaterfallBubbleCloudEffect,
  WaterfallLineEffect,
  WaterfallPoolEffect,
  WaterfallWaterEffect,
} from '../../../shader/waterfall-effect'
import { buildWaterfallGeometry } from '../core/geometry'
import type { PoolWaterfallNode } from '../core/schema'
import { resolveMountedWaterfall } from '../design/placement'

type WaterfallEffect =
  | WaterfallWaterEffect
  | WaterfallLineEffect
  | WaterfallPoolEffect
  | WaterfallBubbleCloudEffect

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
  useEffect(() => {
    return subscribeWaterfallAnimation((delta) => {
      for (const effect of effects) effect.update(delta)
      redraw((value) => (value + 1) % 1000000)
    })
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
