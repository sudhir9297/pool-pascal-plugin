import PoolFittingSummary from './fitting-summary'
import { planPoolFittings } from '../design/pool-fitting-layout'
import type { ParametricDescriptor } from '@pascal-app/core'
import { POOL_ENTRY_FEATURES } from '../design/entry-features'
import { POOL_FLOOR_PROFILES } from '../design/depth-profile'
import { POOL_SHAPES, createPoolShapePolygon, isDrawnPoolShape } from '../design/shapes'
import { triggerPoolWaterAction } from '../shader/water-actions'
import { WATER_PRESETS, getWaterPresetSettings } from '../shader/water-presets'
import type { PoolNode } from '../core/schema'
import { POOL_FINISHES } from '../design/pool-finishes'
import { POOL_VISUAL_PRESETS, getPoolVisualPreset } from '../design/visual-presets'

export const poolParametrics: ParametricDescriptor<PoolNode> = {
  invariants: [(node) => node.automaticFittings
    ? planPoolFittings(node).issues.map((msg) => ({ msg, severity: 'warning' as const }))
    : []],
  groups: [
    {
      label: 'Automatic fittings · planning estimates',
      fields: [
        { key: 'automaticFittings', kind: 'boolean' },
        { key: 'fittingSummary', kind: 'custom', component: PoolFittingSummary, visibleIf: (node) => node.automaticFittings },
        { key: 'turnoverHours', kind: 'number', unit: 'h', min: 1, max: 24, step: 1, visibleIf: (node) => node.automaticFittings },
        { key: 'fittingFlowRate', kind: 'number', unit: 'm³/h (0 = estimate)', min: 0, max: 10000, step: 1, visibleIf: (node) => node.automaticFittings },
        { key: 'drainFlowCapacity', kind: 'number', unit: 'm³/h per outlet', min: 1, max: 1000, step: 1, visibleIf: (node) => node.automaticFittings },
      ],
    },
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
        { key: 'benchBoundaryT', kind: 'number', min: 0, max: 1, step: 0.01, visibleIf: (node) => node.benchEnabled && node.benchStyle === 'end' },
        { key: 'benchLength', kind: 'number', unit: 'm', min: 0.5, max: 20, step: 0.1, visibleIf: (node) => node.benchEnabled && node.benchStyle === 'end' },
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
    {
      label: 'Big splash',
      iconSrc: 'https://api.iconify.design/lucide/waves.svg?color=%230284c7',
      enabledIf: (node) => node.visible,
      onClick: (node) => triggerPoolWaterAction(node.id, 'splash'),
    },
    {
      label: 'Calm water',
      iconSrc: 'https://api.iconify.design/lucide/waves.svg?color=%2306478f',
      enabledIf: (node) => node.visible,
      onClick: (node) => triggerPoolWaterAction(node.id, 'calm'),
    },
    {
      label: 'Storm water',
      iconSrc: 'https://api.iconify.design/lucide/cloud-lightning.svg?color=%237c3aed',
      enabledIf: (node) => node.visible,
      onClick: (node) => triggerPoolWaterAction(node.id, 'storm'),
    },
    {
      label: 'Reset water',
      iconSrc: 'https://api.iconify.design/lucide/rotate-ccw.svg?color=%23475569',
      enabledIf: (node) => node.visible,
      onClick: (node) => triggerPoolWaterAction(node.id, 'reset'),
    },
  ],
  derive: (next, patch) => {
    const derived = {
      ...('visualPreset' in patch ? getPoolVisualPreset(next.visualPreset) : {}),
      ...(!isDrawnPoolShape(next.shape) && ('length' in patch || 'width' in patch || 'shape' in patch)
        ? { polygon: createPoolShapePolygon(next.shape, next.length, next.width), outlineControlPoints: [] }
        : {}),
    }
    return 'waterPreset' in patch
      ? { ...derived, ...getWaterPresetSettings(next.waterPreset) }
      : derived
  },
}
