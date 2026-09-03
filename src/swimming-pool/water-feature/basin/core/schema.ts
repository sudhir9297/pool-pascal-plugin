import { BaseNode, nodeType, objectId } from '@pascal-app/core'
import { z } from 'zod'

const Point3 = z.tuple([z.number(), z.number(), z.number()])

export const PoolCatchBasinNode = BaseNode.extend({
  id: objectId('pool-catch-basin'),
  type: nodeType('pool:catch-basin'),
  position: Point3.default([0, 0, 0]),
  rotation: Point3.default([0, 0, 0]),
  length: z.number().min(1).max(20).default(3.2),
  width: z.number().min(1).max(20).default(2.2),
  depth: z.number().min(0.3).max(3).default(0.9),
  waterDepth: z.number().min(0.1).max(2.5).default(0.55),
  wallThickness: z.number().min(0.05).max(0.5).default(0.18),
  copingWidth: z.number().min(0.1).max(1).default(0.35),
  copingThickness: z.number().min(0.02).max(0.4).default(0.12),
  copingStoneLength: z.number().min(0.2).max(2).default(0.7),
  copingSeed: z.number().int().default(4207),
  shellColor: z.string().default('#697978'),
  waterColor: z.string().default('#238fa8'),
})

export type PoolCatchBasinNode = z.infer<typeof PoolCatchBasinNode>
