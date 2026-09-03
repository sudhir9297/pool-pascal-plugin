'use client'

import { useViewer } from '@pascal-app/viewer'
import { runAsSingleSceneHistoryStep, useRegistry, useScene } from '@pascal-app/core'
import { swallowNextClick, triggerSFX, useEditor, useInteractionScope } from '@pascal-app/editor'
import { type ThreeEvent, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import { MeshStandardMaterial, Plane, Quaternion, Vector2, Vector3, type Group, type Material, type Mesh, type Ray } from 'three'
import { buildPipeGeometry } from '../core/geometry'
import { PoolPipeNode } from '../core/schema'
import { attachPipeNode, deletePipeEdge, mergePipeNetworksAtEndpoints, movePipeEndpointTo, movePipeNodeAcrossNetworks, syncAttachedPipeEndpoints, type PipeNetwork } from '../../design/pipe-network'
import { collectPoolPipePorts, findNearestPipePort } from '../design/ports'
import { getPipeGizmoDirections, getSelectedEdgeEndpointControls, getSelectedEdgeFittingControls } from './selection-controls'
import { usePipeEditStore } from './store'

const NO_RAYCAST = () => undefined

type PipePreviewController = {
  preview: (network: PoolPipeNode) => void
  reset: () => void
}

export const pipePreviewControllers = new Map<string, PipePreviewController>()

function disposePipeGroup(group: Group) {
  group.traverse((child) => {
    const mesh = child as Mesh
    if (!mesh.isMesh) return
    mesh.geometry.dispose()
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    for (const material of materials as Material[]) material.dispose()
  })
}

export default function PoolPipePreview({ node }: { node: PoolPipeNode }) {
  const rootRef = useRef<Group>(null!)
  const visualRef = useRef<Group>(null!)
  const sceneNodes = useScene((state) => state.nodes)
  const inputDragging = useViewer((state) => state.inputDragging)
  const setSelection = useViewer((state) => state.setSelection)
  const subSelection = usePipeEditStore((state) => state.subSelection)
  const setSubSelection = usePipeEditStore((state) => state.setSubSelection)
  const pipeToolActive = useEditor((state) => state.mode === 'build' && state.tool === 'pool:pipe-network')
  const selectedEdgeId = subSelection?.networkId === node.id && subSelection.element === 'edge'
    ? subSelection.elementId
    : null
  useRegistry(node.id, node.type, rootRef)

  useEffect(() => {
    // PVC is edited per segment. Never leave the host's whole-network
    // selection active, otherwise its outline pass wraps every connected
    // segment in a translucent cylinder.
    if (useViewer.getState().selection.selectedIds.includes(node.id)) {
      setSelection({ selectedIds: [] })
    }
  }, [node.id, setSelection])

  useEffect(() => {
    if (inputDragging || !node.attachments?.some((attachment) => attachment.kind === 'equipment')) return
    const pools = Object.values(sceneNodes).filter((candidate) => (candidate.type as string) === 'pool:pool') as never[]
    const ports = collectPoolPipePorts({ nodes: Object.values(sceneNodes), pools })
    const synced = syncAttachedPipeEndpoints(node as never, ports)
    if (synced === node) return
    useScene.getState().updateNode(node.id as never, {
      nodes: synced.nodes,
      edges: synced.edges,
      attachments: synced.attachments,
    } as never)
  }, [inputDragging, node, sceneNodes])
  const pipe = useMemo(() => {
    const group = buildPipeGeometry(node)
    if (!selectedEdgeId) return group
    group.traverse((child) => {
      const mesh = child as Mesh
      if (!mesh.isMesh || mesh.userData.pipeEdgeId !== selectedEdgeId) return
      const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material
      if (!(material instanceof MeshStandardMaterial)) return
      const selectedMaterial = material.clone()
      selectedMaterial.color.set('#91a4ff')
      selectedMaterial.emissive.set('#26366f')
      selectedMaterial.emissiveIntensity = 0.28
      mesh.material = selectedMaterial
    })
    return group
  }, [node, selectedEdgeId])

  useEffect(() => {
    const visual = visualRef.current
    if (!visual) return
    let previewFrameId = 0
    let pendingPreview: PoolPipeNode | null = null
    visual.clear()
    visual.add(pipe)
    const controller: PipePreviewController = {
      preview: (network) => {
        pendingPreview = network
        if (previewFrameId) return
        previewFrameId = window.requestAnimationFrame(() => {
          previewFrameId = 0
          const latest = pendingPreview
          pendingPreview = null
          if (!latest) return
          const next = buildPipeGeometry(latest)
          visual.clear()
          visual.add(next)
          // Do not dispose `previous` here. WebGPU post-processing can retain
          // a reference to a detached resource for more than one frame.
          // Destroying it during a drag poisons the command encoder.
        })
      },
      reset: () => {
        if (previewFrameId) window.cancelAnimationFrame(previewFrameId)
        previewFrameId = 0
        pendingPreview = null
        visual.clear()
        visual.add(pipe)
      },
    }
    pipePreviewControllers.set(node.id, controller)
    return () => {
      if (previewFrameId) window.cancelAnimationFrame(previewFrameId)
      pendingPreview = null
      if (pipePreviewControllers.get(node.id) === controller) pipePreviewControllers.delete(node.id)
      const current = visual.children[0] as Group | undefined
      visual.clear()
      if (current) {
        // The component owns this group. It is safe to dispose it after the
        // component has detached it; transient drag groups intentionally stay
        // alive until the WebGPU renderer releases them.
        window.requestAnimationFrame(() => {
          window.requestAnimationFrame(() => disposePipeGroup(current))
        })
      }
    }
  }, [node.id, pipe])

  useEffect(() => {
    const previousRaycasts = new Map<Mesh, Mesh['raycast']>()
    pipe.traverse((child) => {
      const mesh = child as Mesh
      if (!mesh.isMesh) return
      const originalRaycast = mesh.raycast
      previousRaycasts.set(mesh, originalRaycast)
      if (pipeToolActive) {
        mesh.raycast = NO_RAYCAST
        return
      }
      const edgeStart = mesh.userData.pipeEdgeStart as [number, number, number] | undefined
      const edgeEnd = mesh.userData.pipeEdgeEnd as [number, number, number] | undefined
      if (!edgeStart || !edgeEnd) return

      // Pick against the real pipe first. If the cursor narrowly misses it,
      // use a wider mathematical tolerance around the centerline. This adds
      // no mesh, material, outline, or visible cylinder to the scene.
      mesh.raycast = (raycaster, intersections) => {
        const countBefore = intersections.length
        originalRaycast.call(mesh, raycaster, intersections)
        if (intersections.length > countBefore || !rootRef.current) return

        const startWorld = rootRef.current.localToWorld(new Vector3(...edgeStart))
        const endWorld = rootRef.current.localToWorld(new Vector3(...edgeEnd))
        const pointOnRay = new Vector3()
        const pointOnPipe = new Vector3()
        const tolerance = Math.max(node.diameter * 2, 0.12)
        const distanceSq = raycaster.ray.distanceSqToSegment(startWorld, endWorld, pointOnRay, pointOnPipe)
        if (distanceSq > tolerance * tolerance) return
        const distance = raycaster.ray.origin.distanceTo(pointOnRay)
        if (distance < raycaster.near || distance > raycaster.far) return
        intersections.push({ distance, point: pointOnPipe, object: mesh })
      }
    })
    return () => {
      for (const [mesh, raycast] of previousRaycasts) mesh.raycast = raycast
    }
  }, [node.diameter, pipe, pipeToolActive])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        const selection = usePipeEditStore.getState().subSelection
        if (selection?.networkId === node.id) setSubSelection(null)
        return
      }
      if (event.key !== 'Delete' && event.key !== 'Backspace') return
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || (event.target instanceof HTMLElement && event.target.isContentEditable)) return
      const selection = usePipeEditStore.getState().subSelection
      if (selection?.networkId !== node.id || selection.element !== 'edge') return
      const current = useScene.getState().nodes[node.id as never] as unknown as PoolPipeNode | undefined
      if (!current || !current.edges.some((edge) => edge.id === selection.elementId)) return
      event.preventDefault()
      event.stopPropagation()
      const updated = deletePipeEdge(current as unknown as PipeNetwork, selection.elementId)
      if (updated.edges.length === 0) useScene.getState().deleteNode(node.id as never)
      else useScene.getState().updateNode(node.id as never, {
        nodes: updated.nodes,
        edges: updated.edges,
        attachments: updated.attachments,
      } as never)
      triggerSFX('sfx:structure-delete')
      setSubSelection(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [node.id, setSubSelection])

  const selectPipeEdge = (event: ThreeEvent<MouseEvent>) => {
    if (pipeToolActive || event.button !== 0) return
    const edgeId = event.object.userData.pipeEdgeId
    if (typeof edgeId !== 'string') return
    event.stopPropagation()
    event.nativeEvent.stopPropagation()
    event.nativeEvent.stopImmediatePropagation()
    swallowNextClick()
    setSubSelection(selectedEdgeId === edgeId
      ? null
      : { networkId: node.id, element: 'edge', elementId: edgeId })
    setSelection({ selectedIds: [] })
  }

  return (
    <group
      position={node.position}
      ref={rootRef}
      rotation={node.rotation}
    >
      <group ref={visualRef}>
        <primitive
          object={pipe}
          onClick={selectPipeEdge}
          onPointerMissed={(event: MouseEvent) => {
            if (event.button !== 0) return
            if (usePipeEditStore.getState().subSelection?.networkId === node.id) setSubSelection(null)
          }}
        />
      </group>
      {!pipeToolActive && selectedEdgeId && (
        <OpenEndpointHandles node={node} rootRef={rootRef} selectedEdgeId={selectedEdgeId} />
      )}
    </group>
  )
}

