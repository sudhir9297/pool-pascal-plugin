'use client'

import { type AnyNode, emitter, type GridEvent, sceneRegistry, snapPointToGrid, useScene } from '@pascal-app/core'
import { CursorSphere, isGridSnapActive, markToolCancelConsumed, triggerSFX, useEditor } from '@pascal-app/editor'
import { useViewer } from '@pascal-app/viewer'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Group } from 'three'
import { worldPointToPoolLevel } from '../../design/level-coordinates'
import type { PoolNode } from '../../core/schema'
import { poolStairDefinition } from '../core/definition'
import { PoolStairNode } from '../core/schema'
import { findNearestPoolStairAttachment, poolStairAttachmentPatch, type PoolStairAttachment } from '../design/placement'
import PoolStairGhost from './ghost'
import { getPoolStairPlacementSettings, usePoolStairStore } from './store'

export default function PoolStairTool() {
  const cursorRef = useRef<Group>(null)
  const levelId = useViewer((state) => state.selection.levelId)
  const setSelection = useViewer((state) => state.setSelection)
  const [placement, setPlacement] = useState<PoolStairAttachment | null>(null)
  const variant = usePoolStairStore((state) => state.variant)
  const stepCount = usePoolStairStore((state) => state.stepCount)
  const width = usePoolStairStore((state) => state.width)
  const depth = usePoolStairStore((state) => state.depth)
  const tubeDiameter = usePoolStairStore((state) => state.tubeDiameter)
  const treadDepth = usePoolStairStore((state) => state.treadDepth)
  const metalColor = usePoolStairStore((state) => state.metalColor)
  const ghostNode = useMemo(() => PoolStairNode.parse({
    ...poolStairDefinition.defaults(), variant, stepCount, width, depth, tubeDiameter, treadDepth, metalColor,
  }), [depth, metalColor, stepCount, treadDepth, tubeDiameter, variant, width])
  useEffect(() => {
    if (!levelId) return
    const getPlacement = (event: GridEvent) => {
      const level = sceneRegistry.nodes.get(levelId as never)
      const local = worldPointToPoolLevel(level, event.position)
      const step = isGridSnapActive() ? useEditor.getState().gridSnapStep : 0
      const point = snapPointToGrid([local[0], local[2]], step)
      const pools = Object.values(useScene.getState().nodes).filter((node) => (
        (node.type as string) === 'pool:pool' && node.parentId === levelId
      )) as unknown as PoolNode[]
      return findNearestPoolStairAttachment([point[0], local[1], point[1]], pools)
    }
    const resolve = (event: GridEvent) => {
      const next = getPlacement(event)
      setPlacement(next)
      if (cursorRef.current && next) cursorRef.current.position.set(...next.position)
    }
    const onClick = (event: GridEvent) => {
      const next = getPlacement(event)
      if (!next) return
      const count = Object.values(useScene.getState().nodes).filter((node) => (node.type as string) === 'pool:stair').length
      const stair = PoolStairNode.parse({
        ...poolStairDefinition.defaults(),
        ...getPoolStairPlacementSettings(),
        ...poolStairAttachmentPatch(next),
        id: undefined,
        name: `Pool Stairs ${count + 1}`,
      })
      useScene.getState().createNode(stair as unknown as AnyNode, next.poolId as never)
      setSelection({ selectedIds: [stair.id] }); useEditor.getState().setTool(null); useEditor.getState().setMode('select'); triggerSFX('sfx:structure-build')
    }
    const onCancel = () => { markToolCancelConsumed(); setPlacement(null); useEditor.getState().setTool(null); useEditor.getState().setMode('select') }
    emitter.on('grid:move', resolve); emitter.on('grid:click', onClick); emitter.on('tool:cancel', onCancel)
    return () => { emitter.off('grid:move', resolve); emitter.off('grid:click', onClick); emitter.off('tool:cancel', onCancel) }
  }, [levelId, setSelection])
  return <group><CursorSphere color={placement ? '#22c55e' : '#f97316'} ref={cursorRef} />{placement && <PoolStairGhost node={ghostNode} placement={placement} />}</group>
}
