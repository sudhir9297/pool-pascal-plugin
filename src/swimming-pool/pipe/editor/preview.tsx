'use client'

import { useNodeEvents, useViewer } from '@pascal-app/viewer'
import { runAsSingleSceneHistoryStep, useRegistry, useScene, type AnyNode } from '@pascal-app/core'
import { swallowNextClick, useEditor, useInteractionScope } from '@pascal-app/editor'
import { type ThreeEvent, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Quaternion, Vector2, Vector3, type Group, type Material, type Mesh, type Ray } from 'three'
import { buildPipeGeometry } from '../core/geometry'
import { PoolPipeNode } from '../core/schema'
import { attachPipeNode, mergePipeNetworksAtEndpoints, movePipeEndpointTo, syncAttachedPipeEndpoints } from '../../design/pipe-network'
import { collectPoolPipePorts, findNearestPipePort } from '../design/ports'
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
  const handlers = useNodeEvents(node as unknown as AnyNode, node.type as never)
  const sceneNodes = useScene((state) => state.nodes)
  const inputDragging = useViewer((state) => state.inputDragging)
  const pipeToolActive = useEditor((state) => state.mode === 'build' && state.tool === 'pool:pipe-network')
  useRegistry(node.id, node.type, rootRef)

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
    return buildPipeGeometry(node)
  }, [node])

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
    let previewFrameId = 0
    let pendingPreview: PoolPipeNode | null = null
    const previousRaycasts = new Map<Mesh, Mesh['raycast']>()
    pipe.traverse((child) => {
      const mesh = child as Mesh
      if (!mesh.isMesh) return
      previousRaycasts.set(mesh, mesh.raycast)
      if (pipeToolActive) mesh.raycast = NO_RAYCAST
    })
    return () => {
      for (const [mesh, raycast] of previousRaycasts) mesh.raycast = raycast
    }
  }, [pipe, pipeToolActive])

  return (
    <group
      position={node.position}
      ref={rootRef}
      rotation={node.rotation}
      {...(pipeToolActive ? {} : handlers)}
    >
      <group ref={visualRef} />
    </group>
  )
}

