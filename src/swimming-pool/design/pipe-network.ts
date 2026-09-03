import { STANDARD_POOL_PVC_DIAMETER } from '../pipe/core/constants'
import { findPipeCrossing } from '../pipe/design/ports'

export type PipePoint = [number, number, number]

export type PipeFittingKind = 'endpoint' | 'straight' | 'corner' | 'elbow' | 'tee' | 'y' | 'cross'

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

export type PipeAttachment = {
  nodeId: string
  ownerId: string
  portId: string
  kind: 'equipment' | 'fitting' | 'network'
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
  attachments?: PipeAttachment[]
}

export type PipeValidationIssue = {
  code: 'missing-node' | 'short-edge' | 'invalid-degree' | 'fitting-mismatch'
  message: string
  nodeId?: string
  edgeId?: string
}

export function validatePipeNetwork(network: PipeNetwork): PipeValidationIssue[] {
  const nodeById = new Map(network.nodes.map((node) => [node.id, node]))
  const degreeByNode = new Map(network.nodes.map((node) => [node.id, 0]))
  const issues: PipeValidationIssue[] = []
  for (const edge of network.edges) {
    const from = nodeById.get(edge.from)
    const to = nodeById.get(edge.to)
    if (!from || !to) {
      issues.push({ code: 'missing-node', edgeId: edge.id, message: `Pipe edge ${edge.id} references a missing node.` })
      continue
    }
    degreeByNode.set(edge.from, (degreeByNode.get(edge.from) ?? 0) + 1)
    degreeByNode.set(edge.to, (degreeByNode.get(edge.to) ?? 0) + 1)
    if (Math.hypot(to.position[0] - from.position[0], to.position[1] - from.position[1], to.position[2] - from.position[2]) < MIN_PIPE_LENGTH) {
      issues.push({ code: 'short-edge', edgeId: edge.id, message: `Pipe edge ${edge.id} is shorter than the minimum fitting length.` })
    }
  }
  for (const node of network.nodes) {
    const degree = degreeByNode.get(node.id) ?? 0
    if (node.kind === 'endpoint' && degree !== 1) {
      issues.push({ code: 'invalid-degree', nodeId: node.id, message: `Open endpoint ${node.id} must have exactly one connected edge.` })
    }
    if (node.kind !== 'endpoint' && node.kind !== 'straight' && node.kind !== 'cross' && degree < 2) {
      issues.push({ code: 'invalid-degree', nodeId: node.id, message: `Fitting ${node.id} does not have enough connected ports.` })
    }
    const expected = node.kind === 'cross' ? 'cross' : derivePipeFittingKind(network, node.id)
    if (node.kind !== 'endpoint' && node.kind !== 'straight' && node.kind !== 'corner' && node.kind !== expected) {
      issues.push({ code: 'fitting-mismatch', nodeId: node.id, message: `Fitting ${node.id} is classified as ${node.kind}, but its ports require ${expected}.` })
    }
  }
  return issues
}

function allocatePipeId(prefix: 'n' | 'e', usedIds: Iterable<string>): string {
  const used = new Set(usedIds)
  let next = 0
  for (const id of used) {
    const match = new RegExp(`^${prefix}(\\d+)$`).exec(id)
    if (match) next = Math.max(next, Number(match[1]) + 1)
  }
  let candidate = `${prefix}${next}`
  while (used.has(candidate)) candidate = `${prefix}${++next}`
  return candidate
}

function allocatePipeIds(prefix: 'n' | 'e', usedIds: Iterable<string>, count: number): string[] {
  const used = new Set(usedIds)
  const ids: string[] = []
  for (let index = 0; index < count; index += 1) {
    const id = allocatePipeId(prefix, used)
    ids.push(id)
    used.add(id)
  }
  return ids
}

