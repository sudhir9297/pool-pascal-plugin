import { BaseNode, nodeType, objectId } from '@pascal-app/core'
import { z } from 'zod'
import { Point3Schema } from '../../core/schema-primitives'

export const DEFAULT_POOL_VALVE = {
  position: [0, 0, 0] as [number, number, number],
  rotation: [0, 0, 0] as [number, number, number],
  variant: 'two-way' as const,
  flowPattern: 'open' as const,
  diameter: 0.05,
  bodyRadius: 0.11,
  handleAngle: 0,
}

export const PoolValveNode = BaseNode.extend({
  id: objectId('pool-valve'),
  type: nodeType('pool:valve'),
  position: Point3Schema.default([0, 0, 0]),
  rotation: Point3Schema.default([0, 0, 0]),
  variant: z.enum(['two-way', 'three-way']).default('two-way'),
  flowPattern: z.enum(['open', 'closed', 'left-right', 'left-branch', 'all', 'right-branch']).default('open'),
  diameter: z.number().min(0.025).default(0.05),
  bodyRadius: z.number().min(0.05).default(0.11),
  handleAngle: z.number().finite().default(0),
})

export type PoolValveNode = z.infer<typeof PoolValveNode>
