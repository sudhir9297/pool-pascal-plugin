import { BaseNode, nodeType, objectId } from '@pascal-app/core'
import { z } from 'zod'
import { STANDARD_POOL_PVC_DIAMETER } from './constants'

const PipePoint = z.tuple([z.number(), z.number(), z.number()])
const PipeNodeKind = z.enum(['endpoint', 'straight', 'corner', 'elbow', 'tee', 'y', 'cross'])

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

const PipeAttachment = z.object({
  nodeId: z.string(),
  ownerId: z.string(),
  portId: z.string(),
  kind: z.enum(['equipment', 'fitting', 'network']),
})

export const PoolPipeNode = BaseNode.extend({
  id: objectId('pipe-network'),
  type: nodeType('pool:pipe-network'),
  position: PipePoint.default([0, 0, 0]),
  rotation: PipePoint.default([0, 0, 0]),
  kitId: z.string().default('pvc'),
  diameter: z.number().positive().default(STANDARD_POOL_PVC_DIAMETER),
  nodes: z.array(PipeGraphNode).default([]),
  edges: z.array(PipeGraphEdge).default([]),
  attachments: z.array(PipeAttachment).default([]),
})

export type PoolPipeNode = z.infer<typeof PoolPipeNode>
