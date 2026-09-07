import { placementOnPoolWall, findNearestPoolWall as findNearestSkimmerWall, type SkimmerPlacement } from '../../skimmer/design/placement'
import type { PoolNode } from '../../core/schema'
import type { PoolInletNode } from '../core/schema'

export type InletPlacement = SkimmerPlacement
export const findNearestInletWall = findNearestSkimmerWall
export { placementOnPoolWall }

export function resolveMountedInlet(node: PoolInletNode, pool: PoolNode | null | undefined): PoolInletNode {
  if (!pool || node.poolId !== pool.id) return node
  const placement = placementOnPoolWall(pool, node.wallIndex, node.wallT)
  return placement ? { ...node, position: placement.position, rotation: placement.rotation } : node
}
