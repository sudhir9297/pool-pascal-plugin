import { getDrainPortDirection, getDrainPortPosition } from '../core/geometry'
import type { PoolDrainNode } from '../core/schema'

export type DrainPipeConnection = {
  drainId: string
  position: [number, number, number]
  direction: [number, number, number]
}

export function getDrainPipeConnection(node: PoolDrainNode): DrainPipeConnection {
  const position = getDrainPortPosition(node)
  const direction = getDrainPortDirection(node)
  return {
    drainId: node.id,
    position: [position.x, position.y, position.z],
    direction: [direction.x, direction.y, direction.z],
  }
}

export function findNearestDrainConnection(
  point: readonly [number, number, number],
  drains: readonly PoolDrainNode[],
  tolerance = 0.08,
): DrainPipeConnection | null {
  let nearest: DrainPipeConnection | null = null
  let nearestDistance = tolerance
  for (const drain of drains) {
    const connection = getDrainPipeConnection(drain)
    const distance = Math.hypot(
      point[0] - connection.position[0],
      point[1] - connection.position[1],
      point[2] - connection.position[2],
    )
    if (distance <= nearestDistance) {
      nearest = connection
      nearestDistance = distance
    }
  }
  return nearest
}
