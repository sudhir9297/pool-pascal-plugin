'use client'

import {
  type AnyNode,
  emitter,
  type GridEvent,
  sceneRegistry,
  snapPointToGrid,
  useScene,
} from '@pascal-app/core'
import {
  CursorSphere,
  EDITOR_LAYER,
  isGridSnapActive,
  markToolCancelConsumed,
  triggerSFX,
  useEditor,
} from '@pascal-app/editor'
import { useViewer } from '@pascal-app/viewer'
import { useEffect, useRef, useState } from 'react'
import { BufferGeometry, type Group, type Line, Vector3 } from 'three'
import { worldPointToPoolLevel } from '../../design/level-coordinates'
import { appendPipePoint, createPipeNetworkFromPoints, type PipePoint } from '../../design/pipe-network'
import { routePipeOutsidePools, validatePipeSocketUse } from '../design/routing'
import { PoolPipeNode } from '../core/schema'
import { usePipeEditStore } from './store'
import { findNearestSkimmerConnection } from '../../skimmer/design/placement'
import type { PoolSkimmerNode } from '../../skimmer/core/schema'
import { resolveMountedSkimmer } from '../../skimmer/design/placement'
import type { PoolValveNode } from '../../valve/core/schema'
import { findNearestValveConnection } from '../../valve/design/placement'

const Y_OFFSET = 0.025

export default function PoolPipeTool() {
  const cursorRef = useRef<Group>(null)
  const lineRef = useRef<Line>(null!)
  const pointsRef = useRef<PipePoint[]>([])
  const [points, setPoints] = useState<PipePoint[]>([])
  const [cursor, setCursor] = useState<PipePoint>([0, 0, 0])
  const [skimmerSnapped, setSkimmerSnapped] = useState(false)
  const currentLevelId = useViewer((state) => state.selection.levelId)
  const currentBuildingId = useViewer((state) => state.selection.buildingId)
  const setSelection = useViewer((state) => state.setSelection)

  useEffect(() => {
    if (!currentLevelId) return

    const setDraft = (next: PipePoint[]) => {
      pointsRef.current = next
      setPoints(next)
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
        setCursor(endpointPoint)
      }
    }
    const pendingStart = usePipeEditStore.getState().startPoint
    if (pendingStart) {
      setDraft([pendingStart])
      usePipeEditStore.getState().clearStartPoint()
    }
    const snapEventPoint = (event: GridEvent): { point: PipePoint; snappedToConnection: boolean } => {
      const level = sceneRegistry.nodes.get(currentLevelId as never)
      const local = worldPointToPoolLevel(level, event.position)
      const gridStep = isGridSnapActive() ? useEditor.getState().gridSnapStep : 0
      const [x, z] = snapPointToGrid([local[0], local[2]], gridStep)
      const pools = Object.values(useScene.getState().nodes).filter((node) => (node.type as string) === 'pool:pool') as unknown as import('../../core/schema').PoolNode[]
      const skimmers = Object.values(useScene.getState().nodes).filter((node) => (node.type as string) === 'pool:skimmer')
        .map((node) => resolveMountedSkimmer(node as unknown as PoolSkimmerNode, pools.find((pool) => pool.id === (node as unknown as PoolSkimmerNode).poolId)))
      const valves = Object.values(useScene.getState().nodes).filter((node) => (node.type as string) === 'pool:valve') as unknown as PoolValveNode[]
      const skimmerConnection = findNearestSkimmerConnection([x, local[1], z], skimmers)
      const valveConnection = findNearestValveConnection([x, local[1], z], valves)
      const connection = [skimmerConnection, valveConnection]
        .filter((candidate): candidate is NonNullable<typeof candidate> => candidate !== null)
        .sort((a, b) => Math.hypot(x - a.position[0], z - a.position[2]) - Math.hypot(x - b.position[0], z - b.position[2]))[0]
      return { point: connection?.position ?? [x, local[1], z], snappedToConnection: connection !== undefined }
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
        const updated = appendPipePoint(network, extension.endpointId, networkPoint)
        scene.updateNode(
          network.id as never,
          { nodes: updated.nodes, edges: updated.edges } as unknown as Partial<AnyNode>,
        )
        setSelection({ selectedIds: [network.id] })
        usePipeEditStore.getState().clearExtension()
        useEditor.getState().setTool(null)
        useEditor.getState().setMode('select')
        triggerSFX('sfx:structure-build')
        setDraft([])
        return true
      }
      const networkCount = Object.values(scene.nodes)
        .filter((node) => (node.type as string) === 'pool:pipe-network').length
      const graph = createPipeNetworkFromPoints(
        `pipe-network_${Date.now()}`,
        currentLevelId,
        drawn,
      )
      const pipe = PoolPipeNode.parse({
        ...graph,
        id: undefined,
        name: `PVC Pipe Network ${networkCount + 1}`,
      } as unknown as PoolPipeNode)
      scene.createNode(pipe as unknown as AnyNode, currentLevelId)
      setSelection({ selectedIds: [pipe.id] })
      useEditor.getState().setTool(null)
      useEditor.getState().setMode('select')
      triggerSFX('sfx:structure-build')
      setDraft([])
      return true
    }
    const reset = () => {
      if (pointsRef.current.length > 0) markToolCancelConsumed()
      usePipeEditStore.getState().clearExtension()
      setDraft([])
    }
    const onMove = (event: GridEvent) => {
      const resolved = snapEventPoint(event)
      const next = resolved.point
      setCursor(next)
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
        if (!validatePipeSocketUse(drawn, skimmers, pipes, extension?.networkId).valid) return
        const lead = usePipeEditStore.getState().startDirection ?? undefined
        const routed = extension ? drawn : routePipeOutsidePools(drawn[0]!, drawn[1]!, pools, lead)
        finish(routed)
        return
      }
      setDraft([next])
      triggerSFX('sfx:structure-build-start')
    }
    const onKeyDown = (event: KeyboardEvent) => {
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
    }
  }, [currentBuildingId, currentLevelId, setSelection])

  useEffect(() => {
    if (!lineRef.current) return
    lineRef.current.geometry.dispose()
    const preview = points.length > 0 ? [...points, cursor] : []
    const level = currentLevelId ? sceneRegistry.nodes.get(currentLevelId as never) : null
    const building = currentBuildingId ? sceneRegistry.nodes.get(currentBuildingId as never) : null
    lineRef.current.geometry = new BufferGeometry().setFromPoints(
      preview.map(([x, y, z]) => {
        const worldPoint = new Vector3(x, y + Y_OFFSET, z)
        level?.localToWorld(worldPoint)
        building?.worldToLocal(worldPoint)
        return worldPoint
      }),
    )
    lineRef.current.visible = preview.length > 1
  }, [currentBuildingId, currentLevelId, cursor, points])

  return (
    <group>
      <CursorSphere color={skimmerSnapped ? '#22c55e' : '#f97316'} ref={cursorRef} />
      {/* @ts-ignore */}
      <line frustumCulled={false} layers={EDITOR_LAYER} ref={lineRef} visible={false}>
        <bufferGeometry />
        <lineBasicNodeMaterial color="#f97316" depthTest={false} depthWrite={false} linewidth={3} />
      </line>
    </group>
  )
}
