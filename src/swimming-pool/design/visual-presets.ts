import type { PoolNode } from '../core/schema'

export const POOL_VISUAL_PRESETS = [
  'custom',
  'modern',
  'natural',
  'resort',
  'lap-pool',
] as const

export type PoolVisualPreset = (typeof POOL_VISUAL_PRESETS)[number]
export type PoolVisualPresetPatch = Partial<Pick<PoolNode,
  'copingStyle' | 'interiorFinish' | 'waterPreset' | 'entryFeature' |
  'copingColor' | 'shellColor' | 'copingWidth' | 'waterColor'
>>

export const POOL_VISUAL_PRESETS_SETTINGS: Record<PoolVisualPreset, PoolVisualPresetPatch> = {
  custom: {},
  modern: {
    copingStyle: 'continuous',
    interiorFinish: 'dark-mosaic',
    waterPreset: 'clear',
    copingColor: '#d8d8d2',
    shellColor: '#dce5e2',
    copingWidth: 0.25,
  },
  natural: {
    copingStyle: 'rock',
    interiorFinish: 'white-plaster',
    waterPreset: 'clear',
    copingColor: '#b9b8b1',
    shellColor: '#e5ebe7',
    copingWidth: 0.38,
  },
  resort: {
    copingStyle: 'continuous',
    interiorFinish: 'light-mosaic',
    waterPreset: 'tropical',
    entryFeature: 'tanning-shelf',
    copingColor: '#eee8d9',
    shellColor: '#d9e7e3',
    copingWidth: 0.3,
  },
  'lap-pool': {
    copingStyle: 'continuous',
    interiorFinish: 'blue-mosaic',
    waterPreset: 'clear',
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
