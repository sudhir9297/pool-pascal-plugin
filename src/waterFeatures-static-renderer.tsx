'use client'

import { getWaterFeaturesVariant, waterFeaturesVariantKey } from './waterFeatures-geometry'
import type { WaterFeaturesNode } from './waterFeatures-schema'
import { InstancedNodes } from './instanced'

const variantKeyOf = (node: WaterFeaturesNode) => waterFeaturesVariantKey(node.preset, node.seed, node.waterColor)
const getVariant = (node: WaterFeaturesNode) => getWaterFeaturesVariant(node)

/** Collective baked-`/viewer` renderer for one level's waterFeatures (`bakeReplaceRenderer`). */
export default function WaterFeaturesReplaceInstances({ nodes }: { nodes: WaterFeaturesNode[] }) {
  return (
    <InstancedNodes getVariant={getVariant} localSpace nodes={nodes} variantKeyOf={variantKeyOf} />
  )
}
