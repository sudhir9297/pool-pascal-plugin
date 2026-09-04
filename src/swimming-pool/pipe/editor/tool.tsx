'use client'

import {
  type AnyNode,
  emitter,
  type GridEvent,
  runAsSingleSceneHistoryStep,
  sceneRegistry,
  snapPointToGrid,
  useScene,
} from '@pascal-app/core'
import {
  CursorSphere,
  isGridSnapActive,
  markToolCancelConsumed,
  publishPlacementSurface,
  clearPlacementSurface,
  triggerSFX,
  useInteractionScope,
  useEditor,
} from '@pascal-app/editor'
import { useViewer } from '@pascal-app/viewer'
import { useEffect, useRef, useState } from 'react'
import { useThree } from '@react-three/fiber'
import { type Group, type Material, type Mesh, Vector2, Vector3 } from 'three'
import { worldPointToPoolLevel } from '../../design/level-coordinates'
import { addPipeIntersectionFittingsToNetworks, appendPipePoint, attachPipeNode, branchPipePoint, connectPipeNetworkAtPoint, createPipeNetworkFromPoints, preparePipeNetworkForCommit, type PipeConnectionTarget, type PipeNetwork, type PipePoint } from '../../design/pipe-network'
import { routePipeOutsidePools, validatePipeSocketUse } from '../design/routing'
import { PoolPipeNode } from '../core/schema'
import { buildPipeGeometry } from '../core/geometry'
import { pipePreviewControllers } from './preview'
import { usePipeEditStore, type PipeStartConnectionKind } from './store'
import {
  collectPoolPipePorts,
  findNearestPipePort,
  findNearestPoolPipeTarget,
  type PipePort,
} from '../design/ports'
import type { PoolSkimmerNode } from '../../skimmer/core/schema'
import { resolveMountedSkimmer } from '../../skimmer/design/placement'
import type { PoolValveNode } from '../../valve/core/schema'
import type { PoolDrainNode } from '../../drain/core/schema'
import type { PoolInletNode } from '../../inlet/core/schema'
import { resolveMountedInlet } from '../../inlet/design/placement'
import { snapPipePointToDirection, snapPipePointToRay } from '../design/direction-snap'

const Y_OFFSET = 0.025

