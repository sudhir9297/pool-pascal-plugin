import type { LocalConnectionPort } from '../../core/connection-ports'
import type { PoolSkimmerNode } from './schema'

export function getSkimmerPortsLocal(
  node: Pick<PoolSkimmerNode, 'waterlineOffset' | 'suctionDiameter'>,
): LocalConnectionPort[] {
  return [{
    id: 'suction',
    position: [0, node.waterlineOffset - 0.31, -0.154],
    direction: [0, 0, -1],
    diameterM: node.suctionDiameter,
    system: 'waste',
  }]
}
