import type { LocalConnectionPort } from '../../core/connection-ports'
import type { PoolValveNode } from './schema'

export function getValvePortsLocal(
  node: Pick<PoolValveNode, 'variant' | 'diameter'>,
): LocalConnectionPort[] {
  if (node.variant === 'two-way') {
    return [
      { id: 'inlet', position: [0, 0, -0.28], direction: [0, 0, -1], diameterM: node.diameter, system: 'waste' },
      { id: 'outlet', position: [0, 0, 0.28], direction: [0, 0, 1], diameterM: node.diameter, system: 'waste' },
    ]
  }
  return [
    { id: 'left', position: [-0.28, 0, 0], direction: [-1, 0, 0], diameterM: node.diameter, system: 'waste' },
    { id: 'right', position: [0.28, 0, 0], direction: [1, 0, 0], diameterM: node.diameter, system: 'waste' },
    { id: 'branch', position: [0, 0, -0.28], direction: [0, 0, -1], diameterM: node.diameter, system: 'waste' },
  ]
}
