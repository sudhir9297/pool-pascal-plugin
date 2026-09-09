import { expect, test } from 'bun:test'
import { LevelNode, PipeSegmentNode, PipeFittingNode, registerNode, useScene, type AnyNode, type AnyNodeDefinition } from '@pascal-app/core'
import { PoolPumpNode } from '../pump/core/schema'
import { PoolFilterNode } from '../filter/core/schema'
import { PoolHeaterNode } from '../heater/core/schema'
import { PoolValveNode } from '../valve/core/schema'
import { assessInsertionRemoval, recordPipeInsertion } from '../core/insertion-removal'
import { createInsertionDeletionHooks } from './insertion-deletion'

let answer = false
let prompts = 0
const hooks = createInsertionDeletionHooks(() => { prompts++; return answer })
for (const schema of [PoolPumpNode, PoolFilterNode, PoolHeaterNode, PoolValveNode]) {
  registerNode({ kind: schema.parse({}).type, schemaVersion: 1, schema, parametrics: hooks } as unknown as AnyNodeDefinition)
}

function fixture(schema: typeof PoolPumpNode | typeof PoolFilterNode | typeof PoolHeaterNode | typeof PoolValveNode = PoolPumpNode) {
  const level = LevelNode.parse({})
  const original = PipeSegmentNode.parse({ parentId: level.id, path: [[-3, 0, 0], [3, 0, 0]], diameter: 2 })
  const head = { ...original, path: [[-3, 0, 0], [-1, 0, 0]] as [number, number, number][] }
  const tail = PipeSegmentNode.parse({ ...original, id: undefined, path: [[1, 0, 0], [3, 0, 0]] })
  const elbow = PipeFittingNode.parse({ parentId: level.id, position: [-1, 0, 0] })
  const pipe = PipeSegmentNode.parse({ parentId: level.id, path: [[-1, 0, 0], [-1, 1, 0]] })
  const owner = recordPipeInsertion(schema.parse({ parentId: level.id }), original, { path: head.path }, tail, [elbow, pipe])
  const members = [owner, head, tail, elbow, pipe]
  const nodes = Object.fromEntries([{ ...level, children: members.map(node => node.id) }, ...members].map(node => [node.id, node])) as Record<AnyNode['id'], AnyNode>
  return { level, original, head, tail, elbow, pipe, owner, nodes }
}

for (const schema of [PoolPumpNode, PoolFilterNode, PoolHeaterNode, PoolValveNode]) {
  test(`${schema.parse({}).type} deletion restores the pipe with one undo/redo after serialization`, () => {
    const f = fixture(schema)
    const previous = useScene.getState()
    useScene.setState({ nodes: JSON.parse(JSON.stringify(f.nodes)), rootNodeIds: [f.level.id], readOnly: false })
    useScene.temporal.getState().clear()
    useScene.temporal.getState().resume()
    prompts = 0
    try {
      useScene.getState().deleteNode(f.owner.id as never)
      expect(prompts).toBe(0)
      expect(useScene.getState().nodes[f.original.id]).toEqual(f.original)
      expect(Object.keys(useScene.getState().nodes)).toHaveLength(2)
      useScene.temporal.getState().undo()
      expect(useScene.getState().nodes).toEqual(f.nodes)
      useScene.temporal.getState().redo()
      expect(Object.keys(useScene.getState().nodes)).toHaveLength(2)
    } finally { useScene.setState(previous); useScene.temporal.getState().clear() }
  })
}

test('edited connections prompt once and can be left open without deleting any pipe', () => {
  const f = fixture()
  f.nodes[f.pipe.id] = { ...f.pipe, diameter: 3 }
  const requested = new Set([f.owner.id as AnyNode['id']])
  prompts = 0; answer = false
  expect(hooks.onDeleteCascade(f.owner, f.nodes, requested, requested)).toEqual([])
  expect(hooks.onDelete(f.owner, f.nodes, requested, requested)).toEqual([])
  expect(prompts).toBe(1)
  answer = true
  const retry = new Set(requested)
  expect(hooks.onDeleteCascade(f.owner, f.nodes, retry, retry)).toEqual([f.tail.id, f.elbow.id, f.pipe.id])
  expect(hooks.onDelete(f.owner, f.nodes, retry, retry)[0]?.data.path).toEqual(f.original.path)
})

test('new branches require confirmation and are never included in companion deletes', () => {
  const f = fixture()
  const branch = PipeSegmentNode.parse({ parentId: f.level.id, path: [[-1, 0.5, 0], [0, 0.5, 0]] })
  f.nodes[branch.id] = branch
  const removal = assessInsertionRemoval(f.owner, f.nodes)!
  expect(removal.changed).toBe(true)
  expect(removal.remove).not.toContain(branch.id)
})

test('ordinary endpoint connections do not count as added branches', () => {
  const f = fixture()
  const pipe = PipeSegmentNode.parse({ parentId: f.level.id, path: [[-5, 0, 0], [-3, 0, 0]] })
  f.nodes[pipe.id] = pipe
  expect(assessInsertionRemoval(f.owner, f.nodes)?.changed).toBe(false)
})

test('copies, legacy equipment and missing source pipes never repair another assembly', () => {
  const f = fixture()
  expect(assessInsertionRemoval({ ...f.owner, id: 'copy' }, f.nodes)).toBeNull()
  expect(assessInsertionRemoval({ ...f.owner, metadata: {} }, f.nodes)).toBeNull()
  delete f.nodes[f.original.id]
  expect(assessInsertionRemoval(f.owner, f.nodes)).toBeNull()
})

test('deleting a level does not prompt or restore pipes inside its subtree', () => {
  const f = fixture()
  const requested = new Set([f.level.id])
  prompts = 0
  expect(hooks.onDeleteCascade(f.owner, f.nodes, requested, requested)).toEqual([])
  expect(hooks.onDelete(f.owner, f.nodes, requested, requested)).toEqual([])
  expect(prompts).toBe(0)
})
