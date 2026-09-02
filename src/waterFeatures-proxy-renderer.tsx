'use client'

import { getWaterFeaturesVariant } from './waterFeatures-geometry'
import type { WaterFeaturesNode } from './waterFeatures-schema'
import { KindProxy } from './instanced'

const getVariant = (node: WaterFeaturesNode) => getWaterFeaturesVariant(node)
const colliderRadius = (node: WaterFeaturesNode) => Math.max(0.08, (node.height ?? 0.4) * 0.3)

/** Per-node selection proxy for the instanced waterFeatures features. */
export default function WaterFeaturesProxyRenderer({ node }: { node: WaterFeaturesNode }) {
  return <KindProxy colliderRadius={colliderRadius} getVariant={getVariant} node={node} />
}
