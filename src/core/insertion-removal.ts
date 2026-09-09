import { PipeFittingNode, PipeSegmentNode, nodeRegistry, type AnyNode, type AnyNodeId } from '@pascal-app/core'
import { z } from 'zod'

const recordSchema = z.object({
  ownerId: z.string(),
  original: z.unknown(),
  expected: z.array(z.unknown()).min(2),
})
type Owner = { id: string; type: string; parentId: string | null; metadata: unknown }
type Nodes = Record<AnyNodeId, AnyNode>
type Pipe = PipeSegmentNode | PipeFittingNode

function fingerprint(value: unknown): string {
  return JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item)
}

export function recordPipeInsertion<Node extends Owner>(owner: Node, original: PipeSegmentNode, update: Partial<PipeSegmentNode>, tail: PipeSegmentNode, members: Pipe[] = []): Node {
  const expected = [{ ...original, ...update }, tail, ...members].map(node => ({ ...node, parentId: owner.parentId }))
  const metadata = owner.metadata && typeof owner.metadata === 'object' && !Array.isArray(owner.metadata) ? owner.metadata : {}
  return { ...owner, metadata: { ...metadata, poolInsertion: { ownerId: owner.id, original, expected } } }
}

function pointOnSegment(point: readonly number[], a: readonly number[], b: readonly number[]) {
  const delta = b.map((v, i) => v - a[i]!)
  const lengthSq = delta.reduce((sum, v) => sum + v * v, 0)
  const t = lengthSq ? Math.max(0, Math.min(1, delta.reduce((sum, v, i) => sum + v * (point[i]! - a[i]!), 0) / lengthSq)) : 0
  return Math.hypot(...a.map((v, i) => v + delta[i]! * t - point[i]!)) < 1e-4
}

export function assessInsertionRemoval(owner: Owner, nodes: Nodes) {
  const metadata = owner.metadata && typeof owner.metadata === 'object' ? owner.metadata : {}
  const parsed = recordSchema.safeParse('poolInsertion' in metadata ? metadata.poolInsertion : undefined)
  if (!parsed.success || parsed.data.ownerId !== owner.id) return null
  const sourceSnapshot = PipeSegmentNode.safeParse(parsed.data.original)
  if (!sourceSnapshot.success) return null
  const original = sourceSnapshot.data
  const expected: Pipe[] = []
  for (const value of parsed.data.expected) {
    const snapshot = PipeSegmentNode.safeParse(value)
    if (snapshot.success) expected.push(snapshot.data)
    else {
      const fitting = PipeFittingNode.safeParse(value)
      if (!fitting.success) return null
      expected.push(fitting.data)
    }
  }
  if (owner.parentId !== original.parentId || expected[0]?.id !== original.id) return null
  const ids = new Set(expected.map(node => node.id))
  if (ids.size !== expected.length || ids.has(owner.id as never)) return null
  const source = nodes[original.id]
  if (source?.type !== 'pipe-segment' || source.parentId !== original.parentId) return null
  const existing = expected.slice(1).flatMap(snapshot => {
    const node = nodes[snapshot.id]
    return node && node.type === snapshot.type && node.parentId === original.parentId ? [node] : []
  })
  const changed = expected.some(snapshot => fingerprint(nodes[snapshot.id]) !== fingerprint(snapshot))
  const segments = expected.filter(node => node.type === 'pipe-segment').flatMap(pipe => pipe.path.slice(1).map((point, i) => [pipe.path[i]!, point] as const))
  const ports = nodeRegistry.get(owner.type)?.ports?.(owner as unknown as AnyNode) ?? []
  const externalConnection = Object.values(nodes).some(node => {
    if (node.parentId !== original.parentId || node.id === owner.id || ids.has(node.id as never)) return false
    const points = node.type === 'pipe-segment' ? node.path : nodeRegistry.get(node.type)?.ports?.(node)?.map(port => port.position) ?? []
    return points.some(point => {
      if ([original.path[0]!, original.path.at(-1)!].some(end => Math.hypot(...end.map((v, i) => v - point[i]!)) < 1e-4)) return false
      return segments.some(([a, b]) => pointOnSegment(point, a, b)) || ports.some(port => Math.hypot(...port.position.map((v, i) => v - point[i]!)) < 1e-4)
    })
  })
  return {
    changed: changed || externalConnection,
    remove: existing.map(node => node.id),
    restore: { id: original.id, data: { path: original.path, ...('wallAttachment' in original ? { wallAttachment: original.wallAttachment } : {}) } },
  }
}
