import { BaseNode, nodeType, objectId } from '@pascal-app/core'
import { z } from 'zod'

const Point3 = z.tuple([z.number(), z.number(), z.number()])

/** A vertical pool filter tank with a top-mounted multiport valve. */
export const PoolFilterNode = BaseNode.extend({
  id: objectId('pool-filter'),
  type: nodeType('pool:filter'),
  position: Point3.default([0, 0, 0]),
  rotation: Point3.default([0, 0, 0]),
  filterId: z.string().default('sand-standard-600'),
  technology: z.enum(['cartridge', 'sand', 'diatomaceous-earth']).default('sand'),
  diameter: z.number().min(0.25).max(1.5).default(0.68),
  bodyHeight: z.number().min(0.35).max(2).default(0.66),
  portDiameter: z.number().min(0.025).max(0.15).default(0.05),
  valvePosition: z.enum(['top', 'side']).default('top'),
  showGauge: z.boolean().default(true),
  showFlow: z.boolean().default(false),
})

export type PoolFilterNode = z.infer<typeof PoolFilterNode>
