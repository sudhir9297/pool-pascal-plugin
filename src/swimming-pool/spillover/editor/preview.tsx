'use client'

import { useRegistry, useScene, type AnyNode } from '@pascal-app/core'
import { useNodeEvents } from '@pascal-app/viewer'
import { useEffect, useMemo, useRef } from 'react'
import { Group } from 'three'
import type { WebGPURenderer } from 'three/webgpu'
import { PoolNode } from '../../core/schema'
import { buildPoolSpilloverGeometry } from '../core/geometry'
import type { PoolSpilloverNode } from '../core/schema'
import { resolvePoolSpilloverSyncUpdate } from '../design/sync'
import { disposePoolSpilloverVisual } from './dispose-visual'

export default function PoolSpilloverPreview({ node }: { node: PoolSpilloverNode }) {
  const rootRef = useRef<Group>(null!)
  const handlers = useNodeEvents(node as unknown as AnyNode, node.type as never)
  const sourceValue = useScene((state) => state.nodes[node.sourcePoolId as never])
  const targetValue = useScene((state) => state.nodes[node.targetPoolId as never])
  const liveNode = useMemo(() => {
    const source = PoolNode.safeParse(sourceValue)
    const target = PoolNode.safeParse(targetValue)
    if (!source.success || !target.success) return null
    const update = resolvePoolSpilloverSyncUpdate(node, source.data, target.data)
    return update ? { ...node, ...update } : null
  }, [node, sourceValue, targetValue])
  const geometry = useMemo(
    () => liveNode ? buildPoolSpilloverGeometry(liveNode) : new Group(),
    [liveNode],
  )
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
  useEffect(() => () => disposePoolSpilloverVisual(geometry), [geometry])
  return (
    <group
      ref={rootRef}
      position={liveNode?.position ?? node.position}
      rotation={liveNode?.rotation ?? node.rotation}
      {...handlers}
    >
      <primitive object={geometry} />
    </group>
  )
}
