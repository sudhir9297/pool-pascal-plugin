import { BaseNode, nodeType, objectId } from '@pascal-app/core'
import { z } from 'zod'

const Point3 = z.tuple([z.number(), z.number(), z.number()])

export const PoolWatercourseNode = BaseNode.extend({
  id: objectId('pool-watercourse'),
  type: nodeType('pool:watercourse'),
  position: Point3.default([0, 0, 0]),
  rotation: Point3.default([0, 0, 0]),
  length: z.number().min(0.5).max(20).default(3),
  width: z.number().min(0.3).max(6).default(1.2),
  channelDepth: z.number().min(0.1).max(2).default(0.35),
  waterDepth: z.number().min(0.03).max(1.5).default(0.18),
  slope: z.number().min(-1).max(1).default(-0.12),
  rockWidth: z.number().min(0.1).max(1).default(0.28),
  rockSeed: z.number().int().default(8129),
  rockColor: z.string().default('#b8b7b0'),
  waterColor: z.string().default('#238fa8'),
})

export type PoolWatercourseNode = z.infer<typeof PoolWatercourseNode>
