import type { LocalConnectionPort } from '../../core/connection-ports'
import type { PoolSkimmerNode } from './schema'

export function getSkimmerPortsLocal(
  node: Pick<PoolSkimmerNode, 'waterlineOffset' | 'suctionDiameter' | 'bodyHeight' | 'bodyDepth'>,
): LocalConnectionPort[] {
  return [{
    id: 'suction',
    // Keep the suction connection beneath the housing, outside the pool wall.
    position: [0, node.waterlineOffset - node.bodyHeight - 0.018, -node.bodyDepth / 2],
    direction: [0, -1, 0],
    diameterM: node.suctionDiameter,
    system: 'waste',
  }]
}
