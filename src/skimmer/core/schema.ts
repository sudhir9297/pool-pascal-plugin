import { BaseNode, nodeType, objectId } from '@pascal-app/core'
import { z } from 'zod'
import { Point3Schema } from '../../core/schema-primitives'

export const DEFAULT_POOL_SKIMMER = {
  position: [0, 0, 0] as [number, number, number],
  rotation: [0, 0, 0] as [number, number, number],
  poolId: null,
  wallIndex: 0,
  wallT: 0.5,
  style: 'standard' as const,
  accessState: 'closed' as const,
  showFlow: false,
  bodyWidth: 0.6,
  bodyHeight: 0.55,
  bodyDepth: 0.42,
  mouthWidth: 0.42,
  mouthHeight: 0.14,
  waterlineOffset: 0,
  suctionDiameter: 0.05,
  showBasket: true,
}

/** A wall-mounted surface skimmer. The local +Z face points into the pool. */
export const PoolSkimmerNode = BaseNode.extend({
  id: objectId('pool-skimmer'),
  type: nodeType('pool:skimmer'),
  position: Point3Schema.default([0, 0, 0]),
  rotation: Point3Schema.default([0, 0, 0]),
  poolId: z.string().nullable().default(null),
  wallIndex: z.number().int().min(0).default(0),
  wallT: z.number().min(0).max(1).default(0.5),
  style: z.enum(['standard', 'wide-mouth', 'corner']).default('standard'),
  accessState: z.enum(['closed', 'open']).default('closed'),
  showFlow: z.boolean().default(false),
  bodyWidth: z.number().min(0.25).default(0.6),
  bodyHeight: z.number().min(0.25).default(0.55),
  bodyDepth: z.number().min(0.2).default(0.42),
  mouthWidth: z.number().min(0.15).default(0.42),
  mouthHeight: z.number().min(0.05).default(0.14),
  waterlineOffset: z.number().finite().default(0),
  suctionDiameter: z.number().min(0.025).default(0.05),
  showBasket: z.boolean().default(true),
})

export type PoolSkimmerNode = z.infer<typeof PoolSkimmerNode>
