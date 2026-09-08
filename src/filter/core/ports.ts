import type { LocalConnectionPort } from '../../core/connection-ports'
import type { PoolFilterNode } from './schema'

export const FILTER_FLOOR_CLEARANCE = 0.012

export type FilterPortRole = 'inlet' | 'outlet' | 'waste'

export type FilterConnectionPort = LocalConnectionPort & {
  id: FilterPortRole
  label: string
}

type FilterPortNode = Pick<PoolFilterNode, 'diameter' | 'bodyHeight' | 'portDiameter' | 'technology'>

export function getFilterConnectionPortsLocal(node: FilterPortNode): FilterConnectionPort[] {
  const radius = node.diameter / 2
  const pedestalHeight = Math.max(0.11, radius * 0.34)
  const tankBottom = FILTER_FLOOR_CLEARANCE + pedestalHeight * 0.72
  const tankTop = tankBottom + node.bodyHeight
  const valveRadius = Math.max(radius * 0.39, node.portDiameter * 2.25)
  const valveCenterY = tankTop + Math.max(0.095, radius * 0.27)
  const sideExtent = Math.max(radius * 0.9, valveRadius + node.portDiameter * 3.2)
  const sideLift = Math.min(node.bodyHeight * 0.035, 0.035)
  const ports: FilterConnectionPort[] = [
    {
      id: 'inlet',
      label: 'Pump inlet',
      position: [-sideExtent, valveCenterY - sideLift, 0],
      direction: [-1, 0, 0],
      diameterM: node.portDiameter,
      system: 'waste',
    },
    {
      id: 'outlet',
      label: 'Pool return',
      position: [sideExtent, valveCenterY + sideLift, 0],
      direction: [1, 0, 0],
      diameterM: node.portDiameter,
      system: 'waste',
    },
  ]

  if (node.technology !== 'cartridge') {
    ports.push({
      id: 'waste',
      label: 'Waste / backwash',
      position: [0, Math.max(tankBottom + node.bodyHeight * 0.035, FILTER_FLOOR_CLEARANCE + node.portDiameter * 1.7), radius + node.portDiameter * 1.7],
      direction: [0, 0, 1],
      diameterM: node.portDiameter,
      system: 'waste',
    })
  }

  return ports
}
