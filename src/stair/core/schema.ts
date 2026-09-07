import { BaseNode, nodeType, objectId } from '@pascal-app/core'
import { z } from 'zod'
import { POOL_STAIR_VARIANTS } from '../data/catalog'
import { Point3Schema } from '../../core/schema-primitives'

export const DEFAULT_POOL_STAIR = {
  position: [0, 0, 0] as [number, number, number],
  rotation: [0, 0, 0] as [number, number, number],
  poolId: null,
  wallIndex: 0,
  wallT: 0.5,
  variant: 'classic' as const,
  stepCount: 4,
  width: 0.5,
  depth: 1.4,
  tubeDiameter: 0.043,
  treadDepth: 0.11,
  metalColor: '#dce3e8',
}

/** Stainless-steel pool access stair mounted to a pool wall. Local +Z points into the pool. */
export const PoolStairNode = BaseNode.extend({
  id: objectId('pool-stair'),
  type: nodeType('pool:stair'),
  position: Point3Schema.default([0, 0, 0]),
  rotation: Point3Schema.default([0, 0, 0]),
  poolId: z.string().nullable().default(null),
  wallIndex: z.number().int().min(0).default(0),
  wallT: z.number().min(0).max(1).default(0.5),
  variant: z.enum(POOL_STAIR_VARIANTS).default('classic'),
  stepCount: z.number().int().min(2).max(6).default(4),
  width: z.number().min(0.3).max(2.5).default(0.5),
  depth: z.number().min(0.5).max(4).default(1.4),
  tubeDiameter: z.number().min(0.02).max(0.1).default(0.043),
  treadDepth: z.number().min(0.06).max(0.6).default(0.11),
  metalColor: z.string().default('#dce3e8'),
})

export type PoolStairNode = z.infer<typeof PoolStairNode>
