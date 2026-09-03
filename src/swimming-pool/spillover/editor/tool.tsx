'use client'

import { type AnyNode, emitter, type GridEvent, sceneRegistry, useScene } from '@pascal-app/core'
import { markToolCancelConsumed, triggerSFX, useEditor } from '@pascal-app/editor'
import { useViewer } from '@pascal-app/viewer'
import { useEffect, useRef } from 'react'
import { PoolNode, resolvePoolPolygon } from '../../core/schema'
import { worldPointToPoolLevel } from '../../design/level-coordinates'
import { DEFAULT_POOL_SPILLOVER } from '../core/definition'
import { PoolSpilloverNode } from '../core/schema'
import { resolvePoolSpillover } from '../design/placement'

function poolContainsPoint(pool: PoolNode, worldPoint: [number, number, number]) {
  const rotation = pool.rotation[1] ?? 0
  const dx = worldPoint[0] - pool.position[0]
  const dz = worldPoint[2] - pool.position[2]
  const cos = Math.cos(rotation)
  const sin = Math.sin(rotation)
  const local: [number, number] = [dx * cos - dz * sin, dx * sin + dz * cos]
  const polygon = resolvePoolPolygon(pool)
  let inside = false
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
    const [x, z] = polygon[index]!
    const [previousX, previousZ] = polygon[previous]!
    const intersects = ((z > local[1]) !== (previousZ > local[1]))
      && local[0] < (previousX - x) * (local[1] - z) / (previousZ - z) + x
    if (intersects) inside = !inside
  }
  return inside
}

function poolAtPoint(nodes: Record<string, AnyNode>, point: [number, number, number], parentId: string) {
  return Object.values(nodes)
    .filter((node) => node.parentId === parentId && String(node.type) === 'pool:pool')
    .map((node) => PoolNode.safeParse(node))
    .filter((result): result is { success: true; data: PoolNode } => result.success)
    .map((result) => result.data)
    .find((pool) => poolContainsPoint(pool, point)) ?? null
}

export default function PoolSpilloverTool() {
  const levelId = useViewer((state) => state.selection.levelId)
  const setSelection = useViewer((state) => state.setSelection)
  const sourcePoolRef = useRef<PoolNode | null>(null)

  useEffect(() => {
    sourcePoolRef.current = null
    if (!levelId) return
    const onClick = (event: GridEvent) => {
      const level = sceneRegistry.nodes.get(levelId as never)
      const levelPoint = worldPointToPoolLevel(level, event.position)
      const pool = poolAtPoint(useScene.getState().nodes, levelPoint, levelId)
      if (!pool) return
      const source = sourcePoolRef.current
      if (!source) {
        sourcePoolRef.current = pool
        return
      }
      if (pool.id === source.id) return
      const placement = resolvePoolSpillover(source, pool)
      if (!placement) {
        sourcePoolRef.current = null
        return
      }
      const count = Object.values(useScene.getState().nodes).filter((node) => String(node.type) === 'pool:spillover').length
      const spillover = PoolSpilloverNode.parse({
        ...DEFAULT_POOL_SPILLOVER,
        ...placement,
        id: undefined,
        name: `Pool Spillover ${count + 1}`,
        parentId: levelId,
      })
      useScene.getState().createNode(spillover as unknown as AnyNode, levelId)
      setSelection({ selectedIds: [spillover.id] })
      sourcePoolRef.current = null
      useEditor.getState().setTool(null)
      useEditor.getState().setMode('select')
      triggerSFX('sfx:structure-build')
    }
    const onCancel = () => {
      sourcePoolRef.current = null
      markToolCancelConsumed()
      useEditor.getState().setTool(null)
      useEditor.getState().setMode('select')
    }
    emitter.on('grid:click', onClick)
    emitter.on('tool:cancel', onCancel)
    return () => {
      sourcePoolRef.current = null
      emitter.off('grid:click', onClick)
      emitter.off('tool:cancel', onCancel)
    }
  }, [levelId, setSelection])

  return null
}
