import type { LocalConnectionPort } from '../../core/connection-ports'
import type { PoolDrainNode } from './schema'

export function getDrainPortsLocal(
  node: Pick<PoolDrainNode, 'bodyDepth' | 'diameter'>,
): LocalConnectionPort[] {
  return [{
    id: 'suction',
    position: [0, -node.bodyDepth * 1.4, 0],
    direction: [0, -1, 0],
    diameterM: node.diameter,
    system: 'waste',
  }]
}