/** Repair legacy networks created before graph ids were allocated collision-safely. */
export function normalizePipeNetworkEdgeIds(network: PipeNetwork): PipeNetwork {
  const seen = new Set<string>()
  let changed = false
  const edges = network.edges.map((edge) => {
    if (!seen.has(edge.id)) {
      seen.add(edge.id)
      return { ...edge }
    }
    const id = allocatePipeId('e', seen)
    seen.add(id)
    changed = true
    return { ...edge, id }
  })
  return changed ? { ...network, edges } : network
}

export function attachPipeNode(
  network: PipeNetwork,
  nodeId: string,
  target: { ownerId: string; portId: string; kind: PipeAttachment['kind'] },
): PipeNetwork {
  const node = network.nodes.find((candidate) => candidate.id === nodeId)
  if (!node || node.kind !== 'endpoint') throw new Error(`Only an open pipe endpoint can be attached: ${nodeId}`)
  const attachments = (network.attachments ?? []).filter((attachment) => attachment.nodeId !== nodeId)
  attachments.push({ nodeId, ...target })
  return { ...network, attachments }
}

export function detachPipeNode(network: PipeNetwork, nodeId: string): PipeNetwork {
  return { ...network, attachments: (network.attachments ?? []).filter((attachment) => attachment.nodeId !== nodeId) }
}

export function getPipeNodeAttachment(network: PipeNetwork, nodeId: string): PipeAttachment | null {
  return (network.attachments ?? []).find((attachment) => attachment.nodeId === nodeId) ?? null
}

export function syncAttachedPipeEndpoints(
  network: PipeNetwork,
  ports: readonly { ownerId: string; id: string; position: PipePoint }[],
): PipeNetwork {
  const portByKey = new Map(ports.map((port) => [`${port.ownerId}:${port.id}`, port.position]))
  let changed = false
  const nodes: PipeGraphNode[] = network.nodes.map((node) => {
    const attachment = (network.attachments ?? []).find((candidate) => candidate.nodeId === node.id && candidate.kind === 'equipment')
    if (!attachment || node.kind !== 'endpoint') return { ...node }
    const position = portByKey.get(`${attachment.ownerId}:${attachment.portId}`)
    if (!position || (
      Math.abs(position[0] - node.position[0]) <= 1e-6
      && Math.abs(position[1] - node.position[1]) <= 1e-6
      && Math.abs(position[2] - node.position[2]) <= 1e-6
    )) return { ...node }
    changed = true
    return { ...node, position: [position[0], position[1], position[2]] as PipePoint }
  })
  if (!changed) return network
  const next: PipeNetwork = { ...network, nodes, edges: network.edges.map((edge) => ({ ...edge })) }
  return { ...next, nodes: refreshPipeFittingKinds(next) }
}

/** Merge two open runs when their endpoints are joined directly. */
export function mergePipeNetworksAtEndpoints(
  target: PipeNetwork,
  source: PipeNetwork,
  targetEndpointId: string,
  sourceEndpointId: string,
): PipeNetwork {
  target = normalizePipeNetworkEdgeIds(target)
  source = normalizePipeNetworkEdgeIds(source)
  const targetEndpoint = target.nodes.find((node) => node.id === targetEndpointId)
  const sourceEndpoint = source.nodes.find((node) => node.id === sourceEndpointId)
  if (targetEndpoint?.kind !== 'endpoint' || sourceEndpoint?.kind !== 'endpoint') {
    throw new Error('Both pipe endpoints must be open before merging')
  }
  const sourceIdMap = new Map<string, string>()
  const sourceNodeIds = allocatePipeIds('n', target.nodes.map((node) => node.id), source.nodes.length - 1)
  const sourceNodes = source.nodes
    .filter((node) => node.id !== sourceEndpointId)
    .map((node, index) => {
      const id = sourceNodeIds[index]!
      sourceIdMap.set(node.id, id)
      return { ...node, id }
    })
  const sourceEdgeIds = allocatePipeIds('e', target.edges.map((edge) => edge.id), source.edges.length)
  const sourceEdges = source.edges.map((edge, index) => ({
    ...edge,
    id: sourceEdgeIds[index]!,
    from: edge.from === sourceEndpointId ? targetEndpointId : sourceIdMap.get(edge.from)!,
    to: edge.to === sourceEndpointId ? targetEndpointId : sourceIdMap.get(edge.to)!,
  }))
  const merged: PipeNetwork = {
    ...target,
    nodes: [...target.nodes.map((node) => ({ ...node })), ...sourceNodes],
    edges: [...target.edges.map((edge) => ({ ...edge })), ...sourceEdges],
    attachments: [
      ...(target.attachments ?? []),
      ...(source.attachments ?? []).map((attachment) => ({
        ...attachment,
        nodeId: attachment.nodeId === sourceEndpointId
          ? targetEndpointId
          : sourceIdMap.get(attachment.nodeId) ?? attachment.nodeId,
      })),
    ],
  }
  return { ...merged, nodes: refreshPipeFittingKinds(merged) }
}

