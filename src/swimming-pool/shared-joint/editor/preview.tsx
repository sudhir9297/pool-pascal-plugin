'use client'

import { useRegistry, useScene, type AnyNode } from '@pascal-app/core'
import { useNodeEvents } from '@pascal-app/viewer'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Group, Material, Mesh } from 'three'
import type { WebGPURenderer } from 'three/webgpu'
import { buildSharedJointGeometry } from '../core/geometry'
import type { PoolSharedJointNode } from '../core/schema'
import { PoolNode } from '../../core/schema'

export default function PoolSharedJointPreview({ node }: { node: PoolSharedJointNode }) {
  const [, redraw] = useState(0)
  const rootRef = useRef<Group>(null!)
  const handlers = useNodeEvents(node as unknown as AnyNode, node.type as never)
  useRegistry(node.id, node.type, rootRef)
  const geometry = useMemo(() => buildSharedJointGeometry(node), [node])
  const waterEffect = geometry.userData.waterEffect
  const sceneNodes = useScene((state) => state.nodes)
  const sourceWaterSettings = useMemo(() => {
    for (const poolId of node.poolIds) {
      const candidate = (sceneNodes as Record<string, AnyNode>)[poolId]
      const parsed = candidate ? PoolNode.safeParse(candidate) : null
      if (parsed?.success) return parsed.data
    }
    return null
  }, [node.poolIds, sceneNodes])
  const hasExplicitSpillover = useMemo(() => Object.values(sceneNodes).some((candidate) => {
    if (String(candidate.type) !== 'pool:spillover') return false
    const sourcePoolId = String((candidate as { sourcePoolId?: unknown }).sourcePoolId ?? '')
    const targetPoolId = String((candidate as { targetPoolId?: unknown }).targetPoolId ?? '')
    return sourcePoolId && targetPoolId &&
      sourcePoolId !== targetPoolId &&
      [sourcePoolId, targetPoolId].sort().join('|') === [...node.poolIds].sort().join('|')
  }), [node.poolIds, sceneNodes])
  useEffect(() => {
    if (waterEffect && sourceWaterSettings) waterEffect.setSettings(sourceWaterSettings)
  }, [sourceWaterSettings, waterEffect])
  useEffect(() => {
    let frame = 0
    let previous = performance.now()
    const tick = (now: number) => {
      const delta = Math.min(0.1, Math.max(0, (now - previous) / 1000))
      previous = now
      // The effect owns its material; redraw keeps demand-rendered previews
      // moving without depending on a second R3F context.
      if (waterEffect) {
        const canvas = document.querySelector('canvas') as (HTMLCanvasElement & {
          __r3f?: { root?: { getState: () => { gl: WebGPURenderer } } }
        }) | null
        const renderer = canvas?.__r3f?.root?.getState().gl
        if (renderer) waterEffect.update(renderer, delta)
      }
      redraw((value) => (value + 1) % 1000000)
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [waterEffect])
  useEffect(() => () => {
    waterEffect?.dispose()
    geometry.traverse((child) => {
      const mesh = child as Mesh
      if (!mesh.isMesh) return
      mesh.geometry.dispose()
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      for (const material of materials as Material[]) {
        if (material !== waterEffect?.material) material.dispose()
      }
    })
  }, [geometry, waterEffect])
  return <group position={node.position} rotation={node.rotation} ref={rootRef} visible={!hasExplicitSpillover} {...handlers}><primitive object={geometry} /></group>
}
