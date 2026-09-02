import { getValvePortPositions } from '../core/geometry'
import type { PoolValveNode } from '../core/schema'

export type ValveConnection = {
  position: [number, number, number]
  direction: [number, number, number]
}

function roundCoordinate(value: number) {
  return Math.round(value * 1e9) / 1e9
}

export function findNearestValveConnection(
  point: readonly [number, number, number],
  valves: readonly PoolValveNode[],
  maxDistance = 0.35,
): ValveConnection | null {
  let best: ValveConnection | null = null
  let bestDistance = maxDistance
  for (const valve of valves) {
    const ports = getValvePortPositions(valve)
    for (const port of ports) {
      const distance = Math.hypot(point[0] - port.x, point[2] - port.z)
      if (distance >= bestDistance) continue
      const direction: [number, number, number] = [
        port.x - valve.position[0],
        port.y - valve.position[1],
        port.z - valve.position[2],
      ]
      const length = Math.hypot(direction[0], direction[1], direction[2])
      if (length <= Number.EPSILON) continue
      best = {
        position: [roundCoordinate(port.x), roundCoordinate(port.y), roundCoordinate(port.z)],
        direction: [direction[0] / length, direction[1] / length, direction[2] / length],
      }
      bestDistance = distance
    }
  }
  return best
}
