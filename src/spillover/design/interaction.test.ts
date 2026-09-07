import { describe, expect, test } from 'bun:test'
import { PoolNode } from '../../core/schema'
import { findPoolAtPoint, resolvePoolSpilloverCandidate, resolvePoolSpilloverPair } from './interaction'

const rectangle = [[-2, -1.5], [2, -1.5], [2, 1.5], [-2, 1.5]]

describe('pool spillover interaction', () => {
  test('chooses the containing pool nearest the cursor in an overlap', () => {
    const first = PoolNode.parse({ id: 'pool_first', parentId: 'level_a', position: [0, 1, 0], polygon: rectangle })
    const second = PoolNode.parse({ id: 'pool_second', parentId: 'level_a', position: [2, 0, 0], polygon: rectangle })
    const nodes = { [first.id]: first, [second.id]: second }

    expect(findPoolAtPoint(nodes as never, [1.8, 0, 0], 'level_a')?.id).toBe(second.id)
    expect(findPoolAtPoint(nodes as never, [0.2, 0, 0], 'level_a')?.id).toBe(first.id)
  })

  test('reports an invalid target without replacing the selected source', () => {
    const source = PoolNode.parse({ id: 'pool_source', parentId: 'level_a', position: [0, 1, 0], polygon: rectangle })
    const cornerOnly = PoolNode.parse({ id: 'pool_corner', parentId: 'level_a', position: [4.5, 0, 4], polygon: rectangle })
    const nodes = { [source.id]: source, [cornerOnly.id]: cornerOnly }

    const candidate = resolvePoolSpilloverCandidate(nodes as never, [4.5, 0, 4], 'level_a', source)

    expect(candidate.pool?.id).toBe(cornerOnly.id)
    expect(candidate.placement).toBeNull()
    expect(source.id).toBe('pool_source')
  })

  test('resolves a floorplan-selected pool pair without a grid hit point', () => {
    const source = PoolNode.parse({ id: 'pool_floorplan_source', parentId: 'level_a', position: [0, 1, 0], polygon: rectangle })
    const target = PoolNode.parse({ id: 'pool_floorplan_target', parentId: 'level_a', position: [5, 0, 0], polygon: rectangle })

    expect(resolvePoolSpilloverPair(source, source)).toBeNull()
    expect(resolvePoolSpilloverPair(source, target)?.targetPoolId).toBe(target.id)
  })

  test.each([
    ['separated', [5, 0, 0] as [number, number, number]],
    ['intersecting', [2, 0, 0] as [number, number, number]],
  ])('creates a candidate between %s pools at the same level', (_label, position) => {
    const source = PoolNode.parse({ id: `pool_same_source_${_label}`, parentId: 'level_a', polygon: rectangle })
    const target = PoolNode.parse({ id: `pool_same_target_${_label}`, parentId: 'level_a', polygon: rectangle, position })
    const nodes = { [source.id]: source, [target.id]: target }
    const candidate = resolvePoolSpilloverCandidate(nodes as never, [target.position[0], 0, target.position[2]], 'level_a', source)
    expect(candidate.pool?.id).toBe(target.id)
    expect(candidate.placement).not.toBeNull()
    expect(candidate.placement?.sourcePoolId).toBe(source.id)
    expect(candidate.placement?.targetPoolId).toBe(target.id)
  })
})
