'use client'

import { sceneRegistry, useScene, type AnyNodeId } from '@pascal-app/core'
import { isGridSnapActive, swallowNextClick, useEditor } from '@pascal-app/editor'
import { useViewer } from '@pascal-app/viewer'
import { createPortal, useThree } from '@react-three/fiber'
import { useEffect, useRef, useState } from 'react'
import { Plane, Quaternion, Vector2, Vector3, type Group, type Object3D, type Ray } from 'three'
import { deletePipeEdge, insertPipePoint, movePipeNodeAcrossNetworks, type PipeNetwork } from '../../design/pipe-network'
import type { PoolPipeNode } from '../core/schema'
import { OpenEndpointHandles, pipePreviewControllers } from './preview'
import { usePipeEditStore } from './store'

/**
 * Selection-time pipe controls live outside the selectable renderer. This is
 * important because the editor's generic selected-node click is also its
 * direct-move gesture; controls must never participate in that node event.
 */
export default function PoolPipeSelectionAffordance({ node }: { node: PoolPipeNode }) {
  const selectedIds = useViewer((state) => state.selection.selectedIds)
  const pipeToolActive = useEditor((state) => state.mode === 'build' && state.tool === 'pool:pipe-network')
  const selectedNode = useScene((state) => {
    if (selectedIds.length !== 1 || selectedIds[0] !== node.id) return null
    return state.nodes[node.id as AnyNodeId] as PoolPipeNode | undefined
  })
  const [target, setTarget] = useState<Object3D | null>(null)
  const pipeId = selectedNode?.id ?? null

  useEffect(() => {
    if (!pipeId) {
      setTarget(null)
      return
    }
    let frameId = 0
    const resolve = () => {
      const next = sceneRegistry.nodes.get(pipeId) ?? null
      setTarget((current) => current === next ? current : next)
      if (!next) frameId = window.requestAnimationFrame(resolve)
    }
    resolve()
    return () => window.cancelAnimationFrame(frameId)
  }, [pipeId])

  if (!selectedNode || !target || pipeToolActive) return null
  const mount = target.parent ?? target
  return createPortal(
    <PipeSelectionRig node={selectedNode} target={target} />,
    mount,
  )
}

function PipeSelectionRig({ node, target }: { node: PoolPipeNode; target: Object3D }) {
  const outerRef = useRef<Group>(null)

  useEffect(() => {
    let frame = 0
    const sync = () => {
      const outer = outerRef.current
      if (outer) {
        outer.position.copy(target.position)
        outer.quaternion.copy(target.quaternion)
        outer.scale.copy(target.scale)
      }
      frame = requestAnimationFrame(sync)
    }
    frame = requestAnimationFrame(sync)
    return () => cancelAnimationFrame(frame)
  }, [target])

  return (
    <group ref={outerRef}>
      <OpenEndpointHandles node={node} rootRef={outerRef} />
      <PipeSubSelectionControls node={node} rootRef={outerRef} />
    </group>
  )
}