export type PipeConnectionTarget = {
  networkId: string
  edgeId: string
  position: PipePoint
}

export function findAnchoredPipeNodeIds(
  network: PipeNetwork,
  connectionPoints: readonly PipePoint[],
  tolerance = 0.08,
): Set<string> {
  const anchored = new Set<string>()
  for (const node of network.nodes) {
    if (connectionPoints.some((point) => Math.hypot(
      node.position[0] - point[0],
      node.position[1] - point[1],
      node.position[2] - point[2],
    ) <= tolerance)) anchored.add(node.id)
  }
  return anchored
}

export function getPipeEdgeEndpointIds(network: PipeNetwork, edgeId: string): [string, string] | null {
  const edge = network.edges.find((candidate) => candidate.id === edgeId)
  return edge ? [edge.from, edge.to] : null
}

const MIN_PIPE_LENGTH = 0.1

function findPipeNodeAtPoint(network: PipeNetwork, point: PipePoint, tolerance = 0.08) {
  return network.nodes.find((node) => Math.hypot(
    node.position[0] - point[0],
    node.position[1] - point[1],
    node.position[2] - point[2],
  ) <= tolerance) ?? null
}

export function findNearestPipeConnection(
  point: readonly [number, number, number],
  networks: readonly PipeNetwork[],
  ignoreNetworkId?: string,
  maxDistance = 0.35,
): PipeConnectionTarget | null {
  let nearest: PipeConnectionTarget | null = null
  let nearestDistance = maxDistance
  for (const network of networks) {
    if (network.id === ignoreNetworkId) continue
    for (const edge of network.edges) {
      const from = network.nodes.find((node) => node.id === edge.from)
      const to = network.nodes.find((node) => node.id === edge.to)
      if (!from || !to || edge.style !== 'rigid') continue
      const dx = to.position[0] - from.position[0]
      const dy = to.position[1] - from.position[1]
      const dz = to.position[2] - from.position[2]
      const lengthSquared = dx * dx + dz * dz
      if (lengthSquared <= Number.EPSILON) continue
      const t = Math.max(0, Math.min(1, ((point[0] - from.position[0]) * dx + (point[2] - from.position[2]) * dz) / lengthSquared))
      const projected: PipePoint = [from.position[0] + dx * t, from.position[1] + dy * t, from.position[2] + dz * t]
      const distance = Math.hypot(point[0] - projected[0], point[1] - projected[1], point[2] - projected[2])
      if (distance >= nearestDistance) continue
      nearest = { networkId: network.id, edgeId: edge.id, position: projected }
      nearestDistance = distance
    }
  }
  return nearest
}

function isNearlyOpposite(left: PipePoint, right: PipePoint) {
  const leftLength = Math.hypot(...left)
  const rightLength = Math.hypot(...right)
  if (leftLength <= Number.EPSILON || rightLength <= Number.EPSILON) return false
  const dot = (left[0] * right[0] + left[1] * right[1] + left[2] * right[2]) / (leftLength * rightLength)
  return dot <= -0.9
}

