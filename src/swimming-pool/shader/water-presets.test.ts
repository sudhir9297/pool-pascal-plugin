import { describe, expect, test } from 'bun:test'
import { PoolNode } from '../core/schema'
import { PoolWaterfallNode } from '../water-feature/waterfall/core/schema'
import {
  WATER_PRESETS,
  WATER_PRESET_SETTINGS,
  getWaterPresetSettings,
} from './water-presets'

describe('water preset names', () => {
  test('exposes descriptive preset names', () => {
    expect(WATER_PRESETS).toEqual(['crystal-clear', 'vivid-aqua', 'tropical-lagoon'])
    expect(WATER_PRESET_SETTINGS['crystal-clear'].waterPreset).toBe('crystal-clear')
    expect(WATER_PRESET_SETTINGS['vivid-aqua'].waterPreset).toBe('vivid-aqua')
    expect(WATER_PRESET_SETTINGS['tropical-lagoon'].waterPreset).toBe('tropical-lagoon')
  })

  test('migrates legacy preset values when loading existing pools', () => {
    expect(PoolNode.parse({ waterPreset: 'clear' }).waterPreset).toBe('crystal-clear')
    expect(PoolNode.parse({ waterPreset: 'genshin' }).waterPreset).toBe('vivid-aqua')
    expect(PoolNode.parse({ waterPreset: 'tropical' }).waterPreset).toBe('tropical-lagoon')
    expect(PoolWaterfallNode.parse({ waterPreset: 'genshin' }).waterPreset).toBe('vivid-aqua')
    expect(getWaterPresetSettings('clear').waterPreset).toBe('crystal-clear')
  })
})
