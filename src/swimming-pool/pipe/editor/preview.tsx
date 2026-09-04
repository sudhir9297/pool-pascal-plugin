'use client'

import { useNodeEvents, useViewer } from '@pascal-app/viewer'
import { emitter, runAsSingleSceneHistoryStep, useRegistry, useScene, type AnyNode } from '@pascal-app/core'
import { clearPlacementSurface, isGridSnapActive, publishPlacementSurface, swallowNextClick, triggerSFX, useEditor, useInteractionScope } from '@pascal-app/editor'
import { createPortal, type ThreeEvent, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import { MeshStandardMaterial, Plane, Quaternion, Vector2, Vector3, type Group, type Material, type Mesh, type Object3D, type Ray } from 'three'
import { buildPipeGeometry } from '../core/geometry'
import { PoolPipeNode } from '../core/schema'
import { attachPipeNode, deletePipeEdge, insertPipePoint, mergePipeNetworksAtEndpoints, movePipeEndpointTo, movePipeNode, rotatePipeBranch, syncAttachedPipeEndpoints, type PipeNetwork } from '../../design/pipe-network'
import { collectPoolPipePorts, findNearestPipePort } from '../design/ports'
import { snapPipePointToDirection } from '../design/direction-snap'
import { usePipeEditStore } from './store'
import { pipeRotationSnap, pipeSnapDistance } from './gizmo/modal'
import { PipeRotationHandle } from './gizmo/handles'
import { pipeGizmoDimensions, pipeGizmoHitDimensions } from './gizmo/dimensions'
import { getPipeFittingGizmoTarget } from './gizmo/fitting'
import { createPipeRotationFrame, pipeRotationDelta } from './gizmo/rotation'
import { pipeGizmoPortalTarget, syncPipeGizmoFrame } from './gizmo/scene'
import { shouldClearLocalPipeSelectionForGlobalSelection, shouldClearPipeSelection, shouldShowPipeHandles } from './gizmo/selection'
import { createPipePointerGuard } from './pointer-guard'

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
  // Pipe parts own pointer down/up so they can select and edit individual
  // graph elements. Preserve only the generic hover/context behavior here;
  // spreading all handlers and overriding two keys obscures that ownership.
  const nodeSurfaceHandlers = {
    onPointerEnter: handlers.onPointerEnter,
    onPointerLeave: handlers.onPointerLeave,
    onPointerMove: handlers.onPointerMove,
    onDoubleClick: handlers.onDoubleClick,
    onContextMenu: handlers.onContextMenu,
  }
  const sceneNodes = useScene((state) => state.nodes)
  const inputDragging = useViewer((state) => state.inputDragging)
  const selected = useViewer((state) => state.selection.selectedIds.includes(node.id))
  const selectedIds = useViewer((state) => state.selection.selectedIds)
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)
  const insertedDragCleanup = useRef<(() => void) | null>(null)
  const { camera, gl, raycaster } = useThree()
  const [selectedFittingId, setSelectedFittingId] = useState<string | null>(null)
  const handledNodeClickRef = useRef(false)
  const handledPipeClickRef = useRef(false)
  const guardPipePointer = usePipePointerGuard()
  const [gizmoMount, setGizmoMount] = useState<Object3D | null>(null)
  const pipeToolActive = useEditor((state) => state.mode === 'build' && state.tool === 'pool:pipe-network')
  useRegistry(node.id, node.type, rootRef)

  useEffect(() => {
    let frameId = 0
    const resolveMount = () => {
      const root = rootRef.current
      if (root?.parent) {
        setGizmoMount(pipeGizmoPortalTarget(root))
        return
      }
      frameId = window.requestAnimationFrame(resolveMount)
    }
    resolveMount()
    return () => window.cancelAnimationFrame(frameId)
  }, [node.id])

  // `grid:click` is emitted from the canvas for both empty-space clicks and
  // clicks whose 3D object was handled first. Track handled node clicks so an
  // empty click can clear this network without clearing it after another item
  // or one of the pipe's own controls was clicked.
  useEffect(() => {
    const onNodeClick = () => {
      handledNodeClickRef.current = true
      requestAnimationFrame(() => { handledNodeClickRef.current = false })
    }
    const clearPipeSelection = () => {
      const nodeClickHandled = handledNodeClickRef.current
      const pipeClickHandled = handledPipeClickRef.current
      if (nodeClickHandled || pipeClickHandled) {
        handledPipeClickRef.current = false
        return
      }
      const nodeSelected = useViewer.getState().selection.selectedIds.includes(node.id)
      if (!shouldClearPipeSelection({
        editorMode: useEditor.getState().mode,
        nodeSelected,
        edgeSelected: selectedEdgeId !== null,
        fittingSelected: selectedFittingId !== null,
        nodeClickHandled,
        pipeClickHandled,
      })) return
      // Global selection belongs to the host editor. In particular, the
      // click generated after a marquee drag must not erase the ids that the
      // editor just committed. This cleanup owns only pipe-part state.
      setSelectedEdgeId(null)
      setSelectedFittingId(null)
      useViewer.setState({ hoveredId: null })
    }
    const onGridClick = () => clearPipeSelection()
    const onCanvasClick = (event: MouseEvent) => {
      if (event.button !== 0) return
      const viewer = useViewer.getState()
      if (viewer.cameraDragging || viewer.inputDragging) return
      clearPipeSelection()
    }

    emitter.on('selection:canvas-node-click', onNodeClick)
    emitter.on('grid:click', onGridClick)
    gl.domElement.addEventListener('click', onCanvasClick)
    return () => {
      emitter.off('selection:canvas-node-click', onNodeClick)
      emitter.off('grid:click', onGridClick)
      gl.domElement.removeEventListener('click', onCanvasClick)
    }
  }, [gl, node.id, selectedEdgeId, selectedFittingId])

  // A second click on an already-selected network must not fall through to
  // the editor's generic Select interaction. That path interprets the click
  // as a request to pick up the whole node and shows its move feedback. Pipe
  // networks are edited through their own endpoint/fitting controls instead.
  const stopSelectedNetworkReselect = (event: ThreeEvent<PointerEvent>) => {
    if (!selected || pipeToolActive || event.button !== 0) return
    if (event.type === 'pointerdown') {
      guardPipePointer(event.nativeEvent)
      handledPipeClickRef.current = true
      requestAnimationFrame(() => { handledPipeClickRef.current = false })
      swallowNextClick()
      event.nativeEvent.stopPropagation()
      event.nativeEvent.stopImmediatePropagation()
    }
    event.stopPropagation()
  }

  // Local part selection can coexist only with an empty global selection.
  // Any global node selection replaces it, while empty-canvas clicks are
  // handled explicitly above so local controls never get stuck on screen.
  // The global array itself is owned by the editor and may validly contain
  // several pipe networks after a marquee selection.
  useEffect(() => {
    if (!shouldClearLocalPipeSelectionForGlobalSelection({
      selectedCount: selectedIds.length,
    })) return
    setSelectedEdgeId(null)
    setSelectedFittingId(null)
  }, [selectedIds])

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
    if (!selectedEdgeId || !node.edges.some((edge) => edge.id === selectedEdgeId)) setSelectedEdgeId(null)
  }, [node.edges, selectedEdgeId])

  useEffect(() => () => insertedDragCleanup.current?.(), [])

  useEffect(() => {
    if (selectedFittingId && !node.nodes.some((candidate) => candidate.id === selectedFittingId)) setSelectedFittingId(null)
  }, [node.nodes, selectedFittingId])

  useEffect(() => {
    pipe.traverse((child) => {
      const mesh = child as Mesh
      if (!mesh.isMesh || typeof mesh.userData.pipeEdgeId !== 'string') return
      const base = (mesh.userData.pipeBaseMaterial as MeshStandardMaterial | undefined) ?? (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material)
      if (!base) return
      mesh.userData.pipeBaseMaterial = base
      if (selectedEdgeId === mesh.userData.pipeEdgeId && base instanceof MeshStandardMaterial) {
        const highlight = base.clone()
        highlight.color.set('#91a4ff')
        highlight.emissive.set('#26366f')
        highlight.emissiveIntensity = 0.28
        mesh.material = highlight
      } else {
        mesh.material = base
      }
    })
  }, [pipe, selectedEdgeId])

  const selectPipePart = (event: ThreeEvent<PointerEvent>) => {
    if (pipeToolActive || event.button !== 0) return
    const edgeId = event.object.userData.pipeEdgeId
    const fittingId = event.object.userData.pipeFittingBody || typeof event.object.userData.pipeFittingKind === 'string'
      ? event.object.userData.pipeNodeId
      : null
    if (typeof edgeId !== 'string' && typeof fittingId !== 'string') return
    guardPipePointer(event.nativeEvent)
    handledPipeClickRef.current = true
    requestAnimationFrame(() => { handledPipeClickRef.current = false })
    event.stopPropagation()
    event.nativeEvent.stopPropagation()
    event.nativeEvent.stopImmediatePropagation()
    swallowNextClick()
    if (event.altKey && typeof edgeId === 'string') {
      const current = useScene.getState().nodes[node.id as never] as unknown as PoolPipeNode | undefined
      const root = rootRef.current
      if (!current || !root) return
      insertedDragCleanup.current?.()
      root.updateMatrixWorld(true)
      const local = root.worldToLocal(event.point.clone())
      const inserted = insertPipePoint(current, edgeId, [local.x, local.y, local.z])
      const insertedNode = inserted.nodes.at(-1)
      if (!insertedNode) return
      const edge = inserted.edges.find((candidate) => candidate.from === insertedNode.id || candidate.to === insertedNode.id)
      const neighborId = edge ? (edge.from === insertedNode.id ? edge.to : edge.from) : null
      const neighbor = neighborId ? inserted.nodes.find((candidate) => candidate.id === neighborId) : null
      const previewNetwork = { current: inserted as unknown as PoolPipeNode }
      const pointerId = event.nativeEvent.pointerId
      const previousAltSnappingMode = useEditor.getState().snappingModeByContext.item
      useEditor.getState().setSnappingMode('item', 'grid')
      publishPlacementSurface(new Vector3(...insertedNode.position).applyMatrix4(root.matrixWorld), new Vector3(0, 1, 0))
      const update = (clientX: number, clientY: number) => {
        const rect = gl.domElement.getBoundingClientRect()
        raycaster.setFromCamera(new Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1), camera)
        const pivotWorld = new Vector3(...insertedNode.position).applyMatrix4(root.matrixWorld)
        const plane = new Plane(new Vector3(0, 1, 0), -pivotWorld.y)
        const hit = raycaster.ray.intersectPlane(plane, new Vector3())
        if (!hit) return
        publishPlacementSurface(hit, new Vector3(0, 1, 0))
        const position = root.worldToLocal(hit)
        const gridStep = isGridSnapActive() ? useEditor.getState().gridSnapStep : 0
        const snapped = neighbor ? snapPipePointToDirection(neighbor.position, [position.x, position.y, position.z], gridStep) : [position.x, position.y, position.z] as [number, number, number]
        previewNetwork.current = movePipeNode(inserted as unknown as PipeNetwork, insertedNode.id, [snapped[0] - insertedNode.position[0], snapped[1] - insertedNode.position[1], snapped[2] - insertedNode.position[2]]) as unknown as PoolPipeNode
        pipePreviewControllers.get(node.id)?.preview(previewNetwork.current)
      }
      const finish = (endEvent?: PointerEvent, commit = true) => {
        if (endEvent && endEvent.pointerId !== pointerId) return
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', finish)
        window.removeEventListener('pointercancel', cancel)
        window.removeEventListener('blur', onBlur)
        window.removeEventListener('keydown', onKeyDown)
        insertedDragCleanup.current = null
        clearPlacementSurface()
        useInteractionScope.getState().endIf((scope) =>
          scope.kind === 'handle-drag' && scope.nodeId === node.id && scope.handle === 'pipe-joint-insert',
        )
        if (commit) {
          const finalNetwork = previewNetwork.current
          runAsSingleSceneHistoryStep(useScene, () => useScene.getState().updateNode(node.id as never, { nodes: finalNetwork.nodes, edges: finalNetwork.edges, attachments: finalNetwork.attachments } as never))
          useViewer.getState().setSelection({ selectedIds: [node.id] })
        }
        pipePreviewControllers.get(node.id)?.reset()
        useEditor.getState().setSnappingMode('item', previousAltSnappingMode)
        useViewer.getState().setInputDragging(false)
        useScene.temporal.getState().resume()
      }
      const cancel = (cancelEvent?: PointerEvent) => finish(cancelEvent, false)
      const onBlur = () => finish(undefined, false)
      const onKeyDown = (keyEvent: KeyboardEvent) => { if (keyEvent.key === 'Escape') { keyEvent.preventDefault(); finish(undefined, false) } }
      const onMove = (moveEvent: PointerEvent) => { if (moveEvent.pointerId === pointerId) update(moveEvent.clientX, moveEvent.clientY) }
      insertedDragCleanup.current = () => finish(undefined, false)
      useInteractionScope.getState().begin({ kind: 'handle-drag', nodeId: node.id, handle: 'pipe-joint-insert' })
      useViewer.getState().setInputDragging(true)
      useScene.temporal.getState().pause()
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', finish)
      window.addEventListener('pointercancel', cancel)
      window.addEventListener('blur', onBlur)
      window.addEventListener('keydown', onKeyDown)
      return
    }
    // A segment selection must not remain a node selection: the editor's
    // global Delete command acts on selected nodes, while this component's
    // Delete handler acts on the selected edge only. Keep this store update
    // outside the React state updater so it never runs during rendering.
    useViewer.getState().setSelection({ selectedIds: [] })
    if (typeof fittingId === 'string') {
      setSelectedEdgeId(null)
      setSelectedFittingId(fittingId)
    } else {
      setSelectedFittingId(null)
      setSelectedEdgeId((current) => current === edgeId ? null : edgeId)
    }
  }

  const stopPipePartPointerUp = (event: ThreeEvent<PointerEvent>) => {
    const isPipePart = typeof event.object.userData.pipeEdgeId === 'string'
      || typeof event.object.userData.pipeFittingKind === 'string'
    if (!isPipePart) return
    // Keep the R3F event on the pipe visual, but allow the native pointer-up to
    // reach window-level marquee and pointer-guard cleanup listeners.
    event.stopPropagation()
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Delete' && event.key !== 'Backspace') return
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || (event.target instanceof HTMLElement && event.target.isContentEditable)) return
      if (!selectedEdgeId || pipeToolActive) return
      const current = useScene.getState().nodes[node.id as never] as unknown as PoolPipeNode | undefined
      if (!current || !current.edges.some((edge) => edge.id === selectedEdgeId)) return
      event.preventDefault()
      event.stopPropagation()
      const updated = deletePipeEdge(current as unknown as PipeNetwork, selectedEdgeId)
      if (updated.edges.length === 0) useScene.getState().deleteNode(node.id as never)
      else useScene.getState().updateNode(node.id as never, { nodes: updated.nodes, edges: updated.edges, attachments: updated.attachments } as never)
      setSelectedEdgeId(null)
      triggerSFX('sfx:structure-delete')
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [node.id, pipeToolActive, selectedEdgeId])

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

  const showHandles = shouldShowPipeHandles({
    pipeToolActive,
    globalSelectionCount: selectedIds.length,
    edgeSelected: selectedEdgeId !== null,
    fittingSelected: selectedFittingId !== null,
  })
  return (
    <>
      <group
        position={node.position}
        ref={rootRef}
        rotation={node.rotation}
        {...(pipeToolActive ? {} : nodeSurfaceHandlers)}
        onPointerDown={stopSelectedNetworkReselect}
        onPointerUp={stopSelectedNetworkReselect}
      >
        <group
          ref={visualRef}
          onPointerDown={selectPipePart}
          onPointerUp={stopPipePartPointerUp}
        />
      </group>
      {showHandles && gizmoMount && createPortal(
        <PipeGizmoPortalFrame networkRoot={rootRef.current}>
          <OpenEndpointHandles node={node} rootRef={rootRef} selectedEdgeId={selectedEdgeId} selectedFittingId={selectedFittingId} />
        </PipeGizmoPortalFrame>,
        gizmoMount,
      )}
    </>
  )
}

