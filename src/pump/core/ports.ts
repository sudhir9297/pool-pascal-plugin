import type { LocalConnectionPort } from '../../core/connection-ports'
import type { PoolPumpNode } from './schema'

export const PUMP_BASE_LIFT = 0.27

export function getPumpPortsLocal(
  node: Pick<PoolPumpNode, 'bodyDepth' | 'bodyHeight' | 'diameter'>,
): LocalConnectionPort[] {
  const inletY = -node.bodyHeight * 0.53 + node.bodyHeight * 1.05 * 0.63
  const inletZ = node.bodyDepth / 2 + Math.max(0.12, node.diameter * 2.6)
  const outletY = Math.max(node.bodyHeight * 0.72, node.bodyHeight * 0.52 + node.diameter * 0.9)

  return [
    { id: 'inlet', position: [0, inletY + PUMP_BASE_LIFT, inletZ], direction: [0, 0, 1], diameterM: node.diameter, system: 'waste' },
    { id: 'outlet', position: [0, outletY + PUMP_BASE_LIFT, -node.bodyDepth * 0.025], direction: [0, 1, 0], diameterM: node.diameter, system: 'waste' },
  ]
}
