import type { AnyNode } from '@pascal-app/core'
import type { PoolNode } from '../../core/schema'
import { getInletPipeConnection, resolveMountedInlet } from '../../inlet/design/placement'
import type { PoolInletNode } from '../../inlet/core/schema'
import { getDrainPipeConnection } from '../../drain/design/placement'
import type { PoolDrainNode } from '../../drain/core/schema'
import { getSkimmerPipeConnection, resolveMountedSkimmer } from '../../skimmer/design/placement'
import type { PoolSkimmerNode } from '../../skimmer/core/schema'
import { getValveSlotKey } from '../../valve/design/placement'
import { getValvePortPositions } from '../../valve/core/geometry'
import type { PoolValveNode } from '../../valve/core/schema'
import type { PipeNetwork } from '../../design/pipe-network'

export type PipePoint = [number, number, number]

export type PipePortKind = 'equipment' | 'pipe-endpoint' | 'pipe-fitting'

export type PipePort = {
  id: string
  ownerId: string
  kind: PipePortKind
  position: PipePoint
  direction: PipePoint
  diameter?: number
  system?: 'waste' | 'vent'
  occupied?: boolean
}

export type PipeBodyHit = {
  networkId: string
  edgeId: string
  segmentIndex: number
  position: PipePoint
  distance: number
  t: number
}

export type PipeCrossingHit = PipeBodyHit & {
  drawnT: number
  trunkT: number
}

export type PoolPipeSnapTarget = {
  position: PipePoint
  port: PipePort | null
  pipeBody: PipeBodyHit | null
  pipeConnection: { networkId: string; edgeId: string; position: PipePoint } | null
}

type Vec3Like = readonly [number, number, number]

function unit(vector: Vec3Like): PipePoint {
  const length = Math.hypot(vector[0], vector[1], vector[2])
  return length > 1e-9 ? [vector[0] / length, vector[1] / length, vector[2] / length] : [1, 0, 0]
}

function distanceXZ(a: Vec3Like, b: Vec3Like): number {
  return Math.hypot(a[0] - b[0], a[2] - b[2])
}

function distance3D(a: Vec3Like, b: Vec3Like): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
}

function pipePort(network: PipeNetwork, nodeId: string, id: string): PipePort | null {
  const index = network.nodes.findIndex((node) => node.id === nodeId)
  const node = network.nodes[index]
  if (!node) return null
  const neighbor = network.nodes[index === 0 ? 1 : index === network.nodes.length - 1 ? index - 1 : -1]
  if (!neighbor) return null
  return {
    id,
    ownerId: network.id,
    kind: 'pipe-endpoint',
    position: [...node.position],
    direction: unit([
      node.position[0] - neighbor.position[0],
      node.position[1] - neighbor.position[1],
      node.position[2] - neighbor.position[2],
    ]),
    diameter: network.diameter,
    system: 'waste',
  }
}

function fittingPorts(network: PipeNetwork): PipePort[] {
  const ports: PipePort[] = []
  for (const node of network.nodes.filter((candidate) => candidate.kind !== 'endpoint' && candidate.kind !== 'straight')) {
    for (const edge of network.edges.filter((candidate) => candidate.from === node.id || candidate.to === node.id)) {
        const otherId = edge.from === node.id ? edge.to : edge.from
        const other = network.nodes.find((candidate) => candidate.id === otherId)
        if (!other) continue
        ports.push({
          id: `${network.id}:${node.id}:${edge.id}`,
          ownerId: network.id,
          kind: 'pipe-fitting' as const,
          position: [...node.position] as PipePoint,
          direction: unit([
            node.position[0] - other.position[0],
            node.position[1] - other.position[1],
            node.position[2] - other.position[2],
          ]),
          diameter: network.diameter,
          system: 'waste' as const,
          occupied: true,
        })
    }
  }
  return ports
}

export function collectPipePorts(networks: readonly PipeNetwork[], includeFittingPorts = true): PipePort[] {
  return networks.flatMap((network) => {
    const endpoints = network.nodes
      .filter((node) => node.kind === 'endpoint')
      .map((node) => pipePort(network, node.id, `${network.id}:${node.id}`))
      .filter((port): port is PipePort => port !== null)
    return includeFittingPorts ? [...endpoints, ...fittingPorts(network)] : endpoints
  })
}

export function findNearestPipePort(
  point: Vec3Like,
  ports: readonly PipePort[],
  maxDistance = 0.35,
  ignoreOwnerId?: string,
): PipePort | null {
  let nearest: PipePort | null = null
  let nearestDistance = maxDistance
  let nearestPriority = Number.POSITIVE_INFINITY
  const priority = (kind: PipePortKind) => kind === 'equipment' ? 0 : kind === 'pipe-endpoint' ? 1 : 2
  for (const port of ports) {
    if (port.ownerId === ignoreOwnerId || port.occupied) continue
    const distance = distanceXZ(point, port.position)
    const portPriority = priority(port.kind)
    if (distance < maxDistance && (portPriority < nearestPriority || (portPriority === nearestPriority && distance < nearestDistance))) {
      nearest = port
      nearestDistance = distance
      nearestPriority = portPriority
    }
  }
  return nearest
}

