import { placementOnPoolWall, findNearestPoolWall as findNearestSkimmerWall, type SkimmerPlacement } from '../../skimmer/design/placement'
import type { PoolNode } from '../../core/schema'
import type { PoolInletNode } from '../core/schema'

export type InletPlacement = SkimmerPlacement
export type InletConnection = {
  inletId: string
  position: [number, number, number]
  direction: [number, number, number]
}

const SOCKET_DIRECTION_LOCAL: [number, number, number] = [0, 0, -1]

export const findNearestInletWall = findNearestSkimmerWall
export { placementOnPoolWall }

export function getInletPipeConnection(node: PoolInletNode): InletConnection {
  const angle = node.rotation[1]
  const sin = Math.sin(angle)
  const cos = Math.cos(angle)
  const socketLocalZ = -node.bodyDepth - 0.02
  const position: [number, number, number] = [
    node.position[0] + socketLocalZ * sin,
    node.position[1] + node.verticalOffset,
    node.position[2] + socketLocalZ * cos,
  ]
  const [x, y, z] = SOCKET_DIRECTION_LOCAL
  return {
    inletId: node.id,
    position,
    direction: [x * cos + z * sin, y, -x * sin + z * cos],
  }
}

export function findNearestInletConnection(
  point: readonly [number, number, number],
  inlets: readonly PoolInletNode[],
  tolerance = 0.08,
): InletConnection | null {
  let nearest: InletConnection | null = null
  let nearestDistance = tolerance
  for (const inlet of inlets) {
    const connection = getInletPipeConnection(inlet)
    const distance = Math.hypot(point[0] - connection.position[0], point[2] - connection.position[2])
    if (distance <= nearestDistance) {
      nearest = connection
      nearestDistance = distance
    }
  }
  return nearest
}

export function resolveMountedInlet(node: PoolInletNode, pool: PoolNode | null | undefined): PoolInletNode {
  if (!pool || node.poolId !== pool.id) return node
  const placement = placementOnPoolWall(pool, node.wallIndex, node.wallT)
  return placement ? { ...node, position: placement.position, rotation: placement.rotation } : node
}
