import { BaseNode, nodeType, objectId } from '@pascal-app/core'
import { z } from 'zod'

const Point3 = z.tuple([z.number(), z.number(), z.number()])

export const PoolValveNode = BaseNode.extend({
  id: objectId('pool-valve'),
  type: nodeType('pool:valve'),
  position: Point3.default([0, 0, 0]),
  rotation: Point3.default([0, 0, 0]),
  variant: z.enum(['two-way', 'three-way']).default('two-way'),
  flowPattern: z.enum(['open', 'closed', 'left-right', 'left-branch', 'all', 'right-branch']).default('open'),
  diameter: z.number().min(0.025).default(0.05),
  bodyRadius: z.number().min(0.05).default(0.11),
  handleAngle: z.number().finite().default(0),
})

export type PoolValveNode = z.infer<typeof PoolValveNode>