function PipeSubSelectionControls({ node, rootRef }: { node: PoolPipeNode; rootRef: { current: Group | null } }) {
  const subSelection = usePipeEditStore((state) => state.subSelection)
  const setSubSelection = usePipeEditStore((state) => state.setSubSelection)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Delete' && event.key !== 'Backspace') return
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || (event.target instanceof HTMLElement && event.target.isContentEditable)) return
      if (subSelection?.networkId !== node.id || subSelection.element !== 'edge') return
      const current = useScene.getState().nodes[node.id as never] as unknown as PoolPipeNode | undefined
      if (!current || !current.edges.some((edge) => edge.id === subSelection.elementId)) return
      event.preventDefault()
      event.stopPropagation()
      const updated = deletePipeEdge(current as unknown as PipeNetwork, subSelection.elementId)
      if (updated.edges.length === 0) {
        useScene.getState().deleteNode(node.id as never)
      } else {
        useScene.getState().updateNode(node.id as never, {
          nodes: updated.nodes,
          edges: updated.edges,
          attachments: updated.attachments,
        } as never)
      }
      setSubSelection(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [node.id, setSubSelection, subSelection])

  return (
    <group>
      {node.edges.map((edge, edgeIndex) => {
        const from = node.nodes.find((candidate) => candidate.id === edge.from)
        const to = node.nodes.find((candidate) => candidate.id === edge.to)
        if (!from || !to || edge.style !== 'rigid') return null
        const start = new Vector3(...from.position)
        const direction = new Vector3(...to.position).sub(start)
        const length = direction.length()
        if (length <= Number.EPSILON) return null
        return (
          <mesh
            key={`${node.id}:${edge.id}:${edgeIndex}`}
            position={start.clone().addScaledVector(direction, 0.5)}
            quaternion={new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), direction.normalize())}
            onPointerDown={(event) => {
              event.stopPropagation()
              event.nativeEvent.stopPropagation()
              event.nativeEvent.stopImmediatePropagation()
              swallowNextClick()
              if (!event.nativeEvent.shiftKey) {
                setSubSelection({ networkId: node.id, element: 'edge', elementId: edge.id })
                return
              }
              if (!rootRef.current) return
              const hit = rootRef.current.worldToLocal(event.point.clone())
              const segment = new Vector3(...to.position).sub(start)
              const parameter = Math.max(0, Math.min(1, hit.clone().sub(start).dot(segment) / segment.lengthSq()))
              const position: [number, number, number] = [
                start.x + segment.x * parameter,
                start.y + segment.y * parameter,
                start.z + segment.z * parameter,
              ]
              const inserted = insertPipePoint(node as unknown as PipeNetwork, edge.id, position)
              useScene.getState().updateNode(node.id as never, { nodes: inserted.nodes, edges: inserted.edges } as never)
              setSubSelection({ networkId: node.id, element: 'node', elementId: `n${node.nodes.length}` })
            }}
          >
            <cylinderGeometry args={[Math.max(node.diameter * 1.8, 0.08), Math.max(node.diameter * 1.8, 0.08), length, 12]} />
            <meshBasicMaterial colorWrite={false} depthWrite={false} />
          </mesh>
        )
      })}
      {node.nodes.filter((candidate) => candidate.kind !== 'endpoint').map((pipeNode) => (
        <PipeNodeHandle key={pipeNode.id} node={node} pipeNodeId={pipeNode.id} rootRef={rootRef} selected={subSelection?.element === 'node' && subSelection.elementId === pipeNode.id} />
      ))}
    </group>
  )
}