export function OpenEndpointHandles({
  node,
  rootRef,
  selectedEdgeId,
}: {
  node: PoolPipeNode
  rootRef: { current: Group | null }
  selectedEdgeId: string
}) {
  const [activeEndpointId, setActiveEndpointId] = useState<string | null>(null)
  const endpointControls = useMemo(
    () => getSelectedEdgeEndpointControls(node, selectedEdgeId),
    [node, selectedEdgeId],
  )
  const fittingControls = useMemo(
    () => getSelectedEdgeFittingControls(node, selectedEdgeId),
    [node, selectedEdgeId],
  )

  useEffect(() => setActiveEndpointId(null), [selectedEdgeId])

  return (
    <group>
      {endpointControls.map((control) => {
          const direction = new Vector3(...control.direction)
          const plusQuaternion = new Quaternion().setFromUnitVectors(
            new Vector3(0, 0, 1),
            direction,
          )
          return (
            <group
              key={control.endpointId}
              position={control.position}
              userData={{ pipeControl: true }}
            >
              <EndpointGizmoTrigger
                active={activeEndpointId === control.endpointId}
                onToggle={() => setActiveEndpointId((current) => current === control.endpointId ? null : control.endpointId)}
              />
              {activeEndpointId === control.endpointId && (
                <PipePivotGizmo endpointId={control.endpointId} network={node} rootRef={rootRef} />
              )}
              <group
                position={[direction.x * 0.42, direction.y * 0.42, direction.z * 0.42]}
                quaternion={[plusQuaternion.x, plusQuaternion.y, plusQuaternion.z, plusQuaternion.w]}
                onPointerDown={(event) => {
                  event.stopPropagation()
                  event.nativeEvent.stopPropagation()
                  event.nativeEvent.stopImmediatePropagation()
                  swallowNextClick()
                  usePipeEditStore.getState().beginExtension({ networkId: node.id, endpointId: control.endpointId })
                  useEditor.getState().setTool('pool:pipe-network')
                  useEditor.getState().setMode('build')
                }}
                onPointerUp={(event) => {
                  event.stopPropagation()
                  event.nativeEvent.stopImmediatePropagation()
                }}
              >
                <mesh frustumCulled={false} userData={{ pipeControl: true }}>
                  <boxGeometry args={[0.16, 0.045, 0.045]} />
                  <meshStandardMaterial color="#8381ed" roughness={0.34} depthTest depthWrite />
                </mesh>
                <mesh frustumCulled={false} userData={{ pipeControl: true }}>
                  <boxGeometry args={[0.045, 0.045, 0.16]} />
                  <meshStandardMaterial color="#8381ed" roughness={0.34} depthTest depthWrite />
                </mesh>
              </group>
            </group>
          )
      })}
      {fittingControls.map((control) => (
        <PipeFittingHandle
          key={control.nodeId}
          node={node}
          nodeId={control.nodeId}
          position={control.position}
          rootRef={rootRef}
        />
      ))}
    </group>
  )
}

