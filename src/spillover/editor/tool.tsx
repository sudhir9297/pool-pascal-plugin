'use client'

import { emitter, type GridEvent, type NodeEvent, sceneRegistry, useScene } from '@pascal-app/core'
import { markToolCancelConsumed, triggerSFX, useEditor, useInteractionScope } from '@pascal-app/editor'
import { useViewer } from '@pascal-app/viewer'
import { useCallback, useEffect, useRef, useState } from 'react'
import { PoolNode } from '../../core/schema'
import { worldPointToPoolLevel } from '../../design/level-coordinates'
import { createPoolPluginNode } from '../../editor/scene-nodes'
import { DEFAULT_POOL_SPILLOVER, PoolSpilloverNode } from '../core/schema'
import { findPoolAtPoint, resolvePoolSpilloverCandidate, resolvePoolSpilloverPair } from '../design/interaction'
import type { PoolSpilloverPlacement } from '../design/placement'
import { setPoolSpilloverPlacementStage } from '../design/stage'
import { PoolPlacementHighlight, PoolSpilloverPlacementGhost } from './ghost'

export default function PoolSpilloverTool() {
  const levelId = useViewer((state) => state.selection.levelId)
  const setSelection = useViewer((state) => state.setSelection)
  const selectedIds = useViewer((state) => state.selection.selectedIds)
  const [sourcePool, setSourcePool] = useState<PoolNode | null>(null)
  const [hoveredPool, setHoveredPool] = useState<PoolNode | null>(null)
  const [preview, setPreview] = useState<PoolSpilloverPlacement | null>(null)
  const committedRef = useRef(false)
  const observedSelectionRef = useRef<string | null>(selectedIds.at(-1) ?? null)

  useEffect(() => {
    setSourcePool(null)
    setHoveredPool(null)
    setPreview(null)
    committedRef.current = false
    observedSelectionRef.current = useViewer.getState().selection.selectedIds.at(-1) ?? null
    setPoolSpilloverPlacementStage('first-pool')
  }, [levelId])

  const completePlacement = useCallback((placement: PoolSpilloverPlacement) => {
    if (!levelId || committedRef.current) return
    committedRef.current = true
    const count = Object.values(useScene.getState().nodes).filter((node) => String(node.type) === 'pool:spillover').length
    const spillover = PoolSpilloverNode.parse({
      ...DEFAULT_POOL_SPILLOVER,
      ...placement,
      effectiveWidth: placement.width,
      id: undefined,
      name: `Pool Spillover ${count + 1}`,
      parentId: levelId,
    })
    createPoolPluginNode(spillover, levelId)
    setSelection({ selectedIds: [spillover.id] })
    setSourcePool(null)
    setHoveredPool(null)
    setPreview(null)
    setPoolSpilloverPlacementStage('first-pool')
    useEditor.getState().setTool(null)
    useEditor.getState().setMode('select')
    triggerSFX('sfx:structure-build')
  }, [levelId, setSelection])

  const choosePool = useCallback((pool: PoolNode) => {
    if (!levelId || pool.parentId !== levelId || committedRef.current) return
    if (!sourcePool) {
      setSourcePool(pool)
      setSelection({ selectedIds: [pool.id] })
      setPoolSpilloverPlacementStage('second-pool')
      return
    }
    const placement = resolvePoolSpilloverPair(sourcePool, pool)
    if (placement) completePlacement(placement)
    else setSelection({ selectedIds: [sourcePool.id] })
  }, [completePlacement, levelId, setSelection, sourcePool])

  useEffect(() => {
    if (!levelId) return
    useInteractionScope.getState().begin({ kind: 'drafting', tool: 'pool:spillover' })
    return () => {
      useInteractionScope.getState().endIf(
        (scope) => scope.kind === 'drafting' && scope.tool === 'pool:spillover',
      )
      setPoolSpilloverPlacementStage('first-pool')
    }
  }, [levelId])

  useEffect(() => {
    if (!levelId) return
    const onMove = (event: GridEvent) => {
      if (!sourcePool) return
      const level = sceneRegistry.nodes.get(levelId as never)
      const levelPoint = worldPointToPoolLevel(level, event.position)
      const candidate = resolvePoolSpilloverCandidate(useScene.getState().nodes, levelPoint, levelId, sourcePool)
      setHoveredPool(candidate.pool?.id === sourcePool.id ? null : candidate.pool)
      setPreview(candidate.placement)
    }
    const onClick = (event: GridEvent) => {
      const level = sceneRegistry.nodes.get(levelId as never)
      const levelPoint = worldPointToPoolLevel(level, event.position)
      const pool = findPoolAtPoint(useScene.getState().nodes, levelPoint, levelId)
      if (!pool) return
      choosePool(pool)
    }
    const onNodeMove = (event: NodeEvent) => {
      if (!sourcePool) return
      const result = PoolNode.safeParse(event.node)
      if (!result.success || result.data.parentId !== levelId || result.data.id === sourcePool.id) return
      setHoveredPool(result.data)
      setPreview(resolvePoolSpilloverPair(sourcePool, result.data))
    }
    const onNodeClick = (event: NodeEvent) => {
      const result = PoolNode.safeParse(event.node)
      if (!result.success) return
      event.stopPropagation()
      choosePool(result.data)
    }
    const onCancel = () => {
      setSourcePool(null)
      setHoveredPool(null)
      setPreview(null)
      setPoolSpilloverPlacementStage('first-pool')
      markToolCancelConsumed()
      useEditor.getState().setTool(null)
      useEditor.getState().setMode('select')
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      onCancel()
    }
    emitter.on('grid:move', onMove)
    emitter.on('grid:click', onClick)
    emitter.on('node:move' as never, onNodeMove as never)
    emitter.on('node:click' as never, onNodeClick as never)
    emitter.on('tool:cancel', onCancel)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      emitter.off('grid:move', onMove)
      emitter.off('grid:click', onClick)
      emitter.off('node:move' as never, onNodeMove as never)
      emitter.off('node:click' as never, onNodeClick as never)
      emitter.off('tool:cancel', onCancel)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [choosePool, levelId, sourcePool])

  useEffect(() => {
    if (!levelId || committedRef.current) return
    const selectedId = selectedIds.at(-1) ?? null
    if (!selectedId || selectedId === observedSelectionRef.current) return
    observedSelectionRef.current = selectedId
    const result = PoolNode.safeParse(useScene.getState().nodes[selectedId as never])
    if (!result.success || result.data.parentId !== levelId) return
    choosePool(result.data)
  }, [choosePool, levelId, selectedIds])

  return <>
    {sourcePool ? <PoolPlacementHighlight pool={sourcePool} color="#22c55e" /> : null}
    {hoveredPool ? <PoolPlacementHighlight pool={hoveredPool} color={preview ? '#38bdf8' : '#ef4444'} /> : null}
    {preview ? <PoolSpilloverPlacementGhost placement={preview} /> : null}
  </>
}
