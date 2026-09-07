import { BaseNode, nodeType, objectId } from '@pascal-app/core'
import { z } from 'zod'

const Point3 = z.tuple([z.number(), z.number(), z.number()])

/** A floor-mounted pool drain. Local +Y points toward the pool interior. */
export const PoolDrainNode = BaseNode.extend({
  id: objectId('pool-drain'),
  type: nodeType('pool:drain'),
  position: Point3.default([0, 0, 0]),
  rotation: Point3.default([0, 0, 0]),
  poolId: z.string().nullable().default(null),
  style: z.enum(['round', 'square']).default('round'),
  diameter: z.number().min(0.025).default(0.05),
  grateDiameter: z.number().min(0.08).default(0.22),
  bodyDepth: z.number().min(0.02).default(0.08),
  showFlow: z.boolean().default(false),
})

export type PoolDrainNode = z.infer<typeof PoolDrainNode>
