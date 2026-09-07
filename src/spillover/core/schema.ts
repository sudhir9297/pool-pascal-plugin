import { BaseNode, nodeType, objectId } from '@pascal-app/core'
import { z } from 'zod'
import { Point2Schema, Point3Schema } from '../../core/schema-primitives'

export const DEFAULT_POOL_SPILLOVER = {
  position: [0, 0, 0] as [number, number, number],
  rotation: [0, 0, 0] as [number, number, number],
  sourcePoolId: '',
  targetPoolId: '',
  connectionStyle: 'auto' as const,
  connectionMode: 'overlap' as const,
  mergedSurface: false,
  sourceOpening: [] as Array<[number, number]>,
  targetOpening: [] as Array<[number, number]>,
  sourceEdge: [] as Array<[number, number]>,
  targetEdge: [] as Array<[number, number]>,
  connectionPath: [] as Array<[number, number]>,
  intersection: [] as Array<Array<[number, number]>>,
  sourceSide: 1 as const,
  width: 2,
  effectiveWidth: null as number | null,
  length: 0.8,
  landingInset: 0,
  dropHeight: 0.25,
  lipThickness: 0.08,
  flowStrength: 1,
  waterColor: '#38bdf8',
  surfaceColor: '#e2e8f0',
}

/** A directional water transfer from a higher pool into a lower pool. */
export const PoolSpilloverNode = BaseNode.extend({
  id: objectId('pool-spillover'),
  type: nodeType('pool:spillover'),
  position: Point3Schema.default([0, 0, 0]),
  rotation: Point3Schema.default([0, 0, 0]),
  sourcePoolId: z.string(),
  targetPoolId: z.string(),
  connectionStyle: z.enum(['auto', 'direct-spillover', 'watercourse']).default('auto'),
  connectionMode: z.enum(['overlap', 'direct', 'channel']).default('overlap'),
  /** Same-level intersections share pool-owned water/floor and need no connector mesh. */
  mergedSurface: z.boolean().default(false),
  sourceOpening: z.array(Point2Schema).default([]),
  targetOpening: z.array(Point2Schema).default([]),
  // Samples are [local Z across the sheet, local X offset from the endpoint].
  sourceEdge: z.array(Point2Schema).default([]),
  targetEdge: z.array(Point2Schema).default([]),
  connectionPath: z.array(Point2Schema).default([]),
  intersection: z.array(z.array(Point2Schema)).default([]),
  sourceSide: z.union([z.literal(-1), z.literal(1)]).default(1),
  /** User-selected width remains stable while geometry is temporarily constrained. */
  width: z.number().min(0.3).max(12).default(2),
  effectiveWidth: z.number().min(0.3).max(12).nullable().default(null),
  length: z.number().min(0.1).max(20).default(0.8),
  landingInset: z.number().nonnegative().default(0),
  dropHeight: z.number().min(0.02).max(6).default(0.25),
  lipThickness: z.number().min(0.02).max(0.3).default(0.08),
  flowStrength: z.number().min(0.2).max(2).default(1),
  waterColor: z.string().default('#38bdf8'),
  surfaceColor: z.string().default('#e2e8f0'),
})

export type PoolSpilloverNode = z.infer<typeof PoolSpilloverNode>
