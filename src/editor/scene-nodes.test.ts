import { describe, expect, test } from 'bun:test'
import { PoolNode } from '../core/schema'
import { countNodesByType, countPoolPluginNodes, getPoolNode, getPoolNodes } from './scene-nodes'

describe('pool scene nodes', () => {
  test('counts every plugin kind in one scene pass', () => {
    const counts = countPoolPluginNodes({
      first: { type: 'pool:pool' },
      second: { type: 'pool:pool' },
      pump: { type: 'pool:pump' },
      unrelated: { type: 'furnish:chair' },
    })
    expect(counts['pool:pool']).toBe(2)
    expect(counts['pool:pump']).toBe(1)
    expect(counts['pool:heater']).toBe(0)
    expect(countNodesByType({ first: { type: 'pool:pump' } }, 'pool:pump')).toBe(1)
  })

  test('parses pools and rejects a non-pool node at lookup time', () => {
    const first = PoolNode.parse({ id: 'pool_first', parentId: 'level_one' })
    const second = PoolNode.parse({ id: 'pool_second', parentId: 'level_two' })
    const nodes = {
      [first.id]: first,
      [second.id]: second,
      pump: { id: 'pump', type: 'pool:pump' },
    }

    expect(getPoolNode(nodes, first.id)?.id).toBe(first.id)
    expect(getPoolNode(nodes, 'pump')).toBeUndefined()
    expect(getPoolNodes(nodes, 'level_one').map((pool) => pool.id)).toEqual([first.id])
  })
})
