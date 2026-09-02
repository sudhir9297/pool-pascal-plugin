'use client'

import { type AnyNode, type AnyNodeId, useScene } from '@pascal-app/core'
import { EDITOR_LAYER, triggerSFX } from '@pascal-app/editor'
import { useViewer } from '@pascal-app/viewer'
import { useMemo } from 'react'
import { usePlacement } from './placement'
import PoolPreview from './preview'
import { PoolNode } from './schema'
import { usePoolsStore } from './store'

/**
 * The pools placement tool. Mounted by the host's registry-first `ToolManager`
 * whenever `tool === 'pools:pool'` — no host edit per kind. Reads the panel
 * brush from the plugin store, ghosts a preview at the snapped cursor, and
 * commits a pool on click. Snapping + level conversion live in `usePlacement`.
 */
export default function PoolTool() {
  const activeLevelId = useViewer((s) => s.selection.levelId)
  const preset = usePoolsStore((s) => s.preset)
  const size = usePoolsStore((s) => s.size)
  const height = usePoolsStore((s) => s.height)
  const detailDensity = usePoolsStore((s) => s.detailDensity)
  const wallThickness = usePoolsStore((s) => s.wallThickness)
  const minimal = usePoolsStore((s) => s.minimal)

  const previewNode = useMemo(
    () =>
      PoolNode.parse({
        preset,
        size,
        height,
        detailDensity,
        wallThickness,
        minimal,
        // seed/waterProfile left unset → the ghost shows the pure preset, as placed.
        position: [0, 0, 0],
        rotation: [0, 0, 0],
      }),
    [preset, size, height, detailDensity, wallThickness, minimal],
  )

  const { cursorRef, cursorVisible } = usePlacement(
    activeLevelId,
    (position) => {
      if (!activeLevelId) return
      const s = usePoolsStore.getState()
      const pool = PoolNode.parse({
        preset: s.preset,
        size: s.size,
        height: s.height,
        detailDensity: s.detailDensity,
        wallThickness: s.wallThickness,
        minimal: s.minimal,
        // seed/waterProfile unset → the pure the procedural geometry dependency preset (its canonical seed + type).
        // All same-preset pools then share one instancing variant; a random Y
        // rotation keeps a placed row from looking cloned. Use Randomize (inspector)
        // to vary a pool's seed.
        position,
        rotation: [0, (Math.floor(Math.random() * 8) * Math.PI) / 4, 0],
      })
      useScene.getState().createNode(pool as unknown as AnyNode, activeLevelId as AnyNodeId)
      useViewer.getState().setSelection({ selectedIds: [pool.id as AnyNodeId] })
      triggerSFX('sfx:item-place')
    },
    previewNode,
  )

  if (!activeLevelId) return null

  return (
    <group layers={EDITOR_LAYER} ref={cursorRef} visible={cursorVisible}>
      <PoolPreview node={previewNode} />
    </group>
  )
}
