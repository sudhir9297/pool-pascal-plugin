import type { PoolNode } from '../core/schema'
import { PoolDrainNode } from '../drain/core/schema'
import { PoolInletNode } from '../inlet/core/schema'
import { PoolSkimmerNode } from '../skimmer/core/schema'
import { PoolStairNode } from '../stair/core/schema'
import { resolvePoolAttachment } from './pool-attachments'
import { planPoolFittings, type WallStation } from './pool-fitting-layout'

export function automaticFittingId(poolId: string, kind: string, index: number) {
  return `pool-${kind}_auto_${poolId}_${index + 1}`
}

export function isAutomaticPoolFitting(node: { id: string; type: string }, poolId: string) {
  const kind = node.type.replace('pool:', '')
  if (!['skimmer', 'inlet', 'drain', 'stair'].includes(kind)) return false
  const prefix = `pool-${kind}_auto_${poolId}_`
  return node.id.startsWith(prefix) && /^[1-9]\d*$/.test(node.id.slice(prefix.length))
}

/** Stable slots let resize add/remove only generated fittings and retain edits. */
export function createDefaultPoolAttachments(pool: PoolNode) {
  const layout = planPoolFittings(pool)
  const base = (kind: string, index: number) => ({
    id: automaticFittingId(pool.id, kind, index), poolId: pool.id, parentId: pool.id,
  })
  const wall = (station: WallStation) => ({ wallIndex: station.wallIndex, wallT: station.wallT })
  const nodes = [
    ...layout.skimmers.map((station, i) => PoolSkimmerNode.parse({ ...base('skimmer', i), ...wall(station), name: `Skimmer ${i + 1}` })),
    ...layout.inlets.map((station, i) => PoolInletNode.parse({ ...base('inlet', i), ...wall(station), name: `Inlet ${i + 1}` })),
    ...layout.drains.map(([x, z], i) => PoolDrainNode.parse({ ...base('drain', i), position: [x, 0, z], name: `Drain ${i + 1}` })),
    ...(layout.stair ? [PoolStairNode.parse({ ...base('stair', 0), ...wall(layout.stair), name: 'Pool stair' })] : []),
  ]
  return nodes.map((node) => resolvePoolAttachment(node, pool)!)
}