function PipeFittingHandle({
  node,
  nodeId,
  position,
  rootRef,
}: {
  node: PoolPipeNode
  nodeId: string
  position: [number, number, number]
  rootRef: { current: Group | null }
}) {
  const [hovered, setHovered] = useState(false)
  const [displayPosition, setDisplayPosition] = useState(position)
  const handleRef = useRef<Group>(null)
  const dragging = useRef(false)
  const pointerId = useRef<number | null>(null)
  const startWorld = useRef(new Vector3())
  const dragPlane = useRef(new Plane())
  const startNetwork = useRef(node)
  const previewNetworks = useRef<PoolPipeNode[]>([])
  const { camera, gl, raycaster } = useThree()
  const radius = Math.max(node.diameter * 1.35, 0.075)

  useFrame(() => {
    const handle = handleRef.current
    if (!handle) return
    const parent = handle.parent
    if (!parent) return
    const parentWorld = new Quaternion()
    parent.getWorldQuaternion(parentWorld)
    handle.quaternion.copy(parentWorld.invert().multiply(camera.quaternion))
  })

  useEffect(() => {
    const finish = () => {
      if (!dragging.current) return
      dragging.current = false
      pointerId.current = null
      for (const preview of previewNetworks.current) {
        useScene.getState().updateNode(preview.id as never, {
          nodes: preview.nodes,
          edges: preview.edges,
          attachments: preview.attachments,
        } as never)
        pipePreviewControllers.get(preview.id)?.reset()
      }
      previewNetworks.current = []
      useViewer.getState().setInputDragging(false)
      useScene.temporal.getState().resume()
      useInteractionScope.getState().endIf((scope) => scope.kind === 'handle-drag' && scope.handle === `pipe-fitting-${nodeId}`)
    }
    const cancel = () => {
      if (!dragging.current) return
      dragging.current = false
      pointerId.current = null
      setDisplayPosition(position)
      for (const preview of previewNetworks.current) pipePreviewControllers.get(preview.id)?.reset()
      previewNetworks.current = []
      useViewer.getState().setInputDragging(false)
      useScene.temporal.getState().resume()
      useInteractionScope.getState().endIf((scope) => scope.kind === 'handle-drag' && scope.handle === `pipe-fitting-${nodeId}`)
    }
    const move = (event: PointerEvent) => {
      if (!dragging.current || event.pointerId !== pointerId.current || !rootRef.current) return
      const rect = gl.domElement.getBoundingClientRect()
      raycaster.setFromCamera(new Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1,
      ), camera)
      const hit = raycaster.ray.intersectPlane(dragPlane.current, new Vector3())
      if (!hit) return
      const local = rootRef.current.worldToLocal(hit)
      const delta: [number, number, number] = [
        local.x - position[0],
        local.y - position[1],
        local.z - position[2],
      ]
      const pipes = Object.values(useScene.getState().nodes)
        .filter((candidate) => (candidate.type as string) === 'pool:pipe-network') as unknown as PoolPipeNode[]
      const updated = movePipeNodeAcrossNetworks(pipes as unknown as PipeNetwork[], node.id, nodeId, delta) as unknown as PoolPipeNode[]
      previewNetworks.current = updated
      const activeNetwork = updated.find((candidate) => candidate.id === node.id)
      const activeNode = activeNetwork?.nodes.find((candidate) => candidate.id === nodeId)
      if (activeNode) setDisplayPosition([...activeNode.position])
      for (const preview of updated) pipePreviewControllers.get(preview.id)?.preview(preview)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', finish)
    window.addEventListener('pointercancel', cancel)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', finish)
      window.removeEventListener('pointercancel', cancel)
    }
  }, [camera, gl, node, nodeId, position, raycaster, rootRef])

  return (
    <group ref={handleRef} position={displayPosition} renderOrder={40}>
      <mesh
        renderOrder={1300}
        onPointerDown={(event) => {
          if (event.button !== 0 || !rootRef.current) return
          event.stopPropagation()
          event.nativeEvent.stopPropagation()
          event.nativeEvent.stopImmediatePropagation()
          swallowNextClick()
          rootRef.current.updateMatrixWorld(true)
          startWorld.current.set(...position).applyMatrix4(rootRef.current.matrixWorld)
          dragPlane.current.set(new Vector3(0, 1, 0), -startWorld.current.y)
          startNetwork.current = node
          previewNetworks.current = []
          setDisplayPosition(position)
          dragging.current = true
          pointerId.current = event.pointerId
          useViewer.getState().setInputDragging(true)
          useScene.temporal.getState().pause()
          useInteractionScope.getState().begin({ kind: 'handle-drag', nodeId: node.id, handle: `pipe-fitting-${nodeId}` })
        }}
        onPointerEnter={(event) => { event.stopPropagation(); setHovered(true) }}
        onPointerLeave={(event) => { event.stopPropagation(); setHovered(false) }}
      >
        <circleGeometry args={[radius, 6]} />
        <meshBasicMaterial color="#8381ed" transparent opacity={hovered ? 1 : 0} depthTest={false} depthWrite={false} />
      </mesh>
      <mesh raycast={() => null} renderOrder={1301}>
        <circleGeometry args={[radius, 6]} />
        <meshBasicMaterial color="#8381ed" transparent opacity={hovered ? 0.95 : 0.8} depthTest={false} depthWrite={false} />
      </mesh>
      <mesh raycast={() => null} renderOrder={1302}>
        <ringGeometry args={[radius, radius * 1.18, 6]} />
        <meshBasicMaterial color="#8381ed" depthTest={false} depthWrite={false} />
      </mesh>
    </group>
  )
}

