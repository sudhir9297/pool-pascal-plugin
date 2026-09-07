import type { AnyNode } from '@pascal-app/core'
import { PoolNode } from '../core/schema'
import { PoolSpilloverNode } from '../spillover/core/schema'
import { resolvePoolSpillover } from '../spillover/design/placement'

export type SpilloverNotch = {
  center: [number, number]
  rotation: number
  width: number
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
    if (!placement || placement.sourcePoolId !== pool.id) return []
    const offsets = placement.sourceEdge.map(([, offset]) => offset)
    const minimum = Math.min(0, ...offsets)
    const maximum = Math.max(0, ...offsets)
    const centerOffset = (minimum + maximum) / 2
    const anchor = placement.connectionPath[0]!
    const point: [number, number] = [anchor[0] + Math.cos(placement.rotation[1]) * centerOffset,
      anchor[1] - Math.sin(placement.rotation[1]) * centerOffset]
    const angle = pool.rotation[1]
    const dx = point[0] - pool.position[0]
    const dz = point[1] - pool.position[2]
    return [{
      center: [dx * Math.cos(angle) - dz * Math.sin(angle), dx * Math.sin(angle) + dz * Math.cos(angle)] as [number, number],
      rotation: placement.rotation[1] - angle,
      width: placement.connectionMode === 'channel' ? Math.max(0.08, placement.width - connection.lipThickness * 2) : placement.width,
      depth: Math.max(pool.shellThickness, pool.copingWidth) * 4 + 0.1 + maximum - minimum,
      bottom: pool.designWaterElevation - 0.025,
      top: pool.finishedDeckElevation + pool.copingThickness + 2,
    }]
  })
}
