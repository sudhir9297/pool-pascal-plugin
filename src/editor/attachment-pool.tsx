'use client'

import { createContext, useContext } from 'react'
import { useLiveNodeOverrides, useScene } from '@pascal-app/core'
import type { PoolNode } from '../core/schema'
import { getPoolNode } from './scene-nodes'

export const AttachmentPoolContext = createContext<PoolNode | null>(null)

export function useAttachmentPool(poolId: string | null, followLiveResize = false) {
  const parent = useContext(AttachmentPoolContext)
  const stored = useScene((state) => getPoolNode(state.nodes, poolId))
  const override = useLiveNodeOverrides((state) => (
    followLiveResize && poolId ? state.get(poolId) : undefined
  ))
  if (parent?.id === poolId) {
    if (!followLiveResize) return parent
    return override ? { ...parent, ...override } as PoolNode : parent
  }
  return stored && override ? { ...stored, ...override } as PoolNode : stored
}