function PipeGizmoPortalFrame({ networkRoot, children }: { networkRoot: Group | null; children: React.ReactNode }) {
  const frameRef = useRef<Group>(null)
  useFrame(() => {
    // Scene updates can detach and replace the preview root one frame before
    // React removes this portal. Keep that transient frame a no-op.
    if (frameRef.current) syncPipeGizmoFrame(frameRef.current, networkRoot)
  })
  return <group ref={frameRef}>{children}</group>
}

export function OpenEndpointHandles({
  node,
  rootRef,
  selectedEdgeId = null,
  selectedFittingId = null,
}: {
  node: PoolPipeNode
  rootRef: { current: Group | null }
  selectedEdgeId?: string | null
  selectedFittingId?: string | null
}) {
  const [activeEndpointId, setActiveEndpointId] = useState<string | null>(null)
  useEffect(() => {
    setActiveEndpointId(selectedFittingId)
  }, [selectedFittingId])
  const degreeByNode = new Map<string, number>()
  for (const edge of node.edges) {
    degreeByNode.set(edge.from, (degreeByNode.get(edge.from) ?? 0) + 1)
    degreeByNode.set(edge.to, (degreeByNode.get(edge.to) ?? 0) + 1)
  }
  const selectedEdge = selectedEdgeId ? node.edges.find((edge) => edge.id === selectedEdgeId) : null
  const selectedNodeIds = selectedFittingId
    ? new Set([selectedFittingId])
    : selectedEdge
      ? new Set([selectedEdge.from, selectedEdge.to])
      : null

  return (
    <group>
      {node.nodes
        .filter((pipeNode) => selectedFittingId === pipeNode.id && degreeByNode.get(pipeNode.id)! >= 2 && getPipeFittingGizmoTarget(node, pipeNode.id) !== null)
        .map((pipeNode) => {
          const neighbors = node.edges
            .filter((edge) => edge.from === pipeNode.id || edge.to === pipeNode.id)
            .map((edge) => node.nodes.find((candidate) => candidate.id === (edge.from === pipeNode.id ? edge.to : edge.from)))
            .filter((neighbor): neighbor is PoolPipeNode['nodes'][number] => neighbor !== undefined)
          const branchRootId = fittingRotationBranch(node, pipeNode.id, neighbors)
          if (!branchRootId) return null
          const rotationAxis = fittingRotationAxis(node, pipeNode.id, branchRootId)
          return (
            <group key={`${pipeNode.id}-gizmo`} position={pipeNode.position} userData={{ pipeControl: true }}>
              <PipeFittingAxisGizmo network={node} fittingId={pipeNode.id} rootRef={rootRef} />
              <PipeFittingRotationGizmo
                fittingId={pipeNode.id}
                branchRootId={branchRootId}
                rotationAxis={rotationAxis}
                network={node}
                rootRef={rootRef}
              />
            </group>
          )
        })}
      {node.nodes
        .filter((pipeNode) => (pipeNode.kind === 'endpoint' || pipeNode.kind === 'straight') && (!selectedNodeIds || selectedNodeIds.has(pipeNode.id)) && (pipeNode.kind === 'endpoint' ? degreeByNode.get(pipeNode.id) === 1 : degreeByNode.get(pipeNode.id) === 2))
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
          return (
            <group key={pipeNode.id} position={pipeNode.position} userData={{ pipeControl: true }}>
              {activeEndpointId !== pipeNode.id && (
                <EndpointCube
                  direction={direction}
                  active={false}
                  onToggle={() => setActiveEndpointId((current) => current === pipeNode.id ? null : pipeNode.id)}
                />
              )}
              {activeEndpointId === pipeNode.id && (
                <PipePivotGizmo nodeId={pipeNode.id} network={node} rootRef={rootRef} />
              )}
              {pipeNode.kind === 'endpoint' && <PipeExtensionPlus networkId={node.id} nodeId={pipeNode.id} direction={direction} />}
            </group>
          )
        })}
      {node.nodes
        .filter((pipeNode) => (pipeNode.kind === 'elbow' || pipeNode.kind === 'corner' || pipeNode.kind === 'tee' || pipeNode.kind === 'y' || pipeNode.kind === 'cross') && degreeByNode.get(pipeNode.id)! >= 2 && (!selectedNodeIds || selectedNodeIds.has(pipeNode.id)))
        .map((pipeNode) => {
          const neighbors = node.edges
            .filter((edge) => edge.from === pipeNode.id || edge.to === pipeNode.id)
            .map((edge) => node.nodes.find((candidate) => candidate.id === (edge.from === pipeNode.id ? edge.to : edge.from)))
            .filter((neighbor): neighbor is PoolPipeNode['nodes'][number] => neighbor !== undefined)
          if (neighbors.length !== 2) return null
          const direction = new Vector3()
            .add(new Vector3(...neighbors[0]!.position).sub(new Vector3(...pipeNode.position)).normalize())
            .add(new Vector3(...neighbors[1]!.position).sub(new Vector3(...pipeNode.position)).normalize())
          if (direction.lengthSq() <= Number.EPSILON) return null
          // The sum points into the inside of the bend. Put the branch
          // affordance on the outside of the L, in the open space beyond it.
          direction.negate()
          return (
            <group key={`${pipeNode.id}-corner-extension`} position={pipeNode.position} userData={{ pipeControl: true }}>
              <PipeExtensionPlus networkId={node.id} nodeId={pipeNode.id} direction={direction.normalize()} />
            </group>
          )
        })}
      {node.nodes
        .filter((pipeNode) => pipeNode.kind === 'tee' && degreeByNode.get(pipeNode.id) === 3)
        .map((pipeNode) => {
          const neighbors = node.edges
            .filter((edge) => edge.from === pipeNode.id || edge.to === pipeNode.id)
            .map((edge) => node.nodes.find((candidate) => candidate.id === (edge.from === pipeNode.id ? edge.to : edge.from)))
            .filter((neighbor): neighbor is PoolPipeNode['nodes'][number] => neighbor !== undefined)
          if (neighbors.length !== 3) return null

          const directions = neighbors.map((neighbor) => new Vector3(...neighbor.position)
            .sub(new Vector3(...pipeNode.position)).normalize())
          let trunkA = -1
          let trunkB = -1
          for (let first = 0; first < directions.length; first += 1) {
            for (let second = first + 1; second < directions.length; second += 1) {
              if (directions[first]!.dot(directions[second]!) < -0.95) {
                trunkA = first
                trunkB = second
                break
              }
            }
            if (trunkA >= 0) break
          }
          const branchIndex = directions.findIndex((_, index) => index !== trunkA && index !== trunkB)
          if (branchIndex < 0) return null
          const direction = directions[branchIndex]!.clone().negate()

          return (
            <group key={`${pipeNode.id}-tee-extension`} position={pipeNode.position} userData={{ pipeControl: true }}>
              <PipeExtensionPlus networkId={node.id} nodeId={pipeNode.id} direction={direction} />
            </group>
          )
        })}
    </group>
  )
}