function EndpointGizmoTrigger({
  active,
  onToggle,
}: {
  active: boolean
  onToggle: () => void
}) {
  const onPointerDown = usePipeTap(onToggle)
  const [hovered, setHovered] = useState(false)
  if (active) return null

  return (
    <group userData={{ pipeControl: true, pipeDragHandle: false }}>
      <mesh
        frustumCulled={false}
        onPointerDown={onPointerDown}
        onPointerEnter={(event) => {
          event.stopPropagation()
          setHovered(true)
          document.body.style.cursor = 'grab'
        }}
        onPointerLeave={(event) => {
          event.stopPropagation()
          setHovered(false)
          if (document.body.style.cursor === 'grab') document.body.style.cursor = ''
        }}
        scale={hovered ? 1.08 : 1}
      >
        <boxGeometry args={[0.08, 0.08, 0.08]} />
        <meshStandardMaterial color="#8381ed" roughness={0.34} depthTest depthWrite />
      </mesh>
    </group>
  )
}

/**
 * A tap-only handle gesture. Endpoint cubes must never arm the editor's
 * selected-object move gesture; they only latch the gizmo open or closed.
 * This mirrors the editor's shared tap path while keeping the plugin on the
 * public editor API surface.
 */
function usePipeTap(onTap: () => void) {
  const onTapRef = useRef(onTap)
  const cleanupRef = useRef<(() => void) | null>(null)
  onTapRef.current = onTap

  useEffect(() => () => cleanupRef.current?.(), [])

  return (event: ThreeEvent<PointerEvent>) => {
    if (event.button !== 0) return
    event.stopPropagation()
    event.nativeEvent.stopPropagation()
    event.nativeEvent.stopImmediatePropagation()
    cleanupRef.current?.()

    useInteractionScope.getState().begin({
      kind: 'handle-drag',
      nodeId: 'pool:pipe-network-control',
      handle: 'pipe-endpoint-toggle',
    })

    const pointerId = event.nativeEvent.pointerId
    const previousInputDragging = useViewer.getState().inputDragging
    useViewer.getState().setInputDragging(true)
    swallowNextClick()
    onTapRef.current()

    const restore = (endEvent?: PointerEvent) => {
      if (endEvent && endEvent.pointerId !== pointerId) return
      useViewer.getState().setInputDragging(previousInputDragging)
      useInteractionScope.getState().endIf((scope) =>
        scope.kind === 'handle-drag' && scope.handle === 'pipe-endpoint-toggle',
      )
      window.removeEventListener('pointerup', restore)
      window.removeEventListener('pointercancel', restore)
      window.removeEventListener('blur', onBlur)
      cleanupRef.current = null
    }
    const onBlur = () => restore()
    cleanupRef.current = () => restore()
    window.addEventListener('pointerup', restore)
    window.addEventListener('pointercancel', restore)
    window.addEventListener('blur', onBlur)
  }
}

