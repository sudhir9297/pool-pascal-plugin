'use client'

import { getVariantData, poolSpecOf, poolVariantKey } from './geometry'
import { InstancedKindSystem } from './instanced'
import type { PoolNode } from './schema'

// Module-scope so identities stay stable (the system memoises on them).
const variantKeyOf = (node: PoolNode) => poolVariantKey(poolSpecOf(node))
const getVariant = (node: PoolNode) => getVariantData(poolSpecOf(node))

/**
 * Collective instanced renderer for every placed pool — contributed via
 * `def.system`. Buckets pools by their geometry variant and draws each variant
 * as one InstancedMesh per the procedural geometry dependency sub-mesh, so a collection is a handful of draw
 * calls. Selection/outline come from the per-node proxy renderer.
 */
export default function PoolsSystem() {
  return (
    <InstancedKindSystem<PoolNode>
      getVariant={getVariant}
      kind="pools:pool"
      variantKeyOf={variantKeyOf}
    />
  )
}
