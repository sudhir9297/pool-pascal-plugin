import type { ParametricDescriptor } from '@pascal-app/core'
import { POOL_ENTRY_FEATURES } from '../design/entry-features'
import { POOL_FLOOR_PROFILES } from '../design/depth-profile'
import { POOL_SHAPES, isDrawnPoolShape } from '../design/shapes'
import { triggerPoolWaterAction } from '../shader/water-actions'
import { WATER_PRESETS, getWaterPresetSettings } from '../shader/water-presets'
import type { PoolNode } from '../core/schema'
import { POOL_FINISHES } from '../design/pool-finishes'
import { POOL_VISUAL_PRESETS, getPoolVisualPreset } from '../design/visual-presets'

export const poolParametrics: ParametricDescriptor<PoolNode> = {
  groups: [
    {
      label: 'Pool geometry',
      fields: [
        { key: 'shape', kind: 'enum', options: POOL_SHAPES },
        { key: 'visualPreset', kind: 'enum', options: POOL_VISUAL_PRESETS },
        { key: 'length', kind: 'number', unit: 'm', min: 0.5, max: 100, step: 0.1, visibleIf: (node) => !isDrawnPoolShape(node.shape) },
        { key: 'width', kind: 'number', unit: 'm', min: 0.5, max: 100, step: 0.1, visibleIf: (node) => !isDrawnPoolShape(node.shape) },
        { key: 'floorProfile', kind: 'enum', options: POOL_FLOOR_PROFILES },
        { key: 'depth', kind: 'number', unit: 'm', min: 0.5, max: 4, step: 0.1, visibleIf: (node) => node.floorProfile === 'flat' },
        { key: 'shallowDepth', kind: 'number', unit: 'm', min: 0.5, max: 4, step: 0.1, visibleIf: (node) => node.floorProfile === 'shallow-to-deep' },
        { key: 'deepDepth', kind: 'number', unit: 'm', min: 0.5, max: 4, step: 0.1, visibleIf: (node) => node.floorProfile === 'shallow-to-deep' },
        { key: 'entryFeature', kind: 'enum', options: POOL_ENTRY_FEATURES },
        { key: 'entryLength', kind: 'number', unit: 'm', min: 0.5, max: 8, step: 0.1, visibleIf: (node) => node.entryFeature !== 'none' },
        { key: 'entryWaterDepth', kind: 'number', unit: 'm', min: 0.05, max: 1, step: 0.05, visibleIf: (node) => node.entryFeature === 'steps' || node.entryFeature === 'tanning-shelf' },
        { key: 'stepCount', kind: 'number', min: 2, max: 6, step: 1, visibleIf: (node) => node.entryFeature === 'steps' },
        { key: 'benchEnabled', kind: 'boolean' },
        { key: 'benchStyle', kind: 'enum', options: ['end', 'perimeter'], display: 'segmented', visibleIf: (node) => node.benchEnabled },
        { key: 'benchWidth', kind: 'number', unit: 'm', min: 0.2, max: 1.5, step: 0.05, visibleIf: (node) => node.benchEnabled },
        { key: 'benchWaterDepth', kind: 'number', unit: 'm', min: 0.1, max: 1.2, step: 0.05, visibleIf: (node) => node.benchEnabled },
        { key: 'coveRadius', kind: 'number', unit: 'm', min: 0, max: 0.5, step: 0.01 },
        { key: 'copingWidth', kind: 'number', unit: 'm', min: 0.1, max: 1, step: 0.05 },
        { key: 'copingStyle', kind: 'enum', options: ['continuous', 'natural-stone', 'rock'], display: 'segmented' },
        { key: 'copingStoneLength', kind: 'number', unit: 'm', min: 0.2, max: 2, step: 0.05, visibleIf: (node) => node.copingStyle === 'rock' || node.copingStyle === 'natural-stone' },
        { key: 'copingIrregularity', kind: 'number', min: 0, max: 1, step: 0.05, visibleIf: (node) => node.copingStyle === 'rock' || node.copingStyle === 'natural-stone' },
        { key: 'copingSeed', kind: 'number', min: 0, max: 999999, step: 1, visibleIf: (node) => node.copingStyle === 'rock' || node.copingStyle === 'natural-stone' },
        { key: 'copingColor', kind: 'color' },
        { key: 'shellColor', kind: 'color' },
        { key: 'interiorFinish', kind: 'enum', options: POOL_FINISHES },
        { key: 'openingClearance', kind: 'number', unit: 'm', min: 0, max: 0.2, step: 0.005 },
      ],
    },
    {
      label: 'Water shader',
      fields: [
        { key: 'waterPreset', kind: 'enum', options: WATER_PRESETS },
        { key: 'shallowWaterColor', kind: 'color' },
        { key: 'deepWaterColor', kind: 'color' },
        { key: 'surfaceDetail', kind: 'number', min: 0.4, max: 3, step: 0.05 },
        { key: 'normalScale', kind: 'number', min: 0.25, max: 20, step: 0.25 },
        { key: 'normalStrength', kind: 'number', min: 0, max: 2, step: 0.05 },
        { key: 'normalSpeed', kind: 'number', min: -3, max: 3, step: 0.05 },
        { key: 'reflectionStrength', kind: 'number', min: 0, max: 2, step: 0.05 },
        { key: 'reflectionDistortion', kind: 'number', min: 0, max: 4, step: 0.05 },
        { key: 'refractionStrength', kind: 'number', min: 0, max: 1, step: 0.05 },
        { key: 'causticsStrength', kind: 'number', min: 0, max: 4, step: 0.05 },
        { key: 'rain', kind: 'number', min: 0, max: 1, step: 0.01 },
        { key: 'breeze', kind: 'number', min: 0, max: 1, step: 0.01 },
      ],
    },
    { label: 'Transform', fields: [{ key: 'position', kind: 'vec3' }] },
  ],
  actions: [
    { label: 'Big splash', onClick: (node) => triggerPoolWaterAction(node.id, 'splash') },
    { label: 'Calm water', onClick: (node) => triggerPoolWaterAction(node.id, 'calm') },
    { label: 'Storm water', onClick: (node) => triggerPoolWaterAction(node.id, 'storm') },
    { label: 'Reset surface', onClick: (node) => triggerPoolWaterAction(node.id, 'reset') },
  ],
  derive: (next, patch) => {
    const derived = 'visualPreset' in patch ? getPoolVisualPreset(next.visualPreset) : {}
    return 'waterPreset' in patch
      ? { ...derived, ...getWaterPresetSettings(next.waterPreset) }
      : derived
  },
}
