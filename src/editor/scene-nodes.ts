import { useScene, type AnyNode } from '@pascal-app/core'
import type { PoolNode } from '../core/schema'

export const POOL_PLUGIN_NODE_TYPES = [
  'pool:pool',
  'pool:stair',
  'pool:skimmer',
  'pool:inlet',
  'pool:valve',
  'pool:pump',
  'pool:filter',
  'pool:heater',
  'pool:drain',
  'pool:waterfall',
  'pool:spillover',
  'pool:shared-joint',
] as const

export type PoolPluginNodeType = (typeof POOL_PLUGIN_NODE_TYPES)[number]
export type PoolPluginNodeCounts = Record<PoolPluginNodeType, number>

const poolPluginNodeTypeSet = new Set<string>(POOL_PLUGIN_NODE_TYPES)

export function countPoolPluginNodes(nodes: Record<string, unknown>): PoolPluginNodeCounts {
  const counts = Object.fromEntries(
    POOL_PLUGIN_NODE_TYPES.map((type) => [type, 0]),
  ) as PoolPluginNodeCounts
  for (const value of Object.values(nodes)) {
    if (!value || typeof value !== 'object') continue
    const type = String((value as { type?: unknown }).type)
    if (poolPluginNodeTypeSet.has(type)) counts[type as PoolPluginNodeType] += 1
  }
  return counts
}

export function countNodesByType(nodes: Record<string, unknown>, type: PoolPluginNodeType) {
  let count = 0
  for (const value of Object.values(nodes)) {
    if (value && typeof value === 'object' && (value as { type?: unknown }).type === type) count += 1
  }
  return count
}

export function createPoolPluginNode(
  node: { id: string; type: PoolPluginNodeType },
  parentId: string,
) {
  useScene.getState().createNode(node as unknown as AnyNode, parentId as never)
}

export function getPoolNode(nodes: Record<string, unknown>, id: string | null | undefined) {
  if (!id) return undefined
  const value = nodes[id]
  return isPoolNode(value) ? value : undefined
}

export function getPoolNodes(nodes: Record<string, unknown>, parentId?: string | null) {
  const pools: PoolNode[] = []
  for (const value of Object.values(nodes)) {
    if (isPoolNode(value) && (parentId === undefined || value.parentId === parentId)) {
      pools.push(value)
    }
  }
  return pools
}

export function isPoolNode(value: unknown): value is PoolNode {
  return Boolean(value)
    && typeof value === 'object'
    && (value as { type?: unknown }).type === 'pool:pool'
}
