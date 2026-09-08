import { PoolNode } from '../core/schema'
import { createDefaultPoolAttachments, isAutomaticPoolFitting } from './default-pool-attachments'

const placementKeys = ['position', 'rotation', 'parentId', 'poolId', 'wallIndex', 'wallT', 'floorAnchor'] as const

/** Reconcile only generated slots. Manually added equipment is never removed. */
export function syncAutomaticPoolFittings(nodes: Record<string, unknown>) {
  const create: ReturnType<typeof createDefaultPoolAttachments> = []
  const update: { id: string; data: Record<string, unknown> }[] = []
  const remove: string[] = []
  for (const value of Object.values(nodes)) {
    if (!value || typeof value !== 'object' || !('type' in value) || value.type !== 'pool:pool') continue
    const parsed = PoolNode.safeParse(value)
    if (!parsed.success || !parsed.data.automaticFittings) continue
    const pool = parsed.data
    const desired = createDefaultPoolAttachments(pool)
    const wanted = new Set<string>(desired.map((node) => node.id))
    for (const node of desired) {
      const current = nodes[node.id]
      if (!current || typeof current !== 'object') { create.push(node); continue }
      const data = Object.fromEntries(placementKeys.flatMap((key) => {
        if (!(key in node)) return []
        const field = (node as Record<string, unknown>)[key]
        return JSON.stringify(field) === JSON.stringify((current as Record<string, unknown>)[key]) ? [] : [[key, field]]
      }))
      if (Object.keys(data).length) update.push({ id: node.id, data })
    }
    for (const item of Object.values(nodes)) {
      if (!item || typeof item !== 'object' || !('id' in item) || !('type' in item) || !('poolId' in item)) continue
      if (typeof item.id !== 'string' || typeof item.type !== 'string' || item.poolId !== pool.id) continue
      if (isAutomaticPoolFitting({ id: item.id, type: item.type }, pool.id) && !wanted.has(item.id)) remove.push(item.id)
    }
  }
  return { create, update, delete: remove }
}
