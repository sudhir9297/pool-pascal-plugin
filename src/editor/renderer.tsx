'use client'

import { type AnyNode, useLiveNodeOverrides, useLiveTransforms, useScene } from '@pascal-app/core'
import { NodeRenderer, useSceneAtmosphere, useViewer } from '@pascal-app/viewer'
import { useFrame, useThree } from '@react-three/fiber'
import { type ReactNode, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { Box3, Frustum, Matrix4, Mesh, Sphere, Vector3, type Group, type Material } from 'three'
import { MeshBasicNodeMaterial, type WebGPURenderer } from 'three/webgpu'
import { useShallow } from 'zustand/react/shallow'
import { buildPoolCopingGeometry, buildPoolGeometry, buildPoolPlacementPreviewGeometry, updatePoolInteriorFinish } from '../core/geometry'
import { resolvePoolPolygon, type PoolNode } from '../core/schema'
import { getPoolOverlaps } from '../design/pool-overlap'
import { getPoolSpilloverNotches } from '../design/spillover-notch'
import { getPoolConnectionRegions } from '../design/shared-joint'
import { subscribePoolWaterActions } from '../shader/water-actions'
import { registerPoolWaterEffect } from '../shader/water-effect-registry'
import {
  createImmersiveXRPoolWaterMaterial,
  PoolWaterEffect,
} from '../shader/water-effect'
import {
  countPools,
  getPoolGeometrySignature,
  getPoolChildResizePreviewPosition,
  getPoolLevelAttachedPath,
  getPoolLevelAttachedPosition,
  getPoolLevelAttachedRotation,
  getPoolDepthResizePreviewTransform,
  getPoolResizePreviewTransform,
  getPoolWaterResolution,
  getPoolWaterSettingsSignature,
  getPoolRenderPose,
  selectPoolConnectedPipes,
  selectPoolRenderNodes,
} from './pool-render-plan'
import { poolWaterSimulationHz, shouldAdvancePoolWater } from './pool-render-state'
import { usePoolNodeHost } from './node-host'
import { AttachmentPoolContext } from './attachment-pool'
import { disposeObject3D } from './dispose-object'
import { usePoolAnimationActivity } from './animation-activity'

const NO_CONNECTED_PIPES: AnyNode[] = []

/**
 * Read-only pool renderer: basin, coping, animated water, attached fittings and
 * live resize/move previews. Editing hosts register `./renderer.edit`, which
 * adds the outline controls through `overlay`.
 */
export default function PoolRenderer({
  node: storeNode,
  overlay,
}: {
  node: PoolNode
  /** Extra content in the pool's frame, given the live (preview-merged) node. */
  overlay?: (node: PoolNode) => ReactNode
}) {
  const ref = useRef<Group>(null!)
  const nodeRef = useRef<PoolNode>(storeNode)
  const resizeSessionRef = useRef<{ pool: PoolNode; positions: Map<string, [number, number, number]> } | null>(null)
  const animationActive = usePoolAnimationActivity()
  const atmosphere = useSceneAtmosphere()
  const invalidate = useThree((state) => state.invalidate)
  // Native resize handles publish their in-flight patch here and commit it to
  // the scene only on pointer-up. Merge that patch into the render node so the
  // basin outline and floor depth follow the pointer throughout the drag.
  const liveOverride = useLiveNodeOverrides((state) => state.get(storeNode.id))
  const sectionPreviewInProgress = Boolean(liveOverride?.__poolSectionPreview || liveOverride?.__poolEditPreview)
  const node = useMemo<PoolNode>(
    () => (liveOverride ? ({ ...storeNode, ...liveOverride } as PoolNode) : storeNode),
    [storeNode, liveOverride],
  )
  const liveTransform = useLiveTransforms((state) => state.get(storeNode.id as never))
  const renderPose = useMemo(() => getPoolRenderPose(node, liveTransform), [node, liveTransform])
  const movingPool = Boolean(liveTransform && (
    renderPose.position.some((value, index) => value !== storeNode.position[index]) ||
    renderPose.rotation.some((value, index) => value !== storeNode.rotation[index])
  ))
  nodeRef.current = node
  const inputDragging = useViewer((state) => state.inputDragging)
  const horizontalResizeInProgress = Boolean(
    liveOverride
    && !sectionPreviewInProgress
    && !('outlineTangents' in liveOverride)
    && ('length' in liveOverride || 'width' in liveOverride)
    && ('polygon' in liveOverride || 'outlineControlPoints' in liveOverride),
  )
  const depthResizeInProgress = Boolean(
    liveOverride && !sectionPreviewInProgress && ('depth' in liveOverride || 'shallowDepth' in liveOverride || 'deepDepth' in liveOverride),
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
  const connectedPipes = useScene(useShallow(
    (state) => horizontalResizeInProgress || movingPool
      ? selectPoolConnectedPipes(state.nodes, storeNode.id)
      : NO_CONNECTED_PIPES,
  ))
  useEffect(() => {
    if ((!horizontalResizeInProgress && !movingPool) || (genericChildren.length === 0 && connectedPipes.length === 0)) return
    const session = resizeSessionRef.current
    const sourcePool = session?.pool ?? storeNode
    const previewPool = { ...node, position: renderPose.position, rotation: renderPose.rotation }
    const entries: (readonly [string, Record<string, unknown>])[] = []
    if (horizontalResizeInProgress) genericChildren.forEach((child) => {
      const position = (child as unknown as { position: [number, number, number] }).position
      const initial = session?.positions.get(child.id) ?? position
      session?.positions.set(child.id, initial)
      entries.push([child.id, { position: getPoolChildResizePreviewPosition(sourcePool, node, initial) }])
    })
    connectedPipes.forEach((child) => {
      const candidate = child as unknown as { id: string; type: string; path?: [number, number, number][]; position?: [number, number, number]; rotation?: [number, number, number] }
      if (candidate.type === 'pipe-segment' && candidate.path) {
        entries.push([candidate.id, { path: getPoolLevelAttachedPath(sourcePool, previewPool, candidate.path) }])
      } else if (candidate.position) {
        entries.push([candidate.id, {
          position: getPoolLevelAttachedPosition(sourcePool, previewPool, candidate.position),
          ...(candidate.rotation ? { rotation: getPoolLevelAttachedRotation(sourcePool, previewPool, candidate.rotation) } : {}),
        }])
      }
    })
    useLiveNodeOverrides.getState().setMany(entries)
    return () => {
      for (const child of genericChildren) useLiveNodeOverrides.getState().clearFields(child.id, ['position'])
      for (const child of connectedPipes) useLiveNodeOverrides.getState().clearFields(child.id, ['path', 'position', 'rotation'])
    }
  }, [connectedPipes, genericChildren, horizontalResizeInProgress, movingPool, node, storeNode, renderPose.position, renderPose.rotation])
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
  // Section, settings and outline edits use a lightweight mesh. Native resize
  // handles reuse the committed mesh with inexpensive transforms.
  const geometrySourceNode = storeNode
  const geometrySignature = useMemo(
    () => getPoolGeometrySignature(geometrySourceNode),
    [geometrySourceNode],
  )
  const basinSignature = useMemo(() => getPoolGeometrySignature(geometrySourceNode, false), [geometrySourceNode])
  const geometryNode = useMemo(() => geometrySourceNode, [basinSignature])
  const copingNode = useMemo(() => geometrySourceNode, [geometrySignature])
  const sceneNodes = useMemo(() => Object.fromEntries([
    [geometryNode.id, geometryNode],
    ...relatedNodes.map((candidate) => [candidate.id, candidate] as const),
  ]), [geometryNode, relatedNodes])
  const spilloverEditInProgress = useLiveNodeOverrides((state) => relatedNodes.some((candidate) => {
    if (String(candidate.type) !== 'pool:spillover') return false
    const connection = candidate as unknown as { sourcePoolId?: string; targetPoolId?: string; id: string }
    return (connection.sourcePoolId === node.id || connection.targetPoolId === node.id) && Boolean(state.get(connection.id))
  }))
  const suppressSpilloverGeometry = spilloverEditInProgress
  const waterEffect = useMemo(
    () => new PoolWaterEffect(node, waterResolution, atmosphere),
    [node.id, node.waterQuality, waterResolution, atmosphere],
  )
  const pool = useMemo(() => {
    const connectionRegions = getPoolConnectionRegions(geometryNode, sceneNodes)
    return buildPoolGeometry(geometryNode, {
    skipCoping: true,
    overlaps: getPoolOverlaps(geometryNode, sceneNodes),
    // Live transforms can leave the committed connection endpoint briefly
    // stale. Hide its cuts during that frame; the committed sync rebuilds
    // them once the edit is released.
    spilloverNotches: suppressSpilloverGeometry
      ? []
      : getPoolSpilloverNotches(geometryNode, sceneNodes),
    removeWallRegions: connectionRegions,
    removeFloorRegions: connectionRegions,
    removeWaterRegions: connectionRegions,
    waterResolution,
    atmosphere,
    waterEffect,
  })
  }, [geometryNode, sceneNodes, suppressSpilloverGeometry, waterResolution, atmosphere, waterEffect])
  const coping = useMemo(() => buildPoolCopingGeometry(copingNode, {
    overlaps: getPoolOverlaps(copingNode, sceneNodes),
    spilloverNotches: suppressSpilloverGeometry ? [] : getPoolSpilloverNotches(copingNode, sceneNodes),
  }), [copingNode, sceneNodes, suppressSpilloverGeometry])
  const editPreview = useMemo(() => sectionPreviewInProgress ? buildPoolPlacementPreviewGeometry(node) : null, [sectionPreviewInProgress, node])
  useEffect(() => () => { if (editPreview) disposeObject3D(editPreview) }, [editPreview])
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
  const handlers = usePoolNodeHost(node, ref, `${geometrySignature}:${node.interiorFinish}`)
  useLayoutEffect(() => {
    if (updatePoolInteriorFinish(pool, node)) invalidate()
  }, [pool, node.interiorFinish, node.metadata, invalidate])
  useEffect(() => registerPoolWaterEffect(node.id, waterEffect), [node.id, waterEffect])
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
  const cameraSpaceWaterCenter = useRef(new Vector3())
  const distantWater = useRef(false)
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
    for (const layer of [pool, coping]) layer.traverse((child) => {
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
  }, [inputDragging, pool, coping])

  useFrame(({ camera, gl, invalidate }, delta) => {
    const root = ref.current
    if (!root || node.visible === false) return
    const immersiveXR = Boolean(
      (gl as unknown as { xr?: { isPresenting?: boolean } }).xr?.isPresenting,
    )
    root.updateWorldMatrix(true, false)
    viewProjection.current.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
    viewFrustum.current.setFromProjectionMatrix(viewProjection.current)
    worldWaterBounds.current.copy(localWaterBounds).applyMatrix4(root.matrixWorld)
    if (!viewFrustum.current.intersectsSphere(worldWaterBounds.current)) return
    cameraSpaceWaterCenter.current.copy(worldWaterBounds.current.center).applyMatrix4(camera.matrixWorldInverse)
    const projectedRadius = worldWaterBounds.current.radius * Math.abs(camera.projectionMatrix.elements[5] ?? 1)
      / ('isOrthographicCamera' in camera ? 1 : Math.max(0.01, -cameraSpaceWaterCenter.current.z))
    const diameterPixels = projectedRadius * (gl.domElement.clientHeight || gl.domElement.height)
    distantWater.current = diameterPixels < (distantWater.current ? 190 : 130)
    const water = pool.getObjectByName('pool-water') as Mesh | undefined
    if (water) {
      const nextMaterial = immersiveXR ? immersiveWaterMaterial
        : inputDragging || distantWater.current ? dragWaterMaterial : waterEffect.material
      if (water.material !== nextMaterial) water.material = nextMaterial
    }
    const animateWater = shouldAdvancePoolWater(
      immersiveXR,
      Boolean((gl as unknown as { isWebGPURenderer?: boolean }).isWebGPURenderer),
      inputDragging,
    )
    if (!animateWater || !animationActive || sectionPreviewInProgress) return
    waterEffect.update(gl as unknown as WebGPURenderer, delta, poolWaterSimulationHz(diameterPixels))
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

  useEffect(() => () => waterEffect.dispose(), [waterEffect])
  useEffect(
    () => () => {
      const disposedMaterials = new Set<Material>()
      pool.traverse((child) => {
        const mesh = child as Mesh
        if (!mesh.isMesh) return
        mesh.geometry.dispose()
        // Water materials are owned by their long-lived effects below.
        if (mesh.name === 'pool-water') return
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
        for (const material of materials as Material[]) {
          if (disposedMaterials.has(material)) continue
          material.dispose()
          disposedMaterials.add(material)
        }
      })
      const finishMaterials = pool.userData.finishMaterials as Map<string, Material> | undefined
      for (const material of finishMaterials?.values() ?? []) {
        if (!disposedMaterials.has(material)) material.dispose()
      }
    },
    [pool],
  )
  useEffect(() => () => {
    const materials = new Set<Material>()
    coping.traverse((child) => {
      const mesh = child as Mesh
      if (!mesh.isMesh) return
      mesh.geometry.dispose()
      for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        if (materials.has(material)) continue
        material.dispose()
        materials.add(material)
      }
    })
  }, [coping])

  return (
    <group
      ref={ref}
      position={renderPose.position}
      rotation={renderPose.rotation}
      visible={node.visible !== false}
      {...handlers}
    >
      <group
        visible={!sectionPreviewInProgress}
        position={resizePreviewTransform.position}
        scale={resizePreviewTransform.scale}
      >
        <primitive object={pool} />
        <primitive object={coping} />
      </group>
      {editPreview && <primitive object={editPreview} />}
      <AttachmentPoolContext.Provider value={storeNode}>{node.children?.map((childId) => (
        <NodeRenderer key={`${node.id}:${childId}`} nodeId={childId as never} />
      ))}</AttachmentPoolContext.Provider>
      {overlay?.(node)}
    </group>
  )
}