function PipePivotGizmo({
  endpointId,
  network,
  rootRef,
}: {
  endpointId: string
  network: PoolPipeNode
  rootRef: { current: Group | null }
}) {
  const gizmoRef = useRef<Group>(null)
  const { camera, size } = useThree()
  const endpoint = network.nodes.find((candidate) => candidate.id === endpointId)
  const connectedEdge = network.edges.find((edge) => edge.from === endpointId || edge.to === endpointId)
  const neighborId = connectedEdge
    ? connectedEdge.from === endpointId ? connectedEdge.to : connectedEdge.from
    : null
  const neighbor = neighborId ? network.nodes.find((candidate) => candidate.id === neighborId) : null
  const outward = endpoint && neighbor
    ? new Vector3(
        endpoint.position[0] - neighbor.position[0],
        endpoint.position[1] - neighbor.position[1],
        endpoint.position[2] - neighbor.position[2],
      ).normalize()
    : new Vector3(1, 0, 0)
  const directions = getPipeGizmoDirections([outward.x, outward.y, outward.z])

  useFrame(() => {
    const gizmo = gizmoRef.current
    if (!gizmo || !gizmo.parent || size.height <= 0) return

    const anchorWorld = gizmo.parent.getWorldPosition(new Vector3())
    let visibleWorldHeight: number
    if ('isOrthographicCamera' in camera && camera.isOrthographicCamera) {
      visibleWorldHeight = (camera.top - camera.bottom) / camera.zoom
    } else if ('isPerspectiveCamera' in camera && camera.isPerspectiveCamera) {
      const distance = camera.getWorldPosition(new Vector3()).distanceTo(anchorWorld)
      visibleWorldHeight = 2 * distance * Math.tan((camera.fov * Math.PI) / 360)
    } else {
      return
    }

    // Keep the arrows readable at every zoom while preserving normal scene
    // depth. The authored arrow is 0.48 m long; scale it to about 42 px.
    const worldUnitsPerPixel = visibleWorldHeight / size.height
    const scale = Math.min(3.5, Math.max(0.85, (worldUnitsPerPixel * 42) / 0.48))
    const clearance = Math.max(network.diameter * 0.75, 0.035) + 0.06 * scale
    gizmo.scale.setScalar(scale)
    gizmo.position.set(
      outward.x * clearance,
      outward.y * clearance,
      outward.z * clearance,
    )
  })

  if (!endpoint) return null

  return (
    <group ref={gizmoRef}>
      <PipeGizmoAxis color="#ff2060" axis="x" direction={directions.red} endpoint={endpoint} endpointId={endpointId} network={network} rootRef={rootRef} />
      <PipeGizmoAxis color="#20df80" axis="y" direction={directions.green} endpoint={endpoint} endpointId={endpointId} network={network} rootRef={rootRef} />
      <PipeGizmoAxis color="#2080ff" axis="z" direction={directions.blue} endpoint={endpoint} endpointId={endpointId} network={network} rootRef={rootRef} />
    </group>
  )
}

