import type { LocalConnectionPort } from '../../core/connection-ports'
import type { PoolInletNode } from './schema'

export function getInletPortsLocal(
  node: Pick<PoolInletNode, 'bodyDepth' | 'nozzleDiameter' | 'verticalOffset'>,
): LocalConnectionPort[] {
  return [{
    id: 'return',
    position: [0, node.verticalOffset, -node.bodyDepth - 0.0375],
    direction: [0, 0, -1],
    diameterM: node.nozzleDiameter,
    system: 'waste',
  }]
}
