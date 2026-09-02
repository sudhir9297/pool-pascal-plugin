'use client'

import { getHotTubVariant } from './hotTub-geometry'
import type { HotTubNode } from './hotTub-schema'
import { KindProxy } from './instanced'

const getVariant = (node: HotTubNode) => getHotTubVariant(node)
const colliderRadius = (node: HotTubNode) => Math.max(0.06, (node.height ?? 0.5) * 0.22)

/** Per-node selection proxy for the instanced hotTubs. */
export default function HotTubProxyRenderer({ node }: { node: HotTubNode }) {
  return <KindProxy colliderRadius={colliderRadius} getVariant={getVariant} node={node} />
}
