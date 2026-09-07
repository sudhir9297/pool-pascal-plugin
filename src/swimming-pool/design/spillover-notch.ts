import type { AnyNode } from '@pascal-app/core'
import { PoolNode } from '../core/schema'
import { PoolSpilloverNode } from '../spillover/core/schema'
import { resolvePoolSpillover } from '../spillover/design/placement'

export type SpilloverNotch = {
  center: [number, number]
  rotation: number
  width: number
  /** Optional along-flow boundary samples for curved/free-form pool edges. */
  edgeProfile?: Array<[across: number, along: number]>
  depth: number
  bottom: number
  top: number
}

export function getPoolSpilloverNotches(pool: PoolNode, nodes: Record<string, AnyNode>): SpilloverNotch[] {
  return Object.values(nodes).flatMap((value) => {
    if (String(value.type) !== 'pool:spillover') return []
    const parsed = PoolSpilloverNode.safeParse(value)
    if (!parsed.success) return []
    const connection = parsed.data
    if (![connection.sourcePoolId, connection.targetPoolId].includes(pool.id)) return []
    const otherId = connection.sourcePoolId === pool.id ? connection.targetPoolId : connection.sourcePoolId
    const other = PoolNode.safeParse(nodes[otherId])
    if (!other.success) return []
    const placement = resolvePoolSpillover(pool, other.data, connection.connectionStyle, connection.width)
    if (!placement) return []
    const endpointIndex = placement.sourcePoolId === pool.id ? 0 : 1
    const edge = endpointIndex === 0 ? placement.sourceEdge : placement.targetEdge
    const offsets = edge.map(([, offset]) => offset)
    const minimum = Math.min(0, ...offsets)
    const maximum = Math.max(0, ...offsets)
    const centerOffset = (minimum + maximum) / 2
    const anchor = placement.connectionPath[endpointIndex]
    if (!anchor) return []
    const point: [number, number] = [anchor[0] + Math.cos(placement.rotation[1]) * centerOffset,
      anchor[1] - Math.sin(placement.rotation[1]) * centerOffset]
    const angle = pool.rotation[1]
    const dx = point[0] - pool.position[0]
    const dz = point[1] - pool.position[2]
    return [{
      center: [dx * Math.cos(angle) - dz * Math.sin(angle), dx * Math.sin(angle) + dz * Math.cos(angle)] as [number, number],
      rotation: placement.rotation[1] - angle,
      // The spillover bed already owns the full resolved width.  Narrowing
      // this cutter by the lip thickness leaves two strips of the original
      // pool wall exactly where the water sheet meets the receiving edge.
      // Those strips read as a solid curtain in the gap, especially when the
      // two pools are on the same level.  Cut the wall to the same footprint
      // as the support plane; the lip and outer border provide the visible
      // edge treatment around that opening.
      width: placement.width,
      edgeProfile: edge.length > 1
        ? edge.map(([across, along]) => [across - centerOffset, along] as [number, number])
        : undefined,
      // Curvature belongs to the water sheet, not to the wall cut. Including
      // the edge's along-flow variation here made the CSG cutter grow into a
      // long triangular notch when intersecting pools used a curved path.
      depth: Math.max(pool.shellThickness, pool.copingWidth) * 6 + 0.2,
      bottom: pool.designWaterElevation - 0.025,
      top: pool.finishedDeckElevation + pool.copingThickness + 2,
    }]
  })
}
