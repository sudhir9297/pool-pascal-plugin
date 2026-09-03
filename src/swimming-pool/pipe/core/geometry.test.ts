import { describe, expect, test } from 'bun:test'
import { BoxGeometry, IcosahedronGeometry, Mesh, SphereGeometry } from 'three'
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

    expect(meshes).toHaveLength(1)
    expect(meshes[0]?.userData).toMatchObject({
      pipeEdgeId: 'e0',
      pipeEdgeStart: [0, 0, 0],
      pipeEdgeEnd: [3, 0, 0],
    })
  })

  test('keeps visible fitting bodies at bends while leaving endpoints clear', () => {
    const network = PoolPipeNode.parse({
      id: 'pipe-network_fitting',
      nodes: [
        { id: 'n0', position: [0, 0, 0], kind: 'endpoint' },
        { id: 'n1', position: [3, 0, 0], kind: 'corner' },
        { id: 'n2', position: [3, 0, 2], kind: 'endpoint' },
      ],
      edges: [
        { id: 'e0', from: 'n0', to: 'n1', style: 'rigid' },
        { id: 'e1', from: 'n1', to: 'n2', style: 'rigid' },
      ],
    })

    const meshes = buildPipeGeometry(network).children.filter((child) => child instanceof Mesh)
    expect(meshes).toHaveLength(5)
    expect(meshes[2]?.userData).toMatchObject({ pipeNodeId: 'n1', pipeFittingKind: 'elbow' })
  })

  test('renders distinct fitting bodies for a tee and a cross', () => {
    const network = PoolPipeNode.parse({
      id: 'pipe-network_junctions',
      nodes: [
        { id: 'n0', position: [-2, 0, 0], kind: 'endpoint' },
        { id: 'n1', position: [0, 0, 0], kind: 'tee' },
        { id: 'n2', position: [2, 0, 0], kind: 'endpoint' },
        { id: 'n3', position: [0, 0, 2], kind: 'endpoint' },
        { id: 'n4', position: [0, 0, -2], kind: 'endpoint' },
      ],
      edges: [
        { id: 'e0', from: 'n0', to: 'n1', style: 'rigid' },
        { id: 'e1', from: 'n1', to: 'n2', style: 'rigid' },
        { id: 'e2', from: 'n1', to: 'n3', style: 'rigid' },
        { id: 'e3', from: 'n1', to: 'n4', style: 'rigid' },
      ],
    })

    const fittingMeshes = buildPipeGeometry(network).children.filter((child) => child instanceof Mesh && child.userData.pipeFittingKind)
    expect(fittingMeshes).toHaveLength(5)
    expect(fittingMeshes[0]?.userData.pipeFittingKind).toBe('cross')
    expect((fittingMeshes[0] as Mesh | undefined)?.geometry).toBeInstanceOf(BoxGeometry)
  })

  test('renders a plus fitting for a crossing node with two local edges', () => {
    const network = PoolPipeNode.parse({
      id: 'pipe-network_crossing',
      nodes: [
        { id: 'n0', position: [-2, 0, 0], kind: 'endpoint' },
        { id: 'n1', position: [0, 0, 0], kind: 'cross' },
        { id: 'n2', position: [2, 0, 0], kind: 'endpoint' },
      ],
      edges: [
        { id: 'e0', from: 'n0', to: 'n1', style: 'rigid' },
        { id: 'e1', from: 'n1', to: 'n2', style: 'rigid' },
      ],
    })

    const fittingMeshes = buildPipeGeometry(network).children.filter((child) => child instanceof Mesh && child.userData.pipeFittingKind === 'cross')
    expect(fittingMeshes).toHaveLength(5)
    expect((fittingMeshes[0] as Mesh | undefined)?.geometry).toBeInstanceOf(BoxGeometry)

    const yNetwork = PoolPipeNode.parse({
      id: 'pipe-network_y-body',
      nodes: [
        { id: 'n0', position: [-1, 0, 0], kind: 'endpoint' },
        { id: 'n1', position: [0, 0, 0], kind: 'y' },
        { id: 'n2', position: [1, 0, 1], kind: 'endpoint' },
        { id: 'n3', position: [0, 0, -1], kind: 'endpoint' },
      ],
      edges: [
        { id: 'e0', from: 'n0', to: 'n1', style: 'rigid' },
        { id: 'e1', from: 'n1', to: 'n2', style: 'rigid' },
        { id: 'e2', from: 'n1', to: 'n3', style: 'rigid' },
      ],
    })
    const yBody = buildPipeGeometry(yNetwork).children.find((child) => child instanceof Mesh && child.userData.pipeFittingBody) as Mesh | undefined
    expect(yBody?.geometry).toBeInstanceOf(IcosahedronGeometry)

    const elbowNetwork = PoolPipeNode.parse({
      id: 'pipe-network_elbow-body',
      nodes: [
        { id: 'n0', position: [0, 0, 0], kind: 'endpoint' },
        { id: 'n1', position: [1, 0, 0], kind: 'elbow' },
        { id: 'n2', position: [1, 0, 1], kind: 'endpoint' },
      ],
      edges: [
        { id: 'e0', from: 'n0', to: 'n1', style: 'rigid' },
        { id: 'e1', from: 'n1', to: 'n2', style: 'rigid' },
      ],
    })
    const elbowBody = buildPipeGeometry(elbowNetwork).children.find((child) => child instanceof Mesh && child.userData.pipeFittingBody) as Mesh | undefined
    expect(elbowBody?.geometry).toBeInstanceOf(SphereGeometry)
  })

  test('marks invalid fitting hubs with visible feedback metadata', () => {
    const network = PoolPipeNode.parse({
      id: 'pipe-network_invalid-feedback',
      nodes: [
        { id: 'n0', position: [0, 0, 0], kind: 'endpoint' },
        { id: 'n1', position: [1, 0, 0], kind: 'tee' },
        { id: 'n2', position: [2, 0, 0], kind: 'endpoint' },
      ],
      edges: [
        { id: 'e0', from: 'n0', to: 'n1', style: 'rigid' },
        { id: 'e1', from: 'n1', to: 'n2', style: 'rigid' },
      ],
    })
    const hub = buildPipeGeometry(network).children.find((child) => child instanceof Mesh && child.userData.pipeFittingBody) as Mesh | undefined
    expect(hub?.userData.pipeFittingInvalid).toBe(true)
  })
})