export function derivePipeFittingKind(network: PipeNetwork, nodeId: string): PipeFittingKind {
  const node = network.nodes.find((candidate) => candidate.id === nodeId)
  if (!node) throw new Error(`Pipe node not found: ${nodeId}`)
  const directions = network.edges.flatMap((edge) => {
    const neighborId = edge.from === nodeId ? edge.to : edge.to === nodeId ? edge.from : null
    const neighbor = neighborId ? network.nodes.find((candidate) => candidate.id === neighborId) : undefined
    if (!neighbor) return []
    return [[
      neighbor.position[0] - node.position[0],
      neighbor.position[1] - node.position[1],
      neighbor.position[2] - node.position[2],
    ] as PipePoint]
  })
  if (directions.length <= 1) return 'endpoint'
  if (directions.length === 2) return isNearlyOpposite(directions[0]!, directions[1]!) ? 'straight' : 'elbow'
  if (directions.length === 3) {
    return directions.some((direction, index) => directions.some((other, otherIndex) => index < otherIndex && isNearlyOpposite(direction, other)))
      ? 'tee'
      : 'y'
  }
  return 'cross'
}

function refreshPipeFittingKinds(network: PipeNetwork): PipeGraphNode[] {
  return network.nodes.map((node) => ({
    ...node,
    // A cross may have only two local edges when its other legs live in a
    // sibling network. Preserve that explicit topology marker.
    kind: node.kind === 'cross' ? 'cross' : derivePipeFittingKind(network, node.id),
  }))
}

/**
 * Normalize and re-derive topology immediately before persisting a network.
 * This keeps legacy duplicate edge ids and stale fitting kinds from leaking
 * into the scene when a graph is committed through any editor path.
 */
export function preparePipeNetworkForCommit(network: PipeNetwork): PipeNetwork {
  const normalized = normalizePipeNetworkEdgeIds(network)
  return { ...normalized, nodes: refreshPipeFittingKinds(normalized) }
}

function findEdgeAtPoint(network: PipeNetwork, point: PipePoint) {
  let best: { edgeId: string; distance: number } | null = null
  for (const edge of network.edges) {
    const from = network.nodes.find((node) => node.id === edge.from)
    const to = network.nodes.find((node) => node.id === edge.to)
    if (!from || !to) continue
    const dx = to.position[0] - from.position[0]
    const dz = to.position[2] - from.position[2]
    const lengthSquared = dx * dx + dz * dz
    if (lengthSquared <= Number.EPSILON) continue
    const t = Math.max(0, Math.min(1, ((point[0] - from.position[0]) * dx + (point[2] - from.position[2]) * dz) / lengthSquared))
    const closest: PipePoint = [from.position[0] + dx * t, point[1], from.position[2] + dz * t]
    const distance = Math.hypot(point[0] - closest[0], point[2] - closest[2])
    if (!best || distance < best.distance) best = { edgeId: edge.id, distance }
  }
  return best?.distance !== undefined && best.distance <= 0.08 ? best.edgeId : null
}

function insertIntersection(network: PipeNetwork, point: PipePoint): PipeNetwork {
  const existing = network.nodes.find((node) => Math.hypot(node.position[0] - point[0], node.position[2] - point[2]) <= 0.08)
  if (existing) return {
    ...network,
    nodes: network.nodes.map((node) => node.id === existing.id ? { ...node, kind: 'cross' } : { ...node }),
  }
  const edgeId = findEdgeAtPoint(network, point)
  if (!edgeId) return network
  const inserted = insertPipePoint(network, edgeId, point)
  const insertedId = inserted.nodes.at(-1)?.id
  return {
    ...inserted,
    nodes: inserted.nodes.map((node) => node.id === insertedId ? { ...node, kind: 'cross' } : { ...node }),
  }
}

