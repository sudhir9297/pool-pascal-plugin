'use client'

import { createContext, useContext } from 'react'
import { useLiveNodeOverrides, useScene } from '@pascal-app/core'
import type { PoolNode } from '../core/schema'
import { getPoolNode } from './scene-nodes'

export const AttachmentPoolContext = createContext<PoolNode | null>(null)

export function useAttachmentPool(poolId: string | null) {
  const parent = useContext(AttachmentPoolContext)
  const stored = useScene((state) => getPoolNode(state.nodes, poolId))
  const override = useLiveNodeOverrides((state) => poolId ? state.get(poolId) : undefined)
  return parent?.id === poolId ? parent : stored && override ? { ...stored, ...override } as PoolNode : stored
}
