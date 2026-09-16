'use client'

import { useLiveNodeOverrides, useScene } from '@pascal-app/core'
import { NodeRenderer, useSceneAtmosphere, useViewer } from '@pascal-app/viewer'
import { useFrame } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { Box3, Frustum, Matrix4, Mesh, Sphere, type Group, type Material } from 'three'
import { MeshBasicNodeMaterial, type WebGPURenderer } from 'three/webgpu'
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
  getPoolChildResizePreviewPosition,
  getPoolLevelResizePreviewPosition,
  getPoolLevelResizePreviewPath,
  getPoolDepthResizePreviewTransform,
  getPoolResizePreviewTransform,
  getPoolWaterResolution,
  getPoolWaterSettingsSignature,
  selectPoolRenderNodes,
} from './pool-render-plan'
import { shouldAdvancePoolWater } from './pool-render-state'
import { usePoolNodeHost } from './node-host'
import { AttachmentPoolContext } from './attachment-pool'

export default function PoolRenderer({ node: storeNode }: { node: PoolNode }) {
  const ref = useRef<Group>(null!)
  const nodeRef = useRef<PoolNode>(storeNode)
  const resizeSessionRef = useRef<{ pool: PoolNode; positions: Map<string, [number, number, number]> } | null>(null)
  const atmosphere = useSceneAtmosphere()
  // Native resize handles publish their in-flight patch here and commit it to
  // the scene only on pointer-up. Merge that patch into the render node so the
  // basin outline and floor depth follow the pointer throughout the drag.
  const liveOverride = useLiveNodeOverrides((state) => state.get(storeNode.id))
  const node = useMemo<PoolNode>(
    () => (liveOverride ? ({ ...storeNode, ...liveOverride } as PoolNode) : storeNode),
    [storeNode, liveOverride],
  )
  nodeRef.current = node
  const inputDragging = useViewer((state) => state.inputDragging)
  const horizontalResizeInProgress = Boolean(
    liveOverride
    && ('length' in liveOverride || 'width' in liveOverride)
    && ('polygon' in liveOverride || 'outlineControlPoints' in liveOverride),
  )
  const depthResizeInProgress = Boolean(
    liveOverride && ('depth' in liveOverride || 'shallowDepth' in liveOverride || 'deepDepth' in liveOverride),
  )
  const resizeInProgress = horizontalResizeInProgress || depthResizeInProgress
  if (resizeInProgress && !resizeSessionRef.current) {
    resizeSessionRef.current = {
      pool: storeNode,
      positions: new Map(),
    }
  } else if (!resizeInProgress) {
    resizeSessionRef.current = null
  }
  const resizeSessionPool = resizeSessionRef.current?.pool ?? storeNode
  const resizePreviewTransform = useMemo(
    () => horizontalResizeInProgress
      ? getPoolResizePreviewTransform(resizeSessionPool, node)
      : depthResizeInProgress
        ? getPoolDepthResizePreviewTransform(resizeSessionPool, node)
      : { position: [0, 0, 0] as [number, number, number], scale: [1, 1, 1] as [number, number, number] },
    [depthResizeInProgress, horizontalResizeInProgress, resizeSessionPool, node],
  )
  const relatedNodes = useScene(useShallow(
    (state) => selectPoolRenderNodes(state.nodes, storeNode.id),
  ))
  const genericChildren = useScene(useShallow((state) => (node.children ?? []).flatMap((childId) => {
    const child = state.nodes[childId as never]
    if (!child || child.parentId !== storeNode.id || 'poolId' in child) return []
    return [child]
  })))
  const connectedPipes = useScene(useShallow((state) => Object.values(state.nodes).filter((candidate) => {
    if (candidate.type !== 'pipe-segment' && candidate.type !== 'pipe-fitting') return false
    const connection = (candidate as unknown as { metadata?: { poolConnection?: { poolId?: string } } }).metadata?.poolConnection
    return connection?.poolId === storeNode.id
  })))
  useEffect(() => {
    if (!horizontalResizeInProgress || (genericChildren.length === 0 && connectedPipes.length === 0)) return
    const session = resizeSessionRef.current
    const entries: (readonly [string, Record<string, unknown>])[] = []
    genericChildren.forEach((child) => {
      const position = (child as unknown as { position: [number, number, number] }).position
      const initial = session?.positions.get(child.id) ?? position
      session?.positions.set(child.id, initial)
      entries.push([child.id, { position: getPoolChildResizePreviewPosition(session?.pool ?? storeNode, node, initial) }])
    })
    connectedPipes.forEach((child) => {
      const candidate = child as unknown as { id: string; type: string; path?: [number, number, number][]; position?: [number, number, number] }
      if (candidate.type === 'pipe-segment' && candidate.path) {
        entries.push([candidate.id, { path: getPoolLevelResizePreviewPath(session?.pool ?? storeNode, node, candidate.path) }])
      }
      if (candidate.position) {
        entries.push([candidate.id, { position: getPoolLevelResizePreviewPosition(session?.pool ?? storeNode, node, candidate.position) }])
      }
    })
    useLiveNodeOverrides.getState().setMany(entries)
    return () => {
      for (const child of genericChildren) useLiveNodeOverrides.getState().clearFields(child.id, ['position'])
      for (const child of connectedPipes) useLiveNodeOverrides.getState().clearFields(child.id, ['path', 'position'])
    }
  }, [connectedPipes, genericChildren, horizontalResizeInProgress, node, storeNode])
  const visiblePoolCount = useScene((state) => countPools(state.nodes))
  const waterResolution = getPoolWaterResolution(visiblePoolCount, node.waterQuality)
  const waterSettingsSignature = getPoolWaterSettingsSignature(node)
  // A horizontal handle drag stretches the already-built basin mesh. The
  // committed node still drives geometry until pointer-up, when the host saves
  // the final patch and this renderer performs one accurate rebuild.
  // Transform and resize previews keep the committed procedural mesh stable.
  // Width/depth handles already provide a cheap scale/position preview below;
  // rebuilding the pool geometry from the live node on every pointer event
  // makes side-arrow dragging miss frames.
  const geometrySourceNode = storeNode
  const geometrySignature = useMemo(
    () => getPoolGeometrySignature(geometrySourceNode),
    [geometrySourceNode],
  )
  const geometryNode = useMemo(() => geometrySourceNode, [geometrySignature])
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
    atmosphere,
  }), [geometryNode, sceneNodes, suppressSpilloverGeometry, waterResolution, atmosphere])
  const resizePreviewScaleY = resizePreviewTransform.scale[1]
  useLayoutEffect(() => {
    if (!depthResizeInProgress || resizePreviewScaleY === 1) return
    const water = pool.getObjectByName('pool-water') as Mesh | undefined
    if (!water) return
    const scaleY = resizePreviewScaleY
    const originalY = water.position.y
    const originalScaleY = water.scale.y
    water.position.y = originalY / scaleY
    water.scale.y = originalScaleY / scaleY
    return () => {
      water.position.y = originalY
      water.scale.y = originalScaleY
    }
  }, [depthResizeInProgress, pool, resizePreviewScaleY])
  // The host's published viewer types predate third-party node augmentation;
  // the runtime event key is still the namespaced pool kind.
  const handlers = usePoolNodeHost(node, ref, geometrySignature)
  const waterEffect = pool.userData.waterEffect as PoolWaterEffect
  const immersiveWaterMaterial = useMemo(
    () => createImmersiveXRPoolWaterMaterial({ waterColor: node.waterColor }, atmosphere),
    [node.waterColor, atmosphere],
  )
  const dragWaterMaterial = useMemo(() => new MeshBasicNodeMaterial({
    color: node.waterColor,
    depthWrite: false,
    transparent: true,
    opacity: 0.72,
  }), [])
  useEffect(() => {
    dragWaterMaterial.color.set(node.waterColor)
  }, [dragWaterMaterial, node.waterColor])
  const localWaterBounds = useMemo(
    () => new Box3().setFromObject(pool).getBoundingSphere(new Sphere()),
    [pool],
  )
  const viewFrustum = useRef(new Frustum())
  const viewProjection = useRef(new Matrix4())
  const worldWaterBounds = useRef(new Sphere())
  useEffect(() => {
    waterEffect.setSettings(nodeRef.current)
  }, [waterEffect, waterSettingsSignature])

  useEffect(() => {
    const unsubscribeActions = subscribePoolWaterActions(node.id, (action) => {
      if (action === 'reset') waterEffect.reset()
      if (action === 'calm') waterEffect.calm(nodeRef.current)
      if (action === 'storm') {
        waterEffect.storm()
      }
    })
    return () => {
      unsubscribeActions()
    }
  }, [node.id, waterEffect])

  // Shadow-map updates are especially costly for rock coping. During a handle
  // drag the pool is already represented by a temporary transform, so keep
  // the interaction responsive and restore each mesh's original flags after.
  useEffect(() => {
    if (!inputDragging) return
    const shadowed: Array<[Mesh, boolean, boolean]> = []
    pool.traverse((child) => {
      const mesh = child as Mesh
      if (!mesh.isMesh || (!mesh.castShadow && !mesh.receiveShadow)) return
      shadowed.push([mesh, mesh.castShadow, mesh.receiveShadow])
      mesh.castShadow = false
      mesh.receiveShadow = false
    })
    return () => {
      for (const [mesh, castShadow, receiveShadow] of shadowed) {
        mesh.castShadow = castShadow
        mesh.receiveShadow = receiveShadow
      }
    }
  }, [inputDragging, pool])

  useFrame(({ camera, gl, invalidate }, delta) => {
    const root = ref.current
    if (!root || node.visible === false) return
    const immersiveXR = Boolean(
      (gl as unknown as { xr?: { isPresenting?: boolean } }).xr?.isPresenting,
    )
    const water = pool.getObjectByName('pool-water') as Mesh | undefined
    if (water) {
      const nextMaterial = inputDragging
        ? dragWaterMaterial
        : immersiveXR ? immersiveWaterMaterial : waterEffect.material
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
        inputDragging,
      )
    ) {
      waterEffect.update(gl as unknown as WebGPURenderer, delta)
    }
    // Keep demand-driven hosts rendering while animated uniforms and the
    // height-field simulation advance.
    invalidate()
  })

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
    () => () => dragWaterMaterial.dispose(),
    [dragWaterMaterial],
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
    >
      <group
        position={resizePreviewTransform.position}
        scale={resizePreviewTransform.scale}
      >
        <primitive object={pool} />
      </group>
      <AttachmentPoolContext.Provider value={storeNode}>{node.children?.map((childId) => (
        <NodeRenderer key={`${node.id}:${childId}`} nodeId={childId as never} />
      ))}</AttachmentPoolContext.Provider>
    </group>
  )
}
