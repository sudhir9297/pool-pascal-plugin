import { BaseNode, nodeType, objectId } from '@pascal-app/core'
import { z } from 'zod'
import { WATER_PRESETS, WATER_PRESET_SETTINGS } from '../../../core/water-presets'
import { Point2Schema, Point3Schema } from '../../../core/schema-primitives'

export const DEFAULT_POOL_WATERFALL = {
  position: [0, 0, 0] as [number, number, number],
  rotation: [0, 0, 0] as [number, number, number],
  poolId: null,
  autoSizeOnPool: true,
  wallIndex: 0,
  wallT: 0.5,
  edgeCurve: [[-1, 0], [0, 0], [1, 0]] as Array<[number, number]>,
  landingInset: 0,
  targetWaterOffset: 0,
  waterfallType: 'rock-cascade' as const,
  width: 3.6,
  height: 2.1,
  depth: 1.35,
  lipThickness: 0.08,
  sheetDepth: 0.06,
  rockSeed: 7311,
  poolRockSeed: null,
  structureColor: '#6f7b78',
  rockColor: '#7f817d',
  waterPreset: WATER_PRESET_SETTINGS['crystal-clear'].waterPreset,
  shallowWaterColor: WATER_PRESET_SETTINGS['crystal-clear'].shallowWaterColor,
  deepWaterColor: WATER_PRESET_SETTINGS['crystal-clear'].deepWaterColor,
  waterColor: '#38bdf8',
  poolBedColor: '#625c50',
  receivingPoolEnabled: true,
  receivingPoolWidth: 4.8,
  receivingPoolDepth: 3.2,
  flowStrength: 1,
  showFlow: true,
}

/** A raised pool waterfall with an optional self-contained plunge pool. */
export const PoolWaterfallNode = BaseNode.extend({
  id: objectId('pool-waterfall'),
  type: nodeType('pool:waterfall'),
  position: Point3Schema.default([0, 0, 0]),
  rotation: Point3Schema.default([0, 0, 0]),
  poolId: z.string().nullable().default(null),
  autoSizeOnPool: z.boolean().default(true),
  wallIndex: z.number().int().min(0).default(0),
  wallT: z.number().min(0).max(1).default(0.5),
  edgeCurve: z.array(Point2Schema).min(2).default([[-1, 0], [0, 0], [1, 0]]),
  landingInset: z.number().nonnegative().default(0),
  targetWaterOffset: z.number().finite().default(0),
  waterfallType: z.preprocess(
    (value) => value === 'grotto' ? 'rock-cascade' : value,
    z.enum(['modern', 'rock-cascade', 'spillover']).default('rock-cascade'),
  ),
  width: z.number().min(0.8).max(12).default(3.6),
  height: z.number().min(0.6).max(6).default(2.1),
  depth: z.number().min(0.4).max(4).default(1.35),
  lipThickness: z.number().min(0.02).max(0.3).default(0.08),
  sheetDepth: z.number().min(0.01).max(0.25).default(0.06),
  rockSeed: z.number().int().default(7311),
  poolRockSeed: z.number().int().nullable().default(null),
  structureColor: z.string().default('#6f7b78'),
  rockColor: z.string().default('#7f817d'),
  waterPreset: z.preprocess((value) => {
    if (value === 'clear') return 'crystal-clear'
    if (value === 'genshin') return 'vivid-aqua'
    if (value === 'tropical') return 'tropical-lagoon'
    return value
  }, z.enum(WATER_PRESETS).default('crystal-clear')),
  shallowWaterColor: z.string().default('#83eab3'),
  deepWaterColor: z.string().default('#008ab3'),
  /** @deprecated Retained when loading scenes saved before shared water presets. */
  waterColor: z.string().default('#38bdf8'),
  poolBedColor: z.string().default('#625c50'),
  receivingPoolEnabled: z.boolean().default(true),
  receivingPoolWidth: z.number().min(1).max(16).default(4.8),
  receivingPoolDepth: z.number().min(0.8).max(12).default(3.2),
  showFlow: z.boolean().default(true),
  flowStrength: z.number().min(0.2).max(2).default(1),
})

export type PoolWaterfallNode = z.infer<typeof PoolWaterfallNode>
