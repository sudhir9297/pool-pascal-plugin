'use client'

import { type AnyNode, type AnyNodeId, useScene } from '@pascal-app/core'
import { EDITOR_LAYER, triggerSFX } from '@pascal-app/editor'
import { useViewer } from '@pascal-app/viewer'
import { useMemo } from 'react'
import { HOT_TUB_PRESETS, HOT_TUB_SEED_POOL } from './hotTub-presets'
import HotTubPreview from './hotTub-preview'
import { HotTubNode } from './hotTub-schema'
import { usePlacement } from './placement'
import { usePoolsStore } from './store'

/** The hotTubs placement tool — mirrors the pools tool, reading the hotTub
 * brush from the shared store. Petal colour is baked from the preset at
 * placement, then editable per-hotTub in the inspector. */
export default function HotTubTool() {
  const activeLevelId = useViewer((s) => s.selection.levelId)
  const preset = usePoolsStore((s) => s.hotTubPreset)
  const height = usePoolsStore((s) => s.hotTubHeight)

  const previewNode = useMemo(
    () =>
      HotTubNode.parse({
        preset,
        height,
        waterColor: HOT_TUB_PRESETS[preset].waterColor,
        seed: 1,
        position: [0, 0, 0],
        rotation: [0, 0, 0],
      }),
    [preset, height],
  )

  const { cursorRef, cursorVisible } = usePlacement(
    activeLevelId,
    (position) => {
      if (!activeLevelId) return
      const s = usePoolsStore.getState()
      const hotTub = HotTubNode.parse({
        preset: s.hotTubPreset,
        height: s.hotTubHeight,
        waterColor: HOT_TUB_PRESETS[s.hotTubPreset].waterColor,
        seed: HOT_TUB_SEED_POOL[Math.floor(Math.random() * HOT_TUB_SEED_POOL.length)] ?? 1,
        position,
        rotation: [0, (Math.floor(Math.random() * 8) * Math.PI) / 4, 0],
      })
      useScene.getState().createNode(hotTub as unknown as AnyNode, activeLevelId as AnyNodeId)
      useViewer.getState().setSelection({ selectedIds: [hotTub.id as AnyNodeId] })
      triggerSFX('sfx:item-place')
    },
    previewNode,
  )

  if (!activeLevelId) return null

  return (
    <group layers={EDITOR_LAYER} ref={cursorRef} visible={cursorVisible}>
      <HotTubPreview node={previewNode} />
    </group>
  )
}
