import { expect, test } from 'bun:test'
import { runtimeConnections, type ConnectionNode } from './runtime-connections'

const port = (id: string, x: number, y = 0) => ({ id, position: [x, y, 0] as [number, number, number], direction: [1, 0, 0] as [number, number, number], diameter: 2, system: 'waste' })
function scene(): ConnectionNode[] {
  return [
    { id: 'heater', type: 'pool:heater', levelId: 'level1', ports: [port('outlet', 0), port('inlet', -2)] },
    { id: 'p1', type: 'pipe-segment', levelId: 'level1', ports: [port('start', 0), port('end', 1)] },
    { id: 'elbow', type: 'pipe-fitting', levelId: 'level1', ports: [port('inlet', 1), port('outlet', 1, 1)] },
    { id: 'p2', type: 'pipe-segment', levelId: 'level1', ports: [port('start', 1, 1), port('end', 3, 1)] },
    { id: 'filter', type: 'pool:filter', levelId: 'level1', ports: [port('inlet', 3, 1)] },
  ]
}
test('derives both ends of an older route without adding or changing scene data', () => {
  const nodes = scene(), before = JSON.stringify(nodes)
  const graph = runtimeConnections(nodes)
  expect(graph.connectedTo('heater', 'outlet')).toMatchObject([{ other: { nodeId: 'filter', portId: 'inlet' } }])
  expect(graph.connectedTo('filter', 'inlet')).toMatchObject([{ other: { nodeId: 'heater', portId: 'outlet' } }])
  expect(graph.connectedTo('heater', 'inlet')).toEqual([])
  expect(JSON.stringify(nodes)).toBe(before)
})
test('a missing elbow breaks the route but leaves the attached socket occupied', () => {
  const graph = runtimeConnections(scene().filter((node) => node.id !== 'elbow'))
  expect(graph.connectedTo('heater', 'outlet')).toEqual([])
  expect(graph.isOccupied('heater', 'outlet')).toBe(true)
})
test('moving a pipe away frees its socket; restoring positions restores the connection', () => {
  const nodes = scene()
  nodes[1]!.ports = [port('start', 0.1), port('end', 1)]
  expect(runtimeConnections(nodes).isOccupied('heater', 'outlet')).toBe(false)
  expect(runtimeConnections(scene()).connectedTo('heater', 'outlet')).toHaveLength(1)
})
test('does not connect another floor or mismatched sizes', () => {
  for (const change of ['level', 'size']) {
    const nodes = scene()
    if (change === 'level') nodes[4]!.levelId = 'level2'
    else nodes[4]!.ports = [{ ...port('inlet', 3, 1), diameter: 3 }]
    expect(runtimeConnections(nodes).connectedTo('heater', 'outlet')).toEqual([])
  }
})
