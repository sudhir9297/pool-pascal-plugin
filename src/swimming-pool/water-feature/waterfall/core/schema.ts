import { BaseNode, nodeType, objectId } from '@pascal-app/core'
import { z } from 'zod'
import { WATER_PRESETS } from '../../../shader/water-presets'

const Point3 = z.tuple([z.number(), z.number(), z.number()])

/** A raised pool waterfall with an optional self-contained plunge pool. */
export const PoolWaterfallNode = BaseNode.extend({
  id: objectId('pool-waterfall'),
  type: nodeType('pool:waterfall'),
  position: Point3.default([0, 0, 0]),
  rotation: Point3.default([0, 0, 0]),
  poolId: z.string().nullable().default(null),
  autoSizeOnPool: z.boolean().default(true),
  wallIndex: z.number().int().min(0).default(0),
  wallT: z.number().min(0).max(1).default(0.5),
  edgeCurve: z.array(z.tuple([z.number(), z.number()])).min(2).default([[-1, 0], [0, 0], [1, 0]]),
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
  // Retained for scenes saved before waterfalls shared the pool presets.
  waterColor: z.string().default('#38bdf8'),
  poolBedColor: z.string().default('#625c50'),
  receivingPoolEnabled: z.boolean().default(true),
  receivingPoolWidth: z.number().min(1).max(16).default(4.8),
  receivingPoolDepth: z.number().min(0.8).max(12).default(3.2),
  showFlow: z.boolean().default(true),
  flowStrength: z.number().min(0.2).max(2).default(1),
  fountainEnabled: z.boolean().default(true),
  fountainHeight: z.number().min(0.1).max(2).default(0.55),
  fountainRadius: z.number().min(0.01).max(0.12).default(0.035),
  fountainSpread: z.number().min(0.1).max(2.5).default(0.72),
  fountainJetCount: z.number().int().min(1).max(9).default(5),
})

export type PoolWaterfallNode = z.infer<typeof PoolWaterfallNode>
