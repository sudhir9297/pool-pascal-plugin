'use client'

import { emitter, type GridEvent, sceneRegistry, snapPointToGrid, useScene } from '@pascal-app/core'
import { CursorSphere, isGridSnapActive, markToolCancelConsumed, triggerSFX, useEditor } from '@pascal-app/editor'
import { useViewer } from '@pascal-app/viewer'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Group, Material, Mesh } from 'three'
import { countNodesByType, createPoolPluginNode, getPoolNodes } from '../../../editor/scene-nodes'
import { worldPointToPoolLevel } from '../../../design/level-coordinates'
import { isPlacementRotationKey } from '../../../editor/placement-rotation'
import { PoolLevelPreviewGroup } from '../../../editor/level-preview-group'
import { useAttachmentPool } from '../../../editor/attachment-pool'
import { buildWaterfallGeometry } from '../core/geometry'
import { DEFAULT_POOL_WATERFALL, PoolWaterfallNode } from '../core/schema'
import { createStandaloneWaterfallPlacement, findNearestWaterfallPlacement, resolveMountedWaterfall, type WaterfallPlacement } from '../design/placement'

export default function PoolWaterfallTool() {
  const cursorRef = useRef<Group>(null)
  const levelId = useViewer((state) => state.selection.levelId)
  const setSelection = useViewer((state) => state.setSelection)
  const [placement, setPlacement] = useState<WaterfallPlacement | null>(null)
  const ghostNode = useMemo(() => PoolWaterfallNode.parse({
    ...DEFAULT_POOL_WATERFALL,
    receivingPoolEnabled: false,
    showFlow: false,
  }), [])

  useEffect(() => {
    if (!levelId) return
    let yaw = 0
    let lastMove: GridEvent | null = null
    const getPlacement = (event: GridEvent) => {
      const level = sceneRegistry.nodes.get(levelId as never)
      const local = worldPointToPoolLevel(level, event.position)
      const step = isGridSnapActive() ? useEditor.getState().gridSnapStep : 0
      const point = snapPointToGrid([local[0], local[2]], step)
      const pools = getPoolNodes(useScene.getState().nodes, levelId)
      return findNearestWaterfallPlacement(point, pools, DEFAULT_POOL_WATERFALL.width)
        ?? createStandaloneWaterfallPlacement([point[0], local[1], point[1]], { ...ghostNode, rotation: [0, yaw, 0] })
    }
    const onMove = (event: GridEvent) => {
      lastMove = event
      const next = getPlacement(event)
      setPlacement(next)
      if (!cursorRef.current) return
      if (next) cursorRef.current.position.set(...next.position)
      else {
        const level = sceneRegistry.nodes.get(levelId as never)
        const local = worldPointToPoolLevel(level, event.position)
        cursorRef.current.position.set(local[0], local[1], local[2])
      }
    }
    const place = (event: GridEvent) => {
      const next = getPlacement(event)
      if (!next) return
      const count = countNodesByType(useScene.getState().nodes, 'pool:waterfall')
      const waterfall = PoolWaterfallNode.parse({
        ...DEFAULT_POOL_WATERFALL,
        id: undefined,
        name: `Waterfall ${count + 1}`,
        parentId: levelId,
        position: next.position,
        rotation: next.rotation,
        poolId: next.poolId,
        autoSizeOnPool: true,
        wallIndex: next.wallIndex,
        wallT: next.wallT,
        edgeCurve: next.edgeCurve,
        targetWaterOffset: next.targetWaterOffset,
        waterPreset: next.waterPreset,
        shallowWaterColor: next.shallowWaterColor,
        deepWaterColor: next.deepWaterColor,
        poolRockSeed: next.poolRockSeed,
        receivingPoolEnabled: next.poolId === null,
      })
      createPoolPluginNode(waterfall, levelId)
      setSelection({ selectedIds: [waterfall.id] })
      useEditor.getState().setTool(null)
      useEditor.getState().setMode('select')
      triggerSFX('sfx:structure-build')
    }
    const cancel = () => {
      markToolCancelConsumed()
      setPlacement(null)
      useEditor.getState().setTool(null)
      useEditor.getState().setMode('select')
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isPlacementRotationKey(event)) return
      event.preventDefault()
      event.stopPropagation()
      yaw = (yaw + Math.PI / 2) % (Math.PI * 2)
      if (lastMove) onMove(lastMove)
    }
    window.addEventListener('keydown', onKeyDown, true)
    emitter.on('grid:move', onMove)
    emitter.on('grid:click', place)
    emitter.on('tool:cancel', cancel)
    const unsubscribe = useScene.subscribe((state, previous) => {
      if (state.nodes !== previous.nodes && lastMove) onMove(lastMove)
    })
    return () => {
      unsubscribe()
      window.removeEventListener('keydown', onKeyDown, true)
      emitter.off('grid:move', onMove)
      emitter.off('grid:click', place)
      emitter.off('tool:cancel', cancel)
      setPlacement(null)
    }
  }, [ghostNode, levelId, setSelection])

  return (
    <PoolLevelPreviewGroup>
      <CursorSphere color={placement ? '#22c55e' : '#f97316'} ref={cursorRef} />
      {placement && <WaterfallGhost node={ghostNode} placement={placement} />}
    </PoolLevelPreviewGroup>
  )
}

function WaterfallGhost({ node, placement }: { node: PoolWaterfallNode; placement: WaterfallPlacement }) {
  const pool = useAttachmentPool(placement.poolId)
  const mounted = useMemo(() => resolveMountedWaterfall(PoolWaterfallNode.parse({
    ...node,
    ...placement,
    autoSizeOnPool: true,
    receivingPoolEnabled: placement.poolId === null,
    showFlow: false,
  }), pool), [node, placement, pool])
  const geometry = useMemo(() => {
    const group = buildWaterfallGeometry(mounted)
    group.traverse((child) => {
      const mesh = child as Mesh
      if (!mesh.isMesh) return
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      for (const material of materials as Material[]) {
        material.transparent = true
        material.opacity = 0.42
        material.depthWrite = false
      }
    })
    return group
  }, [mounted])
  useEffect(() => () => {
    const materials = new Set<Material>()
    geometry.traverse((child) => {
      const mesh = child as Mesh
      if (!mesh.isMesh) return
      mesh.geometry.dispose()
      const values = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      for (const material of values as Material[]) materials.add(material)
    })
    for (const material of materials) material.dispose()
  }, [geometry])
  return <primitive object={geometry} position={mounted.position} rotation={mounted.rotation} />
}
