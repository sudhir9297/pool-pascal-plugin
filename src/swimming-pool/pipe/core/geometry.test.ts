import { describe, expect, test } from 'bun:test'
import { Mesh } from 'three'
import { buildPipeGeometry } from './geometry'
import { PoolPipeNode } from './schema'

describe('PVC pipe geometry', () => {
  test('builds one visible cylinder for each rigid edge', () => {
    const network = PoolPipeNode.parse({
      id: 'pipe-network_geometry',
      nodes: [
        { id: 'n0', position: [0, 0, 0], kind: 'endpoint' },
        { id: 'n1', position: [3, 0, 0], kind: 'endpoint' },
      ],
      edges: [{ id: 'e0', from: 'n0', to: 'n1', style: 'rigid' }],
    })

    const group = buildPipeGeometry(network)
    const meshes = group.children.filter((child) => child instanceof Mesh)

    expect(meshes).toHaveLength(3)
    expect(meshes[0]?.userData).toMatchObject({ pipeEdgeId: 'e0' })
    expect(meshes[1]?.userData).toMatchObject({ pipeNodeId: 'n0' })
    expect(meshes[2]?.userData).toMatchObject({ pipeNodeId: 'n1' })
  })
})
