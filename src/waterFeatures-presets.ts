import { WATER_FEATURE_ART } from './art'
import type { WaterFeaturesPreset } from './waterFeatures-schema'

/** Per-waterFeatures config: blade colour, blade count per feature, default height (metres),
 * a swatch, and a replaceable card `thumbnail` (see `thumbnails.ts`). Pure data
 * shared by the geometry builder and the panel. */
export type WaterFeaturesPresetSpec = {
  id: WaterFeaturesPreset
  label: string
  waterColor: string
  blades: number
  defaultHeight: number
  swatch: string
  thumbnail: string
}

export const WATER_FEATURE_PRESETS: Record<WaterFeaturesPreset, WaterFeaturesPresetSpec> = {
  fountain: {
    id: 'fountain',
    label: 'Fountain',
    waterColor: '#76c7e8',
    blades: 10,
    defaultHeight: 0.4,
    swatch: '#76c7e8',
    thumbnail: WATER_FEATURE_ART.fountain,
  },
  spillway: {
    id: 'spillway',
    label: 'Spillway',
    waterColor: '#55b6c9',
    blades: 8,
    defaultHeight: 0.7,
    swatch: '#55b6c9',
    thumbnail: WATER_FEATURE_ART.spillway,
  },
  cascade: {
    id: 'cascade',
    label: 'Cascade',
    waterColor: '#3da6c7',
    blades: 6,
    defaultHeight: 1.1,
    swatch: '#3da6c7',
    thumbnail: WATER_FEATURE_ART.cascade,
  },
}

export const WATER_FEATURE_PRESET_LIST: WaterFeaturesPresetSpec[] = Object.values(WATER_FEATURE_PRESETS)

/** Bounded seed pool so waterFeatures features share instancing variants (see pools). */
export const WATER_FEATURE_SEED_POOL = [1, 7, 13, 21, 34]
