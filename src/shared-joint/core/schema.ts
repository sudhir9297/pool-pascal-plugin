import { BaseNode, nodeType, objectId } from '@pascal-app/core'
import { z } from 'zod'
import { Point3Schema } from '../../core/schema-primitives'

export const PoolSharedJointNode = BaseNode.extend({
  id: objectId('pool-shared-joint'),
  type: nodeType('pool:shared-joint'),
  position: Point3Schema.default([0, 0, 0]),
  rotation: Point3Schema.default([0, 0, 0]),
  poolIds: z.tuple([z.string(), z.string()]),
  intersection: z.array(z.array(z.tuple([z.number(), z.number()]))).default([]),
  copingStyle: z.enum(['continuous', 'natural-stone', 'rock']).default('continuous'),
  connectionMode: z.enum(['open', 'submerged-shelf', 'spillover']).default('submerged-shelf'),
  length: z.number().min(0.1).max(20).default(1),
  width: z.number().min(0.1).max(20).default(1),
  thickness: z.number().min(0.02).max(0.5).default(0.08),
  rockWidth: z.number().min(0.1).max(1).default(0.28),
  transitionDepth: z.number().min(0.05).max(2).default(0.55),
  transitionHeight: z.number().min(0.05).max(0.5).default(0.18),
  transitionColor: z.string().default('#2b7182'),
  commonFloorDepth: z.number().min(0.1).max(4).default(1.5),
  rockSeed: z.number().int().default(9733),
  surfaceColor: z.string().default('#b8b7b0'),
})

export type PoolSharedJointNode = z.infer<typeof PoolSharedJointNode>