function fittingRotationBranch(network: PoolPipeNode, fittingId: string, neighbors: PoolPipeNode['nodes'][number][]): string | null {
  if (neighbors.length < 2) return null
  if (neighbors.length === 3) {
    for (let first = 0; first < neighbors.length; first += 1) {
      for (let second = first + 1; second < neighbors.length; second += 1) {
        const a = new Vector3(...neighbors[first]!.position).sub(new Vector3(...network.nodes.find((node) => node.id === fittingId)!.position)).normalize()
        const b = new Vector3(...neighbors[second]!.position).sub(new Vector3(...network.nodes.find((node) => node.id === fittingId)!.position)).normalize()
        if (a.dot(b) < -0.95) return neighbors.findIndex((_, index) => index !== first && index !== second) >= 0
          ? neighbors.find((_, index) => index !== first && index !== second)!.id
          : null
      }
    }
  }
  return neighbors[neighbors.length - 1]!.id
}

function fittingRotationAxis(network: PoolPipeNode, fittingId: string, branchRootId: string): Vector3 {
  const fitting = network.nodes.find((node) => node.id === fittingId)!
  const stationary = network.edges
    .filter((edge) => edge.from === fittingId || edge.to === fittingId)
    .map((edge) => network.nodes.find((node) => node.id === (edge.from === fittingId ? edge.to : edge.from)))
    .find((node) => node && node.id !== branchRootId)
  return stationary
    ? new Vector3(...stationary.position).sub(new Vector3(...fitting.position)).normalize()
    : new Vector3(0, 1, 0)
}