/** Attach an in-progress run to an existing segment and derive its junction fitting. */
export function connectPipeNetworkAtPoint(
  network: PipeNetwork,
  incoming: PipeNetwork,
  edgeId: string,
  point: PipePoint,
  incomingJoinNodeId = `n${incoming.nodes.length - 1}`,
): PipeNetwork {
  network = normalizePipeNetworkEdgeIds(network)
  incoming = normalizePipeNetworkEdgeIds(incoming)
  // A body hit can land on a corner when the user is extending an already
  // extended run. Reusing that node is essential: inserting another node at
  // the same position leaves overlapping fittings and promotes the apparent
  // junction to a false four-way.
  const existingJunction = findPipeNodeAtPoint(network, point)
  const split = existingJunction ? network : insertPipePoint(network, edgeId, point)
  const junctionId = existingJunction?.id ?? split.nodes.at(-1)?.id
  if (!junctionId) return network
  const sourceEndId = incomingJoinNodeId
  const sourceIdMap = new Map<string, string>()
  const sourceNodeIds = allocatePipeIds('n', split.nodes.map((node) => node.id), incoming.nodes.length - 1)
  const sourceNodes = incoming.nodes
    .filter((node) => node.id !== sourceEndId)
    .map((node, index) => {
      const id = sourceNodeIds[index]!
      sourceIdMap.set(node.id, id)
      return { ...node, id }
    })
  const sourceEdgeIds = allocatePipeIds('e', split.edges.map((edge) => edge.id), incoming.edges.length)
  const sourceEdges = incoming.edges.map((edge, index) => ({
    ...edge,
    id: sourceEdgeIds[index]!,
    from: edge.from === sourceEndId ? junctionId : sourceIdMap.get(edge.from)!,
    to: edge.to === sourceEndId ? junctionId : sourceIdMap.get(edge.to)!,
  }))
  const merged: PipeNetwork = {
    ...split,
    nodes: [...split.nodes, ...sourceNodes],
    edges: [...split.edges, ...sourceEdges],
    // Keep durable equipment/fitting links when the incoming run is merged.
    // The endpoint used as the join is consumed by the junction and its
    // attachment is intentionally not copied; every other source endpoint
    // receives its new graph-node id.
    attachments: [
      ...(split.attachments ?? []),
      ...(incoming.attachments ?? [])
        .filter((attachment) => attachment.nodeId !== sourceEndId)
        .map((attachment) => ({
          ...attachment,
          nodeId: sourceIdMap.get(attachment.nodeId) ?? attachment.nodeId,
        })),
    ],
  }
  return { ...merged, nodes: refreshPipeFittingKinds(merged) }
}

/** Splits crossing runs and marks the shared location for a visible cross fitting. */
export function addPipeIntersectionFittings(network: PipeNetwork, otherNetworks: readonly PipeNetwork[]): PipeNetwork {
  let next = network
  for (const other of otherNetworks) {
    for (const edge of network.edges) {
      const leftStart = network.nodes.find((node) => node.id === edge.from)?.position
      const leftEnd = network.nodes.find((node) => node.id === edge.to)?.position
      if (!leftStart || !leftEnd) continue
      const crossing = findPipeCrossing(leftStart, leftEnd, [other], { endMargin: 0.08 })
      if (crossing) next = insertIntersection(next, crossing.position)
    }
  }
  return next
}

/**
 * Resolve all cross-network intersections as one topology update. Each
 * crossing is inserted into both participating graphs at the exact same
 * world-space position, so either network can be rendered or edited without
 * losing the shared cross fitting.
 */
