'use client'

import { type AnyNode, emitter, type GridEvent, sceneRegistry, snapPointToGrid, useScene } from '@pascal-app/core'
import { CursorSphere, isGridSnapActive, markToolCancelConsumed, triggerSFX, useEditor } from '@pascal-app/editor'
import { useViewer } from '@pascal-app/viewer'
import { useEffect, useRef } from 'react'
import { Vector3, type Group } from 'three'
import { worldPointToPoolLevel } from '../../design/level-coordinates'
import { poolHeaterDefinition } from '../core/definition'
import { PoolHeaterNode } from '../core/schema'

export default function PoolHeaterTool() {
  const cursorRef = useRef<Group>(null)
  const levelId = useViewer((state) => state.selection.levelId)
  const setSelection = useViewer((state) => state.setSelection)
  useEffect(() => {
    if (!levelId) return
    const resolve = (event: GridEvent) => {
      const local = worldPointToPoolLevel(sceneRegistry.nodes.get(levelId as never), event.position)
      const step = isGridSnapActive() ? useEditor.getState().gridSnapStep : 0
      const [x, z] = snapPointToGrid([local[0], local[2]], step)
      return [x, 0, z] as [number, number, number]
    }
    const onMove = (event: GridEvent) => { cursorRef.current?.position.copy(new Vector3(...resolve(event))) }
    const onClick = (event: GridEvent) => {
      const point = resolve(event)
      const count = Object.values(useScene.getState().nodes).filter((node) => String(node.type) === 'pool:heater').length
      const heater = PoolHeaterNode.parse({ ...poolHeaterDefinition.defaults(), id: undefined, name: `Pool Heater ${count + 1}`, position: point })
      useScene.getState().createNode(heater as unknown as AnyNode, levelId)
      setSelection({ selectedIds: [heater.id] }); useEditor.getState().setTool(null); useEditor.getState().setMode('select'); triggerSFX('sfx:structure-build')
    }
    const onCancel = () => { markToolCancelConsumed(); useEditor.getState().setTool(null); useEditor.getState().setMode('select') }
    emitter.on('grid:move', onMove); emitter.on('grid:click', onClick); emitter.on('tool:cancel', onCancel)
    return () => { emitter.off('grid:move', onMove); emitter.off('grid:click', onClick); emitter.off('tool:cancel', onCancel) }
  }, [levelId, setSelection])
  return <CursorSphere color="#f97316" ref={cursorRef} />
}
