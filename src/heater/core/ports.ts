import type { LocalConnectionPort } from '../../core/connection-ports'
import type { PoolHeaterNode } from './schema'

export function getHeaterConnectionPortsLocal(
  node: Pick<PoolHeaterNode, 'bodyWidth' | 'bodyHeight' | 'bodyDepth' | 'portDiameter'>,
): LocalConnectionPort[] {
  const x = node.bodyWidth / 2 + node.portDiameter * 2.4
  return [
    { id: 'inlet', position: [x, node.bodyHeight * 0.29, node.bodyDepth * 0.17], direction: [1, 0, 0], diameterM: node.portDiameter, system: 'waste' },
    { id: 'outlet', position: [x, node.bodyHeight * 0.17, node.bodyDepth * 0.17], direction: [1, 0, 0], diameterM: node.portDiameter, system: 'waste' },
  ]
}
