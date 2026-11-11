'use client'

import { useEditor } from '@pascal-app/editor'
import { useViewer } from '@pascal-app/viewer'
import type { PoolNode } from '../core/schema'
import { PoolOutlineControls } from './outline-controls'
import PoolRenderer from './renderer'

/**
 * Editor pool renderer: the read-only renderer plus the outline controls of a
 * selected custom or spline pool while the editor is in select mode.
 */
export default function PoolEditRenderer({ node }: { node: PoolNode }) {
  const outlineSelected = useViewer((state) => state.selection.selectedIds.includes(node.id as never))
  const selecting = useEditor((state) => state.mode === 'select')
  return (
    <PoolRenderer
      node={node}
      overlay={outlineSelected && selecting
        ? (live) => (live.shape === 'custom' || live.shape === 'spline') && <PoolOutlineControls node={live} />
        : undefined}
    />
  )
}
