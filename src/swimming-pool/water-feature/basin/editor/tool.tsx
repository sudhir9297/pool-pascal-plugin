'use client'

import { type AnyNode, emitter, type GridEvent, sceneRegistry, snapPointToGrid, useScene } from '@pascal-app/core'
import { isGridSnapActive, markToolCancelConsumed, triggerSFX, useEditor } from '@pascal-app/editor'
import { useViewer } from '@pascal-app/viewer'
import { useEffect } from 'react'
import { worldPointToPoolLevel } from '../../../design/level-coordinates'
import { DEFAULT_POOL_CATCH_BASIN } from '../core/definition'
import { PoolCatchBasinNode } from '../core/schema'

export default function PoolCatchBasinTool() {
  const levelId = useViewer((state) => state.selection.levelId)
  const setSelection = useViewer((state) => state.setSelection)
  useEffect(() => {
    if (!levelId) return
    const place = (event: GridEvent) => {
      const level = sceneRegistry.nodes.get(levelId as never)
      const local = worldPointToPoolLevel(level, event.position)
      const step = isGridSnapActive() ? useEditor.getState().gridSnapStep : 0
      const [x, z] = snapPointToGrid([local[0], local[2]], step)
      const count = Object.values(useScene.getState().nodes).filter((node) => String((node as unknown as { type?: unknown }).type) === 'pool:catch-basin').length
      const basin = PoolCatchBasinNode.parse({ ...DEFAULT_POOL_CATCH_BASIN, id: undefined, name: `Lower Catch Basin ${count + 1}`, position: [x, 0, z] })
      useScene.getState().createNode(basin as unknown as AnyNode, levelId)
      setSelection({ selectedIds: [basin.id] })
      useEditor.getState().setTool(null)
      useEditor.getState().setMode('select')
      triggerSFX('sfx:structure-build')
    }
    const cancel = () => { markToolCancelConsumed(); useEditor.getState().setTool(null); useEditor.getState().setMode('select') }
    emitter.on('grid:click', place)
    emitter.on('tool:cancel', cancel)
    return () => { emitter.off('grid:click', place); emitter.off('tool:cancel', cancel) }
  }, [levelId, setSelection])
  return null
}
