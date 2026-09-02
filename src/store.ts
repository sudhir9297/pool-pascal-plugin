import { create } from 'zustand'
import { HOT_TUB_PRESETS } from './hotTub-presets'
import type { HotTubPreset } from './hotTub-schema'
import { WATER_FEATURE_PRESETS } from './waterFeatures-presets'
import type { WaterFeaturesPreset } from './waterFeatures-schema'
import { defaultHeightOf, POOL_PRESETS } from './presets'
import type { PoolPreset, PoolSize } from './schema'

/**
 * The plugin's own module-level state — the example of "plugins self-manage
 * runtime state with module-level stores" from the plugin-authoring contract.
 * It holds the placement brush: the design used by the next pool or spa.
 * The presets panel writes it; the placement tool reads it. No host lifecycle
 * slot. Colours are intentionally absent — they're edit-only (inspector).
 */
/** Which section of the Pool panel is showing. */
export type PoolsPanelMode = 'pools' | 'hotTubs' | 'waterFeatures'

type PoolsStore = {
  /** Active panel section — in the store (not panel-local state) so the host's
   * "find in catalog" can land on the right section (see `find-sync.ts`). */
  mode: PoolsPanelMode
  setMode: (mode: PoolsPanelMode) => void
  preset: PoolPreset
  size: PoolSize
  /** Height (m) of the next pool — a per-instance scale, never affects placed pools. */
  height: number
  /** Leaf-count multiplier vs the preset (folded into the instancing variant). */
  detailDensity: number
  /** Branch-radius multiplier (folded into the instancing variant). */
  wallThickness: number
  /** Feature bare (minimal) pools. */
  minimal: boolean
  setPreset: (preset: PoolPreset) => void
  setSize: (size: PoolSize) => void
  setHeight: (height: number) => void
  setDetailDensity: (value: number) => void
  setWallThickness: (value: number) => void
  setMinimal: (value: boolean) => void
  // HotTub brush (sibling kind).
  hotTubPreset: HotTubPreset
  hotTubHeight: number
  setHotTubPreset: (preset: HotTubPreset) => void
  setHotTubHeight: (height: number) => void
  // WaterFeatures brush (sibling kind).
  waterFeaturesPreset: WaterFeaturesPreset
  waterFeaturesHeight: number
  setWaterFeaturesPreset: (preset: WaterFeaturesPreset) => void
  setWaterFeaturesHeight: (height: number) => void
}

export const usePoolsStore = create<PoolsStore>((set, get) => ({
  mode: 'pools',
  setMode: (mode) => set({ mode }),
  preset: 'family',
  size: 'medium',
  height: POOL_PRESETS.family.height.medium,
  detailDensity: 1,
  wallThickness: 1,
  minimal: false,
  // Switching preset/size re-seeds the height to that combo's natural default;
  // the foliage/coping brush settings carry over. Growth model comes from the
  // Design defaults are applied on placement; overrides remain editable in the inspector.
  setPreset: (preset) => set({ preset, height: defaultHeightOf(preset, get().size) }),
  setSize: (size) => set({ size, height: defaultHeightOf(get().preset, size) }),
  setHeight: (height) => set({ height }),
  setDetailDensity: (detailDensity) => set({ detailDensity }),
  setWallThickness: (wallThickness) => set({ wallThickness }),
  setMinimal: (minimal) => set({ minimal }),
  hotTubPreset: 'spa',
  hotTubHeight: HOT_TUB_PRESETS.spa.defaultHeight,
  setHotTubPreset: (hotTubPreset) =>
    set({ hotTubPreset, hotTubHeight: HOT_TUB_PRESETS[hotTubPreset].defaultHeight }),
  setHotTubHeight: (hotTubHeight) => set({ hotTubHeight }),
  waterFeaturesPreset: 'fountain',
  waterFeaturesHeight: WATER_FEATURE_PRESETS.fountain.defaultHeight,
  setWaterFeaturesPreset: (waterFeaturesPreset) =>
    set({ waterFeaturesPreset, waterFeaturesHeight: WATER_FEATURE_PRESETS[waterFeaturesPreset].defaultHeight }),
  setWaterFeaturesHeight: (waterFeaturesHeight) => set({ waterFeaturesHeight }),
}))
