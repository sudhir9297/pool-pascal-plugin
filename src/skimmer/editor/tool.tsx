'use client'

import { emitter, type GridEvent, sceneRegistry, snapPointToGrid, useScene } from '@pascal-app/core'
import { CursorSphere, isGridSnapActive, markToolCancelConsumed, triggerSFX, useEditor } from '@pascal-app/editor'
import { useViewer } from '@pascal-app/viewer'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Group, Material, Mesh } from 'three'
import { worldPointToPoolLevel } from '../../design/level-coordinates'
import { disposeObject3D } from '../../editor/dispose-object'
import { countNodesByType, createPoolPluginNode, getPoolNodes } from '../../editor/scene-nodes'
import { findNearestPoolWall, type SkimmerPlacement } from '../design/placement'
import { DEFAULT_POOL_SKIMMER, PoolSkimmerNode } from '../core/schema'
import { buildSkimmerGeometry } from '../core/geometry'

export default function PoolSkimmerTool() {
  const cursorRef = useRef<Group>(null)
  const levelId = useViewer((state) => state.selection.levelId)
  const setSelection = useViewer((state) => state.setSelection)
  const [placement, setPlacement] = useState<SkimmerPlacement | null>(null)
  useEffect(() => {
    if (!levelId) return
    const onMove = (event: GridEvent) => {
      const level = sceneRegistry.nodes.get(levelId as never)
      const local = worldPointToPoolLevel(level, event.position)
      const step = isGridSnapActive() ? useEditor.getState().gridSnapStep : 0
      const [x, z] = snapPointToGrid([local[0], local[2]], step)
      const poolNodes = getPoolNodes(useScene.getState().nodes, levelId)
      const next = findNearestPoolWall([x, z], poolNodes)
      setPlacement(next)
      if (cursorRef.current && next) cursorRef.current.position.set(next.position[0], next.position[1], next.position[2])
    }
    const onClick = (event: GridEvent) => {
      const level = sceneRegistry.nodes.get(levelId as never)
      const local = worldPointToPoolLevel(level, event.position)
      const step = isGridSnapActive() ? useEditor.getState().gridSnapStep : 0
      const [x, z] = snapPointToGrid([local[0], local[2]], step)
      const poolNodes = getPoolNodes(useScene.getState().nodes, levelId)
      const next = findNearestPoolWall([x, z], poolNodes)
      if (!next) return
      const count = countNodesByType(useScene.getState().nodes, 'pool:skimmer')
      const skimmer = PoolSkimmerNode.parse({ ...DEFAULT_POOL_SKIMMER, id: undefined, name: `Pool Skimmer ${count + 1}`, poolId: next.poolId, wallIndex: next.wallIndex, wallT: next.wallT, position: next.position, rotation: next.rotation })
      createPoolPluginNode(skimmer, levelId)
      setSelection({ selectedIds: [skimmer.id] })
      useEditor.getState().setTool(null)
      useEditor.getState().setMode('select')
      triggerSFX('sfx:structure-build')
    }
    const onCancel = () => { markToolCancelConsumed(); setPlacement(null); useEditor.getState().setTool(null); useEditor.getState().setMode('select') }
    emitter.on('grid:move', onMove); emitter.on('grid:click', onClick); emitter.on('tool:cancel', onCancel)
    return () => { emitter.off('grid:move', onMove); emitter.off('grid:click', onClick); emitter.off('tool:cancel', onCancel) }
  }, [levelId, setSelection])
  return <group><CursorSphere color={placement ? '#22c55e' : '#f97316'} ref={cursorRef} />{placement && <SkimmerGhost placement={placement} />}</group>
}

function SkimmerGhost({ placement }: { placement: SkimmerPlacement }) {
  const geometry = useMemo(() => {
    const group = buildSkimmerGeometry(PoolSkimmerNode.parse({ position: placement.position, rotation: placement.rotation }))
    group.traverse((child) => {
      const mesh = child as Mesh
      if (!mesh.isMesh) return
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      for (const material of materials as Material[]) { material.transparent = true; material.opacity = 0.42; material.depthWrite = false }
    })
    return group
  }, [placement])
  useEffect(() => () => disposeObject3D(geometry), [geometry])
  return <primitive object={geometry} position={placement.position} rotation={placement.rotation} />
}
