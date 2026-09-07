import { BaseNode, nodeType, objectId } from '@pascal-app/core'
import { z } from 'zod'
import { Point3Schema } from '../../core/schema-primitives'

export const DEFAULT_POOL_INLET = {
  position: [0, 0, 0] as [number, number, number],
  rotation: [0, 0, 0] as [number, number, number],
  poolId: null,
  wallIndex: 0,
  wallT: 0.5,
  verticalOffset: -0.45,
  nozzleDiameter: 0.05,
  flangeRadius: 0.12,
  bodyDepth: 0.16,
  showFlow: false,
  flowLength: 0.35,
}

/** A wall-mounted return fitting. Local +Z points into the pool. */
export const PoolInletNode = BaseNode.extend({
  id: objectId('pool-inlet'),
  type: nodeType('pool:inlet'),
  position: Point3Schema.default([0, 0, 0]),
  rotation: Point3Schema.default([0, 0, 0]),
  poolId: z.string().nullable().default(null),
  wallIndex: z.number().int().min(0).default(0),
  wallT: z.number().min(0).max(1).default(0.5),
  verticalOffset: z.number().finite().default(-0.45),
  nozzleDiameter: z.number().min(0.025).default(0.05),
  flangeRadius: z.number().min(0.06).default(0.12),
  bodyDepth: z.number().min(0.06).default(0.16),
  showFlow: z.boolean().default(false),
  flowLength: z.number().min(0.05).default(0.35),
})

export type PoolInletNode = z.infer<typeof PoolInletNode>