export function addPipeIntersectionFittingsToNetworks(
  networks: readonly PipeNetwork[],
): PipeNetwork[] {
  const resolved = networks.map((network) => ({
    ...network,
    nodes: network.nodes.map((node) => ({ ...node })),
    edges: network.edges.map((edge) => ({ ...edge })),
  }))

  for (let leftIndex = 0; leftIndex < resolved.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < resolved.length; rightIndex += 1) {
      const left = resolved[leftIndex]!
      const right = resolved[rightIndex]!
      for (const edge of left.edges) {
        const start = left.nodes.find((node) => node.id === edge.from)?.position
        const end = left.nodes.find((node) => node.id === edge.to)?.position
        if (!start || !end) continue
        const crossing = findPipeCrossing(start, end, [right], { endMargin: 0.08 })
        if (!crossing) continue
        resolved[leftIndex] = insertIntersection(resolved[leftIndex]!, crossing.position)
        resolved[rightIndex] = insertIntersection(resolved[rightIndex]!, crossing.position)
      }
    }
  }

  return resolved
}

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
  diameter = STANDARD_POOL_PVC_DIAMETER,
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
  network = normalizePipeNetworkEdgeIds(network)
  const endpoint = network.nodes.find((node) => node.id === endpointId)
  if (!endpoint || endpoint.kind !== 'endpoint') {
    throw new Error(`Pipe endpoint not found: ${endpointId}`)
  }

  const nextNodeId = allocatePipeId('n', network.nodes.map((node) => node.id))
  const nextEdgeId = allocatePipeId('e', network.edges.map((edge) => edge.id))
  const nodes = network.nodes.map((node) => ({ ...node }))
  nodes.push({ id: nextNodeId, position, kind: 'endpoint' })

  const next: PipeNetwork = {
    ...network,
    nodes,
    edges: [
      ...network.edges.map((edge) => ({ ...edge })),
      { id: nextEdgeId, from: endpointId, to: nextNodeId, style: 'rigid' },
    ],
  }
  return { ...next, nodes: refreshPipeFittingKinds(next) }
}

export function branchPipePoint(
  network: PipeNetwork,
  nodeId: string,
  position: PipePoint,
): PipeNetwork {
  network = normalizePipeNetworkEdgeIds(network)
  const node = network.nodes.find((candidate) => candidate.id === nodeId)
  if (!node) throw new Error(`Pipe node not found: ${nodeId}`)
  const degree = network.edges.reduce((count, edge) => count + (edge.from === nodeId || edge.to === nodeId ? 1 : 0), 0)
  if (degree >= 4) throw new Error(`Pipe node ${nodeId} cannot accept another branch`)

  const nextNodeId = allocatePipeId('n', network.nodes.map((node) => node.id))
  const nextEdgeId = allocatePipeId('e', network.edges.map((edge) => edge.id))
  const next: PipeNetwork = {
    ...network,
    nodes: [
      ...network.nodes.map((candidate) => ({ ...candidate })),
      { id: nextNodeId, position, kind: 'endpoint' },
    ],
    edges: [
      ...network.edges.map((edge) => ({ ...edge })),
      { id: nextEdgeId, from: nodeId, to: nextNodeId, style: 'rigid' },
    ],
  }
  return { ...next, nodes: refreshPipeFittingKinds(next) }
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
  options: { detach?: boolean } = {},
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
  const next: PipeNetwork = {
    ...network,
    nodes: network.nodes.map((node) => node.id === endpointId
      ? { ...node, position: nextPosition }
      : { ...node }),
    edges: network.edges.map((candidate) => ({ ...candidate })),
  }
  const withAttachment = options.detach ? detachPipeNode(next, endpointId) : next
  return { ...withAttachment, nodes: refreshPipeFittingKinds(withAttachment) }
}

export function movePipeEndpointByVector(
  network: PipeNetwork,
  endpointId: string,
  delta: PipePoint,
  options: { detach?: boolean } = {},
): PipeNetwork {
  const endpoint = network.nodes.find((node) => node.id === endpointId)
  if (!endpoint || endpoint.kind !== 'endpoint') {
    throw new Error(`Open pipe endpoint not found: ${endpointId}`)
  }

  return movePipeEndpointTo(network, endpointId, [
    endpoint.position[0] + delta[0],
    endpoint.position[1] + delta[1],
    endpoint.position[2] + delta[2],
  ], options)
}