function edgePoint(network: PipeNetwork, edge: PipeNetwork['edges'][number], point: Vec3Like) {
  const from = network.nodes.find((node) => node.id === edge.from)
  const to = network.nodes.find((node) => node.id === edge.to)
  if (!from || !to) return null
  const dx = to.position[0] - from.position[0]
  const dz = to.position[2] - from.position[2]
  const lengthSquared = dx * dx + dz * dz
  if (lengthSquared <= 1e-12) return null
  const t = Math.max(0, Math.min(1, ((point[0] - from.position[0]) * dx + (point[2] - from.position[2]) * dz) / lengthSquared))
  return {
    from,
    to,
    t,
    position: [from.position[0] + (to.position[0] - from.position[0]) * t, from.position[1] + (to.position[1] - from.position[1]) * t, from.position[2] + (to.position[2] - from.position[2]) * t] as PipePoint,
  }
}

export function findNearestPipeBody(
  point: Vec3Like,
  networks: readonly PipeNetwork[],
  options: { maxDistance?: number; endMargin?: number; ignoreNetworkId?: string } = {},
): PipeBodyHit | null {
  const maxDistance = options.maxDistance ?? 0.3
  const endMargin = options.endMargin ?? 0.08
  let nearest: PipeBodyHit | null = null
  for (const network of networks) {
    if (network.id === options.ignoreNetworkId) continue
    network.edges.forEach((edge, segmentIndex) => {
      if (edge.style !== 'rigid') return
      const hit = edgePoint(network, edge, point)
      if (!hit) return
      const segmentLength = distance3D(hit.from.position, hit.to.position)
      const distance = distanceXZ(point, hit.position)
      if (distance > maxDistance || hit.t * segmentLength < endMargin || (1 - hit.t) * segmentLength < endMargin) return
      if (!nearest || distance < nearest.distance) nearest = { networkId: network.id, edgeId: edge.id, segmentIndex, position: hit.position, distance, t: hit.t }
    })
  }
  return nearest
}

export function findNearestPipeEdge(
  point: Vec3Like,
  networks: readonly PipeNetwork[],
  maxDistance = 0.35,
  ignoreNetworkId?: string,
): { networkId: string; edgeId: string; position: PipePoint; distance: number } | null {
  let nearest: { networkId: string; edgeId: string; position: PipePoint; distance: number } | null = null
  for (const network of networks) {
    if (network.id === ignoreNetworkId) continue
    for (const edge of network.edges) {
      if (edge.style !== 'rigid') continue
      const hit = edgePoint(network, edge, point)
      if (!hit) continue
      const distance = distance3D(point, hit.position)
      if (distance <= maxDistance && (!nearest || distance < nearest.distance)) {
        nearest = { networkId: network.id, edgeId: edge.id, position: hit.position, distance }
      }
    }
  }
  return nearest
}

function crossing2D(a: Vec3Like, b: Vec3Like, c: Vec3Like, d: Vec3Like) {
  const abx = b[0] - a[0]
  const abz = b[2] - a[2]
  const cdx = d[0] - c[0]
  const cdz = d[2] - c[2]
  const denominator = abx * cdz - abz * cdx
  if (Math.abs(denominator) <= 1e-9) return null
  const acx = c[0] - a[0]
  const acz = c[2] - a[2]
  const first = (acx * cdz - acz * cdx) / denominator
  const second = (acx * abz - acz * abx) / denominator
  return first > 0 && first < 1 && second > 0 && second < 1 ? { first, second } : null
}

export function findPipeCrossing(
  start: Vec3Like,
  end: Vec3Like,
  networks: readonly PipeNetwork[],
  options: { maxHeightDifference?: number; endMargin?: number; ignoreNetworkId?: string } = {},
): PipeCrossingHit | null {
  const maxHeightDifference = options.maxHeightDifference ?? 0.12
  const endMargin = options.endMargin ?? 0.08
  let nearest: PipeCrossingHit | null = null
  for (const network of networks) {
    if (network.id === options.ignoreNetworkId) continue
    network.edges.forEach((edge, segmentIndex) => {
      if (edge.style !== 'rigid') return
      const from = network.nodes.find((node) => node.id === edge.from)
      const to = network.nodes.find((node) => node.id === edge.to)
      if (!from || !to) return
      const crossing = crossing2D(start, end, from.position, to.position)
      if (!crossing) return
      const drawnY = start[1] + (end[1] - start[1]) * crossing.first
      const trunkY = from.position[1] + (to.position[1] - from.position[1]) * crossing.second
      const trunkLength = distance3D(from.position, to.position)
      const drawnLength = distance3D(start, end)
      if (Math.abs(drawnY - trunkY) > maxHeightDifference || crossing.second * trunkLength < endMargin || (1 - crossing.second) * trunkLength < endMargin || crossing.first * drawnLength < endMargin || (1 - crossing.first) * drawnLength < endMargin) return
      const position: PipePoint = [start[0] + (end[0] - start[0]) * crossing.first, (drawnY + trunkY) / 2, start[2] + (end[2] - start[2]) * crossing.first]
      const distance = distanceXZ(position, start)
      if (!nearest || distance < nearest.distance) nearest = { networkId: network.id, edgeId: edge.id, segmentIndex, position, distance, t: crossing.second, drawnT: crossing.first, trunkT: crossing.second }
    })
  }
  return nearest
}

