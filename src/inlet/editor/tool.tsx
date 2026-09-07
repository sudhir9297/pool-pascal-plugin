'use client'

import { emitter, type GridEvent, sceneRegistry, snapPointToGrid, useScene } from '@pascal-app/core'
import { isGridSnapActive, markToolCancelConsumed, triggerSFX, useEditor } from '@pascal-app/editor'
import { useViewer } from '@pascal-app/viewer'
import { useEffect, useMemo, useState } from 'react'
import type { Material, Mesh } from 'three'
import { worldPointToPoolLevel } from '../../design/level-coordinates'
import { countNodesByType, createPoolPluginNode, getPoolNodes } from '../../editor/scene-nodes'
import { findNearestInletWall, type InletPlacement } from '../design/placement'
import { DEFAULT_POOL_INLET, PoolInletNode } from '../core/schema'
import { buildInletGeometry } from '../core/geometry'

export default function PoolInletTool() {
  const levelId = useViewer((state) => state.selection.levelId)
  const setSelection = useViewer((state) => state.setSelection)
  const [placement, setPlacement] = useState<InletPlacement | null>(null)
  useEffect(() => {
    if (!levelId) return
    const resolve = (event: GridEvent) => {
      const level = sceneRegistry.nodes.get(levelId as never)
      const local = worldPointToPoolLevel(level, event.position)
      const step = isGridSnapActive() ? useEditor.getState().gridSnapStep : 0
      const [x, z] = snapPointToGrid([local[0], local[2]], step)
      const pools = getPoolNodes(useScene.getState().nodes)
      return findNearestInletWall([x, z], pools)
    }
    const onMove = (event: GridEvent) => {
      const next = resolve(event)
      setPlacement(next)
    }
    const onClick = (event: GridEvent) => {
      const next = resolve(event)
      if (!next) return
      const count = countNodesByType(useScene.getState().nodes, 'pool:inlet')
      const inlet = PoolInletNode.parse({ ...DEFAULT_POOL_INLET, id: undefined, name: `Pool Return Inlet ${count + 1}`, poolId: next.poolId, wallIndex: next.wallIndex, wallT: next.wallT, position: next.position, rotation: next.rotation })
      createPoolPluginNode(inlet, levelId)
      setSelection({ selectedIds: [inlet.id] })
      useEditor.getState().setTool(null); useEditor.getState().setMode('select'); triggerSFX('sfx:structure-build')
    }
    const onCancel = () => { markToolCancelConsumed(); setPlacement(null); useEditor.getState().setTool(null); useEditor.getState().setMode('select') }
    emitter.on('grid:move', onMove); emitter.on('grid:click', onClick); emitter.on('tool:cancel', onCancel)
    return () => { emitter.off('grid:move', onMove); emitter.off('grid:click', onClick); emitter.off('tool:cancel', onCancel) }
  }, [levelId, setSelection])
  return <group>{placement && <InletGhost placement={placement} />}</group>
}

function InletGhost({ placement }: { placement: InletPlacement }) {
  const geometry = useMemo(() => {
    const group = buildInletGeometry(PoolInletNode.parse({ position: placement.position, rotation: placement.rotation }))
    group.traverse((child) => {
      const mesh = child as Mesh
      if (!mesh.isMesh) return
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      for (const material of materials as Material[]) { material.transparent = true; material.opacity = 0.42; material.depthWrite = false }
    })
    return group
  }, [placement])
  const verticalOffset = DEFAULT_POOL_INLET.verticalOffset
  return <primitive object={geometry} position={[placement.position[0], placement.position[1] + verticalOffset, placement.position[2]]} rotation={placement.rotation} />
}
