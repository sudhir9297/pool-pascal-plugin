import { resolvePoolPolygon, type PoolNode } from '../../core/schema'
import type { PoolPipeNode } from '../core/schema'
import { findNearestSkimmerConnection } from '../../skimmer/design/placement'
import type { PoolSkimmerNode } from '../../skimmer/core/schema'
import type { PipePoint } from '../../design/pipe-network'
import type { PoolValveNode } from '../../valve/core/schema'
import { findNearestValveConnection, getValveSlotKey } from '../../valve/design/placement'
import type { PoolDrainNode } from '../../drain/core/schema'
import { findNearestDrainConnection } from '../../drain/design/placement'
import type { PoolInletNode } from '../../inlet/core/schema'
import { findNearestInletConnection } from '../../inlet/design/placement'

function pointInPolygon(x: number, z: number, polygon: readonly (readonly [number, number])[]) {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i]
    const b = polygon[j]
    if (!a || !b) continue
    if ((a[1] > z) !== (b[1] > z) && x < ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1]) + a[0]) inside = !inside
  }
  return inside
}

function crossesPool(start: PipePoint, end: PipePoint, pool: PoolNode) {
  const polygon = resolvePoolPolygon(pool)
  for (let index = 1; index < 20; index += 1) {
    const t = index / 20
    const x = start[0] + (end[0] - start[0]) * t - pool.position[0]
    const z = start[2] + (end[2] - start[2]) * t - pool.position[2]
    if (pointInPolygon(x, z, polygon)) return true
  }
  return false
}

function pathLength(points: readonly PipePoint[]) {
  return points.slice(1).reduce((length, point, index) => {
    const previous = points[index]!
    return length + Math.hypot(point[0] - previous[0], point[1] - previous[1], point[2] - previous[2])
  }, 0)
}

function detourAroundPool(start: PipePoint, end: PipePoint, pool: PoolNode): PipePoint[] {
  const polygon = resolvePoolPolygon(pool)
  const xs = polygon.map(([x]) => x + pool.position[0])
  const zs = polygon.map(([, z]) => z + pool.position[2])
  const minX = Math.min(...xs) - 0.12
  const maxX = Math.max(...xs) + 0.12
  const minZ = Math.min(...zs) - 0.12
  const maxZ = Math.max(...zs) + 0.12
  const corners: PipePoint[] = [[minX, start[1], minZ], [maxX, start[1], minZ], [maxX, start[1], maxZ], [minX, start[1], maxZ]]
  const candidates: PipePoint[][] = []
  for (let index = 0; index < corners.length; index += 1) {
    const a = corners[index]!
    const b = corners[(index + 1) % corners.length]!
    candidates.push([start, a, b, end], [start, b, a, end])
  }
  const valid = candidates.filter((candidate) => candidate.slice(0, -1).every((point, index) => !crossesPool(point, candidate[index + 1]!, pool)))
  valid.sort((left, right) => pathLength(left) - pathLength(right))
  return valid[0] ?? [start, end]
}

export function routePipeOutsidePools(start: PipePoint, end: PipePoint, pools: readonly PoolNode[], lead?: [number, number, number]): PipePoint[] {
  let route: PipePoint[] = lead
    ? [start, [start[0] + lead[0] * 0.18, start[1] + lead[1] * 0.18, start[2] + lead[2] * 0.18], end]
    : [start, end]
  for (const pool of pools) {
    const next: PipePoint[] = [route[0]!]
    for (let index = 1; index < route.length; index += 1) {
      const from = next.at(-1)!
      const to = route[index]!
      const segment = crossesPool(from, to, pool) ? detourAroundPool(from, to, pool) : [from, to]
      next.push(...segment.slice(1))
    }
    route = next
  }
  return route
}

export function validatePipeSocketUse(points: readonly PipePoint[], skimmers: readonly PoolSkimmerNode[], existingPipes: readonly PoolPipeNode[], ignoreNetworkId?: string, valves: readonly PoolValveNode[] = [], drains: readonly PoolDrainNode[] = [], inlets: readonly PoolInletNode[] = []) {
  const used = new Set<string>()
  for (const pipe of existingPipes) {
    if (pipe.id === ignoreNetworkId) continue
    for (const node of pipe.nodes) {
      const connection = findNearestSkimmerConnection(node.position, skimmers, 0.08)
      if (connection) used.add(connection.position.join(':'))
      const valveConnection = findNearestValveConnection(node.position, valves, 0.08)
      if (valveConnection) used.add(getValveSlotKey(valveConnection.valveId, valveConnection.portIndex))
      const drainConnection = findNearestDrainConnection(node.position, drains, 0.08)
      if (drainConnection) used.add(`drain:${drainConnection.drainId}`)
      const inletConnection = findNearestInletConnection(node.position, inlets, 0.08)
      if (inletConnection) used.add(`inlet:${inletConnection.inletId}`)
    }
  }
  for (const point of points) {
    const connection = findNearestSkimmerConnection(point, skimmers, 0.08)
    if (connection) {
      const key = connection.position.join(':')
      if (used.has(key)) return { valid: false as const, reason: 'That skimmer suction port is already connected.' }
      used.add(key)
    }
    const valveConnection = findNearestValveConnection(point, valves, 0.08)
    if (valveConnection) {
      const valveKey = getValveSlotKey(valveConnection.valveId, valveConnection.portIndex)
      if (used.has(valveKey)) return { valid: false as const, reason: 'That valve port is already connected.' }
      used.add(valveKey)
    }
    const drainConnection = findNearestDrainConnection(point, drains, 0.08)
    if (drainConnection) {
      const drainKey = `drain:${drainConnection.drainId}`
      if (used.has(drainKey)) return { valid: false as const, reason: 'That pool drain is already connected.' }
      used.add(drainKey)
    }
    const inletConnection = findNearestInletConnection(point, inlets, 0.08)
    if (inletConnection) {
      const inletKey = `inlet:${inletConnection.inletId}`
      if (used.has(inletKey)) return { valid: false as const, reason: 'That pool return inlet is already connected.' }
      used.add(inletKey)
    }
  }
  return { valid: true as const }
}
