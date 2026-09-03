import { BaseNode, nodeType, objectId } from '@pascal-app/core'
import { z } from 'zod'
import { POOL_ENTRY_FEATURES } from '../design/entry-features'
import { POOL_FLOOR_PROFILES } from '../design/depth-profile'
import { POOL_SHAPES } from '../design/shapes'
import { WATER_PRESETS } from '../shader/water-presets'
import { POOL_FINISHES } from '../design/pool-finishes'
import { POOL_VISUAL_PRESETS } from '../design/visual-presets'

export const PoolNode = BaseNode.extend({
  id: objectId('pool'),
  type: nodeType('pool:pool'),
  position: z.tuple([z.number(), z.number(), z.number()]).default([0, 0, 0]),
  rotation: z.tuple([z.number(), z.number(), z.number()]).default([0, 0, 0]),
  children: z.array(z.string()).default([]),
  shape: z.enum(POOL_SHAPES).default('rectangle'),
  length: z.number().min(0.5).default(8),
  width: z.number().min(0.5).default(4),
  polygon: z.array(z.tuple([z.number(), z.number()])).min(3).default([[-4, -2], [4, -2], [4, 2], [-4, 2]]),
  outlineControlPoints: z.array(z.tuple([z.number(), z.number()])).default([]),
  floorProfile: z.enum(POOL_FLOOR_PROFILES).default('flat'),
  depth: z.number().min(0.5).default(1.5),
  shallowDepth: z.number().min(0.5).default(1.1),
  deepDepth: z.number().min(0.5).default(2),
  slopeStart: z.number().min(0).max(100).default(35),
  slopeEnd: z.number().min(0).max(100).default(70),
  coveRadius: z.number().min(0).max(0.5).default(0.15),
  entryFeature: z.enum(POOL_ENTRY_FEATURES).default('none'),
  entryLength: z.number().min(0.5).max(8).default(2),
  entryWaterDepth: z.number().min(0.05).max(1).default(0.25),
  stepCount: z.number().int().min(2).max(6).default(3),
  benchEnabled: z.boolean().default(false),
  benchStyle: z.enum(['end', 'perimeter']).default('end'),
  benchWall: z.enum(['min-x', 'max-x', 'min-z', 'max-z']).default('max-x'),
  benchBoundaryT: z.number().min(0).max(1).default(0.4166667),
  benchLength: z.number().min(0.5).max(20).default(3),
  benchWidth: z.number().min(0.2).max(1.5).default(0.5),
  benchWaterDepth: z.number().min(0.1).max(1.2).default(0.5),
  copingWidth: z.number().min(0.1).default(0.3),
  copingThickness: z.number().min(0.02).default(0.08),
  copingStyle: z.enum(['continuous', 'natural-stone', 'rock']).default('continuous'),
  copingStoneLength: z.number().min(0.2).max(2).default(0.65),
  copingJointWidth: z.number().min(0.005).max(0.1).default(0.025),
  copingIrregularity: z.number().min(0).max(1).default(0.4),
  copingSeed: z.number().int().default(1847),
  copingColor: z.string().default('#e2e8f0'),
  shellThickness: z.number().min(0.05).default(0.2),
  floorThickness: z.number().min(0.05).default(0.2),
  openingClearance: z.number().min(0).default(0.02),
  finishedDeckElevation: z.number().finite().default(0),
  designWaterElevation: z.number().finite().default(-0.12),
  waterPreset: z.preprocess((value) => {
    if (value === 'clear') return 'crystal-clear'
    if (value === 'genshin') return 'vivid-aqua'
    if (value === 'tropical') return 'tropical-lagoon'
    return value
  }, z.enum(WATER_PRESETS).default('crystal-clear')),
  shallowWaterColor: z.string().default('#83eab3'),
  deepWaterColor: z.string().default('#008ab3'),
  surfaceDetail: z.number().min(0.4).max(3).default(1.6),
  viscosity: z.number().min(0).max(1).default(0.4),
  rippleSize: z.number().min(8).max(80).default(30),
  clarity: z.number().min(0.3).max(3).default(1),
  rain: z.number().min(0).max(1).default(0),
  breeze: z.number().min(0).max(1).default(0.25),
  sunElevation: z.number().min(14).max(86).default(52),
  sunAzimuth: z.number().min(0).max(360).default(135),
  normalScale: z.number().min(0.25).max(20).default(5),
  normalStrength: z.number().min(0).max(2).default(0.49),
  normalSpeed: z.number().min(-3).max(3).default(1.5),
  reflectionStrength: z.number().min(0).max(2).default(1),
  reflectionFresnel: z.number().min(1).max(12).default(5),
  reflectionDistortion: z.number().min(0).max(4).default(1),
  refractionStrength: z.number().min(0).max(1).default(0.2),
  causticsStrength: z.number().min(0).max(4).default(3),
  causticsScale: z.number().min(0.25).max(12).default(2.76),
  causticsSpeed: z.number().min(-4).max(4).default(1.3),
  intersectionStrength: z.number().min(0).max(1).default(0),
  intersectionColor: z.string().default('#f6e975'),
  intersectionWidth: z.number().min(0.05).max(2).default(1.17),
  shorelineStrength: z.number().min(0).max(1).default(0),
  shorelineWidth: z.number().min(0.02).max(1).default(0.35),
  shorelineSpeed: z.number().min(-3).max(3).default(0),
  specularStrength: z.number().min(0).max(4).default(1.35),
  specularSize: z.number().min(0).max(1).default(0.52),
  specularHardness: z.number().min(0).max(1).default(0.82),
  waterColor: z.string().default('#38bdf8'),
  shellColor: z.string().default('#e2e8f0'),
  interiorFinish: z.enum(POOL_FINISHES).default('light-mosaic'),
  visualPreset: z.enum(POOL_VISUAL_PRESETS).default('custom'),
  copingProfile: z.enum(['square', 'bullnose', 'chamfered']).default('square'),
  copingCorner: z.enum(['miter', 'rounded']).default('miter'),
  supportSlabId: z.string().nullable().default(null),
})

export type PoolNode = z.infer<typeof PoolNode>
export type PoolPoint = [number, number]

export function resolvePoolPolygon(value: { polygon?: unknown; length?: unknown; width?: unknown }): PoolPoint[] {
  if (Array.isArray(value.polygon) && value.polygon.length >= 3 && value.polygon.every((point) => Array.isArray(point) && point.length >= 2 && Number.isFinite(point[0]) && Number.isFinite(point[1]))) {
    return value.polygon.map((point) => [Number(point[0]), Number(point[1])])
  }
  const length = typeof value.length === 'number' && value.length > 0 ? value.length : 8
  const width = typeof value.width === 'number' && value.width > 0 ? value.width : 4
  return [[-length / 2, -width / 2], [length / 2, -width / 2], [length / 2, width / 2], [-length / 2, width / 2]]
}
