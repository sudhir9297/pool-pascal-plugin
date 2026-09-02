import { BaseNode, nodeType, objectId } from '@pascal-app/core'
import { z } from 'zod'

const Point3 = z.tuple([z.number(), z.number(), z.number()])

/** A free-standing pool circulation pump. Local -Z is the inlet and +Z is the outlet. */
export const PoolPumpNode = BaseNode.extend({
  id: objectId('pool-pump'),
  type: nodeType('pool:pump'),
  position: Point3.default([0, 0, 0]),
  rotation: Point3.default([0, 0, 0]),
  diameter: z.number().min(0.025).default(0.05),
  bodyWidth: z.number().min(0.25).default(0.42),
  bodyHeight: z.number().min(0.22).default(0.34),
  bodyDepth: z.number().min(0.3).default(0.62),
  showFlow: z.boolean().default(false),
})

export type PoolPumpNode = z.infer<typeof PoolPumpNode>