function EndpointCube({
  direction,
  active,
  onToggle,
}: {
  direction: Vector3
  active: boolean
  onToggle: () => void
}) {
  const cubeQuaternion = new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), direction)
  const onPointerDown = usePipeTap(onToggle)
  return (
    <mesh
      onPointerDown={onPointerDown}
      position={[direction.x * 0.09, direction.y * 0.09, direction.z * 0.09]}
      quaternion={[cubeQuaternion.x, cubeQuaternion.y, cubeQuaternion.z, cubeQuaternion.w]}
      frustumCulled={false}
      renderOrder={active ? 1405 : 1205}
      userData={{ pipeControl: true }}
    >
      <boxGeometry args={[0.07, 0.07, 0.07]} />
      <meshBasicMaterial color={active ? '#a08cff' : '#8381ed'} depthTest={false} depthWrite={false} opacity={0.9} transparent />
    </mesh>
  )
}

function PipeExtensionPlus({
  networkId,
  nodeId,
  direction,
}: {
  networkId: string
  nodeId: string
  direction: Vector3
}) {
  // Keep the plus flat on the level plane. Only rotate around Y so the
  // control remains straight and aligned with the horizontal pipe axes.
  const yaw = Math.atan2(direction.x, direction.z)

  return (
    <group
      position={[direction.x * 0.42, direction.y * 0.42, direction.z * 0.42]}
      rotation={[0, yaw, 0]}
      onPointerDown={(event) => {
        event.stopPropagation()
        event.nativeEvent.stopPropagation()
        event.nativeEvent.stopImmediatePropagation()
        swallowNextClick()
        usePipeEditStore.getState().beginExtension({ networkId, endpointId: nodeId })
        useEditor.getState().setTool('pool:pipe-network')
        useEditor.getState().setMode('build')
      }}
      onPointerUp={(event) => {
        event.stopPropagation()
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
  )
}

function PipeFittingAxisGizmo({
  network,
  fittingId,
  rootRef,
}: {
  network: PoolPipeNode
  fittingId: string
  rootRef: { current: Group | null }
}) {
  const pivotRef = useRef<Group>(null)
  const target = getPipeFittingGizmoTarget(network, fittingId)
  const fitting = network.nodes.find((candidate) => candidate.id === fittingId)
  if (!target || !fitting) return null

  const updatePivotPosition = (position: [number, number, number] | null) => {
    const next = position
      ? [
          position[0] - fitting.position[0],
          position[1] - fitting.position[1],
          position[2] - fitting.position[2],
        ]
      : [0, 0, 0]
    pivotRef.current?.position.set(next[0]!, next[1]!, next[2]!)
  }

  return (
    // The caller is already positioned at the fitting. Applying
    // `target.position` here as well moved the gizmo to twice the fitting's
    // coordinates, usually outside the visible area.
    <group ref={pivotRef} scale={0.72} userData={{ pipeControl: true }}>
      {target.validAxes.map((axis) => {
        const rotation: [number, number, number] = axis === 'x' ? [0, 0, Math.PI / 2] : axis === 'z' ? [Math.PI / 2, 0, 0] : [0, 0, 0]
        return (
          <PipeGizmoAxis
            key={axis}
            axis={axis}
            color={axis === 'x' ? '#ff2060' : axis === 'y' ? '#20df80' : '#2080ff'}
            rotation={rotation}
            node={fitting}
            nodeId={fittingId}
            network={network}
            rootRef={rootRef}
            onPreviewPosition={updatePivotPosition}
            isEndpoint={false}
          />
        )
      })}
    </group>
  )
}

function PipeFittingRotationGizmo({
  fittingId,
  branchRootId,
  rotationAxis,
  network,
  rootRef,
}: {
  fittingId: string
  branchRootId: string
  rotationAxis: Vector3
  network: PoolPipeNode
  rootRef: { current: Group | null }
}) {
  const fitting = network.nodes.find((node) => node.id === fittingId)
  const branchRoot = network.nodes.find((node) => node.id === branchRootId)
  const dimensions = pipeGizmoDimensions()
  const hit = pipeGizmoHitDimensions(dimensions.radius, dimensions.planeHandleSize)
  const rotationHandleAxis = Math.abs(rotationAxis.x) >= Math.abs(rotationAxis.y) && Math.abs(rotationAxis.x) >= Math.abs(rotationAxis.z)
    ? 'x'
    : Math.abs(rotationAxis.y) >= Math.abs(rotationAxis.z) ? 'y' : 'z'
  const frame = createPipeRotationFrame(
    rotationAxis,
    fitting && branchRoot
      ? new Vector3(...branchRoot.position).sub(new Vector3(...fitting.position))
      : new Vector3(1, 0, 0),
  )
  const handleRef = useRef<Group>(null)
  const start = useRef<{
    point: Vector3
    origin: Vector3
    radial: Vector3
    tangent: Vector3
    normal: Vector3
    plane: Plane
  } | null>(null)
  const startNetwork = useRef(network)
  const previewNetwork = useRef<PoolPipeNode | null>(null)
  const dragging = useRef(false)
  const cleanup = useRef<(() => void) | null>(null)
  const { camera, gl, raycaster } = useThree()

  useEffect(() => () => cleanup.current?.(), [])

  // The parent derives these ids from the same network snapshot, but keep the
  // component hook-safe if a concurrent scene update removes either node.
  if (!fitting || !branchRoot) return null

  return (
    <group userData={{ pipeControl: true }}>
      <group ref={handleRef} quaternion={[frame.quaternion.x, frame.quaternion.y, frame.quaternion.z, frame.quaternion.w]}>
        <PipeRotationHandle
          axis={rotationHandleAxis}
          radius={dimensions.rotationRadius}
          tube={dimensions.radius}
          hitTube={hit.rotationTube}
          arc={hit.rotationArc}
          start={hit.rotationStart}
          state="normal"
          showVisual
          onPointerDown={(_axis, event) => {
          if (event.button !== 0 || !rootRef.current || !handleRef.current) return
          event.stopPropagation()
          event.nativeEvent.stopPropagation()
          event.nativeEvent.stopImmediatePropagation()
          swallowNextClick()
          handleRef.current.updateWorldMatrix(true, false)
          const matrixWorld = handleRef.current.matrixWorld
          const origin = new Vector3().setFromMatrixPosition(matrixWorld)
          const radial = new Vector3().setFromMatrixColumn(matrixWorld, 0).normalize()
          const tangent = new Vector3().setFromMatrixColumn(matrixWorld, 1).normalize()
          const normal = new Vector3().setFromMatrixColumn(matrixWorld, 2).normalize()
          start.current = {
            point: event.point.clone(),
            origin,
            radial,
            tangent,
            normal,
            plane: new Plane().setFromNormalAndCoplanarPoint(normal, origin),
          }
          startNetwork.current = network
          previewNetwork.current = null
          dragging.current = true
          useInteractionScope.getState().begin({ kind: 'handle-drag', nodeId: network.id, handle: 'pipe-fitting-rotate' })
          useViewer.getState().setInputDragging(true)
          useScene.temporal.getState().pause()

          const update = (clientX: number, clientY: number) => {
            const rect = gl.domElement.getBoundingClientRect()
            raycaster.setFromCamera(new Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1), camera)
            const dragStart = start.current
            if (!dragStart) return
            const hitPoint = raycaster.ray.intersectPlane(dragStart.plane, new Vector3())
            if (!hitPoint) return
            const delta = pipeRotationDelta(
              dragStart.origin,
              dragStart.radial,
              dragStart.tangent,
              dragStart.point,
              hitPoint,
            )
            const snapped = moveEventShift.current ? delta : pipeRotationSnap(delta)
            const updated = rotatePipeBranch(startNetwork.current, fittingId, branchRootId, snapped, [rotationAxis.x, rotationAxis.y, rotationAxis.z])
            previewNetwork.current = updated as unknown as PoolPipeNode
            pipePreviewControllers.get(network.id)?.preview(previewNetwork.current)
          }
          const moveEventShift = { current: event.shiftKey }
          const onMove = (moveEvent: PointerEvent) => {
            if (moveEvent.pointerId !== event.pointerId) return
            moveEventShift.current = moveEvent.shiftKey
            update(moveEvent.clientX, moveEvent.clientY)
          }
          const finish = (endEvent?: PointerEvent, commit = true) => {
            if (endEvent && endEvent.pointerId !== event.pointerId) return
            window.removeEventListener('pointermove', onMove)
            window.removeEventListener('pointerup', finish)
            window.removeEventListener('pointercancel', cancel)
            cleanup.current = null
            if (!dragging.current) return
            if (commit && previewNetwork.current) {
              const committed = previewNetwork.current
              // The transient preview does not mutate scene state. Resume
              // temporal tracking before the one real update so rotation is
              // recorded as one undoable history step.
              useScene.temporal.getState().resume()
              runAsSingleSceneHistoryStep(useScene, () => useScene.getState().updateNode(network.id as never, { nodes: committed.nodes, edges: committed.edges, attachments: committed.attachments } as never))
            } else {
              useScene.temporal.getState().resume()
            }
            pipePreviewControllers.get(network.id)?.reset()
            useInteractionScope.getState().endIf((scope) =>
              scope.kind === 'handle-drag' && scope.nodeId === network.id && scope.handle === 'pipe-fitting-rotate',
            )
            previewNetwork.current = null
            start.current = null
            dragging.current = false
            useViewer.getState().setInputDragging(false)
          }
          const cancel = (cancelEvent?: PointerEvent) => finish(cancelEvent, false)
          cleanup.current = () => finish(undefined, false)
          window.addEventListener('pointermove', onMove)
          window.addEventListener('pointerup', finish)
          window.addEventListener('pointercancel', cancel)
          }}
        />
      </group>
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

/**
 * Claims a simple PVC selection pointer before the host marquee can turn its
 * already-armed canvas gesture into a rectangle selection. The guard restores
 * the previous drag state on the matching release, cancellation, blur, or
 * component unmount.
 */
function usePipePointerGuard() {
  const guardRef = useRef<ReturnType<typeof createPipePointerGuard> | null>(null)

  useEffect(() => () => {
    guardRef.current?.dispose()
    guardRef.current = null
  }, [])

  return (event: PointerEvent) => {
    guardRef.current ??= createPipePointerGuard({
      target: window,
      getInputDragging: () => useViewer.getState().inputDragging,
      setInputDragging: (value) => useViewer.getState().setInputDragging(value),
    })
    guardRef.current.begin(event)
  }
}

function PipePivotGizmo({
  nodeId,
  network,
  rootRef,
}: {
  nodeId: string
  network: PoolPipeNode
  rootRef: { current: Group | null }
}) {
  const pivotRef = useRef<Group>(null)
  const node = network.nodes.find((candidate) => candidate.id === nodeId)
  if (!node) return null
  const isEndpoint = node.kind === 'endpoint'

  const connectedEdge = network.edges.find((edge) => edge.from === nodeId || edge.to === nodeId)
  const neighborId = connectedEdge
    ? connectedEdge.from === nodeId ? connectedEdge.to : connectedEdge.from
    : null
  const neighbor = neighborId ? network.nodes.find((candidate) => candidate.id === neighborId) : null
  const outward = neighbor
    ? new Vector3(
        node.position[0] - neighbor.position[0],
        node.position[1] - neighbor.position[1],
        node.position[2] - neighbor.position[2],
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
  const updatePivotPosition = (position: [number, number, number] | null) => {
    const next = position
      ? [position[0] - node.position[0], position[1] - node.position[1], position[2] - node.position[2]]
      : [0, 0, 0]
    pivotRef.current?.position.set(next[0]!, next[1]!, next[2]!)
  }

  return (
    <group ref={pivotRef} scale={0.72}>
      <mesh frustumCulled={false} renderOrder={1300} raycast={() => null}>
        <sphereGeometry args={[0.001, 8, 4]} />
        <meshBasicMaterial transparent opacity={0} depthTest={false} depthWrite={false} />
      </mesh>
      {/* The cylinder is authored along +Y; this rotation makes the red
          arrow point along +X, matching the drag axis below. */}
      <PipeGizmoAxis color="#ff2060" axis="x" directionSign={dominantAxis === 'x' ? outwardSign : 1} rotation={[0, 0, Math.PI / 2]} node={node} nodeId={nodeId} network={network} rootRef={rootRef} onPreviewPosition={updatePivotPosition} isEndpoint={isEndpoint} />
      <PipeGizmoAxis color="#20df80" axis="y" directionSign={dominantAxis === 'y' ? outwardSign : 1} node={node} nodeId={nodeId} network={network} rootRef={rootRef} onPreviewPosition={updatePivotPosition} isEndpoint={isEndpoint} />
      <PipeGizmoAxis color="#2080ff" axis="z" directionSign={dominantAxis === 'z' ? outwardSign : 1} rotation={[Math.PI / 2, 0, 0]} node={node} nodeId={nodeId} network={network} rootRef={rootRef} onPreviewPosition={updatePivotPosition} isEndpoint={isEndpoint} />
    </group>
  )
}

function PipeGizmoAxis({
  color,
  axis,
  directionSign = 1,
  node,
  nodeId,
  network,
  rootRef,
  onPreviewPosition,
  isEndpoint,
  rotation = [0, 0, 0],
}: {
  color: string
  axis: 'x' | 'y' | 'z'
  directionSign?: 1 | -1
  node: PoolPipeNode['nodes'][number]
  nodeId: string
  network: PoolPipeNode
  rootRef: { current: Group | null }
  onPreviewPosition: (position: [number, number, number] | null) => void
  isEndpoint: boolean
  rotation?: [number, number, number]
}) {
  return (
    <PipeAxisHandle axis={axis} directionSign={directionSign} node={node} nodeId={nodeId} network={network} rootRef={rootRef} onPreviewPosition={onPreviewPosition} isEndpoint={isEndpoint}>
      <group rotation={rotation} scale={[1, directionSign, 1]}>
      <mesh position={[0, 0.28, 0]} frustumCulled={false} renderOrder={1300}>
        <cylinderGeometry args={[0.022 * 0.35, 0.022 * 0.35, 0.7 * 0.8, 10]} />
        <meshBasicMaterial color={color} depthTest={false} depthWrite={false} />
      </mesh>
      <mesh position={[0, 0.63, 0]} frustumCulled={false} renderOrder={1300}>
        <coneGeometry args={[0.022 * 1.6, 0.7 * 0.2, 24]} />
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
  node,
  nodeId,
  network,
  rootRef,
  onPreviewPosition,
  isEndpoint,
  children,
}: {
  axis: 'x' | 'y' | 'z'
  directionSign?: 1 | -1
  node: PoolPipeNode['nodes'][number]
  nodeId: string
  network: PoolPipeNode
  rootRef: { current: Group | null }
  onPreviewPosition: (position: [number, number, number] | null) => void
  isEndpoint: boolean
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
  const previousSnappingMode = useRef(useEditor.getState().snappingModeByContext.item)
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
    const rawDelta = parameter - startParameter.current
    // Gizmo drags use the same grid snapping as normal drawing. Alt remains
    // the explicit escape hatch for free, unsnapped endpoint placement.
    const gridStep = !detached && isGridSnapActive() ? useEditor.getState().gridSnapStep : 0
    const delta = pipeSnapDistance(rawDelta, gridStep)
    const worldPosition = startOrigin.current.clone().addScaledVector(worldAxis.current, delta)
    publishPlacementSurface(worldPosition, new Vector3(0, 1, 0))
    const localPosition = root.worldToLocal(worldPosition)
    let constrainedPosition: [number, number, number] = [localPosition.x, localPosition.y, localPosition.z]
    if (!detached && axis !== 'y') {
      const edge = startNetwork.current.edges.find((candidate) => candidate.from === nodeId || candidate.to === nodeId)
      const neighborId = edge ? (edge.from === nodeId ? edge.to : edge.from) : null
      const neighbor = neighborId
        ? startNetwork.current.nodes.find((candidate) => candidate.id === neighborId)
        : undefined
      if (neighbor && Math.hypot(localPosition.x - neighbor.position[0], localPosition.z - neighbor.position[2]) > Number.EPSILON) {
        const snapped = snapPipePointToDirection(
          neighbor.position,
          [localPosition.x, localPosition.y, localPosition.z],
          gridStep,
        )
        constrainedPosition = [snapped[0], localPosition.y, snapped[2]]
      }
    }
    const updated = isEndpoint
      ? movePipeEndpointTo(startNetwork.current, nodeId, constrainedPosition, { detach: detached })
      : movePipeNode(startNetwork.current, nodeId, [
          constrainedPosition[0] - node.position[0],
          constrainedPosition[1] - node.position[1],
          constrainedPosition[2] - node.position[2],
        ])
    onPreviewPosition(constrainedPosition)
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
        previousSnappingMode.current = useEditor.getState().snappingModeByContext.item
        useEditor.getState().setSnappingMode('item', 'grid')
        publishPlacementSurface(startOrigin.current, new Vector3(0, 1, 0))
        rootRef.current.updateMatrixWorld(true)
        startLocalPosition.current.set(...node.position)
        startNetwork.current = network
        previewNetwork.current = null
        detachedRef.current = event.altKey
        startOrigin.current.set(...node.position).applyMatrix4(rootRef.current.matrixWorld)
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
            const finalEndpoint = committedNetwork.nodes.find((candidate) => candidate.id === nodeId)
            if (finalEndpoint && isEndpoint) {
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
            nodeId,
            snapPort.position,
          ) as never
          committedNetwork = mergePipeNetworksAtEndpoints(
                      committedNetwork as never,
                      targetNetwork.data as never,
                      nodeId,
                      targetEndpointId,
                    ) as never
                    useScene.getState().deleteNode(snapPort.ownerId as never)
                  }
                } else if (snapPort.kind === 'equipment') {
                  committedNetwork = movePipeEndpointTo(
                    committedNetwork as never,
                    nodeId,
                    snapPort.position,
                  ) as never
                  committedNetwork = attachPipeNode(committedNetwork as never, nodeId, {
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
          onPreviewPosition(null)
          clearPlacementSurface()
          useEditor.getState().setSnappingMode('item', previousSnappingMode.current)
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
        // Commit the transient mesh preview exactly once, while allowing the
        // native event to reach the host's window-level marquee cleanup.
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
