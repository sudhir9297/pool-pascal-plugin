import {
  POOL_VISUAL_PRESETS,
  type PoolEntryFeature,
  type PoolFinish,
  type PoolVisualPreset,
  type WaterPreset,
} from '../core/pool-options'
export { POOL_VISUAL_PRESETS, type PoolVisualPreset } from '../core/pool-options'

export type PoolVisualPresetPatch = Partial<{
  copingStyle: 'continuous' | 'natural-stone' | 'rock'
  interiorFinish: PoolFinish
  waterPreset: WaterPreset
  entryFeature: PoolEntryFeature
  copingColor: string
  shellColor: string
  copingWidth: number
  waterColor: string
}>

export const POOL_VISUAL_PRESETS_SETTINGS: Record<PoolVisualPreset, PoolVisualPresetPatch> = {
  custom: {},
  modern: {
    copingStyle: 'continuous',
    interiorFinish: 'dark-mosaic',
    waterPreset: 'crystal-clear',
    copingColor: '#d8d8d2',
    shellColor: '#dce5e2',
    copingWidth: 0.25,
  },
  natural: {
    copingStyle: 'rock',
    interiorFinish: 'white-plaster',
    waterPreset: 'crystal-clear',
    copingColor: '#b9b8b1',
    shellColor: '#e5ebe7',
    copingWidth: 0.38,
  },
  resort: {
    copingStyle: 'continuous',
    interiorFinish: 'light-mosaic',
    waterPreset: 'tropical-lagoon',
    entryFeature: 'tanning-shelf',
    copingColor: '#eee8d9',
    shellColor: '#d9e7e3',
    copingWidth: 0.3,
  },
  'lap-pool': {
    copingStyle: 'continuous',
    interiorFinish: 'blue-mosaic',
    waterPreset: 'crystal-clear',
    entryFeature: 'none',
    copingColor: '#e7e7e1',
    shellColor: '#b6d4d4',
    copingWidth: 0.22,
  },
}

export function getPoolVisualPreset(value: unknown): PoolVisualPresetPatch {
  const preset = typeof value === 'string' && POOL_VISUAL_PRESETS.includes(value as PoolVisualPreset)
    ? value as PoolVisualPreset
    : 'custom'
  return POOL_VISUAL_PRESETS_SETTINGS[preset]
}
