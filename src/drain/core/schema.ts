import { BaseNode, nodeType, objectId } from '@pascal-app/core'
import { z } from 'zod'
import { Point3Schema } from '../../core/schema-primitives'

export const DEFAULT_POOL_DRAIN = {
  position: [0, 0, 0] as [number, number, number],
  rotation: [0, 0, 0] as [number, number, number],
  poolId: null,
  floorAnchor: null,
  style: 'round' as const,
  diameter: 0.05,
  grateDiameter: 0.22,
  bodyDepth: 0.08,
  showFlow: false,
}

/** A floor-mounted pool drain. Local +Y points toward the pool interior. */
export const PoolDrainNode = BaseNode.extend({
  id: objectId('pool-drain'),
  type: nodeType('pool:drain'),
  position: Point3Schema.default([0, 0, 0]),
  rotation: Point3Schema.default([0, 0, 0]),
  poolId: z.string().nullable().default(null),
  floorAnchor: z.tuple([z.number(), z.number()]).nullable().default(null),
  style: z.enum(['round', 'square']).default('round'),
  diameter: z.number().min(0.025).default(0.05),
  grateDiameter: z.number().min(0.08).default(0.22),
  bodyDepth: z.number().min(0.02).default(0.08),
  showFlow: z.boolean().default(false),
})

export type PoolDrainNode = z.infer<typeof PoolDrainNode>
