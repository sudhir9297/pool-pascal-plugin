'use client'

import { emitter, type GridEvent, sceneRegistry, snapPointToGrid, useScene } from '@pascal-app/core'
import {
  consumePlacementDragRelease,
  isGridSnapActive,
  markToolCancelConsumed,
  triggerSFX,
  useEditor,
} from '@pascal-app/editor'
import { useViewer } from '@pascal-app/viewer'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { worldPointToPoolLevel } from '../../design/level-coordinates'
import { getPoolNode, getPoolNodes } from '../../editor/scene-nodes'
import type { PoolStairNode } from '../core/schema'
import {
  findNearestPoolStairAttachment,
  poolStairAttachmentOnWall,
  poolStairAttachmentPatch,
  type PoolStairAttachment,
} from '../design/placement'
import PoolStairGhost from './ghost'

export default function MovePoolStairTool({ node }: { node: PoolStairNode }) {
  const levelId = useViewer((state) => state.selection.levelId)
  const [attachment, setAttachment] = useState<PoolStairAttachment | null>(() => {
    const pool = getPoolNode(useScene.getState().nodes, node.poolId)
    return pool ? poolStairAttachmentOnWall(pool, node.wallIndex, node.wallT) : null
  })
  const attachmentRef = useRef(attachment)
  const hasMovedRef = useRef(false)
  const exitMoveMode = useCallback(() => useEditor.getState().setMovingNode(null), [])
  const previewNode = useMemo(() => ({ ...node, position: [0, 0, 0] as [number, number, number], rotation: [0, 0, 0] as [number, number, number] }), [node])

  useEffect(() => {
    if (!levelId) return
    useScene.temporal.getState().pause()
    let historyPaused = true
    let finished = false
    const object = sceneRegistry.nodes.get(node.id as never)
    if (object) object.visible = false

    const finishHistory = () => {
      if (!historyPaused) return
      useScene.temporal.getState().resume()
      historyPaused = false
    }

    const resolveAttachment = (event: GridEvent) => {
      const level = sceneRegistry.nodes.get(levelId as never)
      const local = worldPointToPoolLevel(level, event.position)
      const step = isGridSnapActive() ? useEditor.getState().gridSnapStep : 0
      const [x, z] = snapPointToGrid([local[0], local[2]], step)
      const pools = getPoolNodes(useScene.getState().nodes, levelId)
      return findNearestPoolStairAttachment([x, local[1], z], pools)
    }

    const onMove = (event: GridEvent) => {
      const next = resolveAttachment(event)
      if (!next) return
      attachmentRef.current = next
      hasMovedRef.current = true
      setAttachment(next)
    }

    const commit = () => {
      const next = attachmentRef.current
      if (finished || !hasMovedRef.current || !next) return
      finished = true
      finishHistory()
      useScene.getState().updateNode(node.id as never, {
        ...poolStairAttachmentPatch(next),
        visible: true,
      })
      const liveObject = sceneRegistry.nodes.get(node.id as never)
      if (liveObject) liveObject.visible = true
      triggerSFX('sfx:item-place')
      exitMoveMode()
    }

    const cancel = () => {
      if (finished) return
      finished = true
      finishHistory()
      if (object) object.visible = true
      markToolCancelConsumed()
      exitMoveMode()
    }

    const activatedAt = Date.now()
    const onClick = (event: GridEvent) => {
      if (Date.now() - activatedAt < 150) return
      commit()
      event.nativeEvent?.stopPropagation?.()
    }
    const onPointerUp = (event: PointerEvent) => {
      if (!consumePlacementDragRelease(event)) return
      if (!hasMovedRef.current) {
        finished = true
        finishHistory()
        if (object) object.visible = true
        exitMoveMode()
        return
      }
      commit()
      event.stopPropagation()
    }

    emitter.on('grid:move', onMove)
    emitter.on('grid:click', onClick)
    emitter.on('tool:cancel', cancel)
    window.addEventListener('pointerup', onPointerUp)
    return () => {
      emitter.off('grid:move', onMove)
      emitter.off('grid:click', onClick)
      emitter.off('tool:cancel', cancel)
      window.removeEventListener('pointerup', onPointerUp)
      if (!finished && object) object.visible = true
      finishHistory()
    }
  }, [exitMoveMode, levelId, node.id])

  return attachment ? <PoolStairGhost node={previewNode} placement={attachment} /> : null
}
