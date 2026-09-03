import type { ParametricDescriptor } from '@pascal-app/core'
import { WATER_PRESETS, getWaterPresetSettings } from '../../../shader/water-presets'
import type { PoolWaterfallNode } from '../core/schema'

export const poolWaterfallParametrics: ParametricDescriptor<PoolWaterfallNode> = {
  groups: [
    {
      label: 'Waterfall settings',
      fields: [
        { key: 'waterfallType', kind: 'enum', options: ['modern', 'rock-cascade', 'spillover'], display: 'segmented' },
        { key: 'width', kind: 'number', unit: 'm', min: 0.8, max: 12, step: 0.05 },
        { key: 'height', kind: 'number', unit: 'm', min: 0.6, max: 6, step: 0.05 },
        { key: 'depth', kind: 'number', unit: 'm', min: 0.4, max: 4, step: 0.05 },
        { key: 'lipThickness', kind: 'number', unit: 'm', min: 0.02, max: 0.3, step: 0.01 },
        { key: 'showFlow', kind: 'boolean' },
        { key: 'flowStrength', kind: 'number', min: 0.2, max: 2, step: 0.05, visibleIf: (node) => node.showFlow },
        { key: 'wallIndex', kind: 'number', min: 0, step: 1, visibleIf: (node) => Boolean(node.poolId) },
        { key: 'wallT', kind: 'number', min: 0, max: 1, step: 0.01, visibleIf: (node) => Boolean(node.poolId) },
        { key: 'receivingPoolEnabled', kind: 'boolean', visibleIf: (node) => !node.poolId },
        { key: 'receivingPoolWidth', kind: 'number', unit: 'm', min: 1, max: 16, step: 0.1, visibleIf: (node) => !node.poolId && node.receivingPoolEnabled },
        { key: 'receivingPoolDepth', kind: 'number', unit: 'm', min: 0.8, max: 12, step: 0.1, visibleIf: (node) => !node.poolId && node.receivingPoolEnabled },
        { key: 'rockSeed', kind: 'number', min: 1, max: 999999, step: 1 },
      ],
    },
    {
      label: 'Materials',
      fields: [
        { key: 'waterPreset', kind: 'enum', options: WATER_PRESETS, visibleIf: (node) => !node.poolId },
        { key: 'shallowWaterColor', kind: 'color', visibleIf: (node) => !node.poolId },
        { key: 'deepWaterColor', kind: 'color', visibleIf: (node) => !node.poolId },
        { key: 'poolBedColor', kind: 'color', visibleIf: (node) => !node.poolId && node.receivingPoolEnabled },
        { key: 'rockColor', kind: 'color', visibleIf: (node) => node.waterfallType !== 'modern' },
        { key: 'structureColor', kind: 'color', visibleIf: (node) => node.waterfallType === 'modern' },
      ],
    },
    {
      label: 'Transform',
      fields: [
        { key: 'position', kind: 'vec3', visibleIf: (node) => !node.poolId },
        { key: 'rotation', kind: 'vec3', visibleIf: (node) => !node.poolId },
      ],
    },
  ],
  derive: (next, patch) => {
    if (!('waterPreset' in patch)) return {}
    const preset = getWaterPresetSettings(next.waterPreset)
    return {
      waterPreset: preset.waterPreset,
      shallowWaterColor: preset.shallowWaterColor,
      deepWaterColor: preset.deepWaterColor,
    }
  },
}