export function findNearestPoolPipeTarget(
  point: Vec3Like,
  ports: readonly PipePort[],
  networks: readonly PipeNetwork[],
  options: { portDistance?: number; bodyDistance?: number; ignoreNetworkId?: string } = {},
): PoolPipeSnapTarget | null {
  const port = findNearestPipePort(point, ports, options.portDistance ?? 0.35, options.ignoreNetworkId)
  const pipeBody = findNearestPipeBody(point, networks, {
    maxDistance: options.bodyDistance ?? 0.3,
    ignoreNetworkId: options.ignoreNetworkId,
  })
  const pipeEdge = findNearestPipeEdge(point, networks, options.portDistance ?? 0.35, options.ignoreNetworkId)
  if (!port && !pipeBody && !pipeEdge) return null
  if (port) {
    return { position: [...port.position], port, pipeBody: null, pipeConnection: pipeEdge && port.kind === 'pipe-endpoint' ? { networkId: pipeEdge.networkId, edgeId: pipeEdge.edgeId, position: [...port.position] } : null }
  }
  if (!pipeBody && pipeEdge) return { position: [...pipeEdge.position], port: null, pipeBody: null, pipeConnection: { networkId: pipeEdge.networkId, edgeId: pipeEdge.edgeId, position: [...pipeEdge.position] } }
  const selectedPipeBody = pipeBody
  if (!selectedPipeBody) return null
  return {
    position: [...selectedPipeBody.position],
    port: null,
    pipeBody: selectedPipeBody,
    pipeConnection: { networkId: selectedPipeBody.networkId, edgeId: selectedPipeBody.edgeId, position: [...selectedPipeBody.position] },
  }
}

type PoolConnectionNodes = {
  nodes: readonly AnyNode[]
  pools?: readonly PoolNode[]
  ignoreNetworkId?: string
}

function asNodes(nodes: readonly AnyNode[], type: string) {
  return nodes.filter((node) => node.type === type) as unknown as never[]
}

/** Normalizes all pool equipment sockets into the same port interface. */
export function collectPoolPipePorts({ nodes, pools = [], ignoreNetworkId }: PoolConnectionNodes): PipePort[] {
  const pipes = asNodes(nodes, 'pool:pipe-network') as unknown as PipeNetwork[]
  const ports = collectPipePorts(pipes.filter((pipe) => pipe.id !== ignoreNetworkId), false)
  const skimmers = asNodes(nodes, 'pool:skimmer') as unknown as PoolSkimmerNode[]
  const valves = asNodes(nodes, 'pool:valve') as unknown as PoolValveNode[]
  const drains = asNodes(nodes, 'pool:drain') as unknown as PoolDrainNode[]
  const inlets = asNodes(nodes, 'pool:inlet') as unknown as PoolInletNode[]
  for (const node of skimmers) {
    const mounted = resolveMountedSkimmer(node, pools.find((pool) => pool.id === node.poolId) ?? null)
    const connection = getSkimmerPipeConnection(mounted)
    ports.push({ id: `${node.id}:socket`, ownerId: node.id, kind: 'equipment', position: connection.position, direction: connection.direction })
  }
  for (const node of valves) {
    getValvePortPositions(node).forEach((position, portIndex) => ports.push({ id: getValveSlotKey(node.id, portIndex), ownerId: node.id, kind: 'equipment', position: [position.x, position.y, position.z], direction: unit([position.x - node.position[0], position.y - node.position[1], position.z - node.position[2]]), diameter: node.diameter }))
  }
  for (const node of drains) {
    const connection = getDrainPipeConnection(node)
    ports.push({ id: `${node.id}:socket`, ownerId: node.id, kind: 'equipment', position: connection.position, direction: connection.direction })
  }
  for (const node of inlets) {
    const mounted = resolveMountedInlet(node, pools.find((pool) => pool.id === node.poolId) ?? null)
    const connection = getInletPipeConnection(mounted)
    ports.push({ id: `${node.id}:socket`, ownerId: node.id, kind: 'equipment', position: connection.position, direction: connection.direction })
  }
  // A valve socket already used by an existing pipe is not a valid new snap
  // target. Keep this occupancy rule in the normalized port layer so every
  // tool sees the same available sockets.
  for (const port of ports.filter((candidate) => candidate.ownerId.startsWith('pool-valve_'))) {
    const occupied = pipes.some((pipe) => pipe.nodes.some((node) => distance3D(node.position, port.position) <= 0.08))
    port.occupied = occupied
  }
  return ports
}

export function findNearestPoolPipePort(point: Vec3Like, ports: readonly PipePort[], maxDistance = 0.35, ignoreOwnerId?: string): PipePort | null {
  return findNearestPipePort(point, ports, maxDistance, ignoreOwnerId)
}
