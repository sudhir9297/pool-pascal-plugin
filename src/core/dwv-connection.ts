import type { NodePort } from '@pascal-app/core'

export type DwvConnectionPlan = {
  start: [number, number, number]
  end: [number, number, number]
  system: 'waste' | 'vent'
  diameter: number
}

/** Build the data passed to the editor's native pipe-segment node. */
export function planDwvConnection(from: NodePort, to: NodePort): DwvConnectionPlan | null {
  if (from.system !== 'waste' && from.system !== 'vent') return null
  if (to.system !== from.system) return null
  if (!Number.isFinite(from.diameter) || !Number.isFinite(to.diameter)) return null
  if (from.diameter! < 1.25 || from.diameter! > 8) return null
  if ((from.shape && from.shape !== 'round') || (to.shape && to.shape !== 'round')) return null
  if (![...from.position, ...to.position].every(Number.isFinite)) return null
  if (Math.hypot(...from.position.map((value, index) => value - to.position[index]!)) < 0.001) return null
  if (Math.abs(from.diameter! - to.diameter!) > 0.001) return null
  return {
    start: [...from.position] as [number, number, number],
    end: [...to.position] as [number, number, number],
    system: from.system,
    diameter: from.diameter!,
  }
}
