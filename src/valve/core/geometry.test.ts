import { describe, expect, test } from 'bun:test'
import { Box3, Group } from 'three'
import { disposeObject3D } from '../../editor/dispose-object'
import { buildValveGeometry, getValveConnectionPortIndices, getValveFlowPairs, getValveOpenPortIndices } from './geometry'
import { PoolValveNode } from './schema'

describe('pool valve flow pattern', () => {
  test('keeps every physical socket connectable regardless of flow pattern', () => {
    const valve = PoolValveNode.parse({ id: 'pool-valve_connections', variant: 'three-way', flowPattern: 'closed' })

    expect(getValveConnectionPortIndices(valve)).toEqual([0, 1, 2])
    expect(getValveOpenPortIndices(valve)).toEqual(new Set())
  })

  test('changes the active flow ports and paths', () => {
    const leftBranch = PoolValveNode.parse({ id: 'pool-valve_flow', variant: 'three-way', flowPattern: 'left-branch' })
    const rightBranch = PoolValveNode.parse({ id: 'pool-valve_flow_right', variant: 'three-way', flowPattern: 'right-branch' })

    expect([...getValveOpenPortIndices(leftBranch)]).toEqual([0, 2])
    expect(getValveFlowPairs(leftBranch)).toEqual([[0, 2]])
    expect([...getValveOpenPortIndices(rightBranch)]).toEqual([1, 2])
    expect(getValveFlowPairs(rightBranch)).toEqual([[1, 2]])
  })

  test('closed pattern has no active flow path', () => {
    const valve = PoolValveNode.parse({ id: 'pool-valve_closed', variant: 'three-way', flowPattern: 'closed' })

    expect(getValveOpenPortIndices(valve).size).toBe(0)
    expect(getValveFlowPairs(valve)).toEqual([])
  })

  test('builds each physical port and adds channels only for active flow paths', () => {
    const closedNode = PoolValveNode.parse({ variant: 'three-way', flowPattern: 'closed' })
    const openNode = PoolValveNode.parse({ variant: 'three-way', flowPattern: 'all' })
    const closed = buildValveGeometry(closedNode)
    const open = buildValveGeometry(openNode)

    expect(open.children.length - closed.children.length).toBe(3)
    for (const geometry of [closed, open]) {
      const bounds = new Box3().setFromObject(geometry)
      expect(bounds.min.toArray().every(Number.isFinite)).toBe(true)
      expect(bounds.max.toArray().every(Number.isFinite)).toBe(true)
      disposeObject3D(geometry)
    }
  })

  test('applies the saved handle angle to the lever group', () => {
    const node = PoolValveNode.parse({ handleAngle: Math.PI * 0.75 })
    const geometry = buildValveGeometry(node)
    const lever = geometry.children.find((child) => child instanceof Group) as Group

    expect(lever.rotation.y).toBeCloseTo(node.handleAngle)
    expect(lever.children).toHaveLength(2)
    disposeObject3D(geometry)
  })
})
