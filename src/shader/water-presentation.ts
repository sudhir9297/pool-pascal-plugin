import {
  DataTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  NoColorSpace,
  RGBAFormat,
  RepeatWrapping,
  TextureLoader,
  UnsignedByteType,
  type Texture,
} from 'three/webgpu'
import {
  getWaterPresetSettings,
  type WaterPreset,
  type WaterPresetSettings,
} from './water-presets'

export const WATER_ASSET_URLS = {
  normal1: new URL('./assets/water/normal1.webp', import.meta.url).href,
  normal2: new URL('./assets/water/normal2.webp', import.meta.url).href,
  normal3: new URL('./assets/water/normal3.webp', import.meta.url).href,
  caustic1: new URL('./assets/water/caustic1.webp', import.meta.url).href,
  caustic2: new URL('./assets/water/caustic2.webp', import.meta.url).href,
  noise1: new URL('./assets/water/noise1.webp', import.meta.url).href,
  noise2: new URL('./assets/water/noise2.webp', import.meta.url).href,
  noise4: new URL('./assets/water/noise4.webp', import.meta.url).href,
  noise5: new URL('./assets/water/noise5.webp', import.meta.url).href,
  white: new URL('./assets/water/white.webp', import.meta.url).href,
} as const

export type WaterAsset = keyof typeof WATER_ASSET_URLS

export const WATER_PRESET_TEXTURES: Record<WaterPreset, {
  normal: WaterAsset
  caustic: WaterAsset
  distortion: WaterAsset
  shoreline: WaterAsset
}> = {
  'crystal-clear': { normal: 'normal1', caustic: 'caustic1', distortion: 'noise2', shoreline: 'white' },
  'vivid-aqua': { normal: 'normal3', caustic: 'caustic2', distortion: 'noise1', shoreline: 'noise1' },
  'tropical-lagoon': { normal: 'normal2', caustic: 'caustic1', distortion: 'noise4', shoreline: 'noise5' },
}

export const WATERFALL_PRESET_TEXTURES: Record<WaterPreset, {
  mask: WaterAsset
  detail: WaterAsset
  normal: WaterAsset
}> = {
  'crystal-clear': { mask: 'caustic1', detail: 'noise5', normal: 'normal1' },
  'vivid-aqua': { mask: 'caustic2', detail: 'noise1', normal: 'normal3' },
  'tropical-lagoon': { mask: 'caustic1', detail: 'noise4', normal: 'normal2' },
}

type TextureFallback = 'pool' | 'waterfall'

const textureCache = new Map<string, Texture>()

function fallbackTexture(kind: TextureFallback): Texture {
  const data = kind === 'pool'
    ? new Uint8Array([
      128, 128, 255, 255,
      255, 255, 255, 255,
      128, 128, 255, 255,
      255, 255, 255, 255,
    ])
    : new Uint8Array([
      32, 128, 255, 255, 224, 96, 255, 255,
      192, 220, 255, 255, 64, 160, 255, 255,
    ])
  const result = new DataTexture(data, 2, 2, RGBAFormat, UnsignedByteType)
  result.needsUpdate = true
  if (kind === 'pool') result.minFilter = LinearFilter
  return result
}

export function loadWaterTexture(asset: WaterAsset, kind: TextureFallback): Texture {
  const url = WATER_ASSET_URLS[asset]
  const cacheKey = `${kind}:${url}`
  const cached = textureCache.get(cacheKey)
  if (cached) return cached
  const result = typeof document === 'undefined'
    ? fallbackTexture(kind)
    : new TextureLoader().load(url)
  result.wrapS = RepeatWrapping
  result.wrapT = RepeatWrapping
  result.colorSpace = NoColorSpace
  result.minFilter = kind === 'pool' && typeof document !== 'undefined'
    ? LinearMipmapLinearFilter
    : LinearFilter
  result.magFilter = LinearFilter
  if (kind === 'pool') result.anisotropy = 8
  textureCache.set(cacheKey, result)
  return result
}

export type WaterStyleInput = {
  waterPreset?: unknown
  shallowWaterColor?: unknown
  deepWaterColor?: unknown
}

export function resolveWaterStyle(input: WaterStyleInput): WaterPresetSettings {
  const preset = getWaterPresetSettings(input.waterPreset)
  return {
    ...preset,
    shallowWaterColor: typeof input.shallowWaterColor === 'string'
      ? input.shallowWaterColor
      : preset.shallowWaterColor,
    deepWaterColor: typeof input.deepWaterColor === 'string'
      ? input.deepWaterColor
      : preset.deepWaterColor,
  }
}
