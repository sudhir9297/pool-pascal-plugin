'use client'

import { useRegistry, type AnyNode } from '@pascal-app/core'
import { useNodeEvents } from '@pascal-app/viewer'
import type { RefObject } from 'react'
import type { Group } from 'three'

type HostedNode = {
  id: string
  type: string
}

/** Adapts plugin-owned node types to the host's hand-maintained node union. */
export function usePoolNodeHost(node: HostedNode, rootRef: RefObject<Group>) {
  const handlers = useNodeEvents(node as unknown as AnyNode, node.type as never)
  useRegistry(node.id as never, node.type as never, rootRef)
  return handlers
}
