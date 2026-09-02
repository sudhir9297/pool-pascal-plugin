import { BaseNode, nodeType, objectId } from '@pascal-app/core'
import { z } from 'zod'

const PipePoint = z.tuple([z.number(), z.number(), z.number()])
const PipeNodeKind = z.enum(['endpoint', 'straight', 'corner', 'tee', 'cross'])

const PipeGraphNode = z.object({
  id: z.string(),
  position: PipePoint,
  kind: PipeNodeKind,
})

const PipeGraphEdge = z.object({
  id: z.string(),
  from: z.string(),
  to: z.string(),
  style: z.enum(['rigid', 'smooth']).default('rigid'),
})

export const PoolPipeNode = BaseNode.extend({
  id: objectId('pipe-network'),
  type: nodeType('pool:pipe-network'),
  position: PipePoint.default([0, 0, 0]),
  rotation: PipePoint.default([0, 0, 0]),
  kitId: z.string().default('pvc'),
  diameter: z.number().positive().default(0.05),
  nodes: z.array(PipeGraphNode).default([]),
  edges: z.array(PipeGraphEdge).default([]),
})

export type PoolPipeNode = z.infer<typeof PoolPipeNode>
