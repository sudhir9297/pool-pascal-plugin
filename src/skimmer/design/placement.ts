import type { PoolNode } from '../../core/schema'
import type { PoolSkimmerNode } from '../core/schema'
import { findNearestPoolStairAttachment, poolStairAttachmentOnWall } from '../../stair/design/placement'

export type SkimmerPlacement = {
  position: [number, number, number]
  rotation: [number, number, number]
  distance: number
  wallIndex: number
  wallT: number
  poolId: string | null
}

/** Find the nearest pool edge and make local +Z point toward the basin. */
export function findNearestPoolWall(point: readonly [number, number], pools: readonly PoolNode[]): SkimmerPlacement | null {
  const attachment = findNearestPoolStairAttachment([point[0], 0, point[1]], pools)
  if (!attachment) return null
  const pool = pools.find((candidate) => candidate.id === attachment.poolId)!
  return { ...attachment, position: [attachment.position[0], pool.position[1] + pool.designWaterElevation, attachment.position[2]] }
}

export function placementOnPoolWall(pool: PoolNode, wallIndex: number, wallT: number): SkimmerPlacement | null {
  const attachment = poolStairAttachmentOnWall(pool, wallIndex, wallT)
  return attachment ? { ...attachment, position: [attachment.position[0], pool.position[1] + pool.designWaterElevation, attachment.position[2]] } : null
}

export function resolveMountedSkimmer(node: PoolSkimmerNode, pool: PoolNode | null | undefined): PoolSkimmerNode {
  if (!pool || node.poolId !== pool.id) return node
  const placement = placementOnPoolWall(node.parentId === pool.id ? { ...pool, position: [0, 0, 0], rotation: [0, 0, 0] } : pool, node.wallIndex, node.wallT)
  return placement ? { ...node, position: placement.position, rotation: placement.rotation } : node
}
