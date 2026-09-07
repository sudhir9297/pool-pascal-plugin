'use client'

import { emitter, type GridEvent, sceneRegistry, snapPointToGrid, useScene } from '@pascal-app/core'
import { CursorSphere, isGridSnapActive, markToolCancelConsumed, triggerSFX, useEditor } from '@pascal-app/editor'
import { useViewer } from '@pascal-app/viewer'
import { useEffect, useRef } from 'react'
import { Vector3, type Group } from 'three'
import { worldPointToPoolLevel } from '../../design/level-coordinates'
import { createPoolPluginNode } from '../../editor/scene-nodes'
import { DEFAULT_POOL_VALVE, PoolValveNode } from '../core/schema'
import { useValveEditStore } from './store'

export default function PoolValveTool() {
  const cursorRef = useRef<Group>(null)
  const levelId = useViewer((state) => state.selection.levelId)
  const setSelection = useViewer((state) => state.setSelection)
  useEffect(() => {
    if (!levelId) return
    const resolve = (event: GridEvent) => {
      const level = sceneRegistry.nodes.get(levelId as never)
      const local = worldPointToPoolLevel(level, event.position)
      const step = isGridSnapActive() ? useEditor.getState().gridSnapStep : 0
      const [x, z] = snapPointToGrid([local[0], local[2]], step)
      return [x, local[1], z] as [number, number, number]
    }
    const onMove = (event: GridEvent) => {
      const point = resolve(event)
      if (cursorRef.current) cursorRef.current.position.copy(new Vector3(...point))
    }
    const onClick = (event: GridEvent) => {
      const point = resolve(event)
      const count = Object.values(useScene.getState().nodes).filter((node) => (node.type as string) === 'pool:valve').length
      const { variant, diameter, rotationQuarterTurns } = useValveEditStore.getState()
      const rotationAxis = useEditor.getState().rotationAxis
      const rotation = [0, 0, 0] as [number, number, number]
      rotation[rotationAxis === 'x' ? 0 : rotationAxis === 'y' ? 1 : 2] = rotationQuarterTurns * Math.PI / 2
      const valve = PoolValveNode.parse({ ...DEFAULT_POOL_VALVE, id: undefined, name: `PVC ${variant} suction valve ${count + 1}`, variant, diameter, position: point, rotation })
      createPoolPluginNode(valve, levelId)
      setSelection({ selectedIds: [valve.id] })
      useEditor.getState().setTool(null); useEditor.getState().setMode('select'); triggerSFX('sfx:structure-build')
    }
    const onCancel = () => { markToolCancelConsumed(); useEditor.getState().setTool(null); useEditor.getState().setMode('select') }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || (event.target instanceof HTMLElement && event.target.isContentEditable)) return
      if ((event.key === 'r' || event.key === 'R') && !event.metaKey && !event.ctrlKey && !event.repeat) {
        event.preventDefault()
        useValveEditStore.getState().rotate()
      }
    }
    emitter.on('grid:move', onMove); emitter.on('grid:click', onClick); emitter.on('tool:cancel', onCancel)
    window.addEventListener('keydown', onKeyDown)
    return () => { emitter.off('grid:move', onMove); emitter.off('grid:click', onClick); emitter.off('tool:cancel', onCancel); window.removeEventListener('keydown', onKeyDown) }
  }, [levelId, setSelection])
  return <CursorSphere color="#f97316" ref={cursorRef} />
}
