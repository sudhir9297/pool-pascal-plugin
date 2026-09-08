import { findLevelAncestorId, nodeRegistry, type AnyNode } from '@pascal-app/core'
import { runtimeConnections } from '../core/runtime-connections'

export function connectionIndex(nodes: Record<string, AnyNode>) {
  return runtimeConnections(Object.values(nodes).map((node) => ({
    id: node.id, type: node.type, levelId: findLevelAncestorId(node.id, nodes),
    ports: nodeRegistry.get(node.type)?.ports?.(node) ?? [],
  })))
}