export function OpenEndpointHandles({
  node,
  rootRef,
}: {
  node: PoolPipeNode
  rootRef: { current: Group | null }
}) {
  const [activeEndpointId, setActiveEndpointId] = useState<string | null>(null)
  const degreeByNode = new Map<string, number>()
  for (const edge of node.edges) {
    degreeByNode.set(edge.from, (degreeByNode.get(edge.from) ?? 0) + 1)
    degreeByNode.set(edge.to, (degreeByNode.get(edge.to) ?? 0) + 1)
  }

  return (
    <group>
      {node.nodes
        .filter((pipeNode) => pipeNode.kind === 'endpoint' && degreeByNode.get(pipeNode.id) === 1)
        .map((pipeNode) => {
          const edge = node.edges.find((candidate) => candidate.from === pipeNode.id || candidate.to === pipeNode.id)
          const neighborId = edge?.from === pipeNode.id ? edge.to : edge?.from
          const neighbor = node.nodes.find((candidate) => candidate.id === neighborId)
          if (!neighbor) return null
          const direction = new Vector3(
            pipeNode.position[0] - neighbor.position[0],
            pipeNode.position[1] - neighbor.position[1],
            pipeNode.position[2] - neighbor.position[2],
          ).normalize()
          const plusQuaternion = new Quaternion().setFromUnitVectors(
            new Vector3(0, 0, 1),
            direction,
          )
          return (
            <group
              key={pipeNode.id}
              position={pipeNode.position}
              userData={{ pipeControl: true }}
            >
              <EndpointGizmoTrigger
                active={activeEndpointId === pipeNode.id}
                onToggle={() => setActiveEndpointId((current) => current === pipeNode.id ? null : pipeNode.id)}
              />
              {activeEndpointId === pipeNode.id && (
                <PipePivotGizmo endpointId={pipeNode.id} network={node} rootRef={rootRef} />
              )}
              <group
                position={[direction.x * 0.42, direction.y * 0.42, direction.z * 0.42]}
                quaternion={[plusQuaternion.x, plusQuaternion.y, plusQuaternion.z, plusQuaternion.w]}
                onPointerDown={(event) => {
                  event.stopPropagation()
                  event.nativeEvent.stopPropagation()
                  event.nativeEvent.stopImmediatePropagation()
                  swallowNextClick()
                  usePipeEditStore.getState().beginExtension({ networkId: node.id, endpointId: pipeNode.id })
                  useEditor.getState().setTool('pool:pipe-network')
                  useEditor.getState().setMode('build')
                }}
                onPointerUp={(event) => {
                  event.stopPropagation()
                  event.nativeEvent.stopImmediatePropagation()
                }}
              >
                <mesh frustumCulled={false} renderOrder={10} userData={{ pipeControl: true }}>
                  <boxGeometry args={[0.2, 0.06, 0.06]} />
                  <meshBasicMaterial color="#8381ed" depthTest={false} depthWrite={false} opacity={0.85} transparent />
                </mesh>
                <mesh frustumCulled={false} renderOrder={10} userData={{ pipeControl: true }}>
                  <boxGeometry args={[0.06, 0.06, 0.2]} />
                  <meshBasicMaterial color="#8381ed" depthTest={false} depthWrite={false} opacity={0.85} transparent />
                </mesh>
              </group>
            </group>
          )
        })}
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

  return (
    <group userData={{ pipeControl: true, pipeDragHandle: false }}>
      {/* Keep the endpoint toggle hit-target available without rendering the
          editor's purple drag arrow. The visible controls are the neutral
          endpoint pivot/extension controls rendered by this plugin. */}
      <mesh onPointerDown={onPointerDown} frustumCulled={false} renderOrder={30}>
        <sphereGeometry args={[0.16, 12, 8]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} depthTest={false} />
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
  const endpoint = network.nodes.find((candidate) => candidate.id === endpointId)
  if (!endpoint) return null

  const connectedEdge = network.edges.find((edge) => edge.from === endpointId || edge.to === endpointId)
  const neighborId = connectedEdge
    ? connectedEdge.from === endpointId ? connectedEdge.to : connectedEdge.from
    : null
  const neighbor = neighborId ? network.nodes.find((candidate) => candidate.id === neighborId) : null
  const outward = neighbor
    ? new Vector3(
        endpoint.position[0] - neighbor.position[0],
        endpoint.position[1] - neighbor.position[1],
        endpoint.position[2] - neighbor.position[2],
      ).normalize()
    : new Vector3(1, 0, 0)
  const dominantAxis = Math.abs(outward.x) >= Math.abs(outward.y) && Math.abs(outward.x) >= Math.abs(outward.z)
    ? 'x'
    : Math.abs(outward.y) >= Math.abs(outward.z) ? 'y' : 'z'
  const axisSign = (value: number): 1 | -1 => value < 0 ? -1 : 1
  const outwardSign: 1 | -1 = dominantAxis === 'x'
    ? axisSign(outward.x)
    : dominantAxis === 'y'
      ? axisSign(outward.y)
      : axisSign(outward.z)

  return (
    <group scale={0.72}>
      <mesh frustumCulled={false} renderOrder={1300} raycast={() => null}>
        <sphereGeometry args={[0.09, 16, 12]} />
        <meshBasicMaterial color="#ffff40" depthTest={false} depthWrite={false} />
      </mesh>
      {/* The cylinder is authored along +Y; this rotation makes the red
          arrow point along +X, matching the drag axis below. */}
      <PipeGizmoAxis color="#ff2060" axis="x" directionSign={dominantAxis === 'x' ? outwardSign : 1} rotation={[0, 0, Math.PI / 2]} endpoint={endpoint} endpointId={endpointId} network={network} rootRef={rootRef} />
      <PipeGizmoAxis color="#20df80" axis="y" directionSign={dominantAxis === 'y' ? outwardSign : 1} endpoint={endpoint} endpointId={endpointId} network={network} rootRef={rootRef} />
      <PipeGizmoAxis color="#2080ff" axis="z" directionSign={dominantAxis === 'z' ? outwardSign : 1} rotation={[Math.PI / 2, 0, 0]} endpoint={endpoint} endpointId={endpointId} network={network} rootRef={rootRef} />
    </group>
  )
}

function PipeGizmoAxis({
  color,
  axis,
  directionSign = 1,
  endpoint,
  endpointId,
  network,
  rootRef,
  rotation = [0, 0, 0],
}: {
  color: string
  axis: 'x' | 'y' | 'z'
  directionSign?: 1 | -1
  endpoint: PoolPipeNode['nodes'][number]
  endpointId: string
  network: PoolPipeNode
  rootRef: { current: Group | null }
  rotation?: [number, number, number]
}) {
  return (
    <PipeAxisHandle axis={axis} directionSign={directionSign} endpoint={endpoint} endpointId={endpointId} network={network} rootRef={rootRef}>
      <group rotation={rotation} scale={[1, directionSign, 1]}>
      <mesh position={[0, 0.2, 0]} frustumCulled={false} renderOrder={1300}>
        <cylinderGeometry args={[0.018, 0.018, 0.38, 8]} />
        <meshBasicMaterial color={color} depthTest={false} depthWrite={false} />
      </mesh>
      <mesh position={[0, 0.42, 0]} frustumCulled={false} renderOrder={1300}>
        <coneGeometry args={[0.055, 0.12, 12]} />
        <meshBasicMaterial color={color} depthTest={false} depthWrite={false} />
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
  directionSign = 1,
  endpoint,
  endpointId,
  network,
  rootRef,
  children,
}: {
  axis: 'x' | 'y' | 'z'
  directionSign?: 1 | -1
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
  const axisVector = (axis === 'x' ? new Vector3(1, 0, 0) : axis === 'y' ? new Vector3(0, 1, 0) : new Vector3(0, 0, 1)).multiplyScalar(directionSign)

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