function PipeGizmoAxis({
  color,
  axis,
  direction,
  endpoint,
  endpointId,
  network,
  rootRef,
}: {
  color: string
  axis: 'x' | 'y' | 'z'
  direction: [number, number, number]
  endpoint: PoolPipeNode['nodes'][number]
  endpointId: string
  network: PoolPipeNode
  rootRef: { current: Group | null }
}) {
  const quaternion = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), new Vector3(...direction).normalize())
  return (
    <PipeAxisHandle axis={axis} direction={direction} endpoint={endpoint} endpointId={endpointId} network={network} rootRef={rootRef}>
      <group quaternion={quaternion}>
      <mesh position={[0, 0.2, 0]} frustumCulled={false}>
        <cylinderGeometry args={[0.018, 0.018, 0.38, 8]} />
        <meshStandardMaterial color={color} roughness={0.3} depthTest depthWrite />
      </mesh>
      <mesh position={[0, 0.42, 0]} frustumCulled={false}>
        <coneGeometry args={[0.055, 0.12, 12]} />
        <meshStandardMaterial color={color} roughness={0.3} depthTest depthWrite />
      </mesh>
      </group>
    </PipeAxisHandle>
  )
}

function closestAxisParameterToRay(origin: Vector3, axis: Vector3, ray: Ray) {
  const offset = ray.origin.clone().sub(origin)
  const axisRayDot = axis.dot(ray.direction)
  const denominator = Math.max(1e-6, 1 - axisRayDot * axisRayDot)
  // Solve the closest-points equations with the axis parameter increasing in
  // the same direction as the rendered arrow. The previous sign inversion
  // made dragging toward every arrow shorten the endpoint.
  return (axis.dot(offset) - axisRayDot * ray.direction.dot(offset)) / denominator
}

