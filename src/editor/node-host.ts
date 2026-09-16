'use client'

import { useRegistry, type AnyNode } from '@pascal-app/core'
import { useNodeEvents } from '@pascal-app/viewer'
import { useLayoutEffect, type RefObject } from 'react'
import { applyPoolColors, poolColors } from '../core/paint'
import type { Group } from 'three'

type HostedNode = {
  id: string
  type: string
  metadata?: Record<string, unknown>
}

/** Adapts plugin-owned node types to the host's hand-maintained node union. */
export function usePoolNodeHost(
  node: HostedNode,
  rootRef: RefObject<Group>,
  paintRevision?: unknown,
) {
  const handlers = useNodeEvents(node as unknown as AnyNode, node.type as never)
  useRegistry(node.id as never, node.type as never, rootRef)
  // Reapply when paint metadata or procedural geometry changes. Live rotation
  // updates replace the node object every frame, but do not change either of
  // these inputs; traversing the whole pool and cloning every material during
  // that drag would otherwise consume the frame budget.
  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return
    root.userData.poolPaintOwner = node.id
    return applyPoolColors(root, poolColors(node))
  }, [node.id, node.metadata, paintRevision])
  return handlers
}
