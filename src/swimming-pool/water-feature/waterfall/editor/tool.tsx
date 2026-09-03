'use client'

import { type AnyNode, emitter, type GridEvent, sceneRegistry, snapPointToGrid, useScene } from '@pascal-app/core'
import { CursorSphere, isGridSnapActive, markToolCancelConsumed, triggerSFX, useEditor } from '@pascal-app/editor'
import { useViewer } from '@pascal-app/viewer'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Group, Material, Mesh } from 'three'
import type { PoolNode } from '../../../core/schema'
import { worldPointToPoolLevel } from '../../../design/level-coordinates'
import { DEFAULT_POOL_WATERFALL, poolWaterfallDefinition } from '../core/definition'
import { buildWaterfallGeometry } from '../core/geometry'
import { PoolWaterfallNode } from '../core/schema'
import { findNearestWaterfallPlacement, type WaterfallPlacement } from '../design/placement'

export default function PoolWaterfallTool() {
  const cursorRef = useRef<Group>(null)
  const levelId = useViewer((state) => state.selection.levelId)
  const setSelection = useViewer((state) => state.setSelection)
  const [placement, setPlacement] = useState<WaterfallPlacement | null>(null)
  const ghostNode = useMemo(() => PoolWaterfallNode.parse({
    ...poolWaterfallDefinition.defaults(),
    receivingPoolEnabled: false,
    fountainEnabled: false,
    showFlow: false,
  }), [])

  useEffect(() => {
    if (!levelId) return
    const getPlacement = (event: GridEvent) => {
      const level = sceneRegistry.nodes.get(levelId as never)
      const local = worldPointToPoolLevel(level, event.position)
      const step = isGridSnapActive() ? useEditor.getState().gridSnapStep : 0
      const point = snapPointToGrid([local[0], local[2]], step)
      const pools = Object.values(useScene.getState().nodes)
        .filter((node) => String((node as unknown as { type?: unknown }).type) === 'pool:pool')
        .filter((node) => (node as unknown as { parentId?: string | null }).parentId === levelId) as unknown as PoolNode[]
      return findNearestWaterfallPlacement(point, pools, DEFAULT_POOL_WATERFALL.width)
    }
    const onMove = (event: GridEvent) => {
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
      const count = Object.values(useScene.getState().nodes)
        .filter((node) => String((node as unknown as { type?: unknown }).type) === 'pool:waterfall').length
      const waterfall = PoolWaterfallNode.parse({
        ...DEFAULT_POOL_WATERFALL,
        id: undefined,
        name: `Waterfall ${count + 1}`,
        parentId: levelId,
        position: next.position,
        rotation: next.rotation,
        poolId: next.poolId,
        wallIndex: next.wallIndex,
        wallT: next.wallT,
        edgeCurve: next.edgeCurve,
        targetWaterOffset: next.targetWaterOffset,
        waterColor: next.waterColor,
        waterPreset: next.waterPreset,
        shallowWaterColor: next.shallowWaterColor,
        deepWaterColor: next.deepWaterColor,
        receivingPoolEnabled: false,
      })
      useScene.getState().createNode(waterfall as unknown as AnyNode, levelId)
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
    emitter.on('grid:move', onMove)
    emitter.on('grid:click', place)
    emitter.on('tool:cancel', cancel)
    return () => {
      emitter.off('grid:move', onMove)
      emitter.off('grid:click', place)
      emitter.off('tool:cancel', cancel)
      setPlacement(null)
    }
  }, [levelId, setSelection])

  return (
    <group>
      <CursorSphere color={placement ? '#22c55e' : '#f97316'} ref={cursorRef} />
      {placement && <WaterfallGhost node={ghostNode} placement={placement} />}
    </group>
  )
}

function WaterfallGhost({ node, placement }: { node: PoolWaterfallNode; placement: WaterfallPlacement }) {
  const geometry = useMemo(() => {
    const group = buildWaterfallGeometry(PoolWaterfallNode.parse({
      ...node,
      ...placement,
      receivingPoolEnabled: false,
      fountainEnabled: false,
      showFlow: false,
    }))
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
  }, [node, placement])
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
  return <primitive object={geometry} position={placement.position} rotation={placement.rotation} />
}
