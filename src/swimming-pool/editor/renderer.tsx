'use client'

import { useLiveNodeOverrides, useRegistry, useScene } from '@pascal-app/core'
import { NodeRenderer, useNodeEvents } from '@pascal-app/viewer'
import { type ThreeEvent, useFrame } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import type { Material, Mesh } from 'three'
import type { Group } from 'three'
import type { WebGPURenderer } from 'three/webgpu'
import { buildPoolGeometry } from '../core/geometry'
import type { PoolNode } from '../core/schema'
import { getPoolSpilloverNotches } from '../design/spillover-notch'
import { getPoolConnectionRegions } from '../design/shared-joint'
import { subscribePoolWaterActions } from '../shader/water-actions'
import type { PoolWaterEffect } from '../shader/water-effect'

export default function PoolRenderer({ node: storeNode }: { node: PoolNode }) {
  const ref = useRef<Group>(null!)
  // Native resize handles publish their in-flight patch here and commit it to
  // the scene only on pointer-up. Merge that patch into the render node so the
  // basin outline and floor depth follow the pointer throughout the drag.
  const liveOverride = useLiveNodeOverrides((state) => state.get(storeNode.id))
  const node = useMemo<PoolNode>(
    () => (liveOverride ? ({ ...storeNode, ...liveOverride } as PoolNode) : storeNode),
    [storeNode, liveOverride],
  )
  const sceneNodes = useScene((state) => state.nodes)
  const pool = useMemo(
    () => buildPoolGeometry(node, {
      spilloverNotches: getPoolSpilloverNotches(node, sceneNodes),
      removeWallRegions: getPoolConnectionRegions(node, sceneNodes),
      removeFloorRegions: getPoolConnectionRegions(node, sceneNodes),
      removeWaterRegions: getPoolConnectionRegions(node, sceneNodes),
    }),
    [node, sceneNodes],
  )
  // The host's published viewer types predate third-party node augmentation;
  // the runtime event key is still the namespaced pool kind.
  const handlers = useNodeEvents(node as any, node.type as any)
  const waterEffect = pool.userData.waterEffect as PoolWaterEffect
  useEffect(() => {
    waterEffect.setSettings(node)
  }, [node, waterEffect])

  useEffect(() => {
    const unsubscribeActions = subscribePoolWaterActions(node.id, (action) => {
      if (action === 'splash') waterEffect.splash()
      if (action === 'reset') waterEffect.reset()
      if (action === 'calm') {
        waterEffect.setSettings({ ...node, rain: 0, breeze: 0.08, viscosity: 0.55, surfaceDetail: 1.15 })
      }
      if (action === 'storm') {
        waterEffect.setSettings({ ...node, rain: 0.75, breeze: 0.85, viscosity: 0.12, surfaceDetail: 2.4 })
      }
    })
    return () => {
      unsubscribeActions()
    }
  }, [node, waterEffect])

  useFrame(({ gl, invalidate }, delta) => {
    if (node.visible === false) return
    if ((gl as unknown as { isWebGPURenderer?: boolean }).isWebGPURenderer) {
      waterEffect.update(gl as unknown as WebGPURenderer, delta)
    }
    // Keep demand-driven hosts rendering while animated uniforms and the
    // height-field simulation advance.
    invalidate()
  })

  const onPointerUp = (event: ThreeEvent<PointerEvent>) => {
    handlers.onPointerUp(event)
    if (event.object.name === 'pool-water' && event.uv) {
      waterEffect.addDrop(event.uv.x, event.uv.y)
    }
  }

  // Custom renderers do not pass through ParametricNodeRenderer, so they must
  // register their root object and wire the node event bus themselves. Without
  // this, the meshes can be visible but clicks never reach SelectionManager.
  useRegistry(node.id as any, node.type as any, ref)
  useLayoutEffect(() => {
    useScene.getState().markDirty(node.id as any)
  }, [node.id])

  useEffect(
    () => () => {
      waterEffect.dispose()
      pool.traverse((child) => {
        const mesh = child as Mesh
        if (!mesh.isMesh) return
        mesh.geometry.dispose()
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
        for (const material of materials as Material[]) material.dispose()
      })
    },
    [pool, waterEffect],
  )

  return (
    <group
      ref={ref}
      position={node.position}
      rotation={node.rotation}
      visible={node.visible !== false}
      {...handlers}
      onPointerUp={onPointerUp}
    >
      <primitive object={pool} />
      {node.children?.map((childId) => (
        <NodeRenderer key={`${node.id}:${childId}`} nodeId={childId as never} />
      ))}
    </group>
  )
}
