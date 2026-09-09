import { describe, expect, test } from 'bun:test'
import { type AnyNode, LevelNode, PipeSegmentNode, useScene } from '@pascal-app/core'
import { connectionPorts } from '../../core/connection-ports'
import { getValvePortsLocal } from '../core/ports'
import { PoolValveNode } from '../core/schema'
import { findValveInsertionTarget, planValveInsertion } from './inline-insertion'

describe('suction valve insertion', () => {
  test('commits two pipe nodes and a valve, with one undo and redo', () => {
    const original = useScene.getState()
    const level = LevelNode.parse({ children: [] })
    const run = PipeSegmentNode.parse({ parentId: level.id, path: [[0, 0, 0], [6, 0, 0]] })
    useScene.setState({ nodes: { [level.id]: { ...level, children: [run.id] }, [run.id]: run }, rootNodeIds: [level.id], readOnly: false })
    useScene.temporal.getState().clear()
    useScene.temporal.getState().resume()
    try {
      const plan = planValveInsertion(run, 0, [3, 0, 0], PoolValveNode.parse({}))!
      useScene.getState().applyNodeChanges({ update: [plan.update], create: [{ node: plan.valve as unknown as AnyNode, parentId: level.id }, { node: plan.tail, parentId: level.id }] })
      expect(Object.values(useScene.getState().nodes).filter(n => n.type === 'pipe-segment')).toHaveLength(2)
      expect(useScene.getState().nodes[plan.valve.id as never]).toBeDefined()
      useScene.temporal.getState().undo()
      expect(useScene.getState().nodes[run.id]).toEqual(run)
      expect(useScene.getState().nodes[plan.tail.id]).toBeUndefined()
      expect(useScene.getState().nodes[plan.valve.id as never]).toBeUndefined()
      useScene.temporal.getState().redo()
      expect(useScene.getState().nodes[plan.tail.id]).toBeDefined()
    } finally {
      useScene.setState(original)
      useScene.temporal.getState().clear()
    }
  })
  for (const variant of ['two-way', 'three-way'] as const) {
    test(`${variant} splits a sloped pipe at its actual sockets`, () => {
      const run = PipeSegmentNode.parse({ path: [[2, 1, 3], [8, 0.88, 3]], diameter: 3, metadata: { circuit: 'suction' } })
      const target = findValveInsertionTarget([run], [5, 0, 3.1], false)!
      const plan = planValveInsertion(run, target.index, target.point, PoolValveNode.parse({ variant }))!
      expect(plan).not.toBeNull()
      const ports = connectionPorts(plan.valve, getValvePortsLocal(plan.valve))
      for (let axis = 0; axis < 3; axis++) {
        expect(plan.update.data.path.at(-1)![axis]).toBeCloseTo(ports[0]!.position[axis]!, 8)
        expect(plan.tail.path[0]![axis]).toBeCloseTo(ports[1]!.position[axis]!, 8)
      }
      expect(plan.tail.id).not.toBe(run.id)
      expect(plan.update.id).toBe(run.id)
      expect(plan.tail.metadata).toEqual(run.metadata)
      expect(plan.valve.diameter / 0.0254).toBeCloseTo(run.diameter)
      expect(run.path).toEqual([[2, 1, 3], [8, 0.88, 3]])
    })
  }
  test('rejects short ends and vent runs', () => {
    const run = PipeSegmentNode.parse({ path: [[0, 0, 0], [4, 0, 0]] })
    expect(planValveInsertion(run, 0, [0.2, 0, 0], PoolValveNode.parse({}))).toBeNull()
    expect(findValveInsertionTarget([{ ...run, system: 'vent' }], [2, 0, 0], false)).toBeNull()
    expect(findValveInsertionTarget([{ ...run, visible: false }], [2, 0, 0], false)).toBeNull()
  })
  test('direct mesh hits resolve a vertical pipe in 3D', () => {
    const run = PipeSegmentNode.parse({ path: [[2, 0, 3], [2, 4, 3]] })
    const target = findValveInsertionTarget([run], [2.02, 2, 3], true)!
    const plan = planValveInsertion(run, target.index, target.point, PoolValveNode.parse({}))!
    expect(plan.update.data.path.at(-1)![1]).toBeCloseTo(1.72)
    expect(plan.tail.path[0]![1]).toBeCloseTo(2.28)
  })
})
