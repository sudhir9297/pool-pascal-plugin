import type { AnyNode } from '@pascal-app/core'
import { PoolNode } from '../../core/schema'
import { PoolSpilloverNode } from '../core/schema'
import { resolvePoolSpillover } from './placement'

export type PoolSpilloverChanges = {
  update: Array<{ id: string; data: Partial<PoolSpilloverNode> }>
  delete: string[]
}

/** Recomputes a spillover's direction, drop, and footprint after either pool moves. */
export function syncPoolSpillovers(nodes: Record<string, AnyNode>): PoolSpilloverChanges {
  const pools = Object.values(nodes)
    .map((node) => PoolNode.safeParse(node))
    .filter((result): result is { success: true; data: PoolNode } => result.success)
    .map((result) => result.data)
  const byId = new Map<string, PoolNode>(pools.map((pool) => [String(pool.id), pool]))
  const update: PoolSpilloverChanges['update'] = []
  const deleteIds: string[] = []
  for (const node of Object.values(nodes)) {
    if (String(node.type) !== 'pool:spillover') continue
    const spillover = PoolSpilloverNode.safeParse(node)
    if (!spillover.success) { deleteIds.push(node.id); continue }
    const source = byId.get(String(spillover.data.sourcePoolId))
    const target = byId.get(String(spillover.data.targetPoolId))
    if (!source || !target || source.parentId !== target.parentId || source.parentId !== spillover.data.parentId) {
      deleteIds.push(spillover.data.id)
      continue
    }
    const placement = resolvePoolSpillover(source, target)
    if (!placement) { deleteIds.push(spillover.data.id); continue }
    update.push({ id: spillover.data.id, data: placement })
  }
  return { update, delete: deleteIds }
}
