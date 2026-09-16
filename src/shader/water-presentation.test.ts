import { describe, expect, test } from 'bun:test'
import { LinearFilter, NoColorSpace, RepeatWrapping } from 'three/webgpu'
import {
  loadWaterTexture,
  resolveWaterStyle,
  WATER_ASSET_URLS,
  WATERFALL_PRESET_TEXTURES,
  WATER_PRESET_TEXTURES,
} from './water-presentation'

describe('shared water presentation resources', () => {
  test('keeps the pool and waterfall preset texture selections centralized', () => {
    expect(WATER_PRESET_TEXTURES['crystal-clear'].shoreline).toBe('white')
    expect(WATERFALL_PRESET_TEXTURES['crystal-clear'].detail).toBe('noise5')
    expect(WATER_ASSET_URLS.normal1).toContain('/assets/water/normal1.webp')
  })

  test('resolves preset colors with saved overrides and legacy aliases', () => {
    expect(resolveWaterStyle({ waterPreset: 'genshin', shallowWaterColor: '#123456' })).toMatchObject({
      waterPreset: 'vivid-aqua',
      shallowWaterColor: '#123456',
      deepWaterColor: '#00c0d3',
    })
  })

  test('caches each loader variant and preserves its sampler configuration', () => {
    const pool = loadWaterTexture('normal1', 'pool')
    const waterfall = loadWaterTexture('normal1', 'waterfall')

    expect(loadWaterTexture('normal1', 'pool')).toBe(pool)
    expect(loadWaterTexture('normal1', 'waterfall')).toBe(waterfall)
    expect(pool).not.toBe(waterfall)
    expect(pool.wrapS).toBe(RepeatWrapping)
    expect(pool.colorSpace).toBe(NoColorSpace)
    expect(pool.minFilter).toBe(LinearFilter)
    expect(waterfall.minFilter).toBe(LinearFilter)
    expect(pool.anisotropy).toBe(8)
    expect(waterfall.anisotropy).not.toBe(8)

    pool.dispose()
    waterfall.dispose()
  })
})