/**
 * Re-aim an endpoint at an exact target position. The graph's neighboring
 * junction is recalculated immediately, so elbow/tee/Y/cross geometry follows
 * the new leg direction during a live drag and at commit time.
 */
export function movePipeEndpointTo(
  network: PipeNetwork,
  endpointId: string,
  position: PipePoint,
  options: { detach?: boolean } = {},
): PipeNetwork {
  const endpoint = network.nodes.find((node) => node.id === endpointId)
  if (!endpoint || endpoint.kind !== 'endpoint') throw new Error(`Open pipe endpoint not found: ${endpointId}`)
  const edge = network.edges.find((candidate) => candidate.from === endpointId || candidate.to === endpointId)
  const neighborId = edge ? (edge.from === endpointId ? edge.to : edge.from) : null
  const neighbor = neighborId ? network.nodes.find((node) => node.id === neighborId) : null
  let nextPosition: PipePoint = [...position]
  if (neighbor) {
    const axis: PipePoint = [position[0] - neighbor.position[0], position[1] - neighbor.position[1], position[2] - neighbor.position[2]]
    const distance = Math.hypot(...axis)
    if (distance < MIN_PIPE_LENGTH) {
      const fallback: PipePoint = [
        endpoint.position[0] - neighbor.position[0],
        endpoint.position[1] - neighbor.position[1],
        endpoint.position[2] - neighbor.position[2],
      ]
      const fallbackLength = Math.hypot(...fallback)
      const direction: PipePoint = fallbackLength > Number.EPSILON
        ? fallback.map((value) => value / fallbackLength) as PipePoint
        : [1, 0, 0]
      nextPosition = [
        neighbor.position[0] + direction[0] * MIN_PIPE_LENGTH,
        neighbor.position[1] + direction[1] * MIN_PIPE_LENGTH,
        neighbor.position[2] + direction[2] * MIN_PIPE_LENGTH,
      ]
    }
  }
  const next: PipeNetwork = {
    ...network,
    nodes: network.nodes.map((node) => node.id === endpointId ? { ...node, position: nextPosition } : { ...node }),
    edges: network.edges.map((edge) => ({ ...edge })),
  }
  const withAttachment = options.detach ? detachPipeNode(next, endpointId) : next
  return { ...withAttachment, nodes: refreshPipeFittingKinds(withAttachment) }
}

export function movePipeNode(
  network: PipeNetwork,
  nodeId: string,
  delta: PipePoint,
): PipeNetwork {
  const node = network.nodes.find((candidate) => candidate.id === nodeId)
  if (!node) throw new Error(`Pipe node not found: ${nodeId}`)
  const next: PipeNetwork = {
    ...network,
    nodes: network.nodes.map((candidate) => candidate.id === nodeId
      ? {
          ...candidate,
          position: [
            candidate.position[0] + delta[0],
            candidate.position[1] + delta[1],
            candidate.position[2] + delta[2],
          ],
        }
      : { ...candidate }),
    edges: network.edges.map((edge) => ({ ...edge })),
  }
  return { ...next, nodes: refreshPipeFittingKinds(next) }
}

/** Move a junction and keep coincident junctions in sibling networks aligned. */
export function movePipeNodeAcrossNetworks(
  networks: readonly PipeNetwork[],
  activeNetworkId: string,
  nodeId: string,
  delta: PipePoint,
  tolerance = 0.08,
): PipeNetwork[] {
  const active = networks.find((network) => network.id === activeNetworkId)
  const anchor = active?.nodes.find((node) => node.id === nodeId)
  if (!active || !anchor) throw new Error(`Pipe node not found: ${activeNetworkId}:${nodeId}`)
  const isNearAnchor = (node: PipeGraphNode) => Math.hypot(
    node.position[0] - anchor.position[0],
    node.position[1] - anchor.position[1],
    node.position[2] - anchor.position[2],
  ) <= tolerance

  return networks.map((network) => {
    const movedIds = network.id === activeNetworkId
      ? new Set([nodeId])
      : new Set(network.nodes.filter((node) => node.kind === 'cross' && isNearAnchor(node)).map((node) => node.id))
    if (movedIds.size === 0) return { ...network, nodes: network.nodes.map((node) => ({ ...node })) }
    const next: PipeNetwork = {
      ...network,
      nodes: network.nodes.map((node) => movedIds.has(node.id) ? {
        ...node,
        position: [node.position[0] + delta[0], node.position[1] + delta[1], node.position[2] + delta[2]],
      } : { ...node }),
      edges: network.edges.map((edge) => ({ ...edge })),
    }
    return { ...next, nodes: refreshPipeFittingKinds(next) }
  })
}

