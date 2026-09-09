'use client'

import { emitter, type AnyNode, type GridEvent, type NodeEvent, type PipeSegmentNode, sceneRegistry, snapPointToGrid, useScene } from '@pascal-app/core'
import { isGridSnapActive, markToolCancelConsumed, triggerSFX, useEditor } from '@pascal-app/editor'
import { useViewer } from '@pascal-app/viewer'
import { useEffect, useState } from 'react'
import { EquipmentGhost } from '../../editor/equipment-ghost'
import { PoolLevelPreviewGroup } from '../../editor/level-preview-group'
import { buildValveGeometry } from '../core/geometry'
import { worldPointToPoolLevel } from '../../design/level-coordinates'
import { createPoolPluginNode } from '../../editor/scene-nodes'
import { DEFAULT_POOL_VALVE, PoolValveNode } from '../core/schema'
import { findValveInsertionTarget, planValveInsertion } from '../design/inline-insertion'
import { useValveEditStore } from './store'
import { isPlacementRotationKey } from '../../editor/placement-rotation'
import { recordPipeInsertion } from '../../core/insertion-removal'

export default function PoolValveTool() {
  const [ghost, setGhost] = useState<PoolValveNode | null>(null)
  const levelId = useViewer((state) => state.selection.levelId)
  const setSelection = useViewer((state) => state.setSelection)
  useEffect(() => {
    if (!levelId) return
    let committed = false
    let lastMove: GridEvent | NodeEvent | null = null
    const resolve = (event: GridEvent | NodeEvent) => {
      const level = sceneRegistry.nodes.get(levelId as never)
      const local = worldPointToPoolLevel(level, event.position)
      const step = isGridSnapActive() ? useEditor.getState().gridSnapStep : 0
      const [x, z] = snapPointToGrid([local[0], local[2]], step)
      const { variant, diameter, rotationQuarterTurns } = useValveEditStore.getState()
      const rotationAxis = useEditor.getState().rotationAxis
      const rotation = [0, 0, 0] as [number, number, number]
      rotation[rotationAxis === 'x' ? 0 : rotationAxis === 'y' ? 1 : 2] = rotationQuarterTurns * Math.PI / 2
      const valve = PoolValveNode.parse({ ...DEFAULT_POOL_VALVE, name: `PVC ${variant} suction valve`, variant, diameter, position: [x, local[1], z], rotation })
      const runs = Object.values(useScene.getState().nodes).filter((node): node is PipeSegmentNode => node.type === 'pipe-segment' && node.parentId === levelId)
      const directPipeId = 'node' in event && event.node.type === 'pipe-segment' ? event.node.id : null
      const target = event.nativeEvent?.altKey ? null : findValveInsertionTarget(directPipeId ? runs.filter((run) => run.id === directPipeId) : runs, local, !!directPipeId)
      const insertion = target ? planValveInsertion(target.run, target.index, target.point, valve) : null
      return { valve: insertion?.valve ?? valve, insertion, valid: !target || !!insertion, point: target?.point ?? valve.position }
    }
    const onMove = (event: GridEvent | NodeEvent) => {
      lastMove = event
      const { valve } = resolve(event)
      setGhost(valve)
    }
    const onClick = (event: GridEvent | NodeEvent) => {
      if (committed || useScene.getState().readOnly) return
      const { valve, insertion, valid } = resolve(event)
      if (!valid) return
      if (insertion) {
        const original = useScene.getState().nodes[insertion.update.id]
        if (original?.type !== 'pipe-segment') return
        const recorded = recordPipeInsertion({ ...valve, parentId: levelId }, original, insertion.update.data, insertion.tail)
        useScene.getState().applyNodeChanges({
          update: [insertion.update],
          create: [
            { node: recorded as unknown as AnyNode, parentId: levelId },
            { node: insertion.tail, parentId: levelId },
          ],
        })
      } else createPoolPluginNode(valve, levelId)
      committed = true
      setSelection({ selectedIds: [valve.id] })
      useEditor.getState().setTool(null); useEditor.getState().setMode('select'); triggerSFX('sfx:structure-build')
    }
    const onCancel = () => { markToolCancelConsumed(); useEditor.getState().setTool(null); useEditor.getState().setMode('select') }
    const onKeyDown = (event: KeyboardEvent) => {
      if (isPlacementRotationKey(event)) {
        event.preventDefault()
        event.stopPropagation()
        useValveEditStore.getState().rotate()
        if (lastMove) onMove(lastMove)
      }
    }
    emitter.on('grid:move', onMove); emitter.on('grid:click', onClick); emitter.on('tool:cancel', onCancel)
    emitter.on('pipe-segment:move', onMove); emitter.on('pipe-segment:click', onClick)
    window.addEventListener('keydown', onKeyDown, true)
    return () => { emitter.off('pipe-segment:move', onMove); emitter.off('pipe-segment:click', onClick); emitter.off('grid:move', onMove); emitter.off('grid:click', onClick); emitter.off('tool:cancel', onCancel); window.removeEventListener('keydown', onKeyDown, true) }
  }, [levelId, setSelection])
  return <PoolLevelPreviewGroup>{ghost && <group position={ghost.position} rotation={ghost.rotation}>
    <EquipmentGhost node={ghost} buildGeometry={buildValveGeometry} />
  </group>}</PoolLevelPreviewGroup>
}
