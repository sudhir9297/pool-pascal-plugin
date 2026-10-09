import type { PoolNode } from '../core/schema'

type PoolCandidate = {
  id: string
  type: string
  parentId?: string | null
  poolId?: string | null
}

export function getSelectedPool(nodes: Record<string, unknown>, selectedIds: readonly string[]): PoolNode | null {
  return getExplicitlySelectedPool(nodes, selectedIds)
}

export function getExplicitlySelectedPool(nodes: Record<string, unknown>, selectedIds: readonly string[]): PoolNode | null {
  const typedNodes = nodes as Record<string, PoolCandidate>
  for (const id of selectedIds) {
    const node = typedNodes[id]
    if (!node) continue
    if (node.type === 'pool:pool') return node as PoolNode
    const ownerId = node.poolId ?? node.parentId
    const owner = ownerId ? typedNodes[ownerId] : undefined
    if (owner?.type === 'pool:pool') return owner as PoolNode
  }
  return null
}