function PipeAxisHandle({
  axis,
  direction,
  endpoint,
  endpointId,
  network,
  rootRef,
  children,
}: {
  axis: 'x' | 'y' | 'z'
  direction: [number, number, number]
  endpoint: PoolPipeNode['nodes'][number]
  endpointId: string
  network: PoolPipeNode
  rootRef: { current: Group | null }
  children: React.ReactNode
}) {
  const startParameter = useRef(0)
  const startOrigin = useRef(new Vector3())
  const worldAxis = useRef(new Vector3())
  const startLocalPosition = useRef(new Vector3())
  const startNetwork = useRef(network)
  const previewNetwork = useRef<PoolPipeNode | null>(null)
  const detachedRef = useRef(false)
  const dragging = useRef(false)
  const cleanupDrag = useRef<(() => void) | null>(null)
  const finishDragRef = useRef<((commit: boolean) => void) | null>(null)
  const { camera, gl, raycaster } = useThree()
  const axisVector = new Vector3(...direction).normalize()

  useEffect(() => () => {
    cleanupDrag.current?.()
    if (!dragging.current) return
    dragging.current = false
    useViewer.getState().setInputDragging(false)
    useScene.temporal.getState().resume()
  }, [])

  const updateEndpoint = (ray: Ray, detached = false) => {
    const root = rootRef.current
    if (!root) return
    const parameter = closestAxisParameterToRay(startOrigin.current, worldAxis.current, ray)
    const worldPosition = startOrigin.current.clone().addScaledVector(worldAxis.current, parameter - startParameter.current)
    const localPosition = root.worldToLocal(worldPosition)
    const updated = movePipeEndpointTo(
      startNetwork.current,
      endpointId,
      [localPosition.x, localPosition.y, localPosition.z],
      { detach: detached },
    )
    const preview = updated as unknown as PoolPipeNode
    previewNetwork.current = preview
    pipePreviewControllers.get(network.id)?.preview(preview)
  }

  return (
    <group
      onPointerDown={(event) => {
        if (event.button !== 0 || !rootRef.current) return
        event.stopPropagation()
        event.nativeEvent.stopPropagation()
        event.nativeEvent.stopImmediatePropagation()
        swallowNextClick()
        useInteractionScope.getState().begin({
          kind: 'handle-drag',
          nodeId: network.id,
          handle: `pipe-axis-${axis}`,
        })
        rootRef.current.updateMatrixWorld(true)
        startLocalPosition.current.set(...endpoint.position)
        startNetwork.current = network
        previewNetwork.current = null
        detachedRef.current = event.altKey
        startOrigin.current.set(...endpoint.position).applyMatrix4(rootRef.current.matrixWorld)
        worldAxis.current.copy(axisVector).transformDirection(rootRef.current.matrixWorld).normalize()
        startParameter.current = closestAxisParameterToRay(startOrigin.current, worldAxis.current, event.ray)
        dragging.current = true
        useViewer.getState().setInputDragging(true)
        useScene.temporal.getState().pause()

        const updateRay = (clientX: number, clientY: number, detached = false) => {
          const rect = gl.domElement.getBoundingClientRect()
          const ndc = new Vector2(
            ((clientX - rect.left) / rect.width) * 2 - 1,
            -((clientY - rect.top) / rect.height) * 2 + 1,
          )
          raycaster.setFromCamera(ndc, camera)
          updateEndpoint(raycaster.ray, detached)
        }
        const onPointerMove = (moveEvent: PointerEvent) => {
          if (moveEvent.pointerId !== event.pointerId) return
          moveEvent.preventDefault()
          detachedRef.current = moveEvent.altKey
          updateRay(moveEvent.clientX, moveEvent.clientY, detachedRef.current)
        }
        const finishDrag = (endEvent?: PointerEvent, commit = true) => {
          if (endEvent && endEvent.pointerId !== event.pointerId) return
          window.removeEventListener('pointermove', onPointerMove)
          window.removeEventListener('pointerup', finishDrag)
          window.removeEventListener('pointercancel', cancelDrag)
          cleanupDrag.current = null
          finishDragRef.current = null
          if (!dragging.current) return
          if (commit && previewNetwork.current) {
            let committedNetwork = previewNetwork.current
            const finalEndpoint = committedNetwork.nodes.find((candidate) => candidate.id === endpointId)
            if (finalEndpoint) {
              const sceneNodes = Object.values(useScene.getState().nodes)
              const pools = sceneNodes.filter((candidate) => (candidate.type as string) === 'pool:pool') as never[]
              const ports = collectPoolPipePorts({ nodes: sceneNodes, pools })
                .filter((port) => port.ownerId !== network.id)
              const snapPort = findNearestPipePort(finalEndpoint.position, ports, 0.4)
              if (snapPort) {
                if (snapPort.kind === 'pipe-endpoint') {
                  const targetNode = useScene.getState().nodes[snapPort.ownerId as never]
                  const targetNetwork = targetNode ? PoolPipeNode.safeParse(targetNode) : null
                  const targetEndpointId = snapPort.id.slice(snapPort.id.lastIndexOf(':') + 1)
        if (targetNetwork?.success) {
          committedNetwork = movePipeEndpointTo(
            committedNetwork as never,
            endpointId,
            snapPort.position,
          ) as never
          committedNetwork = mergePipeNetworksAtEndpoints(
                      committedNetwork as never,
                      targetNetwork.data as never,
                      endpointId,
                      targetEndpointId,
                    ) as never
                    useScene.getState().deleteNode(snapPort.ownerId as never)
                  }
                } else if (snapPort.kind === 'equipment') {
                  committedNetwork = movePipeEndpointTo(
                    committedNetwork as never,
                    endpointId,
                    snapPort.position,
                  ) as never
                  committedNetwork = attachPipeNode(committedNetwork as never, endpointId, {
                    ownerId: snapPort.ownerId,
                    portId: snapPort.id,
                    kind: 'equipment',
                  }) as never
                }
              }
            }
            runAsSingleSceneHistoryStep(useScene, () => {
              useScene.getState().updateNode(
                network.id as never,
                {
                  nodes: committedNetwork.nodes,
                  edges: committedNetwork.edges,
                  attachments: committedNetwork.attachments,
                } as never,
              )
            })
          }
          pipePreviewControllers.get(network.id)?.reset()
          previewNetwork.current = null
          dragging.current = false
          useViewer.getState().setInputDragging(false)
          useScene.temporal.getState().resume()
          useInteractionScope.getState().endIf((scope) =>
            scope.kind === 'handle-drag' && scope.nodeId === network.id && scope.handle === `pipe-axis-${axis}`,
          )
          swallowNextClick()
        }
        const cancelDrag = (cancelEvent?: PointerEvent) => finishDrag(cancelEvent, false)
        finishDragRef.current = (commit) => finishDrag(undefined, commit)
        cleanupDrag.current = () => finishDrag(undefined, false)
        window.addEventListener('pointermove', onPointerMove)
        window.addEventListener('pointerup', finishDrag)
        window.addEventListener('pointercancel', cancelDrag)
      }}
      onPointerUp={(event) => {
        if (!dragging.current) return
        event.stopPropagation()
        event.nativeEvent.stopImmediatePropagation()
        // Pointer-up commits the transient mesh preview exactly once. The
        // window-level cancel/blur paths use cleanupDrag and never commit.
        finishDragRef.current?.(true)
      }}
      onPointerCancel={(event) => {
        if (!dragging.current) return
        event.stopPropagation()
        cleanupDrag.current?.()
      }}
    >
      {children}
    </group>
  )
}
