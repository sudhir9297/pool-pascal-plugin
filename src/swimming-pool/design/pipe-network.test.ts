import { describe, expect, test } from 'bun:test'
import { appendPipePoint, createPipeNetwork, createPipeNetworkFromPoints, insertPipePoint, movePipeEndpoint, movePipeEndpointByVector } from './pipe-network'

describe('pipe network graph', () => {
  test('creates an open PVC run from two points', () => {
    const network = createPipeNetwork({
      id: 'pipe_network_1',
      parentId: 'level_ground',
      start: [1, 0, 2],
      end: [4, 0, 2],
    })

    expect(network.type).toBe('pool:pipe-network')
    expect(network.kitId).toBe('pvc')
    expect(network.nodes).toEqual([
      { id: 'n0', position: [1, 0, 2], kind: 'endpoint' },
      { id: 'n1', position: [4, 0, 2], kind: 'endpoint' },
    ])
    expect(network.edges).toEqual([
      { id: 'e0', from: 'n0', to: 'n1', style: 'rigid' },
    ])
  })

  test('extends an open endpoint without changing the existing run', () => {
    const network = createPipeNetwork({
      id: 'pipe_network_2',
      parentId: 'level_ground',
      start: [0, 0, 0],
      end: [2, 0, 0],
    })

    const extended = appendPipePoint(network, 'n1', [2, 0, 3])

    expect(extended.nodes).toEqual([
      { id: 'n0', position: [0, 0, 0], kind: 'endpoint' },
      { id: 'n1', position: [2, 0, 0], kind: 'corner' },
      { id: 'n2', position: [2, 0, 3], kind: 'endpoint' },
    ])
    expect(extended.edges).toEqual([
      { id: 'e0', from: 'n0', to: 'n1', style: 'rigid' },
      { id: 'e1', from: 'n1', to: 'n2', style: 'rigid' },
    ])
    expect(network.nodes[1]?.position).toEqual([2, 0, 0])
  })

  test('creates a connected rigid path from drawn points', () => {
    const network = createPipeNetworkFromPoints('pipe_network_3', 'level_ground', [
      [0, 0, 0],
      [2, 0, 0],
      [2, 0, 3],
    ])

    expect(network.nodes.map((node) => node.kind)).toEqual(['endpoint', 'corner', 'endpoint'])
    expect(network.edges.map(({ from, to }) => [from, to])).toEqual([
      ['n0', 'n1'],
      ['n1', 'n2'],
    ])
  })

  test('moves an open endpoint along its existing pipe axis', () => {
    const network = createPipeNetwork({
      id: 'pipe_network_4',
      parentId: 'level_ground',
      start: [0, 0, 0],
      end: [2, 0, 0],
    })

    const moved = movePipeEndpoint(network, 'n1', 1)

    expect(moved.nodes[1]?.position).toEqual([3, 0, 0])
    expect(moved.nodes[0]?.position).toEqual([0, 0, 0])
  })

  test('keeps a shortened endpoint just beyond its neighbor', () => {
    const network = createPipeNetwork({
      id: 'pipe_network_5',
      parentId: 'level_ground',
      start: [0, 0, 0],
      end: [2, 0, 0],
    })

    const shortened = movePipeEndpoint(network, 'n1', -3)

    expect(shortened.nodes[1]?.position).toEqual([0.1, 0, 0])
  })

  test('moves an open endpoint by an arbitrary gizmo vector', () => {
    const network = createPipeNetwork({ id: 'pipe-vector', parentId: null, start: [0, 0, 0], end: [2, 0, 0] })
    const moved = movePipeEndpointByVector(network, 'n1', [0.5, 1, -0.25])

    expect(moved.nodes.find((node) => node.id === 'n1')?.position).toEqual([2.5, 1, -0.25])
  })

  test('inserts a junction into an existing segment', () => {
    const network = createPipeNetwork({
      id: 'pipe_network_6',
      parentId: 'level_ground',
      start: [0, 0, 0],
      end: [4, 0, 0],
    })

    const split = insertPipePoint(network, 'e0', [2, 0, 0])

    expect(split.nodes).toEqual([
      { id: 'n0', position: [0, 0, 0], kind: 'endpoint' },
      { id: 'n1', position: [4, 0, 0], kind: 'endpoint' },
      { id: 'n2', position: [2, 0, 0], kind: 'corner' },
    ])
    expect(split.edges).toEqual([
      { id: 'e1', from: 'n0', to: 'n2', style: 'rigid' },
      { id: 'e2', from: 'n2', to: 'n1', style: 'rigid' },
    ])
  })
})
