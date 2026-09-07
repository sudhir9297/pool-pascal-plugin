import { BaseNode, nodeType, objectId } from '@pascal-app/core'
import { z } from 'zod'
import { Point3Schema } from '../../core/schema-primitives'

export const DEFAULT_POOL_HEATER = {
  position: [0, 0, 0] as [number, number, number],
  rotation: [0, 0, 0] as [number, number, number],
  heaterId: 'heat-pump-twin-fan',
  technology: 'heat-pump' as const,
  bodyWidth: 1.1,
  bodyHeight: 1.2,
  bodyDepth: 0.78,
  portDiameter: 0.05,
  exhaustDiameter: 0.18,
  showExhaust: false,
  showFlow: false,
}

/** A pool heater with water inlet/outlet ports and an optional exhaust stack. */
export const PoolHeaterNode = BaseNode.extend({
  id: objectId('pool-heater'),
  type: nodeType('pool:heater'),
  position: Point3Schema.default([0, 0, 0]),
  rotation: Point3Schema.default([0, 0, 0]),
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
