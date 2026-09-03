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
      const pipeTarget = findNearestPoolPipeTarget(
        [x, constrained?.[1] ?? local[1], z],
        normalizedPorts,
        pipes,
        { ignoreNetworkId: usePipeEditStore.getState().extension?.networkId },
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
        const destination = new Vector3(...drawn[1]!)
        const levelObject = sceneRegistry.nodes.get(currentLevelId as never)
        const networkObject = sceneRegistry.nodes.get(extension.networkId as never)
        levelObject?.localToWorld(destination)
        if (networkObject) networkObject.worldToLocal(destination)
        const networkPoint: PipePoint = [destination.x, destination.y, destination.z]
        const extensionNode = network.nodes.find((candidate) => candidate.id === extension.endpointId)
        if (!extensionNode) return false
        let updated = extensionNode.kind === 'endpoint'
          ? appendPipePoint(network, extension.endpointId, networkPoint)
          : branchPipePoint(network, extension.endpointId, networkPoint)
        if (pipePortRef.current) {
          updated = attachPipeNode(updated as never, `n${updated.nodes.length - 1}`, {
            ownerId: pipePortRef.current.ownerId,
            portId: pipePortRef.current.id,
            kind: 'equipment',
          }) as never
        }
        const otherPipes = Object.values(scene.nodes)
          .filter((node) => (node.type as string) === 'pool:pipe-network' && (node as unknown as PoolPipeNode).id !== network.id) as unknown as PoolPipeNode[]
        const resolvedNetworks = addPipeIntersectionFittingsToNetworks([updated, ...otherPipes] as unknown as PipeNetwork[])
        updated = resolvedNetworks[0]!
        runAsSingleSceneHistoryStep(useScene, () => {
          for (const [index, other] of otherPipes.entries()) {
            const updatedOther = resolvedNetworks[index + 1]!
            scene.updateNode(
              other.id as never,
              { nodes: updatedOther.nodes, edges: updatedOther.edges } as unknown as Partial<AnyNode>,
            )
          }
          scene.updateNode(
            network.id as never,
            { nodes: updated.nodes, edges: updated.edges } as unknown as Partial<AnyNode>,
          )
        })
        pipePreviewControllers.get(extension.networkId)?.reset()
        setSelection({ selectedIds: [network.id] })
        usePipeEditStore.getState().clearExtension()
        startConnectionKindRef.current = null
        useEditor.getState().setTool(null)
        useEditor.getState().setMode('select')
        triggerSFX('sfx:structure-build')
        setDraft([])
        pipePortRef.current = null
        pipeStartPortRef.current = null
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
            const destination = new Vector3(...next)
            sceneRegistry.nodes.get(currentLevelId as never)?.localToWorld(destination)
            sceneRegistry.nodes.get(extension.networkId as never)?.worldToLocal(destination)
            const networkPoint: PipePoint = [destination.x, destination.y, destination.z]
            const preview = extensionNode.kind === 'endpoint'
              ? appendPipePoint(parsed.data, extension.endpointId, networkPoint)
              : branchPipePoint(parsed.data, extension.endpointId, networkPoint)
            pipePreviewControllers.get(extension.networkId)?.preview(preview as unknown as PoolPipeNode)
          }
        } else if (draft.length === 1) {
          const preview = createPipeNetworkFromPoints('pipe-preview', null, [draft[0]!, next])
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
        const routed = extension ? drawn : routePipeOutsidePools(drawn[0]!, drawn[1]!, pools, lead)
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
