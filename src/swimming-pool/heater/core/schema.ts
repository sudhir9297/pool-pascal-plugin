import { BaseNode, nodeType, objectId } from '@pascal-app/core'
import { z } from 'zod'

const Point3 = z.tuple([z.number(), z.number(), z.number()])

/** A pool heater with water inlet/outlet ports and an optional exhaust stack. */
export const PoolHeaterNode = BaseNode.extend({
  id: objectId('pool-heater'),
  type: nodeType('pool:heater'),
  position: Point3.default([0, 0, 0]),
  rotation: Point3.default([0, 0, 0]),
  heaterId: z.string().default('heat-pump-twin-fan'),
  technology: z.enum(['gas', 'electric', 'heat-pump']).default('heat-pump'),
  bodyWidth: z.number().min(0.3).max(2).default(1.1),
  bodyHeight: z.number().min(0.35).max(2).default(1.2),
  bodyDepth: z.number().min(0.3).max(1.5).default(0.78),
  portDiameter: z.number().min(0.025).max(0.15).default(0.05),
  exhaustDiameter: z.number().min(0.05).max(0.5).default(0.18),
  showExhaust: z.boolean().default(false),
  showFlow: z.boolean().default(false),
})

export type PoolHeaterNode = z.infer<typeof PoolHeaterNode>
