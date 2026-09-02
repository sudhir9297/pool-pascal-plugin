'use client'

import { getVariantData, poolSpecOf, poolVariantKey } from './geometry'
import { InstancedNodes } from './instanced'
import type { PoolNode } from './schema'

const variantKeyOf = (node: PoolNode) => poolVariantKey(poolSpecOf(node))
const getVariant = (node: PoolNode) => getVariantData(poolSpecOf(node))

/**
 * Collective renderer for the baked `/viewer` (`bakeReplaceRenderer`): one baked
 * level's pools, instanced in level-local space (the viewer portals this into
 * that level's `Object3D`). Same instancing as the editor `system`, so wind
 * phase varies per pool via `instanceIndex` and a collection is a few draw calls.
 */
export default function PoolReplaceInstances({ nodes }: { nodes: PoolNode[] }) {
  return (
    <InstancedNodes getVariant={getVariant} localSpace nodes={nodes} variantKeyOf={variantKeyOf} />
  )
}
