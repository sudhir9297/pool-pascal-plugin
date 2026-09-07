import { WATER_PRESETS, type WaterPreset } from './pool-options'
export { WATER_PRESETS, type WaterPreset } from './pool-options'

export type WaterPresetSettings = {
  waterPreset: WaterPreset
  shallowWaterColor: string
  deepWaterColor: string
  surfaceDetail: number
  viscosity: number
  rippleSize: number
  clarity: number
  rain: number
  breeze: number
  normalScale: number
  normalStrength: number
  normalSpeed: number
  reflectionStrength: number
  reflectionFresnel: number
  reflectionDistortion: number
  refractionStrength: number
  causticsStrength: number
  causticsScale: number
  causticsSpeed: number
  intersectionStrength: number
  intersectionColor: string
  intersectionWidth: number
  shorelineStrength: number
  shorelineWidth: number
  shorelineSpeed: number
  specularStrength: number
  specularSize: number
  specularHardness: number
}

/**
 * Runtime-sized subset of the original Uber Stylized Water presets. Values
 * retain the source material's normal, reflection, refraction, caustic,
 * shoreline, and specular tuning. Colors are the source linear RGB values
 * converted to display-space hex for Pascal's color editor.
 */
export const WATER_PRESET_SETTINGS: Record<WaterPreset, WaterPresetSettings> = {
  'crystal-clear': {
    waterPreset: 'crystal-clear',
    shallowWaterColor: '#83eab3',
    deepWaterColor: '#008ab3',
    surfaceDetail: 1.6,
    viscosity: 0.4,
    rippleSize: 30,
    clarity: 1.65,
    rain: 0,
    breeze: 0.18,
    normalScale: 5,
    normalStrength: 0.49,
    normalSpeed: 1.5,
    reflectionStrength: 1,
    reflectionFresnel: 5,
    reflectionDistortion: 1,
    refractionStrength: 0.2,
    causticsStrength: 3,
    causticsScale: 2.76,
    causticsSpeed: 1.3,
    intersectionStrength: 0.18,
    intersectionColor: '#f6e975',
    intersectionWidth: 1.17,
    shorelineStrength: 0.22,
    shorelineWidth: 0.35,
    shorelineSpeed: 0,
    specularStrength: 1.35,
    specularSize: 0.52,
    specularHardness: 0.82,
  },
  'vivid-aqua': {
    waterPreset: 'vivid-aqua',
    shallowWaterColor: '#00d9a3',
    deepWaterColor: '#00c0d3',
    surfaceDetail: 1.9,
    viscosity: 0.32,
    rippleSize: 26,
    clarity: 1.25,
    rain: 0,
    breeze: 0.3,
    normalScale: 3,
    normalStrength: 0.7,
    normalSpeed: 1.3,
    reflectionStrength: 0.813,
    reflectionFresnel: 6,
    reflectionDistortion: 2.57,
    refractionStrength: 0.5,
    causticsStrength: 0.5,
    causticsScale: 3,
    causticsSpeed: 2,
    intersectionStrength: 0,
    intersectionColor: '#f6e975',
    intersectionWidth: 1.17,
    shorelineStrength: 1,
    shorelineWidth: 0.333,
    shorelineSpeed: -0.5,
    specularStrength: 1.8,
    specularSize: 0.479,
    specularHardness: 1,
  },
  'tropical-lagoon': {
    waterPreset: 'tropical-lagoon',
    shallowWaterColor: '#2aeafe',
    deepWaterColor: '#0088c2',
    surfaceDetail: 2.15,
    viscosity: 0.28,
    rippleSize: 24,
    clarity: 1.4,
    rain: 0,
    breeze: 0.38,
    normalScale: 15,
    normalStrength: 1.4,
    normalSpeed: 1.5,
    reflectionStrength: 0.875,
    reflectionFresnel: 6,
    reflectionDistortion: 1.25,
    refractionStrength: 0.5,
    causticsStrength: 1.33,
    causticsScale: 2,
    causticsSpeed: 1.5,
    intersectionStrength: 1,
    intersectionColor: '#f6e975',
    intersectionWidth: 1.17,
    shorelineStrength: 1,
    shorelineWidth: 0.868,
    shorelineSpeed: 0.79,
    specularStrength: 2.2,
    specularSize: 0.496,
    specularHardness: 0.976,
  },
}

export function getWaterPresetSettings(value: unknown): WaterPresetSettings {
  const legacyAliases: Record<string, WaterPreset> = {
    clear: 'crystal-clear',
    genshin: 'vivid-aqua',
    tropical: 'tropical-lagoon',
  }
  const normalized = typeof value === 'string' ? legacyAliases[value] ?? value : undefined
  return WATER_PRESET_SETTINGS[
    typeof normalized === 'string' && WATER_PRESETS.includes(normalized as WaterPreset)
      ? normalized as WaterPreset
      : 'crystal-clear'
  ]
}
