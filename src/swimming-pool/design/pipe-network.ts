export type PipePoint = [number, number, number]

export type PipeFittingKind = 'endpoint' | 'straight' | 'corner' | 'tee' | 'cross'

export type PipeGraphNode = {
  id: string
  position: PipePoint
  kind: PipeFittingKind
}

export type PipeGraphEdge = {
  id: string
  from: string
  to: string
  style: 'rigid' | 'smooth'
}

export type PipeNetwork = {
  id: string
  type: 'pool:pipe-network'
  parentId: string | null
  position: PipePoint
  rotation: PipePoint
  kitId: string
  diameter: number
  nodes: PipeGraphNode[]
  edges: PipeGraphEdge[]
}

const MIN_PIPE_LENGTH = 0.1

type CreatePipeNetworkOptions = {
  id: string
  parentId: string | null
  start: PipePoint
  end: PipePoint
  diameter?: number
  kitId?: string
}

export function createPipeNetwork({
  id,
  parentId,
  start,
  end,
  diameter = 0.05,
  kitId = 'pvc',
}: CreatePipeNetworkOptions): PipeNetwork {
  return {
    id,
    type: 'pool:pipe-network',
    parentId,
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    kitId,
    diameter,
    nodes: [
      { id: 'n0', position: start, kind: 'endpoint' },
      { id: 'n1', position: end, kind: 'endpoint' },
    ],
    edges: [{ id: 'e0', from: 'n0', to: 'n1', style: 'rigid' }],
  }
}

export function appendPipePoint(
  network: PipeNetwork,
  endpointId: string,
  position: PipePoint,
): PipeNetwork {
  const endpoint = network.nodes.find((node) => node.id === endpointId)
  if (!endpoint || endpoint.kind !== 'endpoint') {
    throw new Error(`Pipe endpoint not found: ${endpointId}`)
  }

  const nextNodeId = `n${network.nodes.length}`
  const nextEdgeId = `e${network.edges.length}`
  const nodes = network.nodes.map((node) =>
    node.id === endpointId ? { ...node, kind: 'corner' as const } : { ...node },
  )
  nodes.push({ id: nextNodeId, position, kind: 'endpoint' })

  return {
    ...network,
    nodes,
    edges: [
      ...network.edges.map((edge) => ({ ...edge })),
      { id: nextEdgeId, from: endpointId, to: nextNodeId, style: 'rigid' },
    ],
  }
}

export function createPipeNetworkFromPoints(
  id: string,
  parentId: string | null,
  points: PipePoint[],
): PipeNetwork {
  if (points.length < 2) throw new Error('A pipe network needs at least two points')

  let network = createPipeNetwork({
    id,
    parentId,
    start: points[0]!,
    end: points[1]!,
  })
  for (const point of points.slice(2)) {
    network = appendPipePoint(network, `n${network.nodes.length - 1}`, point)
  }
  return network
}

export function movePipeEndpoint(
  network: PipeNetwork,
  endpointId: string,
  delta: number,
): PipeNetwork {
  const endpoint = network.nodes.find((node) => node.id === endpointId)
  const edge = network.edges.find((candidate) => candidate.from === endpointId || candidate.to === endpointId)
  if (!endpoint || endpoint.kind !== 'endpoint' || !edge) {
    throw new Error(`Open pipe endpoint not found: ${endpointId}`)
  }

  const neighborId = edge.from === endpointId ? edge.to : edge.from
  const neighbor = network.nodes.find((node) => node.id === neighborId)
  if (!neighbor) throw new Error(`Pipe neighbor not found: ${neighborId}`)

  const axis: PipePoint = [
    endpoint.position[0] - neighbor.position[0],
    endpoint.position[1] - neighbor.position[1],
    endpoint.position[2] - neighbor.position[2],
  ]
  const length = Math.hypot(axis[0], axis[1], axis[2])
  if (length <= Number.EPSILON) return network

  const nextLength = Math.max(MIN_PIPE_LENGTH, length + delta)
  const nextPosition: PipePoint = [
    neighbor.position[0] + (axis[0] / length) * nextLength,
    neighbor.position[1] + (axis[1] / length) * nextLength,
    neighbor.position[2] + (axis[2] / length) * nextLength,
  ]
  return {
    ...network,
    nodes: network.nodes.map((node) => node.id === endpointId
      ? { ...node, position: nextPosition }
      : { ...node }),
    edges: network.edges.map((candidate) => ({ ...candidate })),
  }
}

export function movePipeEndpointByVector(
  network: PipeNetwork,
  endpointId: string,
  delta: PipePoint,
): PipeNetwork {
  const endpoint = network.nodes.find((node) => node.id === endpointId)
  if (!endpoint || endpoint.kind !== 'endpoint') {
    throw new Error(`Open pipe endpoint not found: ${endpointId}`)
  }

  return {
    ...network,
    nodes: network.nodes.map((node) => node.id === endpointId
      ? {
          ...node,
          position: [
            node.position[0] + delta[0],
            node.position[1] + delta[1],
            node.position[2] + delta[2],
          ],
        }
      : { ...node }),
    edges: network.edges.map((edge) => ({ ...edge })),
  }
}

export function insertPipePoint(
  network: PipeNetwork,
  edgeId: string,
  position: PipePoint,
): PipeNetwork {
  const edgeIndex = network.edges.findIndex((edge) => edge.id === edgeId)
  const edge = network.edges[edgeIndex]
  if (!edge) throw new Error(`Pipe edge not found: ${edgeId}`)

  const nodeId = `n${network.nodes.length}`
  const firstEdgeId = `e${network.edges.length}`
  const secondEdgeId = `e${network.edges.length + 1}`
  return {
    ...network,
    nodes: [
      ...network.nodes.map((node) => ({ ...node })),
      { id: nodeId, position, kind: 'corner' },
    ],
    edges: [
      ...network.edges.slice(0, edgeIndex).map((candidate) => ({ ...candidate })),
      { id: firstEdgeId, from: edge.from, to: nodeId, style: edge.style },
      { id: secondEdgeId, from: nodeId, to: edge.to, style: edge.style },
      ...network.edges.slice(edgeIndex + 1).map((candidate) => ({ ...candidate })),
    ],
  }
}
