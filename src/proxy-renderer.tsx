'use client'

import { getVariantData, poolSpecOf } from './geometry'
import { KindProxy } from './instanced'
import type { PoolNode } from './schema'

const getVariant = (node: PoolNode) => getVariantData(poolSpecOf(node))
const colliderRadius = (node: PoolNode) => Math.max(0.4, (node.height ?? 5) * 0.18)

/**
 * Per-node selection proxy for the instanced pools — a thin binding of the
 * generic {@link KindProxy} to this kind's geometry + collider size.
 */
export default function PoolProxyRenderer({ node }: { node: PoolNode }) {
  return <KindProxy colliderRadius={colliderRadius} getVariant={getVariant} node={node} />
}