function PipeNodeHandle({
  node,
  pipeNodeId,
  rootRef,
  selected,
}: {
  node: PoolPipeNode
  pipeNodeId: string
  rootRef: { current: Group | null }
  selected: boolean
}) {
  const handleRef = useRef<Group>(null)
  const dragging = useRef(false)
  const cleanupRef = useRef<(() => void) | null>(null)
  const startNetwork = useRef(node)
  const previewNetwork = useRef<PoolPipeNode | null>(null)
  const previewNetworks = useRef<PoolPipeNode[]>([])
  const hasMoved = useRef(false)
  const startLocal = useRef(new Vector3())
  const startWorld = useRef(new Vector3())
  const dragPlane = useRef(new Plane())
  const verticalPlane = useRef(new Plane())
  const { camera, gl, raycaster } = useThree()
  const setSubSelection = usePipeEditStore((state) => state.setSubSelection)

  useEffect(() => () => cleanupRef.current?.(), [])

  // Keep the flat hex control readable from every editor camera angle while
  // preserving its position at the exact center of the selected pipe node.
  useEffect(() => {
    let frame = 0
    const sync = () => {
      const handle = handleRef.current
      const parent = handle?.parent
      if (handle && parent) {
        const parentWorld = new Quaternion()
        parent.getWorldQuaternion(parentWorld)
        handle.quaternion.copy(parentWorld.invert().multiply(camera.quaternion))
      }
      frame = requestAnimationFrame(sync)
    }
    frame = requestAnimationFrame(sync)
    return () => cancelAnimationFrame(frame)
  }, [camera])

  const snapCoordinate = (value: number) => {
    const step = useEditor.getState().gridSnapStep
    return step > 0 ? Math.round(value / step) * step : value
  }

  const updateFromRay = (ray: Ray, vertical = false, precise = false) => {
    const root = rootRef.current
    if (!root) return
    const hit = ray.intersectPlane(vertical ? verticalPlane.current : dragPlane.current, new Vector3())
    if (!hit) return
    const local = root.worldToLocal(hit)
    const targetX = !precise && isGridSnapActive() ? snapCoordinate(local.x) : local.x
    const targetY = !precise && isGridSnapActive() ? snapCoordinate(local.y) : local.y
    const targetZ = !precise && isGridSnapActive() ? snapCoordinate(local.z) : local.z
    const delta: [number, number, number] = vertical
      ? [0, targetY - startLocal.current.y, 0]
      : [targetX - startLocal.current.x, targetY - startLocal.current.y, targetZ - startLocal.current.z]
    const scenePipes = Object.values(useScene.getState().nodes)
      .filter((candidate) => (candidate.type as string) === 'pool:pipe-network') as unknown as PoolPipeNode[]
    const updatedNetworks = movePipeNodeAcrossNetworks(
      scenePipes as unknown as PipeNetwork[],
      node.id,
      pipeNodeId,
      delta,
    ) as unknown as PoolPipeNode[]
    previewNetworks.current = updatedNetworks
    const updated = updatedNetworks.find((candidate) => candidate.id === node.id) ?? movePipeNodeAcrossNetworks(
      [startNetwork.current as unknown as PipeNetwork], node.id, pipeNodeId, delta,
    )[0] as unknown as PoolPipeNode
    previewNetwork.current = updated
    for (const preview of updatedNetworks) pipePreviewControllers.get(preview.id)?.preview(preview)
    hasMoved.current = true
  }

  return (
    <group
      ref={handleRef}
      position={node.nodes.find((candidate) => candidate.id === pipeNodeId)?.position}
      renderOrder={30}
      onPointerDown={(event) => {
        if (event.button !== 0 || !rootRef.current) return
        event.stopPropagation()
        event.nativeEvent.stopPropagation()
        event.nativeEvent.stopImmediatePropagation()
        swallowNextClick()
        setSubSelection({ networkId: node.id, element: 'node', elementId: pipeNodeId })
        const pipeNode = node.nodes.find((candidate) => candidate.id === pipeNodeId)
        if (!pipeNode) return
        rootRef.current.updateMatrixWorld(true)
        startNetwork.current = node
        previewNetwork.current = null
        hasMoved.current = false
        startLocal.current.set(...pipeNode.position)
        startWorld.current.copy(startLocal.current).applyMatrix4(rootRef.current.matrixWorld)
        dragPlane.current.set(new Vector3(0, 1, 0), -startWorld.current.y)
        const cameraDirection = camera.getWorldDirection(new Vector3())
        cameraDirection.y = 0
        if (cameraDirection.lengthSq() < 1e-6) cameraDirection.set(0, 0, 1)
        verticalPlane.current.set(cameraDirection.normalize(), -cameraDirection.dot(startWorld.current))
        dragging.current = true
        useViewer.getState().setInputDragging(true)
        useScene.temporal.getState().pause()
        const updateRay = (clientX: number, clientY: number, vertical = false, precise = false) => {
          const rect = gl.domElement.getBoundingClientRect()
          raycaster.setFromCamera(new Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1), camera)
          updateFromRay(raycaster.ray, vertical, precise)
        }
        const onMove = (moveEvent: PointerEvent) => {
          if (moveEvent.pointerId !== event.pointerId) return
          moveEvent.preventDefault()
          updateRay(moveEvent.clientX, moveEvent.clientY, moveEvent.altKey, moveEvent.shiftKey)
        }
        const finish = (endEvent?: PointerEvent, commit = true) => {
          if (endEvent && endEvent.pointerId !== event.pointerId) return
          window.removeEventListener('pointermove', onMove)
          window.removeEventListener('pointerup', finish)
          window.removeEventListener('pointercancel', cancelDrag)
          cleanupRef.current = null
          if (!dragging.current) return
          if (commit && hasMoved.current && previewNetwork.current) {
            const commits = previewNetworks.current.length > 0 ? previewNetworks.current : [previewNetwork.current]
            for (const committed of commits) {
              useScene.getState().updateNode(
                committed.id as never,
                {
                  nodes: committed.nodes,
                  edges: committed.edges,
                  attachments: committed.attachments,
                } as never,
              )
            }
          }
          for (const preview of previewNetworks.current) pipePreviewControllers.get(preview.id)?.reset()
          previewNetwork.current = null
          previewNetworks.current = []
          hasMoved.current = false
          dragging.current = false
          useViewer.getState().setInputDragging(false)
          useScene.temporal.getState().resume()
          swallowNextClick()
        }
        const cancelDrag = (cancelEvent?: PointerEvent) => finish(cancelEvent, false)
        cleanupRef.current = () => finish(undefined, false)
        window.addEventListener('pointermove', onMove)
        window.addEventListener('pointerup', finish)
        window.addEventListener('pointercancel', cancelDrag)
      }}
    >
      <mesh frustumCulled={false}>
        <circleGeometry args={[Math.max(node.diameter * 1.25, 0.07), 6]} />
        {/* Keep every node clickable, but only draw the selected node's handle. */}
        <meshBasicMaterial
          color="#8381ed"
          transparent
          opacity={selected ? 1 : 0}
          depthTest={false}
          depthWrite={false}
        />
      </mesh>
      {selected && (
        <mesh frustumCulled={false} raycast={() => null} position={[0, 0, -0.002]}>
          <ringGeometry args={[Math.max(node.diameter * 1.25, 0.07), Math.max(node.diameter * 1.25, 0.07) * 1.18, 6]} />
          <meshBasicMaterial color="#8381ed" depthTest={false} depthWrite={false} />
        </mesh>
      )}
    </group>
  )
}
