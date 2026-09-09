export const POOL_SHAPES = [
  'rectangle',
  'circle',
  'lap-rectangle',
  'kidney',
  'lagoon',
  'roman',
  'l-shape',
  'spline',
  'custom',
] as const

export const POOL_FLOOR_PROFILES = ['flat', 'shallow-to-deep'] as const
export const POOL_ENTRY_FEATURES = ['none', 'steps', 'tanning-shelf', 'beach-entry'] as const
export const POOL_VISUAL_PRESETS = ['custom', 'modern', 'natural', 'resort', 'lap-pool'] as const
export const WATER_PRESETS = ['crystal-clear', 'vivid-aqua', 'tropical-lagoon'] as const
export const POOL_FINISHES = [
  'clean-white-plaster',
  'clean-pale-blue-plaster',
  'white-plaster',
  'quartz-white',
  'quartz-blue-gray',
  'natural-pebble-aqua',
  'natural-pebble-gray',
  'polished-aggregate-blue',
  'glass-bead-aqua',
  'light-mosaic',
  'blue-mosaic',
  'dark-mosaic',
] as const

export type PoolShape = (typeof POOL_SHAPES)[number]
export type PoolFloorProfile = (typeof POOL_FLOOR_PROFILES)[number]
export type PoolEntryFeature = (typeof POOL_ENTRY_FEATURES)[number]
export type PoolVisualPreset = (typeof POOL_VISUAL_PRESETS)[number]
export type PoolFinish = (typeof POOL_FINISHES)[number]
export type WaterPreset = (typeof WATER_PRESETS)[number]
