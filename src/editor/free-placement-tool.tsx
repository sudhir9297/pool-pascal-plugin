'use client'

import { emitter, type GridEvent, sceneRegistry, snapPointToGrid, useScene } from '@pascal-app/core'
import { CursorSphere, isGridSnapActive, markToolCancelConsumed, triggerSFX, useEditor } from '@pascal-app/editor'
import { useViewer } from '@pascal-app/viewer'
import { useEffect, useRef } from 'react'
import type { Group } from 'three'
import { worldPointToPoolLevel } from '../design/level-coordinates'
import { createPoolPluginNode, type PoolPluginNodeType } from './scene-nodes'

export type PlacementPoint = [number, number, number]

type PlaceableNode = {
  id: string
  type: PoolPluginNodeType
}

type FreePlacementToolProps<Node extends PlaceableNode> = {
  cursorColor: string
  kind: Node['type']
  createNode: (position: PlacementPoint, sequence: number) => Node
}

/**
 * Owns the editor event lifecycle shared by equipment placed freely on a
 * level. Feature modules only provide their node constructor and appearance.
 */
export function FreePlacementTool<Node extends PlaceableNode>({
  cursorColor,
  kind,
  createNode,
}: FreePlacementToolProps<Node>) {
  const cursorRef = useRef<Group>(null)
  const levelId = useViewer((state) => state.selection.levelId)
  const setSelection = useViewer((state) => state.setSelection)

  useEffect(() => {
    if (!levelId) return

    const resolvePoint = (event: GridEvent): PlacementPoint => {
      const level = sceneRegistry.nodes.get(levelId as never)
      const local = worldPointToPoolLevel(level, event.position)
      const step = isGridSnapActive() ? useEditor.getState().gridSnapStep : 0
      const [x, z] = snapPointToGrid([local[0], local[2]], step)
      return [x, 0, z]
    }
    const finish = () => {
      useEditor.getState().setTool(null)
      useEditor.getState().setMode('select')
    }
    const onMove = (event: GridEvent) => {
      const point = resolvePoint(event)
      cursorRef.current?.position.set(...point)
    }
    const onClick = (event: GridEvent) => {
      const scene = useScene.getState()
      const sequence = Object.values(scene.nodes)
        .filter((node) => String(node.type) === kind).length + 1
      const node = createNode(resolvePoint(event), sequence)
      createPoolPluginNode(node, levelId)
      setSelection({ selectedIds: [node.id] })
      finish()
      triggerSFX('sfx:structure-build')
    }
    const onCancel = () => {
      markToolCancelConsumed()
      finish()
    }

    emitter.on('grid:move', onMove)
    emitter.on('grid:click', onClick)
    emitter.on('tool:cancel', onCancel)
    return () => {
      emitter.off('grid:move', onMove)
      emitter.off('grid:click', onClick)
      emitter.off('tool:cancel', onCancel)
    }
  }, [createNode, kind, levelId, setSelection])

  return <CursorSphere color={cursorColor} ref={cursorRef} />
}
