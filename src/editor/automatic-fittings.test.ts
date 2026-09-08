import { expect, test } from 'bun:test'
import { useScene, type AnyNode } from '@pascal-app/core'
import { PoolNode } from '../core/schema'
import { createPoolPluginNode } from './scene-nodes'
import { initializePoolOpeningSync } from './opening-system'
import { poolParametrics } from './parametrics'
import { syncAutomaticPoolFittings } from '../design/sync-pool-fittings'

test('scene subscription reconciles resize and restored snapshots', () => {
  const before = useScene.getState()
  const history = useScene.temporal.getState()
  let stop = () => {}
  try {
    // Keep this test independent of the host's built-in AnyNode union. The
    // installed beta core currently throws on its duplicate default discriminator.
    useScene.setState({ nodes: {}, rootNodeIds: [], readOnly: false, applyNodeChanges: (changes) => {
      const nodes: Record<string, AnyNode> = { ...useScene.getState().nodes }
      for (const { id, data } of changes.update ?? []) nodes[id] = { ...nodes[id], ...data } as AnyNode
      for (const { node, parentId } of changes.create ?? []) {
        nodes[node.id] = node
        if (parentId && nodes[parentId]) {
          const parent = nodes[parentId]!
          nodes[parentId] = { ...parent, children: [...new Set([...('children' in parent ? parent.children : []), node.id])] } as AnyNode
        }
      }
      for (const id of changes.delete ?? []) {
        delete nodes[id]
        for (const [parentId, parent] of Object.entries(nodes)) {
          if ('children' in parent) nodes[parentId] = { ...parent, children: parent.children.filter((child) => child !== id) } as AnyNode
        }
      }
      useScene.setState({ nodes })
    } })
    stop = initializePoolOpeningSync()
    const pool = PoolNode.parse({})
    createPoolPluginNode(pool, '')
    const initial = PoolNode.parse((useScene.getState().nodes as Record<string, unknown>)[pool.id])
    expect(initial.children).toHaveLength(9)
    const initialNodes = useScene.getState().nodes
    const patch = { length: 20, width: 12 }
    const next = { ...initial, ...patch }
    useScene.getState().applyNodeChanges({ update: [{ id: pool.id as never, data: { ...patch, ...poolParametrics.derive!(next, patch) } as Partial<AnyNode> }] })
    const larger = PoolNode.parse((useScene.getState().nodes as Record<string, unknown>)[pool.id])
    expect(larger.children.length).toBeGreaterThan(initial.children.length)
    expect(syncAutomaticPoolFittings(useScene.getState().nodes)).toEqual({ create: [], update: [], delete: [] })
    const largerNodes = useScene.getState().nodes
    useScene.setState({ nodes: initialNodes })
    const restored = PoolNode.parse((useScene.getState().nodes as Record<string, unknown>)[pool.id])
    expect(restored.length).toBe(8)
    expect(restored.children).toHaveLength(9)
    useScene.setState({ nodes: largerNodes })
    expect(PoolNode.parse((useScene.getState().nodes as Record<string, unknown>)[pool.id]).children).toHaveLength(larger.children.length)
  } finally {
    stop()
    useScene.setState(before)
    useScene.temporal.setState(history)
  }
})
