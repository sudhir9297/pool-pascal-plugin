'use client'

import { type AnyNode, emitter, type GridEvent, sceneRegistry, snapPointToGrid, useScene } from '@pascal-app/core'
import { CursorSphere, isGridSnapActive, markToolCancelConsumed, triggerSFX, useEditor } from '@pascal-app/editor'
import { useViewer } from '@pascal-app/viewer'
import { useEffect, useRef } from 'react'
import { Vector3, type Group } from 'three'
import { worldPointToPoolLevel } from '../../design/level-coordinates'
import { poolPumpDefinition } from '../core/definition'
import { PoolPumpNode } from '../core/schema'

export default function PoolPumpTool() {
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
      return [x, 0, z] as [number, number, number]
    }
    const onMove = (event: GridEvent) => { if (cursorRef.current) cursorRef.current.position.copy(new Vector3(...resolve(event))) }
    const onClick = (event: GridEvent) => {
      const point = resolve(event)
      const count = Object.values(useScene.getState().nodes).filter((node) => (node.type as string) === 'pool:pump').length
      const axis = useEditor.getState().rotationAxis
      const rotation = [0, 0, 0] as [number, number, number]
      rotation[axis === 'x' ? 0 : axis === 'y' ? 1 : 2] = 0
      const pump = PoolPumpNode.parse({ ...poolPumpDefinition.defaults(), id: undefined, name: `Pool Pump ${count + 1}`, position: point, rotation })
      useScene.getState().createNode(pump as unknown as AnyNode, levelId); setSelection({ selectedIds: [pump.id] })
      useEditor.getState().setTool(null); useEditor.getState().setMode('select'); triggerSFX('sfx:structure-build')
    }
    const onCancel = () => { markToolCancelConsumed(); useEditor.getState().setTool(null); useEditor.getState().setMode('select') }
    emitter.on('grid:move', onMove); emitter.on('grid:click', onClick); emitter.on('tool:cancel', onCancel)
    return () => { emitter.off('grid:move', onMove); emitter.off('grid:click', onClick); emitter.off('tool:cancel', onCancel) }
  }, [levelId, setSelection])
  return <CursorSphere color="#f97316" ref={cursorRef} />
}