export default function PoolPipeTool() {
  const cursorRef = useRef<Group>(null)
  const previewPipeRef = useRef<Group>(null)
  const pointsRef = useRef<PipePoint[]>([])
  const cursorPointRef = useRef<PipePoint>([0, 0, 0])
  const [skimmerSnapped, setSkimmerSnapped] = useState(false)
  const pipeJoinRef = useRef<PipeConnectionTarget | null>(null)
  const pipeStartJoinRef = useRef<PipeConnectionTarget | null>(null)
  const pipePortRef = useRef<PipePort | null>(null)
  const pipeStartPortRef = useRef<PipePort | null>(null)
  const startConnectionKindRef = useRef<PipeStartConnectionKind | null>(null)
  const currentLevelId = useViewer((state) => state.selection.levelId)
  const currentBuildingId = useViewer((state) => state.selection.buildingId)
  const setSelection = useViewer((state) => state.setSelection)
  const { camera, gl, raycaster } = useThree()

  const disposeTransientPipe = (group: Group) => {
    window.setTimeout(() => {
      group.traverse((child) => {
        const mesh = child as Mesh
        if (!mesh.isMesh) return
        mesh.geometry.dispose()
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
        for (const material of materials as Material[]) material.dispose()
      })
    }, 0)
  }

  const replaceTransientPipePreview = (network: PoolPipeNode) => {
    const target = previewPipeRef.current
    if (!target) return
    const level = currentLevelId ? sceneRegistry.nodes.get(currentLevelId as never) : null
    const building = currentBuildingId ? sceneRegistry.nodes.get(currentBuildingId as never) : null
    const previewNetwork = {
      ...network,
      nodes: network.nodes.map((node) => {
        const point = new Vector3(node.position[0], node.position[1] + Y_OFFSET, node.position[2])
        level?.localToWorld(point)
        building?.worldToLocal(point)
        return { ...node, position: [point.x, point.y, point.z] as [number, number, number] }
      }),
    }
    const next = buildPipeGeometry(previewNetwork)
    const previous = target.children[0] as Group | undefined
    target.clear()
    target.add(next)
    if (previous) disposeTransientPipe(previous)
  }

  const clearTransientPipePreview = () => {
    const target = previewPipeRef.current
    if (!target) return
    const previous = target.children[0] as Group | undefined
    target.clear()
    if (previous) disposeTransientPipe(previous)
  }

  useEffect(() => {
    if (!currentLevelId) return

    // The host grid only reveals itself while the active snap context is in
    // `grid` mode. PVC drawing is a construction workflow, so it must always
    // show that lattice even if the user last left the item context on
    // alignment-lines or off. Restore the user's preference when the tool
    // exits.
    const previousPipeSnappingMode = useEditor.getState().snappingModeByContext.item
    useEditor.getState().setSnappingMode('item', 'grid')

    // Pipe It treats an armed pipe tool as the active interaction owner. This
    // prevents the generic select/V tool from claiming clicks on the scene
    // while the user is placing the next point or extending a run.
    useInteractionScope.getState().begin({ kind: 'drafting', tool: 'pool:pipe-network' })

    const setDraft = (next: PipePoint[]) => {
      pointsRef.current = next
    }
    const extension = usePipeEditStore.getState().extension
    if (extension) {
      const network = (useScene.getState().nodes as unknown as Record<string, unknown>)[extension.networkId]
      const parsed = PoolPipeNode.safeParse(network)
      const endpoint = parsed.success
        ? parsed.data.nodes.find((node) => node.id === extension.endpointId)
        : undefined
      if (endpoint) {
        // The graph stores points in the network's local frame, while the
        // drawing tool works in level-local coordinates. Keep the preview and
        // the eventual commit in their respective frames.
        const endpointLevel = new Vector3(...endpoint.position)
        const networkObject = sceneRegistry.nodes.get(extension.networkId as never)
        const levelObject = sceneRegistry.nodes.get(currentLevelId as never)
        networkObject?.localToWorld(endpointLevel)
        levelObject?.worldToLocal(endpointLevel)
        const endpointPoint: PipePoint = [endpointLevel.x, endpointLevel.y, endpointLevel.z]
        setDraft([endpointPoint])
        cursorPointRef.current = endpointPoint
      }
    }
    const pendingStart = usePipeEditStore.getState().startPoint
    if (pendingStart) {
      startConnectionKindRef.current = usePipeEditStore.getState().startConnectionKind
      setDraft([pendingStart])
      usePipeEditStore.getState().clearStartPoint()
    }
    const snapEventPoint = (event: GridEvent): { point: PipePoint; snappedToConnection: boolean } => {
      const level = sceneRegistry.nodes.get(currentLevelId as never)
      const local = worldPointToPoolLevel(level, event.position)
      const gridStep = isGridSnapActive() ? useEditor.getState().gridSnapStep : 0
      const start = pointsRef.current.at(-1)
      let constrained: PipePoint | null = null
      if (start) {
        const rect = gl.domElement.getBoundingClientRect()
        raycaster.setFromCamera(
          new Vector2(
            ((event.nativeEvent.clientX - rect.left) / rect.width) * 2 - 1,
            -((event.nativeEvent.clientY - rect.top) / rect.height) * 2 + 1,
          ),
          camera,
        )
        if (level) {
          const localOrigin = level.worldToLocal(raycaster.ray.origin.clone())
          const localRayPoint = level.worldToLocal(raycaster.ray.origin.clone().add(raycaster.ray.direction))
          const localDirection = localRayPoint.sub(localOrigin).normalize()
          constrained = snapPipePointToRay(
            start,
            [localOrigin.x, localOrigin.y, localOrigin.z],
            [localDirection.x, localDirection.y, localDirection.z],
            gridStep,
          )
        } else {
          constrained = snapPipePointToDirection(start, [local[0], local[1], local[2]], gridStep)
        }
      }
      const [x, z] = constrained
        ? [constrained[0], constrained[2]]
        : snapPointToGrid([local[0], local[2]], gridStep)
      const pools = Object.values(useScene.getState().nodes).filter((node) => (node.type as string) === 'pool:pool') as unknown as import('../../core/schema').PoolNode[]
      const pipes = Object.values(useScene.getState().nodes).filter((node) => (node.type as string) === 'pool:pipe-network') as unknown as PoolPipeNode[]
      const normalizedPorts = collectPoolPipePorts({
        nodes: Object.values(useScene.getState().nodes),
        pools,
        ignoreNetworkId: usePipeEditStore.getState().extension?.networkId,
      })
      // Direction snapping is useful for free-space and pipe-to-pipe runs,
      // but it can move the cursor across a valve body and select the socket
      // on the opposite side from the one the user is pointing at. Resolve
      // equipment from the raw cursor first, then let the normal constrained
      // point handle all other targets.
      const rawPoint: PipePoint = [local[0], local[1], local[2]]
      const equipmentPorts = normalizedPorts
        .filter((port) => port.kind === 'equipment')
        .filter((port) => {
          const offset: PipePoint = [
            rawPoint[0] - port.position[0],
            rawPoint[1] - port.position[1],
            rawPoint[2] - port.position[2],
          ]
          // A point behind a socket belongs to the opposite side of the
          // valve. Keep it out of the candidate list unless no socket is
          // visibly facing the cursor.
          const facing = offset[0] * port.direction[0] + offset[1] * port.direction[1] + offset[2] * port.direction[2]
          return facing >= -0.02
        })
      const facingEquipmentPorts = equipmentPorts.length > 0
        ? equipmentPorts
        : normalizedPorts.filter((port) => port.kind === 'equipment')
      const rawEquipmentPort = findNearestPipePort(
        rawPoint,
        facingEquipmentPorts,
        0.45,
        pipeStartPortRef.current?.ownerId,
      )
      const pipeTarget = findNearestPoolPipeTarget(
        rawEquipmentPort ? rawPoint : [x, constrained?.[1] ?? local[1], z],
        normalizedPorts,
        pipes,
        {
          ignoreNetworkId: usePipeEditStore.getState().extension?.networkId,
          // Pipe-to-pipe joining is always enabled while drawing. The cursor
          // should lock to an existing segment or fitting as it approaches;
          // magnetic snap still controls other scene interactions.
          connectionSnap: true,
          portDistance: 0.45,
          bodyDistance: 0.45,
        },
      )
      const snappedPoint = pipeTarget?.position ?? [x, constrained?.[1] ?? local[1], z]
      pipeJoinRef.current = pipeTarget?.pipeConnection ?? null
      pipePortRef.current = pipeTarget?.port?.kind === 'equipment' ? pipeTarget.port : null
      const connection = pipeTarget
      // A free-space point after a port-start inherits the port elevation.
      // This keeps valve runs level instead of dropping them to the grid.
      const keepStartElevation = pointsRef.current.length === 1 && startConnectionKindRef.current === 'level' && !connection
      const drainLead = usePipeEditStore.getState().startDirection
      const drainDrop = pointsRef.current.length === 1 && startConnectionKindRef.current === 'drain' && !connection && drainLead
        ? pointsRef.current[0]![1] + drainLead[1] * 0.18
        : null
      return {
        point: keepStartElevation
          ? [snappedPoint[0], pointsRef.current[0]![1], snappedPoint[2]]
          : drainDrop !== null
            ? [snappedPoint[0], drainDrop, snappedPoint[2]]
          : snappedPoint,
        snappedToConnection: connection !== null,
      }
    }
    const finish = (drawn: PipePoint[]) => {
      if (drawn.length < 2) return false
      const scene = useScene.getState()
      const extension = usePipeEditStore.getState().extension
      if (extension) {
        const existing = (scene.nodes as unknown as Record<string, unknown>)[extension.networkId]
        const parsed = PoolPipeNode.safeParse(existing)
        if (!parsed.success) return false
        const network = parsed.data
        const levelObject = sceneRegistry.nodes.get(currentLevelId as never)
        const networkObject = sceneRegistry.nodes.get(extension.networkId as never)
        const extensionNode = network.nodes.find((candidate) => candidate.id === extension.endpointId)
        if (!extensionNode) return false
        const toNetworkPoint = (point: PipePoint): PipePoint => {
          const transformed = new Vector3(...point)
          levelObject?.localToWorld(transformed)
          if (networkObject) networkObject.worldToLocal(transformed)
          return [transformed.x, transformed.y, transformed.z]
        }
        let updated = network as unknown as PipeNetwork
        let currentNodeId = extension.endpointId
        for (const point of drawn.slice(1)) {
          const networkPoint = toNetworkPoint(point!)
          const currentNode = updated.nodes.find((candidate) => candidate.id === currentNodeId)
          if (!currentNode) return false
          updated = currentNode.kind === 'endpoint'
            ? appendPipePoint(updated, currentNodeId, networkPoint)
            : branchPipePoint(updated, currentNodeId, networkPoint)
          currentNodeId = `n${updated.nodes.length - 1}`
        }
        if (pipePortRef.current) {
          updated = attachPipeNode(updated as never, currentNodeId, {
            ownerId: pipePortRef.current.ownerId,
            portId: pipePortRef.current.id,
            kind: 'equipment',
          }) as never
        }
        const otherPipes = Object.values(scene.nodes)
          .filter((node) => (node.type as string) === 'pool:pipe-network' && (node as unknown as PoolPipeNode).id !== network.id) as unknown as PoolPipeNode[]
        const join = pipeJoinRef.current
        const joinNode = join ? (scene.nodes as unknown as Record<string, unknown>)[join.networkId] : undefined
        const joinNetwork = joinNode ? PoolPipeNode.safeParse(joinNode) : null
        const joinedNetwork = join && joinNetwork?.success
          ? preparePipeNetworkForCommit(connectPipeNetworkAtPoint(
              joinNetwork.data,
              updated,
              join.edgeId,
              join.position,
              `n${updated.nodes.length - 1}`,
            ))
          : null
        const resolvedNetworks = joinedNetwork
          ? [joinedNetwork, ...otherPipes.filter((other) => other.id !== joinedNetwork.id)]
          : addPipeIntersectionFittingsToNetworks([updated, ...otherPipes] as unknown as PipeNetwork[])
        updated = joinedNetwork ?? resolvedNetworks[0]!
        runAsSingleSceneHistoryStep(useScene, () => {
          if (joinedNetwork) {
            scene.deleteNode(network.id as never)
            scene.updateNode(joinedNetwork.id as never, {
              nodes: joinedNetwork.nodes,
              edges: joinedNetwork.edges,
              attachments: joinedNetwork.attachments,
            } as unknown as Partial<AnyNode>)
          }
          for (const [index, other] of otherPipes.filter((candidate) => !joinedNetwork || candidate.id !== joinedNetwork.id).entries()) {
            const updatedOther = joinedNetwork ? other : resolvedNetworks[index + 1]!
            scene.updateNode(
              other.id as never,
              { nodes: updatedOther.nodes, edges: updatedOther.edges } as unknown as Partial<AnyNode>,
            )
          }
          if (!joinedNetwork) scene.updateNode(network.id as never, { nodes: updated.nodes, edges: updated.edges } as unknown as Partial<AnyNode>)
        })
        const resultNetworkId = joinedNetwork?.id ?? network.id
        pipePreviewControllers.get(extension.networkId)?.reset()
        if (joinedNetwork) pipePreviewControllers.get(joinedNetwork.id)?.reset()
        setSelection({ selectedIds: [resultNetworkId] })
        triggerSFX('sfx:structure-build')
        pipePortRef.current = null
        pipeStartPortRef.current = null
        startConnectionKindRef.current = null
        if (usePipeEditStore.getState().continuousDrawing) {
          const nextEndpointId = updated.nodes.at(-1)?.id
          if (!nextEndpointId) return false
          usePipeEditStore.getState().beginExtension({ networkId: resultNetworkId, endpointId: nextEndpointId })
          setDraft([drawn[1]!])
        } else {
          usePipeEditStore.getState().clearExtension()
          useEditor.getState().setTool(null)
          useEditor.getState().setMode('select')
          setDraft([])
        }
        return true
      }
      const networkCount = Object.values(scene.nodes)
        .filter((node) => (node.type as string) === 'pool:pipe-network').length
      const graph = createPipeNetworkFromPoints(
        `pipe-network_${Date.now()}`,
        currentLevelId,
        drawn,
      )
      let pipeGraph = graph
      const existingPipes = Object.values(scene.nodes)
        .filter((node) => (node.type as string) === 'pool:pipe-network') as unknown as PoolPipeNode[]
      const join = pipeJoinRef.current
      const startJoin = pipeStartJoinRef.current
      const selectedJoin = join ?? startJoin
      const crossingPipes = existingPipes.filter((existing) => selectedJoin?.networkId !== existing.id)
      const resolvedNetworks = addPipeIntersectionFittingsToNetworks([pipeGraph, ...crossingPipes] as unknown as PipeNetwork[])
      pipeGraph = resolvedNetworks[0]!
      let pipe = PoolPipeNode.parse({
        ...preparePipeNetworkForCommit(pipeGraph),
        id: undefined,
        name: `PVC Pipe Network ${networkCount + 1}`,
      } as unknown as PoolPipeNode)
      if (pipeStartPortRef.current) {
        pipe = attachPipeNode(pipe as unknown as PipeNetwork, 'n0', {
          ownerId: pipeStartPortRef.current.ownerId,
          portId: pipeStartPortRef.current.id,
          kind: 'equipment',
        }) as unknown as PoolPipeNode
      }
      if (pipePortRef.current) {
        pipe = attachPipeNode(pipe as unknown as PipeNetwork, `n${pipe.nodes.length - 1}`, {
          ownerId: pipePortRef.current.ownerId,
          portId: pipePortRef.current.id,
          kind: 'equipment',
        }) as unknown as PoolPipeNode
      }
      // If both ends of a new run are snapped to existing networks, consume
      // both joins explicitly. The ordinary path can only merge one target,
      // which leaves the opposite end as a bare intersection without its
      // fitting.
      if (startJoin && join && startJoin.networkId !== join.networkId) {
        const startNode = (scene.nodes as unknown as Record<string, unknown>)[startJoin.networkId]
        const endNode = (scene.nodes as unknown as Record<string, unknown>)[join.networkId]
        const startNetwork = startNode ? PoolPipeNode.safeParse(startNode) : null
        const endNetwork = endNode ? PoolPipeNode.safeParse(endNode) : null
        if (startNetwork?.success && endNetwork?.success) {
          const mergedAtStart = connectPipeNetworkAtPoint(startNetwork.data, pipe, startJoin.edgeId, startJoin.position, 'n0')
          const incomingEndId = mergedAtStart.nodes.at(-1)?.id
          const mergedAtBoth = incomingEndId
            ? preparePipeNetworkForCommit(connectPipeNetworkAtPoint(endNetwork.data, mergedAtStart, join.edgeId, join.position, incomingEndId))
            : null
          if (mergedAtBoth) {
            runAsSingleSceneHistoryStep(useScene, () => {
              scene.deleteNode(startNetwork.data.id as never)
              scene.updateNode(endNetwork.data.id as never, {
                nodes: mergedAtBoth.nodes,
                edges: mergedAtBoth.edges,
                attachments: mergedAtBoth.attachments,
              } as unknown as Partial<AnyNode>)
            })
            pipePreviewControllers.get(startNetwork.data.id)?.reset()
            pipePreviewControllers.get(endNetwork.data.id)?.reset()
            setSelection({ selectedIds: [endNetwork.data.id] })
            triggerSFX('sfx:structure-build')
            pipeJoinRef.current = null
            pipeStartJoinRef.current = null
            usePipeEditStore.getState().clearExtension()
            useEditor.getState().setTool(null)
            useEditor.getState().setMode('select')
            setDraft([])
            return true
          }
        }
      }
      const joinNode = selectedJoin ? (scene.nodes as unknown as Record<string, unknown>)[selectedJoin.networkId] : undefined
      const joinNetwork = joinNode ? PoolPipeNode.safeParse(joinNode) : null
      if (selectedJoin && joinNetwork?.success) {
        const merged = preparePipeNetworkForCommit(connectPipeNetworkAtPoint(
          joinNetwork.data,
          pipe,
          selectedJoin.edgeId,
          selectedJoin.position,
          startJoin && !join ? 'n0' : undefined,
        ))
        runAsSingleSceneHistoryStep(useScene, () => {
          for (const [index, existing] of crossingPipes.entries()) {
            const updatedExisting = preparePipeNetworkForCommit(resolvedNetworks[index + 1]!)
            scene.updateNode(existing.id as never, { nodes: updatedExisting.nodes, edges: updatedExisting.edges } as unknown as Partial<AnyNode>)
          }
          scene.updateNode(joinNetwork.data.id as never, { nodes: merged.nodes, edges: merged.edges } as unknown as Partial<AnyNode>)
        })
        setSelection({ selectedIds: [joinNetwork.data.id] })
        useEditor.getState().setTool(null)
        useEditor.getState().setMode('select')
        triggerSFX('sfx:structure-build')
        pipeJoinRef.current = null
        pipeStartJoinRef.current = null
        pipePortRef.current = null
        pipeStartPortRef.current = null
        setDraft([])
        return true
      }
      runAsSingleSceneHistoryStep(useScene, () => {
        for (const [index, existing] of crossingPipes.entries()) {
          const updatedExisting = preparePipeNetworkForCommit(resolvedNetworks[index + 1]!)
          scene.updateNode(existing.id as never, { nodes: updatedExisting.nodes, edges: updatedExisting.edges } as unknown as Partial<AnyNode>)
        }
        scene.createNode(preparePipeNetworkForCommit(pipe) as unknown as AnyNode, currentLevelId)
      })
      clearTransientPipePreview()
      setSelection({ selectedIds: [pipe.id] })
      triggerSFX('sfx:structure-build')
      if (usePipeEditStore.getState().continuousDrawing) {
        setDraft([drawn.at(-1)!])
        pipeJoinRef.current = null
        pipeStartJoinRef.current = null
        pipePortRef.current = null
        pipeStartPortRef.current = null
      } else {
        useEditor.getState().setTool(null)
        useEditor.getState().setMode('select')
        setDraft([])
      }
      return true
    }
    const reset = () => {
      clearPlacementSurface()
      if (pointsRef.current.length > 0) markToolCancelConsumed()
      const activeExtension = usePipeEditStore.getState().extension
      usePipeEditStore.getState().clearExtension()
      startConnectionKindRef.current = null
      pipeJoinRef.current = null
      pipeStartJoinRef.current = null
      pipePortRef.current = null
      pipeStartPortRef.current = null
      setDraft([])
      clearTransientPipePreview()
      if (activeExtension) pipePreviewControllers.get(activeExtension.networkId)?.reset()
      useInteractionScope.getState().endIf((scope) =>
        scope.kind === 'drafting' && scope.tool === 'pool:pipe-network',
      )
    }
    const onMove = (event: GridEvent) => {
      // Drive the editor's cursor-local reveal grid while Pipe is active,
      // using the same placement-surface channel as wall and pool drawing.
      publishPlacementSurface(new Vector3(event.position[0], event.position[1], event.position[2]), new Vector3(0, 1, 0))
      const resolved = snapEventPoint(event)
      const next = resolved.point
      cursorPointRef.current = next
      const draft = pointsRef.current
      const extension = usePipeEditStore.getState().extension
      if (draft.length > 0) {
        if (extension) {
          const existing = (useScene.getState().nodes as unknown as Record<string, unknown>)[extension.networkId]
          const parsed = PoolPipeNode.safeParse(existing)
          const extensionNode = parsed.success
            ? parsed.data.nodes.find((candidate) => candidate.id === extension.endpointId)
            : undefined
          if (parsed.success && extensionNode) {
            const previewRoute: PipePoint[] = [pointsRef.current[0]!, next]
            const levelObject = sceneRegistry.nodes.get(currentLevelId as never)
            const networkObject = sceneRegistry.nodes.get(extension.networkId as never)
            let preview = parsed.data as unknown as PipeNetwork
            let currentNodeId = extension.endpointId
            for (const point of previewRoute.slice(1)) {
              const destination = new Vector3(...point)
              levelObject?.localToWorld(destination)
              networkObject?.worldToLocal(destination)
              const networkPoint: PipePoint = [destination.x, destination.y, destination.z]
              const currentNode = preview.nodes.find((candidate) => candidate.id === currentNodeId)
              if (!currentNode) break
              preview = currentNode.kind === 'endpoint'
                ? appendPipePoint(preview, currentNodeId, networkPoint)
                : branchPipePoint(preview, currentNodeId, networkPoint)
              currentNodeId = `n${preview.nodes.length - 1}`
            }
            pipePreviewControllers.get(extension.networkId)?.preview(preview as unknown as PoolPipeNode)
          }
        } else if (draft.length === 1) {
          const previewRoute: PipePoint[] = [draft[0]!, next]
          const preview = createPipeNetworkFromPoints('pipe-preview', null, previewRoute)
          replaceTransientPipePreview(preview as unknown as PoolPipeNode)
        }
      } else {
        clearTransientPipePreview()
      }
      setSkimmerSnapped(resolved.snappedToConnection)
      if (cursorRef.current) {
        const worldCursor = new Vector3(next[0], next[1] + Y_OFFSET, next[2])
        sceneRegistry.nodes.get(currentLevelId as never)?.localToWorld(worldCursor)
        sceneRegistry.nodes.get(currentBuildingId as never)?.worldToLocal(worldCursor)
        cursorRef.current.position.copy(worldCursor)
      }
    }
    const onClick = (event: GridEvent) => {
      const next = snapEventPoint(event).point
      const previous = pointsRef.current.at(-1)
      if (previous && previous[0] === next[0] && previous[1] === next[1] && previous[2] === next[2]) return
      const drawn = [...pointsRef.current, next]
      if (drawn.length === 2) {
        const pools = Object.values(useScene.getState().nodes).filter((node) => (node.type as string) === 'pool:pool') as unknown as import('../../core/schema').PoolNode[]
        const skimmers = Object.values(useScene.getState().nodes).filter((node) => (node.type as string) === 'pool:skimmer')
          .map((node) => resolveMountedSkimmer(node as unknown as PoolSkimmerNode, pools.find((pool) => pool.id === (node as unknown as PoolSkimmerNode).poolId)))
        const pipes = Object.values(useScene.getState().nodes).filter((node) => (node.type as string) === 'pool:pipe-network') as unknown as PoolPipeNode[]
        const extension = usePipeEditStore.getState().extension
        const valves = Object.values(useScene.getState().nodes).filter((node) => (node.type as string) === 'pool:valve') as unknown as PoolValveNode[]
        const drains = Object.values(useScene.getState().nodes).filter((node) => (node.type as string) === 'pool:drain') as unknown as PoolDrainNode[]
        const inlets = Object.values(useScene.getState().nodes).filter((node) => (node.type as string) === 'pool:inlet')
          .map((node) => resolveMountedInlet(node as unknown as PoolInletNode, pools.find((pool) => pool.id === (node as unknown as PoolInletNode).poolId)))
        if (!validatePipeSocketUse(drawn, skimmers, pipes, extension?.networkId, valves, drains, inlets).valid) return
        const lead = usePipeEditStore.getState().startDirection ?? undefined
        let routed = extension
          ? drawn
          : routePipeOutsidePools(drawn[0]!, drawn[1]!, pools, lead)
        finish(routed)
        return
      }
      if (pipeJoinRef.current) pipeStartJoinRef.current = pipeJoinRef.current
      if (pipePortRef.current) pipeStartPortRef.current = pipePortRef.current
      setDraft([next])
      triggerSFX('sfx:structure-build-start')
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'c') {
        event.preventDefault()
        usePipeEditStore.getState().toggleContinuousDrawing()
        return
      }
      if (event.key !== 'Enter') return
      event.preventDefault()
      finish(pointsRef.current)
    }

    emitter.on('grid:move', onMove)
    emitter.on('grid:click', onClick)
    emitter.on('tool:cancel', reset)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      emitter.off('grid:move', onMove)
      emitter.off('grid:click', onClick)
      emitter.off('tool:cancel', reset)
      document.removeEventListener('keydown', onKeyDown)
      clearPlacementSurface()
      useEditor.getState().setSnappingMode('item', previousPipeSnappingMode)
      useInteractionScope.getState().endIf((scope) =>
        scope.kind === 'drafting' && scope.tool === 'pool:pipe-network',
      )
    }
  }, [currentBuildingId, currentLevelId, setSelection])

  return (
    <group>
      <CursorSphere color={skimmerSnapped ? '#22c55e' : '#f97316'} ref={cursorRef} />
      <group ref={previewPipeRef} />
    </group>
  )
}
