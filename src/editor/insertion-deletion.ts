import type { AnyNode, AnyNodeId } from '@pascal-app/core'
import { assessInsertionRemoval } from '../core/insertion-removal'

type Owner = { id: string; type: string; parentId: string | null; metadata: unknown }
type Removal = ReturnType<typeof assessInsertionRemoval>
type Confirm = (message: string) => boolean

export function createInsertionDeletionHooks(confirm: Confirm) {
  const decisions = new WeakMap<ReadonlySet<AnyNodeId>, Map<string, Removal>>()
  return {
    onDeleteCascade(node: Owner, nodes: Record<AnyNodeId, AnyNode>, _pending: ReadonlySet<AnyNodeId>, requested: ReadonlySet<AnyNodeId>): AnyNodeId[] {
      if (!requested.has(node.id as AnyNodeId)) return []
      let removal = assessInsertionRemoval(node, nodes)
      if (removal?.changed && !confirm('These pipe connections were edited or extended. Reconnect the original pipe?\n\nOK: remove the generated pipes/elbows (including edits) and restore the original pipe path. Added branches are kept but may be left disconnected.\n\nCancel: delete only the equipment and leave all pipes as they are.')) removal = null
      const selection = decisions.get(requested) ?? new Map<string, Removal>()
      selection.set(node.id, removal)
      decisions.set(requested, selection)
      return removal?.remove ?? []
    },
    onDelete(node: Owner, _nodes: Record<AnyNodeId, AnyNode>, pending: ReadonlySet<AnyNodeId>, requested: ReadonlySet<AnyNodeId>) {
      const removal = decisions.get(requested)?.get(node.id)
      return removal && !pending.has(removal.restore.id) ? [removal.restore] : []
    },
  }
}

export const insertionDeletionHooks = createInsertionDeletionHooks(message => typeof window !== 'undefined' && window.confirm(message))
