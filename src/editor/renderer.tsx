'use client'

import { useLiveNodeOverrides, useScene } from '@pascal-app/core'
import { NodeRenderer } from '@pascal-app/viewer'
import { type ThreeEvent, useFrame } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { Box3, Frustum, Matrix4, Sphere, Vector3, type Group, type Material, type Mesh } from 'three'
import type { WebGPURenderer } from 'three/webgpu'
import { useShallow } from 'zustand/react/shallow'
import { buildPoolGeometry } from '../core/geometry'
import { resolvePoolPolygon, type PoolNode } from '../core/schema'
import { getPoolOverlaps } from '../design/pool-overlap'
import { getPoolSpilloverNotches } from '../design/spillover-notch'
import { getPoolConnectionRegions } from '../design/shared-joint'
import { subscribePoolWaterActions } from '../shader/water-actions'
import {
  createImmersiveXRPoolWaterMaterial,
  type PoolWaterEffect,
} from '../shader/water-effect'
import {
  countPools,
  getPoolGeometrySignature,
  getPoolRippleUv,
  getPoolWaterResolution,
  selectPoolRenderNodes,
  shouldAdvancePoolWater,
} from './pool-render-state'
import { usePoolNodeHost } from './node-host'
import { AttachmentPoolContext } from './attachment-pool'

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
  const relatedNodes = useScene(useShallow(
    (state) => selectPoolRenderNodes(state.nodes, storeNode.id),
  ))
  const visiblePoolCount = useScene((state) => countPools(state.nodes))
  const waterResolution = getPoolWaterResolution(visiblePoolCount)
  const geometrySignature = getPoolGeometrySignature(node)
  const geometryNode = useMemo(() => node, [geometrySignature])
  const sceneNodes = useMemo(() => Object.fromEntries([
    [geometryNode.id, geometryNode],
    ...relatedNodes.map((candidate) => [candidate.id, candidate] as const),
  ]), [geometryNode, relatedNodes])
  const spilloverEditInProgress = useLiveNodeOverrides((state) => relatedNodes.some((candidate) => {
    if (String(candidate.type) !== 'pool:spillover') return false
    const connection = candidate as unknown as { sourcePoolId?: string; targetPoolId?: string; id: string }
    return (connection.sourcePoolId === node.id || connection.targetPoolId === node.id) && Boolean(state.get(connection.id))
  }))
  const suppressSpilloverGeometry = Boolean(liveOverride) || spilloverEditInProgress
  const pool = useMemo(() => buildPoolGeometry(geometryNode, {
    overlaps: getPoolOverlaps(geometryNode, sceneNodes),
    // Live transforms can leave the committed connection endpoint briefly
    // stale. Hide its cuts during that frame; the committed sync rebuilds
    // them once the edit is released.
    spilloverNotches: suppressSpilloverGeometry
      ? []
      : getPoolSpilloverNotches(geometryNode, sceneNodes),
    removeWallRegions: getPoolConnectionRegions(geometryNode, sceneNodes),
    removeFloorRegions: getPoolConnectionRegions(geometryNode, sceneNodes),
    removeWaterRegions: getPoolConnectionRegions(geometryNode, sceneNodes),
    waterResolution,
  }), [geometryNode, sceneNodes, suppressSpilloverGeometry, waterResolution])
  // The host's published viewer types predate third-party node augmentation;
  // the runtime event key is still the namespaced pool kind.
  const handlers = usePoolNodeHost(node, ref)
  const waterEffect = pool.userData.waterEffect as PoolWaterEffect
  const immersiveWaterMaterial = useMemo(
    () => createImmersiveXRPoolWaterMaterial({ waterColor: node.waterColor }),
    [node.waterColor],
  )
  const localWaterBounds = useMemo(
    () => new Box3().setFromObject(pool).getBoundingSphere(new Sphere()),
    [pool],
  )
  const viewFrustum = useRef(new Frustum())
  const viewProjection = useRef(new Matrix4())
  const worldWaterBounds = useRef(new Sphere())
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

  useFrame(({ camera, gl, invalidate }, delta) => {
    const root = ref.current
    if (!root || node.visible === false) return
    const immersiveXR = Boolean(
      (gl as unknown as { xr?: { isPresenting?: boolean } }).xr?.isPresenting,
    )
    const water = pool.getObjectByName('pool-water') as Mesh | undefined
    if (water) {
      const nextMaterial = immersiveXR ? immersiveWaterMaterial : waterEffect.material
      if (water.material !== nextMaterial) water.material = nextMaterial
    }
    root.updateWorldMatrix(true, false)
    viewProjection.current.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
    viewFrustum.current.setFromProjectionMatrix(viewProjection.current)
    worldWaterBounds.current.copy(localWaterBounds).applyMatrix4(root.matrixWorld)
    if (!viewFrustum.current.intersectsSphere(worldWaterBounds.current)) return
    if (
      shouldAdvancePoolWater(
        immersiveXR,
        Boolean((gl as unknown as { isWebGPURenderer?: boolean }).isWebGPURenderer),
      )
    ) {
      waterEffect.update(gl as unknown as WebGPURenderer, delta)
    }
    // Keep demand-driven hosts rendering while animated uniforms and the
    // height-field simulation advance.
    invalidate()
  })

  const onPointerUp = (event: ThreeEvent<PointerEvent>) => {
    handlers.onPointerUp(event)
    const root = ref.current
    if (!root) return
    const localPoint = root.worldToLocal(event.point.clone() as Vector3)
    const rippleUv = getPoolRippleUv(
      event.object.name,
      [localPoint.x, localPoint.z],
      resolvePoolPolygon(node),
    )
    if (rippleUv) {
      waterEffect.addDrop(rippleUv[0], rippleUv[1])
    }
  }

  // Custom renderers do not pass through ParametricNodeRenderer, so they must
  // register their root object and wire the node event bus themselves. Without
  // this, the meshes can be visible but clicks never reach SelectionManager.
  useLayoutEffect(() => {
    useScene.getState().markDirty(node.id as any)
  }, [node.id])

  useEffect(
    () => () => immersiveWaterMaterial.dispose(),
    [immersiveWaterMaterial],
  )

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
      <AttachmentPoolContext.Provider value={node}>{node.children?.map((childId) => (
        <NodeRenderer key={`${node.id}:${childId}`} nodeId={childId as never} />
      ))}</AttachmentPoolContext.Provider>
    </group>
  )
}
