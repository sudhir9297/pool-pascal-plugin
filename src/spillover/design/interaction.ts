import type { AnyNode } from '@pascal-app/core'
import { PoolNode, resolvePoolPolygon } from '../../core/schema'
import type { PoolSpilloverNode } from '../core/schema'
import { resolvePoolSpillover, type PoolSpilloverPlacement } from './placement'

function poolContainsPoint(pool: PoolNode, worldPoint: [number, number, number]) {
  const rotation = pool.rotation[1] ?? 0
  const dx = worldPoint[0] - pool.position[0]
  const dz = worldPoint[2] - pool.position[2]
  const cos = Math.cos(rotation)
  const sin = Math.sin(rotation)
  const local: [number, number] = [dx * cos - dz * sin, dx * sin + dz * cos]
  const polygon = resolvePoolPolygon(pool)
  let inside = false
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
    const [x, z] = polygon[index]!
    const [previousX, previousZ] = polygon[previous]!
    const intersects = ((z > local[1]) !== (previousZ > local[1])) &&
      local[0] < (previousX - x) * (local[1] - z) / (previousZ - z) + x
    if (intersects) inside = !inside
  }
  return inside
}

export function findPoolAtPoint(
  nodes: Record<string, AnyNode>,
  point: [number, number, number],
  parentId: string,
) {
  return Object.values(nodes)
    .filter((node) => node.parentId === parentId && String(node.type) === 'pool:pool')
    .flatMap((node) => {
      const parsed = PoolNode.safeParse(node)
      return parsed.success && poolContainsPoint(parsed.data, point) ? [parsed.data] : []
    })
    .sort((left, right) => {
      const leftDistance = Math.hypot(point[0] - left.position[0], point[2] - left.position[2])
      const rightDistance = Math.hypot(point[0] - right.position[0], point[2] - right.position[2])
      return leftDistance - rightDistance || left.id.localeCompare(right.id)
    })[0] ?? null
}

export type PoolSpilloverCandidate = {
  pool: PoolNode | null
  placement: PoolSpilloverPlacement | null
}

export function resolvePoolSpilloverPair(
  source: PoolNode,
  target: PoolNode,
  connectionStyle: PoolSpilloverNode['connectionStyle'] = 'auto',
) {
  if (source.id === target.id) return null
  return resolvePoolSpillover(source, target, connectionStyle)
}

export function resolvePoolSpilloverCandidate(
  nodes: Record<string, AnyNode>,
  point: [number, number, number],
  parentId: string,
  source: PoolNode,
  connectionStyle: PoolSpilloverNode['connectionStyle'] = 'auto',
): PoolSpilloverCandidate {
  const pool = findPoolAtPoint(nodes, point, parentId)
  if (!pool) return { pool, placement: null }
  return { pool, placement: resolvePoolSpilloverPair(source, pool, connectionStyle) }
}
