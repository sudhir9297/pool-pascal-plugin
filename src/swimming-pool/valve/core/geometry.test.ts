import { describe, expect, test } from 'bun:test'
import { getValveFlowPairs, getValveOpenPortIndices } from './geometry'
import { PoolValveNode } from './schema'

describe('pool valve flow pattern', () => {
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
})
