'use client'

import { type AnyNode, type AnyNodeId, useScene } from '@pascal-app/core'
import { EDITOR_LAYER, triggerSFX } from '@pascal-app/editor'
import { useViewer } from '@pascal-app/viewer'
import { useMemo } from 'react'
import { WATER_FEATURE_PRESETS, WATER_FEATURE_SEED_POOL } from './waterFeatures-presets'
import WaterFeaturesPreview from './waterFeatures-preview'
import { WaterFeaturesNode } from './waterFeatures-schema'
import { usePlacement } from './placement'
import { usePoolsStore } from './store'

/** The waterFeatures placement tool — mirrors the pools/hotTubs tools, reading the waterFeatures
 * brush from the shared store. Blade colour is baked from the preset at
 * placement, then editable per-feature in the inspector. */
export default function WaterFeaturesTool() {
  const activeLevelId = useViewer((s) => s.selection.levelId)
  const preset = usePoolsStore((s) => s.waterFeaturesPreset)
  const height = usePoolsStore((s) => s.waterFeaturesHeight)

  const previewNode = useMemo(
    () =>
      WaterFeaturesNode.parse({
        preset,
        height,
        waterColor: WATER_FEATURE_PRESETS[preset].waterColor,
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
      const waterFeatures = WaterFeaturesNode.parse({
        preset: s.waterFeaturesPreset,
        height: s.waterFeaturesHeight,
        waterColor: WATER_FEATURE_PRESETS[s.waterFeaturesPreset].waterColor,
        seed: WATER_FEATURE_SEED_POOL[Math.floor(Math.random() * WATER_FEATURE_SEED_POOL.length)] ?? 1,
        position,
        rotation: [0, (Math.floor(Math.random() * 8) * Math.PI) / 4, 0],
      })
      useScene.getState().createNode(waterFeatures as unknown as AnyNode, activeLevelId as AnyNodeId)
      useViewer.getState().setSelection({ selectedIds: [waterFeatures.id as AnyNodeId] })
      triggerSFX('sfx:item-place')
    },
    previewNode,
  )

  if (!activeLevelId) return null

  return (
    <group layers={EDITOR_LAYER} ref={cursorRef} visible={cursorVisible}>
      <WaterFeaturesPreview node={previewNode} />
    </group>
  )
}