export function slidePipeEdge(
  network: PipeNetwork,
  edgeId: string,
  delta: PipePoint,
): PipeNetwork {
  const edge = network.edges.find((candidate) => candidate.id === edgeId)
  if (!edge) throw new Error(`Pipe edge not found: ${edgeId}`)
  const endpointIds = new Set([edge.from, edge.to])
  const next: PipeNetwork = {
    ...network,
    nodes: network.nodes.map((node) => endpointIds.has(node.id)
      ? {
          ...node,
          position: [
            node.position[0] + delta[0],
            node.position[1] + delta[1],
            node.position[2] + delta[2],
          ],
        }
      : { ...node }),
    edges: network.edges.map((candidate) => ({ ...candidate })),
  }
  return { ...next, nodes: refreshPipeFittingKinds(next) }
}

export function insertPipePoint(
  network: PipeNetwork,
  edgeId: string,
  position: PipePoint,
): PipeNetwork {
  network = normalizePipeNetworkEdgeIds(network)
  const edgeIndex = network.edges.findIndex((edge) => edge.id === edgeId)
  const edge = network.edges[edgeIndex]
  if (!edge) throw new Error(`Pipe edge not found: ${edgeId}`)

  const nodeId = allocatePipeId('n', network.nodes.map((node) => node.id))
  const [firstEdgeId, secondEdgeId] = allocatePipeIds('e', network.edges.map((edge) => edge.id), 2)
  const next: PipeNetwork = {
    ...network,
    nodes: [
      ...network.nodes.map((node) => ({ ...node })),
      // Inserting into an edge preserves a straight run. A later branch or
      // reroute promotes this node based on its connected directions.
      { id: nodeId, position, kind: 'straight' },
    ],
    edges: [
      ...network.edges.slice(0, edgeIndex).map((candidate) => ({ ...candidate })),
      { id: firstEdgeId!, from: edge.from, to: nodeId, style: edge.style },
      { id: secondEdgeId!, from: nodeId, to: edge.to, style: edge.style },
      ...network.edges.slice(edgeIndex + 1).map((candidate) => ({ ...candidate })),
    ],
  }
  return { ...next, nodes: refreshPipeFittingKinds(next) }
}

/** Remove one rigid segment and clean up nodes/fittings left behind by it. */
export function deletePipeEdge(network: PipeNetwork, edgeId: string): PipeNetwork {
  network = normalizePipeNetworkEdgeIds(network)
  if (!network.edges.some((edge) => edge.id === edgeId)) {
    throw new Error(`Pipe edge not found: ${edgeId}`)
  }

  const edges = network.edges.filter((edge) => edge.id !== edgeId).map((edge) => ({ ...edge }))
  const connectedNodeIds = new Set(edges.flatMap((edge) => [edge.from, edge.to]))
  const removedNodeIds = new Set(network.nodes
    .filter((node) => !connectedNodeIds.has(node.id))
    .map((node) => node.id))
  const nodes = network.nodes
    .filter((node) => !removedNodeIds.has(node.id))
    .map((node) => ({ ...node }))
  const next: PipeNetwork = {
    ...network,
    nodes,
    edges,
    attachments: (network.attachments ?? []).filter((attachment) => !removedNodeIds.has(attachment.nodeId)),
  }
  return { ...next, nodes: refreshPipeFittingKinds(next) }
}
